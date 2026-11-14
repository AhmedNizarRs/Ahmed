/* Small geometry helpers for the campus map. No dependencies.
   Works in the browser (window.CampusGeo) and in Node (require) so it can be tested. */
(function (root) {
  'use strict';

  var M_PER_DEG_LAT = 110574; // metres per degree of latitude near 25 degrees north
  var M_PER_DEG_LNG = 111320; // metres per degree of longitude at the equator

  // A local flat frame in metres around an anchor: x = east, y = north.
  // At campus size (about 2 km) the error against true distance is well under 1%.
  function makeFrame(lat0, lng0) {
    var k = Math.cos((lat0 * Math.PI) / 180);
    return {
      toLocal: function (lat, lng) {
        return { x: (lng - lng0) * M_PER_DEG_LNG * k, y: (lat - lat0) * M_PER_DEG_LAT };
      },
      toLatLng: function (x, y) {
        return { lat: lat0 + y / M_PER_DEG_LAT, lng: lng0 + x / (M_PER_DEG_LNG * k) };
      },
    };
  }

  function signedArea(pts) {
    var a = 0;
    for (var i = 0, n = pts.length; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  }

  function centroid(pts) {
    var x = 0, y = 0;
    for (var i = 0; i < pts.length; i++) { x += pts[i].x; y += pts[i].y; }
    return { x: x / pts.length, y: y / pts.length };
  }

  // Ray casting. poly is an array of {x, y}.
  function pointInPolygon(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function pathLength(pts) {
    var d = 0;
    for (var i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return d;
  }

  // The point d metres along a polyline, clamped to its ends.
  function pointAt(pts, d) {
    if (pts.length === 0) return null;
    if (pts.length === 1 || d <= 0) return { x: pts[0].x, y: pts[0].y };
    var left = d;
    for (var i = 1; i < pts.length; i++) {
      var seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (left <= seg && seg > 0) {
        var t = left / seg;
        return {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
        };
      }
      left -= seg;
    }
    var last = pts[pts.length - 1];
    return { x: last.x, y: last.y };
  }

  // Building height in metres from OpenStreetMap tags. Returns {m, estimated}.
  function buildingHeight(tags) {
    tags = tags || {};
    var h = parseFloat(String(tags.height || '').replace(',', '.'));
    if (isFinite(h) && h > 0) return { m: Math.min(h, 200), estimated: false };
    var lv = parseFloat(tags['building:levels']);
    if (isFinite(lv) && lv > 0) return { m: Math.min(lv * 3.5, 200), estimated: true };
    return { m: 9, estimated: true }; // unknown: shown as a low generic block
  }

  var api = {
    makeFrame: makeFrame,
    signedArea: signedArea,
    centroid: centroid,
    pointInPolygon: pointInPolygon,
    pathLength: pathLength,
    pointAt: pointAt,
    buildingHeight: buildingHeight,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CampusGeo = api;
})(typeof window !== 'undefined' ? window : globalThis);
