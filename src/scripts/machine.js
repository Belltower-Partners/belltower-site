// The sentence machine. Ported from SentenceMachine.dc.html (desktop) and
// SentenceMachinePhone.dc.html (phone) without the DC runtime.
// All text measurement goes through Pretext: line wrapping, header fitting and
// where each typed character lands.
import { prepareWithSegments, measureNaturalWidth, layoutWithLines, clearCache } from '@chenglou/pretext';
import SENTENCES from '../data/sentences.json';
import MACHINE from '../data/machine.json';

const D = MACHINE.dials;
const MAP = MACHINE.map;
// Detents: the index line's rotation from twelve o'clock, in degrees.
const ANG = D.map((d) => {
  const n = d.opts.length, step = n === 3 ? 45 : 36;
  return d.opts.map((_, k) => (k - (n - 1) / 2) * step);
});

// Paper geometry for each variant: tape width, side margin, visible height, carriage offset in the slot.
const VARIANTS = {
  desk: {
    W: 760, H: 700, PAD: 26, TW: 348, LO: 120, VIEW: 236, KEEP: 24, SLOT: 12, PARK: 32, DRUM: 24,
    BODY: [680, 362, 5200, 0.5, 1400, 0.4],
    rows: { tear: 34, head: 28, gap: 8, line: 30, tail: 22 },
    line: ["italic 400 20px 'IBM Plex Serif'", "italic 400 20px/30px 'IBM Plex Serif', serif"],
    faces: ["italic 400 20px 'IBM Plex Serif'", "400 11px 'IBM Plex Mono'", "500 11px 'IBM Plex Mono'"],
    moveMin: 16, nearMin: 100,
  },
  phone: {
    W: 358, H: 470, PAD: 16, TW: 248, LO: 90, VIEW: 196, KEEP: 20, SLOT: 10, PARK: 22, DRUM: 20,
    BODY: [358, 210, 1600, 0.45, 450, 0.35],
    rows: { tear: 26, num: 18, set: 20, gap: 6, line: 24, tail: 16 },
    line: ["italic 400 16px 'IBM Plex Serif'", "italic 400 16px/24px 'IBM Plex Serif', serif"],
    faces: ["italic 400 16px 'IBM Plex Serif'", "400 10px 'IBM Plex Mono'", "500 10px 'IBM Plex Mono'"],
    moveMin: 25, nearMin: 64,
  },
};

const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// ---- measuring with Pretext ----------------------------------------------------

function natural(text, font, ls) {
  if (!text) return 0;
  return measureNaturalWidth(prepareWithSegments(text, font, ls ? { letterSpacing: ls } : undefined));
}
// Natural width drops trailing spaces; the carriage still has to move past them.
function prefixWidth(text, font, ls) {
  const core = text.replace(/ +$/, '');
  const spaces = text.length - core.length;
  if (!spaces) return natural(text, font, ls);
  const sp = natural('x x', font, ls) - natural('xx', font, ls);
  return natural(core, font, ls) + spaces * sp;
}

function makeRng(seed) {
  return function () {
    let t = (seed = (seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Machine {
  constructor(root) {
    this.root = root;
    this.kind = root.dataset.machine;
    this.V = VARIANTS[this.kind];
    this.sel = [1, 0, 1];
    this.M = [];                        // rows on the paper, top to bottom
    this.F = 0;                         // how far the paper still has to feed up, px
    this.car = this.carT = this.V.PARK; // print carriage in the slot, x
    this.drag = null; this.q = []; this.cur = null; this.pending = null; this.rush = false; this.dragEnd = 0;
    this.lastJ = this.j(this.sel); this.lastSel = this.sel.slice(); this.prev = null;
    this.rnd = makeRng(20260929);
    this.printing = false; this.ready = false; this.raf = 0; this.last = 0; this.timer = 0;

    this.feedEl = root.querySelector('[data-feed]');
    this.carEl = root.querySelector('[data-car]');
    this.lampEl = root.querySelector('[data-lamp]');
    this.saidEl = root.querySelector('[data-said]');
    this.drums = [...root.querySelectorAll('[data-drum]')];
    this.dials = [...root.querySelectorAll('[data-dial]')].map((el, i) => {
      const ui = {
        knob: el.querySelector('[data-knob]'),
        rotor: el.querySelector('[data-rotor]'),
        ticks: [...el.querySelectorAll('[data-tick]')],
        opts: [...el.querySelectorAll('[data-opt]')],
        value: el.querySelector('[data-value]'),
      };
      ui.knob.addEventListener('pointerdown', (e) => this.pdown(i, e));
      ui.knob.addEventListener('pointermove', (e) => this.pmove(i, e));
      ui.knob.addEventListener('pointerup', (e) => this.pup(i, e, false));
      ui.knob.addEventListener('pointercancel', (e) => this.pup(i, e, true));
      ui.knob.addEventListener('lostpointercapture', (e) => this.pup(i, e, true));
      if (this.kind === 'desk') {
        ui.opts.forEach((b, t) => {
          b.addEventListener('click', () => this.choose(i, t, 380));
          b.addEventListener('keydown', (e) => this.keyOpt(i, t, e));
        });
      } else {
        ui.knob.addEventListener('click', () => this.clickDial(i));
        ui.knob.addEventListener('keydown', (e) => this.keyDial(i, e));
      }
      return ui;
    });
    this.tickFn = (t) => this.tick(t);

    this.speckle(root.querySelector('[data-speck]'));
    this.render();

    const go = () => { if (this.ready) return; this.ready = true; this.boot(); };
    const fs = document.fonts;
    if (fs && fs.load) {
      Promise.all(this.V.faces.map((f) => fs.load(f).catch(() => {})))
        .then(() => fs.ready).then(go, go);
      setTimeout(go, 2500);
    } else go();
  }

  j(s) { return MAP[s[0]][s[1]][s[2]]; }
  phrase(j) { return 'No. ' + (j + 1) + '. ' + SENTENCES[j]; }

  boot() {
    // The paper starts with the end of an earlier ticket above the current one.
    const ps = this.lastJ === MAP[0][0][1] ? [2, 4, 2] : [0, 0, 1];
    this.prev = { j: this.j(ps), sel: ps };
    this.instant(this.prev.j, this.prev.sel);
    this.instant(this.lastJ, this.lastSel);
    this.saidEl.textContent = this.phrase(this.lastJ);
    this.render();
    // A face that finishes loading later changes the measurements: reset the paper to the last tickets.
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', () => {
        clearCache();
        if (this.cur || this.pending) return;
        this.M = [];
        if (this.prev) this.instant(this.prev.j, this.prev.sel);
        this.instant(this.lastJ, this.lastSel);
        this.render();
      });
    }
  }

  // ---- the paper ---------------------------------------------------------------

  // Balanced lines: the fewest lines greedy wrapping allows, as even in length as they can be.
  wrap(text) {
    const V = this.V, prep = prepareWithSegments(text, V.line[0]);
    const lines = (w) => layoutWithLines(prep, w, 1).lines.map((l) => l.text.trim()).filter(Boolean);
    const base = lines(V.TW), n = base.length;
    if (n < 2) return base;
    let lo = V.LO, hi = V.TW;
    for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (lines(mid).length <= n) hi = mid; else lo = mid; }
    return lines(hi);
  }

  // The largest type and spacing at which a mono line still fits the tape.
  fitMono(text, weight, tries, max, fallback) {
    for (const [px, ls] of tries) {
      if (natural(text, weight + ' ' + px + "px 'IBM Plex Mono'", 0) + ls * text.length <= max) return { px, ls };
    }
    return { px: fallback, ls: 0 };
  }

  mk(kind, text, px, ls) {
    const V = this.V;
    const r = { kind, h: V.rows[kind], text: text || '', n: 0, k: 0, rule: false, tear: kind === 'tear',
                font: this.kind === 'desk' ? "400 11px/20px 'IBM Plex Mono', monospace" : "400 10px/18px 'IBM Plex Mono', monospace", ls: '0px', col: '#1d1c1a', x0: 0, w: [0] };
    if (kind === 'head') {          // desktop: number and setting on one line
      r.rule = true; r.font = '500 ' + px + "px/24px 'IBM Plex Mono', monospace"; r.ls = ls + 'px'; r.col = '#6f685e';
      this.measure(r, '500 ' + px + "px 'IBM Plex Mono'", ls, 6);
    } else if (kind === 'num') {    // phone: the number on its own line
      r.font = "500 9.5px/18px 'IBM Plex Mono', monospace"; r.ls = '1.1px'; r.col = '#6f685e';
      this.measure(r, "500 9.5px 'IBM Plex Mono'", 1.1, 8);
    } else if (kind === 'set') {    // phone: the setting under it
      r.rule = true; r.font = '400 ' + px + "px/16px 'IBM Plex Mono', monospace"; r.ls = ls + 'px'; r.col = '#6f685e';
      this.measure(r, '400 ' + px + "px 'IBM Plex Mono'", ls, 6);
    } else if (kind === 'line') {
      r.font = V.line[1];
      this.measure(r, V.line[0], 0, 17);
    }
    return r;
  }

  // Where each character lands, and when it is struck.
  measure(r, font, ls, base) {
    const t = r.text;
    let tm = 0;
    r.n = t.length; r.w = [0]; r.ts = [];
    for (let i = 1; i <= t.length; i++) r.w.push(prefixWidth(t.slice(0, i), font, 0) + ls * i);
    r.x0 = this.V.PAD + (this.V.TW - r.w[r.n]) / 2;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i], prev = i ? t[i - 1] : '';
      tm += base * (0.6 + 0.8 * this.rnd());
      if (ch === ' ') tm += base * 0.5;
      if (prev === ',' || prev === ';' || prev === ':') tm += 110;
      r.ts.push(tm);
    }
    r.total = tm + base * 3;
  }

  setting(sel) { return D[0].opts[sel[0]] + ' × ' + D[1].opts[sel[1]] + ' × ' + D[2].opts[sel[2]]; }

  // One ticket: a tear line, the header, the sentence line by line, and a margin under it.
  program(j, sel) {
    const steps = [], V = this.V;
    const feed = (row) => { steps.push({ t: 'feed', row }); return row; };
    const type = (row) => { steps.push({ t: 'type', row }); };
    if (this.M.length) feed(this.mk('tear'));
    const no = 'No. ' + String(j + 1).padStart(3, '0');
    if (this.kind === 'desk') {
      const text = no + ' · ' + this.setting(sel);
      const f = this.fitMono(text, '500', [[10.5, 0.42], [10.5, 0.2], [10, 0.2], [10, 0]], 342, 9.5);
      const hr = this.mk('head', text, f.px, f.ls);
      feed(hr); type(hr);
    } else {
      const nr = this.mk('num', no);
      feed(nr); type(nr);
      const text = this.setting(sel);
      const f = this.fitMono(text, '400', [[9.5, 0.3], [9.5, 0.1], [9, 0.1], [9, 0]], V.TW - 4, 8.5);
      const sr = this.mk('set', text, f.px, f.ls);
      feed(sr); type(sr);
    }
    feed(this.mk('gap'));
    this.wrap(SENTENCES[j]).forEach((ln) => { const r = this.mk('line', ln); feed(r); type(r); });
    feed(this.mk('tail'));
    // While the paper feeds, the carriage returns to where the next line starts.
    let nx = V.PARK;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].t === 'type') nx = V.SLOT + steps[i].row.x0 - 2; else steps[i].cr = nx;
    }
    return steps;
  }

  instant(j, sel) {
    this.program(j, sel).forEach((st) => { if (st.t === 'feed') this.M.push(st.row); else st.row.k = st.row.n; });
    this.F = 0; this.car = this.carT = this.V.PARK;
    this.prune();
  }

  // Drop rows that have gone up under the roll.
  prune() {
    let acc = 0, keep = 0;
    for (let i = this.M.length - 1; i >= 0; i--) {
      if (acc > this.V.VIEW + this.V.KEEP) { keep = i + 1; break; }
      acc += this.M[i].h;
    }
    if (keep > 0) this.M.splice(0, keep);
  }

  // ---- printing ----------------------------------------------------------------

  schedule(ms) { clearTimeout(this.timer); this.timer = setTimeout(() => this.commit(), ms); }

  commit() {
    if (!this.ready || this.drag) return;
    const s = this.sel, j = this.j(s);
    if (this.cur) {
      // Mid-print: finish this ticket quickly, then print the new one.
      if (j === this.lastJ) { this.pending = null; this.rush = false; }
      else { this.pending = { j, sel: s.slice() }; this.rush = true; }
      return;
    }
    if (j === this.lastJ) return;
    this.pending = { j, sel: s.slice() };
    this.start();
  }

  start() {
    const p = this.pending;
    this.pending = null; this.rush = false;
    if (!p) return;
    this.prev = { j: this.lastJ, sel: this.lastSel };
    this.lastJ = p.j; this.lastSel = p.sel;
    this.saidEl.textContent = this.phrase(p.j);
    if (reduced) { this.instant(p.j, p.sel); this.printing = false; this.render(); return; }
    this.q = this.program(p.j, p.sel);
    this.cur = this.q.shift();
    this.printing = true;
    this.kick();
  }

  kick() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tickFn); } }

  tick(now) {
    this.raf = 0;
    const dt = this.last ? Math.min(48, now - this.last) : 16;
    this.last = now;
    let budget = dt * (this.rush ? 7 : 1);
    while (budget > 0 && this.cur) {
      const st = this.cur;
      if (st.t === 'feed') {
        if (st.el == null) {
          st.el = 0; this.M.push(st.row); this.F += st.row.h; st.from = this.F; st.dur = 70 + st.row.h * 3.6;
          if (st.cr != null) this.carT = st.cr;
        }
        const u1 = Math.min(budget, st.dur - st.el); st.el += u1; budget -= u1;
        const u = Math.min(1, st.el / st.dur), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        this.F = st.from * (1 - e);
        if (u >= 1) { this.F = 0; this.cur = this.q.shift() || null; }
      } else {
        const r = st.row;
        if (st.el == null) st.el = 0;
        const u2 = Math.min(budget, r.total - st.el); st.el += u2; budget -= u2;
        while (r.k < r.n && r.ts[r.k] <= st.el) r.k++;
        this.carT = this.V.SLOT + r.x0 + r.w[r.k] - 2;
        if (st.el >= r.total) { r.k = r.n; this.cur = this.q.shift() || null; }
      }
    }
    if (!this.cur) {
      if (this.pending) { this.prune(); this.start(); }
      else if (this.printing) { this.prune(); this.carT = this.V.PARK; this.printing = false; }
    }
    const a = 1 - Math.exp(-dt / 30);
    this.car += (this.carT - this.car) * a;
    if (Math.abs(this.carT - this.car) < 0.25) this.car = this.carT;
    this.render();
    if (this.cur || this.car !== this.carT) this.kick();
  }

  // ---- the dials ---------------------------------------------------------------

  choose(i, k, delay) {
    this.sel = this.sel.slice(); this.sel[i] = k;
    this.render();
    this.schedule(delay);
  }

  // Desktop: arrow keys move through a dial's settings, like any radio group.
  keyOpt(i, t, e) {
    const n = ANG[i].length;
    let k;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': k = (t + 1) % n; break;
      case 'ArrowLeft': case 'ArrowUp': k = (t + n - 1) % n; break;
      case 'Home': k = 0; break;
      case 'End': k = n - 1; break;
      default: return;
    }
    e.preventDefault();
    this.choose(i, k, 420);
    this.dials[i].opts[k].focus();
  }

  // Phone: each dial is one button. Up or right turns it clockwise.
  keyDial(i, e) {
    const n = ANG[i].length, t = this.sel[i];
    let k;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowUp': k = (t + 1) % n; break;
      case 'ArrowLeft': case 'ArrowDown': k = (t + n - 1) % n; break;
      case 'Home': k = 0; break;
      case 'End': k = n - 1; break;
      default: return;
    }
    e.preventDefault();
    this.choose(i, k, 420);
  }

  clickDial(i) {
    if (performance.now() - this.dragEnd < 350) return;   // the click that ends a drag
    this.choose(i, (this.sel[i] + 1) % ANG[i].length, 420);
  }

  pdown(i, e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget, rc = el.getBoundingClientRect();
    try { el.setPointerCapture(e.pointerId); } catch (x) { /* not capturable */ }
    const cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2, rot = ANG[i][this.sel[i]];
    this.drag = { i, id: e.pointerId, cx, cy, x0: e.clientX, y0: e.clientY,
                  pa: Math.atan2(e.clientY - cy, e.clientX - cx) * 57.29578, raw: rot, disp: rot, moved: false };
    clearTimeout(this.timer);
    this.render();
  }

  pmove(i, e) {
    const d = this.drag;
    if (!d || d.i !== i || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved && dx * dx + dy * dy < this.V.moveMin) return;
    d.moved = true;
    const rx = e.clientX - d.cx, ry = e.clientY - d.cy, a = Math.atan2(ry, rx) * 57.29578;
    let da = a - d.pa;
    if (da > 180) da -= 360; else if (da < -180) da += 360;
    d.pa = a;
    if (rx * rx + ry * ry < this.V.nearMin) return;     // too near the centre to read an angle
    const A = ANG[i], lo = A[0], hi = A[A.length - 1];
    let k = 0;
    d.raw = Math.max(lo - 30, Math.min(hi + 30, d.raw + da));
    for (let t = 1; t < A.length; t++) if (Math.abs(A[t] - d.raw) < Math.abs(A[k] - d.raw)) k = t;
    // Past the end stops the knob gives a little; between detents it is drawn toward the nearest one.
    d.disp = d.raw < lo ? lo + (d.raw - lo) * 0.3 : d.raw > hi ? hi + (d.raw - hi) * 0.3 : d.raw + (A[k] - d.raw) * 0.35;
    if (k !== this.sel[i]) { this.sel = this.sel.slice(); this.sel[i] = k; }
    this.render();
  }

  pup(i, _e, cancelled) {
    const d = this.drag;
    if (!d || d.i !== i) return;
    this.drag = null;
    if (this.kind === 'desk') {
      // Desktop: a press without a turn steps the dial to its next setting.
      if (!d.moved && !cancelled) this.choose(i, (this.sel[i] + 1) % ANG[i].length, 420);
      else { this.render(); this.schedule(160); }
    } else {
      // Phone: the button's click handles a tap.
      if (d.moved) { this.dragEnd = performance.now(); this.schedule(160); }
      this.render();
    }
  }

  // ---- drawing -----------------------------------------------------------------

  render() {
    const s = this.sel, drag = this.drag;
    this.dials.forEach((ui, i) => {
      const k = s[i], live = !!(drag && drag.i === i);
      ui.rotor.classList.toggle('live', live);
      ui.knob.classList.toggle('live', live);
      ui.rotor.style.transform = 'rotate(' + (live ? drag.disp : ANG[i][k]).toFixed(2) + 'deg)';
      ui.ticks.forEach((t, n) => t.classList.toggle('on', n === k));
      ui.opts.forEach((b, n) => { b.setAttribute('aria-checked', n === k ? 'true' : 'false'); b.tabIndex = n === k ? 0 : -1; });
      if (ui.value) {
        const v = D[i].opts[k];
        if (ui.value.textContent !== v) ui.value.textContent = v;
        ui.knob.setAttribute('aria-label', D[i].name + ': ' + v.charAt(0) + v.slice(1).toLowerCase());
      }
    });
    const num = this.j(s) + 1, dg = [Math.floor(num / 100), Math.floor(num / 10) % 10, num % 10];
    this.drums.forEach((col, t) => { col.style.transform = 'translateY(' + (-dg[t] * this.V.DRUM) + 'px)'; });

    // Paper rows: one element per row; rows only ever join at the bottom and leave from the top.
    const els = this.M.map((r) => {
      if (!r.el) {
        const el = document.createElement('div');
        el.className = 'sm-row';
        el.style.height = r.h + 'px'; el.style.font = r.font; el.style.letterSpacing = r.ls; el.style.color = r.col;
        r.ink = document.createElement('span'); r.gh = document.createElement('span'); r.gh.className = 'ghostink';
        el.append(r.ink, r.gh);
        if (r.rule) { const ru = document.createElement('span'); ru.className = 'rule'; el.append(ru); }
        if (r.tear) { const te = document.createElement('span'); te.className = 'tear'; el.append(te); }
        r.el = el; r.shown = -1;
      }
      if (r.shown !== r.k) { r.ink.textContent = r.text.slice(0, r.k); r.gh.textContent = r.text.slice(r.k); r.shown = r.k; }
      return r.el;
    });
    const kids = this.feedEl.children;
    let same = kids.length === els.length;
    for (let n = 0; same && n < els.length; n++) if (kids[n] !== els[n]) same = false;
    if (!same) this.feedEl.replaceChildren(...els);
    this.feedEl.style.transform = 'translateY(' + this.F.toFixed(2) + 'px)';
    this.carEl.style.transform = 'translateX(' + this.car.toFixed(2) + 'px)';
    this.lampEl.classList.toggle('on', this.printing);
  }

  // Enamel grain for the body, drawn once.
  speckle(cv) {
    if (!cv) return;
    const [W, H, dark, darkR, light, lightR] = this.V.BODY;
    const dpr = Math.min(2, window.devicePixelRatio || 1), rnd = makeRng(7);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    if (!g) return;
    g.scale(dpr, dpr);
    for (let i = 0; i < dark; i++) {
      g.fillStyle = 'rgba(96,74,48,' + (0.05 + rnd() * 0.11).toFixed(3) + ')';
      g.beginPath(); g.arc(rnd() * W, rnd() * H, 0.3 + rnd() * darkR, 0, 6.2832); g.fill();
    }
    for (let i = 0; i < light; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.25 + rnd() * 0.35).toFixed(3) + ')';
      g.beginPath(); g.arc(rnd() * W, rnd() * H, 0.3 + rnd() * lightR, 0, 6.2832); g.fill();
    }
  }
}

// Each machine is a fixed-size object. If its column is narrower, scale it to fit.
function fit(box) {
  const sm = box.firstElementChild;
  const W = Number(box.dataset.w), H = Number(box.dataset.h);
  const update = () => {
    const w = box.clientWidth;
    if (!w) return;                       // hidden at this width
    const s = Math.min(1, w / W);
    sm.style.transform = s < 1 ? 'scale(' + s + ')' : '';
    box.style.height = H * s + 'px';
  };
  update();
  if (window.ResizeObserver) new ResizeObserver(update).observe(box);
}

document.querySelectorAll('[data-machine]').forEach((root) => new Machine(root));
document.querySelectorAll('[data-fit]').forEach(fit);
