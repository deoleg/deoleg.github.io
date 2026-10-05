import { S, el, L, name, docStyle, docDot, impBadge, typeChip, itemHref, eraYears } from '../util.js';
import { viewHeading } from './common.js';

// Kept between renders (language switch, returning from a card).
const ui = { secondary: false, cell: null };

function cellItems(docId, eraId) {
  const primary = S.items.filter(it => it.doctrine === docId && it.era === eraId);
  const secondary = ui.secondary
    ? S.items.filter(it => it.era === eraId && it.doctrine !== docId && it.doctrines_secondary.includes(docId))
    : [];
  return { primary, secondary };
}

function dot(it, sec) {
  return el('span', { class: `dot imp-${it.importance}${sec ? ' sec' : ''}` });
}

export function render(root) {
  const t = S.t;
  const view = el('section', { class: 'view view-matrix', 'aria-labelledby': 'viewTitle' });
  view.append(viewHeading(t('matrixTitle'), { id: 'viewTitle' }));
  view.append(el('p', { class: 'lead' }, t('matrixIntro')));

  const secBox = el('input', { type: 'checkbox', id: 'mxSecondary' });
  secBox.checked = ui.secondary;
  const legend = el('div', { class: 'mx-legend', role: 'group', 'aria-label': t('legend') },
    ...[3, 2, 1].map(n => el('span', { class: 'mx-legend-item' },
      el('span', { class: `dot imp-${n}`, 'aria-hidden': 'true' }), t('imp' + n))),
    el('span', { class: 'mx-legend-item' },
      el('span', { class: 'dot imp-2 sec', 'aria-hidden': 'true' }), t('legendSecondary')));
  view.append(el('div', { class: 'mx-tools' },
    el('label', { class: 'check' }, secBox, el('span', null, t('withSecondary'))),
    legend));

  const scroller = el('div', { class: 'mx-scroll', role: 'region', 'aria-label': t('matrixCaption'), tabindex: '0' });
  const table = el('table', { class: 'matrix' });
  table.append(el('caption', { class: 'visually-hidden' }, t('matrixCaption')));
  const headRow = el('tr', null, el('th', { scope: 'col', class: 'mx-corner' }, t('doctrineCol')));
  for (const era of S.meta.eras) {
    headRow.append(el('th', { scope: 'col', class: 'mx-era' },
      el('span', { class: 'mx-era-name' }, name(era)),
      el('span', { class: 'mx-era-years' }, eraYears(era))));
  }
  table.append(el('thead', null, headRow));

  const tbody = el('tbody');
  const eraTotals = new Map(S.meta.eras.map(e => [e.id, 0]));
  for (const d of S.meta.doctrines) {
    const rowCount = S.byDoctrine.get(d.id).length;
    const tr = el('tr', { style: docStyle(d.id) },
      el('th', { scope: 'row', class: 'mx-doc' },
        el('a', { href: '#doctrine/' + d.id }, docDot(d.id), el('span', null, name(d))),
        el('span', { class: 'mx-row-n' }, String(rowCount))));
    for (const era of S.meta.eras) {
      const { primary, secondary } = cellItems(d.id, era.id);
      eraTotals.set(era.id, eraTotals.get(era.id) + primary.length);
      const td = el('td', { class: 'mx-cell' });
      const key = d.id + '|' + era.id;
      if (!primary.length && !secondary.length) {
        td.append(el('span', { class: 'mx-empty', title: t('cellEmpty') }, el('span', { class: 'visually-hidden' }, t('cellEmpty')), el('span', { 'aria-hidden': 'true' }, '·')));
      } else {
        const keyN = primary.filter(it => it.importance === 3).length;
        let label = t('cellLabel', { doctrine: name(d), era: name(era), count: primary.length });
        if (keyN) label += ', ' + t('cellKey', { n: keyN });
        if (secondary.length) label += ', ' + t('cellSecondary', { n: secondary.length });
        const btn = el('button', {
          type: 'button', class: 'mx-btn', 'aria-label': label,
          'aria-expanded': String(ui.cell === key), 'aria-controls': 'mxList',
          dataset: { cell: key }
        },
          el('span', { class: 'dots', 'aria-hidden': 'true' },
            primary.map(it => dot(it, false)), secondary.map(it => dot(it, true))),
          el('span', { class: 'mx-n', 'aria-hidden': 'true' },
            String(primary.length), secondary.length ? el('span', { class: 'mx-n-sec' }, '+' + secondary.length) : null));
        td.append(btn);
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  const footRow = el('tr', null, el('th', { scope: 'row', class: 'mx-doc mx-total' }, t('total', { n: S.items.length })));
  for (const era of S.meta.eras) footRow.append(el('td', { class: 'mx-foot', dataset: { era: era.id } }, String(eraTotals.get(era.id))));
  table.append(el('tfoot', null, footRow));
  scroller.append(table);
  view.append(scroller);

  const list = el('section', { class: 'mx-list', id: 'mxList', 'aria-live': 'polite', tabindex: '-1' });
  view.append(list);

  function showList() {
    list.replaceChildren();
    if (!ui.cell) { list.hidden = true; return; }
    const [docId, eraId] = ui.cell.split('|');
    const d = S.doctrineById.get(docId), era = S.eraById.get(eraId);
    const { primary, secondary } = cellItems(docId, eraId);
    if (!d || !era || (!primary.length && !secondary.length)) { ui.cell = null; list.hidden = true; return; }
    list.hidden = false;
    list.setAttribute('style', docStyle(docId));
    list.append(el('div', { class: 'mx-list-head' },
      el('h3', null, docDot(docId), t('cellListTitle', { doctrine: name(d), era: name(era) }),
        el('span', { class: 'mx-list-years' }, ' (' + eraYears(era) + ')')),
      el('button', { type: 'button', class: 'btn-ghost', onclick: () => toggle(null) }, t('closeList'))));
    const ul = el('ul', { class: 'row-list' });
    const row = (it, sec) => el('li', { class: 'row' + (sec ? ' is-secondary' : ''), style: docStyle(it.doctrine) },
      el('a', { href: itemHref(it.id), class: 'row-link' },
        el('span', { class: 'row-date' }, L(it, 'date_label')),
        el('span', { class: 'row-title' }, L(it, 'title')),
        el('span', { class: 'row-meta' }, typeChip(it.type), impBadge(it.importance),
          sec ? el('span', { class: 'sec-mark' }, docDot(it.doctrine), S.t('secondaryMark') + ' · ' + name(S.doctrineById.get(it.doctrine))) : null)));
    primary.forEach(it => ul.append(row(it, false)));
    secondary.forEach(it => ul.append(row(it, true)));
    list.append(ul);
  }

  function toggle(key, focusList) {
    ui.cell = ui.cell === key ? null : key;
    table.querySelectorAll('.mx-btn').forEach(b => {
      const on = b.dataset.cell === ui.cell;
      b.setAttribute('aria-expanded', String(on));
      b.classList.toggle('is-active', on);
    });
    showList();
    if (ui.cell && focusList) list.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  table.addEventListener('click', e => {
    const b = e.target.closest('.mx-btn');
    if (b) toggle(b.dataset.cell, true);
  });
  secBox.addEventListener('change', () => {
    ui.secondary = secBox.checked;
    const focusCell = document.activeElement === secBox;
    render(root);
    if (focusCell) document.getElementById('mxSecondary')?.focus();
  });

  root.replaceChildren(view);
  if (ui.cell) {
    table.querySelector(`[data-cell="${CSS.escape(ui.cell)}"]`)?.classList.add('is-active');
  }
  showList();
  return { title: t('navMatrix') };
}
