#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 bolloon 项目留下的封面图导入本仓库,作为**后续点缀素材池**。

只做「复制 + 登记」,不修改源文件、不做任何重编码(原图即素材)。
导入后写 assets/cover/manifest.json:文件名 / 尺寸 / 字节 / sha256 / 来源。

用法:
    python3 tools/import_covers.py                     # 用默认源(bolloon-UI/fig)
    python3 tools/import_covers.py --src PATH          # 换源目录
    python3 tools/import_covers.py --index PATH        # 同时登记 index.json 清单
    python3 tools/import_covers.py --dry-run           # 只打印将要复制什么
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import shutil
import sys

DEFAULT_SRC = pathlib.Path.home() / "Downloads" / "bolloon-UI" / "fig"
DEFAULT_INDEX = pathlib.Path.home() / "Downloads" / "bolloon" / "src" / "web" / "covers" / "index.json"
DEST_REL = pathlib.Path("assets") / "cover"
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(DEFAULT_SRC))
    ap.add_argument("--index", default=str(DEFAULT_INDEX))
    ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    src = pathlib.Path(args.src).expanduser().resolve()
    if not src.is_dir():
        sys.exit(f"源目录不存在: {src}")
    root = pathlib.Path(args.out).resolve()
    dest = root / DEST_REL

    files = sorted(p for p in src.iterdir() if p.suffix.lower() in EXTS)
    if not files:
        sys.exit(f"源目录里没有图片: {src}")

    print(f"源目录  {src}")
    print(f"目标    {dest.relative_to(root)}")
    print(f"共 {len(files)} 张 / {sum(p.stat().st_size for p in files)/1024/1024:.2f} MB\n")
    if args.dry_run:
        for p in files:
            print("  将复制", p.name)
        return 0

    dest.mkdir(parents=True, exist_ok=True)
    entries = []
    for i, p in enumerate(files, 1):
        target = dest / p.name
        shutil.copy2(p, target)                 # 原样复制,不重编码
        try:
            from PIL import Image
            with Image.open(target) as im:
                size = list(im.size)
        except Exception:
            size = None
        entries.append({
            "file": str(DEST_REL / p.name),
            "size": size,
            "bytes": target.stat().st_size,
            "sha256": sha256(target),
            "origin": str(p),
        })
        if i % 20 == 0 or i == len(files):
            print(f"  … 已复制 {i}/{len(files)}")

    index_src = pathlib.Path(args.index).expanduser()
    index_listed = None
    if index_src.exists():
        try:
            index_listed = json.loads(index_src.read_text(encoding="utf-8"))
            shutil.copy2(index_src, dest / "index.json")
        except Exception as e:
            print(f"  ! index.json 登记失败: {e}")

    (dest / "manifest.json").write_text(json.dumps({
        "note": "bolloon 项目留下的封面图素材池。原样复制,未重编码。"
                "用途:后续作为站点点缀 / 替换低分辨率的裁切素材。",
        "source_dir": str(src),
        "source_index": str(index_src) if index_src.exists() else None,
        "index_listed": index_listed,
        "count": len(entries),
        "total_bytes": sum(e["bytes"] for e in entries),
        "files": entries,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n✓ {len(entries)} 张 → {DEST_REL}/ ,登记写入 {DEST_REL}/manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
