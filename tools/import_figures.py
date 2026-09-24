#!/usr/bin/env python3
"""把 Hibs-Physics 仓库生成的科学图导入为站点素材（确定性、可重放）。

来源：`~/Downloads/lean/ProjectionPhysics/artifacts/<round>/<fig>.png`
      —— 那份仓库是这些图的**产出者**（matplotlib 脚本 + 数值验证），
      所以本站不重绘、不裁剪、不改色，只做降采样（宽 ≤ MAX_W）+ 改名 + 记账。

产物：
  assets/art/<name>.png            站点用图（未裁剪、未改色，只等比降采样）
  assets/figures.manifest.json     逐文件 sha256 / 字节 / 尺寸 / 来源（一条命令可重放）

纪律：
  - 一个来源一个脚本、一个产物一个写入者 —— 本脚本是 assets/art 下这批图的唯一写入者
  - 重放幂等：同一份源图跑两次结果一致（sips 等比缩放是确定性的）
  - 列在 EXCLUDE 里的图**不进站**（含未核实的报价/成本数字，公开页不放）

用法：
  python3 tools/import_figures.py            # 导入 + 重新记账
  python3 tools/import_figures.py --check    # 只核对现有产物与台账（CI 用，不写文件）
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST_DIR = ROOT / "assets" / "art"
INDEX = ROOT / "assets" / "figures.manifest.json"

# 源仓库（图的产出者）。导出成站点素材时两个源都记下来：
#   repo   —— 公开可核对的仓库地址
#   commit —— 本次导入时的 HEAD（sha 可复核）
HIBSPHYS = Path("/Users/apple/Downloads/lean/ProjectionPhysics")
HIBSPHYS_REPO = "https://github.com/logos-42/Hibs-Physics"

MAX_W = 1400  # 站内版心 1200px；1400 给 2× 屏留余量，同时把 400KB 级原图压到可交付大小
# 逐图可覆盖：示意图字大 → 收窄省字节；场图线细 → 保持宽
CAP = {
    "antigravity-ring.png": 1100,
}

# (源相对路径, 站内文件名, 中文说明, 英文说明)
FIGURES = [
    ("artifacts/antigravityconfinement/fig_confinement_ring.png",
     "antigravity-ring.png",
     "反引力约束聚变环 · 装置系统示意图（三层同心:燃料区 / 双流环 / RMF 线圈）",
     "Anti-gravity confinement ring — three concentric layers (fuel / twin flow rings / RMF coil)"),
    ("artifacts/antigravityconfinement/fig_mu_working_window.png",
     "antigravity-mu-window.png",
     "反引力约束的 μ 工作区间：τ_E 提升（FC4）与 RMF 天花板 0.99978（FC11）之间",
     "μ working window: τ_E gain (FC4) against the RMF ceiling 0.99978 (FC11)"),
    ("artifacts/antigravityconfinement/fig_field_map.png",
     "antigravity-field-map.png",
     "轴向磁场 B_z(r,z)：完全反转场反位形（内部反向 → 分离面归零 → 边缘正向）",
     "Axial field B_z(r,z): fully reversed field-reversed configuration"),
    ("artifacts/antigravityconfinement/fig_field_line.png",
     "antigravity-field-line.png",
     "磁力线走向：分离面内闭合（场反位形）/ 外部开放（轴向场）",
     "Field-line topology: closed inside the separatrix, open outside"),
    ("artifacts/mudynamics/fig_mu_dynamics.png",
     "mu-dynamics.png",
     "μ 动力学 2×2:轨道(逼近 1 而不达)· 收敛三区(η≤1 / 1<η<2 / η≥2)· 顺序不可交换(1.00 vs 0.00)· m_eff² 指数衰减恒 > 0",
     "μ dynamics, 2×2: trajectory (approaches 1, never reaches) · three convergence bands · order dependence (1.00 vs 0.00) · m_eff² decays but stays > 0"),
    ("artifacts/moirefield/fig_field_ceiling_scaling.png",
     "moire-field-ceiling.png",
     "场源天花板 → 密度上限与功率密度（n ∝ B², P ∝ B⁴, 体积 ∝ B⁻⁴）",
     "Field-source ceiling → density and power density (n ∝ B², P ∝ B⁴, volume ∝ B⁻⁴)"),
    ("artifacts/moirefield/fig_mu_window_verdict.png",
     "moire-mu-verdict.png",
     "μ 窗口判决：所需 (1−μ) 上限 vs 硬地板 m_e/m_i（曲线低于地板 = 无解）",
     "μ window verdict: required (1−μ) ceiling vs the hard floor m_e/m_i"),
    ("artifacts/moirefield/fig_Bdeath_vs_size.png",
     "moire-bdeath-size.png",
     "生死判据 B_death ∝ 1/a：装置越小，要求的场越强（附三条材料天花板）",
     "Death threshold B_death ∝ 1/a against three material ceilings"),
    ("artifacts/moirefield/fig_gate_gaps.png",
     "moire-gate-gaps.png",
     "四道门的缺口：场门 / 载流门 / 片超流密度门 / 制冷门",
     "Gaps of the four gates: field / sheet current / superfluid density / cryogenics"),
]

# 不进站的图:理由写在 note 里(公开页不放未核实的报价)
EXCLUDE = [
    ("artifacts/antigravityconfinement/fig_material.png",
     "材料清单(BOM)图含逐件「参考价」——公开页不放未核实的成本数字(金额不入站);"
     "内部留档在 Hibs-Physics 仓库 artifacts/ 下"),
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def commit_of(repo: Path) -> str:
    try:
        out = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"],
                             capture_output=True, text=True, check=True)
        return out.stdout.strip()
    except Exception:
        return "unknown"


def dims(path: Path) -> tuple[int, int]:
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
                         capture_output=True, text=True, check=True).stdout
    w = h = 0
    for line in out.splitlines():
        if "pixelWidth" in line:
            w = int(line.split(":")[-1].strip())
        if "pixelHeight" in line:
            h = int(line.split(":")[-1].strip())
    return w, h


def build(src: Path, dest: Path, cap: int) -> None:
    """等比降采样到 cap（不裁剪、不改色）；已经更窄的源图原样复制。"""
    w, _ = dims(src)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if w > cap:
        shutil.copy2(src, dest)
        subprocess.run(["sips", "--resampleWidth", str(cap), str(dest)],
                       capture_output=True, check=True)
        # sips 会重写元数据，再压一次 PNG 以去掉冗余块（确定性）
        subprocess.run(["sips", "-s", "format", "png", str(dest)],
                       capture_output=True, check=True)
    else:
        shutil.copy2(src, dest)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只核对，不写文件")
    args = ap.parse_args()

    if not HIBSPHYS.exists():
        print(f"import_figures: 找不到源仓库 {HIBSPHYS}", file=sys.stderr)
        return 1

    commit = commit_of(HIBSPHYS)
    entries = []
    problems = []

    for rel, name, note_zh, note_en in FIGURES:
        src = HIBSPHYS / rel
        dest = DEST_DIR / name
        if not src.exists():
            problems.append(f"缺源图 {rel}")
            continue
        if not args.check:
            build(src, dest, CAP.get(name, MAX_W))
        if not dest.exists():
            problems.append(f"缺产物 {dest.relative_to(ROOT)}")
            continue
        w, h = dims(dest)
        entries.append({
            "file": str(dest.relative_to(ROOT)),
            "size": [w, h],
            "bytes": dest.stat().st_size,
            "sha256": sha256(dest),
            "source": rel,
            "source_repo": HIBSPHYS_REPO,
            "source_commit": commit,
            "source_sha256": sha256(src),
            "note_zh": note_zh,
            "note_en": note_en,
        })

    # 台账核对：已有产物若与记录不符 → 报出来（别让「看着对」混过去）
    if args.check and INDEX.exists():
        old = json.loads(INDEX.read_text(encoding="utf-8"))
        oldmap = {e["file"]: e["sha256"] for e in old.get("assets", [])}
        for e in entries:
            if oldmap.get(e["file"]) not in (None, e["sha256"]):
                problems.append(f"产物变了未重放 {e['file']}")

    doc = {
        "generated_by": "tools/import_figures.py",
        "source_repo": HIBSPHYS_REPO,
        "source_commit": commit,
        "max_width": MAX_W,
        "replay": "python3 tools/import_figures.py",
        "excluded": [{"source": s, "reason": r} for s, r in EXCLUDE],
        "assets": entries,
    }
    if not args.check:
        INDEX.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"import_figures: {len(entries)} 张已导入 → {INDEX.relative_to(ROOT)}")
    else:
        print(f"import_figures --check: {len(entries)} 张在册")

    for e in entries:
        print(f"  {e['file']}  {e['size'][0]}×{e['size'][1]}  {e['bytes']:>7} B  {e['sha256'][:12]}")
    for s, r in EXCLUDE:
        print(f"  [排除] {s} —— {r}")
    if problems:
        print("\n问题:")
        for p in problems:
            print("  - " + p)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
