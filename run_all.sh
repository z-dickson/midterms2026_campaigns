#!/usr/bin/env bash
# Run the full pipeline: raw data -> data/interim/ -> site/data/*.json
# Usage: ./run_all.sh            (set PYTHON=... to use a different interpreter)
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-python3}"

"$PY" pipeline/01_clean_text.py
"$PY" pipeline/02_measures.py
"$PY" pipeline/03_district_shapes.py   # add --preview for data/interim/map_preview.png
"$PY" pipeline/04_data_centers.py
"$PY" pipeline/05_social_image.py      # needs matplotlib
