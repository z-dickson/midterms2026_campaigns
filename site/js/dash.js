/*
 * dash.js: a small runtime for the dashboard page.
 *
 * The page's scripts use a tiny API:
 *   dash.data(id)        -> {status, data, message}; loads site/data/<id>.json on first use
 *   dash.calc(id, opts)  -> a derived dataset computed from other datasets
 *   dash.draw(name, fn)  -> register a drawing for every [data-draw="name"] element,
 *                           or dash.draw(name) to re-run it
 *   dash.onData(fn)      -> run fn whenever data or the page width changes
 *   dash.setLink(name)   -> put #name in the address bar
 *
 * Drawings inside a [hidden] ancestor are skipped and run once it is shown, so a
 * tab's data only loads when the tab is opened.
 */
(function () {
  'use strict';

  const SOURCES = {
    topics: 'data/topics.json',
    names: 'data/names.json',
    phrases: 'data/phrases.json',
    candidates: 'data/candidates.json',
    quotes: 'data/quotes.json',
    coverage: 'data/coverage.json',
    districts: 'data/districts.json',
    states: 'data/states.json',
    dc_districts: 'data/dc_districts.json',
    dc_sites: 'data/dc_sites.json',
  };

  const store = {};
  const calcs = {};
  const draws = new Map();
  const listeners = [];

  function load(id) {
    if (store[id]) return;
    store[id] = { status: 'loading', data: [] };
    fetch(SOURCES[id])
      .then((r) => {
        if (!r.ok) throw new Error(`${SOURCES[id]}: HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const rows = Array.isArray(d) ? d : d.rows || d.data || d.results || [];
        store[id] = { status: 'ok', data: rows };
        schedule();
      })
      .catch((e) => {
        console.error(e);
        store[id] = { status: 'error', data: [], message: String(e) };
        schedule();
      });
  }

  function data(id) {
    const c = calcs[id];
    if (c) {
      const ins = c.inputs.map((i) => data(i));
      const notOk = ins.find((x) => x.status !== 'ok');
      if (notOk) return { status: notOk.status, data: [] };
      const stale = !c.result || c.keys.some((k, i) => k !== ins[i].data);
      if (stale) {
        try {
          c.result = { status: 'ok', data: c.fn(...ins.map((x) => x.data)) };
        } catch (e) {
          console.error(`calc ${id}:`, e);
          c.result = { status: 'error', data: [], message: String(e) };
        }
        c.keys = ins.map((x) => x.data);
      }
      return c.result;
    }
    if (!SOURCES[id]) return { status: 'missing', data: [] };
    load(id);
    return store[id];
  }

  function runDraw(name) {
    const fn = draws.get(name);
    if (!fn) return;
    document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
      if (el.closest('[hidden]')) return;
      try { fn(el); } catch (e) { console.error(`draw ${name}:`, e); }
    });
  }

  function runAll() {
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    draws.forEach((_, name) => runDraw(name));
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; runAll(); });
  }

  window.dash = {
    data,
    calc(id, opts) { calcs[id] = { inputs: opts.inputs, fn: opts.fn, result: null, keys: [] }; },
    draw(name, fn) {
      if (fn) { draws.set(name, typeof fn === 'function' ? fn : fn.update); schedule(); }
      else runDraw(name);
    },
    onData(fn) { listeners.push(fn); schedule(); },
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ } },
    params: () => ({}),
    setParams() {},
    resetParams() {},
    refresh() {},
    loader() {},
  };

  // Re-run drawings when a page section is shown or hidden (tabs), or the width changes.
  function watch() {
    const mo = new MutationObserver(schedule);
    document.querySelectorAll('[data-page]').forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }));
    let lastW = document.documentElement.clientWidth;
    new ResizeObserver(() => {
      const w = document.documentElement.clientWidth;
      if (w !== lastW) { lastW = w; schedule(); }
    }).observe(document.documentElement);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
})();
