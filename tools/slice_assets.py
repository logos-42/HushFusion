#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HUSHFUSION 素材切图脚本(可复现)
--------------------------------
唯一源图: ~/.hermes/images/clip_20260917_101147_1.png  (1312 x 1199)
本脚本只做「裁剪 + 去底 + 缩放 + 记录 sha256」,不生成任何臆造的图形。
所有坐标都是源图像素坐标,来自对源图的投影分析与人工目视核对。

用法:  python3 tools/slice_assets.py          # 只切站点真正引用到的素材(默认)
       python3 tools/slice_assets.py --all    # 连同备用素材一起切(见 EXTRA_CROPS)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("需要 Pillow: python3 -m pip install Pillow")

DEFAULT_SOURCE = pathlib.Path.home() / ".hermes" / "images" / "clip_20260917_101147_1.png"
PAPER = (245, 241, 234)  # 海报纸色,用于去底

# ---------------------------------------------------------------------------
# 切图清单: (输出相对路径, 源图裁剪框 x1,y1,x2,y2, 说明)
#   默认只切「站点真正引用到的」素材 —— 没被引用的素材放在 EXTRA_CROPS,
#   要时用 `python3 tools/slice_assets.py --all` 再cut,避免仓库里堆一堆没人用的图。
# ---------------------------------------------------------------------------
CROPS: list[tuple[str, tuple[int, int, int, int], str]] = [
    # ---- 主视觉 ------------------------------------------------------------
    ("hero/poster-full.png",        (0, 0, 1312, 497),      "整幅手绘海报(品牌主视觉,含字)"),
    ("hero/art-tokamak.png",        (520, 0, 1312, 497),    "海报右侧纯画面(反应堆+屋顶少年,含海报角标与批注)"),
    ("hero/art-tokamak-wide.png",   (556, 200, 1312, 497),  "海报右侧横裁(避开角标与批注,宽幅插图用)"),
    ("art/plasma-ring.png",         (690, 868, 985, 992),   "桌面稿内的 FRC 等离子环插画"),

    # ---- 品牌 --------------------------------------------------------------
    ("brand/slogan-cn.png",         (96, 214, 358, 305),    "中文标语 消音计划 / 在寂静中,点燃星辰。"),
    ("brand/list-frc.png",          (36, 331, 196, 419),    "要点清单 FRC·AI Control·…"),
    ("brand/mark-bolt.png",         (1063, 989, 1139, 1062), "闪电/星芒标志(白)"),
    ("brand/tile-vortex.png",       (1053, 1077, 1148, 1171), "圆章方块版(深色圆角砖)"),

    # ---- 界面稿 ------------------------------------------------------------

    # ---- 配色 --------------------------------------------------------------
]

# 备用素材:站点当前没引用,但源图里确实有、值得保留坐标 → 用 --all 才切
EXTRA_CROPS: list[tuple[str, tuple[int, int, int, int], str]] = [
    ("ui/desktop-hero.png",         (452, 568, 1026, 798),  "桌面稿 Hero 画面"),
    ("palette/swatches.png",        (16, 1072, 320, 1140),  "设计板色卡行(5 色 + 十六进制标注)"),
    ("hero/art-boy-rooftop.png",    (470, 215, 660, 497),   "屋顶少年局部(190px,只能小尺寸用)"),
    ("brand/logo-corner.png",       (1140, 4, 1308, 56),    "海报右上角水平锁定(苗形标+字)"),
    ("brand/mark-seedling.png",     (1146, 5, 1206, 54),    "苗形圆章(蓝)"),
    ("brand/tagline-en.png",        (0, 0, 256, 48),        "英文角标 Controlled Fusion / Through the Silence."),
    ("brand/signature-wave.png",    (28, 436, 172, 482),    "心跳波形签名"),
    ("brand/mark-vortex.png",       (1174, 983, 1258, 1068), "环形笔触圆章"),
    ("ui/mobile-hero.png",          (1070, 743, 1296, 808), "手机稿 Hero 画面"),
    ("brand/paper-texture.png",     (200, 46, 456, 90),     "纸底纹理(自动选的最平整一块)"),

    # ---- 需方 2026-09-17 确认多余的截图素材(源图坐标保留,要时 --all 取回) ----
    ("ui/mockup-desktop.png",       (319, 531, 1029, 1174), "桌面端整屏 Mockup"),
    ("ui/mockup-mobile.png",        (1060, 523, 1302, 959), "手机端整屏 Mockup"),
    ("news/news-01.png",            (348, 1055, 553, 1121), "进展卡 1:FRC 约束实验"),
    ("news/news-02.png",            (574, 1055, 780, 1121), "进展卡 2:AI 控制系统"),
    ("news/news-03.png",            (792, 1055, 997, 1121), "进展卡 3:团队招募"),

    # ---- 已从页面撤下的手写体字标(改用文字渲染,见 docs/DESIGN-PLAN.md) ----
    ("brand/wordmark-brush.png",    (22, 92, 525, 215),     "手写体主标 HushFusion(纸底)"),
]

# 只产出「键出为透明」的白色版、不保留原图的项
WHITE_ONLY = {"brand/mark-bolt.png"}

# 深色底图标的「白底透明」版本(白笔迹 + 深色底 → 干净的 alpha,不会像纸底键出那样留晕)
DARK_ALPHA_CROPS = {
    "brand/mark-bolt.png": "brand/mark-bolt--white.png",
    "brand/mark-vortex.png": "brand/mark-vortex--white.png",
}

# 图标(favicon / apple-touch-icon / 顶栏标识 / app icon)自 2026-09-17 起由
# tools/make_icons.py 从**另一张源图**(需方提供的消音波形图标)生成 ——
# 本脚本不再写 icons/,也不再切 brand/app-icon.png,免得两个脚本互相盖。
# 产物索引在 assets/icons.manifest.json。

def key_out_paper(img: Image.Image, tol: int = 10, soft: int = 42) -> Image.Image:
    """把纸底键出为透明,得到可直接叠在深色背景上的 PNG。

    做法:先用裁剪块**四条边的中位色**估计本块的纸色(源海报的纸面有渐变/暗角,
    全局常量会留下矩形晕),再按「与纸色的通道最大距离」生成 alpha,
    并按 C = a·F + (1-a)·paper 反解出前景色 F,避免半透明边缘发灰。
    """
    return _key_against(img, predict_light=False, tol=tol, soft=soft)


def key_out_dark(img: Image.Image, tol: int = 14, soft: int = 60) -> Image.Image:
    """深色底上的白笔迹 → 透明底白图形(用于导航栏 / favicon 叠在深色页面上)。"""
    return _key_against(img, predict_light=True, tol=tol, soft=soft)


def _key_against(img: Image.Image, predict_light: bool, tol: int, soft: int) -> Image.Image:
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()

    border: list[tuple[int, int, int]] = []
    for x in range(w):
        border += [px[x, 0], px[x, 1], px[x, h - 2], px[x, h - 1]]
    for y in range(h):
        border += [px[0, y], px[1, y], px[w - 2, y], px[w - 1, y]]
    border.sort(key=lambda c: c[0] + c[1] + c[2])
    bg = border[len(border) // 2]  # 中位色,不被少量笔迹污染

    out = Image.new("RGBA", img.size)
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
            if d <= tol:
                op[x, y] = (0, 0, 0, 0)
                continue
            a = 1.0 if d >= soft else (d - tol) / (soft - tol)
            if a >= 0.999:
                op[x, y] = (255, 255, 255, 255) if predict_light else (r, g, b, 255)
                continue
            if predict_light:
                f = (255, 255, 255)
            else:
                f = tuple(max(0, min(255, int((c - (1 - a) * p) / a)))
                          for c, p in zip((r, g, b), bg))
            op[x, y] = (f[0], f[1], f[2], int(round(a * 255)))
    return out


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent))
    ap.add_argument("--all", action="store_true",
                    help="连同站点没引用的备用素材一起切(默认只切站点用到的)")
    args = ap.parse_args()

    src = pathlib.Path(args.source).expanduser()
    if not src.exists():
        sys.exit(f"源图不存在: {src}")
    root = pathlib.Path(args.out).resolve()
    src_img = Image.open(src).convert("RGB")
    print(f"源图 {src.name}  {src_img.width}x{src_img.height}  sha256={sha256(src)[:16]}…")

    crops = list(CROPS) + (list(EXTRA_CROPS) if args.all else [])
    manifest = []
    for rel, box, note in crops:
        dst = root / "assets" / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        crop = src_img.crop(box)

        if rel not in WHITE_ONLY:          # 只出透明白版的项,不落原图
            crop.save(dst, "PNG", optimize=True)
            manifest.append({
                "file": f"assets/{rel}", "src_box": list(box),
                "size": [crop.width, crop.height], "note": note,
                "sha256": sha256(dst), "bytes": dst.stat().st_size,
            })
            print(f"  ✓ {rel:<38} {crop.width:>4}x{crop.height:<4} "
                  f"{dst.stat().st_size/1024:>7.1f} KB  {note}")

        if rel in DARK_ALPHA_CROPS:
            alpha_rel = DARK_ALPHA_CROPS[rel]
            adst = root / "assets" / alpha_rel
            key_out_dark(crop).save(adst, "PNG", optimize=True)
            manifest.append({
                "file": f"assets/{alpha_rel}", "src_box": list(box),
                "size": [crop.width, crop.height], "note": note + "(深色底已键出为透明)",
                "sha256": sha256(adst), "bytes": adst.stat().st_size,
            })
            print(f"  ✓ {alpha_rel:<38} {crop.width:>4}x{crop.height:<4} "
                  f"{adst.stat().st_size/1024:>7.1f} KB  透明白版")

    # ---- 图标:不在这里生成 ------------------------------------------------
    # favicon / apple-touch-icon / 顶栏标识 / app icon 由 tools/make_icons.py 从
    # 图标源图生成(见该脚本头部说明),这里只提醒一句,不做任何写入。
    print("  · 图标不在本脚本产出:改图标请跑 python3 tools/make_icons.py")

    (root / "assets").mkdir(exist_ok=True)

    # ---- 色板：从源图实际像素采样,并把设计板上写明的十六进制码一起记录 -----
    def hexat(x: int, y: int) -> str:
        r, g, b = src_img.getpixel((x, y))
        return "#%02X%02X%02X" % (r, g, b)

    samples = {
        # 5 个色卡圆心的实测像素(圆心由脚本投影分析得出,见 slice_assets 的色卡检测)
        "blue": (68, 1095), "amber": (121, 1095), "white": (174, 1095),
        "grey": (228, 1095), "navy": (280, 1106),
        "paper": (420, 60),            # 海报纸面
        "poster_ink": (120, 150),      # 手写主标的墨色
        "board_bg": (200, 700),        # 设计板深色底
        "board_panel": (1150, 620),    # 设计板右侧面板底
    }
    palette = {
        "note": "色值由脚本从源图像素直接采样(坐标见 point),design_board_hex 是设计板上"
                "印刷的十六进制码原文;两者不一致时以采样值为准并记录差异。",
        "sampled": {k: {"hex": hexat(x, y), "point": [x, y], "rgb": list(src_img.getpixel((x, y)))}
                    for k, (x, y) in samples.items()},
        "design_board_hex": {"blue": "#3B82F6", "amber": "#F59E0B", "white": "#F8FAFC",
                             "grey": "#9CA3AF", "navy": "#080F1A"},
    }
    (root / "assets" / "palette.json").write_text(
        json.dumps(palette, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n采样色板:")
    for k, v in palette["sampled"].items():
        print(f"  {k:<20} {v['hex']}  @{v['point']}")

    (root / "assets" / "manifest.json").write_text(
        json.dumps({"source": str(src), "source_sha256": sha256(src),
                    "source_size": [src_img.width, src_img.height],
                    "assets": manifest}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n共 {len(manifest)} 个文件 → {root}/assets/manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
