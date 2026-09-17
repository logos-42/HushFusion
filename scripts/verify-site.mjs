#!/usr/bin/env node
/* ============================================================================
   HUSHFUSION · 真浏览器验收(零依赖)
   ---------------------------------------------------------------------------
   只用 Node 内置 WebSocket 驱动本机 headless Chrome(CDP),不装任何 npm 包。
   为什么不能只靠命令行抓 HTML:滚动揭示让内容初始 opacity:0,
   命令行 dump 到的可能是一片空白,必须让真浏览器滚一遍再看。

   用法:
     node scripts/verify-site.mjs                        # 默认 http://127.0.0.1:8898
     node scripts/verify-site.mjs http://127.0.0.1:8080
   退出码:全部通过 0;有失败 1。
   ========================================================================== */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:8898').replace(/\/$/, '');
const PAGES = ['index.html', 'about.html', 'hibs.html', 'progress.html'];
const SHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
const PORT = 9333 + Math.floor(Math.random() * 500);

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  process.env.CHROME_PATH,
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  return null;
}

/* ── 极简 CDP 客户端 ─────────────────────────────────────────────────── */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.waiters = [];
    this.collectors = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`))
                  : resolve(msg.result);
      } else if (msg.method) {
        this.waiters = this.waiters.filter((w) => {
          if (w.method === msg.method && (!w.sessionId || w.sessionId === msg.sessionId)) {
            w.resolve(msg.params); return false;
          }
          return true;
        });
        for (const c of this.collectors) c(msg);
      }
    };
  }
  /** 注册一个消息收集器,返回注销函数(每个页面用完必须注销,否则会串台) */
  collect(fn) {
    this.collectors.push(fn);
    return () => { this.collectors = this.collectors.filter((f) => f !== fn); };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id);
        reject(new Error(`CDP 超时: ${method}`)); } }, 30000);
    });
  }
  waitFor(method, sessionId, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const w = { method, sessionId, resolve };
      this.waiters.push(w);
      setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w);
        reject(new Error(`等待事件超时: ${method}`));
      }, timeout);
    });
  }
}

/* ── 启动 ───────────────────────────────────────────────────────────── */
const chromePath = findChrome();
if (!chromePath) {
  console.error('找不到 Chrome/Chromium,无法做真浏览器验收。可用 CHROME_PATH 指定。');
  process.exit(2);
}

const profile = path.join(tmpdir(), `hushfusion-verify-${Date.now()}`);
const child = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--disable-extensions', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  await sleep(250);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl;
  } catch { /* 还没起来 */ }
}
if (!wsUrl) {
  child.kill();
  console.error('Chrome 没能在 15s 内打开调试端口。');
  process.exit(2);
}

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const cdp = new CDP(ws);

let passed = 0;
const failures = [];

function check(page, name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${page} · ${name}`); }
  else { failures.push(`${page} · ${name}${detail ? ' — ' + detail : ''}`);
         console.log(`  ✗ ${page} · ${name} ${detail}`); }
}

async function evaluate(sessionId, expression) {
  const r = await cdp.send('Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'JS 异常');
  return r.result.value;
}

mkdirSync(SHOT_DIR, { recursive: true });
console.log(`\nHUSHFUSION 真浏览器验收 → ${BASE}\nChrome: ${chromePath}\n`);

for (const page of PAGES) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const consoleErrors = [];
  const failedRequests = [];

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId).catch(() => {});
  await cdp.send('Network.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

  const stopCollect = cdp.collect((m) => {
    if (m.sessionId && m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (m.method === 'Network.loadingFailed') failedRequests.push(m.params.errorText);
  });

  const loaded = cdp.waitFor('Page.loadEventFired', sessionId);
  await cdp.send('Page.navigate', { url: `${BASE}/${page}` }, sessionId);
  await loaded;
  await sleep(350);

  /* 1 标题 */
  const title = await evaluate(sessionId, 'document.title');
  check(page, '标题非空', typeof title === 'string' && title.trim().length > 3, title);

  /* 2 每页恰好一个 h1 */
  const h1 = await evaluate(sessionId, 'document.querySelectorAll("h1").length');
  check(page, '恰好一个 h1', h1 === 1, `实际 ${h1}`);

  /* 3 图片全部加载成功 */
  const imgs = await evaluate(sessionId, `(() => {
    const list = [...document.images];
    return { total: list.length,
             broken: list.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')) };
  })()`);
  check(page, `图片全部加载 (${imgs.total} 张)`, imgs.broken.length === 0, imgs.broken.join(', '));

  /* 4 设计令牌生效(底色 == #080F1A) */
  const bg = await evaluate(sessionId, 'getComputedStyle(document.body).backgroundColor');
  check(page, '底色令牌生效 #080F1A', bg === 'rgb(8, 15, 26)', bg);

  /* 5 无横向滚动条 */
  const overflow = await evaluate(sessionId,
    'document.documentElement.scrollWidth - window.innerWidth');
  check(page, '无横向溢出', overflow <= 1, `溢出 ${overflow}px`);

  /* 6 缓存破坏参数存在 */
  const v = await evaluate(sessionId,
    `(() => { const l = [...document.querySelectorAll('link[rel=stylesheet]')].map(x => x.getAttribute('href'));
              const s = [...document.querySelectorAll('script[src]')].map(x => x.getAttribute('src'));
              return { css: l, js: s }; })()`);
  const cssOk = v.css.every((h) => /\?v=\d+/.test(h || ''));
  const jsOk = v.js.every((h) => /\?v=\d+/.test(h || ''));
  check(page, 'style.css 带 ?v=N', cssOk, v.css.join(','));
  check(page, 'app.js 带 ?v=N', jsOk, v.js.join(','));

  /* 7 滚动后揭示元素全部可见
     注意:站点开了 scroll-behavior: smooth,测试必须先关掉,否则 scrollTo 是
     动画滚动、会被下一次调用打断,页面根本走不到底部 —— 那是测试的坑,不是站的坑。*/
  const reveal = await evaluate(sessionId, `(async () => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 300) {
      window.scrollTo(0, y);
      void document.body.getBoundingClientRect();
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    const t0 = Date.now();
    let pending = [];
    while (Date.now() - t0 < 4000) {
      pending = [...document.querySelectorAll('.reveal')]
        .filter(el => parseFloat(getComputedStyle(el).opacity) < 0.9)
        .map(el => el.className);
      if (!pending.length) break;
      await new Promise(r => setTimeout(r, 200));
    }
    document.documentElement.style.scrollBehavior = prev;
    return { ok: pending.length === 0, pending, waited: Date.now() - t0 };
  })()`);
  check(page, '揭示动画后内容可见', reveal.ok === true, (reveal.pending || []).join(' | '));

  /* 8 语言切换真的改变文案 */
  const norm = 'document.querySelector("[data-zh][data-en]").textContent.replace(/\\s+/g, " ").trim()';
  const langBefore = await evaluate(sessionId, norm);
  await evaluate(sessionId, `(() => { const b = document.querySelector('[data-lang-btn="en"]');
    if (b) b.click(); return true; })()`);
  await sleep(180);
  const langAfter = await evaluate(sessionId, norm);
  check(page, 'EN 切换改变文案', langAfter !== langBefore, `"${langBefore.slice(0,16)}" → "${langAfter.slice(0,16)}"`);
  await evaluate(sessionId, `(() => { const b = document.querySelector('[data-lang-btn="zh"]');
    if (b) b.click(); return true; })()`);
  await sleep(120);
  const langBack = await evaluate(sessionId, norm);
  check(page, '切回中文恢复原文', langBack === langBefore);

  /* 9 标签框(有则测) */
  const tabCount = await evaluate(sessionId, 'document.querySelectorAll(".tab").length');
  if (tabCount > 1) {
    await evaluate(sessionId, 'document.querySelectorAll(".tab")[1].click()');
    await sleep(120);
    const active = await evaluate(sessionId, `(() => {
      const t = document.querySelectorAll('.tab')[1];
      const pane = document.querySelector('.pane[data-pane="' + t.dataset.pane + '"]');
      return t.classList.contains('is-active') && pane && pane.classList.contains('is-active');
    })()`);
    check(page, '标签切换生效', active === true);
    // 断言完切回第一个 tab —— 否则后面的全页截图会停在「第二个 tab 打开」的状态,
    // 截图就不再是页面的默认样子了(这是个会骗人的假象)。
    await evaluate(sessionId, 'document.querySelectorAll(".tab")[0].click()');
    await sleep(100);
  }

  /* 9.5 中间断点无溢出(注:900px 以下导航已折叠,这里验的是折叠态不溢出) */
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 860, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
  await sleep(220);
  const midOverflow = await evaluate(sessionId,
    'document.documentElement.scrollWidth - window.innerWidth');
  check(page, '中间断点 860px 无横向溢出', midOverflow <= 1, `溢出 ${midOverflow}px`);

  /* 10 移动端宽度无溢出 */
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
  await sleep(250);
  const mobOverflow = await evaluate(sessionId,
    'document.documentElement.scrollWidth - window.innerWidth');
  check(page, '移动端 390px 无横向溢出', mobOverflow <= 1, `溢出 ${mobOverflow}px`);

  /* 9.6 窄屏导航折叠:390px 汉堡出现 → 点开 → Esc 收起 */
  const nav390 = await evaluate(sessionId, `(() => {
    const t = document.querySelector('.nav-toggle'), l = document.querySelector('.mast-links');
    if (!t || !l) return { missing: true };
    return { toggle: getComputedStyle(t).display !== 'none',
             links: getComputedStyle(l).display !== 'none' };
  })()`);
  check(page, '移动端 390px 汉堡按钮出现', nav390.toggle === true, JSON.stringify(nav390));
  const row390 = await evaluate(sessionId, `(() => {
    const t = document.querySelector('.nav-toggle').getBoundingClientRect();
    const l = document.querySelector('.lang-toggle').getBoundingClientRect();
    const b = document.querySelector('.brand').getBoundingClientRect();
    return { dy: Math.round(Math.abs((t.top + t.height / 2) - (l.top + l.height / 2))),
             sideBySide: t.right <= l.left + 1,
             alignedWithBrand: Math.abs((t.top + t.height / 2) - (b.top + b.height / 2)) < 10 };
  })()`);
  check(page, '移动端 ≡ 与 中/EN 同一行(不再竖向堆叠)', row390.sideBySide === true,
        JSON.stringify(row390));
  check(page, '移动端 ≡ 与语言键垂直居中对齐', row390.dy <= 6 && row390.alignedWithBrand === true,
        JSON.stringify(row390));
  check(page, '移动端 390px 导航已折叠', nav390.links === false, JSON.stringify(nav390));

  if (page === 'index.html') {
    const s1 = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(`${SHOT_DIR}/nav-390.png`, Buffer.from(s1.data, 'base64'));
  }

  await evaluate(sessionId, 'document.querySelector(".nav-toggle").click()');
  await sleep(160);
  if (page === 'index.html') {
    const s2 = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(`${SHOT_DIR}/nav-390-open.png`, Buffer.from(s2.data, 'base64'));
  }
  const opened = await evaluate(sessionId, `(() => ({
    links: getComputedStyle(document.querySelector('.mast-links')).display !== 'none',
    aria: document.querySelector('.nav-toggle').getAttribute('aria-expanded'),
  }))()`);
  check(page, '移动端点开后菜单可见', opened.links === true, JSON.stringify(opened));
  check(page, '移动端 aria-expanded=true', opened.aria === 'true', String(opened.aria));

  await cdp.send('Input.dispatchKeyEvent',
    { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
  await cdp.send('Input.dispatchKeyEvent',
    { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
  await sleep(160);
  check(page, '移动端 Esc 收起菜单',
    await evaluate(sessionId,
      `getComputedStyle(document.querySelector('.mast-links')).display === 'none'`) === true);

  /* 9.7 两侧边界:1180px 仍横排且不溢出 / 860px 已折叠 */
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1180, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
  await sleep(220);
  const nav1180 = await evaluate(sessionId, `(() => {
    const t = document.querySelector('.nav-toggle'), l = document.querySelector('.mast-links');
    return { toggle: getComputedStyle(t).display !== 'none',
             links: getComputedStyle(l).display !== 'none',
             over: document.documentElement.scrollWidth - window.innerWidth };
  })()`);
  check(page, '1180px 导航横排未折叠', nav1180.links === true && nav1180.toggle === false,
        JSON.stringify(nav1180));
  check(page, '1180px 无横向溢出', nav1180.over <= 1, `溢出 ${nav1180.over}px`);

  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 860, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
  await sleep(200);
  const nav860 = await evaluate(sessionId, `(() => {
    const t = document.querySelector('.nav-toggle'), l = document.querySelector('.mast-links');
    return { toggle: getComputedStyle(t).display !== 'none',
             links: getComputedStyle(l).display !== 'none' };
  })()`);
  check(page, '860px 导航已折叠为汉堡', nav860.toggle === true && nav860.links === false,
        JSON.stringify(nav860));
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await sleep(240);

  /* 9.8 宽屏顶栏:横排 + 高度正常(折叠按钮不该在宽屏出现,否则会把顶栏顶高) */
  const nav1280 = await evaluate(sessionId, `(() => {
    const n = document.querySelector('.topnav');
    const t = document.querySelector('.nav-toggle');
    const l = document.querySelector('.mast-links');
    return { h: Math.round(n.getBoundingClientRect().height),
             toggle: getComputedStyle(t).display !== 'none',
             links: getComputedStyle(l).display !== 'none' };
  })()`);
  check(page, '1280px 导航横排未折叠', nav1280.links === true && nav1280.toggle === false,
        JSON.stringify(nav1280));
  check(page, '1280px 顶栏高度正常(≤80px)', nav1280.h <= 80, `${nav1280.h}px`);

  const activeNav = await evaluate(sessionId, `(() => {
    const norm = s => (s || '').split('#')[0].split('?')[0].split('/').pop().replace(/\.html$/, '');
    const act = Array.from(document.querySelectorAll('.mast-links a'))
      .filter(a => a.classList.contains('is-active'));
    return { count: act.length,
             active: act.length === 1 ? norm(act[0].getAttribute('href')) : null,
             here: norm(location.pathname) || 'index' };
  })()`);
  check(page, '当前页导航项唯一高亮(忽略 .html 路径差异)',
        activeNav.count === 1 && activeNav.active === activeNav.here, JSON.stringify(activeNav));

  /* 11 控制台无报错 / 无失败请求 */
  const realFailures = failedRequests.filter((t) => !/ERR_ABORTED/.test(t));
  check(page, '控制台无错误', consoleErrors.length === 0, consoleErrors.join(' | '));
  check(page, '无失败网络请求', realFailures.length === 0, realFailures.join(', '));

  /* ◆ 全页截图
     先模拟 prefers-reduced-motion: reduce —— 展示栏是无限滚动动画,
     不冻住的话每次截到哪一帧是随机的,截图 diff 会一直抖动(而且顺便验了降级路径)。*/
  await cdp.send('Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
  await sleep(250);

  /* ◆ 全页截图 */
  const metrics = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
  const size = metrics.cssContentSize || metrics.contentSize;
  const shot = await cdp.send('Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.min(size.width, 1440), height: size.height, scale: 1 } },
    sessionId);
  const file = path.join(SHOT_DIR, page.replace('.html', '.png'));
  writeFileSync(file, Buffer.from(shot.data, 'base64'));

  await cdp.send('Emulation.setEmulatedMedia', { features: [] }, sessionId);
  stopCollect();
  await cdp.send('Target.closeTarget', { targetId });
}

/* ── 汇总 ───────────────────────────────────────────────────────────── */
console.log(`\n通过 ${passed} 项,失败 ${failures.length} 项`);
if (failures.length) {
  console.log('\n失败明细:');
  failures.forEach((f) => console.log('  - ' + f));
}
console.log(`全页截图 → ${SHOT_DIR}`);

ws.close();
child.kill();
await sleep(400);
try { rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 }); }
catch (e) { /* Chrome 可能还在写临时目录,不影响验收结论 */ }
process.exit(failures.length ? 1 : 0);
