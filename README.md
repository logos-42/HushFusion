# HUSHFUSION 消音计划 · 品牌站

**中文** | [English](README.en.md)

> Controlled Fusion Through the Silence.
> 一个**零构建**的静态品牌站 + 一整套从同一张源图切出的素材 + 设计规范文档。

---

## 这是什么

* `index.html` / `about.html` / `hibs.html` / `progress.html` —— 四页深色展览式静态站
* `assets/` —— **8 个海报切片 + 4 个图标产物**（切片带 sha256 与源图裁剪框记录；图标来自第二张源图，见下「素材的两张源图」/ `docs/ASSETS.md` §八）
* `docs/` —— 设计简报、设计计划（可交给前端 agent 的实现规范）、内容来源表、素材清单、真浏览器截图
* `tools/` + `scripts/` —— 确定性切图脚本与真浏览器验收脚本

**没有 npm，没有打包器，没有框架。** 一个 `style.css` 就是全部设计系统。

**双主题(夜 / 昼)**:顶栏「中/EN」左边一个按钮切换;默认夜,选择记在 `localStorage`。
夜底取自 `assets/cover/thumbnail_375.jpg` 的深橄榄绿族,昼底是浅海蓝绿 `#C9DDD5` + 浅卡其面板 `#F4EFE1`;
强调色两套都用图标 logo 的靛蓝。令牌与实测对比度见 `docs/DESIGN-PLAN.md` §7.6,改色只改 `style.css` 顶部两个令牌块。

---

## 快速开始

```bash
# 1 本地预览
python3 -m http.server 8898
#   然后打开 http://127.0.0.1:8898

# 2 真浏览器验收(四页 105 项断言 + 自动出全页截图)
node scripts/verify-site.mjs http://127.0.0.1:8898

# 3 从源图重放全部素材切片(确定性,会重算 sha256 与色板采样)
python3 tools/slice_assets.py          # 只切站点用到的素材(默认)
python3 tools/slice_assets.py --all    # 连同备用素材一起切

# 4 投递后端(Cloudflare Worker)—— 收件邮箱、发信域、后端地址都在 config.json 里
TEST=1 bash scripts/deploy-apply.sh    # 同步配置 + 部署 + 真发一封自检邮件
SKIP_DEPLOY=1 bash scripts/deploy-apply.sh   # 只看配置,不部署

# 5 站点上线(会把 config.json 一起带上;部署完自动跑一次线上真浏览器验收)
bash scripts/deploy.sh
```

---

## 目录

```text
.
├── index.html                 首页:海报原件置顶 → 序厅 → 展示栏 → 01 五个支点 → 02 当前阶段
├── about.html                 About:为什么是聚变,为什么是「消音」+ 技术逻辑与动机
├── hibs.html                  HIBS 团队:三条回路 + 加入方式
├── progress.html              Progress:当前阶段 + 技术栏(01 时变引力场 / 02 AI 控制)
├── style.css                  唯一设计系统(令牌 + 全部组件)
├── app.js                     交互:语言 / 标签 / 复制 / 滚动揭示 / 移动端导航 / 投递表单
├── config.json                ★ 站点唯一配置源:投递邮箱 / 后端地址 / 发信地址 / 来源白名单
├── apply-worker/              投递后端:Cloudflare Worker(校验 + 蜜罐 + send_email 直发)
├── assets/
│   ├── manifest.json          每个切片的源图裁剪框 / 尺寸 / 字节 / sha256
│   ├── palette.json           色板实测值 + 设计板印刷 hex
│   ├── hero/  brand/  art/    主视觉 / 品牌 / 插画切片
│   └── cover/                 点缀素材池:80 张 512×682 笔触封面(来自 bolloon,见 docs/ASSETS.md §7)
├── icons/                     favicon-32 · apple-touch-icon-180(由 tools/make_icons.py 生成)
├── docs/
│   ├── design-brief.md        设计简报(L0 判据:裁决句 / 禁止清单 / 素材七项特征)
│   ├── DESIGN-PLAN.md         ★ 前端设计计划(实现规范,可直接交给前端 agent)
│   ├── CONTENT-SOURCES.md     每一句文案的来源(源图 / 展开 / 待填)
│   ├── ASSETS.md              素材清单与分辨率纪律
│   └── screenshots/           真浏览器验收产出的截图(四页全页 + 窄屏导航实拍)
├── tools/
│   ├── slice_assets.py        海报切片(唯一入口;--all 连备用素材一起切)
│   ├── make_icons.py          图标生成(第二张源图 → favicon / 顶栏标识 / app icon)
│   ├── import_covers.py       导入 bolloon 封面图素材池(复制 + 登记 sha256)
│   └── instrument_i18n.py     给文案加 data-zh / data-en 双属性
├── scripts/
│   ├── verify-site.mjs        零依赖真浏览器验收(CDP 驱动 headless Chrome)
│   ├── deploy.sh              站点上线(只打包站点需要的文件,含 config.json)
│   └── deploy-apply.sh        投递后端上线(从 config.json 生成 Worker 配置并部署)
```

---

## 素材的两张源图

```text
① 海报源图   ~/.hermes/images/clip_20260917_101147_1.png
            1312 × 1199 · sha256 = aa36a2c81d441d7c550316c47b2d14cb112b3d2fdf5b22184e33211090abaf45
            → 海报/品牌切片(assets/**)，重放 python3 tools/slice_assets.py

② 图标源图   <raw_root>/internal_sources/logo/logo-wave-1254.png   (raw_root = ~/Downloads/hushfusion_raw)
            1254 × 1254 · 深蓝底 #042366 · sha256 = bb25bf8911fa095ae3ef06a6348525b9f91fb96724ca050e8cb0bb341dc116e5
            → 全站图标与顶栏标识(icons/**、assets/brand/mark-wave--white.png)，重放 python3 tools/make_icons.py
```

**只有这两张源图，没有任何素材是凭空画的。** 裁剪框与 sha256 分别记在 `assets/manifest.json`（切片）
与 `assets/icons.manifest.json`（图标）里，两个脚本各自只写自己的产物，重跑不会互相覆盖。

需要更高质量素材时请看 `docs/DESIGN-PLAN.md` §10.3 的**重绘清单**
（哪些素材现在只有 76–295px、需要设计方出矢量或高分辨率版本）。

---

## 改动的正确姿势

```text
改主题 / 配色    → 只改 style.css 的 :root(夜)与 [data-theme="light"](昼)两个令牌块
改 CSS / JS      → 把所有 HTML 里的 ?v=N 全部 +1(漏一页 = 那页用旧缓存)
                  grep -o 'style.css?v=[0-9]*' *.html | sort | uniq -c
改投递邮箱       → 只改 config.json 的 apply.to,然后跑 scripts/deploy-apply.sh(后端)
                  + scripts/deploy.sh(站点);后端配置是这个脚本从 config.json 生成的
改文案           → 同时改 data-zh 与 data-en(或跑 python3 tools/instrument_i18n.py)
换素材           → 保留文件名,覆盖 assets/ 里的文件,然后升 ?v=N
动结构或版式     → 先改 docs/DESIGN-PLAN.md,再改实现(文档与实现不一致时以文档为准)
```

**验收纪律**：交付前必须跑一次 `node scripts/verify-site.mjs`；
命令行里 dump HTML 是不够的 —— 滚动揭示会让内容初始透明，截图会是一片空白。

---

## 已知待办

| # | 事项 | 去哪看 |
|:--|:--|:--|
| 1 | 待批准的设计决策(强调色取印刷码还是实测值、纸块 vs 透明底…) | `docs/DESIGN-PLAN.md` §12 |
| 2 | 低分辨率素材的矢量 / 高清重绘(标志、app icon、插画) | `docs/DESIGN-PLAN.md` §10.3 |
| 3 | 仍需需方定:合作与资助、时变引力场的「公开细节」、关键指标数值、岗位参数(级别/人数/地点/待遇) | `docs/CONTENT-SOURCES.md` §二·九 |
| 4 | 口径句(反引力场 / 无噪音·无限能源 / 可控引力场飞行器)如需改措辞:落点见 `docs/CONTENT-SOURCES.md` §二·五~二·六 | `docs/CONTENT-SOURCES.md` |
| 5 | 低分辨率转写文字的复核(自述段标点、海报批注) | `docs/CONTENT-SOURCES.md` §4 |
| 6 | **最小信息披露纪律**:公开页不写仓库路径 / 尺寸 / 命令行 / 过程话术 —— 新增内容前先读 `docs/DESIGN-PLAN.md` §4 纪律 11 | `docs/DESIGN-PLAN.md` |
| 7 | 团队构成按需方口径「**不公开**」(2026-09-17);三条回路的职责说明仍待定 | `docs/CONTENT-SOURCES.md` §二·九 |
| 8 | 顶栏标识是细笔迹线稿,26px 下偏轻;要加分量把 `.brand-mark` 调到 28px(一处 CSS) | `docs/ASSETS.md` §八 |
| 10 | 图标(favicon / app icon)仍是 logo 的海军蓝底;若要与新绿系底色统一,改 `config.json` 外的 `tools/make_icons.py` 的底色取样即可 | `docs/DESIGN-PLAN.md` §7.6 |
| 9 | 投递通道依赖 Cloudflare Email Sending 的开放测试期:发信域状态用 OAuth 的 CLI 查不到(2036),只在控制台可见;换发信域时同步改 `config.json` 的 `apply.sendingDomain` | `docs/DESIGN-PLAN.md` §7.5.3 |
