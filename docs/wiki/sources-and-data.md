---
title: 资料与数据
source: session
created: 2026-09-17
last_confirmed: 2026-09-17
audience: internal
stage: draft
tags: [data, raw]
status: current
---

原始资料默认放在本地 raw 根目录，不直接进 Git。

raw 根目录建议：

```text
../hushfusion_raw/
```

GitHub 里只保留 manifest 和编译结果。

少量 raw 可以手工登记；新文件一多，直接跑：

```bash
python3 scripts/ingest_raw.py
python3 scripts/stale_report.py
python3 scripts/delta_compile.py --write-drafts
```

## 已登记素材来源（2026-09-17）

仓库内**所有**图片素材均已登记 `manifests/raw_sources.csv`
（CI 第 3 步 `untracked_raw_check.py` 强制：仓库里任何 raw 扩展名文件若未登记即失败）。

| 来源组 | 数量 | 来源 / 供应商 | status | 编译去向 |
|--------|------|---------------|--------|----------|
| 主视觉切片 `assets/hero/` | 3 | 需方（源图 `clip_20260917_101147_1.png`） | compiled | index.html / assets/manifest.json / docs/ASSETS.md |
| 品牌切片 `assets/brand/` | 6 | 需方（源图同上） | compiled | index.html / assets/manifest.json / docs/ASSETS.md |
| 插画 `assets/art/` | 1 | 需方 | compiled | assets/manifest.json / docs/ASSETS.md |
| 点缀素材池 `assets/cover/` | 80 | bolloon 项目 | compiled | docs/ASSETS.md |
| 验收截图 `docs/screenshots/` | 6 | 自制（`scripts/verify-site.mjs`） | compiled | scripts/verify-site.mjs |
| 站点图标 `icons/` | 2 | 需方（logo 派生） | compiled | index.html / icons/ |
| 图标源图（logo） | 1 | 需方 | compiled | icons/ + assets/brand/ |

**两张源图**：手绘海报 `clip_20260917_101147_1.png`、消音波形标识 `logo-wave-1254.png`；
其余均为其确定性切片或项目自带素材池，**没有第三个来源**。

> 新增图片素材时：先登记 manifest（`status` 按新入库给 `new`），再跑
> `python3 scripts/untracked_raw_check.py` 确认无遗留，否则 CI 会拦。