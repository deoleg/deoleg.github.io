/* История христианства · History of Christianity
   Interactive timeline. Plain JS, no dependencies. */
(function () {
  'use strict';

  var DATA_URL = '../data/events.json';
  var LS_LANG = 'hoc-lang';
  var LS_THEME = 'hoc-theme';

  /* ---------- i18n ---------- */
  var i18n = {
    ru: {
      title: 'История христианства',
      subtitle: 'Интерактивная хронология',
      pageTitle: 'История христианства — хронология',
      skip: 'Перейти к хронологии',
      language: 'Язык',
      themeToDark: 'Включить тёмную тему',
      themeToLight: 'Включить светлую тему',
      copyLink: 'Скопировать ссылку на текущий вид',
      linkCopied: 'Ссылка скопирована',
      linkCopyFailed: 'Не удалось скопировать ссылку',
      filters: 'Фильтры и поиск',
      searchLabel: 'Поиск по событиям',
      searchPlaceholder: 'Поиск: событие, имя, место…',
      importance: 'Порог важности',
      impImportant: 'Важные',
      impAll: 'Все',
      moreFilters: 'Категории',
      categories: 'Категории',
      reset: 'Сбросить',
      shown: ['Показано ', ' из '],
      empty: 'Ничего не найдено. Измените запрос или сбросьте фильтры.',
      eventsCount: function (n) { return n + ' ' + plural(n, 'событие', 'события', 'событий'); },
      milestone: 'Поворотный момент',
      rangeTo: function (y) { return 'до ' + y + ' г.'; },
      rangeFrom: function (y) { return 'с ' + y + ' г.'; },
      range: function (a, b) { return a + '–' + b + ' гг.'; },
      dateNote: 'Расхождения в источниках',
      keyPoints: 'Ключевые моменты',
      people: 'Личности',
      peopleHint: 'Нажмите на имя, чтобы найти все события с ним',
      searchPerson: function (name) { return 'Искать события: ' + name; },
      place: 'Место',
      sourcesTitle: 'Источники',
      prev: 'Предыдущее',
      next: 'Следующее',
      close: 'Закрыть',
      openEvent: 'Подробнее',
      sources: 'Источники',
      generated: function (d, n) { return 'Данные от ' + d + ' · ' + n + ' ' + plural(n, 'событие', 'события', 'событий'); },
      loading: 'Загрузка хронологии…',
      errorTitle: 'Не удалось загрузить данные',
      errorFile: 'Страница открыта как файл (file://), а браузер не даёт загружать данные напрямую с диска.',
      errorGeneric: 'Файл data/events.json недоступен.',
      errorHint: 'Запустите локальный сервер в корне репозитория и откройте страницу через него:',
      errorOpen: 'затем откройте',
      errorOr: 'или используйте расширение Live Server в VS Code.'
    },
    en: {
      title: 'History of Christianity',
      subtitle: 'An interactive timeline',
      pageTitle: 'History of Christianity — a timeline',
      skip: 'Skip to timeline',
      language: 'Language',
      themeToDark: 'Switch to dark theme',
      themeToLight: 'Switch to light theme',
      copyLink: 'Copy a link to the current view',
      linkCopied: 'Link copied',
      linkCopyFailed: 'Could not copy the link',
      filters: 'Filters and search',
      searchLabel: 'Search events',
      searchPlaceholder: 'Search: event, person, place…',
      importance: 'Importance threshold',
      impImportant: 'Important',
      impAll: 'All',
      moreFilters: 'Categories',
      categories: 'Categories',
      reset: 'Reset',
      shown: ['Showing ', ' of '],
      empty: 'Nothing found. Change the query or reset the filters.',
      eventsCount: function (n) { return n + (n === 1 ? ' event' : ' events'); },
      milestone: 'Turning point',
      rangeTo: function (y) { return 'to AD ' + y; },
      rangeFrom: function (y) { return 'from ' + y; },
      range: function (a, b) { return a + '–' + b; },
      dateNote: 'Discrepancies between sources',
      keyPoints: 'Key points',
      people: 'People',
      peopleHint: 'Click a name to find all events with that person',
      searchPerson: function (name) { return 'Search events: ' + name; },
      place: 'Place',
      sourcesTitle: 'Sources',
      prev: 'Previous',
      next: 'Next',
      close: 'Close',
      openEvent: 'Details',
      sources: 'Sources',
      generated: function (d, n) { return 'Data as of ' + d + ' · ' + n + ' events'; },
      loading: 'Loading the timeline…',
      errorTitle: 'Could not load the data',
      errorFile: 'The page was opened as a file (file://), and the browser does not allow loading data directly from disk.',
      errorGeneric: 'The file data/events.json is not available.',
      errorHint: 'Start a local server in the repository root and open the page through it:',
      errorOpen: 'then open',
      errorOr: 'or use the Live Server extension in VS Code.'
    }
  };

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  /* ---------- Icons (inline SVG, 24×24, stroke) ---------- */
  var ICONS = {
    council: ['c:9,8,3', 'c:17,9,2.5', 'M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5', 'M15.5 14.6c.5-.1 1-.1 1.5-.1 2.5 0 4 1.8 4 5'],
    controversy: ['M13 2 4 14h7l-1 8 9-12h-7l1-8z'],
    persecution: ['M12 3c.8 3.4 5 5 5 10a5 5 0 0 1-10 0c0-2.4 1.4-3.6 2-5.2.9.9 1.6 2 1.8 3.2.5-2.6.3-5.4 1.2-8z'],
    mission: ['c:12,12,9', 'M3 12h18', 'M12 3c3 3.2 3 14.8 0 18', 'M12 3c-3 3.2-3 14.8 0 18'],
    schism: ['M12 3v7', 'M12 10 6 21', 'M12 10l6 11', 'M9 6.5h6'],
    theology: ['M3 5.5c3-1.2 6-1 9 1 3-2 6-2.2 9-1V19c-3-1-6-.8-9 1-3-1.8-6-2-9-1z', 'M12 6.5V20'],
    document: ['M6 3h9l4 4v14H6z', 'M15 3v4h4', 'M9 12h7', 'M9 16h7'],
    person: ['c:12,8,4', 'M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7'],
    movement: ['M5 21V4', 'M5 4h12l-2.5 4.5L17 13H5'],
    politics: ['M3 19h18', 'M4.5 19 3 7.5l5 4 4-6.5 4 6.5 5-4L19.5 19'],
    revival: ['c:12,12,3.5', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M4.9 4.9 7 7', 'M17 17l2.1 2.1', 'M4.9 19.1 7 17', 'M17 7l2.1-2.1'],
    worship: ['M12 2.5v19', 'M7 8h10'],
    // UI
    search: ['c:11,11,7', 'M20 20l-4-4'],
    sun: ['c:12,12,4', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
    moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
    link: ['M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1', 'M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'],
    close: ['M6 6l12 12', 'M18 6 6 18'],
    left: ['M15 5l-7 7 7 7'],
    right: ['M9 5l7 7-7 7'],
    pin: ['M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z', 'c:12,9.5,2.5'],
    alert: ['M12 3 2 20h20z', 'M12 10v4.5', 'M12 17.5v.01'],
    star: ['M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z']
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function icon(name) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    (ICONS[name] || []).forEach(function (d) {
      var node;
      if (d.indexOf('c:') === 0) {
        var p = d.slice(2).split(',');
        node = document.createElementNS(SVG_NS, 'circle');
        node.setAttribute('cx', p[0]); node.setAttribute('cy', p[1]); node.setAttribute('r', p[2]);
      } else {
        node = document.createElementNS(SVG_NS, 'path');
        node.setAttribute('d', d);
      }
      svg.appendChild(node);
    });
    return svg;
  }

  /* ---------- Tiny DOM helper ---------- */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] == null || attrs[k] === false) continue;
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      }
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function $(id) { return document.getElementById(id); }

  /* ---------- Storage (guarded) ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- Text helpers ---------- */
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }

  // First 1–2 sentences, skipping splits after abbreviations and initials
  function excerpt(text, maxSentences) {
    var re = /[.!?…]+["»”)]*\s+(?=["«“(]?[A-ZА-ЯЁ0-9])/g;
    var m, cuts = [];
    while ((m = re.exec(text)) && cuts.length < maxSentences) {
      var before = text.slice(0, m.index + 1);
      // "гг.", "св.", "т.", "e.g." / single-letter initials "А." "J."
      if (/(?:^|[\s(])(?:[a-zа-яё]{1,3}|[A-ZА-ЯЁ])\.$/.test(before)) continue;
      if (/(?:^|[\s(])(?:н\.\s?э|до н\.\s?э|ср|им|см)\.$/.test(before)) continue;
      cuts.push(m.index + m[0].length);
    }
    var end = cuts.length >= maxSentences ? cuts[maxSentences - 1] : text.length;
    var out = text.slice(0, end).trim();
    // Keep card excerpts short even if the first sentences are long
    var limit = maxSentences === 1 ? 180 : 300;
    if (out.length > limit) {
      out = out.slice(0, limit);
      out = out.slice(0, out.lastIndexOf(' ')).replace(/[,;:–—\s]+$/, '') + '…';
    }
    return out;
  }

  /* ---------- Book ids inside notes ----------
     Some date notes mention books by their internal id ("north_church датирует…").
     At render time they are replaced with a short author name; the full title
     is shown on hover. Russian forms: nominative, genitive (after «у»), dative (after «по»). */
  var BOOK_SHORT = {
    berkhof_doctrines:   { ru: ['Беркхов', 'Беркхова', 'Беркхову'], en: 'Berkhof' },
    gonzalez1_en:        { ru: ['Гонсалес («История христианской мысли»)', 'Гонсалеса («История христианской мысли»)', 'Гонсалесу («История христианской мысли»)'], en: 'González (Christian Thought)' },
    gonzalez3_en:        { ru: ['Гонсалес («История христианской мысли», т. III)', 'Гонсалеса («История христианской мысли», т. III)', 'Гонсалесу («История христианской мысли», т. III)'], en: 'González (Christian Thought, vol. III)' },
    grenz_olson_20c:     { ru: ['Гренц и Олсон', 'Гренца и Олсона', 'Гренцу и Олсону'], en: 'Grenz & Olson' },
    hall_early_church:   { ru: ['Холл', 'Холла', 'Холлу'], en: 'Hall' },
    hist_christ_1:       { ru: ['Гонсалес («История христианства», т. I)', 'Гонсалеса («История христианства», т. I)', 'Гонсалесу («История христианства», т. I)'], en: 'González (Story of Christianity, vol. I)' },
    hist_christ_2:       { ru: ['Гонсалес («История христианства», т. II)', 'Гонсалеса («История христианства», т. II)', 'Гонсалесу («История христианства», т. II)'], en: 'González (Story of Christianity, vol. II)' },
    lane_thinkers:       { ru: ['Лейн', 'Лейна', 'Лейну'], en: 'Lane' },
    lebedev1:            { ru: ['Лебедев (ч. I)', 'Лебедева (ч. I)', 'Лебедеву (ч. I)'], en: 'Lebedev (part I)' },
    lebedev2:            { ru: ['Лебедев (ч. II)', 'Лебедева (ч. II)', 'Лебедеву (ч. II)'], en: 'Lebedev (part II)' },
    mcgrath_reformation: { ru: ['МакГрат', 'МакГрата', 'МакГрату'], en: 'McGrath' },
    pelikan1:            { ru: ['Пеликан (т. 1)', 'Пеликана (т. 1)', 'Пеликану (т. 1)'], en: 'Pelikan (vol. 1)' },
    pelikan2:            { ru: ['Пеликан (т. 2)', 'Пеликана (т. 2)', 'Пеликану (т. 2)'], en: 'Pelikan (vol. 2)' },
    north_church:        { ru: ['Норт', 'Норта', 'Норту'], en: 'North' },
    josephus:            { ru: ['Иосиф Флавий', 'Иосифа Флавия', 'Иосифу Флавию'], en: 'Josephus' }
  };
  var bookIdRe = null;

  function bookShort(id, before) {
    var b = BOOK_SHORT[id];
    if (!b) return null;
    if (state.lang === 'en') return b.en;
    var form = /(?:^|[\s(])у\s$/i.test(before) ? 1 : /(?:^|[\s(])по\s$/i.test(before) ? 2 : 0;
    return b.ru[form];
  }

  // Returns a DocumentFragment: plain text with book ids replaced by <cite title="full title">
  function withBookNames(text) {
    var frag = document.createDocumentFragment();
    if (!bookIdRe) {
      bookIdRe = new RegExp('\\b(' + Object.keys(BOOK_SHORT).join('|') + ')(?::(\\d+))?\\b(\\/)?', 'gi');
    }
    var last = 0, m;
    bookIdRe.lastIndex = 0;
    while ((m = bookIdRe.exec(text))) {
      var id = m[1].toLowerCase();
      var before = text.slice(0, m.index);
      var name = bookShort(id, before);
      // "Josephus" is also a plain English word: leave it untouched
      if (!name || m[1] === name) continue;
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var book = bookById[id];
      var pageLabel = state.lang === 'en' ? 'p. ' : 'с. ';
      var tail = '';
      // "Лейн (lane_thinkers:35)" — author already named right before: keep only the page
      var author = name.split(' ')[0];
      if (m[2] && before.slice(-(author.length + 2)).replace(/\s*\($/, '').slice(-author.length) === author && /\($/.test(before)) {
        frag.appendChild(el('span', { title: book ? N(book) : null, text: pageLabel + m[2] }));
      } else {
        frag.appendChild(el('cite', { class: 'book-ref', title: book ? N(book) : null, text: name }));
        if (m[2]) tail += ', ' + pageLabel + m[2];
      }
      if (m[3]) tail += ' / ';
      if (tail) frag.appendChild(document.createTextNode(tail));
      last = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  /* ---------- State ---------- */
  var state = {
    lang: 'ru',
    q: '',
    cats: [],   // selected category ids; empty = all
    imp: 1      // minimum importance: 2 = important, 1 = all
  };

  var data = null;
  var eventsById = {};
  var eraById = {};
  var catById = {};
  var bookById = {};
  var visibleIds = [];     // ids passing current filters, in order
  var cardEls = {};        // id -> article element
  var sectionEls = {};     // era id -> section element
  var currentEventId = null;
  var lastFocus = null;
  var revealObserver = null;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function T(key) {
    var v = i18n[state.lang][key];
    return v === undefined ? i18n.ru[key] : v;
  }
  function F(obj, field) { return obj[field + '_' + state.lang]; }
  function N(obj) { return obj[state.lang]; } // meta entries use {ru, en}

  /* ---------- URL ---------- */
  function readUrl() {
    var p = new URLSearchParams(location.search);
    var lang = p.get('lang');
    if (lang === 'ru' || lang === 'en') state.lang = lang;
    else {
      var saved = lsGet(LS_LANG);
      if (saved === 'ru' || saved === 'en') state.lang = saved;
    }
    state.q = p.get('q') || '';
    state.cats = splitParam(p.get('cat'));
    var imp = parseInt(p.get('imp'), 10);
    state.imp = imp === 2 ? 2 : 1;
  }

  function splitParam(v) {
    return v ? v.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
  }

  function writeUrl() {
    var p = new URLSearchParams();
    p.set('lang', state.lang);
    if (state.cats.length) p.set('cat', state.cats.join(','));
    if (state.imp !== 1) p.set('imp', String(state.imp));
    if (state.q.trim()) p.set('q', state.q.trim());
    var qs = p.toString().replace(/%2C/g, ',');
    var url = location.pathname + (qs ? '?' + qs : '') + location.hash;
    try { history.replaceState(history.state, '', url); } catch (e) { /* file:// etc. */ }
  }

  function setHash(hash) {
    var url = location.pathname + location.search + (hash || '');
    try { history.replaceState(history.state, '', url); } catch (e) { /* ignore */ }
  }

  /* ---------- Static UI text ---------- */
  function applyStaticText() {
    document.documentElement.lang = state.lang;
    document.title = T('pageTitle');

    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      n.textContent = T(n.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (n) {
      n.setAttribute('aria-label', T(n.getAttribute('data-i18n-aria')));
    });

    $('search').placeholder = T('searchPlaceholder');

    document.querySelectorAll('.lang-switch button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === state.lang));
    });

    var copy = $('copyLink');
    copy.setAttribute('aria-label', T('copyLink'));
    copy.title = T('copyLink');

    var close = $('panelClose');
    close.setAttribute('aria-label', T('close'));
    close.title = T('close') + ' (Esc)';

    updateThemeButton();
    buildImpSwitch();
  }

  /* ---------- Theme ---------- */
  function effectiveTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateThemeButton() {
    var btn = $('themeToggle');
    var dark = effectiveTheme() === 'dark';
    btn.textContent = '';
    btn.appendChild(icon(dark ? 'sun' : 'moon'));
    var label = dark ? T('themeToLight') : T('themeToDark');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  function toggleTheme() {
    var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    lsSet(LS_THEME, next);
    updateThemeButton();
  }

  /* ---------- Importance switch ---------- */
  function buildImpSwitch() {
    var box = $('impSwitch');
    box.textContent = '';
    [[2, 'impImportant'], [1, 'impAll']].forEach(function (o) {
      var checked = state.imp === o[0];
      var b = el('button', {
        type: 'button', role: 'radio',
        'aria-checked': String(checked),
        tabindex: checked ? '0' : '-1',
        'data-imp': o[0],
        text: T(o[1])
      });
      box.appendChild(b);
    });
  }

  function onImpKey(e) {
    var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    var order = [2, 1];
    var i = order.indexOf(state.imp);
    var next = order[(i + keys[e.key] + order.length) % order.length];
    setImp(next);
    var b = $('impSwitch').querySelector('[data-imp="' + next + '"]');
    if (b) b.focus();
  }

  function setImp(v) {
    state.imp = v;
    buildImpSwitch();
    applyFilters();
  }

  /* ---------- Chips ---------- */
  function buildChips() {
    var catBox = $('catChips');
    catBox.textContent = '';

    var catCount = {}, eraCount = {};
    data.events.forEach(function (e) {
      catCount[e.category] = (catCount[e.category] || 0) + 1;
      eraCount[e.era] = (eraCount[e.era] || 0) + 1;
    });

    data.meta.categories.forEach(function (c) {
      var b = el('button', {
        type: 'button', class: 'chip',
        'aria-pressed': String(state.cats.indexOf(c.id) !== -1),
        'data-cat': c.id,
        style: '--c: var(--cat-' + c.id + ')'
      }, [icon(c.id), el('span', { text: N(c) }), el('span', { class: 'chip-count', text: String(catCount[c.id] || 0) })]);
      catBox.appendChild(b);
    });

  }

  function syncChips() {
    document.querySelectorAll('#catChips .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', String(state.cats.indexOf(b.getAttribute('data-cat')) !== -1));
    });
    var n = state.cats.length;
    var badge = $('filtersBadge');
    badge.hidden = n === 0;
    badge.textContent = String(n);
  }

  function toggleIn(arr, id) {
    var i = arr.indexOf(id);
    if (i === -1) arr.push(id); else arr.splice(i, 1);
  }

  function eraRange(er) {
    if (er.from == null) return T('rangeTo')(er.to);
    if (er.to == null) return T('rangeFrom')(er.from);
    return T('range')(er.from, er.to);
  }

  /* ---------- Timeline render (single pass) ---------- */
  function renderTimeline() {
    var root = $('timeline');
    var frag = document.createDocumentFragment();
    cardEls = {};
    sectionEls = {};

    var byEra = {};
    data.events.forEach(function (e) { (byEra[e.era] = byEra[e.era] || []).push(e); });

    data.meta.eras.forEach(function (er) {
      var list = byEra[er.id] || [];
      var headId = 'era-title-' + er.id;
      var countEl = el('span', { class: 'era-count' });
      var sec = el('section', { class: 'era', id: 'era-' + er.id, 'data-era': er.id, 'aria-labelledby': headId }, [
        el('header', { class: 'era-head' }, [
          el('h2', { id: headId, text: N(er) }),
          el('span', { class: 'era-range', text: eraRange(er) }),
          countEl
        ])
      ]);
      sec._countEl = countEl;
      var ol = el('ol', { class: 'era-events' });
      list.forEach(function (e) {
        var art = renderCard(e);
        cardEls[e.id] = art;
        ol.appendChild(art);
      });
      sec.appendChild(ol);
      sectionEls[er.id] = sec;
      frag.appendChild(sec);
    });

    root.textContent = '';
    root.appendChild(frag);
    setupReveal();
  }

  function renderCard(e) {
    var cat = catById[e.category];
    var meta = el('div', { class: 'event-meta' }, [
      el('span', { class: 'event-date', text: F(e, 'date_label') }),
      el('span', { class: 'cat-tag' }, [icon(e.category), el('span', { text: cat ? N(cat) : e.category })]),
      e.importance === 3 ? el('span', { class: 'milestone-tag' }, [icon('star'), el('span', { text: T('milestone') })]) : null
    ]);
    var titleId = 'ev-title-' + e.id;
    var link = el('a', {
      class: 'event-card',
      href: '#event/' + e.id,
      'aria-describedby': titleId + '-x',
      'aria-haspopup': 'dialog'
    }, [
      meta,
      el('h3', { class: 'event-title', id: titleId, text: F(e, 'title') }),
      el('p', { class: 'event-excerpt', id: titleId + '-x', text: excerpt(F(e, 'summary'), e.importance === 1 ? 1 : 2) })
    ]);
    var li = el('li', {
      class: 'event imp-' + e.importance + ' reveal',
      'data-id': e.id,
      style: '--c: var(--cat-' + e.category + ')'
    }, [el('article', { 'aria-labelledby': titleId }, [link])]);
    return li;
  }

  function setupReveal() {
    if (revealObserver) revealObserver.disconnect();
    var items = document.querySelectorAll('.reveal');
    if (reducedMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('is-visible'); });
      return;
    }
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          revealObserver.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });
    items.forEach(function (n) { revealObserver.observe(n); });
  }

  /* ---------- Search index ---------- */
  function buildIndex() {
    data.events.forEach(function (e) {
      e._idx = {};
      ['ru', 'en'].forEach(function (l) {
        e._idx[l] = norm([
          e['title_' + l],
          e['summary_' + l],
          (e['people_' + l] || []).join(' '),
          e['place_' + l]
        ].join(' \u0001 '));
      });
    });
  }

  /* ---------- Filtering ---------- */
  function matches(e, terms) {
    if (e.importance < state.imp) return false;
    if (state.cats.length && state.cats.indexOf(e.category) === -1) return false;
    if (terms.length) {
      var idx = e._idx[state.lang];
      for (var i = 0; i < terms.length; i++) if (idx.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  function applyFilters() {
    if (!data) return;
    var terms = norm(state.q).split(/\s+/).filter(Boolean);
    visibleIds = [];
    var perEra = {};
    var side = 0;
    var lastEra = null;

    data.events.forEach(function (e) {
      var ok = matches(e, terms);
      var node = cardEls[e.id];
      node.hidden = !ok;
      if (!ok) return;
      visibleIds.push(e.id);
      perEra[e.era] = (perEra[e.era] || 0) + 1;
      if (e.era !== lastEra) { side = 0; lastEra = e.era; }
      node.classList.toggle('side-left', side % 2 === 0);
      node.classList.toggle('side-right', side % 2 === 1);
      side++;
    });

    data.meta.eras.forEach(function (er) {
      var sec = sectionEls[er.id];
      var n = perEra[er.id] || 0;
      sec.hidden = n === 0;
      sec._countEl.textContent = T('eventsCount')(n);
    });

    var counter = $('counter'), parts = T('shown');
    counter.textContent = '';
    counter.appendChild(document.createTextNode(parts[0]));
    counter.appendChild(el('strong', { text: String(visibleIds.length) }));
    counter.appendChild(document.createTextNode(parts[1] + data.events.length));
    $('empty').hidden = visibleIds.length > 0;
    $('resetBtn').disabled = !isFiltered();

    syncChips();
    writeUrl();
    if (currentEventId) updatePanelNav();
  }

  function isFiltered() {
    return !!(state.q.trim() || state.cats.length || state.imp !== 1);
  }

  function resetFilters() {
    state.q = '';
    state.cats = [];
    state.imp = 1;
    $('search').value = '';
    buildImpSwitch();
    applyFilters();
  }

  var searchTimer = null;
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = $('search').value;
      applyFilters();
    }, 150);
  }

  /* ---------- Detail panel ---------- */
  function openEvent(id) {
    var e = eventsById[id];
    if (!e) return false;
    var dlg = $('panel');
    if (!dlg.open) {
      lastFocus = document.activeElement;
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    }
    currentEventId = id;
    renderPanel(e);
    $('panelBody').scrollTop = 0;
    var title = $('panelTitle');
    if (title) title.focus({ preventScroll: true });
    return true;
  }

  function closePanel() {
    var dlg = $('panel');
    if (dlg.open) {
      if (typeof dlg.close === 'function') dlg.close(); else { dlg.removeAttribute('open'); onPanelClosed(); }
    }
  }

  function onPanelClosed() {
    var id = currentEventId;
    currentEventId = null;
    if (/^#event\//.test(location.hash)) setHash('');
    var card = id && cardEls[id];
    if (card && !card.hidden) {
      var link = card.querySelector('.event-card');
      card.classList.add('is-visible');
      link.focus({ preventScroll: true });
      link.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
    } else if (lastFocus && document.contains(lastFocus)) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
  }

  function renderPanel(e) {
    var cat = catById[e.category];
    var kicker = $('panelKicker');
    kicker.textContent = '';
    kicker.style.setProperty('--c', 'var(--cat-' + e.category + ')');
    kicker.appendChild(el('span', { class: 'cat-tag' }, [icon(e.category), el('span', { text: cat ? N(cat) : e.category })]));
    if (e.importance === 3) kicker.appendChild(el('span', { class: 'milestone-tag' }, [icon('star'), el('span', { text: T('milestone') })]));
    var er = eraById[e.era];
    if (er) kicker.appendChild(el('span', { class: 'era-range', text: N(er) }));

    var body = $('panelBody');
    body.textContent = '';
    body.appendChild(el('p', { class: 'panel-date', text: F(e, 'date_label') }));
    body.appendChild(el('h2', { class: 'panel-title', id: 'panelTitle', tabindex: '-1', text: F(e, 'title') }));

    var note = F(e, 'date_note');
    if (note && note.trim()) {
      body.appendChild(el('aside', { class: 'date-note', 'aria-label': T('dateNote') }, [
        icon('alert'),
        el('div', null, [el('h3', { text: T('dateNote') }), el('p', null, [withBookNames(note)])])
      ]));
    }

    body.appendChild(el('p', { class: 'panel-summary', text: F(e, 'summary') }));

    var kp = F(e, 'key_points') || [];
    if (kp.length) {
      body.appendChild(section(T('keyPoints'), el('ul', null, kp.map(function (s) { return el('li', { text: s }); }))));
    }

    var people = F(e, 'people') || [];
    if (people.length) {
      var chips = el('div', { class: 'chips' }, people.map(function (name) {
        return el('button', {
          type: 'button', class: 'chip people-chip',
          'data-person': name,
          'aria-label': T('searchPerson')(name),
          title: T('peopleHint')
        }, [icon('person'), el('span', { text: name })]);
      }));
      body.appendChild(section(T('people'), chips));
    }

    var place = F(e, 'place');
    if (place && place.trim()) {
      body.appendChild(section(T('place'), el('p', { class: 'place' }, [icon('pin'), el('span', { text: place })])));
    }

    var src = e.sources || [];
    if (src.length) {
      body.appendChild(section(T('sourcesTitle'), el('ul', { class: 'sources' }, src.map(function (s) {
        var b = bookById[s.book];
        return el('li', null, [
          el('span', { class: 'source-book', text: b ? N(b) : s.book }),
          s.pages ? el('span', { class: 'source-pages', text: s.pages }) : null
        ]);
      }))));
    }

    updatePanelNav();
  }

  function section(title, content) {
    return el('section', { class: 'panel-section' }, [el('h3', { text: title }), content]);
  }

  // Prev/next walk the filtered list; if the event is filtered out, walk all events
  function navList() {
    if (visibleIds.indexOf(currentEventId) !== -1) return visibleIds;
    return data.events.map(function (e) { return e.id; });
  }

  function updatePanelNav() {
    var list = navList();
    var i = list.indexOf(currentEventId);
    fillNavBtn($('panelPrev'), i > 0 ? list[i - 1] : null, 'prev', 'left');
    fillNavBtn($('panelNext'), i !== -1 && i < list.length - 1 ? list[i + 1] : null, 'next', 'right');
  }

  function fillNavBtn(btn, id, key, ico) {
    btn.textContent = '';
    btn.disabled = !id;
    btn.setAttribute('data-target', id || '');
    var dir = el('span', { class: 'panel-nav-dir' }, key === 'prev'
      ? [icon(ico), el('span', { text: T(key) })]
      : [el('span', { text: T(key) }), icon(ico)]);
    btn.appendChild(dir);
    if (id) {
      var e = eventsById[id];
      btn.appendChild(el('span', { class: 'panel-nav-title', text: F(e, 'date_label') + ' · ' + F(e, 'title') }));
      btn.setAttribute('aria-label', T(key) + ': ' + F(e, 'title'));
    } else {
      btn.removeAttribute('aria-label');
    }
  }

  function goto(id) {
    if (!id) return;
    setHash('#event/' + id);
    openEvent(id);
  }

  function searchPerson(name) {
    state.q = name;
    $('search').value = name;
    closePanel();
    applyFilters();
    scrollToTimeline();
  }

  function scrollToTimeline() {
    var target = $('main');
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- Routing ---------- */
  function route() {
    var h = decodeURIComponent(location.hash.slice(1));
    var m;
    if ((m = /^event\/(.+)$/.exec(h))) {
      if (!openEvent(m[1])) setHash('');
    } else if ((m = /^era\/(.+)$/.exec(h))) {
      closePanel();
      scrollToEra(m[1]);
    } else if ($('panel').open) {
      closePanel();
    }
  }

  function scrollToEra(id) {
    var sec = sectionEls[id];
    if (!sec) return;
    if (sec.hidden) return;
    sec.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- Copy link ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-shown'); }, 2200);
  }

  function copyLink() {
    var url = location.href;
    function fallback() {
      var ta = el('textarea', { readonly: true, style: 'position:fixed;top:-100px;opacity:0' });
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? T('linkCopied') : T('linkCopyFailed'));
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () { toast(T('linkCopied')); }, fallback);
    } else {
      fallback();
    }
  }

  /* ---------- Language ---------- */
  function setLang(lang) {
    if (lang === state.lang) return;
    state.lang = lang;
    lsSet(LS_LANG, lang);
    applyStaticText();
    if (!data) return;
    renderAll();
    if (currentEventId) renderPanel(eventsById[currentEventId]);
  }

  function renderAll() {
    buildChips();
    renderTimeline();
    renderFooter();
    applyFilters();
  }

  /* ---------- Footer ---------- */
  function renderFooter() {
    $('footerNote').textContent = F(data.meta, 'note');
    var ol = $('footerBooks');
    ol.textContent = '';
    data.meta.books.forEach(function (b) { ol.appendChild(el('li', { text: N(b) })); });
    $('footerMeta').textContent = data.meta.generated ? T('generated')(data.meta.generated, data.events.length) : '';
  }

  /* ---------- Errors ---------- */
  function showError() {
    var box = $('status');
    box.className = 'status is-error';
    box.textContent = '';
    var isFile = location.protocol === 'file:';
    box.appendChild(el('h2', { text: T('errorTitle') }));
    box.appendChild(el('p', { text: isFile ? T('errorFile') : T('errorGeneric') }));
    box.appendChild(el('p', { text: T('errorHint') }));
    box.appendChild(el('p', null, [el('code', { text: 'python3 -m http.server 8000' })]));
    box.appendChild(el('p', null, [
      document.createTextNode(T('errorOpen') + ' '),
      el('code', { text: 'http://localhost:8000/history/' }),
      document.createTextNode(' — ' + T('errorOr'))
    ]));
    $('filtersMore').closest('.filters').hidden = true;
  }

  /* ---------- Events wiring ---------- */
  function wire() {
    $('searchIcon').appendChild(icon('search'));
    $('copyLink').appendChild(icon('link'));
    $('panelClose').appendChild(icon('close'));

    document.querySelector('.lang-switch').addEventListener('click', function (e) {
      var b = e.target.closest('[data-lang]');
      if (b) setLang(b.getAttribute('data-lang'));
    });
    $('themeToggle').addEventListener('click', toggleTheme);
    $('copyLink').addEventListener('click', copyLink);

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', updateThemeButton);
    }

    $('search').addEventListener('input', onSearchInput);
    $('search').addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && this.value) { this.value = ''; onSearchInput(); }
    });

    $('impSwitch').addEventListener('click', function (e) {
      var b = e.target.closest('[data-imp]');
      if (b) setImp(parseInt(b.getAttribute('data-imp'), 10));
    });
    $('impSwitch').addEventListener('keydown', onImpKey);

    $('catChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      toggleIn(state.cats, b.getAttribute('data-cat'));
      applyFilters();
    });
    $('resetBtn').addEventListener('click', resetFilters);

    // Cards: open directly so a repeat click on the same card works
    $('timeline').addEventListener('click', function (e) {
      var a = e.target.closest('.event-card');
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      var id = a.closest('.event').getAttribute('data-id');
      lastFocus = a;
      setHash('#event/' + id);
      openEvent(id);
    });

    var dlg = $('panel');
    dlg.addEventListener('close', onPanelClosed);
    $('panelClose').addEventListener('click', closePanel);
    $('panelPrev').addEventListener('click', function () { goto(this.getAttribute('data-target')); });
    $('panelNext').addEventListener('click', function () { goto(this.getAttribute('data-target')); });
    // Click on the backdrop closes the panel
    dlg.addEventListener('click', function (e) {
      if (e.target !== dlg) return;
      var r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closePanel();
    });
    $('panelBody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-person]');
      if (b) searchPerson(b.getAttribute('data-person'));
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft' && !$('panelPrev').disabled) goto($('panelPrev').getAttribute('data-target'));
      if (e.key === 'ArrowRight' && !$('panelNext').disabled) goto($('panelNext').getAttribute('data-target'));
    });

    window.addEventListener('hashchange', route);

    // Categories panel open by default on wider screens
    if (window.matchMedia && window.matchMedia('(min-width: 700px)').matches) $('filtersMore').open = true;
  }

  /* ---------- Boot ---------- */
  function boot() {
    readUrl();
    wire();
    applyStaticText();
    $('search').value = state.q;
    $('status').textContent = T('loading');

    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        data = json;
        data.meta.eras.forEach(function (x) { eraById[x.id] = x; });
        data.meta.categories.forEach(function (x) { catById[x.id] = x; });
        data.meta.books.forEach(function (x) { bookById[x.id] = x; });
        data.events.forEach(function (e) { eventsById[e.id] = e; });
        // Drop unknown ids coming from the URL
        state.cats = state.cats.filter(function (id) { return catById[id]; });

        buildIndex();
        $('status').textContent = '';
        if (state.cats.length) $('filtersMore').open = true;
        renderAll();
        // Wait for web fonts so the initial #era/#event jump lands on the final layout
        var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(route);
      })
      .catch(function (err) {
        if (window.console) console.error(err);
        showError();
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
