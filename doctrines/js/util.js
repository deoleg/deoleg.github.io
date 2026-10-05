// Shared state, indexes and DOM helpers. Data text is only ever set via text nodes.
import { makeT } from './i18n.js';

export const S = {
  data: null,
  meta: null,
  items: [],
  lang: 'ru',
  t: makeT('ru'),
  byId: new Map(),
  doctrineById: new Map(),
  eraById: new Map(),
  typeById: new Map(),
  bookById: new Map(),
  glossById: new Map(),
  incoming: new Map(),     // item id -> [{ id: sourceId, rel }]
  byDoctrine: new Map(),   // doctrine id -> primary items (chronological)
  order: new Map(),        // item id -> index in chronological order
  searchText: new Map()    // item id -> { ru, en } normalized haystacks
};

export function setLang(lang) {
  S.lang = lang;
  S.t = makeT(lang);
}

/* ---------- text normalisation ---------- */
export function norm(s) {
  return String(s || '').normalize('NFC').toLowerCase().replace(/ё/g, 'е').replace(/[’ʼ᾽]/g, "'");
}

// Same length as the input, so match offsets map back onto the original text.
function normSameLength(s) {
  let out = '';
  for (const ch of s) {
    let c = ch.toLowerCase();
    if (c.length !== ch.length) c = ch;
    if (c === 'ё') c = 'е';
    else if (c === '’' || c === 'ʼ' || c === '᾽') c = "'";
    out += c;
  }
  return out;
}

export function tokens(q) {
  return norm(q).split(/\s+/).filter(Boolean);
}

/* ---------- indexes ---------- */
export function buildIndexes(data) {
  S.data = data;
  S.meta = data.meta;
  S.items = data.items;
  const m = data.meta;
  m.doctrines.forEach(d => { S.doctrineById.set(d.id, d); S.byDoctrine.set(d.id, []); });
  m.eras.forEach(e => S.eraById.set(e.id, e));
  m.types.forEach(x => S.typeById.set(x.id, x));
  m.books.forEach(b => S.bookById.set(b.id, b));
  m.glossary.forEach(g => S.glossById.set(g.id, g));
  data.items.forEach((it, i) => {
    S.byId.set(it.id, it);
    S.order.set(it.id, i);
    S.byDoctrine.get(it.doctrine)?.push(it);
  });
  for (const it of data.items) {
    for (const r of it.related || []) {
      if (!S.incoming.has(r.id)) S.incoming.set(r.id, []);
      S.incoming.get(r.id).push({ id: it.id, rel: r.rel });
    }
  }
  for (const list of S.incoming.values()) list.sort((a, b) => S.order.get(a.id) - S.order.get(b.id));
  for (const it of data.items) {
    const hay = lang => {
      const parts = [
        it['title_' + lang], it['summary_' + lang], it['outcome_' + lang],
        it['place_' + lang], it['date_note_' + lang], it['date_label_' + lang],
        ...(it['key_points_' + lang] || []), ...(it['people_' + lang] || []), ...(it['texts_' + lang] || [])
      ];
      for (const p of it.positions || []) parts.push(p['who_' + lang], p['view_' + lang]);
      for (const k of it.key_terms || []) parts.push(k['term_' + lang], k.original);
      return norm(parts.filter(Boolean).join('\n'));
    };
    S.searchText.set(it.id, { ru: hay('ru'), en: hay('en') });
  }
}

export function matches(item, toks) {
  if (!toks.length) return true;
  const hay = S.searchText.get(item.id)[S.lang];
  return toks.every(tk => hay.includes(tk));
}

/* ---------- localisation of data ---------- */
export const L = (obj, field) => (obj ? obj[(field ? field + '_' : '') + S.lang] ?? '' : '');
export const name = obj => (obj ? obj[S.lang] ?? obj.ru : '');

export function fmtYear(y) {
  return y < 0 ? `${-y} ${S.t('bc')}` : String(y);
}
export function eraYears(era) {
  return S.t('yearsRange', { from: fmtYear(era.from), to: fmtYear(era.to) });
}
export function fmtPages(p) {
  return S.lang === 'en' ? String(p).replace(/стр\./g, 'p.') : String(p);
}

/* ---------- DOM helpers ---------- */
// el('a', { class: 'x', href: '#…' }, 'text', childNode, …)  – strings become text nodes.
export function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style') n.setAttribute('style', v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    }
  }
  append(n, kids);
  return n;
}
export function append(n, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === '') continue;
    n.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
  return n;
}

// Text with <mark> around query tokens (text nodes only).
export function highlighted(text, toks) {
  const frag = document.createDocumentFragment();
  if (!toks || !toks.length || !text) { frag.append(document.createTextNode(text || '')); return frag; }
  const low = normSameLength(text);
  const ranges = [];
  for (const tk of toks) {
    let i = 0;
    while ((i = low.indexOf(tk, i)) !== -1) { ranges.push([i, i + tk.length]); i += tk.length; }
  }
  if (!ranges.length) { frag.append(document.createTextNode(text)); return frag; }
  ranges.sort((a, b) => a[0] - b[0]);
  let pos = 0;
  for (const [a, b] of ranges) {
    if (b <= pos) continue;
    const s = Math.max(a, pos);
    if (s > pos) frag.append(document.createTextNode(text.slice(pos, s)));
    frag.append(el('mark', null, text.slice(s, b)));
    pos = b;
  }
  if (pos < text.length) frag.append(document.createTextNode(text.slice(pos)));
  return frag;
}

export const docStyle = id => `--dc: var(--doc-${id})`;

export function docDot(id, extra = '') {
  return el('span', { class: 'doc-dot ' + extra, style: docStyle(id), 'aria-hidden': 'true' });
}

export function doctrineTag(id, { link = true, cls = '' } = {}) {
  const d = S.doctrineById.get(id);
  const kids = [docDot(id), name(d)];
  return link
    ? el('a', { class: 'doc-tag ' + cls, href: '#doctrine/' + id, style: docStyle(id) }, kids)
    : el('span', { class: 'doc-tag ' + cls, style: docStyle(id) }, kids);
}

export function impLabel(n) {
  return S.t('imp' + n);
}
export function impBadge(n) {
  return el('span', { class: 'imp imp-' + n },
    el('span', { class: 'imp-pips', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
    impLabel(n));
}
export function typeChip(typeId) {
  return el('span', { class: 'type-chip' }, name(S.typeById.get(typeId)));
}

export function itemHref(id) { return '#item/' + encodeURIComponent(id); }

// Outgoing + incoming relations of an item, as [{ item, label, dir }].
export function relationsOf(item) {
  const out = [];
  for (const r of item.related || []) {
    const target = S.byId.get(r.id);
    if (target) out.push({ item: target, rel: r.rel, label: S.t('rel_fwd_' + r.rel.replace(/-/g, '_')), dir: 'out' });
  }
  for (const r of S.incoming.get(item.id) || []) {
    const src = S.byId.get(r.id);
    if (src) out.push({ item: src, rel: r.rel, label: S.t('rel_rev_' + r.rel.replace(/-/g, '_')), dir: 'in' });
  }
  return out;
}

// Compact relation list used in doctrine line, timeline and the card.
export function relationList(item, { full = false, ownDoctrine = null } = {}) {
  const rels = relationsOf(item);
  if (!rels.length) return null;
  const ul = el('ul', { class: 'rel-list' + (full ? ' rel-list-full' : '') });
  for (const r of rels) {
    const other = r.item.doctrine !== (ownDoctrine ?? item.doctrine);
    ul.append(el('li', { class: 'rel rel-' + r.dir, style: docStyle(r.item.doctrine) },
      el('span', { class: 'rel-label' }, r.label + ':'), ' ',
      el('a', { class: 'rel-link', href: itemHref(r.item.id) },
        docDot(r.item.doctrine),
        el('span', { class: 'rel-date' }, L(r.item, 'date_label')), ' ',
        el('span', { class: 'rel-title' }, L(r.item, 'title'))),
      (full || other) ? el('span', { class: 'rel-doc' }, ' · ' + name(S.doctrineById.get(r.item.doctrine))) : null));
  }
  return ul;
}

export function truncate(s, n) {
  s = String(s || '');
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, '') + '…';
}

export const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
};
