"""Step 2: topic, name and phrase measures by party, plus quotes, coverage and a candidate table.

Input:  data/interim/sites_clean.parquet          (step 1; analyzed sites with cleaned text `tc`)
        data/raw/campaign_sites/sites_<SNAPSHOT>.parquet  (all nominees, for coverage/candidates)
Output: site/data/topics.json      share of sites mentioning each topic, and mean attention share, by party x view
        site/data/names.json       share of sites mentioning each political figure/label/endorser, by party x view
        site/data/phrases.json     share of sites using each curated phrase, by party x view
        site/data/quotes.json      first quotable sentence per site x topic
        site/data/coverage.json    nominees vs. sites analyzed, by party
        site/data/candidates.json  one row per nominee (all of them, analyzed or not)

"Views" are all candidates and the Incumbent / Challenger / Open seat subsets.
A topic's "attention" on a site is its share of all topic-keyword matches on that site.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

import config  # noqa: E402
from pipeline.common import PARTY, STATUS, compile_topics, write_json  # noqa: E402
from pipeline.topics import GROUPS, NAMES, PHRASES  # noqa: E402

# Short label shown on the dashboard for each crawl outcome
SITE_STATUS = {'ok': 'Site analyzed', 'wayback_only': 'Site analyzed (archived copy)',
               'no_website': 'No campaign website found', 'blocked_bot_protection': 'Site blocked our crawler',
               'unreachable': 'Site unreachable', 'robots_disallowed': 'Site blocked our crawler',
               'http_404': 'Site unreachable'}
VIEWS = ['Incumbent', 'Challenger', 'Open seat']
SPLIT = re.compile(r'(?<=[.!?])\s+(?=[A-Z“"])')  # sentence boundary


def load():
    s = pd.read_parquet(config.SITES_CLEAN)
    s['status'] = s.incumbent_challenge.fillna('').map(STATUS)
    s['seat'] = s.state + '-' + s.district
    s['words'] = s.tc.str.split().str.len()
    full = pd.read_parquet(config.SITES_PARQUET).drop(columns=['text_site'])
    return s, full


def party_measures(s, T, cnt, attn):
    """topics / names / phrases rows for each view."""
    N = ([(a, b, 'Political figures & labels', re.compile(c, d)) for a, b, c, d in NAMES]
         + [(it.lower()[:12], it, g, re.compile(p, re.I)) for it, g, p in GROUPS])
    ncnt = pd.DataFrame({b: s.tc.map(lambda t, rx=rx: bool(rx.search(t))) for a, b, g, rx in N})
    P = [(l, re.compile(p, re.I)) for l, p in PHRASES]
    pcnt = pd.DataFrame({l: s.tc.map(lambda t, rx=rx: bool(rx.search(t))) for l, rx in P})

    subsets = [('All candidates', slice(None))] + [(v, s.status == v) for v in VIEWS]
    topic_rows, name_rows, phrase_rows = [], [], []
    for sname, mask in subsets:
        m = s.index if isinstance(mask, slice) else s.index[mask]
        party = s.major_party[m]
        n = s.loc[m].major_party.value_counts()
        ment = (cnt.loc[m] > 0).groupby(party).mean()
        at = attn.loc[m].groupby(party).mean()
        for k, l, g, rx in T:
            topic_rows.append(dict(view=sname, topic=l, group=g,
                                   dem_mention=round(ment.at['D', k], 4), rep_mention=round(ment.at['R', k], 4),
                                   dem_attention=round(at.at['D', k], 4), rep_attention=round(at.at['R', k], 4),
                                   dem_sites=int(n['D']), rep_sites=int(n['R'])))
        nm = ncnt.loc[m].groupby(party).mean()
        for a, b, g, rx in N:
            name_rows.append(dict(view=sname, item=b, group=g,
                                  dem_share=round(nm.at['D', b], 4), rep_share=round(nm.at['R', b], 4)))
        pm = pcnt.loc[m].groupby(party).mean()
        for l, rx in P:
            d, r = pm.at['D', l], pm.at['R', l]
            phrase_rows.append(dict(view=sname, phrase=l, dem_share=round(d, 4), rep_share=round(r, 4),
                                    leans='Democratic' if d > r else 'Republican'))
    return topic_rows, name_rows, phrase_rows


def quotes(s, T):
    """For each site x topic: the first sentence (60-300 chars, from a line >= 80 chars) matching the topic."""
    out = []
    for i, r in s.iterrows():
        lines = [l for l in r.tc.split('\n') if len(l) >= 80]
        for k, l, g, rx in T:
            q = None
            for line in lines:
                if not rx.search(line):
                    continue
                for sent in SPLIT.split(line):
                    if rx.search(sent) and 60 <= len(sent) <= 300 and not sent.lower().startswith(('home', 'menu', 'skip')):
                        q = sent.strip()
                        break
                if q:
                    break
            if q:
                out.append(dict(quote_id=f'{r.nominee_id}-{k}', topic=l, name=r.nominee_name_wiki, seat=r.seat,
                                party=PARTY[r.major_party], status=r.status, quote=q))
    return out


def coverage(s, full):
    cov = []
    for p, lbl in PARTY.items():
        f = full[full.major_party == p]
        ss = s[s.major_party == p]
        cov.append(dict(party=lbl, nominees=len(f), sites_analyzed=len(ss), median_words=int(ss.words.median())))
    return cov


def candidates(s, full, T, cnt, attn):
    """One row per nominee in the raw file (including those without usable site text)."""
    cnt = cnt.set_axis(s.nominee_id)
    attn = attn.set_axis(s.nominee_id)
    lab = {k: l for k, l, g, rx in T}
    words = dict(zip(s.nominee_id, s.words))
    cand = []
    for _, r in full.iterrows():
        i = r.nominee_id
        an = i in words
        if an:
            a = attn.loc[i].sort_values(ascending=False, kind='stable')  # stable: ties keep dictionary order
            top = [lab[k] for k, v in a.items() if v > 0][:3]
            ment = [lab[k] for k in cnt.columns if cnt.at[i, k] > 0]
            ss = SITE_STATUS.get(r.outcome, 'Site analyzed')
        else:
            top = []
            ment = []
            ss = (SITE_STATUS.get(r.outcome, 'Site unreachable') if r.outcome not in ('ok', 'wayback_only')
                  else 'Too little text to analyze')
        web = (r.homepage_final_url or '') if an or r.outcome != 'no_website' else ''
        if not web and r.seeds and r.outcome != 'no_website':
            web = r.seeds.split(';')[0]
        cand.append(dict(nominee_id=i, name=r.nominee_name_wiki, seat=f'{r.state}-{r.district}', state=r.state,
                         party=PARTY[r.major_party], status=STATUS.get(r.incumbent_challenge or '', 'Unknown'),
                         website=web, site_status=ss, words=int(words.get(i, 0)), topics_mentioned=len(ment),
                         top_topics='; '.join(top), mentioned='; '.join(ment)))
    # If we got text from a site, it was analyzed, whatever the crawler outcome was (e.g. bot protection
    # blocked the live site but an archived copy or some pages came through).
    for c in cand:
        if c['words'] > 0 and not c['site_status'].startswith('Site analyzed'):
            c['site_status'] = 'Site analyzed'
    return cand


def main():
    s, full = load()
    T = compile_topics()
    # keyword-match counts per site x topic, and each topic's share of a site's matches ("attention")
    cnt = pd.DataFrame({k: s.tc.map(lambda t, rx=rx: len(rx.findall(t))) for k, l, g, rx in T})
    attn = cnt.div(cnt.sum(1).replace(0, np.nan), axis=0).fillna(0)

    topic_rows, name_rows, phrase_rows = party_measures(s, T, cnt, attn)
    outputs = [('topics', topic_rows), ('names', name_rows), ('phrases', phrase_rows),
               ('quotes', quotes(s, T)), ('coverage', coverage(s, full)),
               ('candidates', candidates(s, full, T, cnt, attn))]
    for name, obj in outputs:
        write_json(obj, name, ensure_ascii=False)
        print(f'{name}.json: {len(obj)} rows')


if __name__ == '__main__':
    main()
