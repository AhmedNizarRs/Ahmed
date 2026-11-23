#!/usr/bin/env python3
"""Score a blind-test output folder: re-run the checker on every layout and look
for each deliverable SKILL.md requires in every answer.

Usage: python3 evals/score_blind.py <out_dir>

Prints one row per scenario. Judging the design against the expectations in
scenarios.md is still done by reading the answers; this script covers the
mechanical part.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHECKER = HERE.parent / "scripts" / "check_layout.py"

DELIVERABLES = {
    "brief": r"design brief|\bbrief\b",
    "zones": r"zone plan|\bzones?\b",
    "layout": r"layout json|\.json",
    "plan": r"floor plan|ascii|FLOOR LEVEL",
    "bom": r"bill of materials|\bBOM\b",
    "safety": r"safety",
    "reveal": r"reveal",
    "rejected": r"reject|alternative|why not",
}


def questions_asked(text):
    """Count numbered or bulleted question lines in the first questions block."""
    m = re.search(r"(?is)(questions?[^\n]*\n)(.*?)(\n#|\n\*\*[A-Z]|\Z)", text)
    block = m.group(2) if m else ""
    return sum(1 for line in block.splitlines() if line.strip().endswith("?"))


def check(path):
    r = subprocess.run([sys.executable, str(CHECKER), str(path)], capture_output=True, text=True)
    last = (r.stdout.strip().splitlines() or ["(no output)"])[-1]
    return last


def main():
    out = Path(sys.argv[1])
    rows = []
    for md in sorted(out.glob("*.md")):
        nn = md.stem
        text = md.read_text()
        missing = [k for k, pat in DELIVERABLES.items() if not re.search(pat, text, re.I)]
        layouts = sorted(out.glob(f"{nn}*.json"))
        results = [f"{p.name}: {check(p)}" for p in layouts]
        rows.append((nn, questions_asked(text), missing, results))
    for nn, q, missing, results in rows:
        print(f"## {nn}  questions={q}  missing={','.join(missing) or '-'}")
        for r in results or ["(no layout)"]:
            print("   ", r)


if __name__ == "__main__":
    main()
