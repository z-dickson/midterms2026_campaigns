"""Step 3: project congressional districts and states to SVG path strings for the dashboard map.

Input:  data/raw/census/tl_2026_<fips>_cd120.zip, data/raw/census/cb_2025_us_state_500k.zip
        (downloaded from the Census Bureau if missing)
Output: site/data/districts.json  one row per district: seat, state, SVG path, bounding box, canvas size
        site/data/states.json     one row per state: abbreviation, name, SVG path, bounding box
        data/interim/map_preview.png  (only with --preview)

Projection: Albers-style layout on a 975px-wide canvas. Lower 48 in EPSG:5070, Alaska (EPSG:3338,
scaled to 35%) and Hawaii (ESRI:102007, main islands only) as insets in the lower left. Districts are
clipped to their state's cartographic (land) outline. DC and the territories are excluded.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pandas as pd  # noqa: E402
from shapely import affinity  # noqa: E402
from shapely.geometry import Polygon, box  # noqa: E402

import config  # noqa: E402
from pipeline.common import ensure_census, read_districts, read_states, write_json  # noqa: E402

W = 975  # canvas width (px)
M = 10   # margin (px)
CRS = {'main': 5070, 'AK': 3338, 'HI': 'ESRI:102007'}
TERRITORIES = ['PR', 'VI', 'GU', 'MP', 'AS']


def grp(a):
    return 'AK' if a == 'AK' else 'HI' if a == 'HI' else 'main'


def project(gdf):
    """Reproject each group (lower 48 / AK / HI) to its own CRS; drop the CRS since coordinates are mixed."""
    parts = []
    for k, c in CRS.items():
        sub = gdf[gdf.STUSPS.map(grp) == k].to_crs(c)
        sub['grp'] = k
        parts.append(sub.set_crs(None, allow_override=True))
    return pd.concat(parts)


def svg_path(g):
    polys = [g] if isinstance(g, Polygon) else [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon)]
    out = []
    for p in polys:
        if p.area < 0.0005:
            continue
        for ring in [p.exterior, *p.interiors]:
            c = list(ring.coords)[:-1]
            out.append('M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in c) + 'Z')
    return ''.join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--preview', action='store_true', help='also write data/interim/map_preview.png (needs matplotlib)')
    args = ap.parse_args()

    ensure_census()
    cd = read_districts()
    st = read_states(['STATEFP', 'STUSPS', 'NAME', 'geometry'])
    st = st[~st.STUSPS.isin(TERRITORIES)]
    cd = cd.merge(st[['STATEFP', 'STUSPS']], on='STATEFP')
    cd = cd[(cd.CD120FP != 'ZZ') & cd.STUSPS.isin(st.STUSPS) & (cd.STUSPS != 'DC')]
    cd['seat'] = cd.STUSPS + '-' + cd.CD120FP
    cd = cd.to_crs(4269)
    st = st.to_crs(4269)

    # clip districts to state land outlines; keep only Hawaii's main islands
    land = st.set_index('STUSPS').geometry
    cd['geometry'] = [g.intersection(land[s]) for g, s in zip(cd.geometry, cd.STUSPS)]
    main_hi = box(-161, 18, -154, 23)
    for df in (cd, st):
        m = df.STUSPS == 'HI'
        df.loc[m, 'geometry'] = df.loc[m, 'geometry'].intersection(main_hi)

    cdp = project(cd)
    stp = project(st)

    # scale so the lower 48 fill the canvas width
    mb = stp[stp.grp == 'main'].total_bounds
    s = (W - 2 * M) / (mb[2] - mb[0])
    main_h = (mb[3] - mb[1]) * s + M

    def place(g, k, ref):
        """Map projected coordinates to canvas pixels (y down). ref: bounds of the group's states in its CRS."""
        if k == 'main':
            return affinity.affine_transform(g, [s, 0, 0, -s, M - s * mb[0], M + s * mb[3]])
        ks = s * 0.35 if k == 'AK' else s * 1.0
        g = affinity.affine_transform(g, [ks, 0, 0, -ks, -ks * ref[0], ks * ref[3]])  # top-left of group at 0,0
        h = (ref[3] - ref[1]) * ks
        if k == 'AK':
            return affinity.translate(g, M, main_h - h + 5)
        return affinity.translate(g, 285, main_h - h - 8)

    refs = {k: stp[stp.grp == k].total_bounds for k in CRS}
    for df in (cdp, stp):
        df['geometry'] = [place(g, k, refs[k]) for g, k in zip(df.geometry, df.grp)]
    cdp['geometry'] = cdp.geometry.simplify(0.06, preserve_topology=True)
    stp['geometry'] = stp.geometry.simplify(0.25, preserve_topology=True)
    VW = W
    VH = round(max(stp.total_bounds[3], cdp.total_bounds[3]) + M)
    print('canvas', VW, VH)

    rows = []
    for seat, a, g in zip(cdp.seat, cdp.STUSPS, cdp.geometry):
        b = g.bounds
        rows.append(dict(seat=seat, state=a, path=svg_path(g), x0=round(b[0], 2), y0=round(b[1], 2),
                         x1=round(b[2], 2), y1=round(b[3], 2), vw=VW, vh=VH))
    srows = []
    for a, n, g in zip(stp.STUSPS, stp.NAME, stp.geometry):
        b = g.bounds
        srows.append(dict(state=a, name=n, path=svg_path(g), x0=round(b[0], 2), y0=round(b[1], 2),
                          x1=round(b[2], 2), y1=round(b[3], 2)))
    write_json(rows, 'districts', separators=(',', ':'))
    write_json(srows, 'states', separators=(',', ':'))
    print(f'districts.json: {len(rows)} rows; states.json: {len(srows)} rows')

    if args.preview:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        ax = cdp.plot(figsize=(10, 6.5), edgecolor='white', linewidth=.2, color='#7a9')
        stp.boundary.plot(ax=ax, color='k', linewidth=.4)
        ax.set_xlim(0, VW)
        ax.set_ylim(VH, 0)
        ax.set_aspect('equal')
        config.INTERIM.mkdir(parents=True, exist_ok=True)
        plt.savefig(config.MAP_PREVIEW, dpi=90)
        print('preview ->', config.MAP_PREVIEW.relative_to(config.ROOT))


if __name__ == '__main__':
    main()
