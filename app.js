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

  function applyLang(lang) {
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
})();
