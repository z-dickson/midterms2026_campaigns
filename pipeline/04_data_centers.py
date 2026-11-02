"""Step 4: assign FracTracker data-center sites to congressional districts.

Input:  data/raw/fractracker/fractracker_data_center_all_<DATE>.csv
        data/raw/census/tl_2026_<fips>_cd120.zip, cb_2025_us_state_500k.zip
        site/data/districts.json  (step 3; defines the list of seats)
Output: site/data/dc_districts.json  per seat: site counts by stage, sites with community pushback
        site/data/dc_sites.json      one row per site that falls in a district

Sites are dropped if flagged as duplicates, have low location confidence or no coordinates,
or fall outside every district (or in a 'ZZ' water/undefined district). Sites are placed by
coordinates only: a few rows have a wrong `state` field (their city, county and ZIP match the
coordinates), so the listed state is not used as a filter.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import geopandas as gpd  # noqa: E402
import pandas as pd  # noqa: E402

import config  # noqa: E402
from pipeline.common import ensure_census, read_districts, read_states, write_json  # noqa: E402

STAGE = {'Operating': 'Operating', 'Expanding': 'Operating',
         'Approved/Permitted/Under construction': 'Approved or under construction',
         'Proposed': 'Proposed', 'Pre-proposal': 'Proposed',
         'Cancelled': 'Cancelled or suspended', 'Suspended': 'Cancelled or suspended'}


def text(v, default=''):
    return str(v).strip() if pd.notna(v) else default


def main():
    d = pd.read_csv(config.FRACTRACKER_CSV, low_memory=False)
    print('rows', len(d), 'dup flag', d.delete_dup.notna().sum(), 'no coords', d[['lat', 'long']].isna().any(axis=1).sum())
    d = d[d.delete_dup.isna()]
    d['conf'] = d.location_confidence.astype(str).str.strip().str.lower()
    d = d[(d.conf != 'low') & d.lat.notna() & d.long.notna()]
    d['stage'] = d.status.map(STAGE)
    g = gpd.GeoDataFrame(d, geometry=gpd.points_from_xy(d.long, d.lat), crs=4326)

    ensure_census()
    cd = read_districts().to_crs(4326)
    cd = cd.merge(read_states(['STATEFP', 'STUSPS']), on='STATEFP')
    cd['seat'] = cd.STUSPS + '-' + cd.CD120FP

    j = gpd.sjoin(g, cd[['seat', 'geometry']], how='left', predicate='within')
    print('unmatched', j.seat.isna().sum())
    j = j[j.seat.notna() & ~j.seat.str.endswith('ZZ')]
    listed = j.state.astype(str).str.strip()
    print('sites whose listed state differs from their district (kept)', (j.seat.str[:2] != listed).sum())
    j['pushback'] = j.community_pushback.astype(str).str.strip().str.lower().eq('yes')

    seats = json.load(open(config.SITE_DATA / 'districts.json'))
    agg = []
    for s in [r['seat'] for r in seats]:
        x = j[j.seat == s]
        c = x.stage.value_counts()
        agg.append(dict(seat=s, operating=int(c.get('Operating', 0)),
                        construction=int(c.get('Approved or under construction', 0)),
                        proposed=int(c.get('Proposed', 0)), stalled=int(c.get('Cancelled or suspended', 0)),
                        pushback=int(x.pushback.sum()),
                        active=int(c.get('Operating', 0) + c.get('Approved or under construction', 0) + c.get('Proposed', 0))))
    sites = [dict(site_id=str(r.facility_id) if pd.notna(r.facility_id) else str(r.OBJECTID), seat=r.seat,
                  name=text(r.facility_name, 'Unnamed site'), operator=text(r.operator_name), city=text(r.city),
                  stage=r.stage, size=str(r.sizerank).replace('Unknown', '').strip() if pd.notna(r.sizerank) else '',
                  pushback='Yes' if r.pushback else '')
             for r in j.itertuples()]
    write_json(agg, 'dc_districts')
    write_json(sites, 'dc_sites', ensure_ascii=False)
    a = pd.DataFrame(agg)
    print(f'dc_sites.json: {len(sites)} sites; dc_districts.json: {len(agg)} seats, {(a.active > 0).sum()} with active sites')
    print('duplicate site_ids', pd.Series([x['site_id'] for x in sites]).duplicated().sum())


if __name__ == '__main__':
    main()
