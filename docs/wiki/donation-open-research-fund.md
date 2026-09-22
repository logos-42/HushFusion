---
title: 公开支持 / Open Research Fund —— 捐赠与链上资金公开(设计)
source: internal_sources/donation-plan/donation-plan-ai-draft-20260922.md
source_hash: b5545edf8daa2c82
created: 2026-09-22
last_confirmed: 2026-09-22
schema_version: 2.1
audience: internal
stage: draft
status: current
confidence: medium
entity_type: protocol
owner: leo
tags: [funding, smart-contract, base, governance, donation]
---

## 当前共识(一句话)

首页在「当前阶段」与页脚之间加「公开支持」区块。链上部分:**Safe 是托管金库,收款合约是 pass-through 入口** —— 捐款在同一笔交易内原样转给当前 Safe,合约只做四件事(记账 / 发事件 / 暂停新捐赠 / **受约束地改收款地址**),余额恒为 0。因此合约里**没有可被偷的钱、没有可升级代理**;改址**只有一条路**:Safe 排程 + 提案哈希上链 → ≥48h → 到期后任何人可执行,且新地址**必须是合约**(个人热钱包永远进不来)。

需方 2026-09-22 决策:主体走**个人过渡 → 公司成立后迁移**;利益走**三套账分账**。

本轮交付**只有设计**:不写 `.sol`、不部署、不建 Safe、不收真实资金、不发代币、不做收益分配、不做链上投票。

⛔ **法律闸门(最高优先级的门,2026-09-22)**:任何收款动作都以**书面专业法律意见**为前置。「上链」不等于非法集资,但**「中文公开网站 + 面向公众 + 接收 ETH/稳定币 + 个人过渡主体」是高风险组合** —— 不发币、不承诺回报、多签、透明账本**都不能**消除法域与募资风险。法域判断前:不公开地址、不接受资金、首页只有 `preview`。

## 被改写过的四条(计划原文 → 本仓库口径)

| 计划原文 | 改写 | 理由 |
|:--|:--|:--|
| 合约收款 + 管理员可暂停 + 多签提款 | **Safe 托管 + pass-through 收款合约**:合约余额恒为 0,出账全部在 Safe 里做 | 合约不持币 ⇒ 重入/提款函数/升级代理/「暂停=冻结」这一整类问题不成立。术语:「托管」= **Safe** 托管 |
| 「优先采用 `ReentrancyGuard`」 | v1 **不引** `ReentrancyGuard`,只守 CEI | 该建议是给持币合约的;无币可重入。省 2k gas 与一个修饰器 |
| 「暂停权限只能暂停新捐赠或拨款」 | 暂停只能让 `receive`/`donate` **revert**(钱退回捐赠人);它阻止不了别人直转 Safe,也动不了 Safe 一分钱 | 把权限的真实半径写清,不让「暂停」听起来像能管钱 |
| 「使用固定的项目金库地址」+「不允许单一管理员更换」 | **可换,但只有一条窄路**:当前 Safe 排程 + 提案哈希上链 → ≥48h → 到期后**任何人**可执行(执行时 `GOVERNOR_ROLE` 转给新 Safe);新地址**必须是合约**(`NotAContract` 挡掉 EOA 热钱包) | 公司没成立、个人只是过渡主体,成立后金库必须交给公司;地址不可变会让第一次主体迁移就得换合约 |

## 合约要点(v1 = 只做 vault)

- `HushFusionDonationVault`:`Pausable` + `AccessControl`(GOVERNOR 只授当前 Safe;PAUSER 建议分离;GUARDIAN 可选);`receive()` / `donate(uint8 bucket)`;`snapshot()` 一次 `eth_call` 拿总额 + 笔数 + 分桶
- 改址状态机:`treasury` + `pendingTreasury` + `treasuryEta` + `treasuryProposalHash`;`TREASURY_DELAY = 48 hours` **写死不可调**;`schedule`(GOVERNOR)→ `cancel`(到期前可撤)→ `execute`(到期后任何人);事件 `TreasuryChangeScheduled` / `TreasuryChangeCancelled` / `TreasuryChangeExecuted`
- 待生效期间捐款**仍进旧 Safe**;页面必须同时显示旧地址 + 新地址 + 提案哈希 + ETA(状态 `treasury-pending`)
- 桶:**0 未指定**,1 公开基础层 / 2 验证层 / 3 原型层 / 4 公共运营层。桶是**意向标记**,钱全进同一个 Safe —— 这句必须写在页面上
- 不写进合约:代理、`delegatecall`、自毁、**单步改址**、任何 `string`/`bytes` 参数、任何票据 NFT、任何排行榜逻辑
- 里程碑登记合约 `HushFusionMilestoneRegistry` 只定接口,**v1.1 再做**;「已用/余额」一律标注**多签声明**,不是链上事实

## 实测常量(2026-09-22,照抄可用)

| 项 | 值 |
|:--|:--|
| Base 主网 / Sepolia chainId | `8453` = `0x2105` / `84532` = `0x14a34`(RPC 实测) |
| 公共 RPC | `https://mainnet.base.org` · `https://sepolia.base.org` |
| 浏览器读链 CORS | 全开(`access-control-allow-origin: *`)⇒ 前端可无键直读 |
| SafeL2 v1.4.1 单例 | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762`(Base 主网有代码,实测) |
| gasPrice / baseFee | `0.006 gwei` / `0.005 gwei`;21000 gas ≈ `$0.0003`(ETH $2725) |
| L1 数据费 | 公共 RPC **不支持** `eth_blobBaseFee` ⇒ 无法预估,页面只能写「以钱包为准」 |
| `eth_getLogs` | ≤1000 区块 + 地址过滤 ✅;5000 区块无过滤 ❌(`no backend is currently healthy`)⇒ 公开 RPC 不能当索引器,需 Worker 分窗缓存 |

## 治理 / 审计 / 分账 / 规范(§7.1–7.4)

- **治理原则 8 条**:角色分离 · 提案即文件(哈希进交易 `data`)· 时间锁只用于改址、**没有紧急后门** · 无链上投票(声誉来自贡献与评审,不进合约)· 否决 = 不签但异议必须留痕 · 利益冲突回避(给自己发钱必须由别人提案)· 终止/退款/转桶单独提案 + 公开结算 · 争议通道常开且不删质疑
- **审计原则 6 层**:独立第三方代码审计(部署前 + 每次变更后)· 季度资金审计(Safe 流水 ↔ 提案 ↔ 贡献者合同 **三方对账**)· 每日自动对账告警 · 敏感操作双人复核 · 档案全部进 git(底稿 ≥5 年)· **未完成就写"未审计"**,不许写"审计中"
- **三套账**:捐赠账(科研/审计/基础设施/安全/运营/应急)· 贡献者账(工资/服务费/研究合同/里程碑奖金/报销)· 商业收益账(公司产品/授权/专利/服务)。捐赠**不产生**股权、分红、回购权、收益权、代币、积分或任何可转让凭证;商业收益按公司章程与合同分配;个人薪酬可只公开合计或区间,**不得伪装成科研拨款**
- **链上规范**:用 EIP-55 / 1193 / 681 / 712 + Safe Transaction Service + event-first / two-step / delay;**不用** ERC-20/721/1155、不做链上投票、不做代理升级、不做收益金库、不接跨链桥
- 智能体一阶段**不给任何私钥**(用"没有权限"实现五条禁令);允许读链、写提案草稿、生成待签名交易、对账;产出进 git,反对意见逐字保留 + 哈希;它不是天然股东/收款主体,可计费工作由背后能承担责任的主体签约收款

## 前端契约(本轮只落 `preview` 态)

位置 `#status` → `#support`(`— 03 · Support`)→ 页脚;复用 `band` / `section-head` / `cap-list` / `quiet-cta` 体系,零新增依赖。
状态机:`preview`(通道未开放,**不显示任何地址与按钮**)· `ready` · `connected` · `wrong-chain` · `pending`(≥12 区块才算「已确认」)· `failed` · `paused` · **`treasury-pending`**(双地址 + 提案哈希 + ETA)。
配置:`config.json` 增 `donate` 段(唯一地址来源,`enabled:false` 时地址一律 `null`);EIP-1193 + 错误码文案表;地址三层校验(`eth_getCode` 非空 / `vault.treasury() == config.treasury` / 人可核验路径),**任一失败就不显示捐赠按钮**;无 JS 用构建期注入的地址兜底(`deploy.sh` 从 `config.json` 注入,断言两处一致);移动端用 EIP-681 深链(只做普通转账)。

## 风险与前置

- **法律前置(=最高优先级的门)**:官方口径把虚拟货币相关业务与代币发行融资在境内列为应严格禁止的非法金融活动,且互联网信息服务不得为其提供展示/宣传;非法集资的认定看"是否向社会公众公开传播吸收资金信息、是否承诺回报、主体是否具备资格、资金是否按公开用途使用"等事实。⇒ 顺序固定为 **法律/税务主体确认 → 目标受众与法域确认 → 书面专业意见 → 才谈合约审计与 Safe**。**不能**靠服务器位置 / RPC / 合约 / 前端地理限制"解决"法域问题
- **两条路线**:① **境内科研支持** = 明确主体 + 人民币银行账户 + 合同/资助协议 + 发票与会计审计,区块链只放报告哈希与非资金证明 ② **境外加密捐赠** = 先落境外主体、受众、税务、AML/KYC、支付与募资资格,再单独取意见(不得假定"部署在境外"即合规)
- **降级路线(不含钱的那一半)**:若结论是"不能公开募资",保留 **`ResearchRecordAnchor`** —— 报告/提案/对账表哈希锚定 + 公开时间戳证据(**无 `payable`/`receive`**、不显示地址、不连钱包);首页区块从「公开支持」改为「公开记录」。详见 [`../DONATION-FREEZE.md`](../DONATION-FREEZE.md) §九
- 主体 = 个人过渡 → 公司迁移(未来捐赠路由先切,再由旧 Safe 转存量,旧 Safe 只读退役);「不可退款」「地址永久公开」必须写在按钮下方
- **时间锁 ≠ 否决权**:多签若被完全控制,攻击者能排程也能执行 —— 48h 买到的是「看得见 + 能停新捐赠 + 能公告」。所以建议 `PAUSER` 与 `GOVERNOR` **分离**,公司阶段再加 `GUARDIAN` 二次确认
- **反钓鱼**:改址只有一条窄路(合约地址 + 48h + 可撤 + 任何人可执行)是最强的一道;剩下靠"双渠道公告地址 + 源码验证 + commit 留痕"
- 完整定义:实现规范 [`../DONATION-FUND-PLAN.md`](../DONATION-FUND-PLAN.md)(§10.1 法律闸门 / §13 待拍板)· **设计冻结 v1.1** [`../DONATION-FREEZE.md`](../DONATION-FREEZE.md)(状态机 / 权限矩阵 / 威胁模型 / 迁移流程 / 资金分配章程 / 智能体章程 + 11 条不变量 + 六阶段门禁)—— **冲突时以冻结文档为准**

## 关联

- 设计全文:[`docs/DONATION-FUND-PLAN.md`](../DONATION-FUND-PLAN.md)
- 前端设计计划:[`DESIGN-PLAN.md`](../DESIGN-PLAN.md) §7.7
- raw 原文:① 计划 `internal_sources/donation-plan/donation-plan-ai-draft-20260922.md`(sha256 `b5545edf8daa2c827b3f1f58fb64069ec60d71a0111dbce770a24a10f1dc6a0c`)② 需方决策 `internal_sources/donation-plan/donation-decisions-20260922.md`(sha256 `c680c178035934f6ac380299b6d0f6b61c4f680357aa9fc0e33b886044dec78b`)③ 安全修正与六阶段 `donation-security-and-phases-20260922.md` ④ 法律闸门 `donation-legal-gate-20260922.md`

## 变更记录

| 日期 | 变更 |
|:--|:--|
| 2026-09-22 | 初版(非托管 pass-through,金库不可变) |
| 2026-09-22 | 需方决策:金库**可换**(两步 + 48h)、个人过渡 → 公司迁移、三套账分账、治理 8 条 + 审计 6 层 + 链上规范选用清单 |
| 2026-09-22 | 安全修正:金库只接受**经验证的 Safe**(代理 runtime 代码哈希 + 单例槽 + 版本 + 阈值/所有者,已实测),`code.length > 0` 不算数;GUARDIAN 从可选改为**必须** |
| 2026-09-22 | **法律闸门**:加入前置条件与两条合规路线;新增 **降级路线** `ResearchRecordAnchor`(不收钱,只锚定哈希);v1.1 冻结文档 |
