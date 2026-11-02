#!/usr/bin/env bash
# Copy the built dashboard (site/, including site/data/) into a folder of another static website.
# Usage: ./deploy_to_site.sh /path/to/website/house-2026
# Only files are added or overwritten; nothing in the target is deleted.
# If the page's address changes, update the canonical/og:url/og:image/twitter:image URLs in the copied index.html.
set -euo pipefail
cd "$(dirname "$0")"
target="${1:?usage: ./deploy_to_site.sh /path/to/website/folder}"
[ -f site/data/topics.json ] || { echo "site/data is empty: run ./run_all.sh first" >&2; exit 1; }
mkdir -p "$target"
# Keep the target's index.html URLs (absolute og: tags) if it already has them.
keep_head=""
if [ -f "$target/index.html" ] && grep -q 'property="og:url"' "$target/index.html"; then keep_head=1; fi
cp -r site/css site/js site/data site/favicon.svg site/og-image.png "$target/"
if [ -n "$keep_head" ]; then
  echo "Copied css/js/data/images. index.html left as is (it has site-specific URLs); merge page changes by hand if site/index.html changed."
else
  cp site/index.html "$target/"
  echo "Copied everything. Set absolute URLs for og:image / twitter:image / og:url in $target/index.html."
fi
