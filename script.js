/* =========================================================
   SNAKE QUEUE
   every task is a piece of the snake. the one touching the
   head is next. click a piece to finish it (the snake eats
   it and it goes on the receipt), double click to edit,
   ctrl+z to take the last thing back.
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
  tagline: "TO-DO LIST<br>EVERY TASK IS A PIECE OF THE SNAKE",
  by: "A JOTAVERSE PROJECT ↗", sound: "Sound", "lang-group": "Language",
  "scheme-group": "Theme", "scheme-auto": "Automatic (follows your device)", "scheme-light": "Light", "scheme-dark": "Dark",
  "new-task": "new task", placeholder: "what do you need to do?", add: "add",
  "edit-task": "Edit task", how: "how to use",
  s1: "Type a task and press Enter. The snake grows. <kbd>/</kbd> jumps back to the text field.",
  s2: "Hover a piece to see its task. Arrow keys move through the queue.",
  s3: "Click to complete. <kbd>Del</kbd> completes the first in line.",
  s4: "Double click or press <kbd>E</kbd> to edit. <kbd>Ctrl</kbd><kbd>Z</kbd> undoes.",
  "hud-len": "LENGTH", "hud-eaten": "DONE", "hud-best": "BEST",
  board: "Task queue", ink: "colour", "ink-group": "Snake colour",
  "ink-phosphor": "green", "ink-blue": "blue", "ink-vapor": "pink", "ink-paper": "neutral",
  slip: "Completed tasks", "slip-note": "the snake thanks you.<br>come again.", undo: "undo",
  // used from js only
  "empty-label": "empty queue", "empty-text": "No tasks yet. Add one and the snake grows.",
  position: "{i} of {n}", next: "next up", "seg-label": "{i}. {t}",
  done: "completed: {t}", edited: "task edited", restored: "task restored",
  "slip-no": "RECEIPT Nº {n}", "slip-none": "nothing completed yet", "slip-total": "{n} TASKS", "slip-total-1": "1 TASK",
};
const PT_JS = {
  "empty-label": "fila vazia", "empty-text": "Nenhuma tarefa por enquanto. Adicione uma e a cobra cresce.",
  position: "{i} de {n}", next: "próxima", "seg-label": "{i}. {t}",
  done: "concluída: {t}", edited: "tarefa editada", restored: "tarefa restaurada",
  "slip-no": "RECIBO Nº {n}", "slip-none": "nenhuma tarefa concluída", "slip-total": "{n} TAREFAS", "slip-total-1": "1 TAREFA",
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
    const tones = {
      add:    { volume: 0.3, freq: 300, wave: "triangle", duration: 0.3 },
      remove: { volume: 0.1, freq: 150, wave: "square",   duration: 0.2 },
      edit:   { volume: 0.3, freq: 440, wave: "sine",     duration: 0.15 },
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
  document.querySelector('meta[name="theme-color"]').content = light ? "#f4f1ea" : "#151412";
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
   ink. the old themes map straight onto the new inks
   --------------------------------------------------------- */
const OLD_THEMES = { matrix: "phosphor", vaporwave: "vapor", monochrome: "paper" };
function setInk(ink) {
  if (!document.querySelector(`.chip[data-ink="${ink}"]`)) ink = "phosphor";
  document.documentElement.dataset.ink = ink;
  document.querySelectorAll(".chip[data-ink]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.ink === ink)));
  store.set("snakeInk", ink);
}
setInk(store.get("snakeInk") || OLD_THEMES[store.get("snakeTheme")] || "phosphor");
document.querySelectorAll(".chip[data-ink]").forEach((b) => b.addEventListener("click", () => setInk(b.dataset.ink)));

/* ---------------------------------------------------------
   toast, with an undo for the last thing that happened
   --------------------------------------------------------- */
let lastAction = null;      // { type: 'remove' | 'edit', index, text }
let toastTimer = 0;

function toast(text, undoable) {
  $("toast-text").textContent = text;
  $("toast-undo").hidden = !undoable;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), undoable ? 5000 : 1800);
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
  hideHint();
  const [text] = tasks.splice(index, 1);
  eaten.push({ t: text, at: Date.now() });
  lastAction = { type: "remove", index, text };
  save();
  sound.play("remove");
  shown = null;
  render();
  toast(t("done", { t: text }), true);
  if (refocus && tasks.length) segAt(Math.min(index, tasks.length - 1))?.focus();
}

function startEdit(index) {
  hideHint();
  if (editing !== null) finishEdit(true);
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

// round the core's corners between two free sides, and reach an arm out to each neighbour
function shape(el, touches) {
  const free = (s) => !touches.includes(s);
  const R = "50%";
  el.style.cssText += `--tl:${free("u") && free("l") ? R : 0};--tr:${free("u") && free("r") ? R : 0};`
    + `--br:${free("d") && free("r") ? R : 0};--bl:${free("d") && free("l") ? R : 0};`;
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
      if (index === fresh) el.classList.add("is-new");
    }
    shape(el, touches);
    el.style.gridColumn = pos.x + 1;
    el.style.gridRow = pos.y + 1;
    slots[pos.y * size + pos.x] = el;
  });

  snakeGrid.replaceChildren(...slots);
  $("hud-len").textContent = pad(tasks.length);
  $("hud-eaten").textContent = pad(eaten.length);
  $("hud-best").textContent = pad(best);
  paintReadout();
  paintSlip();
}

function paintReadout() {
  if (editing !== null) return;
  snakeGrid.querySelectorAll(".is-current").forEach((s) => s.classList.remove("is-current"));
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
}

// the receipt prints the last few things eaten
function paintSlip() {
  const time = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pt-BR", { hour: "2-digit", minute: "2-digit" });
  $("slip-no").textContent = t("slip-no", { n: String(eaten.length).padStart(4, "0") });
  $("slip-date").textContent = new Date().toLocaleDateString(lang === "en" ? "en-GB" : "pt-BR");
  $("slip-total").textContent = eaten.length === 1 ? t("slip-total-1") : t("slip-total", { n: eaten.length });
  const lines = eaten.slice(-6).reverse().map(({ t: text, at }) => {
    const li = document.createElement("li");
    const what = document.createElement("span");
    what.className = "what";
    what.textContent = text;
    const when = document.createElement("span");
    when.textContent = time.format(at);
    li.append(what, document.createElement("i"), when);
    return li;
  });
  if (!lines.length) {
    const li = document.createElement("li");
    li.className = "none";
    li.textContent = t("slip-none");
    lines.push(li);
  }
  $("slip-lines").replaceChildren(...lines);
}

/* one click finishes, two edit. the single click waits a beat
   so a double click doesn't finish the task first */
let clickTimer = 0;
snakeGrid.addEventListener("click", (e) => {
  const seg = e.target.closest(".seg");
  if (!seg) return;
  const index = Number(seg.dataset.index);
  clearTimeout(clickTimer);
  if (e.detail === 0) removeTask(index, { refocus: true });        // keyboard
  else if (e.detail === 1) clickTimer = setTimeout(() => removeTask(index), 250);
  else startEdit(index);
});

/* hovering a piece shows its task right by the cursor; keyboard
   focus puts it by the piece. the readout keeps it for touch */
const hint = $("hint");
function showHint(index, x, y) {
  $("hint-label").innerHTML = t("position", { i: index + 1, n: tasks.length }) + (index === 0 ? ` · <b>${t("next")}</b>` : "");
  $("hint-text").textContent = tasks[index];
  hint.classList.add("show");
  // keep it on screen: flip to the other side of the cursor near the edges
  const w = hint.offsetWidth, h = hint.offsetHeight;
  const left = x + 16 + w > innerWidth - 8 ? x - 16 - w : x + 16;
  const top = y + 18 + h > innerHeight - 8 ? y - 12 - h : y + 18;
  hint.style.translate = `${Math.max(8, left)}px ${Math.max(8, top)}px`;
}
const hideHint = () => hint.classList.remove("show");

function point(index) {
  if (editing !== null) return;
  shown = index;
  paintReadout();
}
snakeGrid.addEventListener("pointermove", (e) => {
  const seg = e.target.closest(".seg");
  if (!seg || editing !== null || e.pointerType === "touch") return hideHint();
  const index = Number(seg.dataset.index);
  if (shown !== index) point(index);
  showHint(index, e.clientX, e.clientY);
});
snakeGrid.addEventListener("focusin", (e) => {
  const seg = e.target.closest(".seg");
  if (!seg) return;
  const index = Number(seg.dataset.index);
  point(index);
  if (seg.matches(":focus-visible")) {
    const r = seg.getBoundingClientRect();
    showHint(index, r.right - 8, r.bottom - 8);
  }
});
snakeGrid.addEventListener("focusout", hideHint);
snakeGrid.addEventListener("pointerleave", () => {
  hideHint();
  if (editing !== null || snakeGrid.contains(document.activeElement)) return;
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
