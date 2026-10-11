// The sentence machine. Ported from SentenceMachine.dc.html (desktop) and
// SentenceMachinePhone.dc.html (phone) without the DC runtime.
// All text measurement goes through Pretext: line wrapping, header fitting and
// where each typed character lands.
import { prepareWithSegments, measureNaturalWidth, layoutWithLines, clearCache } from '@chenglou/pretext';
import SENTENCES from '../data/sentences.json';
import MACHINE from '../data/machine.json';

const D = MACHINE.dials;
const MAP = MACHINE.map;
const COUNT = D.map((d) => d.opts.length);   // settings on each dial

// Paper geometry for each variant: side margin, text width, the paper below the first row (in the slot
// and peeking out of it), the ticket's left edge in the slot's lip, and where the carriage rests.
const VARIANTS = {
  desk: {
    W: 760, H: 553, PAD: 16, TW: 348, LO: 120, BASE: 18, SLOT: 14, PARK: 6, DRUM: 24,
    BODY: [680, 292, 4200, 0.5, 1130, 0.4],
    rows: { top: 24, num: 18, set: 22, gap: 12, line: 30, tail: 12 },
    num: ["500 10px/18px 'IBM Plex Mono', monospace", "500 10px 'IBM Plex Mono'", 2.2],
    set: [[9.5, 0.95], [9.5, 0.5], [9, 0.5], [9, 0]],
    line: ["italic 400 20px 'IBM Plex Serif'", "italic 400 20px/30px 'IBM Plex Serif', serif"],
    faces: ["italic 400 20px 'IBM Plex Serif'", "400 11px 'IBM Plex Mono'", "500 11px 'IBM Plex Mono'"],
    moveMin: 16, wheel: [68, 30], lead: 56, hint: [[11, 1.4], [10.5, 1.1], [10, 0.8], [9.5, 0.5]],
  },
  phone: {
    W: 358, H: 420, PAD: 16, TW: 248, LO: 90, BASE: 14, SLOT: 11, PARK: 5, DRUM: 20,
    BODY: [358, 210, 1600, 0.45, 450, 0.35],
    rows: { top: 18, num: 18, set: 20, gap: 8, line: 24, tail: 8 },
    num: ["500 9.5px/18px 'IBM Plex Mono', monospace", "500 9.5px 'IBM Plex Mono'", 1.1],
    set: [[9.5, 0.3], [9.5, 0.1], [9, 0.1], [9, 0]],
    line: ["italic 400 16px 'IBM Plex Serif'", "italic 400 16px/24px 'IBM Plex Serif', serif"],
    faces: ["italic 400 16px 'IBM Plex Serif'", "400 10px 'IBM Plex Mono'", "500 10px 'IBM Plex Mono'"],
    moveMin: 25, wheel: [52, 30], lead: 44, hint: [[10, 1], [10, 0.6], [9.5, 0.4], [9, 0]],
  },
};

// The drum dials: each setting sits on a drum of radius R, STEP degrees apart (VARIANTS wheel); the
// chosen one faces out between the rails. d is how many settings away from the rails a setting is
// (fractional while dragging). Keep in step with SentenceMachine.astro and SentenceMachinePhone.astro.
function wheelPose(d, [R, STEP]) {
  const th = d * STEP;
  const op = Math.abs(th) >= 90 ? 0 : Math.max(0, 1 - 0.3 * Math.abs(d));
  return ['translateZ(-' + R + 'px) rotateX(' + (-th).toFixed(2) + 'deg) translateZ(' + R + 'px)', op.toFixed(3)];
}
// How far a finger or mouse moves to roll a drum one setting: the distance between neighbours.
const wheelPitch = ([R, STEP]) => R * Math.sin(STEP * Math.PI / 180);

const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// iPhone Safari can scroll the page during a drum drag even though the drum's own handlers cancel
// the touch (its turned, 3D-transformed labels can drop out of the drum's no-scroll area). While a
// drum is being dragged, a page-level touchmove listener keeps the page still; lifting every finger
// always lets go of it, so the page can never be left unscrollable.
let touchDrag = null;
document.addEventListener('touchmove', (e) => { if (touchDrag) e.preventDefault(); }, { passive: false });
// When no fingers are left, a drag that never got its own touchend (Safari can drop it once it has
// started a scroll) is over: let it go, so the drum answers the next touch.
const letGo = (e) => {
  if (e.touches.length) return;
  if (touchDrag) touchDrag.drag = null;
  touchDrag = null;
};
document.addEventListener('touchend', letGo);
document.addEventListener('touchcancel', letGo);

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
    this.M = [];                        // rows on the ticket, top to bottom
    this.F = 0;                         // how far the paper still has to feed up (or has sunk back), px
    this.car = this.carT = this.V.PARK; // print carriage in the slot, x
    this.drag = null; this.q = []; this.cur = null; this.pending = null; this.rush = false; this.dragEnd = 0;
    this.lastJ = -1; this.lastSel = null;   // nothing printed until the first turn
    this.touched = false;
    // The invitation on the paper before the first turn.
    this.invite = root.dataset.invite || '';
    this.hint = root.dataset.hint || '';
    this.introOn = false; this.introDone = false; this.cursorRow = null; this.blink = false;
    this.lift = 0;                      // how far the invitation has been pulled up and away, 0 to 1
    this.rnd = makeRng(20260929);
    this.printing = false; this.ready = false; this.raf = 0; this.last = 0; this.timer = 0;

    this.feedEl = root.querySelector('[data-feed]');
    this.sheetEl = root.querySelector('[data-sheet]');
    this.carEl = root.querySelector('[data-car]');
    this.lampEl = root.querySelector('[data-lamp]');
    this.saidEl = root.querySelector('[data-said]');
    this.drums = [...root.querySelectorAll('[data-drum]')];
    this.dials = [...root.querySelectorAll('[data-dial]')].map((el, i) => {
      const ui = {
        knob: el.querySelector('[data-knob]'),
        items: [...el.querySelectorAll('[data-item]')],
        wpos: null,
      };
      ui.knob.addEventListener('pointerdown', (e) => this.pdown(i, e));
      ui.knob.addEventListener('pointermove', (e) => this.pmove(i, e));
      ui.knob.addEventListener('pointerup', (e) => this.pup(i, e));
      ui.knob.addEventListener('pointercancel', (e) => this.pup(i, e));
      ui.knob.addEventListener('lostpointercapture', (e) => this.pup(i, e));
      ui.knob.addEventListener('click', () => this.clickDial(i));
      ui.knob.addEventListener('keydown', (e) => this.keyDial(i, e));
      // Touch screens: drive the drum from touch events, which Safari keeps delivering while the
      // finger moves (pointer events can be cancelled there when the page decides to scroll).
      ui.knob.addEventListener('touchstart', (e) => this.tstart(i, e), { passive: false });
      ui.knob.addEventListener('touchmove', (e) => this.tmove(i, e), { passive: false });
      ui.knob.addEventListener('touchend', (e) => this.tend(i, e, false), { passive: false });
      ui.knob.addEventListener('touchcancel', (e) => this.tend(i, e, true), { passive: false });
      return ui;
    });
    this.tickFn = (t) => this.tick(t);

    this.speckle(root.querySelector('[data-speck]'));
    if (this.invite) this.startIntro();
    root.querySelectorAll('[data-paper]').forEach((cv, n) => this.grain(cv, n));
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
    // A turn made while the fonts were loading prints now.
    if (this.touched) this.commit();
    // The invitation was laid out before the fonts arrived: lay it out again with them.
    else if (this.introOn) { clearCache(); this.M = []; this.instantIntro(); this.render(); }
    // A face that finishes loading later changes the measurements: reprint the ticket in place.
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', () => {
        clearCache();
        if (this.cur || this.pending) return;
        if (this.introOn) { this.M = []; this.instantIntro(); this.render(); return; }
        if (this.lastJ < 0) return;
        this.M = [];
        this.instant(this.lastJ, this.lastSel);
        this.render();
      });
    }
  }

  // The first turn ends the invitation: the knobs and paper stop nudging and the ticket prints.
  touch() {
    if (this.touched) return;
    this.touched = true;
    this.root.classList.remove('waiting');
  }

  // ---- the invitation ----------------------------------------------------------

  // Until the first turn, the paper shows the invitation, already typed, with a blinking cursor.
  // The invitation, then a dashed rule and the instruction, with the cursor blinking after it.
  introProgram() {
    const steps = [], V = this.V;
    const feed = (row) => steps.push({ t: 'feed', row }), type = (row) => { row.intro = true; steps.push({ t: 'type', row }); };
    const lead = this.mk('top'); lead.h = V.lead;   // a lead of blank paper above the invitation
    feed(lead);
    this.wrap(this.invite).forEach((ln) => {
      const r = this.mk('line', ln);
      feed(r); type(r);
    });
    const rule = this.mk('gap'); rule.rule = true; rule.h = V.rows.gap + 2; feed(rule);
    const sp = this.mk('gap'); sp.h = V.rows.gap - 2; feed(sp);
    const hint = this.hint.toUpperCase(), f = this.fitMono(hint, '400', V.hint, V.TW - 4, 9);
    const h = this.mk('set', hint, f.px, f.ls); h.rule = false; h.col = '#5f594f'; feed(h); type(h);
    feed(this.mk('tail'));
    this.carriage(steps);
    return steps;
  }

  instantIntro() {
    this.introProgram().forEach((st) => { if (st.t === 'feed') this.M.push(st.row); else { st.row.k = st.row.n; this.cursorRow = st.row; } });
    this.F = 0; this.car = this.carT = this.V.PARK;
  }

  // The invitation is on the paper from the start, already typed, so a visitor who scrolls past
  // quickly or looks away can't miss it.
  startIntro() {
    if (this.touched || this.introDone || this.cur) return;
    this.introDone = true; this.introOn = true;
    this.root.classList.add('invited');
    this.instantIntro(); this.blink = true; this.render();
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

  mk(kind, text, px, ls, pace) {
    const V = this.V;
    const r = { kind, h: V.rows[kind], text: text || '', n: 0, k: 0, rule: false,
                font: this.kind === 'desk' ? "400 11px/20px 'IBM Plex Mono', monospace" : "400 10px/18px 'IBM Plex Mono', monospace", ls: '0px', col: '#1d1c1a', x0: 0, w: [0] };
    if (kind === 'num') {           // the ticket number on its own line
      r.font = V.num[0]; r.ls = V.num[2] + 'px'; r.col = '#5f594f';
      this.measure(r, V.num[1], V.num[2], 8);
    } else if (kind === 'set') {    // the setting under it, then a dashed rule
      r.rule = true; r.font = '400 ' + px + "px/16px 'IBM Plex Mono', monospace"; r.ls = ls + 'px'; r.col = '#7d7568';
      this.measure(r, '400 ' + px + "px 'IBM Plex Mono'", ls, 6);
    } else if (kind === 'line') {
      r.font = V.line[1];
      this.measure(r, V.line[0], 0, pace || 17);
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

  setting(sel) { return D[0].opts[sel[0]] + ' · ' + D[1].opts[sel[1]] + ' · ' + D[2].opts[sel[2]]; }

  // One ticket: a margin, the number, the setting, the sentence line by line, and a margin under it.
  program(j, sel) {
    const steps = [], V = this.V;
    const feed = (row) => { steps.push({ t: 'feed', row }); return row; };
    const type = (row) => { steps.push({ t: 'type', row }); };
    feed(this.mk('top'));
    const nr = this.mk('num', 'No. ' + String(j + 1).padStart(3, '0'));
    feed(nr); type(nr);
    const text = this.setting(sel);
    const f = this.fitMono(text, '400', V.set, V.TW - 4, 8.5);
    const sr = this.mk('set', text, f.px, f.ls);
    feed(sr); type(sr);
    feed(this.mk('gap'));
    this.wrap(SENTENCES[j]).forEach((ln) => { const r = this.mk('line', ln); feed(r); type(r); });
    feed(this.mk('tail'));
    this.carriage(steps);
    return steps;
  }

  // While the paper feeds, the carriage returns to where the next line starts.
  carriage(steps) {
    let nx = this.V.PARK;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].t === 'type') nx = this.V.SLOT + steps[i].row.x0 - 2; else steps[i].cr = nx;
    }
  }

  instant(j, sel) {
    this.program(j, sel).forEach((st) => { if (st.t === 'feed') this.M.push(st.row); else st.row.k = st.row.n; });
    this.F = 0; this.car = this.carT = this.V.PARK;
  }

  // The printed part of the ticket, px.
  printed() { return this.M.reduce((a, r) => a + r.h, 0); }

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
    this.lastJ = p.j; this.lastSel = p.sel;
    this.saidEl.textContent = this.phrase(p.j);
    if (reduced) { this.endIntro(); this.M = []; this.instant(p.j, p.sel); this.printing = false; this.render(); return; }
    this.q = this.program(p.j, p.sel);
    // The invitation is pulled up and away; a ticket already out sinks back into the slot.
    if (this.M.length) this.q.unshift({ t: this.introOn ? 'eject' : 'sink' });
    this.cur = this.q.shift();
    this.printing = true;
    this.kick();
  }

  endIntro() { this.introOn = false; this.cursorRow = null; this.blink = false; this.lift = 0; }

  kick() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tickFn); } }

  tick(now) {
    this.raf = 0;
    const dt = this.last ? Math.min(48, now - this.last) : 16;
    this.last = now;
    let budget = dt * (this.rush ? 7 : 1);
    while (budget > 0 && this.cur) {
      const st = this.cur;
      if (st.t === 'eject') {
        if (st.el == null) { st.el = 0; st.dur = 480; this.cursorRow = null; }
        const ue = Math.min(budget, st.dur - st.el); st.el += ue; budget -= ue;
        const u = Math.min(1, st.el / st.dur);
        this.lift = u * u;
        if (u >= 1) { this.M = []; this.F = 0; this.endIntro(); this.cur = this.q.shift() || null; }
      } else if (st.t === 'sink') {
        if (st.el == null) { st.el = 0; st.to = this.printed(); st.from = this.F; st.dur = 260 + st.to * 0.6; }
        const u0 = Math.min(budget, st.dur - st.el); st.el += u0; budget -= u0;
        const u = Math.min(1, st.el / st.dur);
        this.F = st.from + (st.to - st.from) * u * u;
        if (u >= 1) { this.M = []; this.F = 0; this.cur = this.q.shift() || null; }
      } else if (st.t === 'feed') {
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
        if (st.el == null) { st.el = 0; if (r.intro) { this.cursorRow = r; this.blink = false; } }
        const u2 = Math.min(budget, r.total - st.el); st.el += u2; budget -= u2;
        while (r.k < r.n && r.ts[r.k] <= st.el) r.k++;
        this.carT = this.V.SLOT + r.x0 + r.w[r.k] - 2;
        if (st.el >= r.total) { r.k = r.n; this.cur = this.q.shift() || null; }
      }
    }
    if (!this.cur) {
      if (this.pending) this.start();
      else if (this.printing) { this.carT = this.V.PARK; this.printing = false; if (this.introOn) this.blink = true; }
    }
    const a = 1 - Math.exp(-dt / 30);
    this.car += (this.carT - this.car) * a;
    if (Math.abs(this.carT - this.car) < 0.25) this.car = this.carT;
    this.render();
    if (this.cur || this.car !== this.carT) this.kick();
  }

  // ---- the dials ---------------------------------------------------------------

  choose(i, k, delay) {
    this.touch();
    this.sel = this.sel.slice(); this.sel[i] = k;
    this.render();
    this.schedule(delay);
  }

  // Each dial is one button. Down or right rolls the drum to the next setting.
  keyDial(i, e) {
    const n = COUNT[i], t = this.sel[i];
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
  }

  clickDial(i) {
    if (performance.now() - this.dragEnd < 350) return;   // the click that ends a drag
    this.choose(i, (this.sel[i] + 1) % COUNT[i], 420);
  }

  // ---- touch -------------------------------------------------------------------

  tstart(i, e) {
    // A new touch starts fresh: any drag still open here has lost its touchend.
    if (e.touches.length > 1) return;
    this.drag = null;
    // Safari has already decided to scroll the page: leave it to the page. A tap still arrives as a click.
    if (!e.cancelable) return;
    e.preventDefault();                  // no page scroll, no synthetic click: the drum handles it
    const t = e.changedTouches[0];
    this.touch();
    this.drag = { i, id: 't' + t.identifier, x0: t.clientX, y0: t.clientY, moved: false, pos0: this.sel[i], pos: this.sel[i] };
    touchDrag = this;
    clearTimeout(this.timer);
    this.render();
  }

  tmove(i, e) {
    const d = this.drag;
    if (!d || d.i !== i) return;
    const t = [...e.changedTouches].find((x) => 't' + x.identifier === d.id);
    if (!t) return;
    // The page took over the scroll after all: let go and put the drum back, so only one thing moves.
    if (!e.cancelable) {
      this.drag = null;
      if (touchDrag === this) touchDrag = null;
      this.sel = this.sel.slice(); this.sel[i] = d.pos0;
      this.render();
      return;
    }
    e.preventDefault();
    this.roll(i, d, t.clientX, t.clientY, e.currentTarget);
  }

  tend(i, e, cancelled) {
    const d = this.drag;
    if (!d || d.i !== i || ![...e.changedTouches].some((x) => 't' + x.identifier === d.id)) return;
    e.preventDefault();
    this.drag = null;
    if (touchDrag === this) touchDrag = null;
    if (d.moved) { this.dragEnd = performance.now(); this.schedule(160); this.render(); }
    else if (!cancelled) this.choose(i, (this.sel[i] + 1) % COUNT[i], 420);   // a tap: next setting
    else this.render();
  }

  // The drum follows the finger: dragging up brings the next setting into the window. Past the first
  // and last settings it gives a little.
  roll(i, d, x, y, el) {
    const dx = x - d.x0, dy = y - d.y0;
    if (!d.moved && dx * dx + dy * dy < this.V.moveMin) return;
    d.moved = true;
    const last = COUNT[i] - 1;
    // The machine may be scaled down to fit a narrow screen; the drum moves in its own pixels.
    const scale = el.getBoundingClientRect().height / el.offsetHeight || 1;
    let pos = d.pos0 - dy / scale / wheelPitch(this.V.wheel);
    if (pos < 0) pos *= 0.3; else if (pos > last) pos = last + (pos - last) * 0.3;
    d.pos = pos;
    const k = Math.max(0, Math.min(last, Math.round(pos)));
    if (k !== this.sel[i]) { this.sel = this.sel.slice(); this.sel[i] = k; }
    this.render();
  }

  // ---- mouse and pen -------------------------------------------------------------

  pdown(i, e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'touch') return;   // touch events handle it
    e.preventDefault();
    this.touch();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* not capturable */ }
    this.drag = { i, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, pos0: this.sel[i], pos: this.sel[i] };
    clearTimeout(this.timer);
    this.render();
  }

  pmove(i, e) {
    const d = this.drag;
    if (!d || d.i !== i || e.pointerId !== d.id) return;
    this.roll(i, d, e.clientX, e.clientY, e.currentTarget);
  }

  pup(i, e) {
    const d = this.drag;
    if (!d || d.i !== i || e.pointerType === 'touch') return;
    this.drag = null;
    // A press without a drag is a click, which the button's click handler turns into the next setting.
    if (d.moved) { this.dragEnd = performance.now(); this.schedule(160); }
    this.render();
  }

  // ---- drawing -----------------------------------------------------------------

  render() {
    const s = this.sel, drag = this.drag;
    this.dials.forEach((ui, i) => {
      const k = s[i], live = !!(drag && drag.i === i);
      ui.knob.classList.toggle('live', live && drag.moved);
      const pos = live && drag.moved ? drag.pos : k;
      if (ui.items.length && ui.wpos !== pos) {
        ui.wpos = pos;
        ui.items.forEach((it, n) => {
          const [tf, op] = wheelPose(n - pos, this.V.wheel);
          it.style.transform = tf; it.style.opacity = op;
          it.classList.toggle('on', n === k);
        });
        const v = D[i].opts[k];
        ui.knob.setAttribute('aria-label', D[i].name + ': ' + v.charAt(0) + v.slice(1).toLowerCase());
      }
    });
    const num = this.touched ? this.j(s) + 1 : 0, dg = [Math.floor(num / 100), Math.floor(num / 10) % 10, num % 10];
    this.drums.forEach((col, t) => { col.style.transform = 'translateY(' + (-dg[t] * this.V.DRUM) + 'px)'; });

    // Paper rows: one element per row; rows only ever join at the bottom and leave from the top.
    const els = this.M.map((r) => {
      if (!r.el) {
        const el = document.createElement('div');
        el.className = 'sm-row';
        el.style.height = r.h + 'px'; el.style.font = r.font; el.style.letterSpacing = r.ls; el.style.color = r.col;
        r.ink = document.createElement('span'); r.gh = document.createElement('span'); r.gh.className = 'ghostink';
        el.append(r.ink, r.gh);
        if (r.intro) { r.cur = document.createElement('span'); r.cur.className = 'sm-cursor'; r.cur.hidden = true; el.insertBefore(r.cur, r.gh); }
        if (r.rule) { const ru = document.createElement('span'); ru.className = 'rule'; el.append(ru); }
        r.el = el; r.shown = -1;
      }
      if (r.shown !== r.k) { r.ink.textContent = r.text.slice(0, r.k); r.gh.textContent = r.text.slice(r.k); r.shown = r.k; }
      if (r.cur) {
        const on = r === this.cursorRow;
        if (r.cur.hidden === on) r.cur.hidden = !on;
        r.cur.classList.toggle('blink', on && this.blink);
      }
      return r.el;
    });
    const kids = this.feedEl.children;
    let same = kids.length === els.length;
    for (let n = 0; same && n < els.length; n++) if (kids[n] !== els[n]) same = false;
    if (!same) this.feedEl.replaceChildren(...els);
    this.feedEl.style.transform = 'translateY(' + this.F.toFixed(2) + 'px)';
    this.sheetEl.style.height = (this.V.BASE + Math.max(0, this.printed() - this.F)).toFixed(2) + 'px';
    this.sheetEl.style.transform = this.lift ? 'translateY(' + (-70 * this.lift).toFixed(2) + 'px)' : '';
    this.sheetEl.style.opacity = this.lift ? (1 - this.lift).toFixed(3) : '';
    this.carEl.style.transform = 'translateX(' + this.car.toFixed(2) + 'px)';
    this.lampEl.classList.toggle('on', this.printing);
  }

  // Paper grain on the drums: fine fibres and flecks, drawn once.
  grain(cv, n) {
    const W = cv.offsetWidth, H = cv.offsetHeight;
    if (!W || !H) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1), rnd = makeRng(31 + n);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    if (!g) return;
    g.scale(dpr, dpr);
    for (let i = 0; i < W * H * 0.05; i++) {
      g.fillStyle = 'rgba(96,74,48,' + (0.04 + rnd() * 0.08).toFixed(3) + ')';
      g.fillRect(rnd() * W, rnd() * H, 0.4 + rnd() * 0.5, 0.4 + rnd() * 0.5);
    }
    for (let i = 0; i < W * H * 0.004; i++) {   // short fibres
      g.strokeStyle = 'rgba(96,74,48,' + (0.05 + rnd() * 0.07).toFixed(3) + ')'; g.lineWidth = 0.4;
      const x = rnd() * W, y = rnd() * H, a = rnd() * 6.28, l = 1.5 + rnd() * 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < W * H * 0.02; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.3 + rnd() * 0.4).toFixed(3) + ')';
      g.fillRect(rnd() * W, rnd() * H, 0.5, 0.5);
    }
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
