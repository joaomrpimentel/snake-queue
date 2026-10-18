/* =========================================================
   SNAKE QUEUE
   every task is a piece of the snake. the one touching the
   head is next. click a piece to finish it (the snake eats
   it and you score), double click to edit, ctrl+z to take
   the last thing back. on a phone: tap to read, tap again
   to finish, hold to edit, undo from the message. the
   handheld around the screen is optional.
   ========================================================= */

const $ = (id) => document.getElementById(id);
const taskForm = $("task-form");
const taskInput = $("task-input");
const snakeGrid = $("snake-grid");
const readoutLabel = $("readout-label");
const readoutText = $("readout-text");
const readoutEdit = $("readout-edit");
const muteButton = $("mute-button");

/* ---------------------------------------------------------
   storage: private windows and full disks throw, so every
   read and write goes through here and fails quietly
   --------------------------------------------------------- */
const store = {
  get(key, fallback = null) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* fine */ }
  },
  json(key, fallback) {
    try { return JSON.parse(store.get(key)) ?? fallback; } catch { return fallback; }
  },
};

let tasks = store.json("snakeTasks", []);
if (!Array.isArray(tasks)) tasks = [];
tasks = tasks.filter((t) => typeof t === "string" && t.trim());

// what the snake ate: [{ t: text, at: timestamp }], newest last
let eaten = store.json("snakeEaten", []);
if (!Array.isArray(eaten)) eaten = [];
let best = Number(store.get("snakeBest")) || tasks.length;

function save() {
  store.set("snakeTasks", JSON.stringify(tasks));
  store.set("snakeEaten", JSON.stringify(eaten.slice(-200)));
  best = Math.max(best, tasks.length);
  store.set("snakeBest", best);
}

/* ---------------------------------------------------------
   portuguese / english. shares the key with jotaverse.com.br,
   so the language you picked there carries over here
   --------------------------------------------------------- */
const EN = {
  tagline: "TO-DO LIST · EVERY TASK IS A PIECE OF THE SNAKE",
  by: "A JOTAVERSE PROJECT ↗", sound: "Sound", "lang-group": "Language",
  "scheme-group": "Theme", "scheme-auto": "Automatic (follows your device)", "scheme-light": "Light", "scheme-dark": "Dark",
  "new-task": "new task", placeholder: "what do you need to do?", add: "add",
  "edit-task": "Edit task", how: "how to use",
  s1: "Type a task and press Enter: the snake grows a piece.<span class=\"pc\"> <kbd>/</kbd> jumps back to the input.</span>",
  s2: "<span class=\"pc\">Hover a piece to read its task. With a piece focused, the arrow keys move along the queue.</span><span class=\"touch\">Tap a piece to read its task.</span>",
  s3: "<span class=\"pc\">Click a piece to finish it. <kbd>Del</kbd> finishes the first in line.</span><span class=\"touch\">Tap the same piece again to finish it.</span> The snake eats it and you score.",
  s4: "<span class=\"pc\">Double-click or press <kbd>E</kbd> to change the text. Mistake? <kbd>Ctrl</kbd><kbd>Z</kbd>.</span><span class=\"touch\">Press and hold a piece to change the text. Mistake? Tap undo on the message.</span>",
  "hud-len": "QUEUE", "hud-eaten": "SCORE", "hud-best": "HI",
  board: "Task queue", ink: "screen", "ink-group": "Screen color",
  "ink-nokia": "classic", "ink-pocket": "pea", "ink-amber": "amber", "ink-blue": "blue",
  device: "handheld", "device-group": "Handheld around the screen", "device-off": "off", "device-on": "on",
  undo: "undo",
  // used from js only
  "empty-label": "empty queue", "empty-text": "No tasks yet. Add one and the snake grows.",
  position: "{i} of {n}", next: "next up", "seg-label": "{i}. {t}",
  done: "+1 · {t}", edited: "task edited", restored: "undone",
};
const PT_JS = {
  "empty-label": "fila vazia", "empty-text": "Nenhuma tarefa por enquanto. Adicione uma e a cobra cresce.",
  position: "{i} de {n}", next: "próxima", "seg-label": "{i}. {t}",
  done: "+1 · {t}", edited: "tarefa editada", restored: "desfeito",
};

let lang = "pt";
const t = (key, vars = {}) =>
  ((lang === "en" ? EN[key] : PT[key]) ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const PT = { ...PT_JS };
{
  const html = [...document.querySelectorAll("[data-i18n]")];
  const aria = [...document.querySelectorAll("[data-i18n-aria]")];
  const ph = [...document.querySelectorAll("[data-i18n-ph]")];
  const title = [...document.querySelectorAll("[data-i18n-title]")];
  html.forEach((el) => { PT[el.dataset.i18n] ??= el.innerHTML; });
  aria.forEach((el) => { PT[el.dataset.i18nAria] ??= el.getAttribute("aria-label"); });
  ph.forEach((el) => { PT[el.dataset.i18nPh] ??= el.placeholder; });

  const KEY = "jotaverse.lang";
  const apply = (next) => {
    lang = next === "en" ? "en" : "pt";
    document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
    html.forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    aria.forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    ph.forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    title.forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    store.set(KEY, lang);
  };
  document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => {
    apply(b.dataset.lang);
    render();
  }));
  apply(store.get(KEY) || (navigator.language?.toLowerCase().startsWith("pt") ? "pt" : "en"));
}

/* ---------------------------------------------------------
   sound: the context is made on first use, after a gesture,
   so the browser doesn't complain about autoplay
   --------------------------------------------------------- */
const sound = {
  ctx: null,
  muted: store.get("snakeIsMuted") === "true",

  play(type) {
    if (this.muted) return;
    // square blips that slide, like a handheld's beeper
    const tones = {
      add:    { volume: 0.08, freq: 440, to: 880, wave: "square", duration: 0.12 },
      remove: { volume: 0.08, freq: 660, to: 110, wave: "square", duration: 0.18 },
      edit:   { volume: 0.06, freq: 990, to: 990, wave: "square", duration: 0.06 },
    };
    const tone = tones[type];
    try {
      this.ctx ??= new AudioContext();
      this.ctx.resume();
    } catch { return; }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain).connect(this.ctx.destination);
    osc.type = tone.wave;
    osc.frequency.setValueAtTime(tone.freq, now);
    osc.frequency.exponentialRampToValueAtTime(tone.to, now + tone.duration);
    gain.gain.setValueAtTime(tone.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.00001, now + tone.duration);
    osc.start(now);
    osc.stop(now + tone.duration);
  },

  toggle() {
    this.muted = !this.muted;
    store.set("snakeIsMuted", this.muted);
    this.paint();
  },

  paint() {
    muteButton.setAttribute("aria-pressed", String(this.muted));
  },
};
sound.paint();
muteButton.addEventListener("click", () => sound.toggle());

/* ---------------------------------------------------------
   theme: auto follows the device and keeps following it if
   it changes; light and dark pin it. the <head> already
   applied the saved choice before first paint
   --------------------------------------------------------- */
const deviceLight = matchMedia("(prefers-color-scheme: light)");
let scheme = store.get("snakeScheme") || "auto";
function applyScheme() {
  const light = scheme === "light" || (scheme === "auto" && deviceLight.matches);
  document.documentElement.dataset.scheme = light ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]').content = light ? "#e7e3d6" : "#121410";
  document.querySelectorAll("button[data-scheme]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scheme === scheme)));
}
document.querySelectorAll("button[data-scheme]").forEach((b) => b.addEventListener("click", () => {
  scheme = b.dataset.scheme;
  store.set("snakeScheme", scheme);
  applyScheme();
}));
deviceLight.addEventListener("change", applyScheme);
applyScheme();

/* ---------------------------------------------------------
   the screen's color. older saves picked a snake ink or a
   theme; each maps onto the lcd closest to it
   --------------------------------------------------------- */
const OLD_INKS = { phosphor: "nokia", blue: "blue", vapor: "amber", paper: "pocket", matrix: "nokia", vaporwave: "amber", monochrome: "pocket" };
function setInk(ink) {
  ink = OLD_INKS[ink] || ink;
  if (!document.querySelector(`.chip[data-ink="${ink}"]`)) ink = "nokia";
  document.documentElement.dataset.ink = ink;
  document.querySelectorAll(".chip[data-ink]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.ink === ink)));
  store.set("snakeInk", ink);
}
setInk(store.get("snakeInk") || store.get("snakeTheme") || "nokia");
document.querySelectorAll(".chip[data-ink]").forEach((b) => b.addEventListener("click", () => setInk(b.dataset.ink)));

/* the handheld: off by default, the screen stands on its own.
   on, a flip phone render opens under the page and the live lcd is
   laid onto its glass. the <head> already applied the saved choice.
   only side by side: on a narrow screen the lcd would end up too
   small to read, so there it's always off (styles.css hides the switch) */
const deviceFig = document.querySelector(".device");
const deviceImg = document.querySelector(".device-img");
const lcd = document.querySelector(".lcd");
const wide = matchMedia("(min-width: 861px)");
const LCD_W = 440;          // the lcd's own width in css px, before it's mapped onto the glass
let flip = null;            // assets/flip.json, once loaded

function setDevice(device) {
  device = device === "on" ? "on" : "off";
  document.documentElement.dataset.device = device;
  document.querySelectorAll("button[data-device]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.device === device)));
  if (device === "on") loadFlip(); else layoutFlip();
}

async function loadFlip() {
  if (!flip) {
    try {
      flip = await (await fetch("assets/flip.json")).json();
    } catch {
      setDevice("off");     // no geometry, no handheld
      return;
    }
  }
  layoutFlip();
}

/* the homography that takes a w×h rectangle onto the quad p (tl, tr,
   br, bl), as a css matrix3d. heckbert's square-to-quad, then scaled
   from the unit square to w×h */
function quadMatrix(w, h, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const k = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1].join(",")})`;
}

/* the figure becomes a box around the screen's glass. the render is
   scaled so the glass fills it and placed around it, so the rest of
   the phone spills out under the page (the hero clips it) */
function layoutFlip() {
  const on = document.documentElement.dataset.device === "on" && wide.matches && flip;
  if (!on) {
    deviceFig.style.removeProperty("width");
    deviceFig.style.removeProperty("aspect-ratio");
    ["width", "height", "transform"].forEach((p) => lcd.style.removeProperty(p));
    return;
  }
  const { img_w, img_h, screen, screen_aspect } = flip;
  // lazy until the handheld is first switched on, so nobody downloads it for nothing.
  // a lazy image with no size never loads, so it gets its size and goes now
  deviceImg.width = img_w;
  deviceImg.height = img_h;
  deviceImg.loading = "eager";
  const quad = [screen.tl, screen.tr, screen.br, screen.bl];
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const boxW = Math.max(...xs) - minX, boxH = Math.max(...ys) - minY;

  // big enough to read, small enough that the hinge and the top of the
  // keypad still show under it
  const maxW = Math.min(520, innerWidth * 0.34);
  const maxH = Math.max(260, innerHeight * 0.5);
  const width = Math.min(maxW, maxH * (boxW / boxH));
  const s = width / boxW;
  deviceFig.style.width = width + "px";
  deviceFig.style.aspectRatio = `${boxW} / ${boxH}`;

  deviceImg.style.width = img_w * s + "px";
  deviceImg.style.left = -minX * s + "px";
  deviceImg.style.top = -minY * s + "px";

  const lcdH = LCD_W / screen_aspect;
  lcd.style.width = LCD_W + "px";
  lcd.style.height = lcdH + "px";
  lcd.style.transform = quadMatrix(LCD_W, lcdH, quad.map(([x, y]) => [(x - minX) * s, (y - minY) * s]));
}

setDevice(document.documentElement.dataset.device);
document.querySelectorAll("button[data-device]").forEach((b) => b.addEventListener("click", () => {
  setDevice(b.dataset.device);
  store.set("snakeDevice", b.dataset.device);
}));
addEventListener("resize", layoutFlip);
wide.addEventListener("change", layoutFlip);

/* ---------------------------------------------------------
   toast, with an undo for the last thing that happened
   --------------------------------------------------------- */
const touchOnly = matchMedia("(hover: none), (pointer: coarse)");
let lastAction = null;      // { type: 'remove' | 'edit', index, text }
let toastTimer = 0;

function toast(text, undoable) {
  $("toast-text").textContent = text;
  $("toast-undo").hidden = !undoable;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  // on a phone the message is the only undo there is, so it stays a while longer
  const wait = undoable ? (touchOnly.matches ? 7000 : 5000) : 1800;
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), wait);
}

function undo() {
  if (!lastAction) return;
  const { type, index, text } = lastAction;
  lastAction = null;
  if (type === "remove") {
    tasks.splice(index, 0, text);
    eaten.pop();
  } else {
    tasks[index] = text;
  }
  save();
  sound.play("add");
  render({ show: index });
  toast(t("restored"), false);
}
$("toast-undo").addEventListener("click", undo);

/* ---------------------------------------------------------
   tasks
   --------------------------------------------------------- */
let shown = null;           // index under the cursor or focus; null means the first
let picked = null;          // on touch: the piece tapped once, waiting for a second tap
let editing = null;         // index being edited in the readout

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  tasks.push(text);
  taskInput.value = "";
  save();
  sound.play("add");
  render({ fresh: tasks.length - 1 });
});

function removeTask(index, { refocus = false } = {}) {
  const [text] = tasks.splice(index, 1);
  eaten.push({ t: text, at: Date.now() });
  lastAction = { type: "remove", index, text };
  save();
  sound.play("remove");
  shown = null;
  picked = null;
  render();
  toast(t("done", { t: text }), true);
  if (refocus && tasks.length) segAt(Math.min(index, tasks.length - 1))?.focus();
}

function startEdit(index) {
  if (editing !== null) finishEdit(true);
  picked = null;
  editing = index;
  shown = index;
  sound.play("edit");
  paintReadout();
  segAt(index)?.classList.add("is-editing");
  readoutText.hidden = true;
  readoutEdit.hidden = false;
  readoutEdit.value = tasks[index];
  readoutEdit.focus();
  readoutEdit.select();
}

function finishEdit(save_) {
  if (editing === null) return;
  const index = editing;
  editing = null;
  const text = readoutEdit.value.trim();
  readoutEdit.hidden = true;
  readoutText.hidden = false;
  if (save_ && text && text !== tasks[index]) {
    lastAction = { type: "edit", index, text: tasks[index] };
    tasks[index] = text;
    save();
    toast(t("edited"), true);
  }
  render({ show: index });
  segAt(index)?.focus();
}

readoutEdit.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); finishEdit(true); }
  else if (e.key === "Escape") { e.preventDefault(); finishEdit(false); }
});
readoutEdit.addEventListener("blur", () => finishEdit(true));

/* ---------------------------------------------------------
   the snake. it spirals in from the top left corner, turning
   clockwise whenever it would hit a wall or itself. after the
   last task comes the tail, which isn't a task
   --------------------------------------------------------- */
const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // right, down, left, up

function snakePath(length) {
  const size = Math.max(5, Math.ceil(Math.sqrt(length + 2)) + 2);
  const taken = new Set(["0,0"]);
  const path = [{ x: 0, y: 0 }];
  let dir = 0;
  for (let i = 0; i < length + 1; i++) {
    const { x, y } = path[path.length - 1];
    for (let turn = 0; turn < 4; turn++) {
      const nx = x + STEPS[dir][0], ny = y + STEPS[dir][1];
      if (nx >= 0 && ny >= 0 && nx < size && ny < size && !taken.has(`${nx},${ny}`)) {
        taken.add(`${nx},${ny}`);
        path.push({ x: nx, y: ny });
        break;
      }
      dir = (dir + 1) % 4;
    }
  }
  return { path, size };
}

// which side of `a` the cell `b` is on
function side(a, b) {
  if (b.x < a.x) return "l";
  if (b.x > a.x) return "r";
  return b.y < a.y ? "u" : "d";
}
const OPPOSITE = { l: "r", r: "l", u: "d", d: "u" };

// reach an arm, as thick as the body, out to each neighbor: the snake is one piece
function shape(el, touches) {
  if (!el.classList.contains("tail")) el.insertAdjacentHTML("beforeend", touches.map((s) => `<span class="arm arm-${s}"></span>`).join(""));
}

const segAt = (index) => snakeGrid.querySelector(`.seg[data-index="${index}"]`);
const pad = (n) => String(n).padStart(2, "0");

function render({ fresh = -1, show } = {}) {
  if (show !== undefined) shown = show;
  if (shown !== null && shown >= tasks.length) shown = null;

  const { path, size } = snakePath(tasks.length);
  snakeGrid.style.setProperty("--n", size);

  const slots = Array.from({ length: size * size }, () => {
    const cell = document.createElement("div");
    cell.className = "cell";
    return cell;
  });

  const last = path.length - 1;
  path.forEach((pos, i) => {
    const touches = [];
    if (i > 0) touches.push(side(pos, path[i - 1]));
    if (i < last) touches.push(side(pos, path[i + 1]));
    let el;
    if (i === 0) {
      el = document.createElement("div");
      el.className = "head face-" + OPPOSITE[touches[0]];
      el.innerHTML = '<span class="body"><span class="eye"></span><span class="eye"></span></span>';
    } else if (i === last) {
      el = document.createElement("div");
      el.className = "tail to-" + OPPOSITE[touches[0]];
      el.innerHTML = '<span class="body"></span>';
    } else {
      const index = i - 1;
      el = document.createElement("button");
      el.type = "button";
      el.className = "seg";
      el.innerHTML = '<span class="body"></span>';
      el.dataset.index = index;
      el.tabIndex = index === (shown ?? 0) ? 0 : -1;    // one tab stop, arrows do the rest
      el.style.setProperty("--fade", (1 - 0.4 * (index / Math.max(1, tasks.length - 1))).toFixed(2));
      el.setAttribute("aria-label", t("seg-label", { i: index + 1, t: tasks[index] }));
      el.classList.add("from-" + touches[0]);     // the seam goes on the side facing the head
      if (index === fresh) el.classList.add("is-new");
    }
    shape(el, touches);
    el.style.gridColumn = pos.x + 1;
    el.style.gridRow = pos.y + 1;
    slots[pos.y * size + pos.x] = el;
  });

  snakeGrid.replaceChildren(...slots);
  $("hud-len").textContent = pad(tasks.length);
  $("hud-eaten").textContent = String(eaten.length).padStart(4, "0");
  $("hud-best").textContent = pad(best);
  paintReadout();
}

function paintReadout() {
  if (editing !== null) return;
  snakeGrid.querySelectorAll(".is-current, .is-picked").forEach((s) => s.classList.remove("is-current", "is-picked"));
  if (!tasks.length) {
    readoutLabel.textContent = t("empty-label");
    readoutText.textContent = t("empty-text");
    readoutText.classList.add("is-empty");
    return;
  }
  const i = shown ?? 0;
  readoutLabel.innerHTML = t("position", { i: i + 1, n: tasks.length }) + (i === 0 ? ` · <b>${t("next")}</b>` : "");
  readoutText.textContent = tasks[i];
  readoutText.classList.remove("is-empty");
  segAt(i)?.classList.add("is-current");
  if (picked !== null) segAt(picked)?.classList.add("is-picked");
}

/* with a mouse: one click finishes, two edit. the single click waits
   a beat so a double click doesn't finish the task first.
   with a finger: one tap picks the piece and shows it, a second tap
   on the same piece finishes it, holding it edits */
let clickTimer = 0;
let pointerKind = "mouse";
let holdTimer = 0;
let held = false;
let holdFrom = null;
const HOLD_MS = 500;

snakeGrid.addEventListener("pointerdown", (e) => {
  pointerKind = e.pointerType;
  if (e.pointerType !== "touch") return;
  const seg = e.target.closest(".seg");
  held = false;
  clearTimeout(holdTimer);
  if (!seg || editing !== null) return;
  holdFrom = { x: e.clientX, y: e.clientY };
  holdTimer = setTimeout(() => {
    held = true;
    startEdit(Number(seg.dataset.index));
  }, HOLD_MS);
});
snakeGrid.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "touch" || !holdFrom) return;
  if (Math.hypot(e.clientX - holdFrom.x, e.clientY - holdFrom.y) > 10) clearTimeout(holdTimer);
});
["pointerup", "pointercancel"].forEach((type) => snakeGrid.addEventListener(type, () => {
  clearTimeout(holdTimer);
  holdFrom = null;
}));
// after a hold, the finger lifting would click the piece, which steals
// focus from the editor and closes it. cancelling the touchend stops that
snakeGrid.addEventListener("touchend", (e) => {
  if (!held) return;
  e.preventDefault();
  held = false;
}, { passive: false });
// a long press would open the browser's menu or select text instead
snakeGrid.addEventListener("contextmenu", (e) => { if (pointerKind === "touch") e.preventDefault(); });

function tap(index) {
  if (picked === index) { removeTask(index); return; }
  picked = index;
  shown = index;
  sound.play("edit");
  paintReadout();
}

snakeGrid.addEventListener("click", (e) => {
  const seg = e.target.closest(".seg");
  if (!seg) return;
  const index = Number(seg.dataset.index);
  clearTimeout(clickTimer);
  if (e.detail === 0) { removeTask(index, { refocus: true }); return; }     // keyboard
  if (pointerKind === "touch") {
    if (held) held = false;            // the hold already opened the editor
    else if (editing === null) tap(index);
    return;
  }
  if (e.detail === 1) clickTimer = setTimeout(() => removeTask(index), 250);
  else startEdit(index);
});

// a tap anywhere off the snake lets go of the picked piece
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch" || picked === null || e.target.closest(".seg, .toast")) return;
  picked = null;
  shown = null;
  paintReadout();
});

/* hovering or focusing a piece puts its task on the screen's readout */
function point(index) {
  if (editing !== null) return;
  shown = index;
  paintReadout();
}
/* and a little balloon by the cursor says which task it is, so you
   don't have to look away to the readout */
const hint = $("hint");
function showHint(index, x, y) {
  $("hint-label").innerHTML = t("position", { i: index + 1, n: tasks.length }) + (index === 0 ? ` · <b>${t("next")}</b>` : "");
  $("hint-text").textContent = tasks[index];
  hint.classList.add("show");
  const w = hint.offsetWidth, h = hint.offsetHeight;
  const left = Math.min(x + 16, innerWidth - w - 8);
  const top = y + 20 + h > innerHeight ? y - h - 12 : y + 20;
  hint.style.translate = `${Math.max(8, left)}px ${Math.max(8, top)}px`;
}
const hideHint = () => hint.classList.remove("show");
snakeGrid.addEventListener("pointermove", (e) => {
  const seg = e.target.closest(".seg");
  if (!seg || editing !== null || e.pointerType === "touch") { hideHint(); return; }
  const index = Number(seg.dataset.index);
  if (shown !== index) point(index);
  showHint(index, e.clientX, e.clientY);
});
snakeGrid.addEventListener("pointerdown", hideHint);
snakeGrid.addEventListener("focusin", (e) => {
  const seg = e.target.closest(".seg");
  if (!seg) return;
  point(Number(seg.dataset.index));
});
snakeGrid.addEventListener("pointerleave", () => {
  hideHint();
  if (editing !== null || picked !== null || snakeGrid.contains(document.activeElement)) return;
  shown = null;
  paintReadout();
});

snakeGrid.addEventListener("keydown", (e) => {
  const seg = e.target.closest(".seg");
  if (!seg) return;
  const index = Number(seg.dataset.index);
  const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: -Infinity, End: Infinity };
  if (e.key in moves) {
    e.preventDefault();
    const next = Math.max(0, Math.min(tasks.length - 1, index + moves[e.key]));
    seg.tabIndex = -1;
    const target = segAt(next);
    target.tabIndex = 0;
    target.focus();
  } else if (e.key === "e" || e.key === "E" || e.key === "F2") {
    e.preventDefault();
    startEdit(index);
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    e.stopPropagation();
    removeTask(index, { refocus: true });
  }
});

/* ---------------------------------------------------------
   page keys
   --------------------------------------------------------- */
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea")) {
    if (e.key === "Escape" && e.target === taskInput) taskInput.blur();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey || e.metaKey || e.altKey) {
    return;
  } else if (e.key === "/") {
    e.preventDefault();
    taskInput.focus();
  } else if (e.key === "Delete" && tasks.length) {
    removeTask(0);
  }
});

render();
