import { S, el, L, name, docStyle, docDot, impBadge, typeChip, itemHref } from '../util.js';
import { viewHeading, timelineList } from './common.js';

export function render(root, { id, params }, ctx) {
  const t = S.t;
  const d = S.doctrineById.get(id);
  if (!d) {
    root.replaceChildren(el('section', { class: 'view' },
      viewHeading(t('doctrineNotFound'), { id: 'viewTitle' }),
      el('p', null, el('a', { href: '#/' }, t('toMatrix')))));
    return { title: t('doctrineNotFound') };
  }
  const withSec = params.get('s') === '1';
  const view = el('article', { class: 'view view-doctrine', style: docStyle(id), 'aria-labelledby': 'viewTitle' });

  view.append(el('nav', { class: 'doc-switch', 'aria-label': t('otherDoctrines') },
    el('ul', null, S.meta.doctrines.map(x => el('li', null,
      el('a', { href: '#doctrine/' + x.id, style: docStyle(x.id), 'aria-current': x.id === id ? 'page' : null },
        docDot(x.id), name(x)))))));

  const primary = S.byDoctrine.get(id);
  const secondary = S.items.filter(it => it.doctrine !== id && it.doctrines_secondary.includes(id));
  view.append(el('header', { class: 'doc-head' },
    el('span', { class: 'doc-swatch', 'aria-hidden': 'true' }),
    el('div', null,
      viewHeading(name(d), { id: 'viewTitle' }),
      el('p', { class: 'doc-count' }, t('lineCount', { n: primary.length })))));

  if (L(d, 'overview')) {
    view.append(el('section', { class: 'doc-overview', 'aria-labelledby': 'ovTitle' },
      el('h3', { id: 'ovTitle', class: 'section-title' }, t('overview')),
      el('p', null, L(d, 'overview'))));
  }

  const tps = (d.turning_points || []).map(x => S.byId.get(x)).filter(Boolean)
    .sort((a, b) => S.order.get(a.id) - S.order.get(b.id));
  if (tps.length) {
    view.append(el('section', { class: 'doc-turns', 'aria-labelledby': 'tpTitle' },
      el('h3', { id: 'tpTitle', class: 'section-title' }, t('turningPoints')),
      el('ol', { class: 'tp-list' }, tps.map(it => el('li', null,
        el('a', { class: 'tp-card', href: itemHref(it.id) },
          el('span', { class: 'tp-date' }, L(it, 'date_label')),
          el('span', { class: 'tp-title' }, L(it, 'title')),
          el('span', { class: 'tp-meta' }, typeChip(it.type), impBadge(it.importance))))))));
  }

  const box = el('input', { type: 'checkbox', id: 'docSecondary' });
  box.checked = withSec;
  const items = withSec
    ? [...primary, ...secondary].sort((a, b) => S.order.get(a.id) - S.order.get(b.id))
    : primary;
  const count = el('p', { class: 'doc-count', 'aria-live': 'polite' },
    withSec ? t('lineCountSec', { n: items.length, s: secondary.length }) : t('lineCount', { n: items.length }));
  view.append(el('section', { class: 'doc-line', 'aria-labelledby': 'lineTitle' },
    el('div', { class: 'line-head' },
      el('h3', { id: 'lineTitle', class: 'section-title' }, t('lineTitle')),
      el('label', { class: 'check' }, box, el('span', null, t('showSecondary'))),
      count),
    timelineList(items, { ownDoctrine: id })));

  box.addEventListener('change', () => {
    const p = new URLSearchParams(params);
    if (box.checked) p.set('s', '1'); else p.delete('s');
    const qs = p.toString();
    ctx.replaceBase('doctrine/' + id + (qs ? '?' + qs : ''));
    render(root, { id, params: p }, ctx);
    document.getElementById('docSecondary')?.focus();
  });

  root.replaceChildren(view);
  return { title: name(d) };
}
