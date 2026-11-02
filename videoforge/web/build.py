"""Assemble web/index.html from app.html with the sample frames inlined.

    python web/build.py

Publish index.html together with models/*.json (served next to it).
"""
import base64
from pathlib import Path

HERE = Path(__file__).resolve().parent


def data_uri(path: Path) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode()


html = (HERE / "app.html").read_text()
html = html.replace("%%SAMPLE_BEFORE%%", data_uri(HERE / "sample" / "before.jpg"))
html = html.replace("%%SAMPLE_AFTER%%", data_uri(HERE / "sample" / "after.jpg"))
(HERE / "index.html").write_text(html)
print(f"index.html: {len(html) / 1e3:.0f} kB")
