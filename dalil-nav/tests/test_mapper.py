"""Headless regression test for DALIL Mapper.

Setup:  pip install playwright && playwright install chromium
Run:    python tests/test_mapper.py      (from the repo root)
"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAPPER = (ROOT / "mapper" / "index.html").as_uri()
REAL_DXF = str(ROOT / "data" / "hospital-bldg1000-floor1.dxf")
OFFICE_DXF = str(ROOT / "data" / "test-office-mm.dxf")
fails = []

def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1500, "height": 900})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(MAPPER)

        # 1. Sample hospital
        await pg.click("#btnSample"); await pg.wait_for_timeout(500)
        r = await pg.evaluate("""()=>{const S=DALIL.S,P=id=>S.points.find(p=>p.id===id);
            const w=DALIL.routeBetween('walk',P('P001'),P('P010')), c=DALIL.routeBetween('chair',P('P001'),P('P010')),
                  e=DALIL.routeBetween('walk',P('P009'),P('P014'));
            return {w:w.err||w.distance, c:c.err||null, nodeStep:(e.steps||[]).some(s=>s.node==='P013'), grid:document.getElementById('gridStatus').innerText};}""")
        check("All 14 points connected" in r["grid"], "sample: all points connected")
        check(isinstance(r["w"], (int, float)) and 25 < r["w"] < 45, f"sample: walking route to Clinic 2 ({r['w']})")
        check(r["c"] is not None and "wheelchair" in r["c"].lower(), "sample: wheelchair blocked by 70 cm door")
        check(r["nodeStep"], "sample: passing DALIL node announced")

        # 2. Real hospital DXF (feet, numbered layers, lone threshold lines)
        await pg.set_input_files("#fDxf", REAL_DXF); await pg.wait_for_timeout(2500)
        st = await pg.inner_text("#planStatus")
        check("guessed ft" in st, "real: units guessed as feet")
        roles = await pg.evaluate("Object.fromEntries(Object.entries(DALIL.S.layers).map(([k,v])=>[k,v.role]))")
        check(all(roles.get(k) == "wall" for k in ["1", "2", "27", "28"]) and roles.get("26") == "door", f"real: geometry layer roles {roles}")
        r = await pg.evaluate("""()=>{const S=DALIL.S,f=S.f,off=S.off,tr=(x,y)=>[x*f-off[0],y*f-off[1]];
            const mk=(id,x,y,n)=>{const [a,b]=tr(x,y);return {id,x:a,y:b,nameEn:n,nameAr:'',cat:'room',node:true,face:90};};
            S.points=[mk('A',-205,140,'Entrance'),mk('B',-400,152,'West'),mk('C',-20,150,'East'),mk('D',-200,250,'North')];
            DALIL.ensureGrids(); const o={};
            for (const [x,y] of [['A','B'],['A','C'],['B','C'],['A','D']]){ const R=DALIL.routeBetween('walk',S.points.find(p=>p.id===x),S.points.find(p=>p.id===y)); o[x+y]=R.err||R.distance; }
            return o;}""")
        for k, v in r.items():
            check(isinstance(v, (int, float)), f"real: route {k} = {v}")

        # 3. mm office DXF with nested/mirrored blocks
        await pg.set_input_files("#fDxf", OFFICE_DXF); await pg.wait_for_timeout(800)
        st = await pg.inner_text("#planStatus")
        check("mm (from file)" in st, "office: INSUNITS mm read")

        # 4. Auto-places on a real university drawing (Cal Poly Kennedy Library, Level 1; inches, survey coordinates)
        lib = ROOT / "data" / "test-calpoly-library" / "building035-0_floor1.dxf"
        if lib.exists():
            await pg.set_input_files("#fDxf", str(lib)); await pg.wait_for_timeout(2500)
            r = await pg.evaluate("""()=>{ document.getElementById('btnStraighten').click(); const res=DALIL.autoPlaces();
                return {res, rot:DALIL.S.rot, grid:document.getElementById('gridStatus').innerText}; }""")
            by = r["res"]["by"]
            check(abs(r["rot"] + 11.3) < 0.3, f"library: straightened by {r['rot']}°")
            check(by.get("room", 0) >= 50 and by.get("lift") == 2 and by.get("stairs") == 5 and by.get("cafe") == 1, f"library: auto-places {by}")
            check(by.get("toilet", 0) + by.get("toilet_acc", 0) >= 4, "library: restrooms from drawing symbols")
            check("All 70 points connected" in r["grid"], f"library: all auto places reachable ({r['grid'][-60:]})")

        check(not errs, f"no page errors {errs}")
        await b.close()

asyncio.run(main())
print("\nALL PASSED" if not fails else f"\n{len(fails)} FAILED"); sys.exit(1 if fails else 0)
