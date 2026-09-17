# Wiki 日志

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
