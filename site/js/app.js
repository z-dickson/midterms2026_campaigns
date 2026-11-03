/* Dashboard page logic. Each block is scoped; shared helpers live on window.cw. */
{ // block 0

  window.cw = window.cw || {};
  const cw = window.cw;
  cw.state = { view: 'All candidates', measure: 'attention', tab: 'issues', qTopic: 'Cost of living & affordability', qParty: 'all', qStatus: 'all', qText: '', qLimit: 40, cText: '', cParty: 'all', cSort: 'seat', cDir: 1 };
  cw.pct = (v) => (v >= 0.095 || v === 0 ? d3.format('.0%')(v) : d3.format('.1%')(v));
  cw.colors = (el) => {
    const cs = getComputedStyle(el.closest('.cw') || el);
    return { dem: cs.getPropertyValue('--cw-dem').trim() || '#3a6fd8', rep: cs.getPropertyValue('--cw-rep').trim() || '#d0453a' };
  };
  // Returns true when the source isn't ready, after drawing the right empty state.
  cw.notReady = (el, g, dashText) => {
    if (g.status === 'ok') { el.classList.remove('dash-skeleton'); return false; }
    el.replaceChildren();
    if (g.status === 'error' || g.status === 'connect' || g.status === 'declined') {
      el.classList.remove('dash-skeleton');
      const f = document.createElement('div'); f.className = 'cw-fail'; f.textContent = 'Failed to load'; el.append(f);
    } else if (dashText) { el.textContent = '—'; }
    else { el.classList.add('dash-skeleton'); }
    return true;
  };
  cw.hideTip = (el) => { el.querySelectorAll('.cw-tip').forEach((t) => t.remove()); };
  cw.showTip = (el, ev, r, o, c) => {
    let tip = el.querySelector('.cw-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'cw-tip'; el.append(tip); }
    tip.replaceChildren();
    const h = document.createElement('div'); h.className = 'cw-tip-h'; h.textContent = r.label; tip.append(h);
    for (const [name, v, col] of [['Democrats', r.d, c.dem], ['Republicans', r.r, c.rep]]) {
      const row = document.createElement('div'); row.className = 'cw-tip-r';
      const dot = document.createElement('i'); dot.className = 'cw-dot'; dot.style.background = col;
      const n = document.createElement('span'); n.textContent = name;
      const val = document.createElement('span'); val.className = 'v'; val.textContent = cw.pct(v);
      row.append(dot, n, val); tip.append(row);
    }
    const gap = document.createElement('div'); gap.className = 'cw-tip-r';
    const gn = document.createElement('span'); gn.textContent = 'Difference';
    const gv = document.createElement('span'); gv.className = 'v';
    const diff = (r.d - r.r) * 100;
    gv.textContent = Math.abs(diff).toFixed(1) + ' pts ' + (diff > 0 ? 'more Dem.' : diff < 0 ? 'more Rep.' : '');
    gap.append(gn, gv); tip.append(gap);
    const box = el.getBoundingClientRect();
    const px = ev.clientX - box.left, py = ev.clientY - box.top;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(0, Math.min(px + 14, box.width - tw - 2)) + 'px';
    tip.style.top = (py + 14 + th > box.height ? Math.max(0, py - th - 10) : py + 14) + 'px';
  };
  // Dumbbell chart: one row per item, a Democratic and a Republican dot on one shared scale.
  cw.dumbbell = (el, rows, o) => {
    const c = cw.colors(el);
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth || 600);
    const narrow = W < 560;
    const svg = d3.select(el).append('svg').attr('width', '100%');
    const meas = svg.append('text').attr('class', 'cw-lbl');
    let lw = 0;
    for (const r of rows) { meas.text(r.label); lw = Math.max(lw, meas.node().getComputedTextLength()); }
    meas.remove();
    const left = narrow ? 8 : Math.ceil(lw) + 20, right = 24, top = 30;
    const rowH = narrow ? 42 : 27, headH = 30;
    const items = [];
    if (o.split) {
      const dl = rows.filter((r) => r.d > r.r), rl = rows.filter((r) => r.d <= r.r);
      if (dl.length) items.push({ head: o.split[0] });
      dl.forEach((r) => items.push({ r }));
      if (rl.length) items.push({ head: o.split[1] });
      rl.forEach((r) => items.push({ r }));
    } else rows.forEach((r) => items.push({ r }));
    let y = top;
    for (const it of items) { it.y = y; y += it.head ? headH : rowH; }
    const H = y + 6;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const max = d3.max(rows, (r) => Math.max(r.d, r.r)) || 0.01;
    const x = d3.scaleLinear([0, Math.min(1, max * 1.06)], [left, W - right]).nice();
    const ticks = x.ticks(narrow ? 4 : 6);
    const fmt = d3.format(x.domain()[1] < 0.06 ? '.1%' : '.0%');
    svg.append('g').selectAll('line').data(ticks).join('line').attr('class', 'cw-grid-l')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', top - 6).attr('y2', H - 4);
    svg.append('g').selectAll('text').data(ticks).join('text').attr('class', 'cw-tick')
      .attr('x', (d) => x(d)).attr('y', top - 12).attr('text-anchor', 'middle').text((d) => fmt(d));
    for (const it of items) {
      if (it.head) {
        svg.append('text').attr('class', 'cw-head').attr('x', 8).attr('y', it.y + headH - 9).text(it.head);
        continue;
      }
      const r = it.r;
      const cy = narrow ? it.y + 29 : it.y + rowH / 2;
      const g = svg.append('g').attr('class', 'cw-row');
      g.append('rect').attr('class', 'cw-hit').attr('x', 0).attr('y', it.y).attr('width', W).attr('height', rowH).attr('rx', 3);
      g.append('text').attr('class', 'cw-lbl')
        .attr('x', narrow ? 8 : left - 12).attr('y', narrow ? it.y + 14 : cy).attr('dy', narrow ? 0 : '0.35em')
        .attr('text-anchor', narrow ? 'start' : 'end').text(r.label);
      g.append('line').attr('class', 'cw-link').attr('stroke', r.d > r.r ? c.dem : c.rep)
        .attr('x1', x(Math.min(r.d, r.r))).attr('x2', x(Math.max(r.d, r.r))).attr('y1', cy).attr('y2', cy);
      g.append('circle').attr('cx', x(r.d)).attr('cy', cy).attr('r', 5.5).attr('fill', c.dem);
      g.append('circle').attr('cx', x(r.r)).attr('cy', cy).attr('r', 5.5).attr('fill', c.rep);
      g.on('pointerenter pointermove', (ev) => cw.showTip(el, ev, r, o, c)).on('pointerleave', () => cw.hideTip(el));
    }
  };

}

{ // block 1

  dash.calc('leaders', {
    inputs: ['topics'],
    title: 'Biggest party tilts',
    description: 'The topic with the largest Democratic lead and the one with the largest Republican lead in share of issue talk, all candidates.',
    fn: (topics) => {
      const all = topics.filter((t) => t.view === 'All candidates')
        .map((t) => ({ topic: t.topic, dem: t.dem_attention, rep: t.rep_attention, gap: t.dem_attention - t.rep_attention }))
        .sort((a, b) => b.gap - a.gap);
      const d = all[0], r = all[all.length - 1];
      return [
        { side: 'Democratic', topic: d.topic, dem: d.dem, rep: d.rep },
        { side: 'Republican', topic: r.topic, dem: r.dem, rep: r.rep },
      ];
    },
  });

  const cw = window.cw;
  const leaderDraw = (field, fmt) => (el) => {
    const g = dash.data('leaders');
    if (g.status !== 'ok' || !g.data.length) { el.textContent = '—'; return; }
    const side = el.dataset.where.split('=')[1];
    const row = g.data.find((r) => r.side === side);
    el.textContent = row ? fmt(row[field]) : '—';
  };
  dash.draw('lead-topic', leaderDraw('topic', (v) => v));
  dash.draw('lead-dem', leaderDraw('dem', cw.pct));
  dash.draw('lead-rep', leaderDraw('rep', cw.pct));
  dash.draw('cov', (el) => {
    const g = dash.data('coverage');
    if (g.status !== 'ok') { el.textContent = '—'; return; }
    const party = el.dataset.where.split('=')[1];
    const row = g.data.find((r) => r.party === party);
    el.textContent = row ? d3.format(',')(row[el.dataset.field]) : '—';
  });

  // Tabs
  const showTab = (name, scroll) => {
    if (!document.querySelector(`[data-page="${name}"]`)) return;
    cw.state.tab = name;
    document.querySelectorAll('[data-page]').forEach((s) => { s.hidden = s.dataset.page !== name; });
    document.querySelectorAll('.cw-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    dash.setLink(name);
    if (scroll) document.getElementById(name)?.scrollIntoView({ block: 'nearest' });
  };
  cw.showTab = showTab;
  document.querySelectorAll('.cw-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  const named = location.hash.slice(1);
  if (named && document.querySelector(`[data-page="${named}"]`)) showTab(named, true);

  // Shared view filter (all / incumbent / challenger / open seat)
  const redrawViews = () => ['topic-chart', 'figures-chart', 'endorsers-chart', 'phrases-d', 'phrases-r'].forEach((n) => dash.draw(n));
  document.querySelectorAll('.cw-view').forEach((sel) => sel.addEventListener('change', () => {
    cw.state.view = sel.value;
    document.querySelectorAll('.cw-view').forEach((s) => { s.value = cw.state.view; });
    redrawViews();
  }));
  document.querySelectorAll('[data-measure]').forEach((b) => b.addEventListener('click', () => {
    cw.state.measure = b.dataset.measure;
    document.querySelectorAll('[data-measure]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.measure === cw.state.measure)));
    document.querySelectorAll('[data-measure-note]').forEach((n) => { n.hidden = n.dataset.measureNote !== cw.state.measure; });
    dash.draw('topic-chart');
  }));

  dash.draw('topic-chart', (el) => {
    const g = dash.data('topics');
    if (cw.notReady(el, g)) return;
    const m = cw.state.measure;
    const rows = g.data.filter((t) => t.view === cw.state.view)
      .map((t) => ({ label: t.topic, d: t['dem_' + m], r: t['rep_' + m] }))
      .sort((a, b) => (b.d - b.r) - (a.d - a.r));
    cw.dumbbell(el, rows, { split: ['Democrats talk about these more', 'Republicans talk about these more'] });
  });
  const namesDraw = (group) => (el) => {
    const g = dash.data('names');
    if (cw.notReady(el, g)) return;
    const rows = g.data.filter((t) => t.view === cw.state.view && t.group === group)
      .map((t) => ({ label: t.item, d: t.dem_share, r: t.rep_share }))
      .sort((a, b) => (b.d - b.r) - (a.d - a.r));
    cw.dumbbell(el, rows, { split: ['More Democrats', 'More Republicans'] });
  };
  dash.draw('figures-chart', namesDraw('Political figures & labels'));
  dash.draw('endorsers-chart', namesDraw('Endorsers & allies'));

  const phrasesDraw = (lean) => (el) => {
    const g = dash.data('phrases');
    if (cw.notReady(el, g)) return;
    const c = cw.colors(el);
    const own = lean === 'Democratic' ? 'dem_share' : 'rep_share', other = lean === 'Democratic' ? 'rep_share' : 'dem_share';
    const ownCol = lean === 'Democratic' ? c.dem : c.rep, otherCol = lean === 'Democratic' ? c.rep : c.dem;
    const rows = g.data.filter((p) => p.view === cw.state.view && p.leans === lean).sort((a, b) => b[own] - a[own]);
    const max = d3.max(g.data.filter((p) => p.view === cw.state.view), (p) => Math.max(p.dem_share, p.rep_share)) || 1;
    el.replaceChildren(...rows.map((p) => {
      const item = document.createElement('div'); item.className = 'cw-ph-i';
      const top = document.createElement('div'); top.className = 'cw-ph-top';
      const l = document.createElement('span'); l.textContent = '“' + p.phrase + '”';
      const v = document.createElement('span'); v.className = 'v'; v.textContent = cw.pct(p[own]) + ' vs ' + cw.pct(p[other]);
      top.append(l, v);
      const b1 = document.createElement('div'); b1.className = 'cw-bar'; b1.style.width = (p[own] / max * 100) + '%'; b1.style.background = ownCol;
      const b2 = document.createElement('div'); b2.className = 'cw-bar thin'; b2.style.width = (p[other] / max * 100) + '%'; b2.style.background = otherCol;
      item.append(top, b1, b2);
      return item;
    }));
  };
  dash.draw('phrases-d', phrasesDraw('Democratic'));
  dash.draw('phrases-r', phrasesDraw('Republican'));

}

{ // block 2

  const cw = window.cw;
  // Quote finder
  dash.draw('q-topic', (sel) => {
    const g = dash.data('topics');
    const names = g.status === 'ok' ? [...new Set(g.data.map((t) => t.topic))].sort() : [];
    sel.replaceChildren(new Option('All topics', ''), ...names.map((n) => new Option(n, n)));
    sel.value = cw.state.qTopic === '' || names.includes(cw.state.qTopic) ? cw.state.qTopic : '';
  });
  const qRedraw = () => { cw.state.qLimit = 40; dash.draw('quotes'); };
  document.querySelectorAll('#cw-q-topic').forEach((s) => s.addEventListener('change', () => { cw.state.qTopic = s.value; qRedraw(); }));
  document.querySelectorAll('#cw-q-party').forEach((s) => s.addEventListener('change', () => { cw.state.qParty = s.value; qRedraw(); }));
  document.querySelectorAll('#cw-q-status').forEach((s) => s.addEventListener('change', () => { cw.state.qStatus = s.value; qRedraw(); }));
  let qTimer;
  document.querySelectorAll('#cw-q-text').forEach((s) => s.addEventListener('input', () => {
    clearTimeout(qTimer); qTimer = setTimeout(() => { cw.state.qText = s.value.trim().toLowerCase(); qRedraw(); }, 200);
  }));
  document.querySelectorAll('#cw-q-more').forEach((b) => b.addEventListener('click', () => { cw.state.qLimit += 40; dash.draw('quotes'); }));

  const copyText = async (btn, text) => {
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; }
    catch (e) {
      const q = btn.closest('.cw-q')?.querySelector('.cw-q-t');
      if (q) { const r = document.createRange(); r.selectNodeContents(q); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      btn.textContent = 'Selected, press Ctrl+C';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
  };

  dash.draw('quotes', (el) => {
    const more = document.querySelectorAll('#cw-q-more');
    const g = dash.data('quotes');
    if (cw.notReady(el, g)) { more.forEach((b) => { b.hidden = true; }); return; }
    const st = cw.state;
    let rows = g.data.filter((q) => (!st.qTopic || q.topic === st.qTopic)
      && (st.qParty === 'all' || q.party === st.qParty)
      && (st.qStatus === 'all' || q.status === st.qStatus)
      && (!st.qText || (q.quote + ' ' + q.name + ' ' + q.seat).toLowerCase().includes(st.qText)));
    // Alternate parties so both sides show up near the top.
    if (st.qParty === 'all') {
      const d = rows.filter((q) => q.party === 'Democrat').sort((a, b) => a.seat.localeCompare(b.seat));
      const r = rows.filter((q) => q.party === 'Republican').sort((a, b) => a.seat.localeCompare(b.seat));
      rows = []; for (let i = 0; i < Math.max(d.length, r.length); i++) { if (d[i]) rows.push(d[i]); if (r[i]) rows.push(r[i]); }
    } else rows.sort((a, b) => a.seat.localeCompare(b.seat));
    const shown = rows.slice(0, st.qLimit);
    const cg = dash.data('candidates');
    const sites = new Map(cg.status === 'ok' ? cg.data.map((c) => [c.name + '|' + c.seat, c.website]) : []);
    const count = document.createElement('p'); count.className = 'cw-count';
    count.textContent = rows.length ? `Showing ${d3.format(',')(shown.length)} of ${d3.format(',')(rows.length)} ${st.qTopic ? 'candidates with a quote on ' + st.qTopic.toLowerCase() : 'quotes across all topics'}` : 'No quotes match these filters.';
    el.replaceChildren(count, ...shown.map((q) => {
      const box = document.createElement('div'); box.className = 'cw-q ' + (q.party === 'Democrat' ? 'd' : 'r');
      const t = document.createElement('p'); t.className = 'cw-q-t'; t.textContent = '“' + q.quote + '”';
      const meta = document.createElement('div'); meta.className = 'cw-q-m';
      const url = sites.get(q.name + '|' + q.seat) || '';
      let nm;
      if (/^https?:\/\//i.test(url)) {
        nm = document.createElement('a'); nm.href = url; nm.target = '_blank'; nm.rel = 'noopener noreferrer';
        nm.title = 'Open campaign website'; nm.textContent = q.name + ' ↗';
      } else { nm = document.createElement('b'); nm.textContent = q.name; }
      const info = document.createElement('span'); info.textContent = `${q.party === 'Democrat' ? 'D' : 'R'}, ${q.seat} · ${q.status}${st.qTopic ? '' : ' · ' + q.topic}`;
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cw-copy'; btn.textContent = 'Copy';
      btn.addEventListener('click', () => copyText(btn, `“${q.quote}” (${q.name}, ${q.party === 'Democrat' ? 'D' : 'R'}-${q.seat})`));
      meta.append(nm, info, btn);
      box.append(t, meta);
      return box;
    }));
    more.forEach((b) => { b.hidden = rows.length <= shown.length; });
  });

}

{ // block 3

  const cw = window.cw;
  // Candidate table
  const candRows = () => {
    const g = dash.data('candidates');
    if (g.status !== 'ok') return null;
    const st = cw.state;
    const q = st.cText;
    const rows = g.data.filter((c) => (st.cParty === 'all' || c.party === st.cParty)
      && (!q || (c.name + ' ' + c.seat + ' ' + c.top_topics + ' ' + c.status).toLowerCase().includes(q)));
    const k = st.cSort;
    rows.sort((a, b) => {
      const x = a[k], y = b[k];
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * st.cDir;
    });
    return { rows, total: g.data.length };
  };
  dash.draw('cand-count', (el) => {
    const r = candRows();
    el.textContent = r ? `${d3.format(',')(r.rows.length)} of ${d3.format(',')(r.total)} candidates` : '—';
  });
  dash.draw('cand-rows', (tb) => {
    const r = candRows();
    if (!r) { tb.replaceChildren(); return; }
    const c = cw.colors(tb);
    tb.replaceChildren(...r.rows.map((x) => {
      const tr = document.createElement('tr'); tr.dataset.key = x.nominee_id;
      const td = (text, cls) => { const d = document.createElement('td'); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; };
      const party = td(null); const sp = document.createElement('span'); sp.className = 'cw-pty';
      const dot = document.createElement('i'); dot.className = 'cw-dot'; dot.style.background = x.party === 'Democrat' ? c.dem : c.rep;
      const pn = document.createElement('span'); pn.textContent = x.party; sp.append(dot, pn); party.append(sp);
      const site = td(null, 'cw-hide-n');
      if (/^https?:\/\//i.test(x.website || '')) {
        const a = document.createElement('a'); a.href = x.website; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = x.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''); site.append(a);
      }
      if (!/^Site analyzed/.test(x.site_status || '')) {
        const n = document.createElement('div'); n.className = 'cw-cand-m'; n.textContent = x.site_status; site.append(n);
      }
      tr.append(td(x.name), td(x.seat), party, td(x.status, 'cw-hide-n'), td(d3.format(',')(x.words), 'num cw-hide-n'), td(x.top_topics), site);
      return tr;
    }));
  });
  const candRedraw = () => { dash.draw('cand-rows'); dash.draw('cand-count'); };
  let cTimer;
  document.querySelectorAll('#cw-c-text').forEach((s) => s.addEventListener('input', () => {
    clearTimeout(cTimer); cTimer = setTimeout(() => { cw.state.cText = s.value.trim().toLowerCase(); candRedraw(); }, 150);
  }));
  document.querySelectorAll('#cw-c-party').forEach((s) => s.addEventListener('change', () => { cw.state.cParty = s.value; candRedraw(); }));
  const syncSort = () => document.querySelectorAll('.cw-th').forEach((b) => {
    b.closest('th')?.setAttribute('aria-sort', b.dataset.sort === cw.state.cSort ? (cw.state.cDir > 0 ? 'ascending' : 'descending') : 'none');
  });
  document.querySelectorAll('.cw-th').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sort;
    if (cw.state.cSort === k) cw.state.cDir *= -1; else { cw.state.cSort = k; cw.state.cDir = k === 'words' ? -1 : 1; }
    syncSort(); candRedraw();
  }));
  syncSort();

}

{ // block 4

  const cw = window.cw;
  // District map
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  cw.state.seat = null;
  cw.state.mapState = '';
  cw.state.color = 'party';
  const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const stateName = (abbr) => {
    const g = dash.data('states');
    const r = g.status === 'ok' ? g.data.find((s) => s.state === abbr) : null;
    return r ? r.name : abbr;
  };
  const seatName = (seat) => {
    const [st, d] = seat.split('-');
    return d === '00' ? `${stateName(st)} at-large district` : `${stateName(st)}'s ${ord(+d)} district`;
  };
  const bySeat = () => {
    const g = dash.data('candidates');
    if (g.status !== 'ok') return null;
    if (cw._bySeatSrc !== g.data) { cw._bySeatSrc = g.data; cw._bySeat = d3.group(g.data, (c) => c.seat); }
    return cw._bySeat;
  };
  const dcBySeat = () => {
    const g = dash.data('dc_districts');
    if (g.status !== 'ok') return null;
    if (cw._dcSrc !== g.data) { cw._dcSrc = g.data; cw._dc = new Map(g.data.map((d) => [d.seat, d])); }
    return cw._dc;
  };
  const dcBin = (n) => (n >= 15 ? 4 : n >= 5 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0);
  const seatClass = (cands, seat) => {
    if (cw.state.color === 'dc') {
      const d = dcBySeat()?.get(seat);
      return 'f-dc' + dcBin(d ? d.active : 0);
    }
    if (!cands || !cands.length) return 'p-none f-none';
    if (cw.state.color === 'party') {
      const inc = cands.find((c) => c.status === 'Incumbent');
      if (inc) return inc.party === 'Democrat' ? 'p-dem f-dem' : 'p-rep f-rep';
      return cands.some((c) => c.status === 'Open seat') ? 'p-open f-open' : 'p-none f-none';
    }
    const t = cw.state.color;
    const an = cands.filter((c) => c.words > 0);
    if (!an.length) return 'p-none f-none';
    const has = (p) => an.some((c) => c.party === p && c.mentioned.split('; ').includes(t));
    const d = has('Democrat'), r = has('Republican');
    return d && r ? 'p-both f-both' : d ? 'p-dem f-dem' : r ? 'p-rep f-rep' : 'p-open f-open';
  };
  const recolor = () => {
    const m = bySeat();
    if (!cw.mapPaths || !m) return;
    cw.mapPaths.attr('class', (d) => 'cw-dist ' + seatClass(m.get(d.seat), d.seat));
  };
  const markSelected = () => {
    if (!cw.mapSel) return;
    const f = cw.mapFeatures?.get(cw.state.seat);
    cw.mapSel.attr('d', f ? f.path : null);
  };
  const boundsOf = (r) => [[r.x0, r.y0], [r.x1, r.y1]];
  const zoomToBounds = (b) => {
    if (!cw.mapSvg || !b) return;
    const [W, H] = cw.mapSize;
    const [[x0, y0], [x1, y1]] = b;
    const k = Math.max(1, Math.min(60, 0.85 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
    const t = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k);
    cw.mapSvg.transition().duration(reduce ? 0 : 650).call(cw.mapZoom.transform, t);
  };
  cw.selectSeat = (seat, zoom) => {
    cw.state.seat = seat;
    if (seat) cw.state.mapState = seat.split('-')[0];
    markSelected();
    if (zoom && seat && cw.mapFeatures?.get(seat)) zoomToBounds(boundsOf(cw.mapFeatures.get(seat)));
    ['panel', 'm-state', 'm-seat'].forEach((n) => dash.draw(n));
  };

  dash.draw('map', (el) => {
    const gd = dash.data('districts'), gs = dash.data('states');
    const g = gd.status !== 'ok' ? gd : gs.status !== 'ok' ? gs : gd;
    if (cw.notReady(el, g)) { cw.mapPaths = null; return; }
    el.replaceChildren();
    // Shapes arrive already projected onto a fixed canvas (vw × vh); the SVG scales it to the card's width.
    const W = gd.data[0].vw, H = gd.data[0].vh;
    const shownW = Math.max(280, el.clientWidth || 700);
    cw.mapSize = [W, H];
    cw.mapFeatures = new Map(gd.data.map((r) => [r.seat, r]));
    cw.mapStates = new Map(gs.data.map((r) => [r.state, r]));
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`)
      .attr('height', Math.round(shownW * H / W)).attr('role', 'img').attr('aria-label', 'Map of U.S. House districts');
    const g0 = svg.append('g');
    cw.mapPaths = g0.append('g').selectAll('path').data(gd.data).join('path').attr('d', (d) => d.path)
      .on('click', (ev, d) => cw.selectSeat(d.seat, false))
      .on('pointerenter pointermove', (ev, d) => {
        let tip = el.querySelector('.cw-tip');
        if (!tip) { tip = document.createElement('div'); tip.className = 'cw-tip'; el.append(tip); }
        tip.replaceChildren();
        const h = document.createElement('div'); h.className = 'cw-tip-h'; h.textContent = d.seat; tip.append(h);
        for (const c of (bySeat()?.get(d.seat) || [])) {
          const row = document.createElement('div'); row.className = 'cw-tip-r';
          const dot = document.createElement('i'); dot.className = 'cw-dot ' + (c.party === 'Democrat' ? 'd' : 'r');
          const n = document.createElement('span'); n.textContent = c.name + (c.status === 'Incumbent' ? ' (inc.)' : '');
          row.append(dot, n); tip.append(row);
        }
        const box = el.getBoundingClientRect();
        const px = ev.clientX - box.left, py = ev.clientY - box.top;
        tip.style.left = Math.max(0, Math.min(px + 14, box.width - tip.offsetWidth - 2)) + 'px';
        tip.style.top = (py + 14 + tip.offsetHeight > box.height ? Math.max(0, py - tip.offsetHeight - 10) : py + 14) + 'px';
      })
      .on('pointerleave', () => cw.hideTip(el));
    g0.append('g').selectAll('path').data(gs.data).join('path').attr('class', 'cw-state').attr('d', (d) => d.path);
    cw.mapSel = g0.append('path').attr('class', 'cw-sel');
    cw.mapZoom = d3.zoom().scaleExtent([1, 60]).translateExtent([[-W * 0.1, -H * 0.1], [W * 1.1, H * 1.1]])
      .filter((ev) => (ev.type === 'wheel' ? ev.ctrlKey || ev.metaKey : !ev.button))
      .on('zoom', (ev) => g0.attr('transform', ev.transform));
    svg.call(cw.mapZoom).on('dblclick.zoom', null);
    cw.mapSvg = svg;
    recolor();
    markSelected();
    if (cw.state.seat && cw.mapFeatures.get(cw.state.seat)) {
      const b = boundsOf(cw.mapFeatures.get(cw.state.seat));
      const [[x0, y0], [x1, y1]] = b;
      const k = Math.max(1, Math.min(60, 0.85 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
      svg.call(cw.mapZoom.transform, d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k));
    }
  });

  document.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    if (!cw.mapSvg) return;
    const z = b.dataset.zoom, svg = cw.mapSvg.transition().duration(reduce ? 0 : 300);
    if (z === 'in') svg.call(cw.mapZoom.scaleBy, 2);
    else if (z === 'out') svg.call(cw.mapZoom.scaleBy, 0.5);
    else svg.call(cw.mapZoom.transform, d3.zoomIdentity);
  }));

  dash.draw('m-state', (sel) => {
    const g = dash.data('states');
    const rows = g.status === 'ok' ? g.data.filter((s) => s.state !== 'DC').slice().sort((a, b) => a.name.localeCompare(b.name)) : [];
    sel.replaceChildren(new Option('All states', ''), ...rows.map((s) => new Option(s.name, s.state)));
    sel.value = cw.state.mapState || '';
  });
  dash.draw('m-seat', (sel) => {
    const g = dash.data('districts');
    const st = cw.state.mapState;
    const seats = g.status === 'ok' ? g.data.map((d) => d.seat).filter((s) => !st || s.startsWith(st + '-')).sort() : [];
    sel.replaceChildren(new Option(st ? 'Pick a district' : 'Pick a state first', ''), ...(st ? seats.map((s) => new Option(s, s)) : []));
    sel.disabled = !st;
    sel.value = cw.state.seat && seats.includes(cw.state.seat) ? cw.state.seat : '';
  });
  dash.draw('m-color', (sel) => {
    const g = dash.data('topics');
    const names = g.status === 'ok' ? [...new Set(g.data.map((t) => t.topic))].sort() : [];
    sel.replaceChildren(new Option("Incumbent's party", 'party'), new Option('Data centers in the district', 'dc'), ...names.map((n) => new Option('Mentions: ' + n, n)));
    sel.value = cw.state.color;
  });
  document.querySelectorAll('#cw-m-state').forEach((s) => s.addEventListener('change', () => {
    cw.state.mapState = s.value;
    if (cw.state.seat && !cw.state.seat.startsWith(s.value + '-')) cw.state.seat = null;
    markSelected();
    if (s.value && cw.mapStates?.get(s.value)) zoomToBounds(boundsOf(cw.mapStates.get(s.value)));
    else if (cw.mapSvg) cw.mapSvg.transition().duration(reduce ? 0 : 650).call(cw.mapZoom.transform, d3.zoomIdentity);
    ['panel', 'm-seat'].forEach((n) => dash.draw(n));
  }));
  document.querySelectorAll('#cw-m-seat').forEach((s) => s.addEventListener('change', () => { if (s.value) cw.selectSeat(s.value, true); }));
  document.querySelectorAll('#cw-m-color').forEach((s) => s.addEventListener('change', () => {
    cw.state.color = s.value;
    const lk = s.value === 'party' || s.value === 'dc' ? s.value : 'topic';
    document.querySelectorAll('[data-legend]').forEach((l) => { l.hidden = l.dataset.legend !== lk; });
    recolor();
    dash.draw('panel');
  }));

  const ORDER = { Incumbent: 0, 'Open seat': 1, Challenger: 2, Unknown: 3 };
  dash.draw('panel', (el) => {
    document.querySelectorAll('.cw-panel-empty').forEach((p) => { p.hidden = !!cw.state.seat; });
    const m = bySeat();
    if (!cw.state.seat || !m) { el.replaceChildren(); return; }
    const seat = cw.state.seat;
    const cands = (m.get(seat) || []).slice().sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || a.party.localeCompare(b.party));
    const head = document.createElement('div'); head.className = 'cw-panel-h';
    const t = document.createElement('h3'); t.className = 't'; t.textContent = seatName(seat);
    const s = document.createElement('span'); s.className = 's';
    s.textContent = `${seat} · ${cands.length ? cands.length + (cands.length === 1 ? ' major-party nominee' : ' major-party nominees') : 'No nominees in our data'}`;
    head.append(t, s);
    const cards = cands.map((c) => {
      const box = document.createElement('div'); box.className = 'cw-cand';
      const n = document.createElement('div'); n.className = 'cw-cand-n';
      const dot = document.createElement('i'); dot.className = 'cw-dot ' + (c.party === 'Democrat' ? 'd' : 'r');
      let nm;
      if (/^https?:\/\//i.test(c.website || '')) {
        nm = document.createElement('a'); nm.href = c.website; nm.target = '_blank'; nm.rel = 'noopener noreferrer';
        nm.title = 'Open campaign website'; nm.textContent = c.name + ' ↗';
      } else { nm = document.createElement('span'); nm.textContent = c.name; }
      n.append(dot, nm);
      const meta = document.createElement('div'); meta.className = 'cw-cand-m';
      meta.textContent = `${c.party} · ${c.status}` + (c.words ? ` · ${d3.format(',')(c.words)} words on site` : '');
      box.append(n, meta);
      if (/^https?:\/\//i.test(c.website || '')) {
        const a = document.createElement('a'); a.href = c.website; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = c.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
        box.append(a);
      }
      if (!c.words) {
        const ns = document.createElement('div'); ns.className = 'cw-cand-m'; ns.textContent = c.site_status; box.append(ns);
      } else {
        const lab = document.createElement('div'); lab.className = 'cw-cand-m'; lab.textContent = 'Talks most about';
        const chips = document.createElement('div'); chips.className = 'cw-chips';
        c.top_topics.split('; ').filter(Boolean).forEach((tp) => { const ch = document.createElement('span'); ch.className = 'cw-chip'; ch.textContent = tp; chips.append(ch); });
        const cnt = document.createElement('div'); cnt.className = 'cw-cand-m';
        cnt.textContent = `Mentions ${c.topics_mentioned} of the tracked topics`;
        if (cw.state.color !== 'party' && cw.state.color !== 'dc') cnt.textContent += c.mentioned.split('; ').includes(cw.state.color) ? `, including ${cw.state.color.toLowerCase()}` : `, not ${cw.state.color.toLowerCase()}`;
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cw-copy'; btn.textContent = 'See their quotes';
        btn.addEventListener('click', () => {
          Object.assign(cw.state, { qTopic: '', qParty: 'all', qStatus: 'all', qText: c.name.toLowerCase(), qLimit: 40 });
          document.querySelectorAll('#cw-q-text').forEach((i) => { i.value = c.name; });
          document.querySelectorAll('#cw-q-party, #cw-q-status').forEach((i) => { i.value = 'all'; });
          document.querySelectorAll('#cw-q-topic').forEach((i) => { i.value = ''; });
          cw.showTab('quotes', true);
          dash.draw('q-topic'); dash.draw('quotes');
        });
        box.append(lab, chips, cnt, btn);
      }
      return box;
    });
    // Data centers in this district (FracTracker)
    const dcBox = document.createElement('div'); dcBox.className = 'cw-dc';
    const d = dcBySeat()?.get(seat);
    const sg = dash.data('dc_sites');
    const dh = document.createElement('div'); dh.className = 'cw-dc-h';
    const sw = document.createElement('i'); sw.className = 'cw-sw f-dc' + dcBin(d ? d.active : 0);
    const dt = document.createElement('span');
    dh.append(sw, dt); dcBox.append(dh);
    if (!d) { dt.textContent = 'Data centers: loading'; }
    else {
      dt.textContent = d.active ? `${d.active} data center${d.active === 1 ? '' : 's'} operating, approved or proposed` : 'No known data centers operating, approved or proposed';
      const parts = [['operating', d.operating], ['approved or under construction', d.construction], ['proposed', d.proposed], ['cancelled or suspended', d.stalled]].filter((p) => p[1] > 0);
      if (parts.length) {
        const sub = document.createElement('div'); sub.className = 'cw-cand-m';
        sub.textContent = parts.map((p) => `${p[1]} ${p[0]}`).join(' · ') + (d.pushback ? ` · community pushback reported at ${d.pushback}` : '');
        dcBox.append(sub);
      }
      if (sg.status === 'ok') {
        const ORD = { Proposed: 0, 'Approved or under construction': 1, Operating: 2, 'Cancelled or suspended': 3 };
        const list = sg.data.filter((x) => x.seat === seat).sort((a, b) => (ORD[a.stage] - ORD[b.stage]) || a.name.localeCompare(b.name));
        if (list.length) {
          const ul = document.createElement('ul'); ul.className = 'cw-dc-list';
          list.slice(0, 6).forEach((x) => {
            const li = document.createElement('li');
            const b = document.createElement('b'); b.textContent = x.name;
            li.append(b, document.createTextNode(` · ${x.stage.toLowerCase()}` + (x.operator ? ` · ${x.operator}` : '') + (x.city ? ` · ${x.city}` : '') + (x.pushback ? ' · pushback' : '')));
            ul.append(li);
          });
          if (list.length > 6) { const li = document.createElement('li'); li.textContent = `and ${list.length - 6} more`; ul.append(li); }
          dcBox.append(ul);
        }
      }
    }
    el.replaceChildren(head, ...cards, dcBox);
  });


}

{ // Share button: the phone's share sheet where available, otherwise copy the link.
  const btn = document.getElementById('cw-share');
  if (btn) btn.addEventListener('click', async () => {
    const url = location.href.split('#')[0];
    const label = btn.textContent;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      btn.textContent = 'Link copied';
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      btn.textContent = url;
    }
    setTimeout(() => { btn.textContent = label; }, 2000);
  });
}
