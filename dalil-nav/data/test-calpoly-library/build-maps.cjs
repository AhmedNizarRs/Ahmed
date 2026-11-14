// Test project: Robert E. Kennedy Library (Cal Poly), Levels 1 and 2.
// Public drawings, used for INTERNAL TESTING ONLY. Not a DALIL client or pilot.
//
// Drives the DALIL Mapper (mapper/index.html) headless, exactly like a person would:
// load the DXF, straighten it, add the places, build the walkable map, export.
// Run from dalil-nav/:   node data/test-calpoly-library/build-maps.cjs
//
// Point positions (metres, in the drawing's own frame before straightening) come from:
//   - CAD labels and icons in the DXF (room numbers, lifts E1xx/E2xx, stairs S1xx/S2xx, toilet icons), or
//   - the official 2025 Level 1/2 directory maps, fitted onto the CAD with the lifts and stairs
//     (marked "map" below; about ±2 m).
// Arabic names are drafts: they need a native-speaker check.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '../..');
const BUILDING = 'Kennedy Library · Cal Poly (test)';

const FLOORS = [
  {
    dxf: 'building035-0_floor1.dxf', floor: 'Level 1',
    rotate: 'auto', // drawing is in rotated survey coordinates
    points: [
      // name EN, name AR, category, x, y, { node, face, link }      source
      ['Main Entrance (South)', 'المدخل الرئيسي (الجنوبي)', 'entrance', 68.1, 14.0, { node: true, face: 90 }], // map
      ['Gallery', 'المعرض', 'room', 68.3, 24.3],                                    // map
      ["Julian's Café", 'مقهى جوليان', 'cafe', 75.1, 68.7],                          // CAD "CAFE"
      ['Library Services (110)', 'خدمات المكتبة (110)', 'reception', 23.3, 35.5],    // map
      ['IT Service Desk (111)', 'مكتب خدمات تقنية المعلومات (111)', 'reception', 21.3, 47.1], // map
      ['Print & Copy (112)', 'الطباعة والنسخ (112)', 'room', 20.5, 51.8],            // map
      ['Digital Scholarship Studio (115)', 'استوديو البحث الرقمي (115)', 'room', 48.6, 49.9], // map
      ['Ombuds Office (105F)', 'مكتب أمين المظالم (105F)', 'room', 27.2, 14.0],        // CAD 105F
      ['Seminar Room 103', 'قاعة الندوات 103', 'room', 56.4, 20.8],                  // CAD 103
      ['Seminar Room 104', 'قاعة الندوات 104', 'room', 46.2, 18.8],                  // CAD 104
      ['Student Study 100G', 'منطقة الدراسة 100G', 'room', 54.9, 49.5],              // CAD 100G
      ['Student Study 100F', 'منطقة الدراسة 100F', 'room', 35.9, 21.0],              // CAD 100F
      ['Student Study 100E', 'منطقة الدراسة 100E', 'room', 39.2, 9.2],               // CAD 100E
      ['Student Study 101L', 'منطقة الدراسة 101L', 'room', 82.5, 58.5],              // CAD 101L
      ["Women's Restroom (West)", 'دورة مياه النساء (الغربية)', 'toilet', 19.6, 27.9], // CAD icon
      ["Men's Restroom (West)", 'دورة مياه الرجال (الغربية)', 'toilet', 23.8, 30.1],   // CAD icon
      ['All-Gender Restroom (East 1)', 'دورة مياه لكل الأشخاص (الشرقية 1)', 'toilet_acc', 76.4, 52.9], // CAD icon
      ['All-Gender Restroom (East 2)', 'دورة مياه لكل الأشخاص (الشرقية 2)', 'toilet_acc', 80.8, 49.9], // CAD icon
      ['Lactation Room', 'غرفة الرضاعة', 'baby', 83.5, 49.7],                        // CAD icon
      ['West Lifts', 'المصاعد الغربية', 'lift', 26.5, 30.3, { node: true, face: 0, link: 'LIFT-W' }], // CAD E101/E102
      ['East Lift', 'المصعد الشرقي', 'lift', 78.5, 28.6, { node: true, face: 180, link: 'LIFT-E' }], // CAD E103
      ['Central Stairs (Gallery)', 'الدرج المركزي (المعرض)', 'stairs', 61.8, 30.9, { link: 'STAIR-C' }], // CAD S101
      ['West Stairs', 'الدرج الغربي', 'stairs', 15.6, 28.8, { link: 'STAIR-W' }],     // CAD S102
      ['North-West Stairs', 'الدرج الشمالي الغربي', 'stairs', 26.6, 62.7, { link: 'STAIR-NW' }], // CAD S103
      ['North-East Stairs', 'الدرج الشمالي الشرقي', 'stairs', 67.4, 70.6, { link: 'STAIR-NE' }], // CAD S104
      ['South-East Stairs', 'الدرج الجنوبي الشرقي', 'stairs', 76.8, 13.6, { link: 'STAIR-SE' }], // CAD S105
    ],
  },
  {
    dxf: 'building035-0_floor2.dxf', floor: 'Level 2',
    rotate: 0,
    points: [
      ['West Lifts', 'المصاعد الغربية', 'lift', 16.3, 24.4, { node: true, face: 0, link: 'LIFT-W' }], // CAD E201/E202, moved 2 m out into the lift lobby
      ['East Lift', 'المصعد الشرقي', 'lift', 64.9, 12.4, { node: true, face: 180, link: 'LIFT-E' }],   // CAD E203
      ['Central Stairs', 'الدرج المركزي', 'stairs', 47.7, 17.5, { link: 'STAIR-C' }],   // CAD S201
      ['West Stairs', 'الدرج الغربي', 'stairs', 2.8, 23.5, { link: 'STAIR-W' }],        // CAD S202
      ['North-West Stairs', 'الدرج الشمالي الغربي', 'stairs', 19.6, 56.6, { link: 'STAIR-NW' }], // CAD S203
      ['North-East Stairs', 'الدرج الشمالي الشرقي', 'stairs', 59.5, 56.4, { link: 'STAIR-NE' }], // CAD S204
      ['South-East Stairs', 'الدرج الجنوبي الشرقي', 'stairs', 59.9, -1.6, { link: 'STAIR-SE' }], // CAD S205
      ["Men's Restroom", 'دورة مياه الرجال', 'toilet', 5.2, 27.1],                     // CAD icon
      ["Women's Restroom", 'دورة مياه النساء', 'toilet', 9.3, 24.7],                   // CAD icon
      ['All-Gender Restroom 1', 'دورة مياه لكل الأشخاص 1', 'toilet_acc', 66.9, 32.2],  // CAD 223
      ['All-Gender Restroom 2', 'دورة مياه لكل الأشخاص 2', 'toilet_acc', 67.2, 35.5],  // CAD 222
      ['Classroom 216A', 'الفصل 216A', 'room', 7.4, 31.1],
      ['Classroom 216B', 'الفصل 216B', 'room', 6.7, 40.2],
      ['Classroom 217C', 'الفصل 217C', 'room', 5.5, 58.1],
      ['Classroom 217D', 'الفصل 217D', 'room', 12.0, 58.0],
      ['Tutoring & Learning Center (209)', 'مركز التعلّم والدروس الخصوصية (209)', 'room', 8.3, 11.3],
      ['Library Administration (204)', 'إدارة المكتبة (204)', 'reception', 26.9, 5.9],
      ['Student Study 216', 'منطقة الدراسة 216', 'room', 41.7, 39.0],
      ['Study Room 216K', 'غرفة الدراسة 216K', 'room', 34.2, 48.0],
      ['Study Room 216L', 'غرفة الدراسة 216L', 'room', 34.2, 54.2],
      ['Study Room 216M', 'غرفة الدراسة 216M', 'room', 39.2, 48.0],
      ['Study Room 216N', 'غرفة الدراسة 216N', 'room', 39.2, 54.2],
      ['Study Room 216P', 'غرفة الدراسة 216P', 'room', 47.5, 48.0],
      ['Study Room 216Q', 'غرفة الدراسة 216Q', 'room', 47.5, 54.1],
      ['Study Room 216R', 'غرفة الدراسة 216R', 'room', 52.3, 48.0],
      ['Study Room 216S', 'غرفة الدراسة 216S', 'room', 52.3, 54.2],
      ['Study Room 220A', 'غرفة الدراسة 220A', 'room', 65.4, 22.6],
      ['Study Room 220B', 'غرفة الدراسة 220B', 'room', 68.7, 22.6],
      ['Study Room 220C', 'غرفة الدراسة 220C', 'room', 68.7, 25.9],
      ['Study Room 220D', 'غرفة الدراسة 220D', 'room', 65.4, 25.9],
      ['Study Room 224', 'غرفة الدراسة 224', 'room', 71.1, 32.6],
      ['Student Study 200H', 'منطقة الدراسة 200H', 'room', 73.0, 9.4],
    ],
  },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'mapper/index.html'));
  // Capture the Mapper's downloads instead of saving through the browser.
  await page.evaluate(() => { window.__out = {}; window.download = async (name, text) => { window.__out[name] = text; }; });

  for (const F of FLOORS) {
    const text = fs.readFileSync(path.join(DIR, F.dxf), 'utf8');
    const res = await page.evaluate(async ({ text, F, BUILDING }) => {
      const $ = id => document.getElementById(id);
      window.__out = {};
      loadDXFText(text, F.dxf);
      $('selUnits').value = 'in'; applyUnits(false);
      $('inBuilding').value = BUILDING; $('inFloor').value = F.floor;
      for (const [nameEn, nameAr, cat, x, y, o = {}] of F.points) addPoint(x, y, { nameEn, nameAr, cat, ...o });
      let rot = 0;
      if (F.rotate === 'auto') { rot = straightenAngle(); setRotation(rot); }
      ensureGrids();
      const grid = $('gridStatus').innerText;
      await exportMap(); saveProject(); exportCsv();
      return { rot, grid, exp: $('expStatus').innerText, out: window.__out };
    }, { text, F, BUILDING });
    console.log(`\n${F.floor}: rotated ${res.rot}°\n  ${res.grid}\n  ${res.exp}`);
    for (const [name, body] of Object.entries(res.out)) { fs.writeFileSync(path.join(DIR, name), body); console.log('  wrote', name, (body.length / 1024).toFixed(0) + ' KB'); }
    await page.screenshot({ path: path.join(DIR, `preview_${F.floor.toLowerCase().replace(/\s+/g, '-')}.png`) });
  }
  if (errors.length) { console.error('Page errors:', errors); process.exitCode = 1; }
  await browser.close();
})();
