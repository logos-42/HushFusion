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
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:8898').replace(/\/$/, '');
const PAGES = ['index.html', 'about.html', 'hibs.html', 'progress.html', 'docs.html'];
// 截图目录:默认写仓库(本地验收的证据),可用 SHOT_DIR 指到别处 ——
// 部署脚本的「线上复验」必须指到临时目录,否则会把线上渲染覆盖掉本地证据,
// 每部署一次工作树就脏一次(还分不清是代码变了还是截图变了)。
const SHOT_DIR = process.env.SHOT_DIR || path.join(process.cwd(), 'docs', 'screenshots');
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

/* ── 改名纪律(文件级,与浏览器无关)────────────────────────────────────
   公开页改过名之后,老链接不能直接 404:CF Pages 会把 /theory.html 308 到 /theory,
   而那个文件已经不存在 —— 必须靠根目录 `_redirects` 落回现名。
   历史页名写死在这里而不是去查 git:门不该依赖本机仓库状态(浅克隆/无 git 就假红)。 */
const HISTORIC_PAGES = ['theory.html', 'theory'];
{
  const redPath = path.join(process.cwd(), '_redirects');
  const rules = existsSync(redPath)
    ? readFileSync(redPath, 'utf8').split('\n').map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/))
    : [];
  for (const old of HISTORIC_PAGES) {
    const rule = rules.find((r) => r[0] === '/' + old || r[0] === old);
    const target = rule ? String(rule[1]).replace(/^\//, '') : null;
    check('_redirects', `历史页名 ${old} 仍能落到现存页`,
      !!rule && !!target && existsSync(path.join(process.cwd(), target)),
      rule ? `→ ${rule[1]}` : '没有 _redirects 条目(老链接会 404)');
  }
  /* 改名纪律(二):文件叫 docs.html,导航标签就得是「文档 / Docs」——
     改了文件名却留着旧标签,读者得自己在两套名字之间翻译。 */
  const badLabel = [];
  for (const f of PAGES) {
    const html = readFileSync(path.join(process.cwd(), f), 'utf8');
    for (const tag of html.match(/<a href="docs\.html"[^>]*>/g) || []) {
      const zh = (tag.match(/data-zh="([^"]*)"/) || [])[1] || '';
      const en = (tag.match(/data-en="([^"]*)"/) || [])[1] || '';
      if (!zh.includes('文档') || !/Docs/i.test(en)) badLabel.push(`${f}: ${zh}/${en}`);
    }
  }
  {
    const d = readFileSync(path.join(process.cwd(), 'docs.html'), 'utf8');
    if (!/<h1[^>]*data-zh="文档"/.test(d)) badLabel.push('docs.html: h1 的 data-zh 不是「文档」');
    if (!/<title>文档/.test(d)) badLabel.push('docs.html: <title> 没跟着改');
  }
  check('_label', '指向 docs.html 的标签是「文档 / Docs」(文件名改了标签也要改)',
    badLabel.length === 0, badLabel.join(' | '));

  const deploySrc = readFileSync(path.join(process.cwd(), 'scripts', 'deploy.sh'), 'utf8');
  /* 不变量:跑「线上复验」那一行必须带着 SHOT_DIR(临时目录怎么造的不归门管)。
     第一版把临时目录的写法写死成 `$(mktemp`,部署脚本换个写法就假红 —— 门自己坏了。 */
  const livePassLine = deploySrc.split('\n').find((l) => /verify-site\.mjs\s+"?https/.test(l)) || '';
  check('_redirects', '线上复验的截图不会覆盖仓库证据(那一行带着 SHOT_DIR)',
    /SHOT_DIR=\S*\s+node\s+scripts\/verify-site\.mjs/.test(livePassLine),
    livePassLine ? `线上复验那一行: ${livePassLine.trim()}` : 'deploy.sh 里找不到线上复验那一行');
  check('_redirects', '部署脚本会把它一起上传', /_redirects/.test(deploySrc),
    'deploy.sh 没带 _redirects —— 文件存在也是空话');
  check('_redirects', '_redirects 存在', rules.length > 0, `${rules.length} 条规则`);
}

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  return null;
}


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

  /* 4 底色就是 --bg 令牌(双主题下都成立:验的是「页面用令牌」而不是某个写死的值) */
  const bgTok = await evaluate(sessionId, `(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const probe = document.createElement('span');
    probe.style.color = v; document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color; probe.remove();
    return { body: getComputedStyle(document.body).backgroundColor, token: resolved };
  })()`);
  check(page, '底色 = --bg 令牌', bgTok.body === bgTok.token, JSON.stringify(bgTok));

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
        // 文档区里没被切到的那几册按设计不揭示(藏在 [hidden] 里,滚不到),
        // 所以这一项只验「当前可见的册」—— 切换后新册的内容由 9.2 单独验。
        .filter(el => !el.closest('.doc-pane[hidden]'))
        .filter(el => parseFloat(getComputedStyle(el).opacity) < 0.9)
        .map(el => el.className);
      if (!pending.length) break;
      await new Promise(r => setTimeout(r, 200));
    }
    document.documentElement.style.scrollBehavior = prev;
    return { ok: pending.length === 0, pending, waited: Date.now() - t0 };
  })()`);
  check(page, '揭示动画后内容可见', reveal.ok === true, (reveal.pending || []).join(' | '));

  /* 7.4 目录栏分栏:宽屏进左侧空白,窄一个像素就退回上下堆叠(账本数会变,断言不许写死) ──
     这一栏是「挪进容器左边那块空白」—— 所以两边都要验:宽屏必须真的并排且不越界,
     阈值以下必须干脆退回堆叠(而不是挤成一团)。 */
  const WIDE = 1680, NARROW = 1560;
  const railProbe = `(() => {
    const docs = document.querySelector('.docs');
    const led = document.querySelector('.doc-ledgers'), toc = document.querySelector('.doc-toc');
    const pane = document.querySelector('.doc-pane:not([hidden])');
    const r = (el) => { const b = el.getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; };
    const gap = parseFloat(getComputedStyle(docs).columnGap) || 0;
    const L = r(led), T = r(toc), D = r(docs), P = r(pane);
    return { vw: window.innerWidth, led: L, toc: T, pane: P, docs: D, gap,
             sideBySide: L.r <= T.l + 1, stacked: L.b <= T.t + 1,
             dug: Math.round(T.l - D.l), expectDug: Math.round(L.w + gap),
             label: document.querySelector('.doc-ledgers .toc-title')?.textContent.trim() || '',
             bilingual: (() => { const e = document.querySelector('.doc-ledgers .toc-title'); return !!(e && e.dataset.zh && e.dataset.en); })(),
             overflowX: document.documentElement.scrollWidth - window.innerWidth };
  })()`;
  if (page === 'docs.html') {
  for (const [w, mode] of [[WIDE, 'wide'], [NARROW, 'narrow']]) {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: w, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await sleep(420);
    const g = await evaluate(sessionId, railProbe);
    if (mode === 'wide') {
      check(page, `文档区:${w}px 目录栏成一栏且落在容器左侧空白里`,
        g.sideBySide && !g.stacked && g.led.l >= 8 && g.led.l < g.toc.l && g.led.r + 8 <= g.toc.l,
        JSON.stringify({ 栏: g.led, 目录: g.toc }));
      check(page, '文档区:分栏没有把「本页目录」和正文挪位(只往里挖了「栏宽 + 栏间距」)',
        Math.abs(g.dug - g.expectDug) <= 2 && g.pane.w > 0,
        `目录左移了 ${g.dug}px,应等于 栏宽+间距 ${g.expectDug}px`);
      /* 名字必须排一行:栏宽是算过的(最长「控制引力场的代数系统」= 10 字全角),
         字号一涨就会换行,而换行不会让别的门变红 —— 所以单立一条。 */
      const nameLines = await evaluate(sessionId, `(() => {
        const items = [...document.querySelectorAll('.doc-ledgers .doc-tab .doc-name')];
        if (!items.length) return { skip: true };
        const rows = items.map(el => { const lh = parseFloat(getComputedStyle(el).lineHeight) || 0;
          return { t: el.textContent.trim().slice(0, 12), 行数: lh ? Math.round(el.getBoundingClientRect().height / lh) : -1,
                   字号: parseFloat(getComputedStyle(el).fontSize) }; });
        return { rows, 换行的: rows.filter(r => r.行数 !== 1).map(r => r.t) };
      })()`);
      if (!nameLines.skip) {
        check(page, `文档区:目录栏每一项的名字都排一行(${nameLines.rows.length} 项)`,
          nameLines.换行的.length === 0, JSON.stringify(nameLines.换行的.length ? nameLines.换行的 : nameLines.rows));
      }

      check(page, '文档区:目录栏有自己的双语小标题',
        g.label.length > 0 && g.bilingual, JSON.stringify({ 标题: g.label, 双语: g.bilingual }));
    } else {
      check(page, `文档区:${w}px 退回上下堆叠(不做半吊子挤压)`, g.stacked && !g.sideBySide,
        JSON.stringify({ 栏: g.led, 目录: g.toc }));
    }
    check(page, `文档区:${w}px 分栏后无横向溢出`, g.overflowX <= 1, `溢出 ${g.overflowX}px`);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await sleep(300);
  }

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

  /* 9.2 文档区(侧边栏切换账本)。只在真有侧边栏的页面上跑 ——
     断言的是「单选 + 单面板可见 + 地址栏跟上 + 新册不是一片空白」,
     最后切回第一本,免得后面的全页截图停在第 03 册(那是个会骗人的假象)。 */
  const docTabCount = await evaluate(sessionId, 'document.querySelectorAll(".doc-tab").length');
  if (docTabCount > 1) {
    const docStructure = await evaluate(sessionId, `(() => {
      const tabs = [...document.querySelectorAll('.doc-tab')];
      const panes = [...document.querySelectorAll('.doc-pane')];
      return {
        tabs: tabs.length, panes: panes.length,
        selected: tabs.filter(t => t.getAttribute('aria-selected') === 'true').length,
        visible: panes.filter(p => !p.hasAttribute('hidden')).length,
        keyed: tabs.every(t => !!t.getAttribute('data-doc')) &&
               panes.every(p => !!p.getAttribute('data-doc-pane'))
      };
    })()`);
    check(page, `文档区:${docTabCount} 本账、单选、单面板可见`,
      docStructure.tabs === docTabCount && docStructure.panes === docTabCount &&
      docStructure.selected === 1 && docStructure.visible === 1 && docStructure.keyed === true,
      JSON.stringify(docStructure));

    /* 本页目录(Anchor Navigation):项数 = 当前册小节数,且每个锚点都能落到元素上 */
    const shownPaneExpr = `[...document.querySelectorAll('.doc-pane')].filter(p => !p.hasAttribute('hidden'))[0]`;
    const secsExpr = `(pane => [...pane.querySelectorAll('section.band[id]')].filter(s => {
      const h = s.querySelector('h2'); return h && !h.classList.contains('display');
    }))(${shownPaneExpr})`;
    const tocProbe = await evaluate(sessionId, `(() => {
      const secs = ${secsExpr};
      const links = [...document.querySelectorAll('.toc-link')];
      return { secs: secs.length, links: links.length,
               dangling: links.filter(a => !document.getElementById(a.getAttribute('href').slice(1)))
                              .map(a => a.getAttribute('href')) };
    })()`);
    check(page, '文档区:本页目录项数 = 当前册小节数,锚点无悬空',
      tocProbe.links > 0 && tocProbe.links === tocProbe.secs && tocProbe.dangling.length === 0,
      JSON.stringify(tocProbe));

    /* 滚动高亮(Scroll Spy):滚到当前册第三节,该项应亮 */
    const spyProbe = await evaluate(sessionId, `(async () => {
      const secs = ${secsExpr};
      const target = secs[Math.min(2, secs.length - 1)];
      // 页面开了 scroll-behavior: smooth —— 不关掉的话这一跳要动画几百毫秒,
      // 量到的会是「半路」那一节(这正是第一次跑出来的假失败)。
      const prev = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 8);
      await new Promise(r => setTimeout(r, 420));
      const active = [...document.querySelectorAll('.toc-link.is-active')].map(a => a.getAttribute('href'));
      document.documentElement.style.scrollBehavior = prev;
      return { want: '#' + target.id, active, n: active.length };
    })()`);
    check(page, '文档区:滚动高亮跟到当前小节',
      spyProbe.n === 1 && spyProbe.active[0] === spyProbe.want, JSON.stringify(spyProbe));

    /* 上一本 / 下一本(Prev / Next Navigation):本册末尾有指向邻册的入口,点了真的换册 */
    const pagerProbe = await evaluate(sessionId, `(() => {
      const pane = ${shownPaneExpr};
      const links = [...pane.querySelectorAll('.doc-pager .pager-link')];
      return { n: links.length, hrefs: links.map(a => a.getAttribute('href')),
               last: pane.lastElementChild && pane.lastElementChild.className };
    })()`);
    check(page, '文档区:册末有上一本/下一本',
      pagerProbe.n >= 1 && pagerProbe.hrefs.every(h => /^#doc-/.test(h)) &&
      pagerProbe.last === 'doc-pager', JSON.stringify(pagerProbe));

    const pagerJump = await evaluate(sessionId, `(async () => {
      const pane = ${shownPaneExpr};
      const link = pane.querySelector('.doc-pager .pager-next') || pane.querySelector('.doc-pager .pager-link');
      const want = link.getAttribute('href').slice(1);
      link.click();
      await new Promise(r => setTimeout(r, 500));
      const shown = [...document.querySelectorAll('.doc-pane')].filter(p => !p.hasAttribute('hidden'))[0];
      return { want, got: shown ? shown.getAttribute('data-doc-pane') : '' };
    })()`);
    check(page, '文档区:点「下一本」真的换册',
      pagerJump.got === pagerJump.want, JSON.stringify(pagerJump));

    /* 记住上一次读的那一本(Navigation Persistence) */
    const docPersist = await evaluate(sessionId, `(() => {
      const shown = [...document.querySelectorAll('.doc-pane')].filter(p => !p.hasAttribute('hidden'))[0];
      return { id: shown ? shown.getAttribute('data-doc-pane') : '', saved: localStorage.getItem('hushfusion-doc') };
    })()`);
    check(page, '文档区:记住当前册',
      docPersist.saved === docPersist.id && !!docPersist.id, JSON.stringify(docPersist));

    const lastIdx = docTabCount - 1;
    await evaluate(sessionId, `document.querySelectorAll('.doc-tab')[${lastIdx}].click()`);
    /* 揭示(reveal)是动画,时长不写死:轮询到 opacity≈1 再判,超时才红。
       曾经写死 sleep(900) 直接量 —— 页面加长到四本账之后量到 0.61 的中间态(假失败)。 */
    const docSwitchExpr = `(() => {
      const shown = [...document.querySelectorAll('.doc-pane')].filter(p => !p.hasAttribute('hidden'));
      const first = shown.length ? shown[0].querySelector('.reveal') : null;
      return {
        visible: shown.length,
        id: shown.length ? shown[0].getAttribute('data-doc-pane') : '',
        selected: document.querySelectorAll('.doc-tab[aria-selected="true"]').length,
        hash: location.hash,
        height: shown.length ? Math.round(shown[0].getBoundingClientRect().height) : 0,
        firstOpacity: first ? parseFloat(getComputedStyle(first).opacity) : -1,
        toc: document.querySelectorAll('.toc-link').length
      };
    })()`;
    let docSwitch = null;
    for (let i = 0; i < 12; i++) {
      docSwitch = await evaluate(sessionId, docSwitchExpr);
      if (docSwitch.firstOpacity >= 0.9) break;
      await sleep(250);
    }
    check(page, '文档区:切到最后一本,只露一册且地址栏跟上',
      docSwitch.visible === 1 && docSwitch.selected === 1 &&
      docSwitch.hash === '#' + docSwitch.id, JSON.stringify(docSwitch));
    check(page, '文档区:新册真的显示出来(不是一片空白)',
      docSwitch.height > 200 && docSwitch.firstOpacity >= 0.9,
      `height=${docSwitch.height} firstOpacity=${docSwitch.firstOpacity}`);
    check(page, '文档区:目录跟着册重建(每本账小节不同)',
      docSwitch.toc > 0 && docSwitch.toc !== tocProbe.links,
      `第 1 本 ${tocProbe.links} 项 → 最后一本 ${docSwitch.toc} 项`);

    await evaluate(sessionId, `document.querySelectorAll('.doc-tab')[0].click()`);
    await sleep(200);
    const docBack = await evaluate(sessionId, `(() => {
      const shown = [...document.querySelectorAll('.doc-pane')].filter(p => !p.hasAttribute('hidden'));
      return { id: shown.length ? shown[0].getAttribute('data-doc-pane') : '', n: shown.length };
    })()`);
    check(page, '文档区:切回第一本(默认态)',
      docBack.n === 1 && docBack.id === 'doc-gravity-control', JSON.stringify(docBack));
  }

  /* 9.1 主题切换:夜 → 昼 → 夜(颜色真的换、选择真的存、按钮跟着走) */
  const t0 = await evaluate(sessionId, `(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    btn: !!document.querySelector('[data-theme-toggle]')
  }))()`);
  check(page, '默认夜模式(html 无 data-theme)', t0.theme === null, JSON.stringify(t0));
  check(page, '顶栏有主题切换按钮', t0.btn === true);
  await evaluate(sessionId, `document.querySelector('[data-theme-toggle]').click()`);
  await sleep(220);
  const t1 = await evaluate(sessionId, `(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    return { theme: document.documentElement.getAttribute('data-theme'),
             bg: getComputedStyle(document.body).backgroundColor,
             stored: (function(){ try { return localStorage.getItem('hushfusion-theme'); } catch(e){ return null; } })(),
             glyph: (document.querySelector('.theme-glyph') || {}).textContent,
             meta: meta ? meta.getAttribute('content') : null };
  })()`);
  check(page, '切到昼间:data-theme=light', t1.theme === 'light', JSON.stringify(t1));
  check(page, '切到昼间:底色真的变亮', t1.bg !== t0.bg, `${t0.bg} → ${t1.bg}`);
  check(page, '昼间选择写进 localStorage', t1.stored === 'light', String(t1.stored));
  check(page, 'theme-color 跟着换', t1.meta === '#C9DDD5', String(t1.meta));
  await evaluate(sessionId, `document.querySelector('[data-theme-toggle]').click()`);
  await sleep(220);
  const t2 = await evaluate(sessionId, `(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    stored: (function(){ try { return localStorage.getItem('hushfusion-theme'); } catch(e){ return null; } })()
  }))()`);
  check(page, '切回夜模式(属性撤掉、底色复原、选择记住)',
        t2.theme === null && t2.bg === t0.bg && t2.stored === 'dark', JSON.stringify(t2));

  /* 9.2 浏览器图标也跟着主题换(昼间要用浅底那套) */
  const iconsNow = await evaluate(sessionId, `(() => ({
    favicon: (document.querySelector('[data-icon="favicon"]') || {}).getAttribute
              ? document.querySelector('[data-icon="favicon"]').getAttribute('href') : null,
    apple: document.querySelector('[data-icon="apple"]') ? document.querySelector('[data-icon="apple"]').getAttribute('href') : null
  }))()`);
  check(page, '夜模式用深底图标', /favicon-32\.png$/.test(iconsNow.favicon || '') &&
        /apple-touch-icon\.png$/.test(iconsNow.apple || ''), JSON.stringify(iconsNow));
  await evaluate(sessionId, `document.querySelector('[data-theme-toggle]').click()`);
  await sleep(200);
  const iconsDay = await evaluate(sessionId, `(() => ({
    favicon: document.querySelector('[data-icon="favicon"]').getAttribute('href'),
    apple: document.querySelector('[data-icon="apple"]').getAttribute('href')
  }))()`);
  check(page, '昼模式换浅底图标', /favicon-32--day\.png$/.test(iconsDay.favicon) &&
        /apple-touch-icon--day\.png$/.test(iconsDay.apple), JSON.stringify(iconsDay));
  const iconFiles = await evaluate(sessionId, `(async () => {
    const urls = ['icons/favicon-32.png', 'icons/favicon-32--day.png',
                  'icons/apple-touch-icon.png', 'icons/apple-touch-icon--day.png'];
    const out = {};
    for (const u of urls) { try { out[u] = (await fetch(u)).status; } catch (e) { out[u] = 'ERR'; } }
    return out;
  })()`);
  check(page, '两套图标文件都在(夜/昼各一对)',
        Object.values(iconFiles).every((v) => v === 200), JSON.stringify(iconFiles));
  await evaluate(sessionId, `document.querySelector('[data-theme-toggle]').click()`);
  await sleep(200);

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

  /* 10.1 文档区在窄屏的「被裁掉」检查:页面级 scrollWidth 是 0 也照样可能被裁 ——
     只要某个块比视口宽,body 的 overflow-x 就把它切掉,而文档本身不滚。
     所以量的是块自己的右边缘,而且**每本账都要量**:第一次只量了当时露着的那一本
     (01 册的表最窄),结果把门开成了空的 —— 反向验过:把 CSS 改回 `1fr` 它也照样绿。
     表格的横滑框(.table-wrap)算在内:它比视口宽同样是裁。 */
  const docNarrowAll = await evaluate(sessionId, `(async () => {
    const tabs = [...document.querySelectorAll('.doc-tab')];
    if (!tabs.length) return { skip: true };
    const rows = [];
    for (const tab of tabs) {
      tab.click();
      await new Promise(r => setTimeout(r, 320));
      const shown = [...document.querySelectorAll('.doc-pane')].filter(p => !p.hasAttribute('hidden'))[0];
      const blocks = [shown, ...shown.querySelectorAll('.plate, .fig-grid, .cap-list, .spec-list, .table-wrap, .doc-pager')];
      const over = blocks.filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
        .map(el => el.tagName + '.' + String(el.className || '').split(' ')[0]);
      rows.push({ id: shown.getAttribute('data-doc-pane'),
                  paneW: Math.round(shown.getBoundingClientRect().width),
                  over: over.slice(0, 4) });
    }
    tabs[0].click();
    await new Promise(r => setTimeout(r, 320));
    return { vw: window.innerWidth, rows };
  })()`);
  if (!docNarrowAll.skip) {
    const bad = docNarrowAll.rows.filter(r => r.over.length || r.paneW > docNarrowAll.vw);
    check(page, '文档区:账本在窄屏都没被裁',
      bad.length === 0, JSON.stringify(bad.length ? bad : docNarrowAll.rows));
  }

  /* 10.2 窄屏标签条是横向可滑的:选中的那一本可能在屏幕外(深链直达时必然如此)——
     门要问的是「滚进来没有」,不是「有条没有」。 */
  const stripProbe = await evaluate(sessionId, `(async () => {
    const tabs = [...document.querySelectorAll('.doc-tab')];
    if (tabs.length < 2) return { skip: true };
    const strip = tabs[0].parentNode;
    if (strip.scrollWidth <= strip.clientWidth + 4) return { skip: true };
    const last = tabs[tabs.length - 1];
    last.click();
    await new Promise(r => setTimeout(r, 360));
    const sr = strip.getBoundingClientRect(), tr = last.getBoundingClientRect();
    const out = { 选中: last.querySelector('.doc-name').textContent.trim(),
                  scrollLeft: Math.round(strip.scrollLeft),
                  在可视区: tr.left >= sr.left - 1 && tr.right <= sr.right + 1,
                  标签右缘: Math.round(tr.right), 条右缘: Math.round(sr.right) };
    tabs[0].click();
    await new Promise(r => setTimeout(r, 320));
    return out;
  })()`);
  if (!stripProbe.skip) {
    check(page, '文档区:窄屏横条把选中的那一本滚进可视区',
      stripProbe.在可视区 === true, JSON.stringify(stripProbe));
  }

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

  const mq = await evaluate(sessionId, `(() => {
    const m = document.querySelector('.cap-marquee');
    const t = document.querySelector('.cap-marquee-track');
    if (!m || !t) return { missing: true };
    const half = t.getBoundingClientRect().width / 2;
    return { groups: t.children.length, half: Math.round(half),
             view: Math.round(m.clientWidth), ok: half >= m.clientWidth - 1 };
  })()`);
  if (!mq.missing) {
    check(page, '滚动栏每半程 ≥ 视口宽(无缝、不漏白)', mq.ok === true, JSON.stringify(mq));
  }

  // 宽屏才是原来看得最清楚的情况(1920 下每半程只有 1240 就会空出 680px)
  if (!mq.missing) {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1920, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
    await sleep(420);
    const mq1920 = await evaluate(sessionId, `(() => {
      const m = document.querySelector('.cap-marquee');
      const t = document.querySelector('.cap-marquee-track');
      const half = t.getBoundingClientRect().width / 2;
      return { groups: t.children.length, half: Math.round(half),
               view: Math.round(m.clientWidth), ok: half >= m.clientWidth - 1 };
    })()`);
    check(page, '滚动栏 1920px 每半程 ≥ 视口宽', mq1920.ok === true, JSON.stringify(mq1920));
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await sleep(200);
  }

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

/* ── 文档区深链:单独一趟导航(放在截图之后,免得改掉别的页面状态) ──────
   ① #doc-moire 应直接落在第 03 册;② 链到 01 册内部的小节(#boolean)
   应自动切回 01 册 —— 否则从别处分享过来的小节链接会落在一片空白上。 */
{
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

  const probe = `(() => {
    const shown = [...document.querySelectorAll('.doc-pane')].filter(p => !p.hasAttribute('hidden'));
    return { n: shown.length, id: shown.length ? shown[0].getAttribute('data-doc-pane') : '',
             selected: document.querySelectorAll('.doc-tab[aria-selected="true"]').length,
             hash: location.hash };
  })()`;

  const deepLoaded = cdp.waitFor('Page.loadEventFired', sessionId);
  await cdp.send('Page.navigate', { url: `${BASE}/docs.html#doc-moire` }, sessionId);
  await deepLoaded;
  await sleep(420);
  const deep = await evaluate(sessionId, probe);
  check('docs.html', '文档区:深链 #doc-moire 直达第 03 册',
    deep.n === 1 && deep.id === 'doc-moire' && deep.selected === 1, JSON.stringify(deep));

  /* 新增的第 04 本账也必须「有自己的地址」—— 深链直达它。
     带 query 才是**真加载**:只换哈希属同文档导航,浏览器不会把焦点交给片段目标,
     那样测「深链不画焦点框」就测了个寂寞(第一次就是这么假失败的)。 */
  const deepNewLoad = cdp.waitFor('Page.loadEventFired', sessionId);
  await cdp.send('Page.navigate', { url: `${BASE}/docs.html?deep=1#doc-phonon` }, sessionId);
  await deepNewLoad;
  await sleep(700);
  const deepNew = await evaluate(sessionId, probe);
  check('docs.html', '文档区:深链 #doc-phonon 直达第 04 册(新账本自己也有地址)',
    deepNew.n === 1 && deepNew.id === 'doc-phonon' && deepNew.selected === 1, JSON.stringify(deepNew));

  /* 焦点框:片段导航会把面板程序聚焦,但不该给它画框(浏览器把片段导航也算 focus-visible);
     真的按 Tab 进来时必须看得见 —— 两条是一对,只测一条的话「把框全关掉」也能过。 */
  const ringOf = `(e => { const c = getComputedStyle(e);
    return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0; })`;
  const ringDeep = await evaluate(sessionId, `(() => {
    const p = [...document.querySelectorAll('.doc-pane')].filter(x => !x.hasAttribute('hidden'))[0];
    return { 焦点在面板上: document.activeElement === p, 画了框: ${ringOf}(p),
             焦点元素: document.activeElement.tagName + '.' + document.activeElement.className.slice(0, 30) };
  })()`);
  // 前置条件单列一条:浏览器把焦点交给片段目标,是这条链的上游。它要是变了,
  // 下面那条「不画框」会自动变绿(无焦点自然无框)—— 所以必须先把前置点亮出来。
  check('docs.html', '文档区:深链后焦点落在面板上(前置:浏览器把焦点交给片段目标)',
    ringDeep.焦点在面板上 === true, JSON.stringify(ringDeep));
  check('docs.html', '文档区:深链不画焦点框',
    ringDeep.画了框 === false, JSON.stringify(ringDeep));
  await cdp.send('Input.dispatchKeyEvent',
    { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, sessionId);
  await cdp.send('Input.dispatchKeyEvent',
    { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, sessionId);
  const ringKb = await evaluate(sessionId, `(async () => {
    const p = [...document.querySelectorAll('.doc-pane')].filter(x => !x.hasAttribute('hidden'))[0];
    p.focus();
    await new Promise(r => setTimeout(r, 80));
    return { focused: document.activeElement === p, ring: ${ringOf}(p) };
  })()`);
  check('docs.html', '文档区:键盘 Tab 进来时焦点框看得见',
    ringKb.focused === true && ringKb.ring === true, JSON.stringify(ringKb));

  // 同文档换 hash 不会再触发 load —— 用 hashchange + 等一拍
  await cdp.send('Page.navigate', { url: `${BASE}/docs.html#boolean` }, sessionId);
  await sleep(520);
  const section = await evaluate(sessionId, probe);
  check('docs.html', '文档区:链到 01 册内小节自动切回 01 册',
    section.n === 1 && section.id === 'doc-gravity-control', JSON.stringify(section));

  /* 记住上一次读的那一本(Navigation Persistence):点第 03 册 → **去掉哈希重开** → 还在第 03 册。
     这条要用带 query 的 URL 打开,否则只换/去哈希属同文档导航,根本不会重新加载 —— 那样测个寂寞。 */
  await evaluate(sessionId, `document.querySelectorAll('.doc-tab')[2].click()`);
  await sleep(500);
  const savedBefore = await evaluate(sessionId, `localStorage.getItem('hushfusion-doc')`);
  const reloaded = cdp.waitFor('Page.loadEventFired', sessionId);
  await cdp.send('Page.navigate', { url: `${BASE}/docs.html?remember=1` }, sessionId);
  await reloaded;
  await sleep(520);
  const remembered = await evaluate(sessionId, probe);
  check('docs.html', `文档区:记住上一次读的那一本(云端无哈希也落对)`,
    savedBefore === 'doc-moire' && remembered.n === 1 && remembered.id === 'doc-moire',
    `saved=${savedBefore} ${JSON.stringify(remembered)}`);

  await cdp.send('Target.closeTarget', { targetId });
}

/* ── 汇总 ───────────────────────────────────────────────────────────── */
console.log(`\n通过 ${passed} 项,失败 ${failures.length} 项`);
if (failures.length) {
  console.log('\n失败明细:');
  failures.forEach((f) => console.log('  - ' + f));
}
console.log(`全页截图 → ${SHOT_DIR}${process.env.SHOT_DIR ? '(临时目录,不覆盖仓库证据)' : ''}`);

ws.close();
child.kill();
await sleep(400);
try { rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 }); }
catch (e) { /* Chrome 可能还在写临时目录,不影响验收结论 */ }
process.exit(failures.length ? 1 : 0);
