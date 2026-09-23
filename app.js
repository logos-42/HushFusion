/* ============================================================================
   HUSHFUSION · 交互(零依赖原生 JS)
   职责:语言切换(data-zh/data-en + localStorage) · 标签切换 · 文档区(侧栏三本账 +
        本页目录 + 滚动高亮 + 上一本/下一本) · 复制反馈 · 滚动揭示 · 移动端导航
   纪律:第一行加 .js;任何依赖 JS 的东西在没有 JS 时必须优雅退化
   ========================================================================== */
document.documentElement.classList.add('js');

(function () {
  'use strict';

  /* ── 语言切换 ───────────────────────────────────────────────────────── */
  var LANG_KEY = 'hushfusion-lang';
  var currentLang = 'zh';   // 仅供 JS 自己生成的提示语(投递表单状态)选语言用

  /* ── 白天 / 黑夜 ───────────────────────────────────────────────────── */
  // 默认夜;显式选择存 localStorage,<head> 的内联脚本负责在首帧之前定色。
  // 颜色全在 style.css 的令牌里(:root = 夜,[data-theme="light"] = 昼),这里只切属性。
  var THEME_KEY = 'hushfusion-theme';
  var THEME_META = document.querySelector('meta[name="theme-color"]');
  var THEME_COLOR = { dark: '#0E1E05', light: '#C9DDD5' };
  var themeBtns = document.querySelectorAll('[data-theme-toggle]');
  var THEME_TEXT = {
    dark:  { glyph: '☾', zh: '夜', en: 'Night', aria: { zh: '切换到白天模式', en: 'Switch to light mode' } },
    light: { glyph: '☀', zh: '日', en: 'Day',   aria: { zh: '切换到黑夜模式', en: 'Switch to dark mode' } }
  };

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  // 按钮显示当前模式;aria-label 说明点下去会切到哪(文案跟语言走)
  function syncThemeLabels() {
    var info = THEME_TEXT[currentTheme()];
    themeBtns.forEach(function (btn) {
      btn.setAttribute('aria-label', currentLang === 'en' ? info.aria.en : info.aria.zh);
      var g = btn.querySelector('.theme-glyph');
      if (g) g.textContent = info.glyph;
      var w = btn.querySelector('.theme-word');
      if (w) {
        w.setAttribute('data-zh', info.zh);
        w.setAttribute('data-en', info.en);
        w.textContent = currentLang === 'en' ? info.en : info.zh;
      }
    });
  }

  // 浏览器图标也跟着主题换:夜 = 深蓝底白波形(logo 原色)/ 昼 = 浅海蓝绿底深墨绿波形
  var ICON_SET = {
    dark:  { favicon: 'icons/favicon-32.png', apple: 'icons/apple-touch-icon.png' },
    light: { favicon: 'icons/favicon-32--day.png', apple: 'icons/apple-touch-icon--day.png' }
  };

  function applyIcons(mode) {
    var set = ICON_SET[mode] || ICON_SET.dark;
    document.querySelectorAll('[data-icon]').forEach(function (el) {
      var next = set[el.getAttribute('data-icon')];
      if (next && el.getAttribute('href') !== next) el.setAttribute('href', next);
    });
  }

  function applyTheme(mode) {
    if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) { /* 隐私模式忽略 */ }
    if (THEME_META) THEME_META.setAttribute('content', THEME_COLOR[mode]);
    syncThemeLabels();
    applyIcons(mode);
  }

  themeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
    });
  });
  syncThemeLabels();
  applyIcons(currentTheme());   // 首屏(主题已由 <head> 内联脚本定好)把图标对齐

  function applyLang(lang) {
    currentLang = lang === 'en' ? 'en' : 'zh';
    document.querySelectorAll('[data-zh][data-en]').forEach(function (el) {
      var value = el.getAttribute(lang === 'en' ? 'data-en' : 'data-zh');
      if (value === null) return;
      if (el.hasAttribute('data-html')) el.innerHTML = value;
      else el.textContent = value;
    });
    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang-btn') === lang);
    });
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* 隐私模式忽略 */ }
    syncThemeLabels();   // 主题按钮的文字/aria 也要跟着语言走
  }

  document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLang(btn.getAttribute('data-lang-btn'));
    });
  });

  var saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (e) { saved = null; }
  if (saved === 'en') applyLang('en');

  /* ── 标签框 ─────────────────────────────────────────────────────────── */
  document.querySelectorAll('[data-tabs]').forEach(function (box) {
    var tabs = box.querySelectorAll('.tab');
    var panes = box.querySelectorAll('.pane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panes.forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-pane') === tab.getAttribute('data-pane'));
        });
      });
    });
  });

  /* ── 复制反馈 ───────────────────────────────────────────────────────── */
  document.querySelectorAll('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-copy'));
      if (!target) return;
      var text = target.textContent.trim();
      var done = function () {
        var old = btn.textContent;
        btn.classList.add('is-copied');
        btn.textContent = '已复制';
        setTimeout(function () { btn.classList.remove('is-copied'); btn.textContent = old; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });

  /* ── 滚动展示栏补齐 ─────────────────────────────────────────────────── */
  // 轨道是 translateX(0 → -50%) 的无缝循环,前提是「两个完全相同的一半」各能铺满一屏。
  // 原始 5 个词只有 ~1240px,比 1280 视口还窄 —— 右边就露出一段空,屏越宽空得越多。
  // 这里按实际宽度克隆组数,保证半程 ≥ 视口宽。
  var marquee = document.querySelector('.cap-marquee');
  var mqTrack = marquee && marquee.querySelector('.cap-marquee-track');
  if (mqTrack && mqTrack.children.length) {
    var fillMarquee = function () {
      var base = mqTrack.children[0];
      // 先把上一次克隆的组清掉,只留第一组当样板
      while (mqTrack.children.length > 1) mqTrack.removeChild(mqTrack.lastChild);
      var unit = base.getBoundingClientRect().width;
      var view = marquee.clientWidth || window.innerWidth;
      if (!unit || !view) return;
      var perHalf = Math.max(1, Math.ceil(view / unit));
      for (var i = 0; i < perHalf * 2 - 1; i++) {
        var clone = base.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');   // 重复内容对读屏器隐藏
        mqTrack.appendChild(clone);
      }
    };
    fillMarquee();
    var mqTimer;
    window.addEventListener('resize', function () {
      clearTimeout(mqTimer); mqTimer = setTimeout(fillMarquee, 200);
    });
  }

  /* ── 移动端导航 ─────────────────────────────────────────────────────── */
  var topnav = document.querySelector('.topnav');
  var navToggle = document.querySelector('.nav-toggle');
  if (topnav && navToggle) {
    var setOpen = function (on) {
      topnav.classList.toggle('is-open', on);
      navToggle.setAttribute('aria-expanded', on ? 'true' : 'false');
    };
    navToggle.addEventListener('click', function () {
      setOpen(!topnav.classList.contains('is-open'));
    });
    Array.prototype.forEach.call(topnav.querySelectorAll('.mast-links a'), function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!topnav.contains(e.target)) setOpen(false);
    });
  }

  /* ── 滚动揭示 ───────────────────────────────────────────────────────── */
  var revealables = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ── 文档区切换(理论页:侧边栏 → 面板) ─────────────────────────────────
     一次切换要做三件事,少一件就出错:
       ① tab 的 aria-selected / 面板的 [hidden] 同步 —— 无障碍状态与显隐一致;
       ② 深链:每个面板有自己的 id,可以直接分享 #doc-moire;反向也成立 ——
          链到 01 册内部的小节(如 #boolean)时,自动切回它所属的那一册;
       ③ 补揭示:藏在 [hidden] 里的 .reveal 永远不与视口相交,不补这一步,
          切过去会是一片空白(opacity:0)—— 看着像内容没加载,其实是没触发。 */
  var docsBox = document.querySelector('[data-docs]');
  if (docsBox) {
    var docTabs = Array.prototype.slice.call(docsBox.querySelectorAll('.doc-tab'));
    var docPanes = Array.prototype.slice.call(docsBox.querySelectorAll('.doc-pane'));
    var docIds = docTabs.map(function (t) { return t.getAttribute('data-doc'); });

    // 记住上一次读的那一本(与主题 / 语言同一种 localStorage 口径)。
    // 地址栏里的 #doc-* 优先级更高 —— 别人分享的链接一定落在被分享的那一本。
    var DOC_KEY = 'hushfusion-doc';
    var savedDoc = null;
    try { savedDoc = localStorage.getItem(DOC_KEY); } catch (e) { savedDoc = null; }

    /* ── 本页目录(Anchor Navigation)+ 滚动高亮(Scroll Spy) ────────────
       目录不写死:从当前册带 id 的小节生成 —— 页面上加一节,目录自动多一项。
       高亮用「顶部刚越过阅读线的那一节」而不是 IntersectionObserver:
       多节同时可见时,相交回调里没有正确答案,比矩形反而更确定。 */
    var tocBox = docsBox.querySelector('[data-doc-toc]');
    var tocLinks = [];
    var tocSecs = [];

    var spyTick = function () {
      if (!tocSecs.length) return;
      var pick = tocSecs[0].id, best = -1e9;
      tocSecs.forEach(function (sec) {
        var top = sec.getBoundingClientRect().top;
        if (top <= 170 && top > best) { best = top; pick = sec.id; }
      });
      tocLinks.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + pick);
      });
    };

    var buildToc = function (pane) {
      tocLinks = []; tocSecs = [];
      if (!tocBox) return;
      tocBox.innerHTML = '';
      var secs = Array.prototype.slice.call(pane.querySelectorAll('section.band[id]'))
        .filter(function (sec) {
          var h = sec.querySelector('h2');
          return h && !h.classList.contains('display');   // 册标题本身不进目录
        });
      if (!secs.length) return;
      var title = document.createElement('p');
      title.className = 'toc-title';
      title.setAttribute('data-zh', '本页目录');
      title.setAttribute('data-en', 'On this page');
      title.textContent = currentLang === 'en' ? 'On this page' : '本页目录';
      var ul = document.createElement('ul');
      ul.className = 'toc-list';
      secs.forEach(function (sec) {
        var h = sec.querySelector('h2');
        var zh = h.getAttribute('data-zh') || h.textContent.trim();
        var en = h.getAttribute('data-en') || h.textContent.trim();
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.className = 'toc-link';
        a.href = '#' + sec.id;
        a.setAttribute('data-zh', zh);
        a.setAttribute('data-en', en);
        a.textContent = currentLang === 'en' ? en : zh;
        li.appendChild(a); ul.appendChild(li);
        tocLinks.push(a); tocSecs.push(sec);
      });
      tocBox.appendChild(title); tocBox.appendChild(ul);
      spyTick();
    };

    var spyQueued = false;
    window.addEventListener('scroll', function () {
      if (spyQueued) return;
      spyQueued = true;
      window.requestAnimationFrame(function () { spyQueued = false; spyTick(); });
    }, { passive: true });

    /* ── 上一本 / 下一本(Prev / Next Navigation) ───────────────────────
       由三本账的标签数据生成,放在每册末尾 —— 读到底不用回头找侧栏。 */
    docPanes.forEach(function (p) {
      var idx = docIds.indexOf(p.getAttribute('data-doc-pane'));
      if (idx < 0 || docIds.length < 2) return;
      var prevTab = idx > 0 ? docTabs[idx - 1] : null;
      var nextTab = idx < docTabs.length - 1 ? docTabs[idx + 1] : null;
      if (!prevTab && !nextTab) return;
      var nav = document.createElement('nav');
      nav.className = 'doc-pager';
      nav.setAttribute('aria-label', '相邻文档');
      var mk = function (tab, dir) {
        var name = tab.querySelector('.doc-name');
        var zh = name.getAttribute('data-zh') || name.textContent.trim();
        var en = name.getAttribute('data-en') || name.textContent.trim();
        var a = document.createElement('a');
        a.className = 'pager-link pager-' + dir;
        a.href = '#' + tab.getAttribute('data-doc');
        var d = document.createElement('span');
        d.className = 'pager-dir';
        var dzh = dir === 'prev' ? '← 上一本' : '下一本 →';
        var den = dir === 'prev' ? '← Previous' : 'Next →';
        d.setAttribute('data-zh', dzh); d.setAttribute('data-en', den);
        d.textContent = currentLang === 'en' ? den : dzh;
        var n = document.createElement('span');
        n.className = 'pager-name';
        n.setAttribute('data-zh', zh); n.setAttribute('data-en', en);
        n.textContent = currentLang === 'en' ? en : zh;
        a.appendChild(d); a.appendChild(n);
        return a;
      };
      if (prevTab) nav.appendChild(mk(prevTab, 'prev'));
      if (nextTab) nav.appendChild(mk(nextTab, 'next'));
      p.appendChild(nav);
    });

    var revealIn = function (pane) {
      var pending = Array.prototype.slice.call(pane.querySelectorAll('.reveal:not(.is-in)'));
      if (!pending.length) return;
      if (reduce || !('IntersectionObserver' in window)) {
        pending.forEach(function (el) { el.classList.add('is-in'); });
        return;
      }
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add('is-in'); io2.unobserve(entry.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
      pending.forEach(function (el) { io2.observe(el); });
    };

    /* 「这一下焦点是键盘来的,还是链接来的?」—— 浏览器把片段导航也算进 :focus-visible,
       所以面板被深链聚焦时会凭空画一圈框。这里自己记键盘标志,只给真键盘焦点画框。 */
    var kbFocus = false;
    document.addEventListener('keydown', function (e) { if (e.key === 'Tab') kbFocus = true; }, true);
    document.addEventListener('pointerdown', function () { kbFocus = false; }, true);
    document.addEventListener('focusin', function (e) {
      var el = e.target;
      if (el && el.classList && el.classList.contains('doc-pane')) el.classList.toggle('is-kb-focus', kbFocus);
    }, true);

    var showDoc = function (id, focusTab) {
      if (docIds.indexOf(id) < 0) return;
      try { localStorage.setItem(DOC_KEY, id); } catch (e) { /* 隐私模式忽略 */ }
      docIds.forEach(function (each) {
        var on = each === id;
        docTabs.forEach(function (t) {
          if (t.getAttribute('data-doc') !== each) return;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.classList.toggle('is-active', on);
          t.tabIndex = on ? 0 : -1;          // 单选标签:Tab 只停在选中项上
          if (on && focusTab) t.focus();
          // 窄屏标签条是横向可滑的,选中那一本可能在屏幕外(深链直达时必然如此)——
          // 把条滚到它身上,否则读者看不到「现在是哪一本」。桌面栏不横向滚,这段自然跳过。
          if (on && t.parentNode) {
            var strip = t.parentNode;
            if (strip.scrollWidth > strip.clientWidth + 4) {
              var sr = strip.getBoundingClientRect(), tr = t.getBoundingClientRect();
              if (tr.left < sr.left + 8) strip.scrollLeft -= (sr.left + 8 - tr.left);
              else if (tr.right > sr.right - 8) strip.scrollLeft += (tr.right - (sr.right - 8));
            }
          }
        });
        docPanes.forEach(function (p) {
          if (p.getAttribute('data-doc-pane') !== each) return;
          if (on) {
            var wasHidden = p.hasAttribute('hidden');
            p.removeAttribute('hidden');
            p.classList.add('is-active');
            buildToc(p);                     // 每本账的小节不同,目录跟着册重建
            if (wasHidden) revealIn(p);      // 初次显示的那一册由主观察器负责
          } else {
            p.setAttribute('hidden', '');
            p.classList.remove('is-active');
          }
        });
      });
    };

    // 地址栏 → 册:hash 命中册 id 直接切;命中册内某小节则切到它所属的册
    var docFromHash = function (hash) {
      var id = (hash || '').replace(/^#/, '');
      if (!id) return null;
      if (docIds.indexOf(id) >= 0) return id;
      var el = document.getElementById(id);
      var pane = el && el.closest ? el.closest('.doc-pane') : null;
      return pane ? pane.getAttribute('data-doc-pane') : null;
    };

    var setHash = function (id) {
      if (history.replaceState) history.replaceState(null, '', '#' + id);
      else location.hash = id;
    };

    docTabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        var id = t.getAttribute('data-doc');
        showDoc(id);
        setHash(id);
        // 侧栏滚出视口了才带回册首,否则原地换内容(别打断正在读的人)
        if (docsBox.getBoundingClientRect().top < 0) {
          docsBox.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
        }
      });
      // 竖排(宽屏)用上下键,横排(窄屏)用左右键 —— 与看到的排列方向一致
      t.addEventListener('keydown', function (e) {
        var row = window.matchMedia && window.matchMedia('(max-width: 980px)').matches;
        var next = null;
        if (e.key === (row ? 'ArrowRight' : 'ArrowDown')) next = docTabs[(i + 1) % docTabs.length];
        else if (e.key === (row ? 'ArrowLeft' : 'ArrowUp')) next = docTabs[(i - 1 + docTabs.length) % docTabs.length];
        else if (e.key === 'Home') next = docTabs[0];
        else if (e.key === 'End') next = docTabs[docTabs.length - 1];
        if (!next) return;
        e.preventDefault();
        var id = next.getAttribute('data-doc');
        showDoc(id, true);
        setHash(id);
      });
    });

    var wantedDoc = docFromHash(location.hash)
      || (savedDoc && docIds.indexOf(savedDoc) >= 0 ? savedDoc : null)
      || docIds[0];
    if (wantedDoc) showDoc(wantedDoc);

    window.addEventListener('hashchange', function () {
      var id = docFromHash(location.hash);
      if (id) showDoc(id);
    });
  }

  /* ── 高亮当前页 ─────────────────────────────────────────────────────── */
  // Pages / GitHub Pages 会把 about.html 308 到 /about,所以路径比较必须忽略 .html ——
  // 否则本地(about.html)过、线上(/about)挂,只有首页会高亮。
  var norm = function (path) {
    return (path || '').split('#')[0].split('?')[0].split('/').pop().replace(/\.html$/, '');
  };
  var here = norm(location.pathname) || 'index';
  document.querySelectorAll('.mast-links a[href]').forEach(function (a) {
    if (norm(a.getAttribute('href')) === here) a.classList.add('is-active');
  });

  /* ── 投递(config.json 是唯一配置源) ────────────────────────────────── */
  // 页面上那份邮箱只是兜底(无 JS 时也要能读);有 JS 时一律以 config.json 为准,
  // 所以「改邮箱只改一处」= 改 config.json 的 apply.to。
  var applyCfg = { to: '', endpoint: '' };
  var statusEl = document.getElementById('apply-status');
  var form = document.querySelector('[data-apply-form]');

  var STATUS = {
    sending:  { zh: '发送中…', en: 'Sending…' },
    sent:     { zh: '已收到,谢谢。我们会用邮件回复你。', en: 'Received, thank you. We will reply by email.' },
    invalid:  { zh: '请把称呼、邮箱与想做的事填完整(邮箱要写对)。', en: 'Please fill in your name, email and message (with a valid email).' },
    busy:     { zh: '刚才已经收到一次了,请稍等一会儿再投。', en: 'We just received one from you — please wait a moment and try again.' },
    offline:  { zh: '表单通道当前不可用,请改用上面的投递邮箱(内容已为你填好)。', en: 'The form is unavailable right now — please use the address above (your text is pre-filled).' },
    noconfig: { zh: '没有读到投递配置,请直接发信到上面的投递邮箱。', en: 'Apply settings could not be loaded — please email the address above.' }
  };

  function setStatus(key) {
    if (!statusEl) return;
    var msg = STATUS[key];
    statusEl.textContent = msg ? msg[currentLang] : '';
    statusEl.classList.toggle('is-ok', key === 'sent');
    statusEl.classList.toggle('is-err', key === 'invalid' || key === 'busy' || key === 'offline' || key === 'noconfig');
  }

  function syncApplyUI(apply) {
    applyCfg = {
      to: (apply && apply.to) || '',
      endpoint: (apply && apply.endpoint) || ''
    };
    if (applyCfg.to) {
      document.querySelectorAll('[data-apply-email]').forEach(function (el) {
        el.textContent = applyCfg.to;
        if (el.tagName === 'A') el.setAttribute('href', 'mailto:' + applyCfg.to);
      });
      var to = document.getElementById('apply-mailto');
      if (to) to.setAttribute('href', 'mailto:' + applyCfg.to);
    }
    if (form && applyCfg.endpoint) form.setAttribute('action', applyCfg.endpoint);
  }

  // config.json 与 app.js 同版本号(?v=N),升版本时一起变,不会读到旧缓存。
  (function loadApplyConfig() {
    if (!window.fetch) return;
    var tag = document.querySelector('script[src*="app.js"]');
    var m = tag && /[?&]v=(\d+)/.exec(tag.getAttribute('src'));
    var url = 'config.json' + (m ? '?v=' + m[1] : '');
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { if (cfg && cfg.apply) syncApplyUI(cfg.apply); })
      .catch(function () { /* 读不到就用页面里的兜底邮箱 */ });
  })();

  // 表单内容 → mailto(失败时的退路,也是访客自己发信时的预填)
  function mailtoFor(data) {
    var body = [
      '称呼: ' + data.name,
      '邮箱: ' + data.email,
      '作品 / 主页: ' + (data.links || '—'),
      '',
      data.message
    ].join('\n');
    return 'mailto:' + applyCfg.to
      + '?subject=' + encodeURIComponent('HUSHFUSION 投递 · ' + data.name)
      + '&body=' + encodeURIComponent(body);
  }

  function fieldValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var data = {
        name: fieldValue('apply-name'),
        email: fieldValue('apply-email'),
        links: fieldValue('apply-links'),
        message: fieldValue('apply-message'),
        company: fieldValue('apply-company'),
        lang: currentLang,
        origin: location.origin
      };

      var ok = data.name && data.message && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email);
      if (!ok) { setStatus('invalid'); return; }

      var fallback = document.getElementById('apply-mailto');
      if (fallback) fallback.setAttribute('href', mailtoFor(data));

      if (!applyCfg.endpoint) { setStatus('noconfig'); if (fallback) fallback.hidden = false; return; }
      if (!window.fetch) {
        if (fallback) { fallback.hidden = false; }
        window.location.href = mailtoFor(data);
        return;
      }

      setStatus('sending');
      var btn = document.getElementById('apply-submit');
      if (btn) btn.disabled = true;

      fetch(applyCfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().catch(function () { return { ok: false, code: 'bad_response' }; }); })
        .then(function (res) {
          if (res && res.ok) {
            form.reset();
            setStatus('sent');
            return;
          }
          var code = (res && res.code) || 'offline';
          setStatus(code === 'busy' ? 'busy' : (code === 'invalid' ? 'invalid' : 'offline'));
          if (code !== 'invalid' && code !== 'busy' && fallback) fallback.hidden = false;
        })
        .catch(function () {
          setStatus('offline');
          if (fallback) fallback.hidden = false;
        })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }
})();
