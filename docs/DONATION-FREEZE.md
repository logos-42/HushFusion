# HUSHFUSION 公开支持 / Open Research Fund —— 设计冻结 v1.0

| | |
|:--|:--|
| 版本 | v1.1 · 2026-09-22 · **阶段一(设计冻结)出稿,待需方签署** |
| 前置条件 | ⚠️ **法律闸门**:本冻结**不等于可以上线**。任何收款相关条目的执行,都以阶段二的书面专业法律意见为前置(§八 / `DONATION-FUND-PLAN.md` §10.1) |
| 当前状态(2026-09-22) | 资金路线 = **境外募资**(法域与主体未定 → 收款侧**冻结**);首页路线 = **公开记录**(`#records`,不是捐赠入口);**唯一硬阻塞 = 没有独立第三方 GUARDIAN**。三件可推进的工作:公开记录层 / 法域与主体筛选 / GUARDIAN 候选机制 |
| 范围 | 只冻结设计与审计准备。**不写 `.sol`、不建 Safe、不公开地址、不连钱包、不接受捐赠、不启用 `config.donate.enabled`、不开放首页按钮** |
| 输入 | 需方 2026-09-22 第三轮(raw:`donation-security-and-phases-20260922`) |
| 实现规范 | [`DONATION-FUND-PLAN.md`](./DONATION-FUND-PLAN.md)(**本文冻结口径,那份写怎么做**;冲突时以本文为准) |
| 共识页 | [`wiki/donation-open-research-fund.md`](./wiki/donation-open-research-fund.md) |

> 本轮的起点是需方指出的一处**真实安全缺陷**:`newTreasury.code.length > 0` 只能证明"这是个合约",**不能证明"这是个 Safe"** —— 恶意合约同样能通过检查,而 `GOVERNOR_ROLE` 会随之被转走。§1.3 给出的是**可验证的修法**(不是"多加一句提醒"),并在 Base 主网实测过。

---

## 零 冻结清单(逐条待签)

| # | 条目 | 冻结内容 | 状态 |
|:--|:--|:--|:--|
| 1 | Safe 托管模型 | Safe 持币;收款合约 pass-through,**余额恒为 0** | ✅ 冻结 |
| 2 | 主体 | 个人 = 过渡法律主体;公司成立后迁移 | ✅ 冻结 |
| 3 | 过渡 Safe | **3/5**;合约侧要求 `threshold ≥ 2` 且 `owners ≥ 3` | ✅ 冻结 |
| 4 | 金库变更 | 两步 + **48h** + 到期后公开执行 + 到期前可撤 + 全程事件 | ✅ 冻结 |
| 5 | **新金库身份校验** | 必须是**经验证的 Safe**:代理 runtime 代码哈希 + 单例槽 + 版本 + 阈值/所有者(§1.3) | ✅ 冻结(本轮修正) |
| 6 | **GUARDIAN 二次确认** | 由"可选"改为**必须**:第二把独立钥匙批准后才可执行(§2) | ✅ 冻结(本轮修正) |
| 7 | 三套账 | 捐赠账 / 贡献者账 / 商业收益账 **完全分开**(§5) | ✅ 冻结 |
| 8 | 智能体 | 无私钥、无单独执行权、产出进 git、异议逐字留痕(§6) | ✅ 冻结 |
| 9 | 首页 | 只显示 `preview`:「通道未开放,待主体、法律和安全审查完成」 | ✅ 冻结 |
| 9.5 | **法律闸门** | 法域与受众判断 → 书面法律/税务意见 → 才谈地址与资金;此前首页只有 `preview` | ✅ 冻结 |
| 9.6 | **降级路线** | 若不能公开募资:保留「公开审计记录层」(`ResearchRecordAnchor`,不收钱),丢弃一切收款能力(§九) | ✅ 冻结 |
| 10 | **首页路线** | 区块 = `#records`「公开记录 / Open Research Records」:只发哈希与时间戳,无地址、无钱包、无金额、无 CTA | ✅ 冻结(设计) |
| 11 | **资金路线** | 境外募资;法域与主体未定前不写募资文案、不部署收款合约 | ⛔ 冻结中 |
| 12 | **GUARDIAN** | 独立第三方(六条资格);不到位则收款路线**不进入真实资金部署**;换人机制必须堵住「绕过 GUARDIAN」路径(§一 T-G / §三 T1) | ⛔ 阻塞中 |
| 10 | 不变量 | 接口冻结前 11 条不变量 + 测试映射(§7) | ✅ 冻结 |

需方逐条签署后,阶段一结束;任何一条要改,必须改本文并重新签署(不改实现规范）。

---

## 一 合约状态机

### 1.1 两个正交维度(不是一个大状态机)

```
收款状态:   Active  ⇄  Paused                    （PAUSER 控制）
金库配置:   Stable  →  PendingChange  →  Stable  （GOVERNOR + GUARDIAN + 48h）
```

**暂停与改址互不影响**:暂停期间仍可排程/批准/执行改址;改址过程中暂停状态不变。这样避免了"暂停能不能当否决"这类要靠文档解释的问题。

### 1.2 转移表

| # | 从 | 触发 | 谁能做 | 到 | 副作用 | 事件 |
|:--|:--|:--|:--|:--|:--|:--|
| T1 | Active / Stable | `donate(bucket)` 或有 calldata 的转账 | 任何人 | 不变 | `totalReceived`/`donationCount`/`bucketReceived` +1;`msg.value` 原样转给 `treasury`;失败则整体 revert | `DonationReceived` + `TreasuryForwarded` |
| T2 | Paused | `donate` / 裸转账 | 任何人 | 不变 | **revert**(钱退回捐赠人) | —— |
| T3 | Active | `pause()` | PAUSER | Paused | 只停"进" | `Paused` |
| T4 | Paused | `unpause()` | PAUSER | Active | —— | `Unpaused` |
| T5 | Stable | `scheduleTreasuryChange(newSafe, proposalHash)` | GOVERNOR(当前 Safe) | PendingChange | 写 `pendingTreasury`/`treasuryEta = now+48h`/`treasuryProposalHash`;要求 `_isVerifiedSafe(newSafe)` | `TreasuryChangeScheduled` |
| T6 | PendingChange | `approveTreasuryChange()` | **GUARDIAN** | PendingChange(已批准) | 置 `guardianApproved = true` | `TreasuryChangeApproved` |
| T7 | PendingChange(已批准) | `revokeApproval()` | GUARDIAN | PendingChange(未批准) | 撤回批准(到期前有效) | `TreasuryChangeApprovalRevoked` |
| T8 | PendingChange | `cancelTreasuryChange()` | GOVERNOR | Stable | 清空三个槽 | `TreasuryChangeCancelled` |
| T9 | PendingChange(已批准, 且 `now ≥ eta`) | `executeTreasuryChange()` | **任何人** | Stable | `treasury = pendingTreasury`;清空;`GOVERNOR_ROLE` 从旧 Safe 转给新 Safe | `TreasuryChangeExecuted` |
| T10 | PendingChange(未到点) | `executeTreasuryChange()` | —— | 不变 | **revert `TooEarly(eta)`** | —— |
| T11 | PendingChange(未批准) | `executeTreasuryChange()` | —— | 不变 | **revert `NotApproved()`** | —— |
| T12 | Stable | `schedule` 第二次 | GOVERNOR | 不变 | **revert `PendingExists()`** | —— |
| T13 | 任何 | 给 EOA / 未经验证合约排程 | GOVERNOR | 不变 | **revert `NotVerifiedSafe(candidate)`** | —— |
| T-G1 | 任何 | 换 GUARDIAN:现任失联路径(30 天公开延时) | GOVERNOR | 不变 | 记录 `guardianRotateEta = now+30d`;期间 `pause` 必须已生效 + 双渠道公告 | `GuardianRotationScheduled` |
| T-G2 | 待换人 | 新 GUARDIAN 接受 | 候选 GUARDIAN | 生效 | `GUARDIAN_ROLE` 转给新地址 | `GuardianRotationAccepted` |
| T-G3 | 待换人 | 现任 GUARDIAN 释放(握手) | 现任 GUARDIAN | 生效 | 与 T-G2 同时满足才换人 | `GuardianReleased` |
| T-G4 | 任何 | GOVERNOR **单方面**撤销 GUARDIAN | —— | 不变 | **不允许**:没有 `revokeRole(GUARDIAN_ROLE)` 这条单人路径(否则 撤 GUARDIAN → 排程 → 48h → 执行 = 防线形同不存在) | —— |

**执行权保持公开**(T9 是"任何人")的原因:不能让"GUARDIAN 恰好不在"变成迁移卡死的唯一原因。GUARDIAN 的权力体现在 **T6 的批准**上 —— 是一个**先决条件**,不是一个必须亲自到场的动作。

### 1.3 新金库身份校验(本轮的修正,已在 Base 主网实测)

**问题**:`code.length > 0` 对恶意合约同样成立。
**修法**:把"是不是 Safe"变成**可验证的事实**,而不是"看检查通过没通过"。

Safe 代理的 runtime 是**固定的 171 字节**,任何人都能复算;它做的事是:读 **storage slot 0** 作为单例地址,`masterCopy()` 直接返回它,其余调用 `DELEGATECALL` 给它。

```solidity
// 全部实测自 Base 主网 Safe v1.4.1(§十二 给出复算命令)
bytes32 constant SAFE_PROXY_RUNTIME_HASH = 0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c;
address constant SAFE_L2_SINGLETON       = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
uint256 constant MIN_SAFE_THRESHOLD      = 2;
uint256 constant MIN_SAFE_OWNERS         = 3;

function _isVerifiedSafe(address c) private view returns (bool) {
    if (c.code.length == 0) return false;
    if (c.codehash != SAFE_PROXY_RUNTIME_HASH) return false;               // ① 只有 Safe 代理的 runtime 能过
    if (ISafeProxyLike(c).masterCopy() != SAFE_L2_SINGLETON) return false;  // ② 单例槽位必须是官方单例
    ISafe s = ISafe(c);
    if (keccak256(bytes(s.VERSION())) != keccak256("1.4.1")) return false;  // ③ 版本
    if (s.getThreshold() < MIN_SAFE_THRESHOLD) return false;               // ④ 阈值
    if (s.getOwners().length < MIN_SAFE_OWNERS) return false;              // ⑤ 所有者数
    return true;
}
```

为什么这是**证明而不是启发式**:① 的 runtime 是**写死的代码**,恶意合约改不了它 —— 想让 `codehash` 匹配,就只能部署一个**真的 Safe 代理**;而真代理只会把调用 `DELEGATECALL` 给 ② 里那个官方单例。所以 ④⑤ 拿到的是**真 Safe 的回答**,不是骗子编的。反过来看:只调 `getOwners()` 判断"像不像 Safe"是**假的** —— 任何人都能实现一个返回漂亮数字的合约。

链下必须同时完成的四件事(**缺一件不做转移**,这是治理而非代码能兜住的):

1. 新 Safe 是**预先部署**的(不是排程那一刻现造的);
2. 浏览器上**源码/代理已验证**,并且人工在 Safe{Wallet} 里核对 owners 与 threshold;
3. 之前已在**仓库 commit** 里公布过该地址;
4. **双渠道**公告(仓库 + 第二渠道)。

诚实的边界:以上只能证明"这是一个真的、配置合规的 Safe",**不能证明"控制它的人是谁"**。一个攻击者自己建的合法 Safe 同样能通过全部五项。所以 §6 的 GUARDIAN 批准与 48h 公告不是装饰,是这套设计里**唯一的**人际防线。

版本注意:safe-deployments 已有 **v1.5.0**(Base 上其 factory 已部署但近期无创建记录,实测 900 区块内 0 条)。如果过渡 Safe 用 1.5.0 创建,必须**重测其代理 runtime 哈希与单例地址**再改这份常量;允许"钉一个版本并重部署"或"钉一个含 2 个版本的小白名单",取舍见 §10。

---

## 二 角色权限矩阵

| 动作 | GOVERNOR(当前 Safe 3/5) | PAUSER(独立钥匙) | GUARDIAN(独立钥匙) | 公众 | 智能体 |
|:--|:--|:--|:--|:--|:--|
| `donate` / `receive` | ✅ | ✅ | ✅ | ✅ | ✅(若替别人发交易,则用的是别人的钱包) |
| `snapshot` / 读链 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pause` / `unpause` | ❌(需单独授予) | ✅ | ❌ | ❌ | ❌ |
| `scheduleTreasuryChange` | ✅ 必须多签 | ❌ | ❌ | ❌ | ❌ |
| `approveTreasuryChange` / `revokeApproval` | ❌ | ❌ | ✅ 单把钥匙即可 | ❌ | ❌ |
| `cancelTreasuryChange` | ✅ 必须多签 | ❌ | ❌ | ❌ | ❌ |
| `executeTreasuryChange` | ✅ | ✅ | ✅ | ✅ 到点后 | ❌(不代签) |
| 提款 / 转账出金库 | ✅ **在 Safe 里**做,合约里没有这个函数 | ❌ | ❌ | ❌ | ❌ |
| 改阈值 / 换签署人 | ✅ Safe 内部治理 | ❌ | ❌ | ❌ | ❌ |
| 升级合约 / 改逻辑 | 无此权限(非代理合约) | ❌ | ❌ | ❌ | ❌ |

三条纪律:

1. **三把钥匙互不兼任**(同一个人不得同时持 GOVERNOR 与 GUARDIAN;PAUSER 也尽量独立)。
2. **签名前逐字比对** `to` / `value` / `data` 与提案文件,至少有**两人独立**核对(§6)。
3. 过渡期谁当 GUARDIAN 是个真问题(个人主体 + 公司未成立):候选 = 独立第三方签署人(如合作方/法律顾问)。**未定,见 §11-3**;在定下来之前,阶段三不结束。

---

## 三 威胁模型

**资产**:① Safe 内的捐赠资金 ② 三种权限(GOVERNOR/PAUSER/GUARDIAN)③ 对外公布的地址(config.json / HTML)④ 域名与前端产物 ⑤ 提案与审计档案 ⑥ 智能体产出。

**信任边界**:捐赠人浏览器 → 前端产物(Cloudflare Pages)→ RPC(公共)→ 收款合约 → Safe → 人(签署人)。

| # | 威胁 | 场景 | 现有缓解 | 残余风险 |
|:--|:--|:--|:--|:--|
| T1 | 恶意改址 | 3/5 被控 → 排程改址到攻击者的 Safe | 经验证 Safe(§1.3)+ GUARDIAN 批准 + 48h + 双渠道公告 | GUARDIAN 同时被控 → **无代码解**,只能靠"钱少 + 公开 + 追索" |
| T1b | **绕过 GUARDIAN** | 被控多签先**撤掉 GUARDIAN**,再排程 → 48h → 执行 | 合约层不允许 GOVERNOR 单方撤销 GUARDIAN(T-G4);换人只能走握手或 30 天公开路径 | 30 天路径本身是已知弱化项 → 必须 `pause` + 双渠道公告;当前无 GUARDIAN 时此风险不适用(收款侧已冻结) |
| T2 | 假 Safe | 攻击者用普通合约冒充 Safe,骗过 `code.length` | 代理 runtime 哈希 + 单例槽 + 版本 + 阈值/所有者(§1.3) | 攻击者自建**真** Safe → 由 T1 防线接手 |
| T3 | 前端钓鱼 | 克隆站 / CDN 被劫 / config 被改 | config 单一来源 + 三层校验(未过校验不显示按钮)+ commit 留痕 + 双渠道公告 + EIP-55 | 用户不看校验、直接照抄地址 |
| T4 | EOA 冒充金库 | 把个人热钱包设成金库 | 合约层 `NotVerifiedSafe` 直接挡住 | 无 |
| T5 | 迁移卡死 | GUARDIAN 失联 / 阈值凑不齐 | `cancel` 后重排;签署人备份;公开说明"资金仍在旧 Safe,安全,只是迁移延后" | 长期无法迁移 |
| T6 | 捐错金库 | 待生效期间捐款进了旧地址 | 页面双地址 + ETA + 明写"仍进旧地址" | 捐赠人未读提示 |
| T7 | 钥匙被偷/勒索 | 单点失窃 | 硬件钱包 + 地理分散 + 3/5 阈值 + 至少一位异地签署人 | 两人被同时施压 |
| T8 | 供应链 | 依赖库/构建/部署脚本被替换 | 固定依赖版本 + 源码验证 + **部署脚本也审计** + 记录 solc/优化器/evm_version | 编译器后门(低概率) |
| T9 | 智能体被劫持 | 提示注入 / 模型被换 → 伪造提案或对账 | **无任何私钥**;产出进 git;签署人终审;异议逐字留痕 | 人类签署人轻信智能体摘要 |
| T10 | 法律/合规 | 境内公开募资定性、税务、退款 | 阶段二前置法律意见;**法律未清不公开地址** | 监管口径变化 |
| T11 | 拒绝服务 | 用 `pause` 长期停捐 | 公开可见 + 事件 + PAUSER 换钥流程 | 停捐期间收不到钱(无资金损失) |
| T12 | 内容风险 | 捐款人往 calldata 塞文本/攻击性内容 | 接口无 `string`/`bytes`;不解析 calldata | 链上已有内容无法删除(只能页面不展示) |
| T13 | 单点托管 | 过渡期全用个人 EOA | 一律用 Safe(个人只是"法律主体",不是"唯一控制点") | 个人同时是唯一签署人时退化 |

> T1 与 T2 是这套设计里**唯一能靠代码大幅收窄**的两个;其余最终都落在"人多、公开、慢"上。

---

## 四 主体迁移流程(个人过渡 → 公司)

**前置文件(缺一不动)**:① 公司注册证明 + 章程 ② 授权文件(谁有权代表公司控制 Safe)③ 税务登记 ④ 新 Safe 的 owners/threshold 决议 ⑤ 余额快照与未完成拨款清单 ⑥ 提案文件(含上述文件的哈希)。

**顺序(不能颠倒)**:

| 步 | 动作 | 产出 |
|:--|:--|:--|
| 1 | 建立公司 Safe(预先部署,**不用个人 EOA**) | 公司 Safe 地址 + 经验证(§1.3)+ 源码/人工核验 |
| 2 | 仓库 commit 公布该地址 + 第二渠道公告 | 公告文本 + commit hash |
| 3 | 旧 Safe 发 `scheduleTreasuryChange(公司Safe, proposalHash)` | `TreasuryChangeScheduled` |
| 4 | GUARDIAN 审阅并 `approveTreasuryChange()` | `TreasuryChangeApproved` |
| 5 | 等待 ≥48h,期间任何人可提异议 | 异议档案 |
| 6 | 任何人 `executeTreasuryChange()` | `TreasuryChangeExecuted`;**未来捐赠路由已切到公司 Safe**;GOVERNOR 转给公司 Safe |
| 7 | 旧 Safe 另发**一笔**多签交易:把存量资金转到公司 Safe | 转账 tx 哈希 |
| 8 | 三方对账(链上余额 ↔ 提案 ↔ 合同) | 对账表(公开) |
| 9 | 旧 Safe 进入**只读保留**:不再持有任何角色;签署人钥匙退役/轮换 | 权限清单(公开:谁现在持有什么) |

**失败回退**:第 5 步前任何一步都能 `cancelTreasuryChange()` 回到 Stable;已执行的改址**不可撤回**,只能再走一次(反向迁移),所以第 3–6 步之间的审阅是唯一安全窗口。

**顺序为什么不能反**:先切路由再搬存量,能让"新捐赠"与"旧资金"各自只有一个归属时刻;颠倒了就会出现"钱已搬走但捐赠仍进旧地址"的窗口。

---

## 五 资金分配章程

**三套账完全分开**(不共用账户、不互相回填):

| 账 | 资金来源 | 用途 | 审批 | 公开粒度 |
|:--|:--|:--|:--|:--|
| **捐赠账** | 链上捐款 → Safe | 科研、审计、基础设施、运营、安全、应急储备 | 提案 + Safe 多签 | 总额 / 按桶 / 每笔出账 + tx 哈希 + 提案哈希 |
| **贡献者账** | 捐赠账按提案拨入(+ 公司自有资金) | 工资、合同、服务费、里程碑奖金、报销 | 合同/协议 + 提案 + 多签 | 类别 + 预算 + 里程碑 + 合计;个人薪酬可只公开合计或区间 |
| **商业收益账** | 公司产品、授权、专利、服务收入 | 按公司章程、劳动/服务合同、知识产权与投资协议分配 | 公司法与合同法 | 与捐赠账**分开披露** |

**每笔支出必须绑定 6 项**:目标里程碑 / 预算上限 / 执行方 / 风险说明 / 验收标准 / 交易哈希。

**禁止(写进章程)**:

- 捐赠**不产生**股权、分红、回购权、收益权、代币、积分或任何可转让凭证;
- 商业收益**不得回填**捐赠账充当来源,也不得用捐赠账给商业项目兜底;
- 个人薪酬**不得伪装成科研拨款**;
- 智能体不是天然股东/收款主体:可计费工作由背后能承担责任的主体签约收款;
- 不设金额排行榜,不做"捐得多 → 提案优先"。

---

## 六 智能体参与章程

| | 内容 | 技术约束 |
|:--|:--|:--|
| ✅ 允许 | 读链、整理研究资料、起草提案、复现仿真、对账与异常发现、生成**待签名**交易、归纳社区意见 | 无任何私钥;产出必须进 git |
| ❌ 禁止 | 持无限额私钥、单独操作 Safe、批准自己的提案、隐藏反对意见、自动分配资金、替代人类完成多签 | 一阶段**根本不给钥**(用"没有权限"实现禁令) |
| 🔜 未来(仅登记) | 限额、限时、限目标的会话权限 | Zodiac Roles / Safe Allowance 一类模块 + 人工多签终审;v1.1 再评估 |

**产出纪律(可审计的写法)**:智能体的每份摘要必须 ① 逐字引用反对意见并附哈希 ② 附证据链接 ③ 由人类签署人终审。删改可从 git 历史看出来。

---

## 七 接口冻结前的 11 条不变量(阶段四的验收对象)

| # | 不变量 | 怎么测 |
|:--|:--|:--|
| I1 | 合约 ETH 余额**恒为 0** | 不变量测试(`address(vault).balance == 0`)+ fuzz |
| I2 | 新金库必须是**经验证的 Safe**(§1.3 五项) | 单测:EOA / 普通合约 / 假 Safe → 全部 `NotVerifiedSafe`;真 Safe → 通过 |
| I3 | 同时只能存在**一个**待生效迁移 | 单测:第二次 `schedule` → `PendingExists` |
| I4 | **48h 不可缩短**(常量,无 setter) | 单测 + 静态检查;到点前执行 → `TooEarly` |
| I5 | 到期前**只能取消,不能执行** | 单测:T10 |
| I6 | 执行后**旧 Safe 不再拥有改址权** | 单测:执行后旧 Safe 调 `schedule` → `AccessControlUnauthorizedAccount` |
| I7 | 迁移期间捐赠**仍进旧 Safe** | 单测:待生效期捐赠 → `TreasuryForwarded(旧地址)` |
| I8 | Safe 拒收时**账本不增加** | 单测:mock 金库 revert → 整笔 revert,`totalReceived` 不变 |
| I9 | **不存在**提款 / 代理升级 / 单人改址函数 | 静态检查(ABI diff + 选择器清单比对) |
| I10 | 未获 GUARDIAN 批准**不能执行** | 单测:T11 |
| I11 | 事件与状态**永远一致**(计数 = Σ 事件金额;`treasury` 变化必有 `Executed`) | 不变量测试 + 事件重放对账 |

**冻结动作**:以上 11 条通过后接口才能冻结;冻结后的任何签名变更都要重跑全表。

---

## 八 六阶段门禁

| 阶段 | 内容 | 出口标准 | 现在 |
|:--|:--|:--|:--|
| 一 | **设计冻结** | 本文六件套 + 需方逐条签署 | ✅ 出稿,**待签** |
| 二 | 治理与法律前置 | 主体责任 / 税务 / 退款 / 分账 / 公开声明 / 法律意见 | ⛔ 未开始 |
| 三 | Safe 运维设计 | 过渡 Safe 3/5 + 硬件钱包 + 双人核对流程 + **GUARDIAN 人选** | ⛔ |
| 四 | 合约实现前审计 | 接口冻结 + §7 十一条 + 静态审查 | ⛔ |
| 五 | Sepolia 演练 | 下列 12 项全过 | ⛔ |
| 六 | 审计与主网门槛 | 第三方合约审计 + 部署脚本审计 + 权限演练 + 三方对账 + 每日对账 + 双渠道公告 + 源码验证 + 小额主网演练 | ⛔ |

**阶段五的 12 项演练**:① 建过渡 Safe ② 部署测试收款合约 ③ 捐赠与分桶 ④ 暂停/恢复 ⑤ 排程 ⑥ 过早执行失败 ⑦ 取消 ⑧ GUARDIAN 未批准时执行失败 ⑨ 非签署人执行(到点后)⑩ EOA 作金库失败 ⑪ 新 Safe 接管治理权 ⑫ 旧 Safe 资金迁移 + 页面双地址/ETA 状态。

审计完成前,页面**只能**显示:**「通道未开放,待主体、法律和安全审查完成。」**

**阶段二的出口被法律闸门重新定义**(2026-09-22):顺序是 **法律/税务主体确认 → 目标受众与法域确认 → 书面专业意见** →(才能谈)合约审计 → Sepolia 演练 → 主网小额演练 → 受限开放。
不能靠服务器、RPC、合约或前端地理限制去"解决"法域问题;不能靠不发币、不承诺回报、多签、透明账本来替代主体资质与合规。若结论是"不能公开募资",**阶段三～六整体不启动**,改走 §九。

---

## 九 公开记录层(原"降级路线",2026-09-22 已升为**当前首页路线**)

原设计把它当"若不能公开募资时的降级方案"。2026-09-22 需方决策后,它**就是现在的首页路线** —— 收款侧冻结(法域未定 + 无 GUARDIAN),记录侧先行。完整设计见 [`RECORDS-LAYER-PLAN.md`](./RECORDS-LAYER-PLAN.md)。

要点不变:把"钱"的那一段整段删掉,剩下的一半仍能落地,而且法律风险与反钓鱼风险同时归零。

**`ResearchRecordAnchor`(设计,未实现)**

```solidity
contract ResearchRecordAnchor {                        // 刻意没有 payable / receive / fallback
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE"); // 项目钥匙或 Safe
    event Recorded(uint8 indexed kind, bytes32 indexed contentHash, bytes32 ref, uint64 timestamp);
    function record(uint8 kind, bytes32 contentHash, bytes32 ref) external onlyRole(RECORDER_ROLE);
    function verify(uint8 kind, bytes32 contentHash) external view returns (bool, uint64);
}
```

| 项 | 口径 |
|:--|:--|
| 收钱能力 | **零**:没有 `payable`、没有 `receive`、没有 `fallback`;任何转账直接 revert |
| 页面 | 不显示地址、不连接钱包、不启用 `config.donate`;首页区块从「公开支持」改成「公开记录」 |
| 存什么 | 只有哈希:`kind`(报告 / 提案 / 对账表 / 审计报告)+ `contentHash` + `ref`(外部编号) |
| 不存什么 | 文本、金额、人名、地址、URL —— 全在链下,链上只证明"这份文件在某时刻已存在" |
| 权限 | 提交权归项目自己(无钱可丢,不强制多签);密钥轮换与每次提交记录公开 |
| 复核 | 任何人下载报告 → 算 sha256 → `verify()` 对上 → 得到不可否认的时间戳 |
| 仍要守的纪律 | 记录内容 ≠ 宣传:锚定页不得出现「捐赠 / 支持 / 资助 / 回报」等措辞,也不得成为境外路线的导流入口 |
| 为什么它低风险 | 它不是募资入口:没有地址要公布、没有资产要接收、没有回报要承诺 |

这一形态**可以先于任何法律意见落地**(锚定的是自己的研究记录),也可以作为境内路线里"区块链公开审计"部分的实现。

## 十 法律主体清单(阶段二的待办,不是法律意见)

| # | 要落的东西 | 归属 |
|:--|:--|:--|
| 1 | 过渡主体的责任范围与公示表述(个人) | 需方 + 法律 |
| 2 | 捐赠、退款、终止政策(含"不可退款"的明示位置) | 需方 + 法律 |
| 3 | 税务口径:接受加密捐赠的确认与申报 | 需方 + 会计 |
| 4 | 公司成立后的资金迁移方案(§4 的合同侧) | 需方 + 法律 |
| 5 | 捐赠资金与商业收益的分账规则(§5 的合同侧) | 需方 + 会计 |
| 6 | 贡献者 / 研究者 / 智能体服务费用规则与合同模板 | 需方 + 法律 |
| 7 | 「捐赠不产生股权、分红、回购权、收益权」公开声明 | 需方 |
| 8 | 隐私政策补"链上公开、地址不可删除"段 | 需方 |
| 9 | 境内公开加密资产募资的**专业法律意见** | 独立法律意见 |

---

## 十一 仍需拍板(冻结期间可改,签了就别改)

| # | 决策 | A | B |
|:--|:--|:--|:--|
| 1 | 是否本轮就把首页落 `preview` 态 | 落(说明"待主体/法律/安全审查") | 先不动页面,等阶段三 |
| 2 | GUARDIAN 用什么角色 | **独立第三方签署人**(推荐,如合作方/法律顾问) | 个人自己(等于没加第二把钥匙,只是在合约上多一次点击) |
| 3 | GUARDIAN 的人选与备份 | 现在就定人(阶段三才能结束) | 阶段二法律意见定了再定 |
| 4 | `PAUSER` 与 `GOVERNOR` 是否分离 | 分离(推荐) | 合并(省一把钥匙,但被控时没人能踩刹车) |
| 5 | 支持的 Safe 版本 | 只钉 1.4.1(要升级就重部署合约) | 钉 {1.4.1, 1.5.0} 小白名单 —— 代价:白名单更新要另一次带延时的治理动作,且**它是新的攻击面** |
| 6 | 首页 `preview` 的文案 | 用 §八 那句 | 需方另给 |
| 7 | **目标受众法域** | 境内为主 → 放弃公开加密捐赠,只保留 §九 公开记录层 | 境外受众为主 → 先取境外主体/税务/AML 意见,且不得假定"部署在境外"即合规 |
| 8 | **GUARDIAN 数量** | 过渡期 1 名 + 备份(推荐) | 直接 2-of-2(更安全,任一失联即无法迁移) |
| 9 | **GUARDIAN 换人机制** | (a) 不可变(换人=重部署) | **(b) 握手换人 + 30 天失联路径**(推荐)/ (c) 单方 + 30 天(最弱) |
| 10 | **GUARDIAN 失联兜底** | 30 天公开路径 + 触发即 `pause` + 双渠道公告(推荐) | 不设兜底:永久无法迁移 |

---

## 十二 附:本次实测的复算命令(任何人可复核)

```bash
# ① 官方单例与代理工厂(含官方 codeHash,可与实测交叉验证)
curl -s https://raw.githubusercontent.com/safe-global/safe-deployments/main/src/assets/v1.4.1/safe_l2.json
#  → SafeL2 1.4.1 canonical 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762
#     codeHash 0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff

# ② 单例代码哈希实测(与官方一致 ⇒ 哈希方法可信)
curl -s https://mainnet.base.org -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["0x29fcB43b46531BcA003ddC8FCB67FFE91900C762","latest"]}' \
  | python3 -c "import sys,json;from eth_hash.auto import keccak;print('0x'+keccak(bytes.fromhex(json.load(sys.stdin)['result'][2:])).hex())"

# ③ 找出真实的 Safe 代理(批量,不靠肉眼看浏览器)
curl -s https://mainnet.base.org -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"fromBlock":"0x313F...","toBlock":"0x313F...","address":"0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67"}]}'
#  → 900 区块内 523 条 ProxyCreation,全部指向 1.4.1 单例 0x29fcB43b…

# ④ 三个真实代理的 runtime 完全一致(⇒ 一个常量覆盖所有 Safe)
#   0x78a5b972…/0xc25d9a26…/0xa182a82d…  →  171 字节,codehash 同为
#   0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c
#   其机器码为:读 storage slot 0 → `masterCopy()`(0xa619486e)直接返回该槽 → 其余 DELEGATECALL 给它
```

---

## 十三 变更记录

| 日期 | 变更 |
|:--|:--|
| 2026-09-22 | v1.0 出稿:六件套(状态机 / 权限矩阵 / 威胁模型 / 迁移流程 / 资金分配章程 / 智能体章程)+ 十一条不变量 + 六阶段门禁 + 法律主体清单 |
| 2026-09-22 | 安全修正:新金库从"是合约"收紧为"**经验证的 Safe**"(§1.3,已实测);GUARDIAN 从可选改为**必须**(执行前置条件而非到场动作) |
| 2026-09-22 | **v1.1 法律闸门**:加入前置条件与阶段二出口重定义(§八);新增 **§九 降级路线**(`ResearchRecordAnchor`,不收钱、无 `payable`/`receive`);待拍板加「目标受众法域」 |
| 2026-09-22 | **v1.2 路线确定 + GUARDIAN 阻塞**:资金路线 = 境外募资(法域未定 → 收款侧冻结);首页路线 = 公开记录(§九 升为当前路线,详见 `RECORDS-LAYER-PLAN.md`);新增 **T-G1…T-G4** 换人转移与威胁 **T1b(绕过 GUARDIAN)**;待拍板加 GUARDIAN 数量/换人/兜底三项 |
