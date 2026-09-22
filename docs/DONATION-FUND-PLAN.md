# HUSHFUSION 公开支持 / Open Research Fund —— 实现设计

| | |
|:--|:--|
| 版本 | v0.2 · 2026-09-22(需方第二轮决策后收敛) |
| 状态 | **设计稿**。本轮不写 `.sol`、不部署、不建 Safe、不接受真实资金;前端区块本轮最多落「未开放」预览态 |
| 输入 | ① AI 计划原文 `donation-plan-ai-draft-20260922`(sha256 `b5545edf8daa2c827b3f1f58fb64069ec60d71a0111dbce770a24a10f1dc6a0c`)② 需方 2026-09-22 决策 `donation-decisions-20260922`(sha256 `c680c178035934f6ac380299b6d0f6b61c4f680357aa9fc0e33b886044dec78b`) |
| 编译产物 | 本文(实现规范)+ [`DONATION-FREEZE.md`](./DONATION-FREEZE.md)(**设计冻结 v1.0**,冲突时以它为准)+ wiki 页 [`docs/wiki/donation-open-research-fund.md`](./wiki/donation-open-research-fund.md) |
| 口径 | 计划是**输入不是结论**。本文改写过它的四处:托管语义、暂停语义、**金库地址可换(两步 + 48h)**、治理权与利益分配的绑定方式(§2.4/§2.5/§七),其余照做 |
| 术语 | **「托管」指资金由 Safe 托管** —— 收款合约始终不持币,它是收款入口,**不是金库**(§一) |

---

## 零 一句话裁决

**Safe 是托管金库,收款合约是入口。** 捐款在同一笔交易内原样转给当前 Safe(pass-through);合约只负责四件事:记账 + 发事件 + 暂停新捐赠 + **受约束地改收款地址**。合约里**没有钱**可被偷 —— 余额恒为 0。

收款地址**可以换**(个人过渡主体 → 公司主体必须能换),但只有一条路:

> 当前 Safe 排程 → 提案哈希上链 → **等待 ≥48 小时** → 到期后**任何人**可执行(执行时治理权一并交给新 Safe)→ 仓库 commit + 站内公告 + 第二渠道同步

而且新地址**必须是经验证的 Safe** —— 不是「是个合约就行」:`_isVerifiedSafe` 要过五项(有代码 / 代理 runtime 代码哈希 / 单例槽 / 版本 / 阈值与所有者),全部在 Base 主网实测(§2.1、[`DONATION-FREEZE.md`](./DONATION-FREEZE.md) §1.3)。**个人热钱包与「长得像 Safe 的假合约」都被挡在代码外**。

设计冻结口径(状态机 / 权限矩阵 / 威胁模型 / 迁移流程 / 资金分配章程 / 智能体章程)在 [`DONATION-FREEZE.md`](./DONATION-FREEZE.md);两处冲突时**以冻结文档为准**。

---

## 一 三条实现路径与裁决

| 路径 | 是什么 | 优点 | 代价 | 裁决 |
|:--|:--|:--|:--|:--|
| **A 零合约** | 页面只显示 Safe 地址,捐款直转 Safe | 合约风险 = 0;gas 与普通转账相同 | 没有累计数 / 没有分桶 / 没有事件流;资金流只能靠第三方浏览器 API 反查;"暂停新捐赠"做不到 | 落选。但**保留为无 JS 兜底**(§6.6) |
| **B pass-through 收款合约(采用)** | `receive()`/`donate(bucket)` 把 `msg.value` 当场转给**当前 `treasury`**;只留计数器 + 事件 + 暂停 + 两步改址(48h) | 合约**永不持币** → 无可偷余额、无提款函数、不需要可升级代理;事件 = 原生公开账本;分桶意向可读;**公司成立后能把金库交给公司** | 每笔多一次外部调用(冷地址 ≈ +2.6k gas)+ 2–3 个存储槽写入;改址状态机本身也是审计面(§2.5) | **v1 采用** |
| **C 合约托管金库**(计划字面版:钱先进合约 → 记累计 → 管理员可暂停 → 多签提款) | 钱先进合约,再由多签提走 | 能做「合约层出账」 | 合约里躺着钱:重入/权限/升级/暂停冻结全部变成真问题;提款函数 = 单点;「暂停不冻资金」这句话在合约持币模型里说服力很弱 | v1 不用 —— 需方要的「托管」由 **Safe** 承担,不由合约承担 |

> 计划里的「拨款」不属于合约,属于多签金库本身:**合约管进,Safe 管出**。
> 出账天然是 Safe 的一笔普通交易 → 公开、可读、可对账,不需要合约参与。
> **术语澄清**:**「托管」= Safe 托管资金**(需方 2026-09-22 口径);收款合约是 pass-through 入口,一分钱都不留 —— 所以「托管」这个词不会把 §2.2/§2.4 的结论推翻。

---

## 二 合约 v1 规范 `HushFusionDonationVault`

### 2.1 接口(签名级)

```solidity
// SPDX-License-Identifier: MIT          // ← 待拍板,见 §13-6
pragma solidity 0.8.24;                   // evm_version 与 Base 支持范围对齐,部署前实测并写死

contract HushFusionDonationVault is Pausable, AccessControl {
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE"); // 只授给当前 Safe
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");   // 建议与 GOVERNOR 分离(§2.4)
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE"); // **必须**:改址执行的前置批准(§2.5)
    uint8   public constant BUCKET_COUNT   = 5;        // 0 = 未指定,1..4 = 四桶
    uint64  public constant TREASURY_DELAY = 48 hours; // 改址最短延时,写死,不可调

    // 金库身份:只接受**经验证的 Safe**(常量实测自 Base 主网,复算命令见 DONATION-FREEZE.md §十一)
    bytes32 public constant SAFE_PROXY_RUNTIME_HASH = 0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c;
    address public constant SAFE_L2_SINGLETON       = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    uint256 public constant MIN_SAFE_THRESHOLD      = 2;
    uint256 public constant MIN_SAFE_OWNERS         = 3;

    address public treasury;              // 当前 Safe(托管方)
    address public pendingTreasury;       // 待生效 Safe;0 = 无待生效
    uint64  public treasuryEta;           // 生效时间戳;0 = 无待生效
    bytes32 public treasuryProposalHash;  // 该次改址对应的提案文件哈希
    bool    public guardianApproved;      // GUARDIAN 是否已批准该次改址(= 执行的前置条件)

    uint256 public totalReceived;         // 累计(wei)
    uint256 public donationCount;
    mapping(uint8 => uint256) public bucketReceived;

    event DonationReceived(address indexed donor, uint8 indexed bucket,
                           uint256 amount, uint256 totalReceived, uint256 donationCount);
    event TreasuryForwarded(address indexed treasury, uint256 amount);
    event TreasuryChangeScheduled(address indexed from, address indexed to,
                                  uint64 executeAfter, bytes32 proposalHash);
    event TreasuryChangeApproved(address indexed to, bytes32 proposalHash, address indexed guardian);
    event TreasuryChangeApprovalRevoked(address indexed to, bytes32 proposalHash, address indexed guardian);
    event TreasuryChangeCancelled(address indexed to, bytes32 proposalHash);
    event TreasuryChangeExecuted(address indexed from, address indexed to, bytes32 proposalHash);

    error ZeroAmount();
    error BadBucket(uint8 bucket);
    error ForwardFailed();
    error NotAContract(address candidate);    // 挡掉 EOA
    error NotVerifiedSafe(address candidate); // 是合约但不是经验证的 Safe(2026-09-22 修正的核心)
    error NotApproved();                      // GUARDIAN 未批准
    error SameTreasury();
    error PendingExists();
    error NoPendingChange();
    error TooEarly(uint64 eta);

    constructor(address treasury_, address pauser_);   // treasury_ 必须是非空**合约**地址

    receive() external payable whenNotPaused;          // 等价于桶 0
    function donate(uint8 bucket) external payable whenNotPaused;

    // 改址:三步,没有单步路径
    function scheduleTreasuryChange(address newTreasury, bytes32 proposalHash)
        external onlyRole(GOVERNOR_ROLE);              // proposalHash == 0 → revert
    function approveTreasuryChange() external onlyRole(GUARDIAN_ROLE);  // **前置批准(必须)**
    function revokeApproval()        external onlyRole(GUARDIAN_ROLE);  // 到期前可撤回批准
    function cancelTreasuryChange()  external onlyRole(GOVERNOR_ROLE);  // 到期前可撤
    function executeTreasuryChange() external;         // 到期后**任何人**可执行(需已批准)

    function pause()   external onlyRole(PAUSER_ROLE);
    function unpause() external onlyRole(PAUSER_ROLE);

    function snapshot() external view
        returns (uint256 total, uint256 count, uint256[5] memory buckets);
}
```

内部顺序(`_accept`)固定为 **CEI**:① 校验(非零、桶合法)→ ② 记账 → ③ `DonationReceived` → ④ `treasury.call{value: amount}("")` → ⑤ 失败 `revert ForwardFailed()`。

改址的硬规则(**每一条都要有对应测试**,§九-B):

| 规则 | 为什么 |
|:--|:--|
| 新地址必须过 `_isVerifiedSafe` 五项:① 有代码 ② `codehash == SAFE_PROXY_RUNTIME_HASH` ③ `masterCopy() == SAFE_L2_SINGLETON` ④ `VERSION() == "1.4.1"` ⑤ `threshold ≥ 2` 且 `owners ≥ 3`,否则 `NotVerifiedSafe` | `code.length > 0` **只能证明「是个合约」**,恶意合约照样能过 —— 必须证明**「这是一个配置合规的真 Safe」**(需方 2026-09-22 安全修正) |
| 必须 GUARDIAN 已 `approveTreasuryChange()`,否则 `NotApproved` | 第二把**独立**钥匙:多签之外还有另一个独立的人/机构要点头 |
| **GOVERNOR 不得单方面撤销 GUARDIAN**(没有单人 `revokeRole(GUARDIAN_ROLE)` 路径) | 否则被控多签可以"撤 GUARDIAN → 排程 → 48h → 执行",防线形同不存在;换人只能走握手或 30 天公开路径(见 [`GUARDIAN-DESIGN.md`](./GUARDIAN-DESIGN.md) §四) |
| 新地址非零、且 `!= treasury`,否则 `SameTreasury` | 挡误操作与无意义操作 |
| 有待生效时再排程 → `PendingExists` | 同一时刻只能有一次待生效改址,不能叠加 |
| `executeTreasuryChange` 要求 `block.timestamp >= treasuryEta`,否则 `TooEarly(eta)` | 48h 是硬的,不是文案 |
| 执行成功:清空 `pendingTreasury`/`treasuryEta`,`GOVERNOR_ROLE` **从旧 Safe 转给新 Safe** | 否则旧 Safe 手里还留着改址权,公司迁移等于没迁 |
| 待生效期间,捐款仍进 `treasury`(旧 Safe) | 不留「钱进了哪个金库」的灰区;页面同时显示两个地址 + ETA |
| `proposalHash != 0`,并进事件 | 让「我签的是哪份提案」可核对(§七) |

### 2.2 为什么 v1 不需要 `ReentrancyGuard`(偏离 1)

计划的 OZ 清单把 `ReentrancyGuard` 列为常用工具 —— 那是给**持币**合约的。v1 合约余额恒为 0,重入能做的最坏事是"重入一次帮自己再捐一笔"。仍按 CEI 写(先记账后转账),省掉 2k gas 和一个修饰器。

**若 v1.1 引入持币或出账 → 那时必须补 `ReentrancyGuard` + pull-payment**(见 §三)。

### 2.3 合约里不写的东西(白名单纪律)

| 不做 | 原因 |
|:--|:--|
| 无代理 / 无 `delegatecall` / 无 `selfdestruct` | 合约不可升级:逻辑不会被换掉。改址是**有约束的治理事件**,不是后台开关(§2.5) |
| 无单步改址 / 无 `setTreasury(address)` | 只有 `schedule → ≥48h → execute` 一条路;不存在"一个人现在就能改"的入口 |
| 不接受 EOA / 不接受未经验证的合约作为金库 | `NotVerifiedSafe` 挡住个人热钱包与任何「长得像 Safe 的假合约」—— 托管方必须是**经验证的 Safe** |
| 无 `string` / `bytes` / memo 参数 | 链上文本不可删;一旦开了口,合约就变成永久公告栏与违法内容载体 |
| 不发 NFT / 代币 / 收据 | 可转让的凭证长得像份额,别去碰证券叙事的边 |
| 不记姓名 / 邮箱 / IP / 留言 | 与计划一致;事件只含 `donor` 地址 + 金额 + 桶 |
| 不做金额排行榜 / 不做"捐够 X 解锁 Y" | 会立刻制造付钱排位与刷量 |

### 2.4 暂停的诚实语义(偏离 2)

- 页面在 `paused` 时,`receive`/`donate` **revert** → 捐款失败、钱退回捐赠人,**不冻结任何已有资金**(合约没有资金)。
- 它**阻止不了**任何人直接转账到 Safe 地址 —— 没有合约能阻止。
- 它**动不了** Safe 里一分钱。
- ⇒ `PAUSER_ROLE` 是一个"拒绝服务级"权限,最坏后果公开可见、可恢复。因此 v1 建议**直接把 PAUSER 交给 Safe**(3/5,慢但无双人风险);若要"一键停"的热键,必须写明最坏后果 = 短时拒绝新捐赠。
- 页面必须在 `paused` 时显示「新捐赠已暂停」+ 原因 + 恢复预期,而不是让按钮静默失败。
- **与 48h 改址的关系(重要)**:时间锁买到的**是 48 小时的可见性,不是否决权**。多签若被完全控制,它既能排程也能执行 —— 唯一能"止血"的动作是 `pause()` 停住新捐赠 + 立刻公告。因此:
  - 建议 `PAUSER_ROLE` 与 `GOVERNOR_ROLE` **分离**(不同钥匙):否则被控的多签可以一边排程一边维持运行,外部没人能踩刹车;
  - `pause()` 从来不是"冻结资金":它只让新的捐款交易失败、钱回到捐赠人;已经进了 Safe 的钱,只有 Safe 自己能动。

### 2.5 金库地址可换:一条路、两步、48 小时(偏离 3,2026-09-22 需方决策改写)

原稿推荐"地址不可变 + 重部署"。需方的决策把它改了,理由是实的:**公司还没成立,个人只是过渡主体,成立后金库必须交给公司** —— 地址不可变意味着第一次主体迁移就要换合约、换前端、重发公告;而公司成立是可预期的事,不是意外。

"可换"被关进一条窄路(左列是顺序,**不能跳步**):

| 步 | 谁能做 | 动作 | 公开产物 |
|:--|:--|:--|:--|
| 1 排程 | 当前 Safe(GOVERNOR,需多签提案) | `scheduleTreasuryChange(newSafe, proposalHash)` | 提案文件(id = sha256 前 16)+ `TreasuryChangeScheduled(from, to, executeAfter, hash)` |
| 2 审阅 | 任何人 | 读事件 / 页面看双地址 + ETA + 倒计时 / 提反对意见(进仓库) | 页面 `treasury-pending` 状态(§6.2) |
| 2.5 **批准** | **GUARDIAN**(第二把独立钥匙) | `approveTreasuryChange()`;到期前可 `revokeApproval()` 撤回 | `TreasuryChangeApproved` / `TreasuryChangeApprovalRevoked`;**未批准时执行一定 revert `NotApproved`** |
| 3 取消 | 当前 Safe | `cancelTreasuryChange()` | `TreasuryChangeCancelled` —— **到期前随时可撤** |
| 4 执行 | **任何人**(无需许可) | `executeTreasuryChange()` | `TreasuryChangeExecuted` + `GOVERNOR_ROLE` 转给新 Safe |

配套要求(缺一条都算没做完这次迁移):

- 页面同时显示**旧地址、新地址、提案哈希、执行时间、当前状态**;不允许只显示新地址让人以为已经切了;
- 仓库 commit + 站内公告 + **第二渠道**(§九-D)同步;只改 `config.json` 不算迁移;
- 新地址必须是**经验证的 Safe**(§2.1 表):`NotVerifiedSafe` 把 EOA 与假合约都挡在代码外;链下还要**预部署 + 源码验证 + 人工核验 + 仓库 commit 公布 + 双渠道公告**(见 `DONATION-FREEZE.md` §1.3)。

**GUARDIAN 二次确认:从「可选」改成「必须」**(2026-09-22 修正)—— `approveTreasuryChange` 是 `executeTreasuryChange` 的前置条件。执行权**仍然公开**(到点且已批准后任何人可执行):这样「GUARDIAN 恰好不在」不会让迁移卡死,而「多签被控」也过不了第二把钥匙。人选与备份见 `DONATION-FREEZE.md` §11-2 / §11-3。

被控多签的诚实分析:**时间锁不是否决权,GUARDIAN 才是**。超过阈值的钥匙被控时,攻击者能排程、能等到点,但**批准不在他手里** —— 迁移执行不了;48 小时另给三样东西:看得见、能停新捐赠、能公告。残余风险因此收敛成一句话:**如果 GUARDIAN 与被控的签署人是同一批人(或同一台机器),这道防线等于不存在** —— 所以纪律是「三把钥匙互不兼任」(见 `DONATION-FREEZE.md` §二 权限矩阵)。

与旧方案的对比:

| | 不可变 + 重部署(原稿) | **可换 + 48h(已选)** |
|:--|:--|:--|
| 主体迁移(个人 → 公司) | 重新部署合约 + 改前端 + 重发公告 | 一次治理事件,合约与地址不变 |
| admin 面 | 无 | 有,但只有「Safe + 48h + 事件 + 可撤 + 任意人可执行」这一条路 |
| 审计面 | 更小 | 多一个改址状态机(测试与演练见 §九-B) |
| 新地址约束 | 编译期写死 | 运行期只接受合约地址(EOA 挡在代码外) |

**资金迁移是两件事,顺序不能反**:① 先把未来捐赠的路由切到公司 Safe(上面这条路径)→ ② 再由旧 Safe 发一笔多签交易,把存量资金转到公司 Safe → ③ 对账完成后旧 Safe 只读保留、签署人钥匙退役/轮换。完整流程见 §13.1-B。

### 2.6 资金桶编码与一句必须写在页面上的话

| 值 | 名称 |
|:--|:--|
| 0 | 未指定 / 通用(默认,等价于 `receive()`) |
| 1 | 公开基础层:论文、仿真、形式化证明、数据整理、审计、法律、基础设施 |
| 2 | 验证层:实验设计、测量方案、设备租赁与采购 |
| 3 | 原型层:安全审查 + 第三方复核 + 必要审批之后才进入 |
| 4 | 公共运营层:文档、节点、审计、社区工具、应急储备 |

**桶只是意向标记,不产生任何权利,也不锁定资金用途** —— 钱全部进同一个 Safe,分桶是公开信号,不是分账。
这句话必须原样出现在页面上;否则公众会以为"捐到第 3 桶的钱只能用于原型",而链上事实并非如此。

### 2.7 gas 量级(实测输入见 §四)

| 组成 | 量级 |
|:--|:--|
| `receive`/`donate` 基础开销 | ≈ 21k 起 |
| 计数器写入(3 个槽) | 首次(冷)≈ +20k/槽;之后热 ≈ +2.9k/槽 |
| 事件 | ≈ +2k |
| 转给 Safe(冷地址) | ≈ +2.6k |

⇒ 首笔捐赠比后续贵一档(冷槽);但 L2 执行费在 2026-09-22 的实测费率下是**千分之一美元量级**,真正的账单由钱包里的 L1 数据费决定(§四)。

---

## 三 里程碑登记(v1.1,本轮只定接口)

计划要求逐里程碑披露「目标 / 预算上限 / 执行方 / 风险 / 验收标准 / 已筹 / 已拨 / 已用 / 余额」。其中**只有一部分是链上事实**:

| 字段 | 链上可得? | 来源 |
|:--|:--|:--|
| 已筹(总额 / 按桶) | ✅ 权威 | vault 计数器 `snapshot()` |
| 单笔捐赠 | ✅ 权威 | `DonationReceived` 事件 |
| 金库余额 | ✅ 权威 | Safe 地址 `eth_getBalance`(**不是** vault 余额,vault 恒为 0) |
| 出账 / 已拨 | ✅ 权威(但要人工映射到里程碑) | Safe 转出交易 |
| 目标 / 预算上限 / 执行方 / 风险 / 验收标准 | ❌ 链下 | 仓库文件 → 哈希上链 |
| 已用 / 余额(按里程碑) | ⚠️ **多签声明**,不是链上事实 | Safe 声明 + 出账对账 |

因此 v1.1 的 `HushFusionMilestoneRegistry` 只做一件事:**让多签为"这笔出账属于哪个里程碑"背书**,而不是假装它证明了什么。

```solidity
contract HushFusionMilestoneRegistry is AccessControl {
    bytes32 public constant ATTESTER_ROLE;   // 只授予 Safe
    event MilestoneOpened(bytes32 indexed id, bytes32 indexed bucket, bytes32 contentHash, uint128 budgetCap);
    event SpendAttested(bytes32 indexed id, uint256 amount, bytes32 safeTxHash, bytes32 evidenceHash);
    event MilestoneClosed(bytes32 indexed id, bytes32 outcomeHash);
    // 非托管:不收钱、不转账、不能碰 vault / treasury;写权限只有 Safe
}
```

页面纪律:凡来自 registry 的数字,后面必须带 `多签声明` 标签,并与 Safe 的真实转出账并列显示。两者不一致时**以链上转账为准并标红**。

**v1 不做 registry**(先轻跑通):里程碑表先落在仓库文件里,每份文件的 sha256 记进 wiki;等 vault 在测试网跑满一轮再上 registry。

---

## 四 网络与地址(本轮实测,2026-09-22)

| 项 | 值 | 实测 |
|:--|:--|:--|
| Base 主网 chainId | `8453` = `0x2105` | `eth_chainId` @mainnet.base.org → `0x2105` ✅ |
| Base Sepolia chainId | `84532` = `0x14a34` | `eth_chainId` @sepolia.base.org → `0x14a34` ✅ |
| 公共 RPC | `https://mainnet.base.org` · `https://sepolia.base.org` | 均可用 ✅ |
| 浏览器 | `https://basescan.org` · `https://sepolia.basescan.org` | 对 curl 返回 403(反爬),人可正常访问 |
| SafeL2 v1.4.1 单例 | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` | `eth_getCode` @Base 主网返回完整 bytecode ✅(1.4.1 canonical 地址集见 safe-deployments) |
| 浏览器读链的 CORS | 预检 `access-control-allow-origin: *` | ✅ 前端可**无键直连**公共 RPC 读状态 |
| gasPrice / baseFee | `0.006 gwei` / `0.005 gwei` | 实测(主网,区块 51,636,968) |
| ETH/USD | `$2725.18` | CoinGecko,同时刻 |
| `eth_blobBaseFee` | `rpc method is unsupported` | ❌ 公共 RPC 不支持 → L1 数据费**无法**从公共 RPC 初算 |
| `eth_getLogs`(900 区块 + 地址过滤) | 返回结果 ✅ | 分窗可用 |
| `eth_getLogs`(5000 区块、无过滤) | `no backend is currently healthy to serve traffic` ❌ ×2 | **公开 RPC 不能当索引器** |

复现命令(照抄即可):

```bash
curl -s https://mainnet.base.org -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'          # → 0x2105
curl -s https://sepolia.base.org -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'          # → 0x14a34
curl -s https://mainnet.base.org -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["0x29fcB43b46531BcA003ddC8FCB67FFE91900C762","latest"]}'
```

成本口径(2026-09-22 实测费率):21000 gas × 0.006 gwei = `1.26e-7 ETH ≈ $0.0003`;v1 的 3 万 gas 量级 ≈ `$0.0005`。
**L1 数据费由钱包结算且本轮无法实测** ⇒ 页面只能写「预估,以钱包显示为准」,**不得**承诺任何绝对金额。

**读链架构(由实测推出)**:`hushfusion-donate` Worker(复用已有 Worker 模式)= 分窗 `getLogs` + 重试 + 结果缓存 + 可选第三方 key;页面优先读 Worker → 失败回落公共 RPC 直读 → 再失败显示「数据暂不可用」,**绝不把上一次的缓存数字当实时值显示**。

---

## 五 多签与密钥操作

| 项 | 取值 |
|:--|:--|
| 形态 | Safe(浏览器多签),**3/5** |
| 为何不是 2/3 | 5 人里允许 1 人失联 + 1 人钥丢失仍能签;2/3 里任意两人即可被动用,且一人失踪就卡死 |
| 角色分工 | 科学判断(提提案)/ 资金审批(多签签)/ 技术安全(能否决,靠「不签」)—— 三种角色不集中在同一人;**GUARDIAN 必须独立存在**(改址批准的前置条件,§2.5),且不与 GOVERNOR 同人 |
| 过渡主体(个人)→ 公司 | 过渡期由 **Safe** 承担托管,不得用个人热钱包当唯一控制点(合约层 `NotAContract` 已挡);公司成立后按 §13.1-B 迁移,`GOVERNOR_ROLE` 随 `executeTreasuryChange` 转到公司 Safe —— 不存在"个人私下改掉地址"的路径 |
| 签名纪律(硬性) | ① 签名前必须逐字比对 Safe 界面的 `to` / `value` / `data` 与提案文件内容;② 至少两人独立验证;③ 提案文件的哈希必须出现在被签的交易数据里(§七) |
| 备份 | 硬件钱包;助记词离线异地;至少一位签署人在不同司法辖区;签署人名单不公开但阈值公开 |
| 绝不设 | 「紧急单人提款」;任何**单人**就能改收款地址的开关(改址只有 §2.5 那条路,且新地址必须是合约) |

---

## 六 首页「公开支持」区块(前端契约)

### 6.1 位置与骨架

- `index.html`:`#status`(`— 02 · Status`)之后、`</main>` 之前,新增 `<section class="band" id="support" data-state="…">`
- kicker:`— 03 · Support`;文案走 `data-zh` / `data-en`(+ `data-html="1"` 需内联 HTML 时)
- 复用现有组件,不新增 CSS 语义:`band` · `section-head`(+`kicker`/`section-title`/`section-lede`)· `cap-list`(+`cap-no`/`cap-body`/`cap-tag`)· `quiet-cta` / `quiet-cta--solid` · `status` · `reveal` · `see-all`
- 动 CSS/JS ⇒ 四页(现五页)`?v=N` 全体 +1,`verify-site.mjs` 断言同步

### 6.2 状态机(本轮只落 `preview`)

| `data-state` | 触发 | 显示 | 禁止显示 |
|:--|:--|:--|:--|
| `preview` | `config.donate.enabled === false` | 四桶清单 + 治理原则 + 「通道未开放(待审计)」+ 一句"为什么现在不开" | 连接钱包按钮 / 任何地址 / 任何金额 |
| `ready` | `enabled === true`,未连钱包 | 已校验地址(EIP-55 大小写)+ 复制 + BaseScan 链接 + 链上统计(只读,**不需要钱包**)+ 「连接钱包」+ 「不可退款 / 地址永久公开」明示 | 无 |
| `connected` | `eth_requestAccounts` 成功 | 地址截断显示 + 网络名 + 金额选项(预设 + 自定义)+ 收款合约 + `eth_estimateGas` 预估 + 「预估,以钱包为准」 | 不显示 USD(见 §13-8) |
| `wrong-chain` | `eth_chainId !== config.donate.chainIdHex` | 「切换到 Base」按钮(`wallet_switchEthereumChain`,4902 → `wallet_addEthereumChain`) | 不得在错误网络上放行提交 |
| `pending` | 已 `eth_sendTransaction` | tx hash + BaseScan 链接 + 「待确认」;hash 存 `localStorage`,刷新后仍在 | 不得显示「已到账」 |
| `confirmed` | ≥12 区块(≈24s) | 「已确认 @ 区块 N」 | 不说"最终"(L1 最终性更长) |
| `failed` | 4001 / revert | 静默回落 `ready` + 一句人话原因(不弹红框) | 不自动重试 |
| `paused` | 链上 `paused() === true` | 「新捐赠已暂停」+ 原因 + 恢复预期 + Safe 链接 | 不得让按钮静默失败 |
| `treasury-pending` | 链上 `pendingTreasury != 0` | 顶部横幅:旧地址 → 新地址 + 提案哈希 + 执行时间(倒计时)+ 「到期前可撤」;明写「捐款仍进**旧**地址」 | 不得只显示新地址、不得暗示已切换 |

### 6.3 `config.json` 增量(站点唯一配置源)

```json
"donate": {
  "enabled": false,
  "chainId": 8453,
  "chainIdHex": "0x2105",
  "chainName": "Base",
  "rpc": ["https://mainnet.base.org"],
  "indexer": "https://hushfusion-donate.<account>.workers.dev",
  "explorer": "https://basescan.org",
  "vault": null,
  "treasury": null,          // 只当作"写下来的当前值";真相以链上 treasury() 为准,不一致就报警(§6.5)
  "vaultCodeHash": null,     // pendingTreasury / treasuryEta / treasuryProposalHash **不进** config,只从链上读
  "testnet": {
    "chainId": 84532, "chainIdHex": "0x14a34",
    "rpc": ["https://sepolia.base.org"], "explorer": "https://sepolia.basescan.org"
  }
}
```

规则:
1. `enabled: false` 时地址字段一律 `null`;**禁用时页面不得回退到任何硬编码地址**。
2. 地址**只在 `config.json` 出现一次**(§6.6 的静态注入是唯一例外,且必须脚本同源)。
3. 改地址 = 一次 commit = 公开审计线索;`config.json` 与 `app.js` 同 `?v=N`,避免旧缓存。

### 6.4 连接与提交(EIP-1193)

| 用途 | 调用 |
|:--|:--|
| 连接 | `eth_requestAccounts` |
| 读网络 | `eth_chainId` |
| 换网络 | `wallet_switchEthereumChain`(`{chainId: "0x2105"}`);`4902` → `wallet_addEthereumChain`(带 `chainName`/`rpcUrls`/`blockExplorerUrls`/`nativeCurrency`) |
| 预估 | `eth_estimateGas`(失败=会 revert,直接拦下) |
| 提交 | `eth_sendTransaction`(`to` = vault,`value` = wei,`data` = `donate(1)` 的 selector + 桶) |
| 监听 | `accountsChanged` / `chainChanged` / `disconnect` |

错误码文案:**4001** 你取消了签名(静默回落,不报警) · **4100** 钱包未授权 · **4200** 钱包不支持该方法(降级为"复制地址自己去钱包发") · **4900/4901** 钱包已断开 · **4902** 网络不在钱包里(弹添加) · **-32002** 上一条请求还在等签名(提示去钱包里看) · **-32603** 钱包内部错误(提示重试并给出 explorer 自查链接)。

所有金额换算用 **wei 整数运算**,禁止浮点(BigInt);显示 ≤6 位小数,全精度放 `title`;单位一律 `ETH`。

### 6.5 地址校验(反钓鱼,三层 + 可选第四层)

| 层 | 做法 | 失败时 |
|:--|:--|:--|
| ① 存在性 | `eth_getCode(vault)` 非空 | 不显示捐赠按钮 |
| ② 行为 | `vault.treasury()` 返回值 == `config.treasury`(纯 `eth_call`,不引入任何库);**若链上 `pendingTreasury != 0`,同时展示并将状态标为「迁移待生效」** | 同上 + 显示告警 |
| ③ 人可核验路径 | 页面给出:BaseScan 上**源码已验证**的合约页 + 仓库里 `config.json` 的 commit 链接 + 论文/公告中出现的同一地址 | 文案不得断言"已验证",只说"可自行核验" |
| ④(可选,Worker 侧) | Worker 算 `keccak256(eth_getCode(vault))` 与 `vaultCodeHash` 比对 | 同上 |

第④层放 Worker 的原因:浏览器 WebCrypto **没有 keccak256**;纯前端要引 ~10KB 库,与本站"零构建"相冲。

**任一层失败 ⇒ 不显示捐赠按钮,显示「未通过校验,请不要向任何地址转账」。**

### 6.6 无钱包 / 无 JS / 移动端

- **无注入钱包**(移动浏览器常见):给 EIP-681 深链 `ethereum:<vault>@8453?value=<wei>`(**只做普通转账 = 桶 0**,不带 `data` —— 钱包里显示看不懂的 calldata 才是更大的风险);配"复制地址"与 BaseScan 链接。是否再加 QR 见 §13-5。
- **无 JS**:`<noscript>` 里必须能看到地址与 BaseScan 链接。静态 HTML 里的地址由 `scripts/deploy.sh` 打包时从 `config.json` 注入(**构建期唯一来源**),并由 `verify-site.mjs` 断言"静态注入地址 == config.json 地址"。
- 未通过 §6.5 校验时,**绝不**鼓励转账;文案明确"不向未验证地址转账"。

### 6.7 显示纪律

- 页面上的**每一个数字**都要能追到 `eth_call` / 事件 / Safe 余额;拿不到就写"暂不可用"。
- 金库余额取 **Safe 地址余额**,不是 vault 余额(vault 恒为 0 —— 写错会常驻显示 0,像坏了一样)。
- 不显示"捐赠人数"以外的任何排名;不显示 donor 榜(除非 §13 决定公开,且必须同时给隐私提示)。
- 站点现有的"无追踪统计"承诺不变:**连接钱包不得引入任何分析上报**,钱包地址不得离开用户浏览器。

### 6.8 隐私提示(与链上事实一致的措辞)

必须出现在按钮下方,且不是"细则里的第二页":

> 捐赠不可退款。你的钱包地址、金额与时间会永久记录在公开区块链上,任何人可查,项目方无法删除。

加两条内部纪律:① 不在链上写任何文本/留言(将来若要,只上哈希,文本留链下);② **不承诺匿名** —— 这是诚实口径,不是缺点。

---

## 七 治理:把「投票通过」钉到「被签名的文档」上

```
提案(仓库文件,id = sha256 前 16) → 公开讨论 → 证据审查 → 社区意见 → Safe 多签执行
```

| 原则 | 实现方式 |
|:--|:--|
| 捐赠不换投票权 | 链上**没有**任何投票合约;治理权重只存在于人(zero on-chain voting) |
| 不按金额线性买权 | 同上 —— 不存在"金额 → 权重"的映射代码 |
| 投票通过 ≠ 自动转账 | 多签是唯一执行路径;合约(v1)没有任何出账函数 |
| 签署人签的是**哪份文档** | 被签的 Safe 交易 `data` 里带上该提案的 `contentHash`(v1.1 走 registry 的 `contentHash`);签署人核对"我签的哈希 == 提案文件哈希" |
| 分歧留痕 | 反对意见逐字进仓库(带哈希),不靠聊天记录 |

这一步是整个系统里**最容易被社会工程打败**的地方(钱包界面只显示你看得懂的一小段)。纪律:**看不懂就不签**。

### 7.1 治理原则(可执行条款,不是口号)

| # | 原则 | 落地方式 |
|:--|:--|:--|
| 1 | 角色分离 | 科学判断 / 资金审批 / 技术安全 / 改址二次确认(GUARDIAN)分属不同人;一个人不能同时是提案人和唯一审批人 |
| 2 | 提案即文件 | 每笔出账、每次改址都对应仓库里一份提案文件;哈希进交易 `data` 与链上事件 |
| 3 | 时间锁只用于改址 | 改址 48h(§2.5);出账走多签即时执行,**没有**"紧急后门" |
| 4 | 无链上投票 | 不做代币化权重;声誉来自贡献与领域评审,不进合约 |
| 5 | 否决 = 不签 | 反对的签署人不需要"投票按钮",只要不签;但反对意见**必须**留痕(仓库 + 哈希) |
| 6 | 利益冲突回避 | 给自己或关联方发钱,必须由其他人提案;提案人不得是唯一受益人 |
| 7 | 终止/退款/转桶 | 必须单独提案 + 公开结算(链上余额 → 处置表 → 执行交易哈希) |
| 8 | 争议通道 | 公开质疑入口(仓库 issue / 邮件)常开;回应写进 log,不删质疑 |

### 7.2 审计原则(谁审、审什么、多久、公开到什么程度)

| 层 | 谁来做 | 频率 | 产出 |
|:--|:--|:--|:--|
| 代码审计 | **独立第三方**(不是写代码的人) | 部署前;每次合约变更(含改址状态机变更)后 | 公开报告(可脱敏),未修项逐条列 |
| 资金审计 | 独立第三方或社区志愿者 | 每季度 | Safe 流水 ↔ 提案 ↔ 贡献者合同 **三方对账表** |
| 自动对账 | 定时任务(§九 末注) | 每日 | 链上 `snapshot()`/余额 ↔ 页面渲染值,不一致即告警 |
| 内部纪律 | 签署人 | 每次敏感操作 | 改址、阈值变更、超阈值出账 **双人复核**;签署人不做自己提案的唯一复核人 |
| 档案 | 仓库 + git 历史 | 永久 | 提案文件 + 事件哈希 + 审计报告全部进 git;审计底稿按税务/合规要求保留(≥5 年) |
| 口径 | —— | —— | **未完成的审计一律写"未审计"**,不得写"审计中"暗示已通过 |

### 7.3 三套账与利益分配边界(需方 2026-09-22 决策)

| 账 | 资金来源 | 用途 | 审批 | 公开到什么粒度 |
|:--|:--|:--|:--|:--|
| **捐赠账** | 链上捐款(经收款合约进 Safe) | 科研、审计、基础设施、安全、运营、应急储备 | 提案 + Safe 多签 | 总额 / 按桶 / 每笔出账 + tx 哈希 + 提案哈希 |
| **贡献者账** | 由捐赠账按提案拨入(+ 公司成立后的自有资金) | 工资、服务费、研究合同、里程碑奖金、报销 | 合同/协议 + 提案 + 多签 | 类别 + 预算 + 里程碑 + 合计;个人薪酬可只公开合计或区间,**不得伪装成科研拨款** |
| **商业收益账** | 公司产品、授权、专利、服务收入 | 按公司章程、劳动/服务合同、知识产权与投资协议分配 | 由公司法与合同法决定,链上只留痕 | 与捐赠账**分开披露**;不把商业收益算作捐赠来源 |

硬边界(与页面文案一致):

- 捐赠**不产生**股权、分红、回购权、收益权、代币、积分或任何可转让凭证;
- 未来商业收益的分配依据是**公司章程与合同**,不是捐赠金额;
- 智能体**不是**天然股东或收款主体:它产出可计费工作时,由背后能承担法律责任的个人/公司/机构签约并收款;
- 不把"贡献积分"包装成股份、债权或收益凭证(§十二-1)。

### 7.4 用哪些链上规范(选了的说清,不选的也说清)

**用**:EIP-55(地址校验显示)· EIP-1193(钱包连接)· EIP-681(移动端深链)· EIP-712(若引入链下结构化签名)· Safe Transaction Service(待签名交易 JSON 可读)· 通用惯例中的 **event-first + two-step + delay**(改址)。

**不用**:不发行 ERC-20 / 721 / 1155(无可转让凭证)· 不做链上投票(无 Governor / ERC-5805)· 不做代理升级(无 ERC-1967)· 不做 ERC-4626 类收益金库 · 不接跨链桥。

**"基本链上共识"的边界**(与 §13.1-D 一致):链上确认只保证"到账 / 出账 / 改址 / 提案哈希没有被悄悄改写",它**不等于**科学共识,也**不等于**治理合法性。

---

## 八 智能体的参与边界(落实计划的五条禁令)

| | 内容 | 技术约束 |
|:--|:--|:--|
| ✅ 允许 | 读链、写提案草稿、生成待签名 Safe tx JSON、链上对账、归纳支持/反对/未决意见 | 无任何私钥;所有产出进 git(可审计) |
| ❌ 禁止 | 单独控制金库 / 持无限额私钥 / 自批自己的提案 / 隐藏反对意见 / 代替人类完成多签 | 一阶段**根本不给钥** —— 用"没有权限"实现禁令,而不是用"禁止条款" |
| 🔜 未来(仅登记方向) | 限额、限时、限目标的会话权限 | Zodiac Roles Modifier / Safe AllowanceModule 一类模块 + 人工多签确认;**v1.1 再评估,不在 v1 范围** |

"隐藏反对意见"的工程解法:智能体的归纳输出必须**逐字引用**反对意见并附其哈希,且必须 commit —— 删了就看得出来。

---

## 九 上线门槛(四组,缺一不开门)

**A 合约** — 单测 ≥90% 行覆盖(含 `paused` / revert / 桶越界 / 零额 / Safe 拒收路径)· 模糊 + 不变量测试(`address(vault).balance == 0` 恒成立;`totalReceived == Σ 事件金额`)· 静态分析 · 独立第三方审计(范围含源码 + 部署脚本)· 浏览器源码验证 · 部署可复现(记录 solc 版本/优化器/evm_version,并比对 bytecode 一致)

**B 运维** — Safe 建成且**每位**签署人独立完成一笔测试交易 · pause/unpause 演练 · 失败交易演练(故意让 treasury 拒收,确认 revert 且不计数)· **改址演练四条路径**:① 排程 → 到期前取消 ② 排程 → 到期前执行(应 `TooEarly(eta)`)③ 排程 → 到期后**由非签署人**执行 ④ 给 EOA 排程(应 `NotAContract`)· **公司迁移演练**(Sepolia:另建一个临时 Safe 当"公司",验证 `GOVERNOR_ROLE` 转移 + 旧地址不再有改址权)· 主网真钱小额演练一次(≤ $1)

**C 前端** — 多钱包实测(MetaMask / Rabby / Coinbase Wallet / 手机钱包深链)· 切链 / 拒签 / 超时 / 断网各一次 · 静态注入地址 == `config.json` 断言 · `enabled=false` 时无连接按钮断言 · 375px 窄屏 · 无 JS 兜底可见

**D 法律 / 运营** — 接受捐赠的**主体**确定 · 退款与终止政策 · 税务口径 · 隐私政策补"链上公开"段 · 公告渠道(**改地址/停用必须走第二渠道**,不能只靠本站)

> 监测(可选但便宜):一个定时任务每天比对"链上 `snapshot()` / Safe 余额"与"页面渲染值",不一致就告警。CLI 会话收不到定时任务输出,要送达必须把 `deliver` 指向已连的消息平台。

---

## 十 法律 / 税务 / 运营(风险旗标,**不是法律意见**)

| 项 | 事实 / 需要确认的事 |
|:--|:--|
| 不可逆 | 链上无退款机制 ⇒ 「不可退款」必须写在按钮下方(§6.8) |
| 境内监管口径 | 2021 年十部门《关于进一步防范和处置虚拟货币交易炒作风险的通知》把虚拟货币相关业务活动定性为非法金融活动。**面向境内公开募集加密资产**的合规性必须有专业意见 ⇒ 法律审查**先于**地址公开 |
| 最小化姿态(降低暴露面) | 不发行、不承诺回报、不设金额榜、不面向境内公众推广、只公示金库地址与流向 |
| 主体 | **已选:个人过渡主体 → 公司主体**(§13.1-B)。过渡期不得用个人热钱包当唯一控制点;公司成立的时点同时决定"存量资金迁移 + 旧 Safe 退役"的时点。过渡期的个人责任、税务口径、退款政策必须在开放地址前书面确认(§13-9) |
| 税务 | 接受捐赠的入账与申报口径需与会计确认 |
| 数据 | 不采集个人信息;但钱包地址在个保法/GDPR 语境下的定性需写进隐私政策 |

---

### 10.1 法律闸门:不能把「捐赠」或「上链」当作免责标签

本方案不对任何法域作法律结论。**上链本身不等于非法集资**,但在中国境内开展公开虚拟货币募资必须先取得专业法律意见;
当前默认状态是**不公开地址、不接受真实资金**。

需要区分两层风险:

1. **非法集资风险**:是否向社会公众公开传播吸收资金信息、是否承诺货币/股权/实物或其他回报、主体是否具备相应资格、资金是否按公开用途使用等,由具体事实和当地主管部门认定。
2. **虚拟货币业务风险**:中国人民银行等部门 2026-02-06 发布的通知明确,虚拟货币相关业务活动以及代币发行融资等在境内属于应严格禁止的非法金融活动;互联网企业不得为相关活动提供网络经营场所、商业展示、营销宣传或付费导流。该通知同时废止了 2021 年同主题通知。

因此,本项目不能通过改名为“捐赠”、不发行代币、使用多签或写入“不可退款”来自动消除风险。技术上的透明、不可篡改和非托管,不能替代主体资格、税务、外汇、募资和公益/科研资质审查。

#### 10.1.1 两条合规路线

| 路线 | 资金方式 | 默认结论 |
|:--|:--|:--|
| 境内科研支持 | 由明确主体接收人民币,使用银行账户、合同/资助协议、发票/收据和会计审计;区块链只保存公开报告哈希或非资金证明 | 优先评估 |
| 境外加密捐赠 | 仅在目标法域设立合规主体、确定税务/AML/KYC/支付与募资资格后,再评估原生币收款;不得假定“部署在境外”就规避中国境内规则 | 未取得专业意见前禁止上线 |

如果公开中文页面、境内主体、境内团队或境内居民是实际目标受众,不能仅靠服务器、RPC、合约或前端地理限制来“解决”法域问题。
法律意见必须明确:主体、受众、宣传方式、收款资产、资金流、税务、退款、反洗钱、数据和公司迁移责任。

#### 10.1.2 上线闸门顺序

法律/税务主体确认 → 目标受众与法域确认 → 书面专业意见 → Safe 与合约审计 → Sepolia 演练 → 主网小额演练 → 受限开放。
任何一步未完成,首页只能是 `preview`,不显示真实地址、连接钱包、金额或捐赠按钮。

官方依据:

- [2026-02-06 中国人民银行等部门关于进一步防范和处置虚拟货币等相关风险的通知](https://www.csrc.gov.cn/csrc/c100028/c7614318/content.shtml)
- [《防范和处置非法集资条例》](https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_5ff55865b641475ca5d0c99dbb9c8ba1.html)

#### 10.1.3 降级路线:区块链只当「公开审计记录层」

如果法域判断的结论是"不能面向境内公开募集加密资产",本方案**不必整体作废** —— 可执行的那一半正好是**不含钱的那一半**:

| 保留 | 丢弃 |
|:--|:--|
| 报告 / 提案 / 对账表的**哈希锚定**(不可篡改的公开记录) | 收款合约的全部收款能力 |
| 任何人可复核的公开时间戳证据 | 连接钱包、公开任何地址 |
| 里程碑与验收标准的公开留痕 | 一切募资叙事与宣传 |
| 四桶 / 治理 / 审计原则的文字部分 | 「捐赠」「支持」「资助」等措辞 |

对应形态是一个**没有 `payable`、没有 `receive`、不收一分钱**的 `ResearchRecordAnchor`:只有 `record(kind, contentHash, ref)` + 公开事件 + 只读查询,提交权限控制在项目自己的钥匙(或 Safe)手里 —— 因为**没有钱可丢**,这里不要求多签,但要有密钥轮换与提交记录公开。
它**承担不了募资,也不会变成募资入口** —— 这正是它低风险的原因。

**2026-09-22 决策更新**:这条路已经是**当前首页路线**(不是"如果不行再说")。页面设计、数据格式、核验路径、验收断言见 [`RECORDS-LAYER-PLAN.md`](./RECORDS-LAYER-PLAN.md);锚定合约接口见那里的 §五。收款侧同时**冻结**:法域与主体未定 + 无独立第三方 GUARDIAN。

## 十一 验收断言(给 `verify-site.mjs` 的增量清单)

| 断言 | 期望(本轮预览态) |
|:--|:--|
| `#support` 存在 | `band` 类 + `kicker == "— 03 · Support"` |
| 预览态 | 无钱包按钮、页面文本中无任何 `0x…` 地址、有「未开放」标记 |
| 内容完整性 | 四桶 4 条 + 治理原则 3 条 + 不可退款提示各至少 1 处 |
| 无 JS | 关闭 JS 抓文本仍能读到「通道未开放」 |
| enabled=true 夹具(本地注入 config) | 地址出现且通过 EIP-55 校验 · explorer 链接指向 BaseScan · 按钮存在 · 静态注入地址 == config 地址 |
| `treasury-pending` 夹具(本地链上打桩) | 双地址 + 提案哈希 + 倒计时同时出现;文案明写「捐款仍进旧地址」;不得出现"已切换"字样 |
| 主题 | 新区块在夜/昼两套令牌下对比度达标(沿用现有 7 项主题断言的写法) |
| 图标 | 不变(3 项) |

---

## 十二 反模式清单(不要做)

1. 不发代币 / 不发可转让收据 NFT(一旦可转让就像份额)
2. 不做金额排行榜、"捐赠墙"排名
3. 不在链上存任何文本
4. 不做可升级代理、不留 admin 提款函数;**改址不留单人路径**(只有 §2.5 那条:合约地址 + 48h + 可撤 + 任何人可执行)
5. 不让智能体持钥,不用"禁止条款"代替"没有权限"
6. 不做"捐得多 → 提案优先"
7. 页面不出现"投资 / 回报 / 份额 / 收益"字样
8. 不用公共 RPC 做无窗口 `getLogs`(实测会失败)
9. 不把地址硬编码进 HTML(唯一例外:构建期从 `config.json` 注入)
10. 不显示 USD 估值(除非价格源经过 §6.7 的口径确认)
11. 不承诺匿名、不承诺可退款、不承诺"链上最终"
12. 不在 `enabled=false` 时显示任何地址或捐赠按钮
13. 不把 EOA 设成金库(合约层 `NotAContract` 挡住;页面也不得展示 EOA 收款地址)
14. 不在待生效期间只显示新地址、或暗示已经切换
15. 不把"链上确认"说成"科学共识";不把"审计中"说成"已审计"
16. 不把捐赠金额与任何形式的分配权挂钩(股权 / 分红 / 积分 / 排名)
17. 不留"GOVERNOR 单方面撤 GUARDIAN"的路径 —— 那等于把 §2.5 的防线拆掉
18. 不在没有独立 GUARDIAN 时进入真实资金部署(当前状态:收款侧冻结)

---

## 十三 待需方拍板(每条两种取值的后果)

| # | 决策 | 取值 A | 取值 B |
|:--|:--|:--|:--|
| 1 | 金库地址 | 不可变 + 重部署:最小权限,但公司成立后需换合约 | **可改 + 48h timelock(已选)**:仅 Safe 提案,延时后执行,全程留痕 |
| 2 | `PAUSER_ROLE` | 归 **Safe 3/5**(推荐):安全,停一次要凑签名 | 归单人 ops key:能秒停,但能滥用成拒绝服务 |
| 3 | v1 范围 | **只做 vault**(推荐):一次审计走得完 | 同时做 registry:里程碑上链更硬,但两倍审计面 |
| 4 | 首页本轮 | 落 **preview 态**(推荐):诚实、无死按钮 | 先不进页面:少一次 `?v=N` 全站升版 |
| 5 | 移动端 | **EIP-681 深链 + 复制地址**(推荐):零依赖 | 再加 QR:需要一个生成器或引入依赖 |
| 6 | 合约许可 | **MIT / Apache-2.0**:与源码验证配套 | 站点仍"保留所有权利";两者可并存,但需确认口径 |
| 7 | 单笔上限 | **不设**:简单 | 设上限:反粉尘/反刷量,但要多一个常量与文案 |
| 8 | USD 估值 | **不显示**(推荐):少一个价格源依赖 | 显示:多一个隐私/可用性依赖 |
| 9 | 主体与税务 | **个人过渡主体 → 公司迁移(已选)**:先完成法律/税务意见 | 先公开地址:法律风险自担 |
| 10 | 上线网络 | **先 Base Sepolia 演示一轮**(推荐) | 直接主网:审计与演练须先完成 |
| 11 | 改址二次确认 | **已定:必须**(2026-09-22 修正):`approveTreasuryChange` 是执行的前置条件 | ~~不加~~(作废 —— 被控多签就只剩「看得见」这一层) |
| 12 | 过渡 Safe 阈值 | **3/5**(推荐):容 1 人失联 + 1 人丢钥 | 2/3:更快,但两人即可被动用 |
| 13 | `PAUSER` 是否随迁移转移 | 跟随 `GOVERNOR` 一并交给公司 Safe(推荐):主体唯一 | 不跟随:过渡期钥匙留在个人手里,公司阶段要单独处置 |
| 14 | 48h 够不够 | 保持 48h(推荐,§2.5 写死) | 公司迁移用更长延时(如 7 天):要改常数或加"分档延时"逻辑 |
| 15 | GUARDIAN 换人机制 | 握手换人 + 30 天失联路径(推荐) | 不可变(换人=重部署合约)/ 单方 + 30 天(最弱) |

---

## 13.1 2026-09-22 需方决策:过渡主体、可迁移金库与利益分配

### A. 金库与收款合约的关系

本方案采用“Safe 托管 + pass-through 收款合约”:

- 捐赠合约不持有资金,收到的原生币在同一笔交易内转给当前 Safe。
- Safe 才是实际托管金库,负责出账、拨款与公司迁移。
- 合约允许更换当前 Safe,但没有单人改址权限。
- 收款地址变更必须由当前 Safe 发起,写入提案哈希,等待至少 48 小时,再由公开可调用的执行函数生效。
- 变更产生 `TreasuryChangeScheduled` / `TreasuryChangeCancelled` / `TreasuryChangeExecuted` 事件(签名级定义见 §2.1);期间页面显示旧地址、新地址、提案哈希、执行时间和状态。
- 任何地址变更都必须同步更新仓库 commit、站点公告和第二公告渠道;只改 `config.json` 不算完成迁移。

### B. 个人过渡主体 → 公司主体

公司尚未成立时,个人是法律与税务上的过渡主体,但不得使用个人热钱包作为唯一资金控制点。真实资金开放前应满足:

1. 建立过渡 Safe,明确 3/5 或经法律意见确认的多签阈值。
2. 公开“过渡主体”身份、责任范围、税务处理和不可退款提示。
3. 公司成立后,注册公司 Safe,准备公司章程/授权文件/税务信息的哈希。
4. 提交主体迁移提案:新 Safe 地址、公司文件哈希、余额快照、未完成拨款、旧 Safe 停用区块。
5. 48 小时公开审阅期后,先把未来捐赠路由切到公司 Safe,再由旧 Safe 通过另一笔多签交易把存量资金迁移到公司 Safe。
6. 完成链上余额、页面配置、源码/地址校验和双渠道公告后,旧 Safe 进入只读保留状态。

迁移不是后台改配置,也不是个人单方面转账;它是一个有前后顺序、可回溯、可对账的治理事件。

### C. 利益分配边界

捐赠资金与未来商业收益必须分账:

- **捐赠资金**只能用于公开提案批准的科研、基础设施、审计、运营和安全支出,不向捐赠人承诺分红、回购或收益。
- **贡献者回报**可以通过经批准的工资、服务费、研究合同、里程碑奖金或费用报销实现,每笔支出绑定提案哈希和预算。
- **未来商业收益**由公司独立账户接收,按照公司章程、劳动/服务合同、知识产权和投资协议分配;不能从捐赠账本直接推导股权或收益权。
- 不发行可交易治理代币,不把“贡献积分”包装成股份、债权或收益凭证。
- 对外公开总额、类别、预算和交易哈希;个人薪酬隐私可只公开合计或区间,但不得伪造为科研拨款。

智能体不是天然的股东或收款主体。智能体产生的可计费工作,必须由可承担法律责任的个人、公司或机构签订合同并收款;
智能体只能参与提案、审计、监测和生成待签名交易。未来若给代理执行权限,也必须独立设定限额、时限、目标地址和人工终审。

### D. 基本链上共识与治理规范

本项目把“链上共识”限定为可验证的事实层,不把区块确认误称为科学共识:

- 区块链确认:捐赠到账、Safe 出账、地址变更和提案哈希不可悄悄改写。
- 社区共识:提案、证据、反对意见、审议时间和最终决定公开留痕。
- 科学共识:由可复现数据、同行/领域审查和实验结果形成,不由捐款额或链上投票单独决定。
- 执行共识:Safe 多签签名人核对交易目标、金额、数据和提案哈希,至少两名签署人独立复核。
- 终止共识:项目暂停、终止、退款或转桶必须有单独提案和公开财务结算。

> 本节是**决策记录**;它的可执行版本是 §2.5(改址状态机)、§7.1(治理原则)、§7.2(审计原则)、§7.3(三套账)、§7.4(链上规范)。
> 两处若有出入,**以本节为准并回头修正文**(需方口径优先)。

### E. 新增上线门槛

在主体与公司迁移方案未完成法律/税务审查前,首页只保留 `preview` 态;不显示真实地址、钱包按钮或捐赠金额。
在主网开放前,必须额外验证:

- Safe 过渡主体的签署人、阈值与备份流程;
- 48 小时地址迁移的调度、取消和执行路径;
- 旧 Safe 到公司 Safe 的存量资金对账;
- 捐赠资金与商业收益的双账本方案;
- 贡献者/研究者/智能体服务费用的合同与审批模板;
- 地址变更的站内公告、仓库 commit 和第二渠道一致性。

## 十四 本轮不做(边界)

- 不写 `.sol` 文件、不部署、不验证源码、不接受真实资金
- 2026-09-22 第二轮(需方决策落地):只把**决策写进设计**(可换金库 + 两步 48h、个人过渡 → 公司迁移、三套账、治理与审计原则);**没有**写合约、没有建 Safe、没有开放任何地址
- 2026-09-22 第三轮(安全修正 + 六阶段计划):新增 [`DONATION-FREEZE.md`](./DONATION-FREEZE.md)(阶段一六件套);「新金库是合约」收紧为「**经验证的 Safe**」;GUARDIAN 从可选改为**必须**。仍然**没有**写合约、没有建 Safe、没有公开地址、没有连钱包、没有接受捐赠、没有启用 `config.donate.enabled`、没有开放首页按钮
- 首页区块本轮**最多**落 `preview` 态(取决于 §13-4)
- 里程碑 registry、Worker 索引器、监测任务:只在本文件里定接口与职责,**不实现**
- 产物:本文 + wiki 页 + raw 登记 + 门禁
