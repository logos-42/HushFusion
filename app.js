/* ============================================================================
   HUSHFUSION · 交互(零依赖原生 JS)
   职责:语言切换(data-zh/data-en + localStorage) · 标签切换 · 复制反馈 ·
        滚动揭示 · 移动端导航
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

  function applyTheme(mode) {
    if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) { /* 隐私模式忽略 */ }
    if (THEME_META) THEME_META.setAttribute('content', THEME_COLOR[mode]);
    syncThemeLabels();
  }

  themeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
    });
  });
  syncThemeLabels();

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
