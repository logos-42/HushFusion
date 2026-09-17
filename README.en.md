# HUSHFUSION · Brand Site

[中文](README.md) | **English**

> Controlled Fusion Through the Silence.
> A **zero-build** static brand site + a full set of assets cut from one single source image + the design spec documents.

---

## What this is

* `index.html` / `about.html` / `hibs.html` / `progress.html` — a four-page, dark, exhibition-style static site
* `assets/` — **11 image slices + 2 icons** (exactly what the pages reference; every one cut from the **same source image**, with sha256 and source crop boxes recorded)
* `docs/` — design brief, design plan (an implementation spec you can hand to a front-end agent), content-source table, asset inventory, real-browser screenshots
* `tools/` + `scripts/` — the deterministic slicer and the real-browser verification script

**No npm, no bundler, no framework.** One `style.css` is the entire design system.

---

## Quick start

```bash
# 1 Preview locally
python3 -m http.server 8898
#   then open http://127.0.0.1:8898

# 2 Real-browser verification (105 assertions across 4 pages + full-page screenshots)
node scripts/verify-site.mjs http://127.0.0.1:8898

# 3 Replay every asset slice from the source image (deterministic; recomputes sha256 + palette)
python3 tools/slice_assets.py          # only the slices the site uses (default)
python3 tools/slice_assets.py --all    # include the spare, unused crops as well
```

---

## Layout

```text
.
├── index.html                 Home: poster first → intro → marquee → 01 five pillars → 02 current stage
├── about.html                 About: why fusion, why "hush" + the technical logic and the motive
├── hibs.html                  HIBS Team: three tracks + how to join
├── progress.html              Progress: current stage + technology (01 time-varying gravity / 02 AI control)
├── style.css                  the single design system (tokens + every component)
├── app.js                     language switch / tabs / copy / scroll reveal / mobile nav
├── assets/
│   ├── manifest.json          source crop box / size / bytes / sha256 per slice
│   ├── palette.json           sampled palette values + the printed hex from the design board
│   ├── hero/  brand/  art/    key visual / brand / illustration slices
│   └── cover/                 accent pool: 80 brush covers at 512×682 (from bolloon, see docs/ASSETS.md §7)
├── icons/                     favicon-32 · apple-touch-icon-180
├── docs/
│   ├── design-brief.md        design brief (the L0 criteria: ruling sentences / prohibitions / seven asset traits)
│   ├── DESIGN-PLAN.md         ★ the front-end design plan (implementation spec)
│   ├── CONTENT-SOURCES.md     where every sentence on the site comes from
│   ├── ASSETS.md              asset inventory and resolution discipline
│   └── screenshots/           screenshots produced by the verification run
├── tools/
│   ├── slice_assets.py        the slicer (single entry point; --all includes spare crops)
│   ├── import_covers.py       imports the bolloon cover pool (copy + sha256 registry)
│   └── instrument_i18n.py     adds data-zh / data-en pairs to copy
└── scripts/verify-site.mjs    dependency-free real-browser verification (CDP-driven headless Chrome)
```

---

## The single source of every asset

```text
~/.hermes/images/clip_20260917_101147_1.png
1312 × 1199 · sha256 = aa36a2c81d441d7c550316c47b2d14cb112b3d2fdf5b22184e33211090abaf45
```

**There is no second source, and nothing here was drawn from scratch.** Every slice's crop box lives in
`assets/manifest.json` and can be replayed byte-for-byte with `python3 tools/slice_assets.py`.

Where higher-quality art is needed, see the **re-draw list** in `docs/DESIGN-PLAN.md` §10.3
(which assets are currently only 76–295px and need vectors or high-resolution versions from the designers).

---

## How to make changes safely

```text
CSS / JS         → bump ?v=N in EVERY HTML file (miss one and that page keeps serving stale cache)
                   grep -o 'style.css?v=[0-9]*' *.html | sort | uniq -c
Copy             → change data-zh and data-en together (or run python3 tools/instrument_i18n.py)
Assets           → keep the filename, overwrite the file under assets/, then bump ?v=N
Structure/layout → edit docs/DESIGN-PLAN.md first, then the implementation (the plan wins on conflict)
```

**Verification discipline**: always run `node scripts/verify-site.mjs` before calling it done.
Dumping HTML in a terminal is not verification — scroll reveal starts at `opacity: 0`, so a dump
reads as a blank page and you would "confirm" a broken site.

---

## Known TODOs

| # | Item | Where |
|:--|:--|:--|
| 1 | Design decisions still awaiting approval (printed vs sampled accent colour, paper blocks vs transparency…) | `docs/DESIGN-PLAN.md` §12 |
| 2 | Vector / high-resolution re-draw of low-res assets (marks, app icon, illustration) | `docs/DESIGN-PLAN.md` §10.3 |
| 3 | Client-side content still marked `[待填]` (names, metrics, email, milestones) | `docs/CONTENT-SOURCES.md` §3 |
| 4 | Rewording the logic/motive sentence (time-varying gravity / silencing noise) | `docs/CONTENT-SOURCES.md` §二·五 |
| 5 | Proof-reading of low-res transcriptions (intro punctuation, poster annotations) | `docs/CONTENT-SOURCES.md` §4 |
| 6 | **Minimum-disclosure rule**: public pages carry no repo paths, pixel sizes, shell commands or process talk — read `docs/DESIGN-PLAN.md` §4 rule 11 before adding copy | `docs/DESIGN-PLAN.md` |
| 7 | HIBS Team page member list / portraits / affiliations are still placeholders | `docs/CONTENT-SOURCES.md` §3 |
