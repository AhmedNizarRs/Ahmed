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


# A synthetic LiDAR scan (Y up, metres): 20 x 12 m floor, corridor with two rooms and a hall, doorways with a wall
# above the door head (2.1 m), a 0.75 m table that must not become a wall, floor slab and ceiling.
def synthetic_scan():
    boxes = []
    def box(x0, x1, y0, y1, z0, z1): boxes.append((x0, x1, y0, y1, z0, z1))
    T, Hh, DH = 0.2, 3.0, 2.1
    def wall_x(z, x0, x1, doors=()):          # a wall along x at depth z, with door gaps [(a, b)]
        cuts = [x0] + [v for d in doors for v in d] + [x1]
        for i in range(0, len(cuts), 2): box(cuts[i], cuts[i + 1], 0, Hh, z - T / 2, z + T / 2)
        for a, b in doors: box(a, b, DH, Hh, z - T / 2, z + T / 2)
    def wall_z(x, z0, z1, doors=()):
        cuts = [z0] + [v for d in doors for v in d] + [z1]
        for i in range(0, len(cuts), 2): box(x - T / 2, x + T / 2, 0, Hh, cuts[i], cuts[i + 1])
        for a, b in doors: box(x - T / 2, x + T / 2, DH, Hh, a, b)
    wall_x(0, 0, 20); wall_x(12, 0, 20)
    wall_z(0, 0, 12, doors=[(5.4, 6.6)]); wall_z(20, 0, 12)              # the entrance at the west end of the corridor
    wall_x(5, 0, 20, doors=[(9, 10)]); wall_x(7, 0, 20, doors=[(4, 5), (14, 15)])
    wall_z(10, 7, 12)
    box(2, 3.5, 0, 0.75, 9, 10)                                            # a table
    box(-0.5, 20.5, -0.1, 0, -0.5, 12.5); box(-0.5, 20.5, 3.0, 3.1, -0.5, 12.5)   # floor and ceiling
    return boxes

def scan_obj(boxes):
    out, n = [], 0
    for (x0, x1, y0, y1, z0, z1) in boxes:
        for x in (x0, x1):
            for y in (y0, y1):
                for z in (z0, z1): out.append(f"v {x} {y} {z}")
        q = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        for a, b, c, d in q: out.append(f"f {n+a+1} {n+b+1} {n+c+1}"); out.append(f"f {n+a+1} {n+c+1} {n+d+1}")
        n += 8
    return "\n".join(out)

def scan_ply(boxes, step=0.05):
    import random
    rnd = random.Random(1); pts = []
    for (x0, x1, y0, y1, z0, z1) in boxes:
        if y1 - y0 < 0.2: continue                                       # skip slabs (the floor gets points below)
        for fx in (x0, x1):
            z = z0
            while z <= z1:
                y = y0
                while y <= y1: pts.append((fx, y, z)); y += step
                z += step
        for fz in (z0, z1):
            x = x0
            while x <= x1:
                y = y0
                while y <= y1: pts.append((x, y, fz)); y += step
                x += step
    x = -0.4
    while x < 20.4:
        z = -0.4
        while z < 12.4: pts.append((x, 0.0, z)); z += 0.25
        x += 0.25
    pts = [(a + rnd.uniform(-0.01, 0.01), b, c + rnd.uniform(-0.01, 0.01)) for a, b, c in pts]
    head = f"ply\nformat ascii 1.0\nelement vertex {len(pts)}\nproperty float x\nproperty float y\nproperty float z\nend_header\n"
    return head + "\n".join(f"{a:.3f} {b:.3f} {c:.3f}" for a, b, c in pts)

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

        # 6. No floor plan: a LiDAR scan (OBJ mesh, then a PLY point cloud) becomes walls, doors stay open, furniture drops out
        for kind, text in (("obj", scan_obj(synthetic_scan())), ("ply", scan_ply(synthetic_scan()))):
            r = await pg.evaluate("""([t, kind])=>{ loadScan(new TextEncoder().encode(t).buffer, 'synthetic.'+kind);
                const segs=S.rawPolys.filter(p=>p.layer==='SCAN-WALLS'), onTable=segs.filter(p=>p.pts.every(([x,y])=>x>2.1&&x<3.4&&y<-9.1&&y>-9.9)).length;
                S.points=[]; S.nextId=1;
                let mx=Infinity, my=Infinity; for (const p of segs) for (const [x,y] of p.pts){ mx=Math.min(mx,x); my=Math.min(my,y); }   // the Mapper puts the plan's corner at 0,0
                const at=(x,y,o)=>addPoint(x-mx, y-my, o);
                at(0.7,-6,{nameEn:'Entrance', cat:'entrance', node:true}); at(6,-9.5,{nameEn:'Room A', cat:'room'});
                at(17,-9.5,{nameEn:'Room B', cat:'room'}); at(12,-2.5,{nameEn:'Hall', cat:'room'});
                ensureGrids();
                return {n:segs.length, onTable, status:document.getElementById('planStatus').innerText, grid:document.getElementById('gridStatus').innerText, role:S.layers['SCAN-WALLS']?.role}; }""", [text, kind])
            check(r["n"] > 20 and r["role"] == "wall", f"scan {kind}: walls cut from the scan ({r['n']} lines, role {r['role']})")
            check("Y up" in r["status"] and "1.3 and 1.7 m" in r["status"], f"scan {kind}: up axis and cut heights reported")
            check(r["onTable"] == 0, f"scan {kind}: the 0.75 m table is not a wall")
            check("All 4 points connected" in r["grid"], f"scan {kind}: rooms reachable through the doorways ({r['grid'][-70:]})")

        # 5. World position from two control points: plan +x 100 m due east -> plan up = north, scale 1
        g = await pg.evaluate("""()=>DALIL.geoFromTwo({x:0,y:0},{lat:25.3,lng:55.4},{x:100,y:0},{lat:25.3,lng:55.4+100/(111412.84*Math.cos(25.3*Math.PI/180))})""")
        check(abs(g["bearing"]) < 0.01 and abs(g["scale"] - 1) < 1e-4 and abs(g["origin"][1] - 25.3) < 1e-7, f"geo: two control points {g}")

        check(not errs, f"no page errors {errs}")
        await b.close()

asyncio.run(main())
print("\nALL PASSED" if not fails else f"\n{len(fails)} FAILED"); sys.exit(1 if fails else 0)
