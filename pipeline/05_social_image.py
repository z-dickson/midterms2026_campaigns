"""Step 5: draw the 1200x630 social preview image.

Input:  site/data/topics.json  (step 2)
Output: site/og-image.png      used by the page's og:image / twitter:image tags
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

data_dir, out = config.SITE_DATA, config.SITE_DATA.parent / 'og-image.png'
rows = [r for r in json.load(open(data_dir / 'topics.json')) if r['view'] == 'All candidates']
rows.sort(key=lambda r: r['dem_attention'] - r['rep_attention'])
pick = rows[-5:][::-1] + rows[:5]   # 5 most Democratic-leaning topics, then 5 most Republican-leaning
DEM, REP, FG, MUTED, BG, GRID = '#3a6fd8', '#d0453a', '#1b1f2a', '#5b6272', '#f4f5f7', '#dfe2e8'
plt.rcParams['font.family'] = 'DejaVu Sans'
fig = plt.figure(figsize=(12, 6.3), dpi=100, facecolor=BG)
fig.text(0.045, 0.90, 'What House candidates are running on', fontsize=31, color=FG, family='DejaVu Serif')
fig.text(0.045, 0.835, 'Share of issue talk on 866 campaign websites, 2026', fontsize=15, color=MUTED)
ax = fig.add_axes([0.37, 0.09, 0.585, 0.66], facecolor=BG)
ys = list(range(len(pick)))[::-1]
ys = [y - (0.6 if i >= 5 else 0) for i, y in enumerate(ys)]
for y, r in zip(ys, pick):
    d, rp = r['dem_attention'] * 100, r['rep_attention'] * 100
    ax.plot([d, rp], [y, y], color=DEM if d > rp else REP, alpha=.45, lw=4, solid_capstyle='round', zorder=1)
    ax.scatter([d], [y], s=110, color=DEM, zorder=2); ax.scatter([rp], [y], s=110, color=REP, zorder=2)
ax.set_xlim(0, max(max(r['dem_attention'], r['rep_attention']) for r in pick) * 100 * 1.06)
ax.set_ylim(min(ys) - .7, max(ys) + .7)
ax.set_yticks(ys, [r['topic'] for r in pick], fontsize=14.5, color=FG); ax.tick_params(axis='y', length=0, pad=12)
ax.tick_params(axis='x', colors=MUTED, labelsize=12, length=0)
ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f'{v:.0f}%'))
ax.grid(axis='x', color=GRID, lw=1); ax.set_axisbelow(True)
for s in ax.spines.values(): s.set_visible(False)
fig.text(0.955, 0.835, '● Republicans', color=REP, fontsize=15, weight='bold', ha='right')
fig.text(0.79, 0.835, '● Democrats', color=DEM, fontsize=15, weight='bold', ha='right')
fig.savefig(out, dpi=100, facecolor=BG)
print('wrote', out)
