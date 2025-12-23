// dashboard.js (FIXED)
// Cloud-save (Google Auth + Firestore) + Color Day pill + Merged Day + Hide checked in merged

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* =========================
   ✅ PASTE YOUR REAL CONFIG
   ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyDTKYFcm26i0LsrLo9UjtLnZpNKx4XsWG4",
  authDomain: "lrcquest-3039e.firebaseapp.com",
  projectId: "lrcquest-3039e",
  storageBucket: "lrcquest-3039e.firebasestorage.app",
  messagingSenderId: "72063656342",
  appId: "1:72063656342:web:bc08c6538437f50b53bdb7",
  measurementId: "G-5VXRYJ733C"
};


const ALLOWED_EMAILS = new Set([
  "malbrecht@sd308.org",
  "malbrecht3317@gmail.com"
]);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
let currentUser = null;

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

// Your mapping: Therapy=Red, A=Red, B/C/E=Yellow, D=Green
const COLOR_DAY_BY_LETTER = {
  "A Day": "Red Day",
  "B Day": "Yellow Day",
  "C Day": "Yellow Day",
  "D Day": "Green Day",
  "E Day": "Yellow Day",
  "Break Day": "—"
};

function workOpenStart(letterDay){
  return (letterDay === "D Day") ? "2:30" : "8:55";
}

// Body trackers
const BODY_TRACKERS = [
  { key: "steps", label: "Steps", target: 2000, step: 250 },
  { key: "lunges", label: "Lunges", target: 20, step: 5 },
  { key: "squats", label: "Squats", target: 20, step: 5 },
  { key: "wallPushups", label: "Wall push-ups", target: 20, step: 5 },
  { key: "pushups", label: "Push-ups", target: 20, step: 5 },
  { key: "gluteBridges", label: "Glute bridges", target: 20, step: 5 },
  { key: "calfRaises", label: "Calf raises", target: 20, step: 5 },
  { key: "plankSeconds", label: "Plank (seconds)", target: 60, step: 10 }
];

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
function debounce(fn, ms=500){
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function toMinutes(hm){
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 9999;
  const h = parseInt(m[1],10);
  const min = parseInt(m[2],10);
  return h*60 + min;
}

function parseScheduleStartTime(line){
  const m = String(line).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

// ✅ ONE consistent ID function for schedule lines
function scheduleItemId(letter, idx, label){
  return `school-${safeId(letter)}-${idx}-${safeId(label)}`;
}

// ---------------------------
// Firestore paths
// ---------------------------
const today = new Date();
const KEY = dateKey(today);

function dayDocRef(key) { return doc(db, "plannerDashboards", currentUser.uid, "days", key); }
function templatesDocRef() { return doc(db, "plannerDashboards", currentUser.uid, "meta", "templates"); }
function prefsDocRef() { return doc(db, "plannerDashboards", currentUser.uid, "meta", "prefs"); }

// ---------------------------
// Cloud caches
// ---------------------------
let dayCache = null;
let templatesCache = null;
let prefsCache = null;

function defaultDayData(){
  return {
    taskState: {},
    trackers: {},
    priorities: ["","",""],
    school: { state: {}, customAppts: "" },
    notToday: "",
    dow: "",
    letterDay: "",
    dayType: "Normal",
    therapy: ""
  };
}

function defaultTemplates(){
  return {
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
}

function defaultPrefs(){
  return {
    onlyUnchecked: false,
    mergedHideChecked: false,
    zoneVisibility: Object.fromEntries(ZONES.map(z => [z, true]))
  };
}

async function getOrCreate(ref, defaults){
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  await setDoc(ref, defaults, { merge: true });
  return defaults;
}

async function loadCloudCaches(){
  dayCache = await getOrCreate(dayDocRef(KEY), defaultDayData());
  templatesCache = await getOrCreate(templatesDocRef(), defaultTemplates());
  prefsCache = await getOrCreate(prefsDocRef(), defaultPrefs());
}

async function setDayPatch(patch){
  const cur = dayCache || defaultDayData();
  dayCache = {
    ...cur,
    ...patch,
    taskState: { ...(cur.taskState||{}), ...(patch.taskState||{}) },
    trackers:  { ...(cur.trackers||{}),  ...(patch.trackers||{})  },
    school:    { ...(cur.school||{}),    ...(patch.school||{})    }
  };
  await setDoc(dayDocRef(KEY), { ...patch, savedAt: Date.now() }, { merge: true });
}

async function setTemplates(tpl){
  templatesCache = { ...(templatesCache||defaultTemplates()), ...tpl };
  await setDoc(templatesDocRef(), templatesCache, { merge: true });
}

async function setPrefs(p){
  prefsCache = { ...(prefsCache||defaultPrefs()), ...p };
  await setDoc(prefsDocRef(), prefsCache, { merge: true });
}

// ---------------------------
// Auth gate
// ---------------------------
async function requireDashboardLogin(){
  try { await getRedirectResult(auth); } catch(e) { /* ignore */ }

  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        await signInWithRedirect(auth, provider);
        return;
      }
      const email = (user.email || "").toLowerCase();
      if (!ALLOWED_EMAILS.has(email)) {
        await signOut(auth);
        document.body.innerHTML = `
          <div style="padding:24px;font-family:system-ui;">
            <h2>Access denied</h2>
            <p>This dashboard is locked to your approved Google accounts only.</p>
          </div>`;
        return;
      }
      currentUser = user;
      resolve(user);
    });
  });
}

// ---------------------------
// DOM
// ---------------------------
const elDateLine = document.getElementById("dateLine");
const elAccountLine = document.getElementById("accountLine");
const colorDayPill = document.getElementById("colorDayPill");

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
const zoneToggles = document.getElementById("zoneToggles");

const schoolWrap = document.getElementById("schoolWrap");
const schoolPill = document.getElementById("schoolPill");
const customAppts = document.getElementById("customAppts");

const mergedWrap = document.getElementById("mergedWrap");
const mergedPill = document.getElementById("mergedPill");
const mergedHideChecked = document.getElementById("mergedHideChecked");

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
const allCardDetails = Array.from(document.querySelectorAll(".cardDetails"));

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

// ---------------------------
// Color day rendering
// ---------------------------
function getColorDayLabel(){
  const letter = elLetter?.value || dayCache?.letterDay || "Break Day";
  const therapy = elTherapy?.value || dayCache?.therapy || "";
  if (therapy === "Yes") return "Red Day (Therapy)";
  return COLOR_DAY_BY_LETTER[letter] || "—";
}

function renderColorDay(){
  if (!colorDayPill) return;
  const label = getColorDayLabel();
  colorDayPill.textContent = label;

  colorDayPill.classList.remove("pill-red","pill-yellow","pill-green");
  if (/red/i.test(label)) colorDayPill.classList.add("pill-red");
  if (/yellow/i.test(label)) colorDayPill.classList.add("pill-yellow");
  if (/green/i.test(label)) colorDayPill.classList.add("pill-green");
}

// ---------------------------
// Tasks (hygiene always included)
// ---------------------------
function buildTasks(){
  const t = templatesCache || defaultTemplates();
  const tasks = [];

  const selectedDow = elDow.value || dayCache?.dow || dayName(today);
  const selectedTherapy = elTherapy.value || dayCache?.therapy || defaultTherapyTonightByName(selectedDow);

  const daycare = isDaycareDayByName(selectedDow);
  const thursday = isThursdayByName(selectedDow);
  const therapyNight = (selectedTherapy === "Yes");

  splitLines(t.daily).forEach(line => {
    const p = parseZonedLine(line);
    tasks.push({ id: "daily-" + safeId(p.zone + "-" + p.text), zone: p.zone, text: p.text });
  });

  if (daycare) {
    splitLines(t.daycare).forEach(line => {
      const p = parseZonedLine(line);
      tasks.push({ id: "daycare-" + safeId(p.zone + "-" + p.text), zone: p.zone, text: p.text });
    });
  }

  if (thursday) {
    splitLines(t.thursday).forEach(line => {
      const p = parseZonedLine(line);
      tasks.push({ id: "thu-" + safeId(p.zone + "-" + p.text), zone: p.zone, text: p.text });
    });
  }

  if (therapyNight) {
    splitLines(t.therapyNight).forEach(line => {
      const p = parseZonedLine(line);
      tasks.push({ id: "ther-" + safeId(p.zone + "-" + p.text), zone: p.zone, text: p.text });
    });
  }

  // ALWAYS include hygiene
  splitLines(t.hygiene).forEach(line => {
    const p = parseZonedLine(line);
    tasks.push({ id: "hyg-" + safeId(p.zone + "-" + p.text), zone: p.zone, text: p.text });
  });

  // Carryover always included
  splitLines(t.carryover || "").forEach(line => {
    const p = parseZonedLine(line);
    tasks.push({ id: "car-" + safeId(p.zone + "-" + p.text), zone: p.zone, text: p.text });
  });

  // de-dupe
  const seen = new Set();
  return tasks.filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

function getVisibleZones(){
  const prefs = prefsCache || defaultPrefs();
  return ZONES.filter(z => prefs.zoneVisibility?.[z] !== false);
}

// ---------------------------
// Render MUST DO (by zone)
// ---------------------------
function renderZones(){
  const data = dayCache || defaultDayData();
  const prefs = prefsCache || defaultPrefs();
  const state = data.taskState || {};
  const tasks = buildTasks();

  zonesWrap.innerHTML = "";

  const visibleZones = getVisibleZones();
  const byZone = Object.fromEntries(ZONES.map(z => [z, []]));
  tasks.forEach(t => (byZone[t.zone] || byZone["Morning"]).push(t));

  let total = 0, done = 0;

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
      cb.addEventListener("change", async () => {
        await setDayPatch({ taskState: { [task.id]: cb.checked } });
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
// School checklist (IDs now consistent)
// ---------------------------
function renderSchoolChecklist(){
  const data = dayCache || defaultDayData();
  const letter = elLetter.value || data.letterDay || "Break Day";

  // base schedule lines
  const base = [...(LETTER_SCHEDULE[letter] || [])];

  // custom appts appended after base (stable IDs)
  const custom = splitLines((data.school?.customAppts ?? "")).map(line => `🗓️ ${line}`);

  const items = [...base, ...custom];

  const state = (data.school?.state) || {};
  schoolWrap.innerHTML = "";

  let total = 0, done = 0;

  items.forEach((label, idx) => {
    total++;
    const id = scheduleItemId(letter, idx, label);
    const checked = !!state[id];
    if (checked) done++;

    const row = document.createElement("div");
    row.className = "task";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = checked;
    cb.addEventListener("change", async () => {
      const currentSchool = (dayCache?.school) || { state: {}, customAppts: "" };
      const nextState = { ...(currentSchool.state||{}), [id]: cb.checked };
      await setDayPatch({ school: { ...currentSchool, state: nextState } });
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
// Merged Day (now uses SAME schedule IDs as School)
// ---------------------------
function buildMergedItems(){
  const data = dayCache || defaultDayData();
  const prefs = prefsCache || defaultPrefs();
  const letter = elLetter.value || data.letterDay || "Break Day";

  const base = [...(LETTER_SCHEDULE[letter] || [])];
  const custom = splitLines((data.school?.customAppts ?? "")).map(line => `🗓️ ${line}`);
  const scheduleLines = [...base, ...custom];

  const schoolState = (data.school?.state || {});

  const schedule = scheduleLines.map((line, idx) => {
    const start = parseScheduleStartTime(line);
    const id = scheduleItemId(letter, idx, line);
    return {
      kind: "schedule",
      id,
      minutes: start ? toMinutes(start) : 9999,
      text: line,
      checked: !!schoolState[id]
    };
  });

  const tasks = buildTasks();
  const state = data.taskState || {};
  const byZone = Object.fromEntries(ZONES.map(z => [z, []]));
  tasks.forEach(t => (byZone[t.zone] || byZone["Morning"]).push(t));

  const openAt = workOpenStart(letter); // 8:55 or 2:30
  const anchors = [
    { zone: "Morning", time: "7:00" },
    { zone: "Work Open", time: openAt },
    { zone: "Midday", time: "12:00" },
    { zone: "Work Close", time: "3:15" },
    { zone: "Arrive Home", time: "4:00" },
    { zone: "Bedtime", time: "8:30" }
  ];

  const merged = [...schedule];

  anchors.forEach(a => {
    const listAll = byZone[a.zone] || [];
    const list = prefs.onlyUnchecked ? listAll.filter(t => !state[t.id]) : listAll;
    if (!list.length) return;

    merged.push({
      kind: "zoneHeader",
      id: `zonehdr-${safeId(a.zone)}`,
      minutes: toMinutes(a.time),
      text: `${a.zone} • ${a.time}`
    });

    list.forEach(task => {
      merged.push({
        kind: "task",
        id: task.id,
        minutes: toMinutes(a.time) + 1,
        text: task.text,
        checked: !!state[task.id]
      });
    });
  });

  merged.sort((a,b) => (a.minutes - b.minutes) || (a.kind === "zoneHeader" ? -1 : 0));
  return merged;
}

function renderMergedDay(){
  if (!mergedWrap) return;

  const data = dayCache || defaultDayData();
  const prefs = prefsCache || defaultPrefs();
  const hideChecked = !!prefs.mergedHideChecked;

  const items = buildMergedItems();
  mergedWrap.innerHTML = "";

  let total = 0, done = 0;

  items.forEach(item => {
    if (item.kind === "task"){
      total++;
      if (item.checked) done++;
      if (hideChecked && item.checked) return;
    }

    if (item.kind === "zoneHeader"){
      const div = document.createElement("div");
      div.className = "zoneHeader";
      div.style.marginTop = "10px";
      div.textContent = item.text;
      mergedWrap.appendChild(div);
      return;
    }

    if (item.kind === "schedule"){
      const row = document.createElement("div");
      row.className = "task taskSchoolRow";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!item.checked;

      cb.addEventListener("change", async () => {
        const currentSchool = (dayCache?.school) || { state: {}, customAppts: "" };
        const nextState = { ...(currentSchool.state||{}), [item.id]: cb.checked };
        await setDayPatch({ school: { ...currentSchool, state: nextState } });
        renderSchoolChecklist();
        renderMergedDay();
      });

      const main = document.createElement("div");
      main.className = "taskMain";

      const text = document.createElement("div");
      text.className = "taskText";
      text.textContent = item.text;

      main.appendChild(text);
      row.appendChild(cb);
      row.appendChild(main);
      mergedWrap.appendChild(row);
      return;
    }

    if (item.kind === "task"){
      const row = document.createElement("div");
      row.className = "task";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!item.checked;

      cb.addEventListener("change", async () => {
        await setDayPatch({ taskState: { [item.id]: cb.checked } });
        renderZones();
        renderMergedDay();
      });

      const main = document.createElement("div");
      main.className = "taskMain";

      const text = document.createElement("div");
      text.className = "taskText";
      text.textContent = item.text;

      main.appendChild(text);
      row.appendChild(cb);
      row.appendChild(main);
      mergedWrap.appendChild(row);
    }
  });

  if (mergedPill) mergedPill.textContent = `${done} / ${total}`;
}

// ---------------------------
// Zone toggles
// ---------------------------
function renderZoneToggles(){
  const prefs = prefsCache || defaultPrefs();
  zoneToggles.innerHTML = "";

  ZONES.forEach(z => {
    const pill = document.createElement("div");
    pill.className = "zoneTogglePill";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = prefs.zoneVisibility?.[z] !== false;

    cb.addEventListener("change", async () => {
      const p2 = { ...(prefsCache || defaultPrefs()) };
      p2.zoneVisibility = { ...(p2.zoneVisibility || {}), [z]: cb.checked };
      await setPrefs(p2);
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
// Trackers
// ---------------------------
function renderBodyTrackers(){
  if (!bodyTrackersWrap) return;
  const data = dayCache || defaultDayData();
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
    pill.textContent = `${current}/${item.target} • ${pct}%`;

    head.appendChild(title);
    head.appendChild(pill);

    const stepper = document.createElement("div");
    stepper.className = "stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "stepBtn";
    minus.textContent = "−";
    minus.addEventListener("click", async () => {
      const now = coerceInt((dayCache?.trackers || {})[item.key], 0);
      const next = Math.max(0, now - item.step);
      await setDayPatch({ trackers: { [item.key]: next } });
      renderTrackers();
    });

    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "0";
    input.step = String(item.step);
    input.value = String(current);
    input.addEventListener("input", debounce(async () => {
      await setDayPatch({ trackers: { [item.key]: coerceInt(input.value, 0) } });
      renderTrackers();
    }, 350));

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "stepBtn";
    plus.textContent = "+";
    plus.addEventListener("click", async () => {
      const now = coerceInt((dayCache?.trackers || {})[item.key], 0);
      const next = now + item.step;
      await setDayPatch({ trackers: { [item.key]: next } });
      renderTrackers();
    });

    stepper.appendChild(minus);
    stepper.appendChild(input);
    stepper.appendChild(plus);

    card.appendChild(head);
    card.appendChild(stepper);

    bodyTrackersWrap.appendChild(card);
  });
}

function renderTrackers(){
  const data = dayCache || defaultDayData();
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

  streakPill.textContent = `Cloud save ✅`;
  waterStreakLine.textContent = `Goal idea: ≥4 drinks`;
  moveStreakLine.textContent  = `Goal idea: ≥10 minutes`;

  renderBodyTrackers();
}

// ---------------------------
// Backup / Restore
// ---------------------------
function exportJSON(){
  const payload = {
    version: "cloud-v1",
    dayKey: KEY,
    dayData: dayCache,
    templates: templatesCache,
    prefs: prefsCache
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planner-dashboard-backup-${KEY}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = async () => {
    try{
      const payload = JSON.parse(String(reader.result || "{}"));
      if (payload.templates) await setTemplates(payload.templates);
      if (payload.prefs) await setPrefs(payload.prefs);
      if (payload.dayData) {
        dayCache = { ...defaultDayData(), ...payload.dayData };
        await setDoc(dayDocRef(KEY), dayCache, { merge: true });
      }
      alert("Import complete ✅");
      await loadUI();
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
// Rollover
// ---------------------------
function tomorrowKeyFrom(keyStr){
  const [y,m,d] = keyStr.split("-").map(n => parseInt(n,10));
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + 1);
  return dateKey(dt);
}

async function rolloverToTomorrow(){
  const tomorrowKey = tomorrowKeyFrom(KEY);
  const tomorrowRef = dayDocRef(tomorrowKey);
  const snap = await getDoc(tomorrowRef);
  const tomorrowData = snap.exists() ? snap.data() : defaultDayData();

  const notToday = (dayCache?.notToday || "").trim();
  const nextNotToday = (tomorrowData.notToday || "").trim();
  const mergedNotToday = [nextNotToday, notToday].filter(Boolean).join("\n");

  const pri = dayCache?.priorities || ["","",""];
  const tPri = tomorrowData.priorities || ["","",""];
  const carriedPri = [
    tPri[0] || pri[0] || "",
    tPri[1] || pri[1] || "",
    tPri[2] || pri[2] || ""
  ];

  await setDoc(tomorrowRef, { notToday: mergedNotToday, priorities: carriedPri, savedAt: Date.now() }, { merge: true });
  alert("Rollover saved to tomorrow ✅");
}

// ---------------------------
// Templates save
// ---------------------------
async function saveTpls(){
  await setTemplates({
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
async function startHere(){
  const data = dayCache || defaultDayData();

  if (!elDow.value) elDow.value = dayName(today);
  if (!elTherapy.value) elTherapy.value = defaultTherapyTonightByName(elDow.value);
  if (!elLetter.value) elLetter.value = data.letterDay || "Break Day";
  if (!elDayType.value) elDayType.value = data.dayType || "Normal";

  await setDayPatch({
    dow: elDow.value,
    therapy: elTherapy.value,
    letterDay: elLetter.value,
    dayType: elDayType.value
  });

  renderColorDay();
  renderZoneToggles();
  renderSchoolChecklist();
  renderZones();
  renderMergedDay();

  document.getElementById("cardMerged")?.scrollIntoView({ behavior:"smooth", block:"start" });
}

// ---------------------------
// Load UI
// ---------------------------
async function loadUI(){
  elDateLine.textContent = `Saved to your Google account • ${today.toDateString()}`;
  if (elAccountLine && currentUser?.email) elAccountLine.textContent = `Signed in: ${currentUser.email}`;

  const data = dayCache || defaultDayData();
  const t = templatesCache || defaultTemplates();
  const prefs = prefsCache || defaultPrefs();

  elDow.value = data.dow || dayName(today);
  elLetter.value = data.letterDay || "Break Day";
  elDayType.value = data.dayType || "Normal";
  elTherapy.value = data.therapy || defaultTherapyTonightByName(elDow.value);
  elNotToday.value = data.notToday || "";

  const defTher = defaultTherapyTonightByName(elDow.value);
  elTherapyHint.textContent = (defTher === "Yes") ? "Default therapy night for Mon/Tue. Override if needed." : "";

  const pri = data.priorities || ["","",""];
  prio1.value = pri[0] || "";
  prio2.value = pri[1] || "";
  prio3.value = pri[2] || "";

  tplDaily.value = t.daily || "";
  tplDaycare.value = t.daycare || "";
  tplThursday.value = t.thursday || "";
  tplTherapyNight.value = t.therapyNight || "";
  tplHygiene.value = t.hygiene || "";
  tplCarryover.value = t.carryover || "";

  if (onlyUnchecked) onlyUnchecked.checked = !!prefs.onlyUnchecked;
  if (mergedHideChecked) mergedHideChecked.checked = !!prefs.mergedHideChecked;

  // Customize hidden by default
  if (customizeDetails) customizeDetails.open = false;

  renderColorDay();
  renderZoneToggles();
  renderSchoolChecklist();
  renderTrackers();
  renderZones();
  renderMergedDay();
}

// ---------------------------
// Events
// ---------------------------
elDow.addEventListener("change", async () => {
  if (!dayCache?.therapy && !elTherapy.value) elTherapy.value = defaultTherapyTonightByName(elDow.value);
  await setDayPatch({ dow: elDow.value, therapy: elTherapy.value });
  renderColorDay();
  renderZones();
  renderMergedDay();
});

elLetter.addEventListener("change", async () => {
  await setDayPatch({ letterDay: elLetter.value });
  renderColorDay();
  renderSchoolChecklist();
  renderMergedDay();
});

elDayType.addEventListener("change", async () => {
  await setDayPatch({ dayType: elDayType.value });
});

elTherapy.addEventListener("change", async () => {
  await setDayPatch({ therapy: elTherapy.value });
  renderColorDay();
  renderZones();
  renderMergedDay();
});

customAppts.addEventListener("input", debounce(async () => {
  const currentSchool = dayCache?.school || { state: {}, customAppts: "" };
  await setDayPatch({ school: { ...currentSchool, customAppts: customAppts.value } });
  renderSchoolChecklist();
  renderMergedDay();
}, 450));

elNotToday.addEventListener("input", debounce(async () => {
  await setDayPatch({ notToday: elNotToday.value });
}, 450));

[prio1, prio2, prio3].forEach(el => el.addEventListener("input", debounce(async () => {
  await setDayPatch({ priorities: [prio1.value, prio2.value, prio3.value] });
}, 400)));

saveTplBtn.addEventListener("click", saveTpls);
startHereBtn.addEventListener("click", startHere);

rolloverBtn.addEventListener("click", async () => {
  const ok = confirm("Rollover Parking Lot + Priorities to tomorrow?");
  if (ok) await rolloverToTomorrow();
});

saveBtn.addEventListener("click", async () => {
  await setDayPatch({
    dow: elDow.value,
    letterDay: elLetter.value,
    dayType: elDayType.value,
    therapy: elTherapy.value,
    notToday: elNotToday.value
  });
  alert("Saved ✅");
});

onlyUnchecked?.addEventListener("change", async () => {
  const next = { ...(prefsCache || defaultPrefs()), onlyUnchecked: !!onlyUnchecked.checked };
  await setPrefs(next);
  renderZones();
  renderMergedDay();
});

mergedHideChecked?.addEventListener("change", async () => {
  const next = { ...(prefsCache || defaultPrefs()), mergedHideChecked: !!mergedHideChecked.checked };
  await setPrefs(next);
  renderMergedDay();
});

// trackers autosave
elWaterMinus.addEventListener("click", async () => {
  const now = coerceInt(elWaterCount.value, 0);
  await setDayPatch({ trackers: { water: Math.max(0, now - 1) } });
  renderTrackers();
});
elWaterPlus.addEventListener("click", async () => {
  const now = coerceInt(elWaterCount.value, 0);
  await setDayPatch({ trackers: { water: now + 1 } });
  renderTrackers();
});
elWaterCount.addEventListener("input", debounce(async () => {
  await setDayPatch({ trackers: { water: coerceInt(elWaterCount.value, 0) } });
  renderTrackers();
}, 250));

elMoveMinutes.addEventListener("input", debounce(async () => {
  await setDayPatch({ trackers: { moveMinutes: coerceInt(elMoveMinutes.value, 0) } });
  renderTrackers();
}, 300));

elMood.addEventListener("change", async () => {
  await setDayPatch({ trackers: { mood: elMood.value } });
  renderTrackers();
});

elEnergy.addEventListener("input", debounce(async () => {
  await setDayPatch({ trackers: { energy: coerceEnergy(elEnergy.value, 3) } });
  renderTrackers();
}, 250));

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
await requireDashboardLogin();
await loadCloudCaches();
await loadUI();
