#!/usr/bin/env node
/*
 * Browser smoke tests for the History of Christianity timeline (history/).
 * No npm packages: a tiny static server + headless Chrome driven over the
 * DevTools protocol with Node's built-in WebSocket (Node 22+).
 *
 * Usage:
 *   node scripts/test_history.mjs
 *   CHROME_PATH=/path/to/chrome node scripts/test_history.mjs
 *
 * Exit code 1 if any check fails.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
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
  const profile = await mkdtemp(path.join(tmpdir(), 'hoc-test-'));
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
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/history/`;
  const chrome = await startChrome();
  const { send } = chrome;

  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'evaluate failed');
    return r.result.result.value;
  };
  const open = async (url, width = 1280, height = 900) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
    await send('Page.navigate', { url });
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      const ready = await ev(`document.readyState === 'complete' && document.querySelectorAll('.event').length > 0 || !!document.querySelector('.status.is-error')`).catch(() => false);
      if (ready) break;
    }
    await sleep(300);
  };
  const search = async q => { await ev(`(() => { const s = document.getElementById('search'); s.value = ${JSON.stringify(q)}; s.dispatchEvent(new Event('input')); })()`); await sleep(300); };
  const visible = () => ev(`[...document.querySelectorAll('.event')].filter(n => !n.hidden).length`);
  const data = JSON.parse(await readFile(path.join(ROOT, 'data/events.json'), 'utf8'));
  const total = data.events.length;

  try {
    // --- render ---
    await open(base + '?lang=ru');
    check('все события отрисованы', await ev(`document.querySelectorAll('.event').length`) === total, `${total}`);
    check('все эпохи на месте', await ev(`document.querySelectorAll('.era:not([hidden])').length`) === data.meta.eras.length);
    check('все книги в подвале', await ev(`document.querySelectorAll('#footerBooks li').length`) === data.meta.books.length);
    check('счётчик показывает все события', (await ev(`document.getElementById('counter').textContent`)).includes(String(total)));
    check('метки расхождений в датах', await ev(`document.querySelectorAll('.note-flag').length`) === data.events.filter(e => e.date_note_ru.trim()).length);

    // --- search ---
    await search('пётр'); const a = await visible();
    await search('ПЕТР'); const b = await visible();
    check('поиск без учёта регистра и ё/е', a > 0 && a === b, `${a} / ${b}`);
    check('совпадения подсвечены', await ev(`document.querySelectorAll('.event:not([hidden]) mark').length`) > 0);
    await search('');
    check('сброс поиска возвращает все события', await visible() === total);

    // --- filters + URL ---
    await ev(`document.querySelector('[data-cat="council"]').click(); document.querySelector('[data-imp="2"]').click()`);
    const filtered = await visible();
    const expected = data.events.filter(e => e.category === 'council' && e.importance >= 2).length;
    check('фильтр категории и важности', filtered === expected, `${filtered} из ${expected}`);
    const qs = await ev('location.search');
    check('фильтры записаны в URL', qs.includes('cat=council') && qs.includes('imp=2'), qs);
    await open(base + qs);
    check('фильтры восстанавливаются из URL', await visible() === expected);

    // --- English ---
    await open(base + '?lang=en');
    check('английский: <html lang>', await ev('document.documentElement.lang') === 'en');
    await search('luther');
    check('английский: поиск', await visible() > 0);

    // --- deep links, panel ---
    const first = data.events[0].id, second = data.events[1].id;
    await open(base + `?lang=ru#event/${first}`);
    check('#event/<id> открывает панель', await ev(`document.getElementById('panel').open`) === true);
    check('заголовок панели', await ev(`document.getElementById('panelTitle').textContent`) === data.events[0].title_ru);
    await ev(`document.getElementById('panelNext').click()`); await sleep(200);
    check('кнопка «следующее»', await ev('location.hash') === `#event/${second}`);
    const noteIds = await ev(`(async () => {
      const ids = ${JSON.stringify(data.events.filter(e => e.date_note_ru).map(e => e.id))}, bad = [];
      for (const id of ids) {
        location.hash = '#event/' + id;
        for (let k = 0; k < 50 && !document.getElementById('panelTitle'); k++) await new Promise(r => setTimeout(r, 10));
        await new Promise(r => setTimeout(r, 10));
        const t = document.querySelector('.date-note p')?.textContent || '';
        if (/[a-z]+_[a-z]+|\\b(lebedev|pelikan)\\d/i.test(t)) bad.push(id);
      }
      return bad;
    })()`);
    check('в примечаниях нет id книг', noteIds.length === 0, noteIds.slice(0, 3).join(', '));
    await open(base + `?lang=ru#event/council-nicaea-325`);
    check('связанные события в панели', await ev(`document.querySelectorAll('.related-link').length`) > 0);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(300);
    check('Esc закрывает панель и чистит хэш', await ev(`document.getElementById('panel').open`) === false && await ev('location.hash') === '');

    const era = data.meta.eras[6].id;
    await open(base + `#era/${era}`);
    await sleep(1200);
    // "+ 0" turns -0 into 0: CDP cannot return -0 by value
    const top = await ev(`Math.round(document.getElementById('era-${era}').getBoundingClientRect().top) + 0`);
    check('#era/<id> прокручивает к эпохе', Math.abs(top) <= 2, `top=${top}`);

    // --- summary text is preserved by paragraph splitting ---
    // Chrome ignores navigations after ~200 hash changes in 10 s ("Throttling navigation"),
    // so the events are walked in chunks, each on a freshly loaded page.
    const lost = [];
    const CHUNK = 120;
    for (let start = 0; start < total; start += CHUNK) {
      await open(base + '?lang=ru');
      lost.push(...await ev(`(async () => {
        const d = await (await fetch('../data/events.json')).json(), norm = s => s.replace(/\\s+/g, ' ').trim(), bad = [];
        for (const e of d.events.slice(${start}, ${start + CHUNK})) {
          location.hash = '#event/' + e.id;
          for (let k = 0; k < 100 && document.getElementById('panelTitle')?.textContent !== e.title_ru; k++) await new Promise(r => setTimeout(r, 10));
          const got = [...document.querySelectorAll('.panel-summary p')].map(p => p.textContent).join(' ');
          if (norm(got) !== norm(e.summary_ru)) bad.push(e.id);
        }
        return bad;
      })()`));
    }
    check('описания в панели выводятся полностью', lost.length === 0, lost.slice(0, 3).join(', '));

    // --- compact view ---
    await open(base + '?lang=ru');
    await ev(`document.getElementById('compactBtn').click()`);
    const exHidden = await ev(`getComputedStyle(document.querySelector('.event-excerpt')).display === 'none'`);
    await open(base + '?lang=ru');
    const kept = await ev(`document.body.classList.contains('is-compact')`);
    await ev(`document.getElementById('compactBtn').click()`);
    check('компактный режим скрывает описания и запоминается', exHidden && kept, `скрыто=${exHidden}, сохранено=${kept}`);

    // --- layout ---
    for (const w of [375, 360]) {
      await open(base + '?lang=ru', w, 780);
      await ev(`document.getElementById('filtersMore').open = true`);
      await sleep(200);
      const sw = await ev('document.documentElement.scrollWidth');
      check(`нет горизонтальной прокрутки на ${w} px`, sw <= w, `scrollWidth=${sw}`);
    }

    check('нет ошибок в консоли', chrome.errors.length === 0, chrome.errors.slice(0, 2).join(' | '));
  } catch (err) {
    check('тест завершился без исключений', false, err.message);
  } finally {
    await chrome.close();
    server.close();
  }

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed} из ${results.length} проверок пройдено`);
  process.exit(failed ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
