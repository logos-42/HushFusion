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
