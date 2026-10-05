import { S, el, L, name } from '../util.js';
import { viewHeading } from './common.js';

export function render(root) {
  const t = S.t, m = S.meta;
  const rels = S.items.reduce((n, it) => n + (it.related || []).length, 0);
  const view = el('section', { class: 'view view-about prose', 'aria-labelledby': 'viewTitle' },
    viewHeading(t('aboutTitle'), { id: 'viewTitle' }),
    el('p', { class: 'lead' }, t('aboutLead')),
    el('p', null, t('aboutStats', { items: S.items.length, doctrines: m.doctrines.length, eras: m.eras.length, terms: m.glossary.length, rels })),
    el('h3', { class: 'section-title' }, t('aboutHow')),
    el('ul', null, ['aboutHow1', 'aboutHow2', 'aboutHow3', 'aboutHow4'].map(k => el('li', null, t(k)))),
    L(m, 'note') ? el('h3', { class: 'section-title' }, t('aboutNote')) : null,
    L(m, 'note') ? el('p', null, L(m, 'note')) : null,
    el('h3', { class: 'section-title' }, t('aboutSources')),
    el('ol', { class: 'books' }, m.books.map(b => el('li', null, name(b)))),
    el('p', { class: 'muted' }, t('aboutGenerated', { date: m.generated })));
  root.replaceChildren(view);
  return { title: t('aboutTitle') };
}
