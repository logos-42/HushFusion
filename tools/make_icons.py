#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HUSHFUSION 图标生成脚本(可复现)
--------------------------------
唯一源图:`<raw_root>/internal_sources/logo/logo-wave-1254.png`(需方 2026-09-17 提供的消音波形图标)

本脚本只做「去底 + 裁到内容 + 居中留白 + 缩放 + 记录 sha256」,不生成任何臆造的图形。
产出(站点所有出现图标的位置):

  icons/favicon-32.png              浏览器标签页图标(32,深蓝底 + 白波形)
  icons/apple-touch-icon.png        iOS/书签图标(180)
  assets/brand/mark-wave--white.png 顶栏左上角标识(透明底白波形,CSS 里按 26px 显示)
  assets/brand/app-icon.png         应用图标槽位(256 深蓝底)

清晰度:源图 1254px 直接缩到目标尺寸(不二次放大),≥128px 的导出缩小后补一次轻锐化;
顶栏标识默认 256px 导出(26px 显示 ≈ 10x,任何 DPR 都够),要更大 `--mark-px 512`。

favicon 与 app icon 保留源图的深蓝底(标签栏明暗两种底色上都读得清);
顶栏标识是「白笔迹 + 深蓝底」键出成透明底,直接叠在页面深底上。

为什么单独一个脚本:图标与海报切片是**两个源图**,各自的产物分开放
(`assets/manifest.json` 记海报切片,`assets/icons.manifest.json` 记图标),任何一个脚本重跑都不会盖掉另一个。

用法:
  python3 tools/make_icons.py                # 默认:切站点引用到的四件
  python3 tools/make_icons.py --all          # 连 icons/icon-192 / icon-512 一起切(备用)
  python3 tools/make_icons.py --source PATH  # 换源图(默认走 raw root)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import sys

try:
    from PIL import Image, ImageFilter
except ImportError:  # pragma: no cover
    sys.exit("需要 Pillow: python3 -m pip install Pillow")

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW_ROOT = pathlib.Path(os.environ.get("PROJECT_RAW_ROOT",
                                       ROOT.parent / "hushfusion_raw")).expanduser().resolve()
DEFAULT_SOURCE = RAW_ROOT / "internal_sources" / "logo" / "logo-wave-1254.png"

# 顶栏标识的导出边长:显示 26px,256px 导出 ≈ 10x,任何 DPR 都够;要更大用 --mark-px
MARK_PX = 256
# 缩小之后补一点锐度(源图是 1254px 线稿,大比例缩小会让笔迹发虚);
# 只在 ≥128px 的导出上做 —— 32px 那档本来就小,再加锐会出锯齿
SHARPEN_FROM = 128
SHARPEN = dict(radius=0.9, percent=70, threshold=2)
# 方块图标的留白系数:内容最大边 × 1.18(四周各 ~9%,32px 下波形仍立得住)
TILE_PAD = 1.18
# 透明标识的留白系数:内容最大边 × 1.06(顶栏按 26px 显示,填充率要够,否则线稿会显得轻)
MARK_PAD = 1.06
# 低于这个 alpha 视为底噪,直接归零(源图深蓝底有一点点压缩噪点;
# 阈值压得低 = 保留更多抗锯齿细节,清晰度优先)
ALPHA_FLOOR = 0.05

FAVICON_SIZES = [(32, "icons/favicon-32.png"), (180, "icons/apple-touch-icon.png")]
FAVICON_SIZES_EXTRA = [(192, "icons/icon-192.png"), (512, "icons/icon-512.png")]


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def luma(rgb) -> float:
    r, g, b = rgb[:3]
    return 0.299 * r + 0.587 * g + 0.114 * b


def sample_bg(img: Image.Image) -> tuple[int, int, int]:
    """四角的多数色 = 底色(源图是纯色深蓝底)。"""
    w, h = img.size
    corners = [img.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    return sorted(corners, key=lambda c: corners.count(c))[-1][:3]


def content_bbox(img: Image.Image, bg: tuple[int, int, int], tol: float = 28.0):
    """与底色差别超过 tol 的像素范围 = 图形本体。"""
    px = img.load()
    w, h = img.size
    x1, y1, x2, y2 = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol:
                if x < x1: x1 = x
                if y < y1: y1 = y
                if x > x2: x2 = x
                if y > y2: y2 = y
    if x2 <= x1 or y2 <= y1:
        sys.exit("源图里找不到图形本体(全图都是底色?)")
    return (x1, y1, x2 + 1, y2 + 1)


def white_mark(img: Image.Image, bg: tuple[int, int, int], box) -> Image.Image:
    """深蓝底 + 白笔迹 → 透明底白图形。

    做法:按亮度把「离底色的距离」映射成 alpha(底 → 0,白 → 255),
    颜色固定为白;低于 ALPHA_FLOOR 的噪点清零。这样抗锯齿边缘不会发灰,
    叠在页面深底上也看不出方框。
    """
    bg_l = luma(bg)
    crop = img.crop(box).convert("RGB")
    w, h = crop.size
    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    src_px, out_px = crop.load(), out.load()
    for y in range(h):
        for x in range(w):
            a = (luma(src_px[x, y]) - bg_l) / (255.0 - bg_l)
            a = 0.0 if a < ALPHA_FLOOR else min(1.0, a)
            out_px[x, y] = (255, 255, 255, int(round(a * 255)))
    return out


def pad_square(img: Image.Image, bg, factor: float) -> Image.Image:
    """把内容居中放进正方形画布(边 = 内容最大边 × factor)。"""
    side = int(round(max(img.size) * factor))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0) if bg is None else (*bg, 255))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2),
                 img if img.mode == "RGBA" else None)
    return canvas


def downscale(img: Image.Image, px: int) -> Image.Image:
    """缩小到 px×px;≥SHARPEN_FROM 的导出补一次轻锐化(保清晰度,不做二次放大)。"""
    out = img.resize((px, px), Image.LANCZOS)
    if px >= SHARPEN_FROM:
        out = out.filter(ImageFilter.UnsharpMask(**SHARPEN))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="生成站点图标(可复现)")
    ap.add_argument("--source", default=str(DEFAULT_SOURCE), help="图标源图路径")
    ap.add_argument("--all", action="store_true", help="连备用尺寸(192/512)一起切")
    ap.add_argument("--mark-px", type=int, default=MARK_PX,
                    help=f"顶栏标识导出边长(默认 {MARK_PX};源图 1254px,要多大给多大)")
    args = ap.parse_args()

    src = pathlib.Path(args.source).expanduser().resolve()
    if not src.exists():
        sys.exit(f"找不到源图: {src}\n(先在 raw root 里放好,或用 --source 指定)")

    img = Image.open(src).convert("RGB")
    bg = sample_bg(img)
    box = content_bbox(img, bg)
    print(f"源图   {src}")
    print(f"      {img.width}×{img.height} · sha256 {sha256(src)[:16]}…")
    print(f"底色   #{bg[0]:02X}{bg[1]:02X}{bg[2]:02X} · 图形内容框 {box}\n")

    # ---- 顶栏标识:透明底白波形 -------------------------------------------
    mark = pad_square(white_mark(img, bg, box), None, MARK_PAD)
    mark = downscale(mark, args.mark_px)

    records: list[dict] = []
    out_mark = ROOT / "assets" / "brand" / "mark-wave--white.png"
    out_mark.parent.mkdir(parents=True, exist_ok=True)
    mark.save(out_mark, "PNG", optimize=True)
    records.append({"file": "assets/brand/mark-wave--white.png", "size": [args.mark_px, args.mark_px],
                    "note": f"顶栏左上角标识(透明底白波形;CSS 按 26px 显示,{args.mark_px}px 导出≈"
                            f"{args.mark_px/26:.0f}x)",
                    "sha256": sha256(out_mark), "bytes": out_mark.stat().st_size})
    print(f"  ✓ assets/brand/mark-wave--white.png   {args.mark_px}x{args.mark_px}   "
          f"{out_mark.stat().st_size/1024:.1f} KB")

    # ---- 方块图标:源图深蓝底 + 白波形 -------------------------------------
    tile = pad_square(mark, bg, TILE_PAD)
    sizes = list(FAVICON_SIZES) + (list(FAVICON_SIZES_EXTRA) if args.all else [])

    out_app = ROOT / "assets" / "brand" / "app-icon.png"
    big = downscale(tile, 256)
    big.save(out_app, "PNG", optimize=True)
    records.append({"file": "assets/brand/app-icon.png", "size": [256, 256],
                    "note": "应用图标槽位(深蓝底 + 白波形)", "sha256": sha256(out_app),
                    "bytes": out_app.stat().st_size})
    print(f"  ✓ assets/brand/app-icon.png           256x256   "
          f"{out_app.stat().st_size/1024:.1f} KB")

    for px, rel in sizes:
        dest = ROOT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        downscale(tile, px).save(dest, "PNG", optimize=True)
        note = ("浏览器标签页图标" if px == 32 else
                "iOS / 书签图标" if px == 180 else "备用尺寸(站点未引用, --all 才切)")
        records.append({"file": rel, "size": [px, px], "note": note,
                        "sha256": sha256(dest), "bytes": dest.stat().st_size})
        print(f"  ✓ {rel:<38} {px:>4}x{px:<4} {dest.stat().st_size/1024:>7.1f} KB")

    manifest = {
        "note": "图标产物索引(与海报切片分开放:那是 assets/manifest.json)。"
                "两个源图、两个脚本、两份索引 —— 重跑任何一边都不会盖掉另一边。",
        "source": str(src),
        "source_sha256": sha256(src),
        "source_size": [img.width, img.height],
        "background_hex": "#%02X%02X%02X" % bg,
        "content_box": list(box),
        "assets": records,
    }
    out_json = ROOT / "assets" / "icons.manifest.json"
    out_json.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n共 {len(records)} 个文件 → assets/icons.manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
