# 公开记录层 / Open Research Records —— 设计

| | |
|:--|:--|
| 版本 | v0.1 · 2026-09-22 |
| 状态 | **设计稿。本轮不改 HTML、不改 CSS/JS、不部署任何合约** —— 要落页面时按 §七 的升版与验收流程走 |
| 依据 | 需方 2026-09-22 决策:资金路线 = 境外募资(未定法域,先冻结);首页路线 = **公开记录** |
| 关联 | [`DONATION-FREEZE.md`](./DONATION-FREEZE.md) §九(锚定合约)· [`FUNDING-JURISDICTION-SCREENING.md`](./FUNDING-JURISDICTION-SCREENING.md) · [`DESIGN-PLAN.md`](./DESIGN-PLAN.md) §7.7 |

**一句话**:首页区块从「公开支持 / 捐赠」整块换成「**公开记录 / Open Research Records**」—— 只发布研究记录的哈希与时间戳证明,**没有钱、没有地址、没有钱包**。

---

## 一 这个区块承担什么、不承担什么

| 承担 | 不承担(硬性) |
|:--|:--|
| 论文 / 仿真 / 提案 / 审计报告 / 治理决定的**哈希**与发布日期 | ❌ 捐赠地址 · 收款链接 · 任何 `0x…` 地址 |
| 「这份文件在某时刻已存在」的**不可否认证明** | ❌ 钱包连接 · 链上交互按钮 |
| 任何人可自行复核的核验路径 | ❌ 金额、收款按钮、任何募资暗示 |
| 研究进度的公开留痕 | ❌ 个人信息 · 收益或回报承诺 |

> 这个区块**不是募资入口** —— 它没有可以捐的地址,也没有可以点的钱包。境外募资路线的任何宣传,都不得从这个区块导流。

---

## 二 首页区块(位置与骨架)

- 位置:`index.html` 的 `#status`(`— 02 · Status`)之后、`</main>` 之前 → `当前阶段 → 公开记录 → 页脚`
- 骨架:`<section class="band" id="records" data-state="records">`;kicker `— 03 · Records`
- 文案:`data-zh` / `data-en`(与全站同机制);区块标题建议「公开记录 / Open Research Records」
- 组件:全部复用现有语义,零新增依赖 —— `band` · `section-head`(+`kicker`/`section-title`/`section-lede`)· `cap-list`(+`cap-no`/`cap-body`/`cap-tag`)· `status` · `reveal` · `see-all`
- **不用** `quiet-cta--solid`(实心按钮 = 行动召唤;这里没有要用户做的事),只用文字链接指向核验说明与仓库
- 区块内固定一句免责(**必须原样出现**):

  > 本页只发布研究记录与文件哈希;不接收任何资金,不提供任何回报。

---

## 三 记录的种类与数据格式

六项内容里,**「时间戳与链上交易证明」不是第六种记录,而是每条记录的一个字段** —— 这样建模更诚实:一条论文记录可以「有哈希、尚未锚定」,也可以「已锚定,带 tx」。

`kind` 取值(五种):

| kind | 内容 | 现在有没有 |
|:--|:--|:--|
| `paper` | 论文(如 aiXiv `aixiv.260821.000002`) | ✅ 已有 |
| `simulation` | 仿真结果 | 待有 |
| `proposal` | 研究提案 | 待有 |
| `audit` | 审计报告(合约 / 部署 / 资金三方对账) | 待有 |
| `governance` | 治理决定(提案 + 决定 + 执行哈希) | 待有 |

数据文件(仓库内,**权威来源**):`records.json`

```json
{
  "schema_version": 1,
  "updated": "2026-09-22",
  "policy": "只发布研究记录与文件哈希;不接收任何资金,不提供任何回报。",
  "records": [
    {
      "id": "paper-260821-000002",
      "kind": "paper",
      "title": "物理学在宇宙尺度下的几何的描述",
      "file": "docs/records/paper-260821-000002.pdf",
      "sha256": "<64 hex>",
      "published": "2026-08-21",
      "url": "https://aixiv.science/...",
      "anchor": { "chainId": null, "address": null, "txHash": null, "block": null }
    }
  ]
}
```

规则:

1. `anchor` 四个字段**要么全为 `null`(未锚定),要么全有值** —— 不允许"半个锚定"。
2. `sha256` 必填,且必须等于 `file` 的实际哈希(仓库里用脚本校验,见 §四)。
3. 记录文件放 `docs/records/`(与页面同仓库),**文件本身公开** —— 哈希只有在文件可下载时才有意义。
4. `records.json` 里不写金额、不写人名、不写地址。
5. 审计报告里天然会有金额 —— **可以出现在文件里,但页面不设"金额"栏位**,也不在页面上摘要金额。

---

## 四 渲染、无 JS 兜底、以及"人怎么自己验"

**渲染**:`app.js` 读 `records.json`(与 `config.json` 同款:带 `?v=N`、`cache:'no-store'`),按 `kind` 分组渲染成 `cap-list`。保持零构建,不引入打包器。

**无 JS**:`<noscript>` 里给出权威来源与核验方法:

> 记录清单的权威来源是仓库里的 `records.json`;本页脚本未运行。核验方法:下载对应文件,算 sha256,与 `records.json` 里的值比对。

**核验路径(任何人都能做,不依赖本项目)**:

```bash
# 1) 拿文件与哈希
curl -O https://hushfusion.pages.dev/docs/records/paper-260821-000002.pdf
python3 -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" paper-260821-000002.pdf
# 2) 与 records.json 里的 sha256 比对 —— 一致即"你手上的文件就是我发布的文件"
# 3) 若该记录已有 anchor.txHash:到区块浏览器查那笔交易,事件里带同一个 contentHash
#    → "这份文件在那个时间点已经存在,且之后没有被改过"
```

**链条要完整**这一点必须写清:锚定只证明"提交时的哈希",**不证明文件内容为真**。内容是否可信靠评审与复现,不靠区块链。

---

## 五 锚定合约(ResearchRecordAnchor):接口与部署前置

```solidity
contract ResearchRecordAnchor {                        // 刻意没有 payable / receive / fallback
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    event Recorded(uint8 indexed kind, bytes32 indexed contentHash, bytes32 ref, uint64 timestamp);
    function record(uint8 kind, bytes32 contentHash, bytes32 ref) external onlyRole(RECORDER_ROLE);
    function verify(uint8 kind, bytes32 contentHash) external view returns (bool, uint64);
}
```

| 项 | 口径 |
|:--|:--|
| 收钱能力 | **零**:无 `payable`、无 `receive`、无 `fallback`;向它转账直接 revert |
| 提交权限 | `RECORDER_ROLE` 由**人**持有(Safe 或硬件钱包)→ **智能体不得持有记录发布私钥**,只能起草待签名交易 |
| 人工审核 | 每条记录上链前必须有人复核:哈希对得上、文件已公开、不含禁列内容(§一) |
| 不需要 GUARDIAN | 因为它**没有钱**可以丢 —— 这也是它可以先于募资路线推进的原因 |
| 公开锚定合约地址 ≠ 公开收款地址 | 合约无 `payable`,地址被复制也收不了钱;页面仍然只显示"可核验"的说明,不做转账引导 |
| 什么时候才部署 | ① 至少有一条记录真的要锚定 ② 记录页文案已定稿 ③ 提交密钥与轮换流程已定 → 再部署;不要在"为了完整性"时提前部署 |

**分两步走(现在就能做第一步)**:

1. **无链记录(现在)**:`records.json` + 文件 + sha256 + 发布日期 —— 零依赖、零链上风险、可先上线;
2. **链上锚定(以后)**:同一份 `records.json` 补齐 `anchor` 四字段,页面自动显示 tx 链接。

---

## 六 与站点现有体系的关系

| 项 | 口径 |
|:--|:--|
| `config.json` | 记录层**不需要**新配置段。`config.donate` 保持不存在/`enabled:false`;若将来添加锚定,只加一个只读的 `records.anchor`(chainId + address),**不加任何金额字段** |
| `?v=N` | 落页面要动 `app.js`/`style.css` → 五页 `?v=15 → 16` 全体升版 |
| 隐私政策 | 记录层不采集任何个人数据;维持"无追踪统计" |
| 站点免责 | §二 那句免责必须与页脚法务块并列可见,不藏进细则 |

---

## 七 验收断言(给 `verify-site.mjs` 的增量清单)

| 断言 | 期望 |
|:--|:--|
| `#records` 存在 | `band` 类 + `kicker == "— 03 · Records"` |
| **无钱断言** | 区块内文本**不含**任何 `0x…`、不含「捐赠 / 支持 / 资助 / 回报 / 众筹」;无钱包按钮;无实心 CTA |
| 免责句 | 「不接收任何资金,不提供任何回报」至少 1 处 |
| 记录渲染 | 夹具 `records.json`(2 条,一条已锚定一条未锚定)→ 两条都渲染;未锚定条不出现 tx 链接、已锚定条出现 tx 链接 |
| 哈希一致 | 断言 `records.json` 里每条 `sha256` == 对应文件实际 sha256(脚本预检,失败即 CI 红) |
| 无 JS | 抓文本能看到权威来源说明与核验方法 |
| 主题 | 新区块在夜/昼两套令牌下对比度达标 |
| 图标 | 不变(3 项) |

---

## 八 反模式(不要做)

1. 不把这个区块叫「公开支持 / 支持我们 / Open Research Fund」—— 名字本身就是募资叙事的入口
2. 不放任何可转账地址(含"研究基金地址""赞助地址")
3. 不放钱包连接、不放链上交互按钮
4. 不显示金额,不摘要金额,不做"已筹/进度"任何形式
5. 不放个人姓名/邮箱;研究者署名若要公开,单独走正式页面并取得同意
6. 不承诺回报、不写"你的支持将用于…"
7. 不在链上存文本/URL/人名 —— 链上只有哈希与 kind
8. 不用锚定记录当境外募资的宣传素材或导流入口
9. 不让智能体持有记录发布私钥(它可以起草、索引、归档反对意见,但发布要人工审核)
10. 不在没有文件可下载的情况下发布哈希(不可复核的哈希 = 装饰)

---

## 九 里程碑

| # | 内容 | 依赖 | 状态 |
|:--|:--|:--|:--|
| R1 | 本设计定稿 | —— | ✅ 出稿 |
| R2 | `records.json` + `docs/records/` + 哈希校验脚本 | R1 | ⛔ 未做(`docs/records/` 还不存在) |
| R3 | 首页区块实现(`#records`)+ 五页 `?v=16` + 验收断言 | R2 | ⛔ 未做 |
| R4 | 首个真实记录上线(论文) | R2/R3 | ⛔ 未做 |
| R5 | 锚定合约部署(Sepolia → 主网) | §五 三个前置 | ⛔ 未做,且**不阻塞 R2–R4** |
