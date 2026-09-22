# HUSHFUSION 公开支持 / Open Research Fund —— 实现设计

| | |
|:--|:--|
| 版本 | v0.1 · 2026-09-22 |
| 状态 | **设计稿**。本轮不写 `.sol`、不部署、不接受真实资金;前端区块本轮最多落「未开放」预览态 |
| 输入 | [需方提供的 AI 计划原文](raw_sources.csv 行 `donation-plan-ai-draft-20260922`,sha256 `b5545edf8daa2c827b3f1f58fb64069ec60d71a0111dbce770a24a10f1dc6a0c`) |
| 编译产物 | 本文 + wiki 页 [`docs/wiki/donation-open-research-fund.md`](./wiki/donation-open-research-fund.md) |
| 口径 | 计划是**输入不是结论**。本文改写了它的三条:金库非托管、暂停语义、治理权的绑定方式(§2.4/§2.5/§七),其余照做 |

---

## 零 一句话裁决

把「金库」从合约里拿掉:**捐款在同一笔交易内原样转给多签金库**(非托管 pass-through),合约只负责记账 + 发事件 + 可暂停。

于是计划里那条「不允许单一管理员更换收款地址」不再是一条要靠审计去相信的纪律 —— 合约里**根本没有那个函数**,而且合约里**没有钱**可被偷。

---

## 一 三条实现路径与裁决

| 路径 | 是什么 | 优点 | 代价 | 裁决 |
|:--|:--|:--|:--|:--|
| **A 零合约** | 页面只显示 Safe 地址,捐款直转 Safe | 合约风险 = 0;gas 与普通转账相同 | 没有累计数 / 没有分桶 / 没有事件流;资金流只能靠第三方浏览器 API 反查;"暂停新捐赠"做不到 | 落选。但**保留为无 JS 兜底**(§9.6) |
| **B 非托管金库(推荐)** | `receive()`/`donate(bucket)` 把 `msg.value` 当场转给 `immutable TREASURY`,只留计数器 + 事件 + 暂停 | 合约**永不持币** → 无可偷余额、无提款函数、无 admin 密钥、不需要可升级代理;事件 = 原生公开账本;分桶意向可读 | 每笔多一次外部调用(冷地址 ≈ +2.6k gas)+ 2–3 个存储槽写入 | **v1 采用** |
| **C 托管金库**(计划字面版:收款 → 记累计 → 管理员可暂停 → 多签提款) | 钱先进合约,再由多签提走 | 能做「合约层出账」 | 合约里躺着钱:重入/权限/升级/暂停冻结全部变成真问题;提款函数 = 单点;「暂停不冻资金」这句话在托管模型里说服力很弱 | v1 不用 |

> 计划里的「拨款」不属于合约,属于多签金库本身:**合约管进,Safe 管出**。
> 出账天然是 Safe 的一笔普通交易 → 公开、可读、可对账,不需要合约参与。

---

## 二 合约 v1 规范 `HushFusionDonationVault`

### 2.1 接口(签名级)

```solidity
// SPDX-License-Identifier: MIT          // ← 待拍板,见 §13-6
pragma solidity 0.8.24;                   // evm_version 与 Base 支持范围对齐,部署前实测并写死

contract HushFusionDonationVault is Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint8   public constant BUCKET_COUNT = 5;   // 0 = 未指定,1..4 = 四桶
    address public immutable TREASURY;          // Safe;无 setter、无 upgrade、无 selfdestruct

    uint256 public totalReceived;               // 累计(wei)
    uint256 public donationCount;
    mapping(uint8 => uint256) public bucketReceived;

    event DonationReceived(address indexed donor, uint8 indexed bucket,
                           uint256 amount, uint256 totalReceived, uint256 donationCount);
    event TreasuryForwarded(address indexed treasury, uint256 amount);

    error ZeroAmount();
    error BadBucket(uint8 bucket);
    error ForwardFailed();

    constructor(address treasury, address pauser);   // treasury == 0 → revert

    receive() external payable whenNotPaused;        // 等价于桶 0
    function donate(uint8 bucket) external payable whenNotPaused;

    function pause()   external onlyRole(PAUSER_ROLE);
    function unpause() external onlyRole(PAUSER_ROLE);

    function snapshot() external view
        returns (uint256 total, uint256 count, uint256[5] memory buckets);   // 一次 eth_call 拿全部
}
```

内部顺序(`_accept`)固定为 **CEI**:① 校验(非零、桶合法)→ ② 记账 → ③ `DonationReceived` → ④ `TREASURY.call{value: amount}("")` → ⑤ 失败 `revert ForwardFailed()`。

### 2.2 为什么 v1 不需要 `ReentrancyGuard`(偏离 1)

计划的 OZ 清单把 `ReentrancyGuard` 列为常用工具 —— 那是给**持币**合约的。v1 合约余额恒为 0,重入能做的最坏事是"重入一次帮自己再捐一笔"。仍按 CEI 写(先记账后转账),省掉 2k gas 和一个修饰器。

**若 v1.1 引入持币或出账 → 那时必须补 `ReentrancyGuard` + pull-payment**(见 §三)。

### 2.3 合约里不写的东西(白名单纪律)

| 不做 | 原因 |
|:--|:--|
| 无 `setTreasury` / 无代理 / 无 `delegatecall` / 无 `selfdestruct` | 没有 admin 函数可以被钓鱼;换金库 = 部署 v2(§2.5) |
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

### 2.5 金库地址不可变的代价与预案(偏离 3)

计划的「固定金库地址」+「不允许单一管理员更换」只有一种诚实实现:**`immutable`**。代价要写清:

| 情形 | 后果 | 预案 |
|:--|:--|:--|
| 多签成员轮换 / 阈值变更 | Safe 地址**不变**(owners 存在代理存储里) | 无事 |
| 签署人丢失 / 需要换 Safe 版本 | 旧合约仍会把钱转给**旧 Safe** | 1) 部署 v2(同源码,新 `TREASURY`)→ 2) 改 `config.json` 一行 → 3) 页面顶部公告「旧合约已停用 @ 区块 N」并保留旧合约只读页 → 4) 第二渠道(仓库 commit + 公告)同步 |
| Safe 被入侵 | 出账被劫 | 没有救世主:只能靠"钱少、多签、公开"。合约不可变不代表钱不可追(全部在链上) |

备选(若不接受重部署):`treasury` 改成状态变量,**只能由 Safe 调用**,且两段式 + 48h timelock + `TreasuryChangeScheduled` 事件。
代价:多签一旦被控就能**静默改收款地址**。**推荐:不可变 + 重部署** —— 因为合约不持币,重部署成本 ≈ 一次部署费 + 改一行配置,而"多签能静默改地址"的风险无法用代码消除。

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
    // 非托管:不收钱、不转账、不能改 vault;写权限只有 Safe
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
| 角色分工 | 科学判断(提提案)/ 资金审批(多签签)/ 技术安全(能否决,靠"不签")—— 三种角色不集中在同一人 |
| 签名纪律(硬性) | ① 签名前必须逐字比对 Safe 界面的 `to` / `value` / `data` 与提案文件内容;② 至少两人独立验证;③ 提案文件的哈希必须出现在被签的交易数据里(§七) |
| 备份 | 硬件钱包;助记词离线异地;至少一位签署人在不同司法辖区;签署人名单不公开但阈值公开 |
| 绝不设 | 「紧急单人提款」;任何形式的托管人改址开关 |

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
  "treasury": null,
  "vaultCodeHash": null,
  "testnet": {
    "chainId": 84532, "chainIdHex": "0x14a34",
    "rpc": ["https://sepolia.base.org"], "explorer": "https://sepolia.basescan.org"
  }
}
```

规则:
1. `enabled: false` 时地址字段一律 `null`;**禁用时页面不得回退到任何硬编码地址**。
2. 地址**只在 `config.json` 出现一次**(§9.6 的静态注入是唯一例外,且必须脚本同源)。
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
| ② 行为 | `vault.TREASURY()` 返回值 == `config.treasury`(纯 `eth_call`,不引入任何库) | 同上 + 显示告警 |
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

**B 运维** — Safe 3/5 建成且**每位**签署人独立完成一笔测试交易 · pause/unpause 演练 · 失败交易演练(故意让 treasury 拒收,确认 revert 且不计数)· 轮换演练(部署 v2 + 改 config + 页面公告)· 主网真钱小额演练一次(≤ $1)

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
| 主体 | 个人 / 公司 / 开源组织 / 基金会 —— 直接决定税务与可执行性,待定(§13-9) |
| 税务 | 接受捐赠的入账与申报口径需与会计确认 |
| 数据 | 不采集个人信息;但钱包地址在个保法/GDPR 语境下的定性需写进隐私政策 |

---

## 十一 验收断言(给 `verify-site.mjs` 的增量清单)

| 断言 | 期望(本轮预览态) |
|:--|:--|
| `#support` 存在 | `band` 类 + `kicker == "— 03 · Support"` |
| 预览态 | 无钱包按钮、页面文本中无任何 `0x…` 地址、有「未开放」标记 |
| 内容完整性 | 四桶 4 条 + 治理原则 3 条 + 不可退款提示各至少 1 处 |
| 无 JS | 关闭 JS 抓文本仍能读到「通道未开放」 |
| enabled=true 夹具(本地注入 config) | 地址出现且通过 EIP-55 校验 · explorer 链接指向 BaseScan · 按钮存在 · 静态注入地址 == config 地址 |
| 主题 | 新区块在夜/昼两套令牌下对比度达标(沿用现有 7 项主题断言的写法) |
| 图标 | 不变(3 项) |

---

## 十二 反模式清单(不要做)

1. 不发代币 / 不发可转让收据 NFT(一旦可转让就像份额)
2. 不做金额排行榜、"捐赠墙"排名
3. 不在链上存任何文本
4. 不做可升级代理、不留 admin 提款函数
5. 不让智能体持钥,不用"禁止条款"代替"没有权限"
6. 不做"捐得多 → 提案优先"
7. 页面不出现"投资 / 回报 / 份额 / 收益"字样
8. 不用公共 RPC 做无窗口 `getLogs`(实测会失败)
9. 不把地址硬编码进 HTML(唯一例外:构建期从 `config.json` 注入)
10. 不显示 USD 估值(除非价格源经过 §6.7 的口径确认)
11. 不承诺匿名、不承诺可退款、不承诺"链上最终"
12. 不在 `enabled=false` 时显示任何地址或捐赠按钮

---

## 十三 待需方拍板(每条两种取值的后果)

| # | 决策 | 取值 A | 取值 B |
|:--|:--|:--|:--|
| 1 | 金库地址 | **不可变 + 重部署**(推荐):无 admin,但换金库要发公告 | 可改 + 48h timelock:能静默改收款地址 |
| 2 | `PAUSER_ROLE` | 归 **Safe 3/5**(推荐):安全,停一次要凑签名 | 归单人 ops key:能秒停,但能滥用成拒绝服务 |
| 3 | v1 范围 | **只做 vault**(推荐):一次审计走得完 | 同时做 registry:里程碑上链更硬,但两倍审计面 |
| 4 | 首页本轮 | 落 **preview 态**(推荐):诚实、无死按钮 | 先不进页面:少一次 `?v=N` 全站升版 |
| 5 | 移动端 | **EIP-681 深链 + 复制地址**(推荐):零依赖 | 再加 QR:需要一个生成器或引入依赖 |
| 6 | 合约许可 | **MIT / Apache-2.0**:与源码验证配套 | 站点仍"保留所有权利";两者可并存,但需确认口径 |
| 7 | 单笔上限 | **不设**:简单 | 设上限:反粉尘/反刷量,但要多一个常量与文案 |
| 8 | USD 估值 | **不显示**(推荐):少一个价格源依赖 | 显示:多一个隐私/可用性依赖 |
| 9 | 主体与税务 | 先定主体再公开地址(法律项前置) | 先公开地址:法律风险自担 |
| 10 | 上线网络 | **先 Base Sepolia 演示一轮**(推荐) | 直接主网:审计与演练须先完成 |

---

## 十四 本轮不做(边界)

- 不写 `.sol` 文件、不部署、不验证源码、不接受真实资金
- 首页区块本轮**最多**落 `preview` 态(取决于 §13-4)
- 里程碑 registry、Worker 索引器、监测任务:只在本文件里定接口与职责,**不实现**
- 产物:本文 + wiki 页 + raw 登记 + 门禁
