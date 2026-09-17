#!/usr/bin/env bash
# 投递后台(Worker)部署 —— 把 config.json 里的投递配置同步到后端
#
#   bash scripts/deploy-apply.sh            # 同步配置 + 部署 + 健康检查
#   SKIP_DEPLOY=1 bash scripts/deploy-apply.sh   # 只看配置与发信域状态,不部署
#
# 这个脚本是「改邮箱只改一处」那一步:邮箱/发信域/Worker 名都从
# 仓库根的 config.json 读,再生成 apply-worker/wrangler.jsonc(该文件是产物,别手改)。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ 读 config.json"
python3 - <<'PY'
import json, pathlib
cfg = json.loads(pathlib.Path('config.json').read_text(encoding='utf-8'))
a = cfg.get('apply') or {}
need = ['to', 'endpoint', 'from', 'fromName', 'sendingDomain', 'worker']
missing = [k for k in need if not a.get(k)]
if missing:
    raise SystemExit(f'config.json 缺字段: {missing}')
if '@' not in a['to']:
    raise SystemExit(f"apply.to 不像邮箱: {a['to']!r}")

out = pathlib.Path('apply-worker/wrangler.jsonc')
out.write_text(f'''// 本文件由 scripts/deploy-apply.sh 从仓库根 config.json 生成 —— 不要手改。
// 改投递邮箱:改 config.json 的 apply.to,然后重跑 deploy-apply.sh。
{{
  "name": "{a['worker']}",
  "main": "src/index.js",
  "compatibility_date": "2026-09-17",
  "send_email": [{{ "name": "EMAIL",
    "allowed_destination_addresses": ["{a['to']}"] }}],
  "vars": {{
    "APPLY_TO": "{a['to']}",
    "APPLY_FROM": "{a['from']}",
    "APPLY_FROM_NAME": "{a['fromName']}",
    "ALLOWED_ORIGINS": "{','.join(cfg.get('allowedOrigins') or [])}"
  }}
}}
''', encoding='utf-8')
print(f"  ✓ apply-worker/wrangler.jsonc(收件人 {a['to']} / 发信域 {a['sendingDomain']} / Worker {a['worker']})")
pathlib.Path('/tmp/hushfusion-apply.env').write_text(
    f"WORKER={a['worker']}\nENDPOINT={a['endpoint']}\nSENDING_DOMAIN={a['sendingDomain']}\nTO={a['to']}\n",
    encoding='utf-8')
PY

# shellcheck disable=SC1091
source /tmp/hushfusion-apply.env
rm -f /tmp/hushfusion-apply.env

# 发信域状态用 OAuth 的 CLI 查不到(Cloudflare 的开放测试期对这个接口返回 2036 Unauthorized,
# 2026-09-17 实测),所以这里不猜状态:两台硬约束写在下面,发信是否真通以 TEST=1 的自检为准。
echo "→ 发信域:$SENDING_DOMAIN"
cat <<EOF
  两条硬约束(缺一条,发信会被 Cloudflare 拒):
    1) 发信域 $SENDING_DOMAIN 已在 Email Sending 开通(控制台:Compute & AI → Email Service → Email Sending)
    2) 收件人 $TO 在绑定的 allowed_destination_addresses 白名单里 —— 本脚本已按 config.json 自动生成
  一次性自检:TEST=1 bash scripts/deploy-apply.sh
EOF

if [ "${SKIP_DEPLOY:-0}" = "1" ]; then
  echo "→ SKIP_DEPLOY=1,不部署"
  exit 0
fi

echo "→ 收件人白名单:$TO"
ADDRS="$(npx --yes wrangler email routing addresses list 2>&1 || true)"
if grep -q "$TO" <<<"$ADDRS"; then
  echo "  ✓ $TO 已是已验证的目的地地址"
else
  echo "  · 目的地地址里没有 $TO,尝试自动登记(账号主邮箱通常即时通过)"
  npx --yes wrangler email routing addresses create "$TO" 2>&1 | tail -5 \
    || echo "  ! 自动登记失败:到控制台 Email Routing → Destination addresses 手工加一次(收件人必须已验证,否则发送会被拒)"
fi

echo "→ 部署 Worker"
(cd apply-worker && npx --yes wrangler deploy)

if [ "${TEST:-0}" = "1" ]; then
  echo "→ 自检投递(会真的发一封到 $TO)"
  curl -s --max-time 40 -X POST "$ENDPOINT" -H 'Content-Type: application/json' \
    -d '{"name":"通道自检","email":"self-test@example.com","links":"","message":"部署自检:看到这封说明「投递邮箱」通道已打通,可以直接删。","lang":"zh","origin":"deploy-apply.sh"}'
  echo
fi

BASE="${ENDPOINT%/api/apply}"
echo "→ 线上健康检查 $BASE/api/health"
CODE="$(curl -s -o /tmp/hushfusion-apply-health.txt -w '%{http_code}' "$BASE/api/health" || echo 000)"
cat /tmp/hushfusion-apply-health.txt 2>/dev/null || true
echo
if [ "$CODE" = "200" ]; then
  echo "  ✓ 后端在线,$BASE/api/apply 可用"
  python3 - "$ENDPOINT" <<'PY'
import json, pathlib, sys
p = pathlib.Path('config.json')
cfg = json.loads(p.read_text(encoding='utf-8'))
if cfg['apply']['endpoint'] != sys.argv[1]:
    raise SystemExit('! config.json 的 apply.endpoint 与部署出的地址不一致,请手动对齐')
print('  ✓ config.json 的 apply.endpoint 与线上一致')
PY
else
  echo "  ! 健康检查返回 $CODE:确认 apply-worker/wrangler.jsonc 里的 name 与 config.json 的 worker 一致"
  exit 3
fi
