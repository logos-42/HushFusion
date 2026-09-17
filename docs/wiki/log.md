# Wiki 日志

## [2026-09-17] 新增 | 理论页「控制引力场的代数系统」(theory.html)

| 日期 | 类别 | 变更 | 说明 |
|------|------|------|------|
| 2026-09-17 | feat | 新增第五页 `theory.html` | 控制引力场的代数系统:基元 = 起伏能量二次型,布尔 = 层状区域族;内容源 `logos-42/Hibs-Physics` 的 `GravityControl.lean`(GCA0–GCA7) |
| 2026-09-17 | feat | 五页导航补「理论」入口 | index/about/hibs/progress 的 mast-links 加 `theory.html` |
| 2026-09-17 | ci | `verify-site.mjs` PAGES 加 theory.html | 新页纳入真浏览器验收(105 → 126 项断言量级) |
| 2026-09-17 | docs | 回写 wiki | `theory-gravity-control-algebra.md` + index/log/current-status |

## [2026-09-17] 启动 | 初始化知识系统 + 品牌站落地上线

今日完成(提交依据 `git log`)：

| 日期 | 阶段/类别 | 变更 | 提交 / 说明 |
|------|-----------|------|-------------|
| 2026-09-17 | 启动 | 初始化知识系统 | wiki-first bootstrap · v2 模板 |
| 2026-09-17 | feat | 单页品牌站(海报置顶、序厅、展示栏、五支点、当前阶段) | `a70d9c2` |
| 2026-09-17 | fix | 恢复顶栏导航 + 修 CSS 未闭合 @media(折叠点/顶栏高度错位) | `2c44c16` |
| 2026-09-17 | fix | 窄屏折叠符号位置(.mast-meta 补 flex 规则,≡ 与 中/EN 同轴) | `e523bb3` |
| 2026-09-17 | docs | README 改准(四页/105 项断言/11 切片)+ 新增英文版,中英互链 | `5391a5f` |
| 2026-09-17 | feat | 部署 Cloudflare Pages(hushfusion.pages.dev)+ 修线上扩展名高亮差异 | `f49f2b6` |

> 备注：本仓库公开部署在 hushfusion.pages.dev,`scripts/deploy.sh` 只打包站点引用文件、不带 docs/ scripts/ 工具与素材池;知识系统与站点共同纳入 git 版本管理。

## [2026-09-17] 修复 | 素材未登记导致 CI 失败

`untracked_raw_check` 在 CI 报仓库内图片素材未登记;本地复现为 98 个
(`assets/*`、`docs/screenshots/*`、`icons/*`)。

| 日期 | 类别 | 变更 | 说明 |
|------|------|------|------|
| 2026-09-17 | fix | 98 个图片素材登记进 `manifests/raw_sources.csv` | 按来源分组,`status=compiled`;总行数 1 → 99 |
| 2026-09-17 | docs | `sources-and-data.md` 补「已登记素材来源」表 | 两张源图 + 六组切片 |
| 2026-09-17 | ci | 五步本地复现 CI 全绿 | wiki_check / raw_manifest_check / untracked_raw_check / wiki_size_report / provenance --ci |

---

## [2026-09-17] 投递通道 + 论文引用 | config.json 唯一配置源 · Cloudflare 直发已通

| 日期 | 阶段/类别 | 变更 | 提交 / 说明 |
|------|-----------|------|-------------|
| 2026-09-17 | feat | 关于页「论文与引用」**结构补齐** + 新增「复制引用」;删掉重复的「理论依据」块 | `about.html#references` · aiXiv `aixiv.260821.000002` |
| 2026-09-17 | feat | HIBS 页「加入」补齐:投递邮箱行 + 投递表单(称呼/邮箱/链接/想做的事 + 蜜罐) | `hibs.html#join` · `app.js` |
| 2026-09-17 | feat | `config.json` 成为站点唯一配置源(投递邮箱/后端地址/发信地址/来源白名单),页面运行时读取 | 改邮箱只改一处 |
| 2026-09-17 | feat | 投递后端 Worker(`apply-worker/`)已部署,Cloudflare Email Sending 直发到 `yuanjieliu65@gmail.com` | 发信域 `hushfusion.alou.onl`;收件人已登记为已验证目的地地址 + 绑定白名单 |
| 2026-09-17 | feat | 新增 `scripts/deploy-apply.sh`(后端);`scripts/deploy.sh` 把 `config.json` 纳入站点产物 | 四页 `?v=13 → 14` |
| 2026-09-17 | docs | 内容来源 §二·七(论文引用 + 投递邮箱逐字存档)、设计计划 §7.5.3(含两处 Cloudflare 实测坑) | `docs/CONTENT-SOURCES.md` · `docs/DESIGN-PLAN.md` |

> 验收:本地 111/111、线上 111/111(`node scripts/verify-site.mjs`);投递端到端自检通过
> —— 真浏览器在线上页填表 → Worker 校验 → 邮箱收到(`{"ok":true,"id":"…@hushfusion.alou.onl"}`)。
> 尚待需方:岗位级别/人数/地点/待遇(`hibs.html#join`)、机构与团队/时间线/合作与资助/法务(`about.html#todo`)。

---

## [2026-09-17] 图标换新 + 待补项收敛 | 需方提供的波形标识 · 全站待填清账

| 日期 | 阶段/类别 | 变更 | 提交 / 说明 |
|------|-----------|------|-------------|
| 2026-09-17 | feat | 全站图标换成需方提供的消音波形标识:顶栏标识、favicon、apple-touch-icon、app icon | 第二张源图(1254px);`tools/make_icons.py` 生成 |
| 2026-09-17 | chore | 单一写入者纪律:`tools/slice_assets.py` 不再写 `icons/` 与 `brand/app-icon.png` | 产物索引拆成 `assets/manifest.json`(切片)与 `assets/icons.manifest.json`(图标) |
| 2026-09-17 | docs | raw 登记图标源图 + `untracked_raw_check.py` 跳过 `.kilo/`(别的 agent 工具的工作树) | `manifests/raw_sources.csv` |
| 2026-09-17 | feat | 关于页「待补」→ **「时间线」**:① `2026-08-21` 论文发布-路线确认 ② 之后进行中;机构与团队按需方口径**整行删除** | `about.html#timeline` |
| 2026-09-17 | feat | 法务落地:版权「© 2026 HUSHFUSION 保留所有权利」+ 隐私(不设追踪统计 / 只写 `hushfusion-lang` / 表单只收主动填写字段) | 与实现一致 |
| 2026-09-17 | feat | 「在招」写实:无固定职位名称、岗位开放、方向=三条回路、要求对等离子体与电磁有了解 | `hibs.html#join` · 需方原话存档 |
| 2026-09-17 | feat | AI 控制公开细节 = 「电磁场持续学习的 AI 系统」,落到 3 处 | 关于页 / 首页 / 进展页技术栏 |
| 2026-09-17 | docs | 内容来源 §二·八(图标源)§二·九(待补项逐条处置,含原话);设计计划 §7.5.4 §7.5.5;素材 §八 | README 中英同步 |

> 验收:本地 111/111、线上 111/111。仍未定(已留占位):合作与资助、时变引力场公开细节、关键指标数值、岗位参数。

---

## [2026-09-17] 双主题(夜/昼)+ 配色改绿系 | 色板取样自 thumbnail_375 · 小字可读性

| 日期 | 阶段/类别 | 变更 | 提交 / 说明 |
|------|-----------|------|-------------|
| 2026-09-17 | feat | 夜/昼两套主题令牌,开关按钮在「中/EN」左边,默认夜 + `localStorage` 记忆 + `<head>` 内联脚本防闪 | `style.css` `app.js` 四页 |
| 2026-09-17 | feat | 配色换成需方点名的 `assets/cover/thumbnail_375.jpg` 色系(深橄榄绿 #173400 / 米白纸底 #F0F0F0) | 夜底 #0E1E05 · 昼底 #F2F2EF |
| 2026-09-17 | feat | **强调色改为图标 logo 的靛蓝 #042366**(绿底互补色):小标/链接/重点词/实心按钮统一走它 | 夜 #93A4FF(7.4:1)· 昼 #1B2C7A(11.1:1) |
| 2026-09-17 | fix | 小字可读性:微标签 10–11px → 12px、字重 300 → 400、大写字距 3/2px → 1.6/1.2px | 小字对比度 5.61:1 → 8.9:1 |
| 2026-09-17 | fix | 顶栏标识改成 alpha 蒙版(`background-color: var(--ink)`),昼间不再「白字白底」消失 | 一个文件两套底色都可见 |
| 2026-09-17 | test | 每页新增 7 项主题断言;「底色 == #080F1A」改为「body 底色 == `--bg` 令牌」 | 本地/线上 139 项全绿 |
| 2026-09-17 | docs | DESIGN-PLAN §7.6(色板出处/令牌表/对比度/主题机制)、ASSETS §7.1.1;README 中英 | 取样命令也写进文档 |

> 需方口径存档:配色以 thumbnail_375 的色系为夜底色;logo 的深蓝仍保留在图标(favicon / app icon)里。

## [2026-09-17] 昼间配色再收 | 浅海蓝绿底 + 浅卡其面(亮度 95% → 84%)

| 日期 | 阶段/类别 | 变更 | 提交 / 说明 |
|------|-----------|------|-------------|
| 2026-09-17 | fix | 昼间底由冷白 `#F2F2EF` 换成**浅海蓝绿** `#C9DDD5`(亮度 84%),面板/输入框换成**浅卡其** `#F4EFE1`/`#E7E0CC` | 需方口径「太亮、要浅海蓝绿 + 浅卡其」 |
| 2026-09-17 | fix | 昼间文字随之调深:ink `#11302A`(10.0:1)/ ink-2 `#22403A`(7.8)/ ink-3 `#2C4A42`(6.8) | 小字仍远超 AA;夜间不变 |
| 2026-09-17 | docs | `theme-color`(昼)同步 `#C9DDD5`;DESIGN-PLAN §7.6 / ASSETS §7.1.1 / README 中英同步 | 验收 139 项仍全绿 |

> 说明:昼底是中亮色,三段文字无法同时 ≥7:1 又不糊成两级 —— 昼间小字定 6.8:1(夜间 8.9:1),
> 要更狠可把昼底降到 `#C2D8CE`。夜间配色与强调色本轮未动。

## [2026-09-17] 浏览器图标随主题换 | 昼间浅底深字那套

| 日期 | 阶段/类别 | 变更 | 提交 / 说明 |
|------|-----------|------|-------------|
| 2026-09-17 | feat | 图标出两套:夜 = 深蓝底白波形;昼 = **浅海蓝绿底 `#C9DDD5` + 深墨绿波形 `#11302A`** | `icons/favicon-32--day.png` · `apple-touch-icon--day.png` · `app-icon--day.png` |
| 2026-09-17 | feat | `<link rel="icon">` / `apple-touch-icon` 带 `data-icon`,`app.js` 切主题时换 href | 昼间标签页与书签图标 = 浅底深字 |
| 2026-09-17 | chore | 昼间图标配色由 `tools/make_icons.py` **直接读 `style.css` 的 `[data-theme="light"]` 令牌** | 主题改色只重跑脚本;覆盖用 `--day-bg/--day-ink` |
| 2026-09-17 | fix | `scripts/deploy.sh` 素材扫描扩到 JS 里的裸路径(否则昼间图标不上线) | 线上「无失败网络请求」仍绿 |
| 2026-09-17 | test | 每页新增 3 项图标断言(夜深底 / 昼浅底 / 两套文件都在) | 本地 151/151 |

> 口径:需方 2026-09-17「白天模式下的浏览器图标换成同样底色的色系(浅色背景 + 黑字 logo)」。
