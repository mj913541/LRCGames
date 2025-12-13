/* Planner MVP (iPad + pencil friendly)
   - Dashboard timeline (15-min slots)
   - Tasks (Must/Should/Could) + Inbox
   - Weekly calendar with drag/drop to schedule
   - Habits + habit history
   - Firebase sync via lrcQuestCore if available, fallback to localStorage
*/

const APP = {
  version: "0.1.0",
  user: null,
  state: null,
  todayKey: null,
  settings: null,
  drag: { active: false, payload: null, el: null, startX: 0, startY: 0, pointerId: null }
};

const LS_KEY = "plannerAppData_v1";

/* ------------------ Date / Time Helpers ------------------ */

function todayISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function fmtDateLong(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function minutesFromHHMM(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function hhmmFromMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }

/* ------------------ Storage / Sync ------------------ */

async function loadState() {
  // 1) Try lrcQuestCore (Firestore)
  if (window.lrcQuestCore?.requireLogin) {
    await window.lrcQuestCore.requireLogin();
    APP.user = window.lrcQuestCore.getCurrentUser?.() || null;
  }

  const local = JSON.parse(localStorage.getItem(LS_KEY) || "null");
  let cloud = null;

  // Prefer your core helpers if present
  if (window.lrcQuestCore?.loadUserData) {
    cloud = await window.lrcQuestCore.loadUserData("plannerApp");
  } else if (window.lrcQuestCore?.db && APP.user) {
    // Minimal Firestore approach if core exposes db + user
    try {
      const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
      const ref = doc(window.lrcQuestCore.db, "users", APP.user.uid, "apps", "plannerApp");
      const snap = await getDoc(ref);
      cloud = snap.exists() ? snap.data()?.data : null;
    } catch (e) {
      cloud = null;
    }
  }

  APP.state = cloud || local || defaultState();

  APP.state.meta ||= { createdAt: Date.now(), updatedAt: Date.now(), version: APP.version };
  APP.state.settings ||= defaultSettings();
  APP.settings = APP.state.settings;

  APP.todayKey = todayISO();
  APP.state.days ||= {};
  APP.state.days[APP.todayKey] ||= defaultDay();

  APP.state.weeks ||= {};
  const wk = weekKey(new Date());
  APP.state.weeks[wk] ||= defaultWeek();

  await saveState();
}

async function saveState() {
  APP.state.meta.updatedAt = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(APP.state));

  // Save to Firestore if available
  if (window.lrcQuestCore?.saveUserData) {
    await window.lrcQuestCore.saveUserData("plannerApp", APP.state);
  } else if (window.lrcQuestCore?.db && APP.user) {
    try {
      const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
      const ref = doc(window.lrcQuestCore.db, "users", APP.user.uid, "apps", "plannerApp");
      await setDoc(ref, { data: APP.state, updatedAt: Date.now(), version: APP.version }, { merge: true });
    } catch (e) {
      // local-only if firestore fails
    }
  }
}

/* ------------------ Defaults ------------------ */

function defaultSettings() {
  return {
    dayStart: "06:00",
    dayEnd: "22:00",
    timelineStep: 15,
    homeMorningAnchor: "06:00",
    homeEveningAnchor: "17:00",

    letterSchedules: {
      A: [
        { start: "09:05", end: "09:50", title: "4th", location: "LRC" },
        { start: "10:05", end: "10:50", title: "2nd", location: "LRC" },
        { start: "11:05", end: "11:50", title: "3rd", location: "LRC" },
        { start: "12:05", end: "12:45", title: "Lunch", location: "" },
        { start: "12:45", end: "13:45", title: "Admin", location: "" },
        { start: "13:45", end: "14:30", title: "5th", location: "LRC" },
        { start: "14:45", end: "15:30", title: "1st", location: "LRC" }
      ],
      B: [],
      C: [],
      D: [],
      E: []
    },

    // Fallback weekday map (used outside of the PDF mapping range)
    weekLetterMap: { Mon: "A", Tue: "B", Wed: "C", Thu: "D", Fri: "E" },

    // Exact date -> letter day (preferred). null = No School
    letterDayByDate: {
      // Dec 2025
      "2025-12-01": "C", "2025-12-02": "C", "2025-12-03": "E", "2025-12-04": "A", "2025-12-05": "B",
      "2025-12-08": "C", "2025-12-09": "D", "2025-12-10": "E", "2025-12-11": "A", "2025-12-12": "B",
      "2025-12-15": "C", "2025-12-16": "D", "2025-12-17": "E", "2025-12-18": "A", "2025-12-19": "B",
      "2025-12-22": null, "2025-12-23": null, "2025-12-24": null, "2025-12-25": null, "2025-12-26": null,
      "2025-12-29": null, "2025-12-30": null, "2025-12-31": null,

      // Jan 2026
      "2026-01-01": null, "2026-01-02": null,
      "2026-01-05": null,
      "2026-01-06": "C", "2026-01-07": "D", "2026-01-08": "E", "2026-01-09": "A",
      "2026-01-12": "B", "2026-01-13": "C", "2026-01-14": "D", "2026-01-15": "E", "2026-01-16": "A",
      "2026-01-19": null,
      "2026-01-20": "B", "2026-01-21": "C", "2026-01-22": "D", "2026-01-23": "E",
      "2026-01-26": "A", "2026-01-27": "B", "2026-01-28": "C", "2026-01-29": "D", "2026-01-30": "E",

      // Feb 2026
      "2026-02-02": "A", "2026-02-03": "B", "2026-02-04": "C", "2026-02-05": "D", "2026-02-06": "E",
      "2026-02-09": "A", "2026-02-10": "B", "2026-02-11": "C", "2026-02-12": "D", "2026-02-13": "E",
      "2026-02-16": null,
      "2026-02-17": "A", "2026-02-18": "B", "2026-02-19": "C", "2026-02-20": "D",
      "2026-02-23": "E", "2026-02-24": "A", "2026-02-25": "B", "2026-02-26": "C",
      "2026-02-27": null,

      // Mar 2026
      "2026-03-02": "D", "2026-03-03": "E", "2026-03-04": "A", "2026-03-05": "B", "2026-03-06": "C",
      "2026-03-09": "D", "2026-03-10": "E", "2026-03-11": "A", "2026-03-12": "B", "2026-03-13": "C",
      "2026-03-16": "D", "2026-03-17": null, "2026-03-18": "E", "2026-03-19": "A", "2026-03-20": "B",
      "2026-03-23": "C", "2026-03-24": "D", "2026-03-25": "E", "2026-03-26": "A", "2026-03-27": "B",
      "2026-03-30": null, "2026-03-31": null,

      // Apr 2026
      "2026-04-01": null, "2026-04-02": null, "2026-04-03": null,
      "2026-04-06": null,
      "2026-04-07": "C", "2026-04-08": "D", "2026-04-09": "E", "2026-04-10": "A",
      "2026-04-13": "B", "2026-04-14": "C", "2026-04-15": "D", "2026-04-16": "E", "2026-04-17": null,
      "2026-04-20": "A", "2026-04-21": "B", "2026-04-22": "C", "2026-04-23": "D", "2026-04-24": "E",
      "2026-04-27": "A", "2026-04-28": "B", "2026-04-29": "C", "2026-04-30": "D",

      // May 2026
      "2026-05-01": "E",
      "2026-05-04": "A", "2026-05-05": "B", "2026-05-06": "C", "2026-05-07": "D", "2026-05-08": "E",
      "2026-05-11": "A", "2026-05-12": "B", "2026-05-13": "C", "2026-05-14": "D", "2026-05-15": "E",
      "2026-05-18": "A", "2026-05-19": "B", "2026-05-20": "C", "2026-05-21": "D", "2026-05-22": "E",
      "2026-05-25": null, "2026-05-26": null, "2026-05-27": null, "2026-05-28": null, "2026-05-29": null
    },

    habits: [
      { id: "water", name: "Water", goalPerDay: 6, unit: "cups" },
      { id: "steps", name: "Movement", goalPerDay: 1, unit: "done" },
      { id: "plan", name: "Plan day (2 min)", goalPerDay: 1, unit: "done" }
    ],

    recurring: {
      daily: [
        { title: "Quick inbox sweep (2 min)", bucket: "should", time: "08:00", area: "home" },
        { title: "Close loops: pick 1 must-do", bucket: "must", time: "08:05", area: "home" }
      ],
      weekly: [
        { title: "Weekly reset (10 min)", bucket: "should", day: "Sun", time: "19:00", area: "home" }
      ]
    }
  };
}

function defaultDay() {
  return {
    appointments: { home: [], lrc: [] },
    checklists: {
      homeMorning: [
        { id: uid(), text: "Meds / vitamins", done: false },
        { id: uid(), text: "Water + breakfast", done: false },
        { id: uid(), text: "2-min tidy", done: false }
      ],
      homeEvening: [
        { id: uid(), text: "Prep tomorrow (bags / clothes)", done: false },
        { id: uid(), text: "Charge devices", done: false },
        { id: uid(), text: "Lights out routine", done: false }
      ]
    },
    tasks: { inbox: [], home: [], lrc: [] },
    habits: {},
    pomodoro: { mode: "focus", remainingSec: 25 * 60, running: false, lastTick: null }
  };
}

function defaultWeek() {
  return { days: {} };
}

function defaultState() {
  return {
    meta: { createdAt: Date.now(), updatedAt: Date.now(), version: APP.version },
    settings: defaultSettings(),
    days: {},
    weeks: {}
  };
}

/* ------------------ Week Helpers ------------------ */

function weekKey(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return "wk_" + todayISO(d);
}

function getWeekRange(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - day);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    days.push(x);
  }
  return days;
}

/* ------------------ UI Utilities ------------------ */

function $(sel) { return document.querySelector(sel); }

function showUserPill() {
  const el = $("#userPill");
  if (!el) return;
  if (APP.user?.email) el.textContent = `Signed in: ${APP.user.email}`;
  else el.textContent = "Local mode (not signed in)";
}

/* ------------------ Timeline Rendering ------------------ */

function buildSlots() {
  const start = minutesFromHHMM(APP.settings.dayStart);
  const end = minutesFromHHMM(APP.settings.dayEnd);
  const step = APP.settings.timelineStep;

  const slots = [];
  for (let t = start; t < end; t += step) {
    slots.push({ startMin: t, endMin: t + step, label: hhmmFromMinutes(t) });
  }
  return slots;
}

function renderTimeline(container, blocks) {
  // If container has data-date (weekly view), keep it on each slot row for drag/drop
  const containerDate = container?.dataset?.date || null;

  const slots = buildSlots();
  container.innerHTML = "";

  for (const s of slots) {
    const row = document.createElement("div");
    row.className = "slot";
    row.dataset.start = String(s.startMin);
    row.dataset.end = String(s.endMin);

    if (containerDate) row.dataset.date = containerDate; // ✅ critical fix

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = s.label;

    const cell = document.createElement("div");
    cell.className = "cell";

    row.appendChild(time);
    row.appendChild(cell);
    container.appendChild(row);
  }

  const startMin = slots[0].startMin;
  const step = APP.settings.timelineStep;

  for (const b of blocks) {
    const idx = Math.floor((b.startMin - startMin) / step);
    const spanSteps = Math.max(1, Math.ceil((b.endMin - b.startMin) / step));
    const rows = container.querySelectorAll(".slot");
    const row = rows[idx];
    if (!row) continue;

    const cell = row.querySelector(".cell");
    const block = document.createElement("div");
    block.className = `block ${b.kind || ""} draggable`;
    block.dataset.blockId = b.id;
    block.dataset.kind = b.kind || "";
    block.style.height = `calc(${spanSteps} * 38px - 6px)`;

    const t = document.createElement("div");
    t.className = "t";
    t.textContent = b.title;

    const m = document.createElement("div");
    m.className = "m";
    m.textContent = b.meta || `${hhmmFromMinutes(b.startMin)}–${hhmmFromMinutes(b.endMin)}`;

    block.appendChild(t);
    block.appendChild(m);
    cell.appendChild(block);

    enablePointerDrag(block, { type: "timelineBlock", block: b });
  }
}

/* ------------------ Tasks ------------------ */

function categorizeTask(text) {
  const t = text.toLowerCase();
  if (t.includes("pay") || t.includes("deadline") || t.includes("due") || t.includes("call") || t.includes("email")) return "must";
  if (t.includes("plan") || t.includes("prep") || t.includes("tidy") || t.includes("laundry")) return "should";
  return "could";
}

function taskRow(task, area) {
  const row = document.createElement("div");
  row.className = "taskRow draggable";
  row.dataset.taskId = task.id;
  row.dataset.area = area;

  const left = document.createElement("div");
  left.className = "meta";

  const title = document.createElement("div");
  title.style.fontWeight = "650";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "small";
  meta.textContent = task.time ? `⏱ ${task.time}` : (task.when || "");

  const tag = document.createElement("span");
  tag.className = `tag ${task.bucket}`;
  tag.textContent = task.bucket.toUpperCase();

  left.appendChild(title);
  left.appendChild(meta);

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "10px";
  right.style.alignItems = "center";

  const tagWrap = document.createElement("div");
  tagWrap.appendChild(tag);

  const chk = document.createElement("div");
  chk.className = "chk" + (task.done ? " done" : "");
  chk.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  chk.addEventListener("click", async () => {
    task.done = !task.done;
    await saveState();
    if (document.body.dataset.page === "dashboard") renderDashboard();
    if (document.body.dataset.page === "weekly") renderWeekly();
  });

  right.appendChild(tagWrap);
  right.appendChild(chk);

  row.appendChild(left);
  row.appendChild(right);

  enablePointerDrag(row, { type: "task", task, area });
  return row;
}

/* ------------------ Pointer Drag (touch/pencil) ------------------ */

function enablePointerDrag(el, payload) {
  el.addEventListener("pointerdown", (e) => {
    APP.drag.active = true;
    APP.drag.payload = payload;
    APP.drag.el = el;
    APP.drag.startX = e.clientX;
    APP.drag.startY = e.clientY;
    APP.drag.pointerId = e.pointerId;

    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
  });

  el.addEventListener("pointermove", (e) => {
    if (!APP.drag.active || APP.drag.el !== el) return;
    const dx = e.clientX - APP.drag.startX;
    const dy = e.clientY - APP.drag.startY;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  });

  el.addEventListener("pointerup", async (e) => {
    if (!APP.drag.active || APP.drag.el !== el) return;

    el.releasePointerCapture(APP.drag.pointerId);
    el.classList.remove("dragging");
    el.style.transform = "";

    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    await handleDrop(dropTarget, APP.drag.payload);

    APP.drag.active = false;
    APP.drag.payload = null;
    APP.drag.el = null;
    APP.drag.pointerId = null;
  });
}

async function handleDrop(target, payload) {
  let t = target;
  while (t && t !== document.body) {
    if (t.classList?.contains("slot") && t.dataset.date) {
      return await dropOnWeeklySlot(t, payload);
    }
    t = t.parentElement;
  }
}

async function dropOnWeeklySlot(slotEl, payload) {
  const date = slotEl.dataset.date;
  const startMin = Number(slotEl.dataset.start);

  const wk = weekKey(new Date(date));
  APP.state.weeks[wk] ||= defaultWeek();
  APP.state.weeks[wk].days[date] ||= { scheduled: [] };

  if (payload.type === "task") {
    const task = payload.task;

    const block = {
      id: uid(),
      kind: "task",
      title: task.title,
      startMin,
      endMin: clamp(startMin + 30, startMin + 15, minutesFromHHMM(APP.settings.dayEnd)),
      source: { taskId: task.id, area: payload.area }
    };

    APP.state.weeks[wk].days[date].scheduled.push(block);

    // If it came from inbox, remove it from inbox
    if (payload.area === "inbox") {
      const day = APP.state.days[APP.todayKey];
      day.tasks.inbox = day.tasks.inbox.filter(x => x.id !== task.id);
    }

    await saveState();
    renderWeekly();
  }
}

/* ------------------ Dashboard ------------------ */

function collectDashboardBlocks() {
  const day = APP.state.days[APP.todayKey];
  const blocks = [];

  for (const appt of day.appointments.home) {
    blocks.push({
      id: appt.id,
      kind: "home",
      title: appt.title,
      startMin: minutesFromHHMM(appt.start),
      endMin: minutesFromHHMM(appt.end),
      meta: `Home • ${appt.start}–${appt.end}`
    });
  }
  for (const appt of day.appointments.lrc) {
    blocks.push({
      id: appt.id,
      kind: "lrc",
      title: appt.title,
      startMin: minutesFromHHMM(appt.start),
      endMin: minutesFromHHMM(appt.end),
      meta: `LRC • ${appt.start}–${appt.end}`
    });
  }

  blocks.push({
    id: "homeMorningAnchor",
    kind: "home",
    title: "Home Morning Tasks ✅",
    startMin: minutesFromHHMM(APP.settings.homeMorningAnchor),
    endMin: minutesFromHHMM(APP.settings.homeMorningAnchor) + 15,
    meta: "Tap to check off below"
  });

  blocks.push({
    id: "homeEveningAnchor",
    kind: "home",
    title: "Home Evening Tasks 🌙",
    startMin: minutesFromHHMM(APP.settings.homeEveningAnchor),
    endMin: minutesFromHHMM(APP.settings.homeEveningAnchor) + 15,
    meta: "Tap to check off below"
  });

  return blocks;
}

function renderDashboard() {
  $("#todayDate").textContent = fmtDateLong(new Date());
  showUserPill();

  renderTimeline($("#timeline"), collectDashboardBlocks());

  const day = APP.state.days[APP.todayKey];
  renderChecklist("#morningList", day.checklists.homeMorning);
  renderChecklist("#eveningList", day.checklists.homeEvening);

  const list = $("#tasksToday");
  list.innerHTML = "";

  const home = day.tasks.home;
  const lrc = day.tasks.lrc;

  const merged = [
    ...home.map(t => ({ ...t, _area: "home" })),
    ...lrc.map(t => ({ ...t, _area: "lrc" }))
  ];
  merged.sort((a, b) => (a.bucket > b.bucket ? 1 : -1));

  for (const t of merged) list.appendChild(taskRow(t, t._area));

  const inbox = $("#inboxList");
  inbox.innerHTML = "";
  if (day.tasks.inbox.length === 0) {
    inbox.innerHTML = `<div class="dropHint">Inbox is empty. Add a quick task below 👇</div>`;
  } else {
    for (const t of day.tasks.inbox) inbox.appendChild(taskRow(t, "inbox"));
  }

  renderHabitsSummary();
  renderPomodoro();
}

function renderChecklist(sel, items) {
  const wrap = $(sel);
  wrap.innerHTML = "";

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "taskRow";
    row.style.alignItems = "center";

    const left = document.createElement("div");
    left.className = "meta";

    const title = document.createElement("div");
    title.style.fontWeight = "650";
    title.textContent = it.text;
    left.appendChild(title);

    const right = document.createElement("div");
    const chk = document.createElement("div");
    chk.className = "chk" + (it.done ? " done" : "");
    chk.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    chk.addEventListener("click", async () => {
      it.done = !it.done;
      await saveState();
      renderDashboard();
    });

    right.appendChild(chk);
    row.appendChild(left);
    row.appendChild(right);
    wrap.appendChild(row);
  }
}

/* ------------------ Habits ------------------ */

function ensureHabitCounts(day) {
  day.habits ||= {};
  for (const h of APP.settings.habits) {
    if (typeof day.habits[h.id] !== "number") day.habits[h.id] = 0;
  }
}

function renderHabitsSummary() {
  const day = APP.state.days[APP.todayKey];
  ensureHabitCounts(day);

  const wrap = $("#habitsSummary");
  wrap.innerHTML = "";

  for (const h of APP.settings.habits) {
    const count = day.habits[h.id] || 0;
    const pct = clamp(Math.round((count / h.goalPerDay) * 100), 0, 100);

    const item = document.createElement("div");
    item.className = "habitItem" + (count >= h.goalPerDay ? " habitGreen" : "");

    const left = document.createElement("div");
    left.style.minWidth = "140px";
    left.innerHTML = `<div style="font-weight:750">${h.name}</div>
      <div class="small">${count} / ${h.goalPerDay} ${h.unit}</div>`;

    const bar = document.createElement("div");
    bar.className = "progressBar";
    const fill = document.createElement("div");
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "8px";

    const minus = document.createElement("button");
    minus.className = "btn";
    minus.style.minHeight = "44px";
    minus.textContent = "–";
    minus.addEventListener("click", async () => {
      day.habits[h.id] = Math.max(0, (day.habits[h.id] || 0) - 1);
      await saveState();
      renderDashboard();
    });

    const plus = document.createElement("button");
    plus.className = "btn primary";
    plus.style.minHeight = "44px";
    plus.textContent = "+";
    plus.addEventListener("click", async () => {
      day.habits[h.id] = (day.habits[h.id] || 0) + 1;
      await saveState();
      renderDashboard();
    });

    btns.appendChild(minus);
    btns.appendChild(plus);

    item.appendChild(left);
    item.appendChild(bar);
    item.appendChild(btns);
    wrap.appendChild(item);
  }
}

/* ------------------ Pomodoro ------------------ */

let pomoInterval = null;

function secToMMSS(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderPomodoro() {
  const day = APP.state.days[APP.todayKey];
  const p = day.pomodoro;
  $("#pomoMode").textContent = p.mode === "focus" ? "Focus" : "Break";
  $("#pomoTime").textContent = secToMMSS(p.remainingSec);
  $("#pomoStart").textContent = p.running ? "Pause" : "Start";
}

async function togglePomodoro() {
  const day = APP.state.days[APP.todayKey];
  const p = day.pomodoro;

  p.running = !p.running;
  p.lastTick = Date.now();

  if (p.running) {
    if (pomoInterval) clearInterval(pomoInterval);
    pomoInterval = setInterval(async () => {
      const now = Date.now();
      const delta = Math.floor((now - p.lastTick) / 1000);
      if (delta > 0) {
        p.remainingSec = Math.max(0, p.remainingSec - delta);
        p.lastTick = now;

        if (p.remainingSec === 0) {
          if (p.mode === "focus") {
            p.mode = "break";
            p.remainingSec = 5 * 60;
          } else {
            p.mode = "focus";
            p.remainingSec = 25 * 60;
          }
        }

        await saveState();
        renderPomodoro();
      }
    }, 500);
  } else {
    if (pomoInterval) clearInterval(pomoInterval);
  }

  await saveState();
  renderPomodoro();
}

async function resetPomodoro(mode) {
  const day = APP.state.days[APP.todayKey];
  const p = day.pomodoro;
  p.mode = mode;
  p.running = false;
  p.remainingSec = mode === "focus" ? 25 * 60 : 5 * 60;
  if (pomoInterval) clearInterval(pomoInterval);
  await saveState();
  renderPomodoro();
}

/* ------------------ Add Items ------------------ */

async function addQuickTask() {
  const text = $("#quickTask").value.trim();
  if (!text) return;

  const day = APP.state.days[APP.todayKey];
  day.tasks.inbox.unshift({
    id: uid(),
    title: text,
    bucket: categorizeTask(text),
    done: false
  });

  $("#quickTask").value = "";
  await saveState();
  renderDashboard();
}

async function addAppointment(area) {
  const title = $(`#${area}ApptTitle`).value.trim();
  const start = $(`#${area}ApptStart`).value;
  const end = $(`#${area}ApptEnd`).value;
  if (!title || !start || !end) return;

  const day = APP.state.days[APP.todayKey];
  day.appointments[area].push({ id: uid(), title, start, end });

  $(`#${area}ApptTitle`).value = "";
  await saveState();
  renderDashboard();
}

/* ------------------ Weekly ------------------ */

function getWeekData() {
  const wk = weekKey(new Date());
  APP.state.weeks[wk] ||= defaultWeek();
  return { wk, data: APP.state.weeks[wk] };
}

function autoPopulateWeekIfEmpty() {
  const { data } = getWeekData();
  const days = getWeekRange(new Date());

  for (const d of days) {
    const iso = todayISO(d);
    data.days[iso] ||= { scheduled: [] };

    if ((data.days[iso].scheduled || []).length === 0) {
      // 1) Prefer exact date map
      let letter = (APP.settings.letterDayByDate && (iso in APP.settings.letterDayByDate))
        ? APP.settings.letterDayByDate[iso]
        : null;

      // 2) Fallback to weekday map if date not found
      if (letter === null) {
        const dow = d.toLocaleDateString(undefined, { weekday: "short" });
        const map = APP.settings.weekLetterMap;
        letter = map[dow] || map[dow.replace(".", "")] || null;
      }

      // Explicit no-school day
      if (letter === null) continue;

      if (letter && APP.settings.letterSchedules[letter]?.length) {
        const blocks = APP.settings.letterSchedules[letter].map(x => ({
          id: uid(),
          kind: "lrc",
          title: `${letter} Day • ${x.title}${x.location ? " (" + x.location + ")" : ""}`,
          startMin: minutesFromHHMM(x.start),
          endMin: minutesFromHHMM(x.end),
          meta: `${x.start}–${x.end}`
        }));
        data.days[iso].scheduled.push(...blocks);
      }
    }
  }
}

function renderWeekly() {
  showUserPill();
  autoPopulateWeekIfEmpty();

  const { data } = getWeekData();
  const days = getWeekRange(new Date());
  const wrap = $("#weekColumns");
  wrap.innerHTML = "";

  for (const d of days) {
    const iso = todayISO(d);

    const col = document.createElement("div");
    col.className = "card";

    const hd = document.createElement("div");
    hd.className = "hd";

    let letter = null;
    const hasDateOverride = APP.settings.letterDayByDate && (iso in APP.settings.letterDayByDate);
    if (hasDateOverride) letter = APP.settings.letterDayByDate[iso];

    const labelExtra =
      hasDateOverride
        ? (letter ? ` • ${letter} Day` : " • No School")
        : "";

    hd.innerHTML = `<h2>${d.toLocaleDateString(undefined, { weekday: "short" })}
      <span class="small">${iso}${labelExtra}</span></h2>`;

    const bd = document.createElement("div");
    bd.className = "bd";

    const tl = document.createElement("div");
    tl.className = "timeline weekTimeline";
    tl.dataset.date = iso; // ✅ needed for renderTimeline to keep data-date on slots

    const blocks = (data.days[iso]?.scheduled || []).map(b => ({
      ...b,
      meta: b.meta || `${hhmmFromMinutes(b.startMin)}–${hhmmFromMinutes(b.endMin)}`
    }));

    renderTimeline(tl, blocks); // ✅ slots keep data-date now

    bd.appendChild(tl);
    col.appendChild(hd);
    col.appendChild(bd);
    wrap.appendChild(col);
  }

  // Weekly inbox
  const day = APP.state.days[APP.todayKey];
  const inbox = $("#weeklyInbox");
  inbox.innerHTML = "";

  if (day.tasks.inbox.length === 0) {
    inbox.innerHTML = `<div class="dropHint">Drag tasks onto a time slot. Add tasks on Dashboard.</div>`;
  } else {
    for (const t of day.tasks.inbox) inbox.appendChild(taskRow(t, "inbox"));
  }
}

/* ------------------ Habits Page ------------------ */

function renderHabitsPage() {
  showUserPill();
  const day = APP.state.days[APP.todayKey];
  ensureHabitCounts(day);

  $("#habitsDate").textContent = fmtDateLong(new Date());

  const wrap = $("#habitsList");
  wrap.innerHTML = "";

  for (const h of APP.settings.habits) {
    const count = day.habits[h.id] || 0;
    const pct = clamp(Math.round((count / h.goalPerDay) * 100), 0, 100);

    const item = document.createElement("div");
    item.className = "habitItem" + (count >= h.goalPerDay ? " habitGreen" : "");

    const left = document.createElement("div");
    left.innerHTML = `<div style="font-weight:800">${h.name}</div>
      <div class="small">Goal: ${h.goalPerDay} ${h.unit} • Today: ${count}</div>`;

    const bar = document.createElement("div");
    bar.className = "progressBar";
    const fill = document.createElement("div");
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "8px";

    const minus = document.createElement("button");
    minus.className = "btn";
    minus.style.minHeight = "44px";
    minus.textContent = "–";
    minus.onclick = async () => {
      day.habits[h.id] = Math.max(0, (day.habits[h.id] || 0) - 1);
      await saveState();
      renderHabitsPage();
    };

    const plus = document.createElement("button");
    plus.className = "btn primary";
    plus.style.minHeight = "44px";
    plus.textContent = "+";
    plus.onclick = async () => {
      day.habits[h.id] = (day.habits[h.id] || 0) + 1;
      await saveState();
      renderHabitsPage();
    };

    btns.append(minus, plus);
    item.append(left, bar, btns);
    wrap.appendChild(item);
  }
}

/* ------------------ Habit History Page ------------------ */

function renderHabitHistory() {
  showUserPill();
  const wrap = $("#habitHistory");
  wrap.innerHTML = "";

  const days = [];
  const start = new Date();
  start.setDate(start.getDate() - 20);
  for (let i = 0; i < 21; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const table = document.createElement("div");
  table.className = "card";

  const hd = document.createElement("div");
  hd.className = "hd";
  hd.innerHTML = `<h2>Habit history (last 21 days)</h2>`;
  table.appendChild(hd);

  const bd = document.createElement("div");
  bd.className = "bd";
  bd.style.overflowX = "auto";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `160px repeat(${days.length}, 44px)`;
  grid.style.gap = "8px";
  grid.style.alignItems = "center";

  grid.appendChild(cellBox("Habit", true));
  for (const d of days) grid.appendChild(cellBox(d.getDate(), true));

  for (const h of APP.settings.habits) {
    grid.appendChild(cellBox(h.name, true));
    for (const d of days) {
      const iso = todayISO(d);
      const day = APP.state.days[iso];
      const count = day?.habits?.[h.id] || 0;
      const ok = count >= h.goalPerDay;

      const box = document.createElement("div");
      box.style.height = "44px";
      box.style.borderRadius = "12px";
      box.style.border = "1px solid rgba(255,255,255,.12)";
      box.style.background = ok ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.04)";
      box.title = `${iso}: ${count}/${h.goalPerDay}`;
      grid.appendChild(box);
    }
  }

  bd.appendChild(grid);
  table.appendChild(bd);
  wrap.appendChild(table);
}

function cellBox(text, header = false) {
  const c = document.createElement("div");
  c.style.height = "44px";
  c.style.display = "grid";
  c.style.placeItems = "center";
  c.style.borderRadius = "12px";
  c.style.border = "1px solid rgba(255,255,255,.12)";
  c.style.background = header ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.03)";
  c.style.fontWeight = header ? "800" : "650";
  c.textContent = text;
  return c;
}

/* ------------------ Settings Page ------------------ */

function renderSettings() {
  showUserPill();

  $("#mapMon").value = APP.settings.weekLetterMap.Mon || "A";
  $("#mapTue").value = APP.settings.weekLetterMap.Tue || "B";
  $("#mapWed").value = APP.settings.weekLetterMap.Wed || "C";
  $("#mapThu").value = APP.settings.weekLetterMap.Thu || "D";
  $("#mapFri").value = APP.settings.weekLetterMap.Fri || "E";

  $("#scheduleJson").value = JSON.stringify(APP.settings.letterSchedules, null, 2);
}

async function saveSettingsFromUI() {
  APP.settings.weekLetterMap = {
    Mon: $("#mapMon").value,
    Tue: $("#mapTue").value,
    Wed: $("#mapWed").value,
    Thu: $("#mapThu").value,
    Fri: $("#mapFri").value
  };

  try {
    const parsed = JSON.parse($("#scheduleJson").value);
    APP.settings.letterSchedules = parsed;
  } catch (e) {
    alert("Schedule JSON is invalid. Fix it and try again.");
    return;
  }

  APP.state.settings = APP.settings;
  await saveState();
  alert("Saved ✅");
}

/* ------------------ Recurring Tasks ------------------ */

function applyRecurringTasksForToday() {
  const day = APP.state.days[APP.todayKey];
  const already = new Set([
    ...day.tasks.home.map(t => t.title),
    ...day.tasks.lrc.map(t => t.title),
    ...day.tasks.inbox.map(t => t.title)
  ]);

  for (const r of APP.settings.recurring.daily) {
    if (!already.has(r.title)) {
      day.tasks.inbox.push({
        id: uid(),
        title: r.title,
        bucket: r.bucket,
        time: r.time,
        done: false
      });
    }
  }
}

/* ------------------ Init Router ------------------ */

async function init() {
  await loadState();
  applyRecurringTasksForToday();
  await saveState();

  const page = document.body.dataset.page;

  if (page === "dashboard") {
    $("#todayDate").textContent = fmtDateLong(new Date());

    $("#addQuickTaskBtn")?.addEventListener("click", addQuickTask);
    $("#addHomeApptBtn")?.addEventListener("click", () => addAppointment("home"));
    $("#addLrcApptBtn")?.addEventListener("click", () => addAppointment("lrc"));

    $("#pomoStart")?.addEventListener("click", togglePomodoro);
    $("#pomoFocus")?.addEventListener("click", () => resetPomodoro("focus"));
    $("#pomoBreak")?.addEventListener("click", () => resetPomodoro("break"));

    renderDashboard();
  }

  if (page === "weekly") renderWeekly();
  if (page === "habits") renderHabitsPage();
  if (page === "habitHistory") renderHabitHistory();

  if (page === "settings") {
    $("#saveSettingsBtn")?.addEventListener("click", saveSettingsFromUI);
    renderSettings();
  }
}

window.addEventListener("DOMContentLoaded", init);
