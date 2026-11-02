"""Helpers shared by the numbered pipeline scripts."""
import json
import re
import urllib.request

import config
from pipeline.topics import TOPICS

PARTY = {'D': 'Democrat', 'R': 'Republican'}
STATUS = {'I': 'Incumbent', 'C': 'Challenger', 'O': 'Open seat', '': 'Unknown'}


def compile_topics():
    """[(id, label, group, compiled regex)] for every topic in topics.TOPICS."""
    return [(k, l, g, re.compile(p, f)) for k, l, g, p, f in TOPICS]


def write_json(obj, name, **kw):
    """Write obj to site/data/<name>.json."""
    config.SITE_DATA.mkdir(parents=True, exist_ok=True)
    with open(config.SITE_DATA / f'{name}.json', 'w') as fh:
        json.dump(obj, fh, **kw)


# --- Census boundary files ----------------------------------------------------

def ensure_census():
    """Download any missing Census zips into data/raw/census/."""
    config.CENSUS_DIR.mkdir(parents=True, exist_ok=True)
    wanted = [(config.CD_URL, z) for z in config.CD_ZIPS] + [(config.STATE_URL, config.STATE_ZIP)]
    for base, name in wanted:
        dest = config.CENSUS_DIR / name
        if dest.exists():
            continue
        print('downloading', base + name)
        tmp = dest.with_name(name + '.part')
        req = urllib.request.Request(base + name, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as r, open(tmp, 'wb') as fh:
            fh.write(r.read())
        tmp.rename(dest)


def read_districts():
    """All congressional-district polygons (every state/territory file, concatenated)."""
    import geopandas as gpd
    import pandas as pd
    return pd.concat([gpd.read_file(f'zip://{config.CENSUS_DIR / z}') for z in sorted(config.CD_ZIPS)])


def read_states(columns):
    import geopandas as gpd
    return gpd.read_file(f'zip://{config.CENSUS_DIR / config.STATE_ZIP}')[columns]
