# HUSHFUSION 消音计划 · 品牌站

**中文** | [English](README.en.md)

> Controlled Fusion Through the Silence.
> 一个**零构建**的静态品牌站 + 一整套从同一张源图切出的素材 + 设计规范文档。

---

## 这是什么

* `index.html` / `about.html` / `hibs.html` / `progress.html` —— 四页深色展览式静态站
* `assets/` —— **11 个素材切片 + 2 个图标**（站点引用到的全部；全部从**同一张源图**裁剪，带 sha256 与源图裁剪框记录）
* `docs/` —— 设计简报、设计计划（可交给前端 agent 的实现规范）、内容来源表、素材清单、真浏览器截图
* `tools/` + `scripts/` —— 确定性切图脚本与真浏览器验收脚本

**没有 npm，没有打包器，没有框架。** 一个 `style.css` 就是全部设计系统。

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
├── app.js                     交互:语言 / 标签 / 复制 / 滚动揭示 / 移动端导航
├── assets/
│   ├── manifest.json          每个切片的源图裁剪框 / 尺寸 / 字节 / sha256
│   ├── palette.json           色板实测值 + 设计板印刷 hex
│   ├── hero/  brand/  art/    主视觉 / 品牌 / 插画切片
│   └── cover/                 点缀素材池:80 张 512×682 笔触封面(来自 bolloon,见 docs/ASSETS.md §7)
├── icons/                     favicon-32 · apple-touch-icon-180
├── docs/
│   ├── design-brief.md        设计简报(L0 判据:裁决句 / 禁止清单 / 素材七项特征)
│   ├── DESIGN-PLAN.md         ★ 前端设计计划(实现规范,可直接交给前端 agent)
│   ├── CONTENT-SOURCES.md     每一句文案的来源(源图 / 展开 / 待填)
│   ├── ASSETS.md              素材清单与分辨率纪律
│   └── screenshots/           真浏览器验收产出的截图(四页全页 + 窄屏导航实拍)
├── tools/
│   ├── slice_assets.py        切图(唯一入口;--all 连备用素材一起切)
│   ├── import_covers.py       导入 bolloon 封面图素材池(复制 + 登记 sha256)
│   └── instrument_i18n.py     给文案加 data-zh / data-en 双属性
└── scripts/verify-site.mjs    零依赖真浏览器验收(CDP 驱动 headless Chrome)
```

---

## 素材的唯一来源

```text
~/.hermes/images/clip_20260917_101147_1.png
1312 × 1199 · sha256 = aa36a2c81d441d7c550316c47b2d14cb112b3d2fdf5b22184e33211090abaf45
```

**没有第二个来源，也没有任何素材是凭空画的。** 每个切片的源图裁剪框都写在 `assets/manifest.json` 里，
可用 `python3 tools/slice_assets.py` 逐字节重放。

需要更高质量素材时请看 `docs/DESIGN-PLAN.md` §10.3 的**重绘清单**
（哪些素材现在只有 76–295px、需要设计方出矢量或高分辨率版本）。

---

## 改动的正确姿势

```text
改 CSS / JS      → 把所有 HTML 里的 ?v=N 全部 +1(漏一页 = 那页用旧缓存)
                  grep -o 'style.css?v=[0-9]*' *.html | sort | uniq -c
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
| 3 | 需方补齐「待填」内容(名单、指标、邮箱、里程碑) | `docs/CONTENT-SOURCES.md` §3 |
| 4 | 口径句(时变引力场 / 消除噪音)如需改措辞:落点见 `docs/CONTENT-SOURCES.md` §二·五 | `docs/CONTENT-SOURCES.md` |
| 5 | 低分辨率转写文字的复核(自述段标点、海报批注) | `docs/CONTENT-SOURCES.md` §4 |
| 6 | **最小信息披露纪律**:公开页不写仓库路径 / 尺寸 / 命令行 / 过程话术 —— 新增内容前先读 `docs/DESIGN-PLAN.md` §4 纪律 11 | `docs/DESIGN-PLAN.md` |
| 7 | HIBS 团队页的成员名单 / 头像 / 机构信息仍是占位 | `docs/CONTENT-SOURCES.md` §3 |
