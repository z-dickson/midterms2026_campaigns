"""Paths and constants for the pipeline. All paths are relative to the repo root."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# --- Raw inputs (gitignored) -------------------------------------------------
RAW = ROOT / 'data' / 'raw'

SNAPSHOT = '2026-10-29'  # date of the campaign-website crawl
SITES_PARQUET = RAW / 'campaign_sites' / f'sites_{SNAPSHOT}.parquet'

FRACTRACKER_DATE = '20260728'
FRACTRACKER_CSV = RAW / 'fractracker' / f'fractracker_data_center_all_{FRACTRACKER_DATE}.csv'

# Census boundaries: 120th-Congress districts (TIGER 2026) + cartographic state outlines (2025)
CENSUS_DIR = RAW / 'census'
CD_URL = 'https://www2.census.gov/geo/tiger/TIGER2026/CD/'
CD_FIPS = ['01', '02', '04', '05', '06', '08', '09', '10', '11', '12', '13', '15', '16', '17', '18',
           '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33',
           '34', '35', '36', '37', '38', '39', '40', '41', '42', '44', '45', '46', '47', '48', '49',
           '50', '51', '53', '54', '55', '56', '60', '66', '69', '72', '78']
CD_ZIPS = [f'tl_2026_{fips}_cd120.zip' for fips in CD_FIPS]
STATE_URL = 'https://www2.census.gov/geo/tiger/GENZ2025/shp/'
STATE_ZIP = 'cb_2025_us_state_500k.zip'

# --- Intermediates (gitignored) ----------------------------------------------
INTERIM = ROOT / 'data' / 'interim'
SITES_CLEAN = INTERIM / 'sites_clean.parquet'
MAP_PREVIEW = INTERIM / 'map_preview.png'

# --- Dashboard outputs -------------------------------------------------------
SITE_DATA = ROOT / 'site' / 'data'

# --- Analysis parameters -----------------------------------------------------
MIN_SITE_CHARS = 1000  # sites with this many characters of text or fewer are not analyzed
