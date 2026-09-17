---
title: HUSHFUSION 消音计划 当前状态
source: session
created: 2026-09-17
last_confirmed: 2026-09-17
audience: internal
stage: draft
tags: [status]
status: current
---

## 最近更新

- 站点四页在线:`https://hushfusion.pages.dev`(资源版本 `?v=14`)
- 全站图标已换成需方提供的波形标识(顶栏 / favicon / apple-touch / app icon),生成脚本 `tools/make_icons.py`
- 关于页「待补」→「时间线」:论文发布日 2026-08-21 为唯一确定节点;机构与团队按需方口径不公开;
  法务(版权 + 隐私)已落写;HIBS 页「在招」写实(岗位开放,要求对等离子体与电磁有了解)
- 关于页新增/补齐「论文与引用」:aiXiv `aixiv.260821.000002`(标题、摘要、关键词、链接 + 复制引用);
  同一篇论文写重复的「理论依据」块已删除
- HIBS 页「加入」补齐:投递邮箱行由 `config.json` 驱动,附投递表单(失败自动退回 mailto)
- 投递后端 `hushfusion-apply`(Cloudflare Worker)已部署:**直发已打通** —— 发信域 `hushfusion.alou.onl`,
  收件人 `yuanjieliu65@gmail.com`(已验证目的地地址 + 绑定 `allowed_destination_addresses` 白名单)
- `config.json` = 站点唯一配置源(投递邮箱 / 后端地址 / 发信地址 / 来源白名单);改邮箱只改 `apply.to`
- 验收:本地 111/111、线上 111/111;投递端到端自检(真浏览器填表 → Worker → 邮箱)通过

## 待补 / 未决

- 合作与资助(合作机构 / 资助来源):`about.html#timeline`
- 时变引力场的「公开细节」与关键指标数值:`progress.html#tech`
- 岗位参数(级别 / 人数 / 地点 / 待遇,措辞已改「待定」):`hibs.html#join`
- 三条回路的职责说明(各一句话):`hibs.html#team`
- 设计冻结前 §12 六个待批准项仍需逐条结论(`docs/DESIGN-PLAN.md`)
- 发信域状态只在 Cloudflare 控制台可见(开放测试期,OAuth 的 CLI/API 查不到,2036);换域时改 `config.json`

## 进行中的实验

- 无(本站为品牌站;实验与指标类内容一律留占位,不编造)
