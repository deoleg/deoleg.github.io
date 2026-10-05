import { S, setLang, buildIndexes, el, storage } from './util.js';
import { DICT } from './i18n.js';
import * as matrix from './views/matrix.js';
import * as doctrine from './views/doctrine.js';
import * as timeline from './views/timeline.js';
import * as glossary from './views/glossary.js';
import * as about from './views/about.js';
import { renderItem, navButton } from './views/item.js';

const $ = id => document.getElementById(id);
const LANG_KEY = 'hcd-lang', THEME_KEY = 'hcd-theme';
const VIEWS = { matrix, doctrine, timeline, glossary, about };
const NAV = [['matrix', '#/', 'navMatrix'], ['timeline', '#timeline', 'navTimeline'], ['glossary', '#glossary', 'navGlossary'], ['about', '#about', 'navAbout']];

const main = $('main'), panel = $('panel'), panelBody = $('panelBody'), panelKicker = $('panelKicker');

/* ---------- routing ---------- */
function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const qi = raw.indexOf('?');
  const path = qi < 0 ? raw : raw.slice(0, qi);
  const params = new URLSearchParams(qi < 0 ? '' : raw.slice(qi + 1));
  const [head, ...rest] = path.split('/');
  const id = rest.length ? decodeURIComponent(rest.join('/')) : null;
  let view = head || 'matrix';
  if (!['matrix', 'doctrine', 'timeline', 'item', 'glossary', 'about'].includes(view)) view = 'matrix';
  return { view, id, params, raw: view === 'item' ? raw : (raw || '') };
}

let baseRaw = null;        // hash (without '#') of the screen under the panel
let prevRoute = null;      // previous parsed route
let panelOpener = null;    // element focused when the panel opened
let itemDepth = 0;         // how many card entries sit on top of the base screen in history
let pendingDepth = null;   // depth to keep after prev/next (location.replace)
let prevBase = null;       // base screen when the panel was opened

const ctx = {
  // Rewrites the current base URL without a new history entry (filters, toggles).
  replaceBase(raw) {
    baseRaw = raw;
    history.replaceState(history.state, '', '#' + raw);
  }
};

function renderBase(route, { focus = true } = {}) {
  const view = VIEWS[route.view] || matrix;
  const res = view.render(main, route, ctx) || {};
  baseRaw = route.raw;
  document.title = (res.title ? res.title + ' · ' : '') + S.meta['title_' + S.lang];
  updateNav(route.view);
  $('announcer').textContent = S.t('screen', { name: res.title || '' });
  if (res.scrollTo) res.scrollTo.scrollIntoView({ block: 'start' });
  else window.scrollTo(0, 0);
  if (focus) (res.focusEl || $('viewTitle'))?.focus({ preventScroll: true });
}

function route() {
  const r = parseHash();
  if (r.view === 'item') {
    if (baseRaw === null) renderBase(parseHash('#/'), { focus: false });
    // history depth of this card above the base screen (kept in history.state)
    if (pendingDepth !== null) { itemDepth = pendingDepth; pendingDepth = null; }
    else if (history.state && typeof history.state.d === 'number') itemDepth = history.state.d;
    else if (prevRoute?.view === 'item') itemDepth = itemDepth > 0 ? itemDepth + 1 : 0;
    else itemDepth = prevRoute ? 1 : 0;
    history.replaceState({ d: itemDepth }, '');
    openPanel(r.id);
  } else {
    const wasOpen = panel.open;
    if (r.raw !== baseRaw) renderBase(r, { focus: prevRoute !== null && !wasOpen });
    else updateNav(r.view);
    if (wasOpen) closePanel(r.raw === (prevBase ?? r.raw));
  }
  prevRoute = r;
}

/* ---------- panel ---------- */
function openPanel(id) {
  if (!panel.open) {
    panelOpener = document.activeElement !== document.body ? document.activeElement : null;
    prevBase = baseRaw;
    panel.showModal();
    document.documentElement.classList.add('panel-open');
  }
  const res = renderItem(panelBody, panelKicker, id);
  navButton($('panelPrev'), res.prev, 'prev');
  navButton($('panelNext'), res.next, 'next');
  $('panelNav').hidden = !res.prev && !res.next;
  panel.querySelector('.panel-scroll').scrollTop = 0;
  document.title = res.title + ' · ' + S.meta['title_' + S.lang];
  $('panelTitle')?.focus({ preventScroll: true });
}

function closePanel(restoreFocus) {
  panel.close();
  document.documentElement.classList.remove('panel-open');
  const base = parseHash('#' + baseRaw);
  document.title = document.title.replace(/^.*? · /, '');
  if (restoreFocus && panelOpener?.isConnected) panelOpener.focus({ preventScroll: true });
  else $('viewTitle')?.focus({ preventScroll: true });
  panelOpener = null;
  updateNav(base.view);
}

function requestClose() {
  if (itemDepth > 0) history.go(-itemDepth);
  else location.replace('#' + (baseRaw || '/'));
}

panel.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });
panel.addEventListener('click', e => { if (e.target === panel) requestClose(); });
$('panelClose').addEventListener('click', requestClose);
for (const b of [$('panelPrev'), $('panelNext')]) {
  b.addEventListener('click', () => {
    if (!b.dataset.href) return;
    pendingDepth = itemDepth;
    location.replace(b.dataset.href);
  });
}

/* ---------- header, language, theme ---------- */
function updateNav(view) {
  document.querySelectorAll('#siteNav a').forEach(a => {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function paintChrome() {
  const t = S.t;
  document.documentElement.lang = S.lang;
  $('skip').textContent = t('skip');
  $('siteTitle').textContent = S.meta ? S.meta['title_' + S.lang] : DICT[S.lang].navMatrix;
  $('siteSub').textContent = t('siteSub');
  const nav = $('siteNav');
  nav.setAttribute('aria-label', t('navLabel'));
  nav.replaceChildren(el('ul', null, NAV.map(([view, href, key]) =>
    el('li', null, el('a', { href, dataset: { view } }, t(key))))));
  $('langSwitch').setAttribute('aria-label', t('language'));
  document.querySelectorAll('#langSwitch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
  const dark = currentTheme() === 'dark';
  const tb = $('themeToggle');
  tb.setAttribute('aria-label', t(dark ? 'themeToLight' : 'themeToDark'));
  tb.title = tb.getAttribute('aria-label');
  tb.textContent = dark ? '☀' : '☾';
  $('panelClose').setAttribute('aria-label', t('close'));
  $('panelClose').title = t('close');
  $('panelNav').setAttribute('aria-label', t('prev') + ' / ' + t('next'));
  if (S.meta) {
    $('footerText').replaceChildren(
      t('footerData', { date: S.meta.generated, n: S.items.length }), ' · ',
      el('a', { href: '#about' }, t('navAbout')));
  }
}

function switchLang(lang) {
  if (lang === S.lang) return;
  setLang(lang);
  storage.set(LANG_KEY, lang);
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) { url.searchParams.set('lang', lang); history.replaceState(history.state, '', url); }
  paintChrome();
  const r = parseHash();
  const keepFocus = document.activeElement;
  if (baseRaw !== null) renderBase(parseHash('#' + baseRaw), { focus: false });
  if (r.view === 'item' && panel.open) openPanel(r.id);
  updateNav(parseHash('#' + baseRaw).view);
  if (keepFocus?.isConnected) keepFocus.focus({ preventScroll: true });
}

$('langSwitch').addEventListener('click', e => {
  const b = e.target.closest('button[data-lang]');
  if (b) switchLang(b.dataset.lang);
});
$('themeToggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  storage.set(THEME_KEY, next);
  paintChrome();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', paintChrome);

/* ---------- boot ---------- */
function showLoadError() {
  const msg = lang => el('div', { lang, class: 'load-error-block' },
    el('p', { class: 'load-error-title' }, DICT[lang].loadError),
    el('p', null, DICT[lang].fileHint1, el('code', null, 'python3 -m http.server'), DICT[lang].fileHint2,
      el('code', null, 'http://localhost:8000/doctrines/'), '.'));
  main.replaceChildren(el('section', { class: 'view load-error', role: 'alert' }, msg('ru'), msg('en')));
}

async function boot() {
  const qsLang = new URLSearchParams(location.search).get('lang');
  const stored = storage.get(LANG_KEY);
  const lang = (qsLang === 'ru' || qsLang === 'en') ? qsLang : (stored === 'en' || stored === 'ru') ? stored : 'ru';
  if (qsLang === 'ru' || qsLang === 'en') storage.set(LANG_KEY, qsLang);
  setLang(lang);
  paintChrome();
  main.replaceChildren(el('p', { class: 'status' }, S.t('loading')));

  if (location.protocol === 'file:') { showLoadError(); return; }
  let data;
  try {
    const res = await fetch('data/doctrines.json');
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch {
    showLoadError();
    return;
  }
  buildIndexes(data);
  paintChrome();
  window.addEventListener('hashchange', route);
  route();
  document.documentElement.classList.add('is-ready');
}

boot();
