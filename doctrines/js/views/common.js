import { S, el, L, name, docStyle, doctrineTag, impBadge, typeChip, itemHref, relationList, truncate, highlighted, eraYears } from '../util.js';

// One entry in a vertical timeline (doctrine line or full timeline).
// ownDoctrine: the doctrine whose line is shown (marks entries where it is only secondary).
export function entryItem(item, { toks = null, ownDoctrine = null, showDoctrine = false } = {}) {
  const secondary = ownDoctrine && item.doctrine !== ownDoctrine;
  const li = el('li', {
    class: `entry imp-${item.importance}${secondary ? ' is-secondary' : ''}`,
    id: 'entry-' + item.id,
    style: docStyle(item.doctrine)
  });
  li.append(el('span', { class: 'node', 'aria-hidden': 'true' }));
  const meta = el('p', { class: 'entry-meta' },
    el('span', { class: 'entry-date' }, L(item, 'date_label')),
    typeChip(item.type),
    impBadge(item.importance));
  if (showDoctrine) meta.append(doctrineTag(item.doctrine));
  if (secondary) {
    meta.append(el('span', { class: 'sec-mark' }, S.t('secondaryMark') + ' · ',
      S.t('primaryIs', { name: '' }).trim(), ' ', doctrineTag(item.doctrine)));
  }
  const title = el('h4', { class: 'entry-title' },
    el('a', { href: itemHref(item.id) }, highlighted(L(item, 'title'), toks)));
  const summary = el('p', { class: 'entry-summary' }, highlighted(truncate(L(item, 'summary'), 280), toks));
  li.append(el('div', { class: 'entry-body' }, meta, title, summary,
    relationList(item, { ownDoctrine: ownDoctrine || item.doctrine })));
  return li;
}

// Era divider inside a timeline <ol>.
export function eraDivider(era) {
  return el('li', { class: 'era-sep', id: 'era-' + era.id },
    el('h3', { class: 'era-sep-title' },
      el('span', null, name(era)),
      el('span', { class: 'era-sep-years' }, eraYears(era))));
}

// Renders items into an <ol> with era dividers between groups.
export function timelineList(items, opts) {
  const ol = el('ol', { class: 'tl' });
  let lastEra = null;
  for (const it of items) {
    if (it.era !== lastEra) {
      lastEra = it.era;
      ol.append(eraDivider(S.eraById.get(it.era)));
    }
    ol.append(entryItem(it, opts));
  }
  return ol;
}

export function viewHeading(text, extra) {
  return el('h2', { class: 'view-title', tabindex: '-1', ...(extra || {}) }, text);
}
