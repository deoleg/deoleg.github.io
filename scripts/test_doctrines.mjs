#!/usr/bin/env node
/*
 * Browser tests for the History of Christian Doctrine site (doctrines/).
 * No npm packages: a tiny static server + headless Chrome driven over the
 * DevTools protocol with Node's built-in WebSocket (Node 22+).
 *
 * Usage:
 *   node scripts/test_doctrines.mjs
 *   CHROME_PATH=/path/to/chrome node scripts/test_doctrines.mjs
 *
 * Exit code 1 if any check fails.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (typeof WebSocket === 'undefined') {
  console.error('Нужен Node.js 22 или новее (встроенный WebSocket).');
  process.exit(1);
}

/* ---------- static server ---------- */
function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

/* ---------- chrome ---------- */
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'
  ].filter(Boolean);
  for (const c of candidates) {
    if (c.includes('/')) { if (existsSync(c)) return c; continue; }
    try { return execFileSync('which', [c]).toString().trim(); } catch { /* next */ }
  }
  throw new Error('Chrome не найден. Укажите путь в CHROME_PATH.');
}

async function startChrome() {
  const profile = await mkdtemp(path.join(tmpdir(), 'hcd-test-'));
  const proc = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--no-sandbox', 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('Chrome не запустился за 20 с')), 20000);
    proc.stderr.on('data', d => {
      buf += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (m) { clearTimeout(t); resolve(m[1]); }
    });
  });
  const port = new URL(wsUrl).port;
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find(t => t.type === 'page');
    if (!target) await sleep(100);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  const close = async () => { ws.close(); proc.kill(); await sleep(200); await rm(profile, { recursive: true, force: true }).catch(() => {}); };
  return { send, errors, close };
}

/* ---------- test helpers ---------- */
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  const DATA = path.join(ROOT, 'doctrines/data/doctrines.json');
  const sha = async () => createHash('sha256').update(await readFile(DATA)).digest('hex');
  const hashBefore = await sha();
  const data = JSON.parse(await readFile(DATA, 'utf8'));
  const { meta, items } = data;
  const total = items.length;
  const norm = s => String(s || '').normalize('NFC').toLowerCase().replace(/ё/g, 'е').replace(/[’ʼ᾽]/g, "'");

  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/doctrines/`;
  const chrome = await startChrome();
  const { send } = chrome;

  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'evaluate failed');
    return r.result.result.value;
  };
  const waitFor = async (expr, ms = 5000) => {
    for (let i = 0; i < ms / 50; i++) { if (await ev(expr).catch(() => false)) return true; await sleep(50); }
    return false;
  };
  const open = async (url, width = 1280, height = 900) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(50);
    await send('Page.navigate', { url });
    await sleep(150);
    await waitFor(`document.readyState === 'complete' && (document.documentElement.classList.contains('is-ready') || !!document.querySelector('.load-error'))`, 10000);
    await sleep(150);
  };
  const key = async (k, extra = {}) => {
    const codes = { Tab: 9, Enter: 13, Escape: 27 };
    const p = { key: k, code: k, windowsVirtualKeyCode: codes[k], ...extra };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...p, ...(k === 'Enter' ? { text: '\r' } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p });
    await sleep(60);
  };
  const count = sel => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
  const tlCount = () => count('#tlResults .entry');
  const setHash = async h => { await ev(`location.hash = ${JSON.stringify(h)}`); await sleep(120); };

  // expected filter result, mirrors the app's rules
  const expectFilter = ({ d = [], t = [], e = [], i = 1, s = false, q = '' }, lang = 'ru') => {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    return items.filter(it => {
      if (d.length && !(d.includes(it.doctrine) || (s && it.doctrines_secondary.some(x => d.includes(x))))) return false;
      if (t.length && !t.includes(it.type)) return false;
      if (e.length && !e.includes(it.era)) return false;
      if (it.importance < i) return false;
      if (!toks.length) return true;
      const parts = [it['title_' + lang], it['summary_' + lang], it['outcome_' + lang], it['place_' + lang], it['date_note_' + lang], it['date_label_' + lang],
        ...it['key_points_' + lang], ...it['people_' + lang], ...it['texts_' + lang]];
      for (const p of it.positions) parts.push(p['who_' + lang], p['view_' + lang]);
      for (const k of it.key_terms) parts.push(k['term_' + lang], k.original);
      const hay = norm(parts.filter(Boolean).join('\n'));
      return toks.every(tk => hay.includes(tk));
    }).length;
  };

  try {
    /* ---------- 1. matrix and timeline show everything ---------- */
    await open(base + '?lang=ru');
    check('матрица: 12 строк × 8 эпох', await count('.matrix tbody tr') === meta.doctrines.length && await count('.matrix thead .mx-era') === meta.eras.length);
    const cellSum = await ev(`[...document.querySelectorAll('.mx-btn .mx-n')].reduce((s, n) => s + parseInt(n.firstChild.textContent, 10), 0)`);
    const dotSum = await count('.mx-btn .dot:not(.sec)');
    const footSum = await ev(`[...document.querySelectorAll('.mx-foot')].reduce((s, n) => s + +n.textContent, 0)`);
    check('сумма по ячейкам матрицы = 236', cellSum === total && dotSum === total && footSum === total, `числа ${cellSum}, точки ${dotSum}, итог ${footSum}`);
    const perCell = await ev(`[...document.querySelectorAll('.mx-btn')].map(b => [b.dataset.cell, b.querySelectorAll('.dot:not(.sec)').length])`);
    const cellOk = perCell.every(([c, n]) => { const [d, e] = c.split('|'); return items.filter(it => it.doctrine === d && it.era === e).length === n; });
    check('каждая ячейка содержит свои записи', cellOk && perCell.length === new Set(items.map(it => it.doctrine + '|' + it.era)).size, `${perCell.length} ячеек`);
    check('размер точки по важности', await ev(`(() => { const s = n => document.querySelector('.mx-btn .dot.imp-' + n)?.getBoundingClientRect().width; return s(3) > s(2) && s(2) > s(1); })()`));
    await ev(`document.getElementById('mxSecondary').click()`); await sleep(100);
    const secDots = await count('.mx-btn .dot.sec');
    const expSec = items.reduce((n, it) => n + it.doctrines_secondary.filter(x => x !== it.doctrine).length, 0);
    check('флажок «смежные» добавляет обведённые точки', secDots === expSec, `${secDots} из ${expSec}`);
    await ev(`document.getElementById('mxSecondary').click()`); await sleep(100);

    await setHash('#timeline');
    check('хронология без фильтров: 236 записей', await tlCount() === total && (await ev(`document.getElementById('tlCount').textContent`)).includes(`${total} из ${total}`));

    /* ---------- 2. filters and search, both languages ---------- */
    const cases = [
      [{ d: ['trinity', 'christology'] }, 'd=trinity,christology'],
      [{ d: ['trinity', 'christology'], s: true }, 'd=trinity,christology&s=1'],
      [{ t: ['definition'] }, 't=definition'],
      [{ e: ['patristic'] }, 'e=patristic'],
      [{ i: 3 }, 'i=3'],
      [{ d: ['trinity', 'christology'], t: ['definition'], e: ['patristic'], i: 3 }, 'd=trinity,christology&t=definition&e=patristic&i=3'],
      [{ d: ['church'], e: ['reformation', '20c'], i: 2 }, 'd=church&e=reformation,20c&i=2'],
      [{ q: 'никея' }, 'q=никея'],
      [{ d: ['trinity'], q: 'никея' }, 'd=trinity&q=' + encodeURIComponent('никея')]
    ];
    for (const lang of ['ru', 'en']) {
      await open(base + `?lang=${lang}#timeline`);
      const bad = [];
      for (const [f, qs] of cases) {
        if (lang === 'en' && f.q) continue;
        await setHash('#timeline?' + qs);
        const got = await tlCount(), want = expectFilter(f, lang);
        if (got !== want) bad.push(`${qs}: ${got}≠${want}`);
      }
      check(`фильтры из URL (${lang})`, bad.length === 0, bad.join('; '));
    }

    await open(base + '?lang=ru#timeline');
    await ev(`document.querySelector('#tlFilters').open = true;
      document.querySelector('input[data-f="d"][value="trinity"]').click();
      document.querySelector('input[data-f="t"][value="definition"]').click();
      document.querySelector('input[name="tlImp"][value="3"]').click()`);
    await sleep(100);
    const uiGot = await tlCount(), uiWant = expectFilter({ d: ['trinity'], t: ['definition'], i: 3 });
    const hashNow = await ev('location.hash');
    check('фильтры через интерфейс + URL', uiGot === uiWant && hashNow === '#timeline?d=trinity&t=definition&i=3', `${uiGot}/${uiWant} ${hashNow}`);
    await open(base + '?lang=ru' + hashNow);
    check('фильтры восстанавливаются после перезагрузки', await tlCount() === uiWant && await ev(`document.querySelector('input[data-f="d"][value="trinity"]').checked`));
    await ev(`document.getElementById('tlReset').click()`); await sleep(100);
    check('«Сбросить фильтры»', await tlCount() === total && await ev('location.hash') === '#timeline');

    const typeSearch = async q => { await ev(`(() => { const s = document.getElementById('tlSearch'); s.value = ${JSON.stringify(q)}; s.dispatchEvent(new Event('input')); })()`); await sleep(350); return tlCount(); };
    const pairs = [['Никея', 'никея'], ['пресуществление', 'ПРЕСУЩЕСТВЛЁНИЕ'], ['Ансельм', 'аНСЕЛЬМ'], ['Пётр', 'петр']];
    for (const [a, b] of pairs) {
      const x = await typeSearch(a), y = await typeSearch(b), want = expectFilter({ q: a });
      check(`поиск «${a}» = «${b}»`, x > 0 && x === y && x === want, `${x} / ${y} / ожидалось ${want}`);
    }
    await typeSearch('Ансельм');
    check('совпадения подсвечены', await count('#tlResults mark') > 0);
    const gr = await typeSearch('ὁμοούσιος');
    check('поиск по греческому «ὁμοούσιος»', gr > 0 && gr === expectFilter({ q: 'ὁμοούσιος' }), String(gr));
    check('счётчик в aria-live', await ev(`document.getElementById('tlCount').getAttribute('aria-live')`) === 'polite');
    await typeSearch('zzzqqq');
    check('сообщение «ничего не найдено»', await ev(`!document.getElementById('tlEmpty').hidden`) && await tlCount() === 0);
    await open(base + '?lang=en#timeline');
    const en = await typeSearch('nicaea');
    check('поиск на английском', en > 0 && en === expectFilter({ q: 'nicaea' }, 'en'), String(en));

    /* ---------- 3. every link resolves ---------- */
    // Chrome throttles >200 hash changes in 10 s, so walk in chunks on fresh pages.
    const CHUNK = 60;
    const badItems = [];
    for (let st = 0; st < total; st += CHUNK) {
      await open(base + '?lang=ru');
      badItems.push(...await ev(`(async () => {
        const d = await (await fetch('data/doctrines.json')).json(), bad = [];
        const inc = {};
        for (const it of d.items) for (const r of it.related) (inc[r.id] ||= []).push(it.id);
        const gl = new Set(d.meta.glossary.map(g => g.id)), ids = new Set(d.items.map(i => i.id));
        for (const it of d.items.slice(${st}, ${st + CHUNK})) {
          location.hash = '#item/' + it.id;
          for (let k = 0; k < 100 && document.getElementById('panelTitle')?.textContent !== it.title_ru; k++) await new Promise(r => setTimeout(r, 10));
          const p = document.getElementById('panel');
          if (!p.open || document.getElementById('panelTitle').textContent !== it.title_ru) { bad.push(it.id + ': не открылась'); continue; }
          const rel = [...p.querySelectorAll('.rel-list-full a.rel-link')].map(a => decodeURIComponent(a.getAttribute('href').slice(6)));
          const want = it.related.length + (inc[it.id] || []).length;
          if (rel.length !== want || rel.some(x => !ids.has(x))) bad.push(it.id + ': связи ' + rel.length + '≠' + want);
          const terms = [...p.querySelectorAll('a.term-link')].map(a => decodeURIComponent(a.getAttribute('href').slice(10)));
          if (terms.length !== it.key_terms.filter(k => k.glossary_id).length || terms.some(x => !gl.has(x))) bad.push(it.id + ': термины');
          if (p.querySelectorAll('.sources li').length !== it.sources.length) bad.push(it.id + ': источники');
          if (!!p.querySelector('.date-note') !== !!it.date_note_ru) bad.push(it.id + ': дата');
          if (p.querySelectorAll('.pos').length !== it.positions.length) bad.push(it.id + ': позиции');
        }
        return bad;
      })()`));
    }
    check('каждый #item/<id> открывает карточку со всеми связями, терминами и источниками', badItems.length === 0, badItems.slice(0, 4).join('; '));

    await open(base + '?lang=ru');
    const badDocs = await ev(`(async () => {
      const d = await (await fetch('data/doctrines.json')).json(), bad = [];
      for (const doc of d.meta.doctrines) {
        location.hash = '#doctrine/' + doc.id;
        for (let k = 0; k < 100 && document.getElementById('viewTitle')?.textContent !== doc.ru; k++) await new Promise(r => setTimeout(r, 10));
        if (document.getElementById('viewTitle')?.textContent !== doc.ru) { bad.push(doc.id); continue; }
        const n = d.items.filter(i => i.doctrine === doc.id).length;
        if (document.querySelectorAll('.tl .entry').length !== n) bad.push(doc.id + ': записи');
        const tp = [...document.querySelectorAll('.tp-card')].map(a => decodeURIComponent(a.getAttribute('href').slice(6)));
        if (tp.length !== doc.turning_points.length || tp.some(x => !doc.turning_points.includes(x))) bad.push(doc.id + ': повороты');
        const order = tp.map(x => d.items.findIndex(i => i.id === x));
        if (order.some((v, i) => i && v < order[i - 1])) bad.push(doc.id + ': порядок поворотов');
        document.getElementById('docSecondary').click();
        await new Promise(r => setTimeout(r, 20));
        const sec = d.items.filter(i => i.doctrine !== doc.id && i.doctrines_secondary.includes(doc.id)).length;
        if (document.querySelectorAll('.tl .entry.is-secondary').length !== sec || document.querySelectorAll('.tl .entry').length !== n + sec) bad.push(doc.id + ': смежные');
      }
      return bad;
    })()`);
    check('каждый #doctrine/<id>: записи, повороты, смежные', badDocs.length === 0, badDocs.join('; '));

    const gl = meta.glossary.map(g => g.id);
    const badGl = [];
    for (let st = 0; st < gl.length; st += 150) {
      await open(base + '?lang=ru#glossary');
      badGl.push(...await ev(`(async () => {
        const ids = ${JSON.stringify(gl)}.slice(${st}, ${st + 150}), bad = [];
        for (const id of ids) {
          location.hash = '#glossary/' + id;
          for (let k = 0; k < 100 && document.querySelector('.term.is-target')?.id !== 'term-' + id; k++) await new Promise(r => setTimeout(r, 5));
          if (document.querySelector('.term.is-target')?.id !== 'term-' + id) bad.push(id);
        }
        return bad;
      })()`));
    }
    check('каждый #glossary/<id> подсвечивает термин', badGl.length === 0, badGl.slice(0, 4).join(', '));
    await open(base + '?lang=ru#glossary');
    check('глоссарий: все термины', await count('.term') === meta.glossary.length);
    const allRefs = await ev(`[...document.querySelectorAll('.term-refs a')].length`);
    check('глоссарий: ссылки на записи', allRefs === meta.glossary.reduce((n, g) => n + g.items.length, 0), String(allRefs));
    await ev(`(() => { const s = document.getElementById('glSearch'); s.value = 'ὁμοούσιος'; s.dispatchEvent(new Event('input')); })()`); await sleep(300);
    check('поиск по глоссарию (оригинал)', await count('.term') >= 1 && (await ev(`document.querySelector('.term .orig')?.textContent`)).includes('ὁμοούσιος'));
    const font = await ev(`getComputedStyle(document.querySelector('.term .orig')).fontFamily`);
    check('оригинал набран шрифтом с греческим', /Noto Serif/.test(font), font);

    await open(base + '?lang=ru#item/no-such-entry');
    check('несуществующий id: «Запись не найдена»', await ev(`document.getElementById('panelTitle').textContent`) === 'Запись не найдена.' && await count('.matrix') === 1);

    /* ---------- 4. panel behaviour, history ---------- */
    await open(base + '?lang=ru');
    await ev(`document.querySelector('.mx-btn').click()`); await sleep(100);
    await ev(`document.querySelector('.row-link').focus(); document.querySelector('.row-link').click()`); await sleep(200);
    check('карточка открывается поверх матрицы', await ev(`document.getElementById('panel').open && !!document.querySelector('.matrix')`));
    const first = await ev(`location.hash`);
    await ev(`document.getElementById('panelNext').click()`); await sleep(200);
    const second = await ev('location.hash');
    check('кнопка «Следующая»', second !== first && second.startsWith('#item/'));
    await ev('history.back()'); await sleep(300);
    check('«назад» закрывает карточку после «Следующей»', await ev(`!document.getElementById('panel').open`) && ['', '#/'].includes(await ev('location.hash')), await ev('location.hash'));
    await ev('history.forward()'); await sleep(300);
    check('«вперёд» снова открывает карточку', await ev(`document.getElementById('panel').open`));
    await ev(`document.querySelector('.rel-list-full a.rel-link')?.click()`); await sleep(200);
    await ev(`document.getElementById('panelClose').click()`); await sleep(300);
    check('крестик закрывает карточку после перехода по связи', await ev(`!document.getElementById('panel').open`) && ['', '#/'].includes(await ev('location.hash')));
    await setHash('#item/' + items[5].id);
    await ev(`(() => { const p = document.getElementById('panel'); p.dispatchEvent(new MouseEvent('click', { bubbles: true })); })()`); await sleep(300);
    check('клик по фону закрывает карточку', await ev(`!document.getElementById('panel').open`));
    await open(base + '?lang=ru#doctrine/trinity');
    await setHash('#item/' + items.find(i => i.doctrine === 'trinity').id);
    check('карточка поверх линии учения', await ev(`document.getElementById('panel').open && !!document.querySelector('.view-doctrine')`));
    await ev(`document.querySelector('#panelBody .chip')?.click()`); await sleep(300);
    check('чип человека ведёт в хронологию с поиском', (await ev('location.hash')).startsWith('#timeline?q=') && await ev(`!document.getElementById('panel').open`) && await tlCount() > 0);

    /* ---------- 5. keyboard ---------- */
    await open(base + '?lang=ru');
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) { await key('Tab'); reached = await ev(`document.activeElement.classList.contains('mx-btn')`); }
    check('Tab доходит до ячейки матрицы', reached);
    await key('Enter'); await sleep(100);
    check('Enter раскрывает ячейку (aria-expanded)', await ev(`document.activeElement.getAttribute('aria-expanded') === 'true' && !document.getElementById('mxList').hidden`));
    let onRow = false;
    for (let i = 0; i < 120 && !onRow; i++) { await key('Tab'); onRow = await ev(`document.activeElement.classList.contains('row-link')`); }
    const rowHref = await ev(`document.activeElement.getAttribute('href')`);
    await key('Enter'); await sleep(300);
    check('Enter на записи открывает карточку', onRow && await ev(`document.getElementById('panel').open`) && await ev('location.hash') === rowHref);
    check('фокус внутри панели', await ev(`document.getElementById('panel').contains(document.activeElement)`));
    let inside = true;
    for (let i = 0; i < 60; i++) { await key('Tab'); if (!(await ev(`document.getElementById('panel').contains(document.activeElement) || document.activeElement === document.body`))) { inside = false; break; } }
    check('Tab не выходит за панель', inside);
    await key('Escape'); await sleep(300);
    check('Esc закрывает, фокус возвращается', await ev(`!document.getElementById('panel').open`) && await ev(`document.activeElement.getAttribute('href')`) === rowHref);

    /* ---------- 6. language, theme, storage ---------- */
    await open(base);
    await ev(`document.querySelector('#langSwitch [data-lang="en"]').click()`); await sleep(150);
    const enOk = await ev(`document.documentElement.lang === 'en' && document.querySelector('#siteNav a').textContent === 'Matrix' && document.getElementById('viewTitle').textContent === 'Doctrines by era' && document.querySelector('.mx-doc a').textContent.includes(${JSON.stringify(meta.doctrines[0].en)})`);
    check('EN меняет интерфейс и данные', enOk);
    await ev(`document.getElementById('themeToggle').click()`);
    const th = await ev('document.documentElement.dataset.theme');
    await open(base);
    check('язык и тема сохраняются после перезагрузки', await ev(`document.documentElement.lang`) === 'en' && await ev('document.documentElement.dataset.theme') === th, th);
    const bgDark = await ev(`getComputedStyle(document.body).backgroundColor`);
    await ev(`document.getElementById('themeToggle').click()`);
    await ev(`document.querySelector('#langSwitch [data-lang="ru"]').click()`);
    check('тема меняет фон', bgDark !== await ev(`getComputedStyle(document.body).backgroundColor`));
    await open(base + '?lang=en#item/' + items[0].id);
    check('?lang=en и карточка на английском', await ev(`document.getElementById('panelTitle').textContent`) === items[0].title_en && /p\./.test(await ev(`document.querySelector('.sources').textContent`)) && !(await ev(`document.querySelector('.sources').textContent`)).includes('стр.'));
    await open(base + '?lang=ru');
    const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });` }).then(r => r.result);
    await open(base);
    check('без localStorage сайт работает (RU)', await count('.mx-btn') > 0 && await ev('document.documentElement.lang') === 'ru');
    await ev(`document.querySelector('#langSwitch [data-lang="en"]').click()`); await sleep(100);
    check('без localStorage язык переключается', await ev('document.documentElement.lang') === 'en');
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });

    /* ---------- 7. no horizontal scroll at 375 / 360 ---------- */
    const screens = ['#/', '#doctrine/christology?s=1', '#timeline', '#glossary', '#about', '#item/' + items.find(i => i.positions.length >= 5).id];
    const wide = [];
    for (const w of [375, 360]) for (const lang of ['ru', 'en']) for (const h of screens) {
      await open(base + `?lang=${lang}${h}`, w, 780);
      if (h === '#/') { await ev(`document.querySelector('.mx-btn').click()`); await sleep(100); }
      if (h === '#timeline') { await ev(`document.getElementById('tlFilters').open = true`); await sleep(100); }
      const sw = await ev('document.documentElement.scrollWidth');
      if (sw > w) wide.push(`${w}/${lang}${h}: ${sw}`);
    }
    check('нет горизонтальной прокрутки на 375 и 360 px', wide.length === 0, wide.join('; '));
    await open(base + '?lang=ru', 375, 780);
    check('матрица прокручивается внутри контейнера', await ev(`(() => { const s = document.querySelector('.mx-scroll'); return s.scrollWidth > s.clientWidth; })()`));
    await ev(`document.querySelector('.mx-scroll').scrollLeft = 300`);
    check('первый столбец липкий', await ev(`Math.round(document.querySelector('.mx-doc').getBoundingClientRect().left) === Math.round(document.querySelector('.mx-scroll').getBoundingClientRect().left) + 1`));
    await open(base + '?lang=ru#item/' + items[0].id, 375, 780);
    check('карточка на мобильном – во весь экран', await ev(`Math.round(document.getElementById('panel').getBoundingClientRect().width)`) === 375);

    check('нет ошибок в консоли', chrome.errors.length === 0, chrome.errors.slice(0, 2).join(' | '));

    /* ---------- 8. file:// ---------- */
    await open('file://' + path.join(ROOT, 'doctrines/index.html'));
    await waitFor(`!!document.querySelector('.load-error')`, 3000);
    const fileMsg = await ev(`document.querySelector('.load-error')?.textContent || ''`);
    check('file:// показывает сообщение на двух языках', fileMsg.includes('python3 -m http.server') && fileMsg.includes('Откройте') && fileMsg.includes('Open the site'));
  } catch (err) {
    check('тест завершился без исключений', false, err.message);
  } finally {
    await chrome.close();
    server.close();
  }

  const hashAfter = await sha();
  check('data/doctrines.json не изменён', hashBefore === hashAfter, hashAfter.slice(0, 16));

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed} из ${results.length} проверок пройдено`);
  process.exit(failed ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
