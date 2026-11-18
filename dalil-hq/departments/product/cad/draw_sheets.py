#!/usr/bin/env python3
"""Technical drawing sheets for the DALIL sticker, drawn from the same model as the STL files.
Writes PNGs to ./previews/. Needs: numpy, trimesh, shapely, matplotlib, networkx, manifold3d."""
import math
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import trimesh
from matplotlib.patches import Circle, FancyArrowPatch, Polygon as MPoly, Rectangle
from shapely import affinity
from shapely.geometry import box

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import generate_sticker as g  # noqa: E402

BONE, BLACK, YELLOW, GREY, MID = "#F2F1EC", "#0B0C0E", "#FFC700", "#8d8f93", "#5b5e63"
OUT = os.path.join(HERE, "previews")
os.makedirs(OUT, exist_ok=True)
plt.rcParams.update({"font.family": "DejaVu Sans", "text.color": BLACK, "axes.edgecolor": BLACK})


def dim_h(ax, x0, x1, y, text, off=0.0, fs=9, up=True):
    ax.annotate("", xy=(x0, y), xytext=(x1, y), arrowprops=dict(arrowstyle="<->", lw=0.9, color=BLACK, shrinkA=0, shrinkB=0))
    ax.text((x0 + x1) / 2, y + (0.9 if up else -0.9) + off, text, ha="center", va="bottom" if up else "top", fontsize=fs)


def dim_v(ax, x, y0, y1, text, off=0.0, fs=9, left=False):
    ax.annotate("", xy=(x, y0), xytext=(x, y1), arrowprops=dict(arrowstyle="<->", lw=0.9, color=BLACK, shrinkA=0, shrinkB=0))
    ax.text(x + (-0.9 if left else 0.9) + off, (y0 + y1) / 2, text, ha="right" if left else "left", va="center", fontsize=fs)


def rounded(length, width, r):
    return box(-length / 2 + r, -width / 2 + r, length / 2 - r, width / 2 - r).buffer(r, 48)


def spec_sheet():
    m, info = g.build_flat(g.DEMO_ARABIC, dot_h=0.5, numeral="2", numeral_h=16.0, relief=0.5)
    L, W = info["length"], info["width"]
    fig = plt.figure(figsize=(16, 11.2), dpi=150, facecolor=BONE)
    fig.text(0.04, 0.955, "DALIL sticker, variant A: braille + raised number", fontsize=20, weight="bold")
    fig.text(0.04, 0.925, "Round-1 prototype geometry, flat as printed. All dimensions in mm. Test variables, not a final specification.", fontsize=11, color=MID)

    # ---- plan view ----
    ax = fig.add_axes([0.04, 0.60, 0.92, 0.30], facecolor=BONE)
    ax.set_aspect("equal"); ax.axis("off")
    outer = rounded(L, W, g.CORNER_R); plateau = rounded(L - 2 * g.RAMP, W - 2 * g.RAMP, max(g.CORNER_R - g.RAMP, 0.5))
    ax.add_patch(MPoly(np.array(outer.exterior.coords), closed=True, fc="#FFE08A", ec=BLACK, lw=1.4))
    ax.add_patch(MPoly(np.array(plateau.exterior.coords), closed=True, fc=YELLOW, ec=MID, lw=0.8, ls="--"))
    nx0, ny0, nx1, ny1 = info["numeral_box"]
    npoly = affinity.translate(g.numeral_polygon("2", 16.0), nx0, ny0)
    ax.add_patch(MPoly(np.array(npoly.exterior.coords), closed=True, fc=BLACK, ec=BLACK))
    for (x, y) in info["dot_centres"]:
        ax.add_patch(Circle((x, y), g.DOT_D / 2, fc=BLACK, ec=BLACK))
    ax.set_xlim(-L / 2 - 6, L / 2 + 14); ax.set_ylim(-W / 2 - 10, W / 2 + 10)
    dim_h(ax, -L / 2, L / 2, W / 2 + 4.0, f"{L:.1f} overall length")
    dim_v(ax, L / 2 + 4, -W / 2, W / 2, f"{W:.1f} wide")
    xl = -L / 2 + g.RAMP + g.MARGIN
    dim_h(ax, xl, xl + info["braille_len"], -W / 2 - 3.0, f"{info['braille_len']:.1f} braille line, 9 cells", up=False)
    dim_h(ax, nx0, nx1, -W / 2 - 3.0, f"{nx1 - nx0:.1f} number width", up=False)
    dim_v(ax, nx0 - 2.2, ny0, ny1, "16.0", left=True)
    dim_h(ax, -L / 2, -L / 2 + g.RAMP, -W / 2 - 3.0, "3.0 taper", fs=8, up=False)
    ax.text(-L / 2, W / 2 + 8.4, "PLAN. Dashed line: where the tapered edge meets the flat top. The rail runs left to right.", fontsize=9, color=MID)

    # ---- section across the strip (vertical x6) ----
    ax2 = fig.add_axes([0.04, 0.29, 0.30, 0.25], facecolor=BONE)
    hw = W / 2
    prof = np.array([[-hw, 0], [-hw, g.EDGE_T], [-hw + g.RAMP, g.BASE_T], [hw - g.RAMP, g.BASE_T], [hw, g.EDGE_T], [hw, 0]])
    ax2.add_patch(MPoly(prof, closed=True, fc=YELLOW, ec=BLACK, lw=1.2))
    ax2.plot([-hw, hw], [1.0, 1.0], color=MID, lw=0.8, ls=":")
    ax2.text(0, 1.06, "top of a dot: 1.0", ha="center", fontsize=8, color=MID)
    ax2.axhline(0, color=BLACK, lw=1.2); ax2.text(hw, -0.2, "rail surface", fontsize=8, color=MID, va="top", ha="right")
    ax2.set_xlim(-hw - 4, hw + 7); ax2.set_ylim(-0.4, 1.5); ax2.axis("off")
    dim_v(ax2, hw + 2.0, 0, g.BASE_T, "0.5 flat", fs=8)
    dim_v(ax2, -hw - 0.8, 0, g.EDGE_T, "0.1 edge", fs=8, left=True)
    ax2.annotate("", xy=(-hw, -0.12), xytext=(-hw + g.RAMP, -0.12), arrowprops=dict(arrowstyle="<->", lw=0.9, color=BLACK, shrinkA=0, shrinkB=0))
    ax2.text(-hw + g.RAMP / 2, -0.16, "3.0 taper (7.6°)", fontsize=8, ha="center", va="top")
    ax2.set_title("SECTION across the strip (vertical scale ×6)", loc="left", fontsize=10, color=MID)
    ax2.set_aspect(6)

    # ---- dot profile at true scale ----
    ax5 = fig.add_axes([0.37, 0.29, 0.20, 0.25], facecolor=BONE)
    a = g.DOT_D / 2; R = g.dome_radius(0.5)
    r = np.linspace(-a, a, 80); zd = np.sqrt(R * R - r * r) - (R - 0.5)
    ax5.fill_between(r, 0, zd, color=BLACK)
    ax5.add_patch(Rectangle((-1.6, -0.5), 3.2, 0.5, fc=YELLOW, ec=BLACK, lw=1.0))
    ax5.set_aspect("equal"); ax5.set_xlim(-2.0, 2.0); ax5.set_ylim(-0.7, 1.25); ax5.axis("off")
    dim_h(ax5, -a, a, 0.72, "⌀1.5", fs=9, off=-0.62)
    dim_v(ax5, a + 0.45, 0, 0.5, "0.5", fs=9, off=-0.55)
    ax5.text(-1.9, 0.22, f"cap radius\n{R:.3f}", fontsize=8, color=MID, va="center")
    ax5.set_title("DOT PROFILE (true scale)", loc="left", fontsize=10, color=MID)

    # ---- braille cell ----
    ax3 = fig.add_axes([0.62, 0.29, 0.34, 0.25], facecolor=BONE)
    ax3.set_aspect("equal"); ax3.axis("off")
    for ci, ox in enumerate((0.0, g.CELL_PITCH)):
        for col in (0, 1):
            for row in (0, 1, 2):
                ax3.add_patch(Circle((ox + col * g.DOT_SPACING, -row * g.DOT_SPACING), g.DOT_D / 2, fc=BLACK if ci == 0 else "#bdbdb8", ec=BLACK, lw=0.6))
    dim_h(ax3, 0, g.DOT_SPACING, 1.7, "2.5", fs=9)
    dim_v(ax3, -1.5, 0, -g.DOT_SPACING, "2.5", fs=9, left=True)
    dim_h(ax3, 0, g.CELL_PITCH, -6.2, "6.2 cell pitch", fs=9, up=False)
    ax3.text(g.CELL_PITCH + 1.25, 2.3, "next cell", fontsize=8, color=MID, ha="center")
    ax3.set_xlim(-5, 12); ax3.set_ylim(-8.3, 4)
    ax3.set_title("BRAILLE CELL (dots 1–3 down the left, 4–6 down the right)", loc="left", fontsize=10, color=MID)

    # ---- table ----
    ax4 = fig.add_axes([0.04, 0.03, 0.92, 0.22], facecolor=BONE); ax4.axis("off")
    rows = [
        ("Dot", "Spherical cap, base ⌀1.5, height 0.5 (ISO 17049: 0.3–0.7; ADA signs: 0.6–0.9), cap radius %.3f" % R),
        ("Spacing", "2.5 in the cell, 6.2 cell pitch (ISO 17049: 2.2–2.8 and 5.1–6.8)"),
        ("Flat thickness", "0.5 flexible-resin base. A glow-film base would be 0.2. Adhesive layer not modelled."),
        ("Edge", "0.1 at the edge, rising to 0.5 over a 3.0 taper, corner radius 4.0"),
        ("Number", "Raised 0.5, height 16.0, edge eased in three 0.1 steps. ADA asks 0.8 raised: a round-1 test variable."),
        ("Demo text", "Arabic braille for الطابق (floor) + number sign + 2. DEMO ONLY: a braille reader must check it."),
        ("Printed", "Flat, dots up. Flexible resin or an outsourced UV print. Not for FDM (dots fail the standard)."),
    ]
    for i, (k, v) in enumerate(rows):
        yy = 0.92 - i * 0.135
        ax4.text(0.0, yy, k, fontsize=10, weight="bold", va="top"); ax4.text(0.13, yy, v, fontsize=10, va="top")
    fig.text(0.04, 0.008, "Source: dalil-hq/departments/product/sticker-concept-research.md. Generated by cad/draw_sheets.py from the same model as the STL files.", fontsize=8, color=MID)
    fig.savefig(os.path.join(OUT, "05_spec-sheet.png"), facecolor=BONE)
    plt.close(fig)


def fit_sheet():
    m, info = g.build_flat(g.DEMO_ARABIC, dot_h=0.5, numeral="2", numeral_h=16.0, relief=0.5)
    W = info["width"]
    xs = sorted({round(c[0], 3) for c in info["dot_centres"] if abs(c[1]) < 1e-6})
    xcut = xs[0]
    fig, axes = plt.subplots(1, 4, figsize=(16, 6.0), dpi=150, facecolor=BONE)
    fig.subplots_adjust(left=0.02, right=0.98, top=0.80, bottom=0.08, wspace=0.05)
    fig.text(0.02, 0.94, "Strip A wrapped on round rails: end view through a braille dot", ha="left", fontsize=18, weight="bold")
    fig.text(0.02, 0.88, "Solid yellow: the flexible strip follows the rail. Dashed: a stiff strip that stays flat touches only at the top and stands off at its edges.", fontsize=11, color=MID)
    for ax, D in zip(axes, (30.0, 32.0, 40.0, 50.0)):
        R = D / 2
        t = g.bend_onto_rail(m, D)
        sec = t.section(plane_origin=[xcut, 0, 0], plane_normal=[1, 0, 0])
        ax.set_facecolor(BONE); ax.set_aspect("equal")
        th = np.linspace(math.radians(30), math.radians(150), 300)
        yy, zz = R * np.cos(th), R * np.sin(th) - R
        ax.fill_between(yy, zz, -12, color="#d9d7d0")
        ax.plot(yy, zz, color=BLACK, lw=1.6)
        for path in sec.discrete:
            ax.add_patch(MPoly(path[:, 1:3], closed=True, fc=YELLOW, ec=BLACK, lw=0.7))
        half = W / 2
        sag = R - math.sqrt(R * R - half * half)
        ax.plot([-half, half], [0.0, 0.0], color=BLACK, lw=1.1, ls="--")
        ax.annotate("", xy=(half, -sag), xytext=(half, 0.0), arrowprops=dict(arrowstyle="<->", lw=0.9, shrinkA=0, shrinkB=0))
        ax.text(half + 0.5, -sag / 2, f"{sag:.1f}", fontsize=10, va="center")
        ang = math.degrees(W / R)
        ax.text(0, 7.3, f"Ø{D:.0f} mm rail", ha="center", fontsize=13, weight="bold")
        ax.text(0, 5.2, f"strip wraps {ang:.0f}°\nflat-strip edge gap {sag:.1f} mm", ha="center", fontsize=10, va="center")
        ax.set_xlim(-16, 16); ax.set_ylim(-10, 9); ax.axis("off")
    fig.text(0.02, 0.02, "Flat width 23.0 mm. Strip 0.5 mm thick, 1.0 mm at the top of a dot. Source: cad/dalil-sticker-A-braille-number_flat.stl bent by generate_sticker.py. Equal horizontal and vertical scale.", fontsize=8, color=MID)
    fig.savefig(os.path.join(OUT, "06_fit-on-rails.png"), facecolor=BONE)
    plt.close(fig)


def scale_sheet():
    """How strip length follows message length, and what changes when the system moves from rails to walls."""
    pitch, dotw = g.CELL_PITCH, g.DOT_SPACING + g.DOT_D
    plate = lambda n: (n - 1) * pitch + dotw + 2 * (g.RAMP + g.MARGIN)
    ex = [("2", 2), ("exit", 4), ("room 15", 8), ("prayer room", 11), ("rooms 201 to 215", 18)]
    fig = plt.figure(figsize=(16, 8.6), dpi=150, facecolor=BONE)
    fig.text(0.04, 0.945, "Scale: the strip grows with the message", fontsize=20, weight="bold")
    fig.text(0.04, 0.91, "Same dots, same spacing, same 0.5 mm base. Only the length changes. Lengths are calculated from the model.", fontsize=11, color=MID)
    ax = fig.add_axes([0.07, 0.14, 0.50, 0.70], facecolor=BONE)
    n = np.arange(1, 43)
    ax.plot(n, [plate(k) for k in n], color=BLACK, lw=2)
    ax.axvspan(40, 42, color="#e0ded6")
    ax.axvline(40, color=MID, lw=1, ls="--")
    ax.text(40.2, 20, "ISO 17049: at most\n40 cells in a line", fontsize=9, color=MID, va="bottom")
    for name, k in ex:
        ax.plot([k], [plate(k)], "o", color=YELLOW, mec=BLACK, ms=9)
        ax.annotate(f"'{name}'\n{k} cells, {plate(k):.0f} mm", (k, plate(k)), xytext=(k + 1.0, plate(k) - 34), fontsize=9)
    ax.set_xlabel("Braille cells in one line", fontsize=11); ax.set_ylabel("Strip length, mm (braille line plus tapered ends)", fontsize=11)
    ax.set_xlim(0, 42); ax.set_ylim(0, 290); ax.grid(color="#d9d7d0", lw=0.6)
    for sp in ("top", "right"): ax.spines[sp].set_visible(False)
    txt = [
        ("Length", "About 6.2 mm per braille cell, plus about 8 mm for the tapered ends. A full 40-cell line is about %.0f mm." % plate(40)),
        ("Longer messages", "Add a second line. ISO 17049 line pitch is 10–15 mm, so two lines need about 16.5 mm of width, three about 26.5 mm."),
        ("On a rail", "One line only, along the rail. 14 mm wide for braille alone, 23 mm with a 16 mm number."),
        ("On a wall", "Raised 16 mm letters on top, braille below with 9.5 mm clear. 42 mm tall for one line of each. The width follows the longer line."),
        ("Where on the wall", "US rule used as a guide: tactile characters 1220–1525 mm above the floor, at the latch side of the door. UAE rule [VERIFY]."),
        ("Making them", "Any message, no tooling: the generator and a print-on-demand route (memo section 7). Moulds only make sense for fixed messages in volume."),
    ]
    y = 0.84
    for k, v in txt:
        fig.text(0.62, y, k, fontsize=11, weight="bold", va="top")
        fig.text(0.62, y - 0.03, "\n".join(__import__("textwrap").wrap(v, 62)), fontsize=10, va="top", color=BLACK)
        y -= 0.135
    fig.text(0.04, 0.02, "Source: cad/generate_sticker.py and cad/generate_wall_plates.py. The 40-cell limit is from the public sample of ISO 17049:2013. Wall rules: US ADA 703.3.2 and 703.4, used as a layout guide only.", fontsize=8, color=MID)
    fig.savefig(os.path.join(OUT, "13_scale-and-message-length.png"), facecolor=BONE)
    plt.close(fig)


if __name__ == "__main__":
    spec_sheet()
    fit_sheet()
    scale_sheet()
    print("sheets written to", OUT)
