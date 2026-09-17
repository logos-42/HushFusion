#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给页面上的高价值文案加上 data-zh / data-en 双属性(双语切换用)。

- 中文原文保留在元素内(默认语言),英文放进 data-en;
- 含内联标签的用 data-html="1" 标记,app.js 会改用 innerHTML 写入;
- 幂等:已经有 data-en 的元素跳过。
用法: python3 tools/instrument_i18n.py [--check]
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 每个页面按「元素出现顺序」给出英文译文
EN: dict[str, dict[str, list[str]]] = {
    "index.html": {
        "lede": [
            "HUSHFUSION is a frontier research project on controlled fusion, combining "
            "<strong>AI control</strong> with <strong>noise suppression</strong>. We believe real "
            "energy freedom comes from mastering chaos and pursuing quiet.",
        ],
        "section-title": ["Making fusion quieter", "Latest progress", "The poster",
                          "Interface mockups"],
        "section-lede": [
            "The hard part of fusion is not ignition — it is <strong>holding the chaos still</strong>. "
            "The plasma wobbles every millisecond; we put AI control and noise suppression into one "
            "loop so the confinement learns to be quiet.",
            "The whole visual system starts from this one sheet of paper: hand-drawn strokes, a paper "
            "base, a single accent colour. Every page below derives its colour and rhythm from it — "
            "not from a template.",
            "What you are reading is the implemented version of these two mockups. <strong>Desktop and "
            "mobile share one token set</strong>; the breakpoint only changes layout direction.",
        ],
    },
    "about.html": {
        "display": ["Why fusion,<br>and why “hush”"],
        "lede": [
            "HUSHFUSION is a frontier research project on controlled fusion, combining "
            "<strong>AI control</strong> with <strong>noise suppression</strong>. We believe real "
            "energy freedom comes from mastering chaos and pursuing quiet.",
        ],
        "section-title": ["Five pillars of the project", "One visual system, one source",
                          "What we do not have sources for"],
        "section-lede": [
            "These five words come straight from the hand-written list in the bottom-left of the "
            "project poster — they are the project's own self-definition.",
            "Colour, type hierarchy and the rhythm of whitespace all read backwards from that poster. "
            "<strong>The material decides the container, not the other way round.</strong>",
            "The following does not exist in the source material. This prototype does not invent it; "
            "it stays marked as to-fill.",
        ],
    },
    "technology.html": {
        "display": ["Suppress noise, then control,<br>and only then ignite"],
        "lede": [
            "The most expensive thing in a fusion device is not the magnets — it is "
            "<strong>information</strong>: how much of the diagnostic signal is real instability and "
            "how much is noise. Fail to tell them apart and you cannot control anything.",
        ],
        "section-title": ["FRC: let the configuration hold itself", "AI control",
                          "What each track watches", "Key metrics", "Run this site yourself"],
        "section-lede": [
            "A Field-Reversed Configuration forms closed flux surfaces from the plasma's own current. "
            "The device can be compact — the price is extreme sensitivity to perturbation, which is "
            "exactly why AI is needed.",
            "The controller does not wait for instability and then react; it predicts configuration "
            "drift frame by frame and applies corrective fields before the perturbation becomes "
            "measurable.",
            "The table structure is in place; every value is left blank and marked with its source "
            "status — <strong>a number without a source never enters the page</strong>.",
            "This is a <strong>zero-build static site</strong>: no npm, no bundler, and all three "
            "commands below really run in this repository.",
        ],
    },
    "progress.html": {
        "display": ["Progress"],
        "lede": [
            "We only record what has already happened and been archived. "
            "<strong>Unarchived progress does not appear here.</strong>",
        ],
        "section-title": ["Archive", "Visual originals of the entries"],
        "section-lede": [
            "The three thumbnails below are native pixels cut from the interface mockup. Resolution "
            "is limited, so they are listed for redrawing.",
        ],
    },
    "team.html": {
        "display": ["Team"],
        "lede": [
            "Fusion projects never lack grand narratives; what they lack is people who can "
            "<strong>line diagnostic signals up with the controller</strong>. We are organised by "
            "control loop, not by department.",
        ],
        "section-title": ["Turn discussion into an archive"],
    },
    "join.html": {
        "display": ["Come and work on <strong>noise suppression</strong>"],
        "lede": [
            "We do not read adjectives on a CV; we read <strong>one concrete problem you solved</strong> "
            "— a signal, a control loop, a vacuum leak. All of them count.",
        ],
        "section-title": ["Open tracks", "How to apply"],
        "section-lede": [
            "The tracks come from the project announcement “Team recruitment: join the future of "
            "fusion”. Levels and head-count are still open.",
            "Four steps, no written test — real problems instead of exam questions.",
        ],
    },
}

FOOTER_OLD = "<span>素材与文案来源:docs/CONTENT-SOURCES.md</span>"
FOOTER_NEW = ('<span data-zh="素材与文案来源:docs/CONTENT-SOURCES.md" '
              'data-en="Assets and copy sources: docs/CONTENT-SOURCES.md">'
              '素材与文案来源:docs/CONTENT-SOURCES.md</span>')


def instrument(html: str, name: str, cls: str, trans: list[str]) -> tuple[str, int]:
    pat = re.compile(r'<(' + name + r' class="' + cls + r'")>(.*?)</' + name + r'>', re.S)
    it = iter(trans)
    used = 0

    def rep(m: re.Match[str]) -> str:
        nonlocal used
        en = next(it, None)
        if en is None or 'data-en=' in m.group(2) or 'data-en=' in m.group(0):
            return m.group(0)
        zh = re.sub(r'\s+', ' ', m.group(2)).strip()
        is_html = bool(re.search(r'<[a-zA-Z/]', zh))
        attrs = f' data-zh="{zh}" data-en="{en}"' + (' data-html="1"' if is_html else '')
        used += 1
        return f'<{m.group(1)}{attrs}>{m.group(2)}</{name}>'

    return pat.sub(rep, html), used


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只检查,不写回")
    args = ap.parse_args()

    total = 0
    for page, spec in EN.items():
        path = ROOT / page
        if not path.exists():
            print(f"  ! 缺少 {page}")
            continue
        html = path.read_text(encoding="utf-8")
        counts = []
        tag_for = {"display": "h1", "section-title": "h2", "lede": "p", "section-lede": "p"}
        for cls, trans in spec.items():
            html, n = instrument(html, tag_for[cls], cls, trans)
            counts.append(f"{cls}:{n}/{len(trans)}")
            total += n
        if FOOTER_OLD in html:
            html = html.replace(FOOTER_OLD, FOOTER_NEW)
            print(f"  ✓ {page}  {' '.join(counts)}  footer:1")
        else:
            print(f"  ✓ {page}  {' '.join(counts)}  (footer 已是新版)")
        if not args.check:
            path.write_text(html, encoding="utf-8")
    print(f"\n共标注 {total} 处文案" + ("(未写回)" if args.check else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
