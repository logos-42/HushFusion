# Wiki 日志

## [2026-09-23] 理论页升级为「三本账」| 侧边栏切换 + 反引力约束 / 魔角石墨烯两本新账

| 日期 | 类别 | 变更 | 说明 |
|------|------|------|------|
| 2026-09-23 | feat | `docs.html` 重构为**文档区**:序厅(h1 只有一个 = 理论)+ 左侧 `nav[role=tablist]` 三本账 + 三个 `article[role=tabpanel]` | 01 控制引力场的代数系统(**原有 6 节文案逐字保留**,标题降为 h2)/ 02 反引力约束聚变环(新)/ 03 魔角石墨烯场天花板(新);面板内 `section.band` 取消自带版心,交给 `.docs` 栅格 |
| 2026-09-23 | feat | 新增第 02 本账:**反引力约束稳态自维持聚变环** | 三层同心装置 + μ 工作区间 + 场反位形两图 + 三道硬门(必要性 / 天花板 / **未证**的 FC5)+ 缺口;文字与图纸脚本来自 `Hibs-Physics` |
| 2026-09-23 | feat | 新增第 03 本账:**魔角石墨烯场天花板** | `1°` 夹角的实验事实与材料场上限 + 七层账本 + 数据变化表 + `B_death ∝ 1/a` + μ 窗口判决(面外 0.12 T ⟹ **可行集为空**)+ 工程两门(载流 / 制冷)+ 诚实边界 |
| 2026-09-23 | chore | 新增素材导入器 `tools/import_figures.py` → 8 张图 + `assets/figures.manifest.json` | 源 = `logos-42/Hibs-Physics` 的 `artifacts/`(commit `fea6a3e`);确定性重放、`--check` 只校验;**排除** BOM 报价图(金额不入站) |
| 2026-09-23 | feat | 切换器在 `app.js`(原生 JS,零依赖) | 单选标签 / 面板显隐 / 地址栏 `#doc-*` 深链(链到册内小节自动切回该册)/ **补揭示**(藏在 `[hidden]` 里的 `.reveal` 不会与视口相交,切换时重新挂观察器,否则「切过去一片空白」);窄屏侧栏折成横向标签条并保留空格键位切换 |
| 2026-09-23 | test | `verify-site.mjs` 新增 5 项文档区断言 + 2 项深链断言 | 三本账单选 / 单面板可见 / 切到最后一本地址栏跟上 / 新册不是一片空白 / 切回默认态;`#doc-moire` 直达第 03 册、`#boolean` 自动切回 01 册。**本地 194/194 全绿** |
| 2026-09-23 | chore | 公开页改名 **`theory.html` → `docs.html`**(需方口述) | 导航可见文案仍是「理论 / Theory」,只改文件名与全部引用:五页 mast-links · `verify-site.mjs` PAGES 与 3 条深链断言 · README 中英 · `docs/ASSETS.md`/`DESIGN-PLAN.md`/wiki 当前态文档;历史条目保持原样(当时确实叫 theory.html) |
| 2026-09-23 | feat | 文档区补齐 doc 产品的标准件:**本页目录(Anchor Navigation)+ 滚动高亮(Scroll Spy)** · **面包屑** · **上一本/下一本(Prev/Next)** · **记住上一次读的那一本(Navigation Persistence)** | 目录不写死:从当前册带 id 的小节生成(页面加一节自动多一项);高亮取「顶部刚越过阅读线」的那一节(相交回调在多节同屏时没有正确答案);窄屏目录隐藏,只留横向标签条 |
| 2026-09-23 | feat | 三本账**挪进容器左侧空白,自己成一栏**,与「本页目录」并排(≥1600px;1599 以下退回上下堆叠) | 栅格往左挖 260px(栏 200 + 间距 60)+ `.doc-nav{display:contents}` 让两块各自成栅格子项;目录与正文横坐标一点没动(1668px:314 / 610);两栏各有小标题;门齿:阈值抬到 1700 → 断言红 |
| 2026-09-23 | chore | 导航标签「理论 / Theory」→ **「文档 / Docs」**(文件名已改,标签跟着改) | 五页导航 + 三处面包屑 + title + kicker + h1 + 侧栏 aria-label;出处行「来源 · 理论的形式化与数值验证」保持不动;新增断言「指向 docs.html 的标签必须是 文档/Docs」 |
| 2026-09-23 | fix | 改名留下 404:`/theory.html` 被 Pages 308 到 `/theory`,而后者已不存在 | 新增根目录 `_redirects`(`/theory.html`·`/theory` → `/docs.html` 301)+ `deploy.sh` 把它一起上线 + `verify-site.mjs` 增「历史页名必须仍有落点」断言(抽掉那条规则会红);线上 `curl -I` 两形式确认 301 |
| 2026-09-23 | fix | **窄屏正文被裁** —— 栅格子项是 `.doc-panes` 而非 `.doc-pane`,没设 `min-width:0`,列宽被宽表格顶开,正文被 `overflow-x` 切掉 | 页面 `scrollWidth` 仍是 0,所以「无横向溢出」那条断言看不见它 → 改用 `minmax(0,1fr)` + `.doc-panes{min-width:0}`;并新增**逐册量块右边缘**的断言(第一版只量了当时露着的那一本,反向验证发现门是空的) |
| 2026-09-23 | chore | 8 张图的来源按 §1.5 登记 `manifests/raw_sources.csv`(+9 行:8 图 + 1 条**排除**记录) | 沿用 bolloon 封面池的先例(外部来源也入册);排除的那条写成 `archived` + 理由,免得后人当漏登 |
| 2026-09-23 | fix | 修「揭示动画后内容可见」这一项的判据 | 它原先要求**全页** `.reveal` 都揭示;有了文档区之后,没被切到的册按设计不揭示 ⇒ 改为只看**当前可见的册**,切换后新册的内容由新增的切换断言单独验 |

> 边界:两本新账只写「已知结论 + 已算数字 + 缺口」。魔角石墨烯那本写明「**不是常温超导**」,并标明唯一的严格证明性结论是「无解」那一条;
> 反引力约束那本把「FC5 锁定能否被几何捕获绕开」标为**未证**,不写成结果。


## [2026-09-22] 路线确定 | 境外募资 + 首页公开记录 + 收款侧冻结(GUARDIAN 阻塞)

| 日期 | 类别 | 变更 | 说明 |
|------|------|------|------|
| 2026-09-22 | docs | 新增 `docs/RECORDS-LAYER-PLAN.md` | 公开记录层:区块 `#records` · `records.json` 数据格式 · 核验路径(下载→sha256→比对)· 锚定合约接口与部署前置 · 8 条验收断言 · 10 条反模式 |
| 2026-09-22 | docs | 新增 `docs/FUNDING-JURISDICTION-SCREENING.md` | 境外法域与主体筛选:先接受"离岸不消除境内风险" · 给律师的 12 个问题 · 主体形式对比 · 候选法域长名单(**不含任何结论**)· 13 维评分表 · 阶段二 5 份出口文件 |
| 2026-09-22 | docs | 新增 `docs/GUARDIAN-DESIGN.md` | GUARDIAN:六条资格的核实办法 · 四类候选形式 · 1 名/2-of-2/主备三种机制 · **换人与"绕过 GUARDIAN"的堵法** · 招募一页纸 · 接口冻结前三项决策 |
| 2026-09-22 | fix | 冻结文档 v1.2:状态机加 **T-G1…T-G4**,威胁模型加 **T1b** | 关键修正:若 GOVERNOR 能单方面撤销 GUARDIAN,被控多签可"撤 GUARDIAN → 排程 → 48h → 执行"⇒ 合约层**不得**留单人撤 GUARDIAN 路径 |
| 2026-09-22 | docs | §九「降级路线」升格为**当前首页路线** | 记录层不再是"如果不行再说",它就是现在的首页路线;`DESIGN-PLAN.md` §7.7 区块由 `#support` 改为 `#records` |
| 2026-09-22 | chore | 需方路线决策登记 raw | `donation-route-decision-20260922.md`(sha256 `3dee8473bbc3e3e1`)→ `manifests/raw_sources.csv` |

> 边界照旧且更严:不写 `.sol`、不部署、不建 Safe、不公开地址、不连钱包、不接受捐赠、不启用 `config.donate.enabled`、不开放任何收款按钮;首页区块本轮**只出设计,未改 HTML**。
> 记录层**不需要 GUARDIAN**(没有钱可丢)⇒ 它是当前唯一能先落地的一件;收款侧在 GUARDIAN 到位前冻结。


## [2026-09-22] 冻结 + 法律闸门 | 阶段一六件套出稿 · 金库身份校验修正 · 两条合规路线与降级路线

| 日期 | 类别 | 变更 | 说明 |
|------|------|------|------|
| 2026-09-22 | docs | 新增 **设计冻结 v1.1** `docs/DONATION-FREEZE.md` | 阶段一六件套:合约状态机(13 条转移)· 角色权限矩阵 · 威胁模型(T1–T13)· 主体迁移流程(9 步 + 回退)· 资金分配章程 · 智能体章程;附 11 条不变量与六阶段门禁 |
| 2026-09-22 | fix | **安全修正**:金库只接受**经验证的 Safe** | `code.length > 0` 只能证明"是个合约" ⇒ `_isVerifiedSafe` 五项:代理 runtime `codehash` + 单例槽 + `VERSION()` + `threshold ≥ 2` + `owners ≥ 3`(常量实测自 Base 主网,含复算命令) |
| 2026-09-22 | fix | **GUARDIAN 二次确认:可选 → 必须** | `approveTreasuryChange` 成为 `executeTreasuryChange` 的前置条件;执行权仍公开(不能因"钥匙不在"卡死迁移) |
| 2026-09-22 | docs | **法律闸门**(§10.1):两条合规路线 + 上线闸门顺序 | 境内科研支持(人民币 + 合同 + 会计,链上只放哈希)/ 境外加密捐赠(先落主体、受众、税务、AML/KYC 与资格);顺序 = 主体 → 受众法域 → 书面意见 → 才能谈审计 |
| 2026-09-22 | docs | 新增**降级路线**:`ResearchRecordAnchor`(不含钱的那一半) | 无 `payable`/`receive`、不显示地址、不连钱包;首页区块从「公开支持」改为「公开记录」;可先于法律意见落地 |
| 2026-09-22 | chore | 两份需方输入登记 raw | `donation-security-and-phases-20260922.md` · `donation-legal-gate-20260922.md` → `manifests/raw_sources.csv` |
| 2026-09-22 | docs | 回写 wiki | `wiki/donation-open-research-fund.md` 加法律闸门 / 双路线 / 降级路线;`current-status.md` 同步 |

> 边界照旧且**更严**:不写 `.sol`、不建 Safe、不公开地址、不连钱包、不接受捐赠、不启用 `config.donate.enabled`、不开放首页按钮。
> 首页在法域判断前只有 `preview`:**「通道未开放,待主体、法律和安全审查完成。」**


## [2026-09-22] 收敛 | 需方决策:可迁移金库(两步 + 48h)· 个人过渡 → 公司主体 · 三套账

| 日期 | 类别 | 变更 | 说明 |
|------|------|------|------|
| 2026-09-22 | docs | 金库地址 **不可变 → 可换**(两步 + 48h) | §2.1 加 `GOVERNOR_ROLE` / `TREASURY_DELAY = 48 hours` / `treasury`+`pendingTreasury`+`treasuryEta`+`treasuryProposalHash` 与 `schedule`/`cancel`/`execute`;§2.5 整节改写(含与旧方案对比表) |
| 2026-09-22 | docs | 硬规则写进代码,不靠纪律 | 新地址必须 `code.length > 0`(`NotAContract`)⇒ **个人热钱包不可能成为金库**;执行时 `GOVERNOR_ROLE` 从旧 Safe 转给新 Safe,否则旧 Safe 仍留着改址权 |
| 2026-09-22 | docs | 暂停 × 时间锁的关系写实 | **时间锁不是否决权**:被控的多签能排程也能执行 ⇒ 建议 `PAUSER` 与 `GOVERNOR` 分离;公司阶段加 `GUARDIAN` 二次确认 |
| 2026-09-22 | docs | 新增 §7.1–7.4 | 治理原则 8 条 · 审计原则 6 层(三方对账 / 每日自动对账 / 双人复核 / **未完成就写"未审计"**)· **三套账**(捐赠 / 贡献者 / 商业收益)与利益分配硬边界 · 链上规范选用清单(用 EIP-55/1193/681/712;不用 20/721/1155、不链上投票、不代理升级) |
| 2026-09-22 | docs | §五 / §6.2 / §6.3 / §九 / §十 / §十一 / §十二 / §十三 同步 | 多签表加「过渡主体 → 公司」行;前端加 `treasury-pending` 状态与双地址横幅;改址演练**四条路径** + 公司迁移演练;反模式 13–16;待拍板 11–14 |
| 2026-09-22 | chore | 需方决策原文登记 raw | `internal_sources/donation-plan/donation-decisions-20260922.md`(sha256 `c680c178…c78b`)→ `manifests/raw_sources.csv` |
| 2026-09-22 | docs | 回写 wiki | `wiki/donation-open-research-fund.md` → 「被改写过的四条」+ 治理/审计/分账/规范 + 变更记录;`current-status.md` 同步 |

> 边界:仍**不写 `.sol`、不部署、不建 Safe、不开放任何地址** —— 本轮只把决策写进设计。
> §13.1(另一智能体写入的决策记录)与本轮 §2.5 / §7.x 已对齐:事件名统一为 `TreasuryChangeScheduled` / `TreasuryChangeCancelled` / `TreasuryChangeExecuted`,并在 §13.1 前加了指回正文的指针。


## [2026-09-22] 设计 | 公开支持 / Open Research Fund —— 非托管捐赠合约 + 链上资金公开(只设计,未落码)

| 日期 | 类别 | 变更 | 说明 |
|------|------|------|------|
| 2026-09-22 | docs | 新增设计全文 `docs/DONATION-FUND-PLAN.md` | 需方 AI 计划 → 可实施规范:三条实现路径裁决 + 合约签名级接口 + 实测常量 + 前端契约 + 上线门槛四组 + 13 条待拍板 |
| 2026-09-22 | docs | 改写计划的三个判断 | ① 合约**非托管**(捐款当场转多签金库,合约余额恒 0)② v1 **不引** `ReentrancyGuard`(无币可重入)③ 暂停的真实半径写清(只让 `receive`/`donate` revert,阻止不了直转 Safe) |
| 2026-09-22 | docs | 实测写进文档(不靠文档转述) | Base `0x2105`/`0x14a34`;公共 RPC CORS 全开;gasPrice `0.006 gwei`;`eth_blobBaseFee` 不支持;`getLogs` 900 区块 ✅ / 5000 区块 ❌ ⇒ 公开 RPC 不能当索引器 |
| 2026-09-22 | docs | 前端契约(未实现) | `#status` → `#support`(`— 03 · Support`)→ 页脚;复用 `band`/`section-head`/`cap-list`/`quiet-cta`;本轮只落 `preview` 态(`config.donate.enabled=false` ⇒ **不显示任何地址与按钮**) |
| 2026-09-22 | docs | `DESIGN-PLAN.md` §7.7 登记位置与验收增量 | 与 §7.5.x/§7.6 同规格:位置、组件、状态机、`?v=N` 升版、断言清单 |
| 2026-09-22 | chore | 需方计划原文登记 raw | `internal_sources/donation-plan/donation-plan-ai-draft-20260922.md`(sha256 `b5545edf…6a0c`)→ `manifests/raw_sources.csv` |
| 2026-09-22 | docs | 回写 wiki | 新增 `wiki/donation-open-research-fund.md` + index/log/current-status |

> 边界(需方口径「本轮只完成设计」):**不写 `.sol`、不部署、不验证源码、不接受真实资金**;不发代币、不做收益分配、不做链上投票。
> 待需方拍板 13 项(金库地址可否变 / PAUSER 归谁 / 是否同时做里程碑登记合约 / 首页本轮是否进 `preview` 态 / 主体与税务 …… )在 `docs/DONATION-FUND-PLAN.md` §13。

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

## [2026-09-23] 目录加第 04 项「声子」+ 条目名字放大加粗 + 容器名改「目录」

| 日期 | 阶段/类别 | 变更 | 提交 / 说明 |
|------|-----------|------|-------------|
| 2026-09-23 | feat | 文档区第 04 项 `#doc-phonon`「声子能帮上什么」:五节 = 已知事实 / 天花板(场 ≈ 1.84 × T_c)/ 实测参照(Nb₃Sn)/ 别信简单公式 / 缺口 | 2 表 + 1 组 spec-list;无图 |
| 2026-09-23 | feat | 场 ⇄ T_c 换算表:1.0991 T→0.60 K · 3.0 T→1.63 K · 12.2 T→6.63 K · 35 T→19.0 K | 纯除法(`μ0H_P ≈ 1.84·T_c`),不依赖模型 |
| 2026-09-23 | chore | 条目名字放大加粗(竖排,`1.06rem/600`,选中 `700`),与本页目录(`.86rem/400`)拉开层级 | 需方「账本的字体要更大,粗体一些」 |
| 2026-09-23 | chore | 容器名「账本」→「目录」(需方手改 + 我方补齐 `data-en=Contents`、导语、`<title>`、meta) | 导语同时去罗列化 |
| 2026-09-23 | fix | 深链不再给面板画焦点框(app.js 键盘标志 + `.is-kb-focus`);键盘 Tab 进来仍可见 | 实测 Chrome 把片段导航判为 focus-visible |
| 2026-09-23 | fix | 窄屏标签条把选中的那一本滚进可视区(深链直达时它在屏幕外) | 桌面栏不横滚,自然跳过 |
| 2026-09-23 | test | 验收 214 → **221 项**(+5 条 + 补的「五页 `?v=` 同号」);`?v=17 → 18` 五页同号 | 门齿逐条反验 |
| 2026-09-23 | fix | **补门**:五页 `?v=` 同号 —— 我这一轮自己把 `docs.html` 落在 17、其余四页到 18,当时没有门管这件事 | 载荷点名是哪一页哪个文件 |

> 口径:第 04 项**不是**本仓形式化的产物 —— 数字来自教科书公式与实测文献,页面导语与节 05 都写明;逐条出处见 `docs/CONTENT-SOURCES.md` §六。
