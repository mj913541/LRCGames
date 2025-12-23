// ---------------------------
// Constants
// ---------------------------
const ZONES = ["Morning", "Work Open", "Midday", "Work Close", "Arrive Home", "Bedtime"];

const LETTER_SCHEDULE = {
  "A Day": [
    "9:05–9:50 • 4th Rosenthal",
    "10:05–10:50 • 2nd Peterson",
    "11:05–11:50 • 3rd Hossain",
    "1:45–2:30 • 5th Altruismo",
    "2:45–3:30 • 1st Rogers"
  ],
  "B Day": [
    "9:05–9:50 • 4th Cavello",
    "10:05–10:50 • 2nd Schmidt",
    "1:45–2:30 • 5th Isibindi"
  ],
  "C Day": [
    "8:45–9:05 • AM Duty & Opening",
    "10:05–10:50 • 2nd Adams",
    "11:05–12:05 • 3rd Pulsa",
    "1:45–2:30 • 5th Amistad"
  ],
  "D Day": [
    "9:20–10:05 • HC 5th Green",
    "10:05–10:50 • HC 1st Green",
    "2:45–3:30 • 1st Wilson"
  ],
  "E Day": [
    "9:05–9:50 • 4th Tomter",
    "11:05–12:05 • 3rd Carroll",
    "1:45–2:30 • 5th Reveur",
    "2:45–3:30 • 1st Day"
  ],
  "Break Day": []
};

// Bodyweight tracker list
const BODY_TRACKERS = [
  { key: "steps", label: "Steps", unit: "steps", target: 2000, step: 250 },
  { key: "lunges", label: "Lunges", unit: "reps", target: 20, step: 5 },
  { key: "squats", label: "Squats", unit: "reps", target: 20, step: 5 },
  { key: "wallPushups", label: "Wall push-ups", unit: "reps", target: 20, step: 5 },
  { key: "pushups", label: "Push-ups", unit: "reps", target: 20, step: 5 },
  { key: "gluteBridges", label: "Glute bridges", unit: "reps", target: 20, step: 5 },
  { key: "calfRaises", label: "Calf raises", unit: "reps", target: 20, step: 5 },
  { key: "plankSeconds", label: "Plank", unit: "sec", target: 60, step: 10 },
  { key: "birdDogs", label: "Bird dogs", unit: "reps", target: 20, step: 5 },
  { key: "deadBugs", label: "Dead bugs", unit: "reps", target: 20, step: 5 }
];

// Work Open anchor times
const WORK_OPEN_ANCHOR = {
  default: { h: 8, m: 55 },    // A/B/C/E
  "D Day": { h: 14, m: 30 }    // D
};

const MIDDAY_ANCHOR = { h: 12, m: 5 };
const BEDTIME_ANCHOR = { h: 21, m: 0 };

// ---------------------------
// Helpers
// ---------------------------
function pad2(n){ return String(n).padStart(2, "0"); }
function dateKey(d = new Date()) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function dayName(d = new Date()) { return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()]; }

function isDaycareDayByName(name) { return name === "Tuesday" || name === "Thursday" || name === "Friday"; }
function isThursdayByName(name) { return name === "Thursday"; }
function defaultTherapyTonightByName(name) { return (name === "Monday" || name === "Tuesday") ? "Yes" : "No"; }

function splitLines(text) { return String(text || "").split("\n").map(s => s.trim()).filter(Boolean); }
function safeId(str) { return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

function parseZonedLine(line) {
  const m = line.match(/^\[(.+?)\]\s*(.+)$/);
  if (!m) return { zone: "Morning", text: line };
  const zoneRaw = m[1].trim();
  const text = m[2].trim();
  const zone = ZONES.includes(zoneRaw) ? zoneRaw : "Morning";
  return { zone, text };
}

function coerceInt(n, fallback = 0) {
  const x = parseInt(n, 10);
  return Number.isFinite(x) && x >= 0 ? x : fallback;
}
function coerceEnergy(n, fallback = 3) {
  const x = parseInt(n, 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(5, Math.max(1, x));
}

function minutesFrom(h, m){ return h*60 + m; }

function parseTimeStartMinutes(line){
  const m = String(line).match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h1 = parseInt(m[1], 10);
  const min1 = parseInt(m[2], 10);
  if (h1 <= 3) h1 += 12;
  return h1*60 + min1;
}

function parseTimeEndMinutes(line){
  const m = String(line).match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h2 = parseInt(m[3], 10);
  const min2 = parseInt(m[4], 10);
  if (h2 <= 3) h2 += 12;
  return h2*60 + min2;
}

function formatMinutes(mins){
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${pad2(m)} ${ampm}`;
}

function tomorrowKeyFrom(keyStr){
  const [y,m,d] = keyStr.split("-").map(n => parseInt(n,10));
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + 1);
  return dateKey(dt);
}

// ---------------------------
// Storage
// ---------------------------
const STORE_KEY = "adhdDashboardData_v8";
const TPL_KEY   = "adhdDashboardTemplates_v7";
const PREF_KEY  = "adhdDashboardPrefs_v4";

const today = new Date();
const KEY = dateKey(today);

function loadStore() { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
function saveStore(store) { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }

function loadPrefs(){
  const p = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
  return p || {
    onlyUnchecked: false,
    zoneVisibility: Object.fromEntries(ZONES.map(z => [z, true]))
  };
}
function savePrefs(p){ localStorage.setItem(PREF_KEY, JSON.stringify(p)); }

function getDayData(key = KEY) {
  const store = loadStore();
  return store[key] || {
    taskState: {},
    trackers: {},
    priorities: ["","",""],
    school: { state: {}, customAppts: "" }
  };
}

function setDayData(patch, key = KEY) {
  const store = loadStore();
  const current = getDayData(key);

  store[key] = {
    ...current,
    ...patch,
    taskState: { ...(current.taskState || {}), ...(patch.taskState || {}) },
    trackers:  { ...(current.trackers  || {}), ...(patch.trackers  || {}) },
    school:    { ...(current.school    || {}), ...(patch.school    || {}) }
  };

  saveStore(store);
}

// ---------------------------
// Templates
// ---------------------------
function loadTemplates() {
  const saved = JSON.parse(localStorage.getItem(TPL_KEY) || "null");
  if (saved) return saved;

  const defaults = {
    daily: [
      "[Morning] Take meds / vitamins",
      "[Morning] Feed cat & refresh water",

      "[Work Open] Projector on",
      "[Work Open] Sign in",
      "[Work Open] Pull up Destiny Discover for class",
      "[Work Open] Name tags out",
      "[Work Open] Lunch away",

      "[Midday] Eat something (real enough)",

      "[Work Close] 5-minute classroom straighten",
      "[Work Close] Everything signed out and off",
      "[Work Close] Plug in Chromebooks",
      "[Work Close] Name tags away",
      "[Work Close] Desk cleared"
    ].join("\n"),
    daycare: ["[Morning] Prep daycare bag"].join("\n"),
    thursday: ["[Arrive Home] Trash / recycling out"].join("\n"),
    therapyNight: [
      "[Arrive Home] Therapy night: easy food + comfort only",
      "[Bedtime] No extra tasks after therapy (sleep is the win)"
    ].join("\n"),
    hygiene: [
      "[Morning] Brush teeth + wash face",
      "[Morning] Deodorant",
      "[Arrive Home] Shower (or quick rinse)",
      "[Bedtime] Brush teeth + floss"
    ].join("\n"),
    carryover: [
      "[Arrive Home] Dishes",
      "[Arrive Home] Start laundry"
    ].join("\n")
  };

  localStorage.setItem(TPL_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveTemplates(tpl) { localStorage.setItem(TPL_KEY, JSON.stringify(tpl)); }

// ---------------------------
// DOM
// ---------------------------
const elDateLine = document.getElementById("dateLine");

const elDow = document.getElementById("dow");
const elLetter = document.getElementById("letterDay");
const elDayType = document.getElementById("dayType");
const elTherapy = document.getElementById("therapy");
const elTherapyHint = document.getElementById("therapyHint");

const prio1 = document.getElementById("prio1");
const prio2 = document.getElementById("prio2");
const prio3 = document.getElementById("prio3");

const zonesWrap = document.getElementById("zonesWrap");
const donePill = document.getElementById("donePill");
const mergedPill = document.getElementById("mergedPill");
const mergedWrap = document.getElementById("mergedWrap");

const zoneToggles = document.getElementById("zoneToggles");

const schoolWrap = document.getElementById("schoolWrap");
const schoolPill = document.getElementById("schoolPill");
const customAppts = document.getElementById("customAppts");

const elNotToday = document.getElementById("notToday");

const tplDaily = document.getElementById("tplDaily");
const tplDaycare = document.getElementById("tplDaycare");
const tplThursday = document.getElementById("tplThursday");
const tplTherapyNight = document.getElementById("tplTherapyNight");
const tplHygiene = document.getElementById("tplHygiene");
const tplCarryover = document.getElementById("tplCarryover");

const saveTplBtn = document.getElementById("saveTplBtn");
const customizeDetails = document.getElementById("customizeDetails");

const onlyUnchecked = document.getElementById("onlyUnchecked");

const startHereBtn = document.getElementById("startHereBtn");
const rolloverBtn = document.getElementById("rolloverBtn");
const saveBtn = document.getElementById("saveBtn");

const expandAllCardsBtn = document.getElementById("expandAllCardsBtn");
const collapseAllCardsBtn = document.getElementById("collapseAllCardsBtn");

// Trackers
const elWaterCount = document.getElementById("waterCount");
const elWaterMinus = document.getElementById("waterMinus");
const elWaterPlus  = document.getElementById("waterPlus");
const elWaterPill  = document.getElementById("waterPill");

const elMoveMinutes = document.getElementById("moveMinutes");
const elMovePill = document.getElementById("movePill");

const elMood = document.getElementById("mood");
const elMoodPill = document.getElementById("moodPill");

const elEnergy = document.getElementById("energy");
const elEnergyPill = document.getElementById("energyPill");

const streakPill = document.getElementById("streakPill");
const waterStreakLine = document.getElementById("waterStreakLine");
const moveStreakLine = document.getElementById("moveStreakLine");

const bodyTrackersWrap = document.getElementById("bodyTrackersWrap");

const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");

const allCardDetails = Array.from(document.querySelectorAll(".cardDetails"));

// ---------------------------
// Tasks (Hygiene ALWAYS INCLUDED)
// ---------------------------
function buildTasks() {
  const t = loadTemplates();
  const tasks = [];

  const selectedDow = elDow.value || dayName(today);
  const selectedTherapy = elTherapy.value || defaultTherapyTonightByName(selectedDow);

  const daycare = isDaycareDayByName(selectedDow);
  const thursday = isThursdayByName(selectedDow);
  const therapyNight = (selectedTherapy === "Yes");

  splitLines(t.daily).forEach(line => {
    const parsed = parseZonedLine(line);
    tasks.push({ id: "daily-" + safeId(parsed.zone + "-" + parsed.text), zone: parsed.zone, text: parsed.text });
  });

  if (daycare) {
    splitLines(t.daycare).forEach(line => {
      const parsed = parseZonedLine(line);
      tasks.push({ id: "daycare-" + safeId(parsed.zone + "-" + parsed.text), zone: parsed.zone, text: parsed.text });
    });
  }

  if (thursday) {
    splitLines(t.thursday).forEach(line => {
      const parsed = parseZonedLine(line);
      tasks.push({ id: "thu-" + safeId(parsed.zone + "-" + parsed.text), zone: parsed.zone, text: parsed.text });
    });
  }

  if (therapyNight) {
    splitLines(t.therapyNight).forEach(line => {
      const parsed = parseZonedLine(line);
      tasks.push({ id: "ther-" + safeId(parsed.zone + "-" + parsed.text), zone: parsed.zone, text: parsed.text });
    });
  }

  splitLines(t.hygiene).forEach(line => {
    const parsed = parseZonedLine(line);
    tasks.push({ id: "hyg-" + safeId(parsed.zone + "-" + parsed.text), zone: parsed.zone, text: parsed.text });
  });

  splitLines(t.carryover || "").forEach(line => {
    const parsed = parseZonedLine(line);
    tasks.push({ id: "car-" + safeId(parsed.zone + "-" + parsed.text), zone: parsed.zone, text: parsed.text });
  });

  const seen = new Set();
  return tasks.filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

function getVisibleZones(prefs){
  return ZONES.filter(z => prefs.zoneVisibility?.[z] !== false);
}

// ---------------------------
// Render MUST DO
// ---------------------------
function renderZones() {
  const data = getDayData();
  const prefs = loadPrefs();
  const state = data.taskState || {};
  const tasks = buildTasks();

  zonesWrap.innerHTML = "";

  const visibleZones = getVisibleZones(prefs);
  const byZone = {};
  ZONES.forEach(z => byZone[z] = []);
  tasks.forEach(t => (byZone[t.zone] || byZone["Morning"]).push(t));

  let total = 0;
  let done = 0;

  visibleZones.forEach(zone => {
    const listAll = byZone[zone] || [];
    const list = prefs.onlyUnchecked ? listAll.filter(t => !state[t.id]) : listAll;
    if (!list.length) return;

    const zoneDiv = document.createElement("div");
    zoneDiv.className = "zone";

    const header = document.createElement("div");
    header.className = "zoneHeader";

    const left = document.createElement("div");
    left.textContent = zone;

    const countSpan = document.createElement("span");
    countSpan.className = "pill";
    const zTotal = listAll.length;
    const zDone = listAll.reduce((acc, t) => acc + (state[t.id] ? 1 : 0), 0);
    countSpan.textContent = `${zDone} / ${zTotal}`;

    header.appendChild(left);
    header.appendChild(countSpan);
    zoneDiv.appendChild(header);

    list.forEach(task => {
      total++;
      const checked = !!state[task.id];
      if (checked) done++;

      const row = document.createElement("div");
      row.className = "task";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checked;
      cb.addEventListener("change", () => {
        setDayData({ taskState: { [task.id]: cb.checked } });
        renderZones();
        renderMergedDay();
      });

      const main = document.createElement("div");
      main.className = "taskMain";

      const text = document.createElement("div");
      text.className = "taskText";
      text.textContent = task.text;

      main.appendChild(text);
      row.appendChild(cb);
      row.appendChild(main);
      zoneDiv.appendChild(row);
    });

    zonesWrap.appendChild(zoneDiv);
  });

  donePill.textContent = `${done} / ${total}`;
}

// ---------------------------
// School checklist
// ---------------------------
function renderSchoolChecklist(){
  const data = getDayData();
  const letter = elLetter.value || data.letterDay || "Break Day";
  const items = [...(LETTER_SCHEDULE[letter] || [])];

  const custom = splitLines((data.school?.customAppts ?? ""));
  custom.forEach(line => items.push(`🗓️ ${line}`));

  const state = (data.school?.state) || {};
  schoolWrap.innerHTML = "";

  let total = 0, done = 0;

  items.forEach((label, idx) => {
    total++;
    const id = `school-${safeId(letter)}-${idx}-${safeId(label)}`;
    const checked = !!state[id];
    if (checked) done++;

    const row = document.createElement("div");
    row.className = "task";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = checked;
    cb.addEventListener("change", () => {
      const current = getDayData().school || { state: {}, customAppts: "" };
      setDayData({ school: { ...current, state: { ...(current.state||{}), [id]: cb.checked } } });
      renderSchoolChecklist();
      renderMergedDay();
    });

    const main = document.createElement("div");
    main.className = "taskMain";

    const text = document.createElement("div");
    text.className = "taskText";
    text.textContent = label;

    main.appendChild(text);
    row.appendChild(cb);
    row.appendChild(main);
    schoolWrap.appendChild(row);
  });

  schoolPill.textContent = `${done} / ${total}`;

  if (document.activeElement !== customAppts) {
    customAppts.value = data.school?.customAppts || "";
  }
}

// ---------------------------
// Zone toggles
// ---------------------------
function renderZoneToggles(){
  const prefs = loadPrefs();
  zoneToggles.innerHTML = "";

  ZONES.forEach(z => {
    const pill = document.createElement("div");
    pill.className = "zoneTogglePill";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = prefs.zoneVisibility?.[z] !== false;

    cb.addEventListener("change", () => {
      const p2 = loadPrefs();
      p2.zoneVisibility = { ...(p2.zoneVisibility || {}), [z]: cb.checked };
      savePrefs(p2);
      renderZones();
      renderMergedDay();
    });

    const txt = document.createElement("div");
    txt.textContent = z;

    pill.appendChild(cb);
    pill.appendChild(txt);
    zoneToggles.appendChild(pill);
  });
}

// ---------------------------
// Merged Day
// ---------------------------
function getLetterDay(){
  const data = getDayData();
  return elLetter.value || data.letterDay || "Break Day";
}

function getWorkOpenAnchorMinutes(letterDay){
  const a = (letterDay === "D Day") ? WORK_OPEN_ANCHOR["D Day"] : WORK_OPEN_ANCHOR.default;
  return minutesFrom(a.h, a.m);
}

function buildScheduleEvents(){
  const letter = getLetterDay();
  const base = (LETTER_SCHEDULE[letter] || []).map((line, idx) => {
    const start = parseTimeStartMinutes(line);
    const end = parseTimeEndMinutes(line);
    return {
      id: `sched-${safeId(letter)}-${idx}-${safeId(line)}`,
      label: line,
      startMin: start ?? 9999,
      endMin: end ?? (start ?? 9999) + 30
    };
  });

  const data = getDayData();
  const customLines = splitLines(data.school?.customAppts || "");
  const custom = customLines.map((line, idx) => {
    const m = line.match(/^(\d{1,2}):(\d{2})\s*(.*)$/);
    let start = 9998 + idx;
    if (m){
      let h = parseInt(m[1],10);
      const mm = parseInt(m[2],10);
      if (h <= 3) h += 12;
      start = h*60 + mm;
    }
    return {
      id: `cust-${idx}-${safeId(line)}`,
      label: `🗓️ ${line}`,
      startMin: start,
      endMin: start + 20
    };
  });

  return [...base, ...custom].sort((a,b) => a.startMin - b.startMin);
}

function groupTasksByZone(tasks, visibleZones){
  const byZone = {};
  visibleZones.forEach(z => byZone[z] = []);
  tasks.forEach(t => {
    if (!visibleZones.includes(t.zone)) return;
    (byZone[t.zone] ||= []).push(t);
  });
  return byZone;
}

function addMergedBlock(container, mins, label, tagText){
  const block = document.createElement("div");
  block.className = "mergedBlock";

  const head = document.createElement("div");
  head.className = "mergedHead";

  const left = document.createElement("div");
  left.innerHTML = `<span class="mergedTime">${formatMinutes(mins)}</span> • <span class="mergedLabel">${label}</span>`;

  const tag = document.createElement("div");
  tag.className = "mergedTag";
  tag.textContent = tagText;

  head.appendChild(left);
  head.appendChild(tag);
  block.appendChild(head);

  container.appendChild(block);
  return block;
}

function renderMergedDay(){
  const data = getDayData();
  const prefs = loadPrefs();
  const taskState = data.taskState || {};
  const visibleZones = getVisibleZones(prefs);

  const schedule = buildScheduleEvents();
  const tasks = buildTasks();
  const tasksByZone = groupTasksByZone(tasks, visibleZones);

  mergedWrap.innerHTML = "";

  const firstSched = schedule.length ? schedule[0].startMin : minutesFrom(8, 45);
  const lastSchedEnd = schedule.length ? Math.max(...schedule.map(s => s.endMin || s.startMin)) : minutesFrom(15, 30);

  const letter = getLetterDay();
  const workOpenMin = getWorkOpenAnchorMinutes(letter);
  const middayMin = minutesFrom(MIDDAY_ANCHOR.h, MIDDAY_ANCHOR.m);
  const bedtimeMin = minutesFrom(BEDTIME_ANCHOR.h, BEDTIME_ANCHOR.m);

  const anchors = [
    { zone: "Morning", mins: Math.max(0, firstSched - 5), label: "Morning" },
    { zone: "Work Open", mins: workOpenMin, label: "Work Open" },
    { zone: "Midday", mins: middayMin, label: "Midday" },
    { zone: "Work Close", mins: Math.max(lastSchedEnd, minutesFrom(15,0)), label: "Work Close" },
    { zone: "Arrive Home", mins: Math.max(lastSchedEnd + 20, minutesFrom(16,0)), label: "Arrive Home" },
    { zone: "Bedtime", mins: bedtimeMin, label: "Bedtime" }
  ].filter(a => visibleZones.includes(a.zone));

  const combined = [];
  schedule.forEach(s => combined.push({ kind: "schedule", mins: s.startMin, event: s }));
  anchors.forEach(a => combined.push({ kind: "zone", mins: a.mins, zone: a.zone, label: a.label }));

  combined.sort((a,b) => a.mins - b.mins);

  let mergedTotal = 0;
  let mergedDone = 0;

  combined.forEach(item => {
    if (item.kind === "schedule"){
      const b = addMergedBlock(mergedWrap, item.mins, item.event.label, "Schedule");
      b.style.borderColor = "rgba(127,209,185,0.28)";
      return;
    }

    const zone = item.zone;
    const zoneTasksAll = (tasksByZone[zone] || []);
    const zoneTasks = prefs.onlyUnchecked ? zoneTasksAll.filter(t => !taskState[t.id]) : zoneTasksAll;
    if (!zoneTasksAll.length) return;

    const block = addMergedBlock(mergedWrap, item.mins, zone, "Must Do");

    const wrap = document.createElement("div");
    wrap.className = "mergedTasks";

    zoneTasks.forEach(t => {
      mergedTotal++;
      const checked = !!taskState[t.id];
      if (checked) mergedDone++;

      const row = document.createElement("div");
      row.className = "task";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checked;
      cb.addEventListener("change", () => {
        setDayData({ taskState: { [t.id]: cb.checked } });
        renderZones();
        renderMergedDay();
      });

      const main = document.createElement("div");
      main.className = "taskMain";

      const text = document.createElement("div");
      text.className = "taskText";
      text.textContent = t.text;

      main.appendChild(text);
      row.appendChild(cb);
      row.appendChild(main);
      wrap.appendChild(row);
    });

    block.appendChild(wrap);
  });

  mergedPill.textContent = `${mergedDone} / ${mergedTotal}`;
}

// ---------------------------
// Trackers + streaks
// ---------------------------
function streakCount(checkFn){
  const store = loadStore();
  let count = 0;
  let cursor = new Date(today);
  for (let i=0; i<365; i++){
    const k = dateKey(cursor);
    const day = store[k];
    if (!day) break;
    if (!checkFn(day)) break;
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function setTracker(key, value) {
  setDayData({ trackers: { [key]: value } });
  renderTrackers();
}

function renderBodyTrackers(){
  if (!bodyTrackersWrap) return;
  const data = getDayData();
  const tr = data.trackers || {};

  bodyTrackersWrap.innerHTML = "";

  BODY_TRACKERS.forEach(item => {
    const current = coerceInt(tr[item.key], 0);
    const pct = item.target > 0 ? Math.min(999, Math.round((current / item.target) * 100)) : 0;

    const card = document.createElement("div");
    card.className = "trackerCard";

    const head = document.createElement("div");
    head.className = "trackerHead";

    const title = document.createElement("div");
    title.className = "trackerTitle";
    title.textContent = item.label;

    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = `${current} / ${item.target} • ${pct}%`;

    head.appendChild(title);
    head.appendChild(pill);

    const hint = document.createElement("div");
    hint.className = "small muted";
    hint.textContent = `Tap to build toward ${item.target}.`;

    const stepper = document.createElement("div");
    stepper.className = "stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "stepBtn";
    minus.textContent = "−";
    minus.addEventListener("click", () => {
      const next = Math.max(0, coerceInt(getDayData().trackers?.[item.key], 0) - item.step);
      setTracker(item.key, next);
    });

    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "0";
    input.step = String(item.step);
    input.value = String(current);
    input.addEventListener("input", () => setTracker(item.key, coerceInt(input.value, 0)));

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "stepBtn";
    plus.textContent = "+";
    plus.addEventListener("click", () => {
      const next = coerceInt(getDayData().trackers?.[item.key], 0) + item.step;
      setTracker(item.key, next);
    });

    stepper.appendChild(minus);
    stepper.appendChild(input);
    stepper.appendChild(plus);

    card.appendChild(head);
    card.appendChild(hint);
    card.appendChild(stepper);

    bodyTrackersWrap.appendChild(card);
  });
}

function renderTrackers() {
  const data = getDayData();
  const tr = data.trackers || {};

  const water = coerceInt(tr.water, 0);
  elWaterCount.value = String(water);
  elWaterPill.textContent = String(water);

  const move = coerceInt(tr.moveMinutes, 0);
  elMoveMinutes.value = String(move);
  elMovePill.textContent = `${move} min`;

  elMood.value = tr.mood || "";
  elMoodPill.textContent = tr.mood ? tr.mood : "—";

  const energy = coerceEnergy(tr.energy, 3);
  elEnergy.value = String(energy);
  elEnergyPill.textContent = `${energy}/5`;

  const waterStreak = streakCount(day => coerceInt(day.trackers?.water, 0) >= 4);
  const moveStreak  = streakCount(day => coerceInt(day.trackers?.moveMinutes, 0) >= 10);

  streakPill.textContent = `Streaks: 💧${waterStreak}  🏃${moveStreak}`;
  waterStreakLine.textContent = `Streak (≥4): ${waterStreak} day(s)`;
  moveStreakLine.textContent  = `Streak (≥10 min): ${moveStreak} day(s)`;

  renderBodyTrackers();
}

// ---------------------------
// Backup / Restore
// ---------------------------
function exportJSON(){
  const payload = {
    STORE_KEY, TPL_KEY, PREF_KEY,
    store: loadStore(),
    templates: JSON.parse(localStorage.getItem(TPL_KEY) || "{}"),
    prefs: loadPrefs()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adhd-dashboard-backup-${KEY}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const payload = JSON.parse(String(reader.result || "{}"));
      if (payload.store) localStorage.setItem(STORE_KEY, JSON.stringify(payload.store));
      if (payload.templates) localStorage.setItem(TPL_KEY, JSON.stringify(payload.templates));
      if (payload.prefs) localStorage.setItem(PREF_KEY, JSON.stringify(payload.prefs));
      alert("Import complete ✅");
      loadUI();
    }catch(e){
      alert("Import failed. That file didn’t look like a dashboard backup.");
    }
  };
  reader.readAsText(file);
}

// ---------------------------
// Collapse/Expand all cards
// ---------------------------
function setAllCards(open){
  allCardDetails.forEach(d => d.open = !!open);
}

// ---------------------------
// Rollover to tomorrow
// ---------------------------
function rolloverToTomorrow(){
  const todayData = getDayData();
  const tomorrowKey = tomorrowKeyFrom(KEY);
  const tomorrowData = getDayData(tomorrowKey);

  const notToday = (todayData.notToday || "").trim();
  const nextNotToday = (tomorrowData.notToday || "").trim();
  const mergedNotToday = [nextNotToday, notToday].filter(Boolean).join("\n");

  const pri = todayData.priorities || ["","",""];
  const tPri = tomorrowData.priorities || ["","",""];
  const carriedPri = [
    tPri[0] || pri[0] || "",
    tPri[1] || pri[1] || "",
    tPri[2] || pri[2] || ""
  ];

  setDayData({ notToday: mergedNotToday, priorities: carriedPri }, tomorrowKey);
  alert("Rollover saved to tomorrow ✅");
}

// ---------------------------
// Templates save
// ---------------------------
function saveTpls() {
  saveTemplates({
    daily: tplDaily.value,
    daycare: tplDaycare.value,
    thursday: tplThursday.value,
    therapyNight: tplTherapyNight.value,
    hygiene: tplHygiene.value,
    carryover: tplCarryover.value
  });
  renderZones();
  renderMergedDay();
  alert("Templates saved.");
}

// ---------------------------
// Start Here
// ---------------------------
function startHere(){
  const data = getDayData();

  if (!elDow.value) elDow.value = dayName(today);
  if (!elTherapy.value) elTherapy.value = defaultTherapyTonightByName(elDow.value);
  if (!elLetter.value) elLetter.value = data.letterDay || "Break Day";

  setDayData({
    dow: elDow.value,
    therapy: elTherapy.value,
    letterDay: elLetter.value,
    dayType: elDayType.value || "Normal"
  });

  renderSchoolChecklist();
  renderZoneToggles();
  renderZones();
  renderMergedDay();

  const first = document.querySelector("#cardMerged");
  if (first) first.scrollIntoView({ behavior:"smooth", block:"start" });
}

// ---------------------------
// Load UI
// ---------------------------
function loadUI() {
  elDateLine.textContent = `Saved per day • Today is ${today.toDateString()}`;

  const t = loadTemplates();
  tplDaily.value = t.daily || "";
  tplDaycare.value = t.daycare || "";
  tplThursday.value = t.thursday || "";
  tplTherapyNight.value = t.therapyNight || "";
  tplHygiene.value = t.hygiene || "";
  tplCarryover.value = t.carryover || "";

  const data = getDayData();
  elDow.value = data.dow || dayName(today);
  elLetter.value = data.letterDay || "Break Day";
  elDayType.value = data.dayType || "Normal";
  elTherapy.value = data.therapy || defaultTherapyTonightByName(elDow.value);
  elNotToday.value = data.notToday || "";

  const pri = data.priorities || ["","",""];
  prio1.value = pri[0] || "";
  prio2.value = pri[1] || "";
  prio3.value = pri[2] || "";

  const prefs = loadPrefs();
  onlyUnchecked.checked = !!prefs.onlyUnchecked;

  // Customize hidden by default
  if (customizeDetails) customizeDetails.open = false;

  const defTher = defaultTherapyTonightByName(elDow.value);
  elTherapyHint.textContent = (defTher === "Yes") ? "Default therapy night for Mon/Tue. Override if needed." : "";

  renderZoneToggles();
  renderSchoolChecklist();
  renderTrackers();
  renderZones();
  renderMergedDay();
}

// ---------------------------
// Events
// ---------------------------
elDow.addEventListener("change", () => {
  if (!getDayData().therapy) elTherapy.value = defaultTherapyTonightByName(elDow.value);
  setDayData({ dow: elDow.value, therapy: elTherapy.value });
  renderZones();
  renderMergedDay();
});

elLetter.addEventListener("change", () => {
  setDayData({ letterDay: elLetter.value });
  renderSchoolChecklist();
  renderMergedDay();
});

elDayType.addEventListener("change", () => setDayData({ dayType: elDayType.value }));

elTherapy.addEventListener("change", () => {
  setDayData({ therapy: elTherapy.value });
  renderZones();
  renderMergedDay();
});

customAppts.addEventListener("input", () => {
  const current = getDayData().school || { state: {}, customAppts: "" };
  setDayData({ school: { ...current, customAppts: customAppts.value } });
  renderSchoolChecklist();
  renderMergedDay();
});

elNotToday.addEventListener("input", () => setDayData({ notToday: elNotToday.value }));

function savePriorities(){
  setDayData({ priorities: [prio1.value, prio2.value, prio3.value] });
}
[prio1, prio2, prio3].forEach(el => el.addEventListener("input", savePriorities));

saveTplBtn.addEventListener("click", saveTpls);
startHereBtn.addEventListener("click", startHere);

rolloverBtn.addEventListener("click", () => {
  const ok = confirm("Rollover Parking Lot + Priorities to tomorrow?");
  if (ok) rolloverToTomorrow();
});

saveBtn.addEventListener("click", () => {
  setDayData({
    dow: elDow.value,
    letterDay: elLetter.value,
    dayType: elDayType.value,
    therapy: elTherapy.value,
    notToday: elNotToday.value,
    savedAt: Date.now()
  });
  alert("Saved.");
});

onlyUnchecked.addEventListener("change", () => {
  const p = loadPrefs();
  p.onlyUnchecked = !!onlyUnchecked.checked;
  savePrefs(p);
  renderZones();
  renderMergedDay();
});

// trackers
elWaterMinus.addEventListener("click", () => setTracker("water", Math.max(0, coerceInt(elWaterCount.value, 0) - 1)));
elWaterPlus.addEventListener("click", () => setTracker("water", coerceInt(elWaterCount.value, 0) + 1));
elWaterCount.addEventListener("input", () => setTracker("water", coerceInt(elWaterCount.value, 0)));

elMoveMinutes.addEventListener("input", () => setTracker("moveMinutes", coerceInt(elMoveMinutes.value, 0)));
elMood.addEventListener("change", () => setTracker("mood", elMood.value));
elEnergy.addEventListener("input", () => setTracker("energy", coerceEnergy(elEnergy.value, 3)));

exportBtn.addEventListener("click", exportJSON);
importFile.addEventListener("change", () => {
  const f = importFile.files && importFile.files[0];
  if (f) importJSON(f);
});

expandAllCardsBtn.addEventListener("click", () => setAllCards(true));
collapseAllCardsBtn.addEventListener("click", () => setAllCards(false));

// ---------------------------
// Boot
// ---------------------------
loadUI();
