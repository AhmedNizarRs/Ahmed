#!/usr/bin/env python3
"""Draw a plan from a spec with the headless AutoCAD MCP server, without needing the MCP loaded in the chat.

  uv run --with "fastmcp>=3.4.5,<4" --with "autocad-mcp-pro[pdf]==1.8.0" python plan_cli.py spec.json OUTDIR

Writes OUTDIR/plan.dxf, plan.pdf, plan.png (if pdftoppm exists) and rooms.json (measured rooms).
The spec is the `spec` argument of the `arch_plan_from_spec` tool (units: mm).
"""
import asyncio, json, os, shutil, subprocess, sys
from fastmcp import Client
from fastmcp.client.transports import StdioTransport


def server_transport():
    exe = shutil.which("autocad-mcp")
    cmd, args = (exe, []) if exe else ("uvx", ["--from", "autocad-mcp-pro[pdf]==1.8.0", "autocad-mcp"])
    return StdioTransport(command=cmd, args=args, env={**os.environ, "AUTOCAD_MCP_BACKEND": "ezdxf"})


async def main(spec_path, outdir):
    spec = json.load(open(spec_path))
    os.makedirs(outdir, exist_ok=True)
    out = os.path.abspath(outdir)
    async with Client(server_transport()) as c:
        async def call(name, args):
            r = await c.call_tool("call_tool", {"name": name, "arguments": args}, raise_on_error=False)
            if r.is_error:
                sys.exit(f"{name} failed: {r.content[0].text if r.content else r}")
            return json.loads(r.content[0].text)

        await call("drawing_new", {})
        drawn = await call("arch_plan_from_spec", {"spec": spec})
        rooms = await call("arch_rooms_detect", {})
        await call("drawing_export_dxf", {"path": f"{out}/plan.dxf"})
        await call("drawing_export_pdf", {"path": f"{out}/plan.pdf"})
    json.dump(rooms, open(f"{out}/rooms.json", "w"), indent=1)
    json.dump({k: drawn.get(k) for k in ("walls", "openings", "stairs")}, open(f"{out}/drawn.json", "w"), indent=1)
    if shutil.which("pdftoppm"):
        subprocess.run(["pdftoppm", "-png", "-r", "110", "-f", "1", "-l", "1", f"{out}/plan.pdf", f"{out}/plan"], check=False)
    for r in rooms.get("rooms", []):
        lab = (r.get("label") or {})
        print(f"{lab.get('number','?'):>3} {lab.get('name','(unlabelled)'):<14} {r['area_m2']:>8.2f} m2  confidence {r['confidence']}")
    print("wrote", out)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    asyncio.run(main(sys.argv[1], sys.argv[2]))
