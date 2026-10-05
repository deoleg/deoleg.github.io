import { S, el, L, name, docStyle, doctrineTag, impBadge, typeChip, itemHref, relationList, fmtPages, eraYears } from '../util.js';
import { originalNode } from './glossary.js';

const section = (titleKey, ...body) => el('section', { class: 'card-sec' },
  el('h3', { class: 'card-h' }, S.t(titleKey)), ...body);

// Fills the panel for one entry. Returns { title, prev, next } (prev/next are items or null).
export function renderItem(body, kicker, id) {
  const t = S.t;
  body.replaceChildren();
  kicker.replaceChildren();
  const it = S.byId.get(id);
  kicker.closest('.panel')?.removeAttribute('style');
  if (!it) {
    body.append(
      el('h2', { id: 'panelTitle', class: 'card-title', tabindex: '-1' }, t('itemNotFound')),
      el('p', null, t('itemNotFoundHint')),
      el('p', null, el('a', { href: '#/' }, t('toMatrix'))));
    return { title: t('itemNotFound'), prev: null, next: null };
  }
  body.setAttribute('style', docStyle(it.doctrine));
  kicker.closest('.panel')?.setAttribute('style', docStyle(it.doctrine));

  // 1. doctrine, related doctrines, type, importance, era
  const era = S.eraById.get(it.era);
  kicker.append(doctrineTag(it.doctrine, { cls: 'doc-tag-main' }));
  const meta = el('div', { class: 'card-meta' },
    typeChip(it.type), impBadge(it.importance),
    el('span', { class: 'card-era' }, name(era), ' (' + eraYears(era) + ')'));
  if (it.doctrines_secondary?.length) {
    meta.append(el('span', { class: 'card-sec-docs' },
      el('span', { class: 'visually-hidden' }, t('secondaryDoctrines') + ': '),
      it.doctrines_secondary.filter(x => S.doctrineById.has(x)).map(x => doctrineTag(x, { cls: 'doc-tag-sec' }))));
  }
  body.append(meta);

  // 2–3. title, date, date note
  body.append(el('h2', { id: 'panelTitle', class: 'card-title', tabindex: '-1' }, L(it, 'title')));
  body.append(el('p', { class: 'card-date' }, L(it, 'date_label')));
  if (L(it, 'date_note')) {
    body.append(el('aside', { class: 'date-note', 'aria-label': t('dateNote') },
      el('h3', { class: 'card-h' }, t('dateNote')), el('p', null, L(it, 'date_note'))));
  }

  // 4. summary
  if (L(it, 'summary')) body.append(el('p', { class: 'card-summary' }, L(it, 'summary')));

  // 5. positions
  const pos = (it.positions || []).filter(p => L(p, 'who') || L(p, 'view'));
  if (pos.length) {
    body.append(section('positions', el('div', { class: 'positions' }, pos.map(p =>
      el('div', { class: 'pos' }, el('h4', { class: 'pos-who' }, L(p, 'who')), el('p', null, L(p, 'view')))))));
  }

  // 6. key terms
  const terms = (it.key_terms || []).filter(k => L(k, 'term') || k.original);
  if (terms.length) {
    body.append(section('keyTerms', el('ul', { class: 'terms' }, terms.map(k => {
      const g = S.glossById.get(k.glossary_id);
      const head = [el('span', { class: 'term-label' }, L(k, 'term')), k.original ? originalNode(k.original) : null];
      return el('li', { class: 'term-item' },
        g ? el('a', { class: 'term-link', href: '#glossary/' + encodeURIComponent(g.id), title: t('toGlossary') }, head)
          : el('span', { class: 'term-link' }, head),
        g && L(g, 'meaning') ? el('p', { class: 'term-meaning' }, L(g, 'meaning')) : null);
    }))));
  }

  // 7. key points
  const points = it['key_points_' + S.lang] || [];
  if (points.length) body.append(section('keyPoints', el('ul', { class: 'points' }, points.map(p => el('li', null, p)))));

  // 8–9. outcome, place
  if (L(it, 'outcome')) body.append(section('outcome', el('p', null, L(it, 'outcome'))));
  if (L(it, 'place')) body.append(section('place', el('p', null, L(it, 'place'))));

  // 10. people and texts
  const chipRow = (key, arr) => arr.length ? section(key, el('ul', { class: 'chip-list' }, arr.map(x =>
    el('li', null, el('a', { class: 'chip', href: '#timeline?q=' + encodeURIComponent(x), title: t('searchFor', { q: x }) }, x))))) : null;
  body.append(chipRow('people', it['people_' + S.lang] || []) || '', chipRow('texts', it['texts_' + S.lang] || []) || '');

  // 11. related
  const rel = relationList(it, { full: true });
  if (rel) body.append(section('related', rel));

  // 12. sources
  if (it.sources?.length) {
    body.append(section('sources', el('ul', { class: 'sources' }, it.sources.map(s => {
      const b = S.bookById.get(s.book);
      return el('li', null, el('span', { class: 'src-book' }, b ? name(b) : s.book), s.pages ? ', ' + fmtPages(s.pages) : '');
    }))));
  }

  const line = S.byDoctrine.get(it.doctrine);
  const i = line.indexOf(it);
  return { title: L(it, 'title'), prev: line[i - 1] || null, next: line[i + 1] || null, item: it };
}

export function navButton(btn, item, labelKey) {
  btn.replaceChildren();
  if (!item) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.dataset.href = itemHref(item.id);
  btn.setAttribute('style', docStyle(item.doctrine));
  btn.append(el('span', { class: 'pn-label' }, S.t(labelKey)),
    el('span', { class: 'pn-title' }, L(item, 'date_label') + ' · ' + L(item, 'title')));
}
