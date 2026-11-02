# What House candidates are running on

**Live dashboard: https://z-dickson.github.io/house-2026/**

A dashboard comparing what Democratic and Republican nominees for the U.S. House say on their 2026 campaign websites: which issues they emphasize, which people and groups they name, their signature phrases, searchable quotes, and a district map that includes local data centers.

The dashboard is a static website (HTML, JavaScript and JSON). It needs no server and can be hosted anywhere that serves files.

## What it shows

- **Issues**: the share of each party's issue talk that goes to each of 29 topics, plus the share of candidates who mention each topic at all. You can filter to incumbents, challengers or open seats.
- **District map**: the 2026 district lines. Click a district to see its nominees, their websites, the topics they emphasize, and the data centers located there.
- **Names and endorsers**: how often each party names figures such as Trump, Biden or Musk, and groups such as the AFL-CIO or the NRA.
- **Signature phrases**: 40 phrases that sharply divide the two parties.
- **Quote finder**: one sentence per candidate and topic, pulled automatically from their site.
- **Candidates**: a searchable table of all 883 nominees.

The Method tab explains the measures and their caveats.

## Data sources

| Source | Used for |
|---|---|
| Campaign website text of 2026 House nominees, crawled October 29, 2026 (our own crawl; not distributed here) | All text measures |
| U.S. Census Bureau TIGER/Line 2026, 120th Congress districts (`tl_2026_*_cd120`), and the 2025 cartographic state boundaries (`cb_2025_us_state_500k`) | District map |
| [FracTracker Alliance](https://www.fractracker.org/) data center map, downloaded July 28, 2026 | Data centers per district |

**None of the data is committed to this repository.** `data/` and `site/data/` are gitignored. To rebuild, put the inputs where `config.py` expects them (see below). The pipeline downloads the Census files itself if they are missing.

## Repository layout

```
config.py                      paths and constants (all relative to the repo root)
requirements.txt
run_all.sh                     runs the pipeline in order
pipeline/
  topics.py                    keyword dictionaries: topics, names, endorsers, phrases
  common.py                    shared helpers (Census download, JSON writer, labels)
  01_clean_text.py             site text -> boilerplate removed -> data/interim/sites_clean.parquet
  02_measures.py               -> site/data/{topics,names,phrases,quotes,coverage,candidates}.json
  03_district_shapes.py        Census shapes -> projected SVG paths -> site/data/{districts,states}.json
  04_data_centers.py           FracTracker sites -> districts -> site/data/{dc_districts,dc_sites}.json
  05_social_image.py           -> site/og-image.png (social media preview)
site/                          the static dashboard (deploy this folder)
  index.html, css/, js/, favicon.svg, og-image.png
  data/                        generated JSON (gitignored)
data/                          inputs and intermediates (gitignored)
  raw/campaign_sites/sites_2026-10-29.parquet
  raw/fractracker/fractracker_data_center_all_20260728.csv
  raw/census/                  downloaded automatically if missing
```

## Rebuilding the dashboard data

```bash
pip install -r requirements.txt
./run_all.sh            # about 2 minutes
```

The pipeline expects two inputs that are not public:

- `data/raw/campaign_sites/sites_2026-10-29.parquet`: one row per nominee. It needs `nominee_id`, `state`, `district`, `major_party`, `nominee_name_wiki`, `incumbent_challenge`, `outcome`, `seeds`, `homepage_final_url`, `n_chars_site` and `text_site` (the concatenated text of the crawled pages).
- `data/raw/fractracker/fractracker_data_center_all_20260728.csv`: FracTracker's data center export.

Rebuilt outputs are deterministic. Optional: `python3 pipeline/03_district_shapes.py --preview` writes a PNG of the projected map to check the layout.

## Running the site locally

```bash
python3 -m http.server 8000 --directory site
# then open http://localhost:8000
```

Open it through a local server rather than as a file. Browsers block a page opened from disk from loading its data files.

## Hosting

Upload the whole `site/` folder, including `site/data/`, to any static host. Options include Netlify (drag and drop the folder at app.netlify.com/drop), Cloudflare Pages, GitHub Pages, or a subfolder of an existing website.

The live version is at https://z-dickson.github.io/house-2026/, served from a folder of a Jekyll site. `./deploy_to_site.sh <folder>` copies an updated build into such a folder. If the host site minifies JavaScript, exclude this folder from that step: the page uses modern syntax (`?.`, `??`) that older minifiers reject.

Note that the generated `site/data/*.json` files become public once the site is hosted, because the page loads them in the browser. They contain derived measures, quotes and the candidate list, not the raw scraped text.

After choosing an address, set `og:image` and `twitter:image` in `site/index.html` to the image's absolute URL (for example `https://example.org/campaign-sites/og-image.png`), and add `og:url`. Social media previews need absolute URLs.

## How the page is built

- `site/index.html`: the page markup.
- `site/css/style.css`: theme colors (light and dark) and layout.
- `site/js/dash.js`: a small data runtime. It loads `data/<id>.json` on first use, computes derived tables, and redraws charts when data arrives, a tab opens or the window resizes.
- `site/js/app.js`: the charts, map, quote finder and table, drawn with [d3](https://d3js.org/) v7 (loaded from jsDelivr).

The district shapes are projected in Python (an Albers USA-style layout with Alaska and Hawaii insets) and shipped as SVG paths, so the page needs no map library.

## License

Code: MIT (see `LICENSE`). The license covers the code only, not the data sources listed above, which keep their own terms.
