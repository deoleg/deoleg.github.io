import { S, el, L, norm, tokens, itemHref, docDot, highlighted } from '../util.js';
import { viewHeading } from './common.js';

const GREEK = /[Ͱ-Ͽἀ-῿]/;
const LEADING = /^[\s«»"„“”'‘’(\[]+/;

const sortKey = s => norm(s).replace(LEADING, '');
const termOf = g => g['term_' + S.lang] || g.term_ru || g.term_en;
const otherTerm = g => g['term_' + (S.lang === 'ru' ? 'en' : 'ru')];

export function originalNode(text, cls = 'orig') {
  return el('span', { class: cls, lang: GREEK.test(text) ? 'grc' : 'la' }, text);
}

export function render(root, { id }) {
  const t = S.t;
  const view = el('section', { class: 'view view-glossary', 'aria-labelledby': 'viewTitle' });
  view.append(viewHeading(t('glossaryTitle'), { id: 'viewTitle' }));

  const collator = new Intl.Collator(S.lang, { sensitivity: 'base' });
  const all = S.meta.glossary.map(g => ({
    g,
    key: sortKey(termOf(g)),
    hay: norm([g.term_ru, g.term_en, g.original, g['meaning_' + S.lang]].join('\n'))
  })).sort((a, b) => collator.compare(a.key, b.key));

  const q = el('input', { type: 'search', id: 'glSearch', autocomplete: 'off', spellcheck: 'false', placeholder: t('glossaryPlaceholder') });
  const counter = el('p', { class: 'tl-count', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const notFound = el('p', { class: 'notice', hidden: true }, t('termNotFound'));
  const az = el('nav', { class: 'az', 'aria-label': t('alphabet') });
  const listBox = el('div', { class: 'gl-list' });
  const empty = el('p', { class: 'empty', hidden: true }, t('glossaryNothing'));

  view.append(el('div', { class: 'tl-controls' },
    el('div', { class: 'search' }, el('label', { for: 'glSearch', class: 'search-label' }, t('glossarySearch')), q),
    counter), notFound, az, empty, listBox);

  function termCard(g, toks) {
    const term = termOf(g), other = otherTerm(g);
    const card = el('article', { class: 'term', id: 'term-' + g.id, tabindex: '-1', 'aria-labelledby': 'termh-' + g.id });
    card.append(el('h4', { class: 'term-name', id: 'termh-' + g.id }, highlighted(term, toks)));
    const sub = el('p', { class: 'term-sub' });
    if (g.original) sub.append(originalNode(g.original));
    if (other && norm(other) !== norm(term) && norm(other) !== norm(g.original)) {
      sub.append(el('span', { class: 'term-other', lang: S.lang === 'ru' ? 'en' : 'ru' }, other));
    }
    if (sub.childNodes.length) card.append(sub);
    if (L(g, 'meaning')) card.append(el('p', { class: 'term-meaning' }, highlighted(L(g, 'meaning'), toks)));
    const refs = (g.items || []).map(x => S.byId.get(x)).filter(Boolean)
      .sort((a, b) => S.order.get(a.id) - S.order.get(b.id));
    if (refs.length) {
      card.append(el('p', { class: 'term-used' }, t('usedIn') + ':'),
        el('ul', { class: 'term-refs' }, refs.map(it => el('li', null,
          el('a', { href: itemHref(it.id) }, docDot(it.doctrine),
            el('span', { class: 'rel-date' }, L(it, 'date_label')), ' ', L(it, 'title'))))));
    }
    return card;
  }

  function draw() {
    const toks = tokens(q.value);
    const shown = all.filter(x => toks.every(tk => x.hay.includes(tk)));
    counter.textContent = t('glossaryCount', { n: shown.length, total: all.length });
    empty.hidden = shown.length > 0;
    const groups = new Map();
    for (const x of shown) {
      const letter = (x.key[0] || '#').toUpperCase();
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter).push(x.g);
    }
    az.replaceChildren(el('ul', null, [...groups.keys()].map(letter => el('li', null,
      el('button', { type: 'button', class: 'az-btn', dataset: { letter } }, letter)))));
    listBox.replaceChildren(...[...groups].map(([letter, gs]) => el('section', { class: 'gl-group', id: 'gl-' + letter, 'aria-labelledby': 'glh-' + letter },
      el('h3', { class: 'gl-letter', id: 'glh-' + letter, tabindex: '-1' }, letter),
      el('div', { class: 'gl-terms' }, gs.map(g => termCard(g, toks))))));
  }

  az.addEventListener('click', e => {
    const b = e.target.closest('.az-btn');
    if (!b) return;
    const h = document.getElementById('glh-' + b.dataset.letter);
    if (h) { h.scrollIntoView({ block: 'start' }); h.focus({ preventScroll: true }); }
  });
  let timer = 0;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 200); });

  root.replaceChildren(view);
  draw();

  let focusEl = null;
  if (id) {
    const card = document.getElementById('term-' + id);
    if (card) {
      card.classList.add('is-target');
      focusEl = card;
    } else notFound.hidden = false;
  }
  return { title: t('glossaryTitle'), focusEl, scrollTo: focusEl };
}
