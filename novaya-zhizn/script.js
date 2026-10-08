/* Твоя новая жизнь — навигация, оглавление, сохранение ответов в localStorage. */
(function () {
  'use strict';
  var PREFIX = 'nz:';
  var doc = document.documentElement;

  function store(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }

  /* ---- Тема ---- */
  var themeBtn = document.querySelector('.theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var dark = doc.dataset.theme ? doc.dataset.theme === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      doc.dataset.theme = dark ? 'light' : 'dark';
      store(function (s) { s.setItem(PREFIX + 'theme', doc.dataset.theme); });
    });
  }

  /* ---- Мобильное меню ---- */
  var menuBtn = document.querySelector('.menu-btn');
  var nav = document.getElementById('lessons-nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.focus();
      }
    });
  }

  /* ---- Иллюстрации, которых ещё нет: понятная заглушка ---- */
  document.querySelectorAll('figure.illus img, .lesson-cards img').forEach(function (img) {
    function missing() {
      var box = document.createElement('div');
      box.className = 'img-missing';
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', img.alt || 'Иллюстрация');
      var id = (img.getAttribute('src') || '').split('/').pop().replace(/(-800)?\.jpg$/, '');
      box.innerHTML = '<span>Иллюстрация будет добавлена</span><code></code><span class="d"></span>';
      box.querySelector('code').textContent = id;
      box.querySelector('.d').textContent = img.alt || '';
      img.replaceWith(box);
    }
    if (img.complete && img.naturalWidth === 0) missing();
    else img.addEventListener('error', missing, { once: true });
  });

  /* ---- Ответы: сохранение в браузере ---- */
  var article = document.querySelector('article.lesson');
  var status = document.querySelector('.save-status');
  var page = article ? article.dataset.lesson : null;
  var timer, statusTimer;
  var pending = new Set();
  function flush() {
    clearTimeout(timer);
    pending.forEach(save);
    pending.clear();
  }

  function key(el) { return PREFIX + el.id; }
  function fields() {
    return article ? article.querySelectorAll('textarea[id], input[id]') : [];
  }
  function autosize(t) {
    t.style.height = 'auto';
    t.style.height = (t.scrollHeight + 2) + 'px';
  }
  function showStatus(text) {
    if (!status) return;
    status.textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { status.textContent = ''; }, 2500);
  }
  function save(el) {
    var ok = store(function (s) {
      if (el.type === 'checkbox' || el.type === 'radio') s.setItem(key(el), el.checked ? '1' : '0');
      else if (el.value === '' ) s.removeItem(key(el));
      else s.setItem(key(el), el.value);
      return true;
    });
    showStatus(ok ? 'Ответ сохранён в этом браузере' : 'Не удалось сохранить: хранилище браузера недоступно');
  }
  function updateOutput(el) {
    if (el.type !== 'range') return;
    var out = article.querySelector('output[for="' + el.id + '"]');
    if (out) out.textContent = el.value + '%';
  }

  if (article) {
    fields().forEach(function (el) {
      var v = store(function (s) { return s.getItem(key(el)); });
      if (v !== null) {
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = v === '1';
        else el.value = v;
      }
      updateOutput(el);
      if (el.tagName === 'TEXTAREA') autosize(el);
    });
    article.addEventListener('input', function (e) {
      var el = e.target;
      if (!el.id || !/^(TEXTAREA|INPUT)$/.test(el.tagName)) return;
      if (el.tagName === 'TEXTAREA') autosize(el);
      updateOutput(el);
      pending.add(el);
      clearTimeout(timer);
      timer = setTimeout(flush, 350);
    });
    // Не терять последний ввод: сохранить сразу при уходе из поля или со страницы
    article.addEventListener('focusout', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
    article.addEventListener('change', function (e) {
      var el = e.target;
      if (el.type === 'checkbox' || el.type === 'radio') save(el);
    });
    window.addEventListener('resize', function () {
      article.querySelectorAll('textarea').forEach(autosize);
    });
  }

  var clearBtn = document.querySelector('[data-action="clear"]');
  if (clearBtn && article) {
    clearBtn.addEventListener('click', function () {
      if (!window.confirm('Удалить все твои ответы в этом уроке? Это действие нельзя отменить.')) return;
      clearTimeout(timer); pending.clear();
      fields().forEach(function (el) {
        store(function (s) { s.removeItem(key(el)); });
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
        else if (el.type === 'range') el.value = el.defaultValue;
        else el.value = '';
        updateOutput(el);
        if (el.tagName === 'TEXTAREA') autosize(el);
      });
      showStatus('Ответы урока удалены');
    });
  }
  var printBtn = document.querySelector('[data-action="print"]');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  window.addEventListener('beforeprint', function () {
    if (article) article.querySelectorAll('textarea').forEach(autosize);
  });

  /* ---- Оглавление: подсветка текущего раздела ---- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var first = null;
      tocLinks.forEach(function (a) {
        var id = a.getAttribute('href').slice(1);
        if (!first && visible[id]) first = a;
      });
      if (first) tocLinks.forEach(function (a) {
        a.classList.toggle('active', a === first);
        if (a === first) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-15% 0px -55% 0px' });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }
  // На телефоне оглавление свёрнуто
  var tocDetails = document.querySelector('.toc details');
  if (tocDetails && window.matchMedia('(max-width: 960px)').matches) tocDetails.open = false;

  /* ---- Кнопка «наверх» ---- */
  var toTop = document.querySelector('.to-top');
  if (toTop) {
    window.addEventListener('scroll', function () {
      toTop.classList.toggle('show', window.scrollY > 900);
    }, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0 });
      var h = document.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    });
  }

  /* ---- Главная: прогресс по урокам ---- */
  document.querySelectorAll('[data-progress]').forEach(function (el) {
    var n = el.getAttribute('data-progress'), filled = 0;
    store(function (s) {
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k.indexOf(PREFIX + 'l' + n + '-') === 0 && s.getItem(k) && s.getItem(k) !== '0') filled++;
      }
    });
    if (filled) el.textContent = 'Заполнено ответов: ' + filled;
  });
})();
