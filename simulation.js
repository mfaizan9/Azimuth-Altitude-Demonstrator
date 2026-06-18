/* ===========================================================================
   Azimuth/Altitude Demonstrator  -  HTML5 port of altAzDemo005 (Flash AS1)
   ---------------------------------------------------------------------------
   Behaviour is ported faithfully from the decompiled ActionScript:
     - CelestialSphere.as + "2..11 CS *.as"  -> the projection / drawing engine
     - Alt Az Demo.as                         -> the controller (this file's App)
     - AzAlt Draggable Star.as                -> star drag logic
     - Slider Logic Class v6 / toFixed.as     -> number formatting
   The maths (rotation matrices, great/small-circle front/back splitting,
   screen<->horizon conversion, drag + snapping) is kept identical to the
   source so positions, arcs and drag behaviour match the original exactly.

   Rendering uses an HTML5 <canvas> for the code-drawn geometry (sphere shading,
   horizon plane, circles, arcs, pole stubs, markers) and reused exported
   bitmaps for the star and stick figure. All text labels are real HTML
   (positioned over the canvas) so they zoom and are reachable by assistive tech.
   =========================================================================== */

(() => {
  'use strict';

  // --- angle constants used verbatim by the AS source ----------------------
  const D2R = 0.017453292519943295;   // degrees -> radians
  const R2D = 57.29577951308232;      // radians -> degrees
  const TWO_PI = 6.283185307179586;
  const HALF_PI = 1.5707963267948966;
  const PI = 3.141592653589793;

  // Original Flash colours (decimal RGB) from the AS source.
  const AZ_COLOR  = 5654005;    // azColor  (blue-grey)
  const ALT_COLOR = 10893123;   // altColor (red)

  function intToCss(n) {
    return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6);
  }

  // mod() helper matching CelestialSphere.mod / CSCircles.mod
  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  // toFixed polyfill copied from toFixed.as so on-screen numbers round and
  // format exactly like the original (round-half-up, fixed decimal places).
  function toFixedAS(x, f) {
    f = Math.trunc(f);
    if (f < 0 || f > 20 || isNaN(x) || !isFinite(x)) return '...';
    let s = '';
    if (x < 0) { s = '-'; x = -x; }
    let out = '';
    if (x < 1e21) {
      const n = Math.round(x * Math.pow(10, f));
      out = (n === 0) ? '0' : n.toString();
      if (f > 0) {
        let k = out.length;
        if (k <= f) {
          let z = '';
          for (let i = 0; i < f + 1 - k; i++) z += '0';
          out = z + out;
          k = f + 1;
        }
        out = out.substr(0, k - f) + '.' + out.substr(k - f);
      }
    } else {
      out = x.toString();
    }
    return s + out;
  }

  /* =========================================================================
     CelestialSphere  -  the projection engine (ported from CelestialSphere.as
     and "2 CS Getter Setter", "3 CS Geometry", "5 CS Horizon Plane").
     Only the parts exercised by this demo are kept; declination trails and
     shaded bands are unused here (the original lists are empty for this sim).
     ========================================================================= */
  class CelestialSphere {
    constructor() {
      this.c = {};               // matrix scratchpad (matches AS "_c")
      this.aVer = -1;
      this.bVer = -1;
      this.maxPhi = 90;
      this.minPhi = -90;
      this.c.r = 150;            // overwritten by setSize(320) -> 160
      this.c.r2 = this.c.r * this.c.r;
      this.showUnder = true;
      this.theta = 0;            // radians (viewer azimuth rotation)
      this.phi = 0.5235987755982988; // radians (viewer altitude / tilt)
      this.lat = 0;
      this.sTime = 0;

      this.setThetaAndPhi(90, 30);
      this.setLatitude(41);
      this.setSiderealTime(0);
    }

    // ---- getters used by the controller ----
    getTheta() { return R2D * this.theta; }
    getPhi()   { return R2D * this.phi; }

    setSize(arg) {
      this.c.r = arg / 2;
      this.c.r2 = this.c.r * this.c.r;
      this.doA(); this.doB();
    }
    setMinPhi(v) { this.minPhi = (v > 90 || v < -90) ? 90 : v; }
    setMaxPhi(v) { this.maxPhi = (v > 90 || v < -90) ? 90 : v; }

    setThetaAndPhi(newTheta, newPhi) {
      this.theta = D2R * mod(newTheta, 360);
      let p = newPhi;
      if (p > this.maxPhi) p = this.maxPhi;
      else if (p < this.minPhi) p = this.minPhi;
      this.phi = p * D2R;
      this.doA(); this.doB();
    }
    setTheta(arg) {
      this.theta = D2R * mod(arg, 360);
      this.doA(); this.doB();
    }
    setLatitude(arg) {
      let v = arg;
      if (v > 90) v = 90; else if (v < -90) v = -90;
      this.lat = v * D2R;
      this.doM(); this.doB();
    }
    setSiderealTime(arg) {
      this.sTime = mod(arg, 24) * 0.2617993877991494;
      this.doM(); this.doB();
    }

    // ---- matrix builders (3 CS Geometry: doA / doM / doB) ----
    doA() {
      const c = this.c;
      const ct = Math.cos(this.theta), st = Math.sin(this.theta);
      const cp = Math.cos(this.phi),  sp = Math.sin(this.phi);
      c.a0 = -c.r * st;
      c.a1 =  c.r * ct;
      c.a3 =  c.r * ct * sp;
      c.a4 =  c.r * st * sp;
      c.a5 = -c.r * cp;
      c.a6 =  c.r * ct * cp;
      c.a7 =  c.r * st * cp;
      c.a8 =  c.r * sp;
      this.aVer++;
    }
    doM() {
      const c = this.c;
      c.m2 = Math.cos(this.lat);
      c.m3 = Math.sin(this.sTime);
      c.m4 = -Math.cos(this.sTime);
      c.m8 = Math.sin(this.lat);
      c.m0 = c.m4 * c.m8;
      c.m1 = -c.m3 * c.m8;
      c.m6 = -c.m2 * c.m4;
      c.m7 = c.m2 * c.m3;
    }
    doB() {
      const c = this.c;
      c.b0 = c.a0 * c.m0 + c.a1 * c.m3;
      c.b1 = c.a0 * c.m1 + c.a1 * c.m4;
      c.b2 = c.a0 * c.m2;
      c.b3 = c.a3 * c.m0 + c.a4 * c.m3 + c.a5 * c.m6;
      c.b4 = c.a3 * c.m1 + c.a4 * c.m4 + c.a5 * c.m7;
      c.b5 = c.a3 * c.m2 + c.a5 * c.m8;
      c.b6 = c.a6 * c.m0 + c.a7 * c.m3 + c.a8 * c.m6;
      c.b7 = c.a6 * c.m1 + c.a7 * c.m4 + c.a8 * c.m7;
      c.b8 = c.a6 * c.m2 + c.a8 * c.m8;
      this.bVer++;
    }

    // ---- point parsing + transforms (3 CS Geometry) ----
    parsePointInput(inP, out) {
      if (inP.az !== undefined && inP.alt !== undefined) {
        out.sys = 0; out.system = 'horizon';
        const r = (inP.r !== undefined) ? inP.r : 1;
        const d = r * Math.cos(inP.alt * D2R);
        out.x = d * Math.cos(inP.az * D2R);
        out.y = d * Math.sin(-inP.az * D2R);
        out.z = r * Math.sin(inP.alt * D2R);
        out.r = Math.abs(r);
      } else if (inP.ra !== undefined && inP.dec !== undefined) {
        out.sys = 1; out.system = 'celestial';
        const r = (inP.r !== undefined) ? inP.r : 1;
        const d = r * Math.cos(inP.dec * D2R);
        out.x = d * Math.cos(inP.ra * 0.2617993877991494);
        out.y = d * Math.sin(inP.ra * 0.2617993877991494);
        out.z = r * Math.sin(inP.dec * D2R);
        out.r = Math.abs(r);
      } else if (inP.x !== undefined && inP.y !== undefined && inP.z !== undefined) {
        if (inP.system === 'horizon') { out.sys = 0; out.system = 'horizon'; }
        else if (inP.system === 'celestial') { out.sys = 1; out.system = 'celestial'; }
        else { out.sys = -1; out.system = 'unknown'; }
        out.x = inP.x; out.y = inP.y; out.z = inP.z;
        out.r = Math.sqrt(inP.x * inP.x + inP.y * inP.y + inP.z * inP.z);
        if (out.r < 1.000001 && out.r > 0.999999) out.r = 1;
      } else {
        out.sys = null; out.system = null;
        out.x = null; out.y = null; out.z = null; out.r = null;
      }
    }
    // world (horizon) -> screen, with depth (z)
    WtoSz(p, sp) {
      const c = this.c;
      sp.x = p.x * c.a0 + p.y * c.a1;
      sp.y = p.x * c.a3 + p.y * c.a4 + p.z * c.a5;
      sp.z = p.x * c.a6 + p.y * c.a7 + p.z * c.a8;
    }
    // celestial -> screen, with depth
    CtoSz(p, sp) {
      const c = this.c;
      sp.x = p.x * c.b0 + p.y * c.b1 + p.z * c.b2;
      sp.y = p.x * c.b3 + p.y * c.b4 + p.z * c.b5;
      sp.z = p.x * c.b6 + p.y * c.b7 + p.z * c.b8;
    }
    // celestial -> world
    CtoW(p, wp) {
      const c = this.c;
      wp.x = p.x * c.m0 + p.y * c.m1 + p.z * c.m2;
      wp.y = p.x * c.m3 + p.y * c.m4;
      wp.z = p.x * c.m6 + p.y * c.m7 + p.z * c.m8;
    }
    // screen -> mounted-horizon (radians) - used by both drags (3 CS Geometry)
    StoMH(sp, hp) {
      const r = this.c.r;
      let d = Math.sqrt(sp.x * sp.x + sp.y * sp.y) / r;
      if (d > 1) d = 1;
      const b = Math.asin(d);
      const A = Math.atan2(sp.x, -sp.y);
      if (this.phi === HALF_PI) {
        hp.alt = HALF_PI - b;
        hp.az = this.theta + PI - A;
      } else if (this.phi === -HALF_PI) {
        hp.alt = -HALF_PI + b;
        hp.az = this.theta + A;
      } else {
        const cc = 1.5707963267948966 - this.phi;
        const ccos = Math.cos(cc), csin = Math.sin(cc);
        const cb = Math.cos(b), sb = Math.sin(b);
        const ca = cb * ccos + sb * csin * Math.cos(A);
        hp.alt = HALF_PI - Math.acos(ca);
        hp.az = this.theta + Math.atan2(sb * Math.sin(A), (cb - ca * ccos) / csin);
      }
      hp.az = mod(hp.az, TWO_PI);
    }
  }

  /* =========================================================================
     Circle  -  a great/small circle or arc on the sphere (8 CS Circles.as).
     update() recomputes the projected ellipse and splits the requested arc
     [gS,gE] into front-facing and back-facing path segments exactly as the AS
     does, so depth ordering against the sphere matches the original.
     ========================================================================= */
  class Circle {
    constructor(sphere, style) {
      this.sphere = sphere;
      this.c = {};               // w-matrix scratchpad
      this.wVer = -1;
      this.gS = 0; this.gE = 0;
      this.beta = 0; this.tilt = 0; this.lambda = 0;
      this.sys = 0;
      this.visible = true;
      this.color = 16711680; this.thick = 1; this.alpha = 80;
      this.minStep = 0.7853981633974483;   // pi/4
      this.front = [];           // arrays of {move,curves}
      this.back = [];
      if (style) this.setStyle(style.thickness, style.color, style.alpha);
    }
    setStyle(t, col, a) {
      if (t !== undefined) this.thick = t;
      if (col !== undefined) this.color = col;
      if (a !== undefined) this.alpha = a;
    }
    // doW from 8 CS Circles
    doW() {
      const st = Math.sin(this.tilt), ct = Math.cos(this.tilt);
      const sb = Math.sin(this.beta), cb = Math.cos(this.beta);
      const cl = Math.cos(this.lambda), sl = Math.sin(this.lambda);
      const c = this.c;
      c.w0 = cl * cb;
      c.w1 = -cl * sb * ct;
      c.w2 = sl * sb * st;
      c.w3 = cl * sb;
      c.w4 = cl * cb * ct;
      c.w5 = -sl * cb * st;
      c.w7 = cl * st;
      c.w8 = sl * ct;
      this.wVer++;
    }
    // setParameters / setCircleParameters (horizon system only is used here)
    setParameters(arg) {
      if (arg.az !== undefined && arg.alt !== undefined && arg.tilt !== undefined) {
        this.sys = 0;
        if (isFinite(arg.tilt)) {
          if (arg.tilt < 0) this.tilt = 0;
          else if (arg.tilt > 180) this.tilt = PI;
          else this.tilt = arg.tilt * D2R;
        }
        if (isFinite(arg.alt)) {
          if (arg.alt < -90) this.lambda = -PI;
          else if (arg.alt > 90) this.lambda = PI;
          else this.lambda = arg.alt * D2R;
        }
        if (isFinite(arg.az)) this.beta = D2R * mod(-arg.az, 360);
        if (isFinite(arg.gammaStart)) this.gS = D2R * mod(arg.gammaStart, 360);
        if (isFinite(arg.gammaEnd)) this.gE = D2R * mod(arg.gammaEnd, 360);
      }
      this.doW();
    }
    gSort(a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0); }

    update() {
      this.front.length = 0;
      this.back.length = 0;
      if (!this.visible) return;

      const tc = this.c, pc = this.sphere.c;
      let v0, v1, v2, v3, v4, v5, v6, v7, v8;
      // sys 0 (horizon) projection (8 CS Circles update, sys==0 branch)
      v0 = pc.a0 * tc.w0 + pc.a1 * tc.w3;
      v1 = pc.a0 * tc.w1 + pc.a1 * tc.w4;
      v2 = pc.a0 * tc.w2 + pc.a1 * tc.w5;
      v3 = pc.a3 * tc.w0 + pc.a4 * tc.w3;
      v4 = pc.a3 * tc.w1 + pc.a4 * tc.w4 + pc.a5 * tc.w7;
      v5 = pc.a3 * tc.w2 + pc.a4 * tc.w5 + pc.a5 * tc.w8;
      v6 = pc.a6 * tc.w0 + pc.a7 * tc.w3;
      v7 = pc.a6 * tc.w1 + pc.a7 * tc.w4 + pc.a8 * tc.w7;
      v8 = pc.a6 * tc.w2 + pc.a7 * tc.w5 + pc.a8 * tc.w8;

      const minStep = this.minStep;
      const frontArr = this.front, backArr = this.back;

      // Build a path for arc [g1,g2] (radians) into the given bucket.
      function drawArc(g1, g2, bucket) {
        if (g2 < g1) g2 += TWO_PI;
        let arc = g2 - g1;
        if (arc === 0) arc = TWO_PI;
        const n = Math.ceil(arc / minStep);
        const step = arc / n;
        const halfStep = step / 2;
        const cRad = 1 / Math.cos(halfStep);
        let ax = Math.cos(g1), ay = Math.sin(g1);
        const path = { move: [v0 * ax + v1 * ay + v2, v3 * ax + v4 * ay + v5], curves: [] };
        let aAngle = g1 + step;
        let cAngle = aAngle - halfStep;
        for (let i = 0; i < n; i++) {
          ax = Math.cos(aAngle); ay = Math.sin(aAngle);
          const cx = cRad * Math.cos(cAngle), cy = cRad * Math.sin(cAngle);
          path.curves.push([
            v0 * cx + v1 * cy + v2, v3 * cx + v4 * cy + v5,   // control
            v0 * ax + v1 * ay + v2, v3 * ax + v4 * ay + v5    // anchor
          ]);
          aAngle += step; cAngle += step;
        }
        bucket.push(path);
      }

      const A = Math.sqrt(v6 * v6 + v7 * v7);
      if (A === 0) {
        if (v8 < 0) drawArc(this.gS, this.gE, backArr);
        else drawArc(this.gS, this.gE, frontArr);
        return;
      }
      const sj = -v8 / A;
      if (sj <= -1) { drawArc(this.gS, this.gE, frontArr); return; }
      if (sj >= 1)  { drawArc(this.gS, this.gE, backArr); return; }

      const j = Math.asin(sj);
      const t = Math.atan2(v6, v7);
      let gDesc, gAsc;
      if (Math.cos(j) < 0) {
        gDesc = mod(j - t, TWO_PI);
        gAsc  = mod(PI - j - t, TWO_PI);
      } else {
        gDesc = mod(PI - j - t, TWO_PI);
        gAsc  = mod(j - t, TWO_PI);
      }
      if (this.gS === this.gE) {
        drawArc(gAsc, gDesc, frontArr);
        drawArc(gDesc, gAsc, backArr);
        return;
      }
      // Mixed arc: walk the four boundary angles deciding front/back + draw.
      const gArray = [[gAsc, 0], [gDesc, 1], [this.gS, 2], [this.gE, 3]];
      gArray.sort(this.gSort);
      let draw = false, front = true;
      for (let k = 0; k < 4; k++) {
        const code = gArray[k][1];
        if (code === 0) front = true;
        else if (code === 1) front = false;
        else if (code === 2) draw = true;
        else draw = false;
      }
      let prev = gArray[3];
      for (let i = 0; i < 4; i++) {
        const g1 = prev;
        prev = gArray[i];
        if (draw && g1[0] !== prev[0]) {
          if (front) drawArc(g1[0], prev[0], frontArr);
          else drawArc(g1[0], prev[0], backArr);
        }
        const code = prev[1];
        if (code === 0) front = true;
        else if (code === 1) front = false;
        else if (code === 2) draw = true;
        else draw = false;
      }
    }
  }

  /* =========================================================================
     Line  -  a straight segment in space, split by the sphere boundary and the
     horizon plane into front/back pieces (9 CS Lines.as). Used for the small
     pole stubs (npLine / spLine). Buckets: front = external-front + inner-above,
     back = external-back + inner-below.
     ========================================================================= */
  class Line {
    constructor(sphere, style, head, tail) {
      this.sphere = sphere;
      this.thick = 1; this.color = 255; this.alpha = 100;
      if (style) this.setStyle(style.thickness, style.color, style.alpha);
      this.visible = true;
      this.head = {}; this.tail = {};
      this.setHeadPoint(head); this.setTailPoint(tail);
      this.front = []; this.back = [];
    }
    setStyle(t, col, a) {
      if (t !== undefined) this.thick = t;
      if (col !== undefined) this.color = col;
      if (a !== undefined) this.alpha = a;
    }
    setHeadPoint(h) { this.sphere.parsePointInput(h, this.head); if (this.head.sys === -1) this.head.sys = 0; }
    setTailPoint(t) { this.sphere.parsePointInput(t, this.tail); if (this.tail.sys === -1) this.tail.sys = 0; }

    update() {
      this.front.length = 0; this.back.length = 0;
      if (!this.visible) return;
      const S = this.sphere;
      const head = {}, tail = {};
      if (this.head.sys === 0) S.WtoSz(this.head, head);
      else if (this.head.sys === 1) S.CtoSz(this.head, head); else return;
      if (this.tail.sys === 0) S.WtoSz(this.tail, tail);
      else if (this.tail.sys === 1) S.CtoSz(this.tail, tail); else return;

      const mx = head.x - tail.x, my = head.y - tail.y, mz = head.z - tail.z;
      const A = mx * mx + my * my + mz * mz;
      const B = 2 * (mx * tail.x + my * tail.y + mz * tail.z);
      const C = tail.x * tail.x + tail.y * tail.y + tail.z * tail.z;
      const rad = S.c.r, rad2 = rad * rad;
      const phi = S.phi;
      const stmp = [];
      const Dsc = B * B - 4 * A * (C - rad2);
      if (Dsc > 0) {
        const sD = Math.sqrt(Dsc);
        stmp.push((-B + sD) / (2 * A));
        stmp.push((-B - sD) / (2 * A));
      }
      let tp;
      if (phi > -HALF_PI && phi < HALF_PI) {
        tp = Math.tan(phi);
        if (my !== tp * mz) stmp.push((tp * tail.z - tail.y) / (my - tp * mz));
        if (mz !== 0) {
          const tmp = -tail.z / mz;
          if (tmp * (tmp * A + B) + C >= rad2) stmp.push(tmp);
        }
      } else if (mz !== 0) {
        stmp.push(-tail.z / mz);
      }
      const s = [0, 1];
      for (let i = 0; i < stmp.length; i++) {
        if (stmp[i] > 0 && stmp[i] < 1) {
          let k = 1;
          while (stmp[i] > s[k]) k++;
          if (stmp[i] !== s[k]) s.splice(k, 0, stmp[i]);
        }
      }
      const push = (bucket, s1, s2) => bucket.push({
        move: [s1 * mx + tail.x, s1 * my + tail.y],
        line: [s2 * mx + tail.x, s2 * my + tail.y]
      });

      if (S.showUnder) {
        for (let i = 0; i < s.length - 1; i++) {
          const s1 = s[i], s2 = s[i + 1];
          const m = s1 + (s2 - s1) / 2;
          const r2 = m * (m * A + B) + C;
          let toFront;
          if (r2 < rad2) {
            // inner segment
            if (phi === -HALF_PI) toFront = !((m * mz + tail.z) > 0);
            else if (phi === HALF_PI) toFront = ((m * mz + tail.z) > 0);
            else toFront = !((m * my + tail.y - (m * mz + tail.z) * tp) > 1e-9);
          } else {
            // external segment
            toFront = !((m * mz + tail.z) < 0);
          }
          push(toFront ? this.front : this.back, s1, s2);
        }
      } else {
        for (let i = 0; i < s.length - 1; i++) {
          const s1 = s[i], s2 = s[i + 1];
          const m = s1 + (s2 - s1) / 2;
          const r2 = m * (m * A + B) + C;
          if (r2 < rad2) {
            if (phi === -HALF_PI) { if (m * mz + tail.z > 0) continue; }
            else if (phi === HALF_PI) { if (m * mz + tail.z <= 0) continue; }
            else { if (m * my + tail.y - (m * mz + tail.z) * tp > 1e-9) continue; }
            this.front.push({ move: [s1 * mx + tail.x, s1 * my + tail.y], line: [s2 * mx + tail.x, s2 * my + tail.y] });
          } else if (phi === -HALF_PI) {
            if (m * mz + tail.z > 0) continue;
            this.back.push({ move: [s1 * mx + tail.x, s1 * my + tail.y], line: [s2 * mx + tail.x, s2 * my + tail.y] });
          } else if (phi === HALF_PI) {
            if (m * mz + tail.z <= 0) continue;
            this.front.push({ move: [s1 * mx + tail.x, s1 * my + tail.y], line: [s2 * mx + tail.x, s2 * my + tail.y] });
          } else {
            if (m * my + tail.y - (m * mz + tail.z) * tp > 1e-9) continue;
            const bucket = (m * mz + tail.z < 0) ? this.back : this.front;
            bucket.push({ move: [s1 * mx + tail.x, s1 * my + tail.y], line: [s2 * mx + tail.x, s2 * my + tail.y] });
          }
        }
      }
    }
  }

  /* =========================================================================
     App  -  the controller (Alt Az Demo.as) + canvas renderer + UI wiring.
     ========================================================================= */
  class App {
    constructor() {
      this.S = new CelestialSphere();
      this.S.setSize(320);              // sphereMC.size = 320  -> r = 160
      this.S.setMinPhi(1);              // minViewerAltitude = 1
      this.S.setMaxPhi(90);

      this.STAGE = 440;                 // canvas internal size (square)
      this.CENTER = 220;
      this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

      this.azColor = AZ_COLOR;
      this.altColor = ALT_COLOR;

      // star state (horizon az/alt in degrees)
      this.star = { az: 140, alt: 45, sp: { x: 0, y: 0, z: 0 } };

      // label checkbox visibility (Alt Az Demo: zenith/horizon/nadir/meridian)
      this.labels = { zenith: false, horizon: false, nadir: false, meridian: false };

      this.buildCircles();
      this.buildLines();
      this.cacheDom();
      this.loadAssets();
      this.bindEvents();

      this.reset();                     // p.reset()
    }

    // --- build the fixed circles (from Alt Az Demo.init) ---
    buildCircles() {
      const S = this.S;
      // meridian2: faint guide great circle  {az:90,alt:0,tilt:90}
      this.meridian2 = new Circle(S, { thickness: 1, color: 0, alpha: 10 });
      this.meridian2.setParameters({ az: 90, alt: 0, tilt: 90 });
      // azCircle / altCircle: light grey guide circles (params set per star)
      this.azCircle = new Circle(S, { thickness: 1, color: 10526880, alpha: 100 });
      this.azCircle.setParameters({ az: 0, alt: 0, tilt: 90 });
      this.altCircle = new Circle(S, { thickness: 1, color: 10526880, alpha: 100 });
      this.altCircle.setParameters({ az: 0, alt: 0, tilt: 90 });
      // meridian: dark-green principal vertical great circle
      this.meridian = new Circle(S, { thickness: 2, color: 2188081, alpha: 100 });
      this.meridian.setParameters({ az: 0, alt: 0, tilt: 90 });
      // azArc (blue) on the horizon, altArc (red) vertical to the star
      this.azArc = new Circle(S, { thickness: 3, color: this.azColor, alpha: 100 });
      this.azArc.setParameters({ az: 0, alt: 0, tilt: 0 });
      this.altArc = new Circle(S, { thickness: 3, color: this.altColor, alpha: 100 });
      this.altArc.setParameters({ az: 0, alt: 0, tilt: 90 });

      // Draw order matches the original depth banding (guides first, accents last)
      this.circles = [this.meridian2, this.azCircle, this.altCircle,
                      this.meridian, this.azArc, this.altArc];
    }

    buildLines() {
      const S = this.S;
      // npLine / spLine: short pole stubs just outside the sphere
      this.npLine = new Line(S, { thickness: 2, color: 5263440, alpha: 100 },
                             { az: 0, alt: 90, r: 1 }, { az: 0, alt: 90, r: 1.2 });
      this.spLine = new Line(S, { thickness: 2, color: 5263440, alpha: 100 },
                             { az: 0, alt: -90, r: 1 }, { az: 0, alt: -90, r: 1.2 });
      this.lines = [this.npLine, this.spLine];
    }

    cacheDom() {
      this.canvas = document.getElementById('sky');
      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = this.STAGE * this.dpr;
      this.canvas.height = this.STAGE * this.dpr;
      this.ctx.scale(this.dpr, this.dpr);

      this.overlay = document.getElementById('overlay');
      this.el = {
        N: document.getElementById('lblN'),
        E: document.getElementById('lblE'),
        S: document.getElementById('lblS'),
        W: document.getElementById('lblW'),
        zenith: document.getElementById('lblZenith'),
        nadir: document.getElementById('lblNadir'),
        horizon: document.getElementById('lblHorizon'),
        meridian: document.getElementById('lblMeridian'),
        azValue: document.getElementById('lblAzValue'),
        altValue: document.getElementById('lblAltValue')
      };
      this.azSlider = document.getElementById('azSlider');
      this.altSlider = document.getElementById('altSlider');
      this.azNumber = document.getElementById('azNumber');
      this.altNumber = document.getElementById('altNumber');
      this.chk = {
        zenith: document.getElementById('chkZenith'),
        horizon: document.getElementById('chkHorizon'),
        nadir: document.getElementById('chkNadir'),
        meridian: document.getElementById('chkMeridian')
      };
      this.desc = document.getElementById('diagramDesc');
      this.starHandle = document.getElementById('starHandle');
    }

    loadAssets() {
      this.imgStar = new Image();
      this.imgStarHover = new Image();
      this.imgStick = new Image();
      let pending = 3;
      const done = () => { if (--pending === 0) this.render(); };
      this.imgStar.onload = done; this.imgStar.onerror = done;
      this.imgStarHover.onload = done; this.imgStarHover.onerror = done;
      this.imgStick.onload = done; this.imgStick.onerror = done;
      this.imgStar.src = 'assets/star.png';
      this.imgStarHover.src = 'assets/star-hover.png';
      this.imgStick.src = 'assets/stickfigure.png';
      this.starHovered = false;
    }

    // ----------------------------------------------------------------------
    // Controller methods (ported from Alt Az Demo.as)
    // ----------------------------------------------------------------------
    reset() {
      this.setStarLocation({ az: 140, alt: 45 });
      this.S.setThetaAndPhi(190, 28);
      this.onSphereOrientationChanged();
      this.hideAllLabels();
      this.render();
      this.announce(true);
    }

    onSphereOrientationChanged() {
      // horizonLabel sits on the horizon at az = 394 - theta(deg)
      this.horizonAz = 394 - this.S.getTheta();
      this.render();
    }

    updateLabels() {
      this.labels.zenith = this.chk.zenith.checked;
      this.labels.horizon = this.chk.horizon.checked;
      this.labels.nadir = this.chk.nadir.checked;
      this.labels.meridian = this.chk.meridian.checked;
      this.render();
      this.announce();
    }
    setAllLabelsVisibility(v) {
      this.chk.zenith.checked = v; this.chk.horizon.checked = v;
      this.chk.nadir.checked = v; this.chk.meridian.checked = v;
      this.updateLabels();
    }
    showAllLabels() { this.setAllLabelsVisibility(true); }
    hideAllLabels() { this.setAllLabelsVisibility(false); }

    onPositionSliderChanged() {
      this.setStarLocation({ az: Number(this.azSlider.value), alt: Number(this.altSlider.value) }, true);
      this.render();
    }

    // Faithful port of p.setStarLocation
    setStarLocation(pt, skipSliderSync) {
      const S = this.S;
      if (pt.az !== 360) pt.az = mod(pt.az, 360);

      this.star.az = pt.az;
      this.star.alt = pt.alt;

      // azArc: horizon arc from (360-az) back to 0, hidden when az == 0
      if (pt.az !== 0) {
        this.azArc.setParameters({ az: 0, alt: 0, tilt: 0, gammaStart: 360 - pt.az, gammaEnd: 0 });
        this.azArc.visible = true;
      } else {
        this.azArc.visible = false;
      }
      this.azCircle.setParameters({ az: pt.az, alt: 0, tilt: 90, gammaStart: -90, gammaEnd: 90 });

      // altArc: vertical arc from horizon up (or down) to the star
      if (pt.alt < 0) {
        this.altArc.setParameters({ az: pt.az, alt: 0, tilt: 90, gammaStart: pt.alt, gammaEnd: 0 });
        this.altArc.visible = true;
      } else if (pt.alt > 0) {
        this.altArc.setParameters({ az: pt.az, alt: 0, tilt: 90, gammaStart: 0, gammaEnd: pt.alt });
        this.altArc.visible = true;
      } else {
        this.altArc.visible = false;
      }
      this.altCircle.setParameters({ az: 0, alt: pt.alt, tilt: 0 });

      if (!skipSliderSync) {
        this.azSlider.value = pt.az;
        this.altSlider.value = pt.alt;
        this.azNumber.value = toFixedAS(pt.az, 1);
        this.altNumber.value = toFixedAS(pt.alt, 1);
      }
      this.azSlider.setAttribute('aria-valuetext', toFixedAS(pt.az, 1) + ' degrees');
      this.altSlider.setAttribute('aria-valuetext', toFixedAS(pt.alt, 1) + ' degrees');
    }

    // ----------------------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------------------
    render() {
      const S = this.S, ctx = this.ctx, cx = this.CENTER, cy = this.CENTER, r = S.c.r;

      // recompute geometry
      for (const c of this.circles) c.update();
      for (const l of this.lines) l.update();

      // star + markers screen positions
      const starP = {}; S.parsePointInput({ az: this.star.az, alt: this.star.alt, r: 1 }, starP);
      S.WtoSz(starP, this.star.sp);
      const zenithSp = {}; S.WtoSz({ x: 0, y: 0, z: 1 }, zenithSp);
      const nadirSp = {};  S.WtoSz({ x: 0, y: 0, z: -1 }, nadirSp);

      ctx.clearRect(0, 0, this.STAGE, this.STAGE);
      ctx.save();
      ctx.translate(cx, cy);

      // 1. translucent sphere body (celestialBowl: light centre -> soft dark rim)
      const bowl = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
      bowl.addColorStop(0, 'rgba(255,255,255,0.0)');
      bowl.addColorStop(0.82, 'rgba(210,214,219,0.18)');
      bowl.addColorStop(1, 'rgba(120,126,134,0.32)');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.fillStyle = bowl; ctx.fill();

      // Inner objects (markers, star) are ordered against the horizon plane by
      // their WORLD z (above/below the plane), matching the AS depth bands:
      // below-plane items draw behind the plane (occluded), above-plane in front.
      const starBelow = this.star.alt < 0;

      // 2. back-facing geometry (behind the sphere centre)
      this.drawCircleBucket('back');
      this.drawLineBucket('back');
      // nadir is below the plane -> behind it; star too when alt < 0
      this.drawMarker(nadirSp);
      if (starBelow) this.drawStar();

      // 3. horizon plane (green ellipse, scaled + rotated like the Flash clip)
      this.drawHorizonPlane();

      // 4. front-facing geometry
      this.drawCircleBucket('front');
      this.drawLineBucket('front');
      this.drawMarker(zenithSp);          // zenith is above the plane
      // 5. stick figure (observer) stands on the plane, star on top when above
      this.drawStick();
      if (!starBelow) this.drawStar();

      ctx.restore();

      this.positionOverlay(zenithSp, nadirSp);
      this.updateCanvasDescription();
    }

    drawCircleBucket(which) {
      const ctx = this.ctx;
      for (const c of this.circles) {
        const paths = c[which];
        if (!paths.length) continue;
        ctx.lineWidth = Math.max(1, c.thick);
        ctx.strokeStyle = intToCss(c.color);
        ctx.globalAlpha = c.alpha / 100;
        for (const p of paths) {
          ctx.beginPath();
          ctx.moveTo(p.move[0], p.move[1]);
          for (const cu of p.curves) ctx.quadraticCurveTo(cu[0], cu[1], cu[2], cu[3]);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    drawLineBucket(which) {
      const ctx = this.ctx;
      for (const l of this.lines) {
        const segs = l[which];
        if (!segs.length) continue;
        ctx.lineWidth = Math.max(1, l.thick);
        ctx.strokeStyle = intToCss(l.color);
        ctx.globalAlpha = l.alpha / 100;
        for (const s of segs) {
          ctx.beginPath();
          ctx.moveTo(s.move[0], s.move[1]);
          ctx.lineTo(s.line[0], s.line[1]);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    drawHorizonPlane() {
      const ctx = this.ctx, S = this.S, r = S.c.r;
      // The horizon plane is the (horizontal) alt=0 circle. Its orthographic
      // projection is an AXIS-ALIGNED ellipse: full width (semi-axis r) and a
      // vertical semi-axis r*sin(phi) that opens/closes with the view altitude
      // (phi) but never rotates with the azimuth (theta). This matches the AS,
      // where the squash (_hP._xscale=r, _yscale=r*sin(phi)) is applied AFTER
      // the inner clip's rotation, and the disc art is radially symmetric so the
      // rotation only repositions the (separately drawn) direction labels.
      const yscale = Math.sin(S.phi);            // r*sin(phi) / r
      ctx.save();
      ctx.scale(1, yscale);                       // squash circle into the horizon ellipse
      const above = S.phi > 0;
      const g = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
      if (above) {                                // CSAboveHorizonPlane (bright green)
        g.addColorStop(0, '#46b446');
        g.addColorStop(0.75, '#3da53d');
        g.addColorStop(1, '#2f8a2f');
      } else {                                    // CSBelowHorizonPlane (dark green)
        g.addColorStop(0, '#0a7a14');
        g.addColorStop(1, '#005000');
      }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI);
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }

    drawMarker(sp) {
      // Marker symbol: a small open ring (label text is "")
      const ctx = this.ctx;
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#222222';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 4, 0, TWO_PI);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    drawStick() {
      const ctx = this.ctx;
      if (!this.imgStick.naturalWidth) return;
      const sc = 1.2;                              // _xscale/_yscale 120
      const w = this.imgStick.naturalWidth * sc;
      const h = this.imgStick.naturalHeight * sc;
      // Stands upright on the plane: anchor feet at the centre of the sphere.
      ctx.drawImage(this.imgStick, -w / 2, -h, w, h);
    }

    drawStar() {
      const ctx = this.ctx;
      const img = (this.starHovered && this.star.sp.z > 0) ? this.imgStarHover : this.imgStar;
      if (!img.naturalWidth) return;
      const w = img.naturalWidth, h = img.naturalHeight;
      ctx.drawImage(img, this.star.sp.x - w / 2, this.star.sp.y - h / 2, w, h);
    }

    // Position the HTML text labels (in percent) over the scaled canvas.
    positionOverlay(zenithSp, nadirSp) {
      const S = this.S;
      const place = (el, sp, show) => {
        if (!show) { el.style.display = 'none'; return; }
        el.style.display = 'block';
        el.style.left = ((this.CENTER + sp.x) / this.STAGE * 100) + '%';
        el.style.top = ((this.CENTER + sp.y) / this.STAGE * 100) + '%';
      };
      const project = (pt) => { const o = {}, sp = {}; S.parsePointInput(pt, o); S.WtoSz(o, sp); return sp; };

      // Cardinal directions on the horizon (always shown)
      place(this.el.N, project({ az: 0,   alt: 0, r: 1.04 }), true);
      place(this.el.E, project({ az: 90,  alt: 0, r: 1.04 }), true);
      place(this.el.S, project({ az: 180, alt: 0, r: 1.04 }), true);
      place(this.el.W, project({ az: 270, alt: 0, r: 1.04 }), true);

      // Named labels (toggled by the checkboxes)
      place(this.el.zenith, zenithSp, this.labels.zenith);
      place(this.el.nadir, nadirSp, this.labels.nadir);
      place(this.el.horizon, project({ az: this.horizonAz, alt: 0, r: 1 }), this.labels.horizon);
      place(this.el.meridian, project({ az: 180, alt: 35, r: 1 }), this.labels.meridian);

      // az / alt degree readouts near the star (positions from setStarLocation)
      const azSp = project({ az: this.star.az - 13, alt: 5, r: 1.001 });
      const altSp = project({ az: this.star.az + 13, alt: this.star.alt / 2, r: 1.001 });
      this.el.azValue.textContent = toFixedAS(this.star.az, 1) + '°';
      this.el.altValue.textContent = toFixedAS(this.star.alt, 1) + '°';
      place(this.el.azValue, azSp, true);
      place(this.el.altValue, altSp, true);

      // Keyboard handle tracks the star's screen position + current coordinates.
      this.starHandle.style.left = ((this.CENTER + this.star.sp.x) / this.STAGE * 100) + '%';
      this.starHandle.style.top = ((this.CENTER + this.star.sp.y) / this.STAGE * 100) + '%';
      this.starHandle.setAttribute('aria-label',
        'Star position. Azimuth ' + toFixedAS(this.star.az, 1) +
        ' degrees, altitude ' + toFixedAS(this.star.alt, 1) + ' degrees.');
    }

    updateCanvasDescription() {
      const onLabels = [];
      if (this.labels.zenith) onLabels.push('Zenith');
      if (this.labels.horizon) onLabels.push('Horizon Plane');
      if (this.labels.nadir) onLabels.push('Nadir');
      if (this.labels.meridian) onLabels.push('Meridian');
      const labelText = onLabels.length ? onLabels.join(', ') : 'none';
      this.canvas.setAttribute('aria-label',
        'Horizon diagram. Star at azimuth ' + toFixedAS(this.star.az, 1) +
        ' degrees, altitude ' + toFixedAS(this.star.alt, 1) +
        ' degrees. Visible labels: ' + labelText + '.');
    }

    announce(includeOrientation) {
      let msg = 'Star at azimuth ' + toFixedAS(this.star.az, 1) +
                ' degrees, altitude ' + toFixedAS(this.star.alt, 1) + ' degrees.';
      if (includeOrientation) {
        msg += ' View reset.';
      }
      this.desc.textContent = msg;
    }

    // ----------------------------------------------------------------------
    // Pointer + keyboard interaction
    // ----------------------------------------------------------------------
    // Convert a pointer event to sphere-local stage coordinates (origin at centre).
    pointerToStage(ev) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = (ev.clientX - rect.left) / rect.width * this.STAGE - this.CENTER;
      const sy = (ev.clientY - rect.top) / rect.height * this.STAGE - this.CENTER;
      return { x: sx, y: sy };
    }

    bindEvents() {
      // Masthead Reset (sim-reset bubbles up from the component)
      document.addEventListener('sim-reset', () => this.reset());

      // Sliders + number fields (both mutate the same state)
      const syncFromSlider = (slider, number) => {
        number.value = toFixedAS(Number(slider.value), 1);
        this.onPositionSliderChanged();
        this.announce();
      };
      this.azSlider.addEventListener('input', () => syncFromSlider(this.azSlider, this.azNumber));
      this.altSlider.addEventListener('input', () => syncFromSlider(this.altSlider, this.altNumber));

      const syncFromNumber = (number, slider) => {
        let v = Number(number.value);
        if (!isFinite(v)) return;
        v = Math.max(Number(slider.min), Math.min(Number(slider.max), v));
        slider.value = v;
        this.onPositionSliderChanged();
        this.announce();
      };
      this.azNumber.addEventListener('change', () => syncFromNumber(this.azNumber, this.azSlider));
      this.altNumber.addEventListener('change', () => syncFromNumber(this.altNumber, this.altSlider));

      // Buttons + checkboxes
      document.getElementById('showAllBtn').addEventListener('click', () => this.showAllLabels());
      document.getElementById('hideAllBtn').addEventListener('click', () => this.hideAllLabels());
      for (const k of Object.keys(this.chk)) {
        this.chk[k].addEventListener('change', () => this.updateLabels());
      }

      // Canvas pointer drag: star (if front-facing) else rotate the sphere
      this.dragMode = null;
      this.canvas.addEventListener('pointermove', (ev) => this.onPointerHover(ev));
      this.canvas.addEventListener('pointerdown', (ev) => this.onPointerDown(ev));
      window.addEventListener('pointermove', (ev) => this.onPointerDrag(ev));
      window.addEventListener('pointerup', (ev) => this.onPointerUp(ev));

      // Keyboard equivalent for the pointer-drag view rotation (arrows rotate the
      // sphere; directions match the mouse drag). The star itself is moved with
      // the Star Position controls.
      this.canvas.addEventListener('keydown', (ev) => this.onCanvasKey(ev));
      this.starHandle.addEventListener('keydown', (ev) => this.onStarKey(ev));

      window.addEventListener('resize', () => this.render());
    }

    nearStar(stage) {
      const dx = stage.x - this.star.sp.x, dy = stage.y - this.star.sp.y;
      return (dx * dx + dy * dy) <= 14 * 14;     // ~star hit radius
    }

    onPointerHover(ev) {
      if (this.dragMode) return;
      const stage = this.pointerToStage(ev);
      const over = this.nearStar(stage) && this.star.sp.z > 0;
      if (over !== this.starHovered) { this.starHovered = over; this.render(); }
    }

    onPointerDown(ev) {
      const stage = this.pointerToStage(ev);
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(ev.pointerId);
      // AzAlt Draggable Star.onPress: front-facing star -> drag star; else sphere
      if (this.nearStar(stage) && this.star.sp.z > 0) {
        this.dragMode = 'star';
      } else {
        this.dragMode = 'sphere';
        this.dragXMouse = stage.x; this.dragYMouse = stage.y;
        this.dragTheta = this.S.theta; this.dragPhi = this.S.phi;
      }
      this.canvas.classList.add('dragging');
      ev.preventDefault();
    }

    onPointerDrag(ev) {
      if (!this.dragMode) return;
      const stage = this.pointerToStage(ev);
      if (this.dragMode === 'star') {
        // AzAlt Draggable Star.onMouseMoveFunc
        const hp = {};
        this.S.StoMH({ x: stage.x, y: stage.y }, hp);
        this.setStarLocation({ az: -hp.az * 180 / PI, alt: hp.alt * 180 / PI });
        this.render();
      } else {
        // CelestialSphere.updateSimpleDragging
        const r = this.S.c.r;
        this.S.setThetaAndPhi(
          R2D * (this.dragTheta - (stage.x - this.dragXMouse) / r),
          R2D * (this.dragPhi + (stage.y - this.dragYMouse) / r)
        );
        this.onSphereOrientationChanged();
      }
    }

    onPointerUp() {
      if (!this.dragMode) return;
      this.dragMode = null;
      this.canvas.classList.remove('dragging');
      this.announce();
    }

    // Arrow keys rotate the view; Shift = finer (1deg) step, PageUp/Down = phi
    // in 15deg steps. theta/phi signs match CelestialSphere.updateSimpleDragging.
    onCanvasKey(ev) {
      const step = ev.shiftKey ? 1 : 5;
      let dTheta = 0, dPhi = 0;
      switch (ev.key) {
        case 'ArrowLeft':  dTheta = step;  break;
        case 'ArrowRight': dTheta = -step; break;
        case 'ArrowUp':    dPhi = -step;   break;
        case 'ArrowDown':  dPhi = step;    break;
        case 'PageUp':     dPhi = -15;     break;
        case 'PageDown':   dPhi = 15;      break;
        default: return;
      }
      ev.preventDefault();
      this.S.setThetaAndPhi(this.S.getTheta() + dTheta, this.S.getPhi() + dPhi);
      this.onSphereOrientationChanged();
      this.announceView();
    }

    // Arrow keys move the star (az/alt), mirroring the star drag. Same step
    // scheme as the view rotation: 5deg arrows, 1deg with Shift, 15deg Page keys.
    onStarKey(ev) {
      const step = ev.shiftKey ? 1 : 5;
      let dAz = 0, dAlt = 0;
      switch (ev.key) {
        case 'ArrowLeft':  dAz = -step;  break;
        case 'ArrowRight': dAz = step;   break;
        case 'ArrowUp':    dAlt = step;  break;
        case 'ArrowDown':  dAlt = -step; break;
        case 'PageUp':     dAlt = 15;    break;
        case 'PageDown':   dAlt = -15;   break;
        default: return;
      }
      ev.preventDefault();
      let alt = this.star.alt + dAlt;
      if (alt > 90) alt = 90; else if (alt < -90) alt = -90;   // slider range
      // setStarLocation normalizes azimuth mod 360 and syncs the sliders/fields.
      this.setStarLocation({ az: this.star.az + dAz, alt: alt });
      this.render();
      this.announce();
    }

    announceView() {
      const az = mod(360 - this.S.getTheta(), 360);   // viewer azimuth
      const alt = this.S.getPhi();                     // viewer altitude
      this.desc.textContent = 'View rotated. Viewing azimuth ' +
        toFixedAS(az, 1) + ' degrees, viewing altitude ' + toFixedAS(alt, 1) + ' degrees.';
    }
  }

  // Initialise once the foundation helper (kl-unl.js) is ready. We redefine
  // klunlInitEqn (per the foundation convention) to boot the sim; there are no
  // displayed equations in this sim (see ACCESSIBILITY.md).
  function boot() { if (!window.altAzApp) window.altAzApp = new App(); }
  if (typeof window.klunlInitEqn === 'function') {
    window.klunlInitEqn = boot;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
