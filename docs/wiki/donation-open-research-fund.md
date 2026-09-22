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

首页在「当前阶段」与页脚之间加「公开支持」区块;链上部分用**非托管**合约:**捐款在同一笔交易内原样转给多签金库**,合约只记账 + 发事件 + 可暂停。因此合约里**没有可被偷的钱、没有 admin 改址函数、不需要可升级代理**。

本轮交付**只有设计**:不写 `.sol`、不部署、不收真实资金、不发代币、不做收益分配。

## 被改写过的三条(计划原文 → 本仓库口径)

| 计划原文 | 改写 | 理由 |
|:--|:--|:--|
| 合约收款 + 管理员可暂停 + 多签提款 | **非托管 pass-through**:合约余额恒为 0,出账全部在多签钱包里做 | 合约不持币 ⇒ 重入/提款函数/升级代理/「暂停=冻结」这一整类问题不成立 |
| 「优先采用 `ReentrancyGuard`」 | v1 **不引** `ReentrancyGuard`,只守 CEI | 该建议是给持币合约的;无币可重入。省 2k gas 与一个修饰器 |
| 「暂停权限只能暂停新捐赠或拨款」 | 暂停只能让 `receive`/`donate` **revert**(钱退回捐赠人);它阻止不了别人直转 Safe,也动不了 Safe 一分钱 | 把权限的真实半径写清,不让「暂停」听起来像能管钱 |

## 合约要点(v1 = 只做 vault)

- `HushFusionDonationVault`:`immutable TREASURY` + `Pausable` + `AccessControl(PAUSER_ROLE)`;`receive()` / `donate(uint8 bucket)`;事件 `DonationReceived`;`snapshot()` 一次 `eth_call` 拿总额 + 笔数 + 分桶
- 桶:**0 未指定**,1 公开基础层 / 2 验证层 / 3 原型层 / 4 公共运营层。桶是**意向标记**,钱全进同一个 Safe —— 这句必须写在页面上
- 不写进合约:`setTreasury`、代理、`delegatecall`、自毁、任何 `string`/`bytes` 参数、任何票据 NFT、任何排行榜逻辑
- 换金库 = 部署 v2 + 改 `config.json` 一行 + 公告(合约不持币,重部署很便宜)
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

## 治理与智能体

- 链上**没有投票合约**:捐赠不换权重、不存在「金额 → 权重」的映射代码;提案(仓库文件,id = sha256 前 16)→ 讨论 → 证据 → 意见 → Safe 3/5 执行
- 被签名的 Safe 交易 `data` 里必须带上**提案文件哈希**,签署人核对"我签的是哪份文档"——这是整条链最容易被社会工程打败的一环
- 智能体一阶段**不给任何私钥**(用"没有权限"实现五条禁令);允许读链、写提案草稿、生成待签名交易、对账;产出必须进 git,反对意见逐字保留 + 哈希
- 会话权限(Zodiac Roles / Safe Allowance 类)只登记为未来方向,v1 不做

## 前端契约(本轮只落 `preview` 态)

位置 `#status` → `#support`(`— 03 · Support`)→ 页脚;复用 `band` / `section-head` / `cap-list` / `quiet-cta` 体系,零新增依赖。
状态机:`preview`(通道未开放,**不显示任何地址与按钮**)· `ready` · `connected` · `wrong-chain` · `pending`(≥12 区块才算「已确认」)· `failed` · `paused`。
配置:`config.json` 增 `donate` 段(唯一地址来源,`enabled:false` 时地址一律 `null`);EIP-1193 + 错误码文案表;地址三层校验(`eth_getCode` 非空 / `vault.TREASURY() == config.treasury` / 人可核验路径),**任一失败就不显示捐赠按钮**;无 JS 用构建期注入的地址兜底(`deploy.sh` 从 `config.json` 注入,断言两处一致);移动端用 EIP-681 深链(只做普通转账)。

## 风险与前置

- **法律前置**:境内加密资产监管口径下,面向境内公开募资需专业意见 ⇒ 法律审查先于地址公开;「不可退款」「地址永久公开」必须写在按钮下方
- **反钓鱼**:合约不带 admin 是最强的一道;剩下靠"双渠道公告地址 + 源码验证 + commit 留痕"
- 完整定义、门槛清单(合约/运维/前端/法律四组)、验收断言、13 条待拍板项 → [`../DONATION-FUND-PLAN.md`](../DONATION-FUND-PLAN.md)

## 关联

- 设计全文:[`docs/DONATION-FUND-PLAN.md`](../DONATION-FUND-PLAN.md)
- 前端设计计划:[`DESIGN-PLAN.md`](../DESIGN-PLAN.md) §7.7
- raw 原文:`internal_sources/donation-plan/donation-plan-ai-draft-20260922.md`(sha256 `b5545edf8daa2c827b3f1f58fb64069ec60d71a0111dbce770a24a10f1dc6a0c`)
