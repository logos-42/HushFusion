---
title: HUSHFUSION 消音计划 当前状态
source: session
created: 2026-09-17
last_confirmed: 2026-09-22
audience: internal
stage: draft
tags: [status]
status: current
---

## 最近更新

- **新增设计稿 `docs/DONATION-FUND-PLAN.md`(公开支持 / Open Research Fund)**:需方 AI 计划 → 可实施规范。
  裁决 = **非托管金库**:捐款在同一笔交易内原样转给多签金库(Safe 3/5),合约只记账 + 发 `DonationReceived` + 可暂停
  ⇒ 合约里没有钱、没有 admin 改址函数、不需要可升级代理;计划的「ReentrancyGuard」在无币合约里不需要(守 CEI 即可)
- 实测常量已写进设计稿(2026-09-22):Base 主网 `8453` = `0x2105` / Sepolia `84532` = `0x14a34`;
  公共 RPC(浏览器读链)CORS 全开;gasPrice `0.006 gwei`;`eth_blobBaseFee` 公共 RPC 不支持;
  `eth_getLogs` 900 区块 + 地址过滤可用、5000 区块无过滤失败 ⇒ **公开 RPC 不能当索引器**(需 Worker 分窗缓存)
- 前端位置已定(未实现):`当前阶段 → 公开支持 → 页脚`,即 `#status` 之后、`</main>` 之前;
  本轮只落 **`preview` 态**(`config.donate.enabled=false` ⇒ 不显示任何地址与连接钱包按钮);`DESIGN-PLAN.md` §7.7 登记
- 需方计划原文登记 raw:`internal_sources/donation-plan/donation-plan-ai-draft-20260922.md`
- 新增第五页「理论」`theory.html`:控制引力场的代数系统(基元 = 起伏能量二次型,布尔 = 层状区域族;三个类比 + 锁定 = 交换子不为零);附 GitHub 来源链接 `logos-42/Hibs-Physics` 与本站 `logos-42/HushFusion`
- 五页导航补「理论」入口,`verify-site.mjs` 纳入新页
- 站点四页在线:`https://hushfusion.pages.dev`(资源版本 `?v=15`)
- 双主题上线:夜(默认)/ 昼,开关在顶栏「中/EN」左边并记忆选择;浏览器 theme-color 同步
- 配色:夜底取 `assets/cover/thumbnail_375.jpg` 的绿族 `#0E1E05`;昼底 = 浅海蓝绿 `#C9DDD5` + 浅卡其面 `#F4EFE1`(需方 2026-09-17 口径);**强调色 = 图标 logo 的靛蓝**(夜 `#93A4FF` / 昼 `#1B2C7A`)
- 小字可读性修复:微标签统一 12px / 字重 400 / 字距收敛(小字对比度 5.61 → 8.9:1)
- 顶栏标识改用 alpha 蒙版 + `var(--ink)`,两个主题下都可见
- 浏览器图标随主题换:夜 = 深蓝底白波形 / 昼 = 浅海蓝绿底 + 深墨绿波形(昼间配色读 `style.css` 生成)
- 全站图标已换成需方提供的波形标识(顶栏 / favicon / apple-touch / app icon),生成脚本 `tools/make_icons.py`
- 关于页「待补」→「时间线」:论文发布日 2026-08-21 为唯一确定节点;机构与团队按需方口径不公开;
  法务(版权 + 隐私)已落写;HIBS 页「在招」写实(岗位开放,要求对等离子体与电磁有了解)
- 关于页新增/补齐「论文与引用」:aiXiv `aixiv.260821.000002`(标题、摘要、关键词、链接 + 复制引用);
  同一篇论文写重复的「理论依据」块已删除
- HIBS 页「加入」补齐:投递邮箱行由 `config.json` 驱动,附投递表单(失败自动退回 mailto)
- 投递后端 `hushfusion-apply`(Cloudflare Worker)已部署:**直发已打通** —— 发信域 `hushfusion.alou.onl`,
  收件人 `yuanjieliu65@gmail.com`(已验证目的地地址 + 绑定 `allowed_destination_addresses` 白名单)
- `config.json` = 站点唯一配置源(投递邮箱 / 后端地址 / 发信地址 / 来源白名单);改邮箱只改 `apply.to`
- 验收:本地 151/151、线上 151/151(每页 7 项主题断言 + 3 项图标断言);投递端到端自检(真浏览器填表 → Worker → 邮箱)通过

## 待补 / 未决

- **法律闸门升级为第一优先级**:上链不自动等于非法集资,但境内面向公众用虚拟货币公开收款不得按普通捐赠处理;在书面法律/税务意见前,首页只保留 preview,不显示地址、不接真实资金

- **公开支持 / Open Research Fund:第二轮收敛(需方 2026-09-22 决策)** —— 术语定为「**Safe 托管金库 + pass-through 收款合约**(合约不持币,余额恒 0)」
- 金库地址**可改**,但只有一条窄路:当前 Safe 排程 + 提案哈希上链 → ≥48h → 到期后**任何人**可执行(执行时 `GOVERNOR_ROLE` 转给新 Safe);
  新地址**必须是合约**(`NotAContract` 挡掉个人热钱包);待生效期间捐款仍进旧 Safe,页面同时显示双地址 + ETA
- 主体:个人过渡 → 公司成立后迁移(未来捐赠路由先切,再由旧 Safe 转存量,旧 Safe 只读退役);法律/税务意见完成前首页保持 `preview`
- 新增设计:**治理原则 8 条 + 审计原则 6 层 + 三套账**(捐赠账 / 贡献者账 / 商业收益账)+ 链上规范选用清单;捐赠不产生股权/分红/积分/收益权
- **法律闸门(最高优先级)**:「上链」不等于非法集资,但「中文公开网站 + 面向公众 + 接收 ETH/稳定币 + 个人过渡主体」= 高风险组合 ⇒ 顺序固定为 法律/税务主体 → 目标受众法域 → 书面专业意见 → 才谈审计;此前首页只有 `preview`,不公开地址、不接受资金
- 两条路线:① 境内科研支持(人民币 + 合同 + 会计审计,链上只放报告哈希/非资金证明)② 境外加密捐赠(先落主体、受众、税务、AML/KYC 与资格,单独取意见)
- 可保留的降级路线:**`ResearchRecordAnchor`** —— 只锚定报告/提案/对账表哈希,无 `payable`/`receive`、不显示地址、不连钱包;首页区块可改成「公开记录」
- 余下待拍板 14 项 + 冻结文档 7 项:`docs/DONATION-FUND-PLAN.md` §13 · `docs/DONATION-FREEZE.md` §十一
- 合作与资助(合作机构 / 资助来源):`about.html#timeline`
- 时变引力场的「公开细节」与关键指标数值:`progress.html#tech`
- 岗位参数(级别 / 人数 / 地点 / 待遇,措辞已改「待定」):`hibs.html#join`
- 三条回路的职责说明(各一句话):`hibs.html#team`
- 设计冻结前 §12 六个待批准项仍需逐条结论(`docs/DESIGN-PLAN.md`)
- 发信域状态只在 Cloudflare 控制台可见(开放测试期,OAuth 的 CLI/API 查不到,2036);换域时改 `config.json`

## 进行中的实验

- 无(本站为品牌站;实验与指标类内容一律留占位,不编造)
