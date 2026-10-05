import { S, el, name, docDot, tokens, matches, eraYears } from '../util.js';
import { viewHeading, timelineList } from './common.js';

const list = s => (s ? s.split(',').filter(Boolean) : []);

export function parseFilters(params) {
  const i = parseInt(params.get('i'), 10);
  return {
    d: list(params.get('d')).filter(x => S.doctrineById.has(x)),
    t: list(params.get('t')).filter(x => S.typeById.has(x)),
    e: list(params.get('e')).filter(x => S.eraById.has(x)),
    i: i >= 1 && i <= 3 ? i : 1,
    s: params.get('s') === '1',
    q: params.get('q') || ''
  };
}

export function filterItems(f) {
  const toks = tokens(f.q);
  return S.items.filter(it =>
    (!f.d.length || f.d.includes(it.doctrine) || (f.s && it.doctrines_secondary.some(x => f.d.includes(x)))) &&
    (!f.t.length || f.t.includes(it.type)) &&
    (!f.e.length || f.e.includes(it.era)) &&
    it.importance >= f.i &&
    matches(it, toks));
}

function toQuery(f) {
  const p = new URLSearchParams();
  if (f.d.length) p.set('d', f.d.join(','));
  if (f.t.length) p.set('t', f.t.join(','));
  if (f.e.length) p.set('e', f.e.join(','));
  if (f.i > 1) p.set('i', String(f.i));
  if (f.s) p.set('s', '1');
  if (f.q.trim()) p.set('q', f.q.trim());
  return p.toString().replace(/%2C/g, ',');
}

export function render(root, { params }, ctx) {
  const t = S.t;
  const f = parseFilters(params);
  const view = el('section', { class: 'view view-timeline', 'aria-labelledby': 'viewTitle' });
  view.append(viewHeading(t('timelineTitle'), { id: 'viewTitle' }));

  // search
  const q = el('input', { type: 'search', id: 'tlSearch', autocomplete: 'off', spellcheck: 'false', placeholder: t('searchPlaceholder') });
  q.value = f.q;
  const searchBox = el('div', { class: 'search' },
    el('label', { for: 'tlSearch', class: 'search-label' }, t('search')), q);

  // filter groups
  const chipGroup = (legendKey, key, entries, decorate) => el('fieldset', { class: 'f-group' },
    el('legend', null, t(legendKey)),
    el('div', { class: 'chips' }, entries.map(x => {
      const box = el('input', { type: 'checkbox', value: x.id, dataset: { f: key } });
      box.checked = f[key].includes(x.id);
      return el('label', { class: 'chip-check', style: decorate ? `--dc: var(--doc-${x.id})` : null },
        box, decorate ? docDot(x.id) : null, el('span', null, x.label));
    })));

  const secBox = el('input', { type: 'checkbox', id: 'tlSecondary' });
  secBox.checked = f.s;
  const docGroup = chipGroup('fDoctrines', 'd', S.meta.doctrines.map(d => ({ id: d.id, label: name(d) })), true);
  docGroup.append(el('label', { class: 'check f-sec' }, secBox, el('span', null, t('fSecondary'))));

  const impGroup = el('fieldset', { class: 'f-group' }, el('legend', null, t('fImportance')),
    el('div', { class: 'chips' }, [[1, 'fImpAll'], [2, 'fImp2'], [3, 'fImp3']].map(([n, k]) => {
      const r = el('input', { type: 'radio', name: 'tlImp', value: String(n) });
      r.checked = f.i === n;
      return el('label', { class: 'chip-check' }, r, el('span', null, t(k)));
    })));

  const badge = el('span', { class: 'f-badge' });
  const details = el('details', { class: 'filters', id: 'tlFilters' },
    el('summary', null, el('span', null, t('filters')), ' ', badge),
    el('div', { class: 'f-body' },
      docGroup,
      chipGroup('fTypes', 't', S.meta.types.map(x => ({ id: x.id, label: name(x) }))),
      chipGroup('fEras', 'e', S.meta.eras.map(x => ({ id: x.id, label: `${name(x)} (${eraYears(x)})` }))),
      impGroup));
  if (f.d.length || f.t.length || f.e.length || f.i > 1 || f.s) details.open = true;

  const counter = el('p', { class: 'tl-count', id: 'tlCount', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const reset = el('button', { type: 'button', class: 'btn-ghost', id: 'tlReset' }, t('reset'));
  const results = el('div', { class: 'tl-results', id: 'tlResults' });
  const empty = el('p', { class: 'empty', id: 'tlEmpty', hidden: true }, t('nothing'));

  view.append(el('div', { class: 'tl-controls' }, searchBox, details,
    el('div', { class: 'tl-status' }, counter, reset)), empty, results);

  function update(pushUrl) {
    const found = filterItems(f);
    counter.textContent = t('found', { n: found.length, total: S.items.length });
    empty.hidden = found.length > 0;
    results.replaceChildren(found.length ? timelineList(found, { toks: tokens(f.q), showDoctrine: true }) : '');
    const n = f.d.length + f.t.length + f.e.length + (f.i > 1 ? 1 : 0);
    badge.textContent = n ? t('activeFilters', { n }) : '';
    reset.disabled = !n && !f.q.trim() && !f.s;
    if (pushUrl) {
      const qs = toQuery(f);
      ctx.replaceBase('timeline' + (qs ? '?' + qs : ''));
    }
  }

  details.addEventListener('change', e => {
    const x = e.target;
    if (x.dataset.f) {
      const arr = f[x.dataset.f];
      const at = arr.indexOf(x.value);
      if (x.checked && at < 0) arr.push(x.value);
      if (!x.checked && at >= 0) arr.splice(at, 1);
      // keep the order of meta lists so URLs stay stable
      const order = { d: S.meta.doctrines, t: S.meta.types, e: S.meta.eras }[x.dataset.f].map(o => o.id);
      arr.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    } else if (x.name === 'tlImp') f.i = +x.value;
    else if (x === secBox) f.s = secBox.checked;
    update(true);
  });

  let timer = 0;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { f.q = q.value; update(true); }, 200);
  });

  reset.addEventListener('click', () => {
    Object.assign(f, { d: [], t: [], e: [], i: 1, s: false, q: '' });
    q.value = '';
    details.querySelectorAll('input[type=checkbox]').forEach(b => { b.checked = false; });
    details.querySelectorAll('input[name=tlImp]').forEach(r => { r.checked = r.value === '1'; });
    update(true);
    q.focus();
  });

  root.replaceChildren(view);
  update(false);
  return { title: t('navTimeline') };
}
