/* ============================================================================
   HUSHFUSION · 投递后台
   ---------------------------------------------------------------------------
   站点(https://hushfusion.pages.dev)的投递表单 POST 到这里 → 校验 → 用
   Cloudflare Email Service 的 send_email 绑定把信件投到「投递邮箱」。

   投递邮箱不写死在本文件里:它来自部署时注入的 APPLY_TO,
   而 APPLY_TO 由 scripts/deploy-apply.sh 从仓库根的 config.json 读出。
   —— 改邮箱:改 config.json 的 apply.to,再跑一次 deploy-apply.sh。

   发信还有一道账:绑定的 allowed_destination_addresses 里必须有收件人,
   否则 Cloudflare 会拒(实测错误码 E_RECIPIENT_NOT_ALLOWED)。
   名单同样由 scripts/deploy-apply.sh 从 config.json 生成。

   纪律:
     1) 蜜罐字段 company 有值 = 判为机器人 → 静默 200,不发信(不给爬虫反馈)。
     2) 只做尽力而为的限流(每个 isolate 一份内存计数),不做全局记账。
     3) 发信失败要返回可判别的 code,页面据此退回「直接发邮件」这条路。
   ========================================================================== */

/* 尽力而为的限流:同一 IP 20s 内最多 1 次、10 分钟内最多 3 次 */
const MIN_GAP_MS = 20000;
const WINDOW_MS = 600000;
const MAX_PER_WINDOW = 3;
const seen = new Map();

/* ── 工具 ─────────────────────────────────────────────────────────────── */

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

function originList(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, env) {
  const allow = origin && originList(env).includes(origin);
  const h = { Vary: 'Origin' };
  if (allow) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

/* 去掉控制字符、掐掉首尾空白、限长 —— 之后才让它进邮件正文 */
function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (seen.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length && now - recent[recent.length - 1] < MIN_GAP_MS) return true;
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  seen.set(ip, recent);
  if (seen.size > 5000) seen.clear(); // 内存兜底:不做无界增长
  return false;
}

/* 把绑定抛出的错误码翻译成页面能处理的三种结局 */
function classify(err) {
  const raw = `${(err && err.code) || ''} ${(err && err.name) || ''} ${(err && err.message) || ''}`;
  if (/E_SENDER_NOT_VERIFIED|E_SENDER_DOMAIN_NOT_AVAILABLE|sender_not_configured/i.test(raw)) {
    return 'sender_not_configured';
  }
  /* 实测(2026-09-17):收件人不在绑定的 allowed_destination_addresses 里会报这个码 */
  if (/E_RECIPIENT_NOT_ALLOWED|E_RECIPIENT_SUPPRESSED|not a verified address/i.test(raw)) {
    return 'recipient_not_allowed';
  }
  if (/E_RATE_LIMIT|E_DAILY_LIMIT/i.test(raw)) return 'busy';
  return 'send_failed';
}

/* ── 信件 ─────────────────────────────────────────────────────────────── */

function buildNotice(env, d, meta) {
  const subject = `[HUSHFUSION 投递] ${d.name}`;
  const rows = [
    ['称呼', d.name],
    ['邮箱', d.email],
    ['作品 / 主页', d.links || '—'],
    ['语言', d.lang === 'en' ? 'EN' : '中文'],
  ];
  const text = [
    '有人通过 hushfusion.pages.dev 投递:',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    '想做的事:',
    d.message,
    '',
    '—— 直接回复本邮件即可回到投递人。',
    `来源: ${d.origin || '—'} · ${meta.time}`,
  ].join('\n');

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;line-height:1.7;color:#111">
  <p>有人通过 <b>hushfusion.pages.dev</b> 投递:</p>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
    ${rows.map(([k, v]) => `<tr><td style="color:#666">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
  </table>
  <p style="margin-top:14px"><b>想做的事:</b></p>
  <pre style="white-space:pre-wrap;font:inherit;margin:0">${escapeHtml(d.message)}</pre>
  <p style="color:#666;font-size:12px;margin-top:16px">直接回复本邮件即可回到投递人 · 来源 ${escapeHtml(d.origin || '—')} · ${escapeHtml(meta.time)}</p>
</div>`;

  return env.EMAIL.send({
    to: env.APPLY_TO,
    from: { email: env.APPLY_FROM, name: env.APPLY_FROM_NAME || 'HUSHFUSION' },
    replyTo: d.email,
    subject,
    text,
    html,
  });
}

/* ── 路由 ─────────────────────────────────────────────────────────────── */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'hushfusion-apply' }, 200, cors);
    }
    if (url.pathname !== '/api/apply') {
      return json({ ok: false, code: 'not_found' }, 404, cors);
    }
    if (request.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed' }, 405, cors);
    }
    if (origin && !originList(env).includes(origin)) {
      return json({ ok: false, code: 'origin_not_allowed' }, 403, cors);
    }
    if (!env.APPLY_TO || !env.APPLY_FROM) {
      return json({ ok: false, code: 'not_configured' }, 503, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ ok: false, code: 'bad_json' }, 400, cors);
    }
    if (!body || typeof body !== 'object') {
      return json({ ok: false, code: 'bad_json' }, 400, cors);
    }

    /* 蜜罐:真人看不见这个字段 */
    if (clean(body.company, 80)) return json({ ok: true, ignored: true }, 200, cors);

    const d = {
      name: clean(body.name, 80),
      email: clean(body.email, 160),
      links: clean(body.links, 500),
      message: clean(body.message, 4000),
      lang: clean(body.lang, 5),
      origin: clean(body.origin, 200) || origin,
    };

    const missing = !d.name || !d.email || !d.message;
    if (missing || !EMAIL_RE.test(d.email)) {
      return json({ ok: false, code: 'invalid' }, 422, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (rateLimited(ip)) return json({ ok: false, code: 'busy' }, 429, cors);

    const meta = { time: new Date().toISOString() };
    try {
      const res = await buildNotice(env, d, meta);
      return json({ ok: true, id: (res && res.messageId) || null }, 200, cors);
    } catch (err) {
      /* 不把内部错误细节吐给浏览器,只给它一个能据此改道的 code */
      console.log('send failed', JSON.stringify({ code: classify(err), message: String((err && err.message) || err) }));
      return json({ ok: false, code: classify(err) }, 502, cors);
    }
  },
};
