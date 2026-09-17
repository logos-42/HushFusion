#!/usr/bin/env bash
# 部署到 Cloudflare Pages
#
# 只上传「站点真正需要的东西」——不带 docs/ tools/ scripts/ 与未引用的素材池(assets/cover),
# 这样线上产物是干净的站点,而不是整个仓库。
#
# 用法:
#   bash scripts/deploy.sh                    # 部署到 hushfusion.pages.dev(生产)
#   PROJECT=xxx BRANCH=dev bash scripts/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${TMPDIR:-/tmp}/hushfusion-site"
PROJECT="${PROJECT:-hushfusion}"
BRANCH="${BRANCH:-master}"

cd "$ROOT"

# ── 一个都不能少:页面引用的素材必须全部在暂存目录里 ────────────────────
python3 - "$STAGE" <<'PY'
import pathlib, re, sys, shutil
stage = pathlib.Path(sys.argv[1])
if stage.exists(): shutil.rmtree(stage)
(stage / 'assets').mkdir(parents=True); (stage / 'icons').mkdir()

root = pathlib.Path('.')
pages = sorted(root.glob('*.html'))
# config.json 必须一起上线:页面的投递邮箱与表单地址都从它读
for f in pages + [pathlib.Path('style.css'), pathlib.Path('app.js'), pathlib.Path('config.json')]:
    shutil.copy2(f, stage / f.name)

# 页面里 src/href 引用的 + CSS/JS 里 url(...) 引用的(顶栏标识就是 CSS 蒙版,页面里没它的 src)
refs = []
for p in pages:
    refs += re.findall(r'(?:src|href)="([^"]+)"', p.read_text(encoding='utf-8'))
for sheet in ('style.css', 'app.js'):
    text = (root / sheet).read_text(encoding='utf-8')
    refs += re.findall(r'url\(\s*["\']?([^"\')]+)', text)          # CSS 里的 url(...)
    refs += re.findall(r'[\w./-]+\.(?:png|jpe?g|svg|webp)', text)      # JS 里的裸路径(如按主题换图标)

missing = []
for u in refs:
    if u.startswith(('http', 'mailto:', 'data:', '#')): continue
    path = u.split('#')[0].split('?')[0]
    if not path or not path.endswith(('.png', '.jpg', '.css', '.js', '.svg', '.webp')): continue
    if not (root / path).exists(): missing.append(u)
    else:
        dest = stage / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / path, dest)
if missing:
    sys.exit('缺文件,拒绝部署:\n  ' + '\n  '.join(missing))

# 清单也带上,便于线上对照素材来源
for extra in ('assets/manifest.json', 'assets/palette.json'):
    if (root / extra).exists():
        dest = stage / extra; dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / extra, dest)

n = sum(1 for _ in stage.rglob('*') if _.is_file())
print(f'→ 暂存 {stage}  ({n} 个文件)')
PY

du -sh "$STAGE" | awk '{print "→ 体积 " $1}'
wrangler pages deploy "$STAGE" --project-name="$PROJECT" --branch="$BRANCH" --commit-dirty=true
echo
echo "→ 生产地址 https://$PROJECT.pages.dev"

# ── 部署完必须打线上地址再验一遍 ────────────────────────────────────────
# 本地跑绿 ≠ 线上绿:Pages 会把 about.html 308 到 /about(干净路径),
# 凡是用 location.pathname 做的判断(当前页高亮等)在线上都拿不到 .html。
if [ "${VERIFY:-1}" = "1" ]; then
  echo "→ 线上真浏览器验收"
  node scripts/verify-site.mjs "https://$PROJECT.pages.dev" 2>&1 | tail -4
fi
