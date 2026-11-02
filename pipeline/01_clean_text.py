"""Step 1: strip boilerplate lines from campaign-site text.

Input:  data/raw/campaign_sites/sites_<SNAPSHOT>.parquet  (one row per nominee, raw site text)
Output: data/interim/sites_clean.parquet  (sites with > MIN_SITE_CHARS characters; raw text
        replaced by a cleaned `tc` column)

Cleaning: collapse whitespace per line, drop lines shorter than 3 characters, exact-duplicate
lines, and lines matching common boilerplate (privacy/cookie notices, FEC disclaimers,
donation-form fine print, store/checkout text, ...).
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pandas as pd  # noqa: E402

import config  # noqa: E402

# Lines matching BOILER are dropped wherever they appear: donation forms, legal and privacy notices, texting terms, stores.
BOILER = re.compile(r'privacy policy|cookie|terms of (?:use|service)|paid for by|actblue|winred|federal election|\bfec\b|tax[- ]deductible|personal funds|foreign national|federal contractor|credit card|unsubscribe|msg ?& ?data|message and data|reply stop|text stop|copyright|all rights reserved|webstore|\bcart\b|checkout|recaptcha|javascript|personally identifiable|tracking number', re.I)
# These words also appear in real policy text ("employer-sponsored insurance", "tax refund"),
# so they only drop short lines such as form labels and store notices.
BOILER_SHORT = re.compile(r'privacy|contribution|employer|occupation|shipping|refund', re.I)
SHORT_LINE = 80


def clean(t):
    out = []
    seen = set()
    for l in t.split('\n'):
        l = re.sub(r'\s+', ' ', l).strip()
        if len(l) < 3 or l in seen or BOILER.search(l) or (len(l) < SHORT_LINE and BOILER_SHORT.search(l)):
            continue
        seen.add(l)
        out.append(l)
    return '\n'.join(out)


def main():
    s = pd.read_parquet(config.SITES_PARQUET)
    s = s[s.n_chars_site > config.MIN_SITE_CHARS].reset_index(drop=True)
    s['tc'] = s.text_site.map(clean)
    config.INTERIM.mkdir(parents=True, exist_ok=True)
    s.drop(columns=['text_site']).to_parquet(config.SITES_CLEAN)
    print(f'{len(s)} sites cleaned -> {config.SITES_CLEAN.relative_to(config.ROOT)}')


if __name__ == '__main__':
    main()
