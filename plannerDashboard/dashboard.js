// LRCGames/plannerDashboard/dashboard.js
// Firebase-backed planner dashboard matching dashboard.html

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* ---------- Firebase init ---------- */

const firebaseConfig = {
  apiKey: "AIzaSyDTKYFcm26i0LsrLo9UjtLnZpNKx4XsWG4",
  authDomain: "lrcquest-3039e.firebaseapp.com",
  projectId: "lrcquest-3039e",
  storageBucket: "lrcquest-3039e.firebasestorage.app",
  messagingSenderId: "72063656342",
  appId: "1:72063656342:web:bc08c6538437f50b53bdb7",
  measurementId: "G-5VXRYJ733C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Only allow these emails
const ALLOWED_EMAILS = [
  "malbrecht@sd308.org",
  "malbrecht3317@gmail.com"
];

/* ---------- Helpers ---------- */

function todayDateKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function $(id) {
  return document.getElementById(id);
}

/* ---------- Time blocks & letter-day schedule ---------- */

const TIME_BLOCKS = [
  { id: "morning", label: "🌅 Morning" },
  { id: "workOpen", label: "🏫 Work open" },
  { id: "midday", label: "🌤 Midday" },
  { id: "workClose", label: "🏁 Work close" },
  { id: "evening", label: "🏠 Arrive home" },
  { id: "bedtime", label: "🌙 Bedtime" },
];

// SCHOOL LETTER DAY SCHEDULE (24-hr times for correct ordering)
const SCHEDULE_BY_LETTER_DAY = {
  A: [
    { time24: "09:05", title: "4th Rosenthal" },
    { time24: "10:05", title: "2nd Peterson" },
    { time24: "11:05", title: "3rd Hossain" },
    { time24: "13:45", title: "5th Altruismo" },
    { time24: "14:45", title: "1st Rogers" }
  ],
  B: [
    { time24: "09:05", title: "4th Cavello" },
    { time24: "10:05", title: "2nd Schmidt" },
    { time24: "13:45", title: "5th Isibindi" }
  ],
  C: [
    { time24: "08:45", title: "AM Duty" },
    { time24: "10:05", title: "2nd Adams" },
    { time24: "11:05", title: "3rd Pulsa" },
    { time24: "13:45", title: "5th Amistad" }
  ],
  D: [
    { time24: "09:20", title: "HC 5th Green" },
    { time24: "10:05", title: "HC 1st Green" },
    { time24: "14:45", title: "1st Wilson" }
  ],
  E: [
    { time24: "09:05", title: "4th Tomter" },
    { time24: "11:05", title: "3rd Carroll" },
    { time24: "13:45", title: "5th Reveur" },
    { time24: "14:45", title: "1st Day" }
  ]
};

function blockForTime(time24) {
  if (!time24) return "midday";
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const mins = h * 60 + parseInt(mStr, 10);

  if (mins < 8 * 60) return "morning";        // before 8:00
  if (mins < 11 * 60) return "workOpen";      // 8:00–10:59
  if (mins < 13 * 60) return "midday";        // 11:00–12:59
  if (mins < 16 * 60) return "workClose";     // 13:00–15:59
  if (mins < 21 * 60) return "evening";       // 16:00–20:59
  return "bedtime";                           // 21:00+
}

function isWeekdayName(name) {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(name);
}

/* ---------- Core state shape ---------- */

const DEFAULT_STATE = {
  context: {
    dayOfWeek: "",
    letterDay: "",
    daycare: "no",      // "yes" | "no"
    therapy: "no",      // "yes" | "no"
    planDate: "",       // YYYY-MM-DD
  },
  // tasks stored by block id -> array of {id, text, done, auto?}
  tasks: TIME_BLOCKS.reduce((acc, b) => {
    acc[b.id] = [];
    return acc;
  }, {}),
  parking: [],          // [{id, text}]
  lastTime: [],         // [{id, text, lastDone: "YYYY-MM-DD" | null}]
  trackers: {
    // daily ones
    water: { count: 0, goal: 8 },
    steps: { count: 0, goal: 6000 },
    med: { count: 0, goal: 10 },
    stretch: { count: 0, goal: 10 },
    // reps exercises (default goal 30)
    frontLifts: { count: 0, goal: 30 },
    sideLifts: { count: 0, goal: 30 },
    reverseFlys: { count: 0, goal: 30 },
    pressChest: { count: 0, goal: 30 },
    flyChest: { count: 0, goal: 30 },
    pushUps: { count: 0, goal: 30 },
    heelTapsAbs: { count: 0, goal: 30 },
    hipBridgeAbs: { count: 0, goal: 30 },
    birdDogAbs: { count: 0, goal: 30 },
    deadBugAbs: { count: 0, goal: 30 },
    catCowAbs: { count: 0, goal: 30 },
    squats: { count: 0, goal: 30 },
    alternatingReverseLunges: { count: 0, goal: 30 },
    sumoSquats: { count: 0, goal: 30 },
    altSideSquats: { count: 0, goal: 30 },
    rdlRight: { count: 0, goal: 30 },
    rdlLeft: { count: 0, goal: 30 },
    calfRaises: { count: 0, goal: 30 },
    wideRowBack: { count: 0, goal: 30 },
    pullDownBack: { count: 0, goal: 30 },
    facePullsBack: { count: 0, goal: 30 },
    bicepCurls: { count: 0, goal: 30 },
    hammerCurls: { count: 0, goal: 30 },
    tricepKickbacksRight: { count: 0, goal: 30 },
    tricepKickbacksLeft: { count: 0, goal: 30 },
    skullCrushers: { count: 0, goal: 30 },
  },
};

let currentUser = null;
let currentDateKey = todayDateKey();
let state = deepClone(DEFAULT_STATE);

/* ---------- Firestore helpers ---------- */

function mergeWithDefaults(raw) {
  if (!raw) return deepClone(DEFAULT_STATE);

  return {
    ...deepClone(DEFAULT_STATE),
    ...raw,
    context: {
      ...DEFAULT_STATE.context,
      ...(raw.context || {}),
    },
    tasks: {
      ...DEFAULT_STATE.tasks,
      ...(raw.tasks || {}),
    },
    parking: raw.parking || [],
    lastTime: raw.lastTime || [],
    trackers: {
      ...DEFAULT_STATE.trackers,
      ...(raw.trackers || {}),
    },
  };
}

function getDayDocRef() {
  if (!currentUser || !currentDateKey) return null;
  return doc(db, "plannerDays", `${currentUser.uid}_${currentDateKey}`);
}

async function loadDayFromFirestore() {
  const ref = getDayDocRef();
  if (!ref) return;

  const snap = await getDoc(ref);
  if (snap.exists()) {
    state = mergeWithDefaults(snap.data());
  } else {
    state = deepClone(DEFAULT_STATE);
    state.context.planDate = currentDateKey;
  }
}

async function saveDayToFirestore() {
  const ref = getDayDocRef();
  if (!ref) return;
  await setDoc(ref, state, { merge: false });
}

/* ---------- Default “Last time I…” + auto-tasks ---------- */

function seedDefaultLastTimeIfNeeded() {
  if (!Array.isArray(state.lastTime) || state.lastTime.length === 0) {
    state.lastTime = [
      { id: uuid(), text: "Changed sheets",       lastDone: todayDateKey() },
      { id: uuid(), text: "Bathed Baby",          lastDone: "" },
      { id: uuid(), text: "Shaved my armpits",    lastDone: "" },
      { id: uuid(), text: "Cleaned eyebrows",     lastDone: "" },
      { id: uuid(), text: "Shaved lips",          lastDone: "" },
      { id: uuid(), text: "Shaved 🐱",            lastDone: "" },
      { id: uuid(), text: "Washed hair",          lastDone: "" },
      { id: uuid(), text: "Shaved legs",          lastDone: "" },
      { id: uuid(), text: "Toenails",             lastDone: "" },
      { id: uuid(), text: "Nails",                lastDone: "" },
    ];
  }
}

// Remove existing auto tasks & rebuild from context
function regenerateAutoTasks() {
  // remove all existing auto tasks but keep manual
  TIME_BLOCKS.forEach((b) => {
    state.tasks[b.id] = (state.tasks[b.id] || []).filter((t) => !t.auto);
  });

  const blockTasks = [];
  const isWeekday = isWeekdayName(state.context.dayOfWeek);
  const isSchoolDay = isWeekday &&
    state.context.letterDay &&
    state.context.letterDay !== "NONE";

  // ----- AM Must-Do (always) -----
  blockTasks.push({ label: "Levothyroxine", block: "morning" });
  blockTasks.push({ label: "Switch dishwasher", block: "morning" });
  blockTasks.push({ label: "Clean glasses", block: "morning" });
  blockTasks.push({ label: "Deodorant", block: "morning" });
  blockTasks.push({ label: "Eat breakfast", block: "morning" });
  blockTasks.push({ label: "Brush teeth (AM)", block: "morning" });
  blockTasks.push({ label: "Floss (AM)", block: "morning" });
  blockTasks.push({ label: "Get dressed", block: "morning" });
  blockTasks.push({ label: "Wash face (AM)", block: "morning" });
  blockTasks.push({ label: "Style hair", block: "morning" });
  blockTasks.push({ label: "Feed cat & refresh water", block: "morning" });

  // Only on school days
  if (isSchoolDay) {
    blockTasks.push({ label: "Fill water bottle", block: "morning" });
    blockTasks.push({ label: "Pack lunch", block: "morning" });
    blockTasks.push({ label: "Pack school bag", block: "morning" });
  }

  if (state.context.daycare === "yes") {
    blockTasks.push({ label: "Lincoln diaper changed", block: "morning" });
    blockTasks.push({ label: "Lincoln bottle prepped", block: "morning" });
    blockTasks.push({ label: "Daycare bag packed", block: "morning" });
    blockTasks.push({ label: "Daycare notebook filled out", block: "morning" });
  }

  // ----- WORK OPEN (only on school days) -----
  if (isSchoolDay) {
    blockTasks.push({ label: "Projector on", block: "workOpen" });
    blockTasks.push({ label: "Lunch in fridge", block: "workOpen" });
    blockTasks.push({ label: "Sign into laptops & pull up Destiny", block: "workOpen" });
    blockTasks.push({ label: "Name tags out", block: "workOpen" });

    // ----- MIDDAY -----
    blockTasks.push({
      label: "Midday reset (5-min tidy / water / stretch)",
      block: "midday"
    });

    // ----- WORK CLOSE -----
    blockTasks.push({ label: "Sign out / projector off", block: "workClose" });
    blockTasks.push({ label: "Collect name tags", block: "workClose" });
    blockTasks.push({ label: "5 minutes classroom straighten", block: "workClose" });
    blockTasks.push({ label: "Clear desk", block: "workClose" });
  }

  // ----- EVENING -----
  if (state.context.therapy === "yes") {
    blockTasks.push({
      label: "Prep notes & questions for therapy",
      block: "evening"
    });
  }
  blockTasks.push({ label: "Lay out clothes for tomorrow", block: "evening" });

  // ----- BEDTIME / PM MUST-DO -----
  blockTasks.push({ label: "Brush teeth", block: "bedtime" });
  blockTasks.push({ label: "Floss", block: "bedtime" });
  blockTasks.push({ label: "Wash face", block: "bedtime" });
  blockTasks.push({
    label: "Water bottle & lunch dishes in dishwasher",
    block: "bedtime"
  });

  // ----- Letter day schedule -> class tasks in appropriate block -----
  const letter = state.context.letterDay;
  if (isSchoolDay && letter && SCHEDULE_BY_LETTER_DAY[letter]) {
    SCHEDULE_BY_LETTER_DAY[letter].forEach((appt) => {
      const blockId = blockForTime(appt.time24);
      blockTasks.push({
        label: appt.title,
        block: blockId,
      });
    });
  }

  // Push into state.tasks as auto
  blockTasks.forEach((t) => {
    if (!state.tasks[t.block]) state.tasks[t.block] = [];
    state.tasks[t.block].push({
      id: uuid(),
      text: t.label,
      done: false,
      auto: true,
    });
  });
}

// Only used on first load if a day has *no* tasks at all
function seedAutoTasksIfEmpty() {
  const totalTasksCount = TIME_BLOCKS.reduce(
    (sum, b) => sum + (state.tasks[b.id]?.length || 0),
    0
  );
  if (totalTasksCount > 0) return;
  regenerateAutoTasks();
}

/* ---------- Context + summary ---------- */

function updateToggleButton(btn, value) {
  btn.dataset.value = value;
  if (value === "yes") {
    btn.classList.add("toggle-on");
    btn.textContent = "Yes";
  } else {
    btn.classList.remove("toggle-on");
    btn.textContent = "No";
  }
}

function toggleBtnValue(btn) {
  const current = btn.dataset.value === "yes" ? "no" : "yes";
  updateToggleButton(btn, current);
}

function renderDaySummary() {
  const el = $("daySummary");
  if (!el) return;
  const { dayOfWeek, letterDay, daycare, therapy, planDate } = state.context;

  const bits = [];
  if (dayOfWeek) bits.push(dayOfWeek);
  if (letterDay) bits.push(letterDay === "NONE" ? "No school" : `${letterDay} Day`);
  if (planDate) bits.push(planDate);
  bits.push(`Daycare: ${daycare === "yes" ? "✅" : "❌"}`);
  bits.push(`Therapy: ${therapy === "yes" ? "✅" : "❌"}`);

  el.textContent = bits.join(" · ");
}

async function handleContextSubmit(e) {
  e.preventDefault();
  const dayOfWeekSel = $("dayOfWeek");
  const letterDaySel = $("letterDay");
  const planDateInput = $("planDate");
  const daycareToggle = $("daycareToggle");
  const therapyToggle = $("therapyToggle");

  const newContext = {
    dayOfWeek: dayOfWeekSel.value,
    letterDay: letterDaySel.value,
    planDate: planDateInput.value || todayDateKey(),
    daycare: daycareToggle.dataset.value || "no",
    therapy: therapyToggle.dataset.value || "no",
  };

  currentDateKey = newContext.planDate;

  // load that day's data, then override context, then regenerate auto tasks
  await loadDayFromFirestore();
  state.context = {
    ...state.context,
    ...newContext,
  };

  seedDefaultLastTimeIfNeeded();
  regenerateAutoTasks();
  await saveDayToFirestore();
  rehydrateAllFromState();
}

async function handleReloadDay() {
  const planDateInput = $("planDate");
  currentDateKey = planDateInput.value || todayDateKey();

  await loadDayFromFirestore();
  seedDefaultLastTimeIfNeeded();
  // don't regenerate autos here; we want exactly what's saved
  await saveDayToFirestore();
  rehydrateAllFromState();
}

function initContextForm() {
  const form = $("contextForm");
  const daycareToggle = $("daycareToggle");
  const therapyToggle = $("therapyToggle");
  const reloadBtn = $("reloadDayBtn");

  if (!form || !daycareToggle || !therapyToggle || !reloadBtn) return;

  const dayOfWeek = $("dayOfWeek");
  const letterDay = $("letterDay");
  const planDate = $("planDate");

  dayOfWeek.value = state.context.dayOfWeek || "";
  letterDay.value = state.context.letterDay || "";
  planDate.value = state.context.planDate || todayDateKey();

  updateToggleButton(daycareToggle, state.context.daycare || "no");
  updateToggleButton(therapyToggle, state.context.therapy || "no");
  renderDaySummary();

  daycareToggle.addEventListener("click", async () => {
    toggleBtnValue(daycareToggle);
    state.context.daycare = daycareToggle.dataset.value;
    regenerateAutoTasks();
    await saveDayToFirestore();
    rehydrateAllFromState();
  });

  therapyToggle.addEventListener("click", async () => {
    toggleBtnValue(therapyToggle);
    state.context.therapy = therapyToggle.dataset.value;
    regenerateAutoTasks();
    await saveDayToFirestore();
    rehydrateAllFromState();
  });

  form.addEventListener("submit", handleContextSubmit);
  reloadBtn.addEventListener("click", (e) => {
    e.preventDefault();
    handleReloadDay();
  });
}

/* ---------- Logout ---------- */

function initLogout() {
  const btn = $("logoutBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "../login.html";
  });
}

/* ---------- Timeline: merged tasks & appointments ---------- */

function initTimeline() {
  const addBtn = $("addTaskBtn");
  const hideCompleted = $("hideCompletedTasks");
  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const blockSel = $("newTaskBlock");
      const textInput = $("newTaskText");
      const blockId = blockSel.value;
      const text = textInput.value.trim();
      if (!text) return;
      const item = {
        id: uuid(),
        text,
        done: false,
        auto: false,
      };
      state.tasks[blockId].push(item);
      textInput.value = "";
      await saveDayToFirestore();
      renderTimeline();
    });
  }
  if (hideCompleted) {
    hideCompleted.addEventListener("change", () => {
      renderTimeline();
    });
  }
  renderTimeline();
}

function renderTimeline() {
  const container = $("timelineContainer");
  const hideCompleted = $("hideCompletedTasks")?.checked;
  if (!container) return;

  container.innerHTML = "";

  TIME_BLOCKS.forEach((block) => {
    const items = state.tasks[block.id] || [];
    const visibleItems = items.filter((item) => !(hideCompleted && item.done));
    if (!visibleItems.length) return;

    const wrapper = document.createElement("div");
    wrapper.className = "time-block";

    const header = document.createElement("div");
    header.className = "time-block-header";
    header.textContent = block.label;
    wrapper.appendChild(header);

    const list = document.createElement("div");
    list.className = "time-block-list";

    visibleItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "timeline-item";

      const left = document.createElement("label");
      left.className = "timeline-item-left";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.done;
      checkbox.addEventListener("change", async () => {
        item.done = checkbox.checked;
        await saveDayToFirestore();
        renderTimeline();
      });

      const span = document.createElement("span");
      span.textContent = item.text;

      left.appendChild(checkbox);
      left.appendChild(span);

      row.appendChild(left);
      list.appendChild(row);
    });

    wrapper.appendChild(list);
    container.appendChild(wrapper);
  });
}

/* ---------- Parking lot ---------- */

function initParkingLot() {
  const addBtn = $("addParkingBtn");
  const input = $("parkingInput");
  if (!addBtn || !input) return;

  addBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    state.parking.push({
      id: uuid(),
      text,
    });
    input.value = "";
    await saveDayToFirestore();
    renderParking();
  });

  renderParking();
}

function renderParking() {
  const container = $("parkingList");
  if (!container) return;
  container.innerHTML = "";

  state.parking.forEach((item) => {
    const pill = document.createElement("div");
    pill.className = "pill-item";

    const span = document.createElement("span");
    span.textContent = item.text;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "tiny-icon-btn";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", async () => {
      state.parking = state.parking.filter((p) => p.id !== item.id);
      await saveDayToFirestore();
      renderParking();
    });

    pill.appendChild(span);
    pill.appendChild(delBtn);

    container.appendChild(pill);
  });
}

/* ---------- “When was the last time I…” ---------- */

function initLastTime() {
  const addBtn = $("addLastTimeBtn");
  const input = $("newLastTimeText");
  if (!addBtn || !input) return;

  addBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    state.lastTime.push({
      id: uuid(),
      text,
      lastDone: null,
    });
    input.value = "";
    await saveDayToFirestore();
    renderLastTime();
  });

  renderLastTime();
}

function renderLastTime() {
  const container = $("lastTimeList");
  if (!container) return;

  container.innerHTML = "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  state.lastTime.forEach((item) => {
    const row = document.createElement("div");
    row.className = "last-time-item";

    const info = document.createElement("div");
    info.className = "last-time-info";

    const title = document.createElement("div");
    title.className = "last-time-title";
    title.textContent = item.text;

    const detail = document.createElement("div");
    detail.className = "last-time-detail";

    let days = null;
    if (item.lastDone) {
      const lastDate = new Date(item.lastDone);
      lastDate.setHours(0, 0, 0, 0);
      const diffMs = today - lastDate;
      days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    if (days === null) {
      detail.textContent = "Not done yet";
      row.classList.add("status-overdue");
    } else {
      detail.textContent = days === 0 ? "Today" : `${days} day(s) ago`;
      if (days <= 7) {
        row.classList.add("status-ok");
      } else if (days <= 14) {
        row.classList.add("status-warning");
      } else {
        row.classList.add("status-overdue");
      }
    }

    info.appendChild(title);
    info.appendChild(detail);

    const actions = document.createElement("div");
    actions.className = "last-time-actions";

    const didBtn = document.createElement("button");
    didBtn.type = "button";
    didBtn.className = "tiny-btn";
    didBtn.textContent = "Just did it";
    didBtn.addEventListener("click", async () => {
      item.lastDone = new Date().toISOString().slice(0, 10);
      await saveDayToFirestore();
      renderLastTime();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "tiny-icon-btn";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", async () => {
      state.lastTime = state.lastTime.filter((x) => x.id !== item.id);
      await saveDayToFirestore();
      renderLastTime();
    });

    actions.appendChild(didBtn);
    actions.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(actions);
    container.appendChild(row);
  });
}

/* ---------- Trackers ---------- */

// Simple four: water, steps, med, stretch
const SIMPLE_TRACKERS = {
  water: {
    minusId: "waterMinus",
    plusId: "waterPlus",
    countId: "waterCount",
    goalInputId: "waterGoal",
    winValueId: "winWaterValue",
    winGoalId: "winWaterGoal",
    defaultGoal: 8,
    step: 1,
  },
  steps: {
    minusId: "stepMinus",
    plusId: "stepPlus",
    countId: "stepCount",
    goalInputId: "stepGoal",
    winValueId: "winStepsValue",
    winGoalId: "winStepsGoal",
    defaultGoal: 6000,
    step: 500,
  },
  med: {
    minusId: "medMinus",
    plusId: "medPlus",
    countId: "medCount",
    goalInputId: "medGoal",
    winValueId: "winMedValue",
    winGoalId: "winMedGoal",
    defaultGoal: 10,
    step: 5,
  },
  stretch: {
    minusId: "stretchMinus",
    plusId: "stretchPlus",
    countId: "stretchCount",
    goalInputId: "stretchGoal",
    winValueId: "winStretchValue",
    winGoalId: "winStretchGoal",
    defaultGoal: 10,
    step: 5,
  },
};

// All the rep rows
const REP_TRACKERS = {
  frontLifts: {
    minusId: "frontLiftsRepsMinus",
    plusId: "frontLiftsRepsPlus",
    countId: "frontLiftsRepsCount",
    goalInputId: "frontLiftsGoal",
  },
  sideLifts: {
    minusId: "sideLiftsRepsMinus",
    plusId: "sideLiftsRepsPlus",
    countId: "sideLiftsRepsCount",
    goalInputId: "sideLiftsGoal",
  },
  reverseFlys: {
    minusId: "reverseFlysRepsMinus",
    plusId: "reverseFlysRepsPlus",
    countId: "reverseFlysRepsCount",
    goalInputId: "reverseFlysGoal",
  },
  pressChest: {
    minusId: "pressChestRepsMinus",
    plusId: "pressChestRepsPlus",
    countId: "pressChestRepsCount",
    goalInputId: "pressChestGoal",
  },
  flyChest: {
    minusId: "flyChestRepsMinus",
    plusId: "flyChestRepsPlus",
    countId: "flyChestRepsCount",
    goalInputId: "flyChestGoal",
  },
  pushUps: {
    minusId: "pushUpsRepsMinus",
    plusId: "pushUpsRepsPlus",
    countId: "pushUpsRepsCount",
    goalInputId: "pushUpsGoal",
  },
  heelTapsAbs: {
    minusId: "heelTapsAbsRepsMinus",
    plusId: "heelTapsAbsRepsPlus",
    countId: "heelTapsAbsRepsCount",
    goalInputId: "heelTapsAbsGoal",
  },
  hipBridgeAbs: {
    minusId: "hipBridgeAbsRepsMinus",
    plusId: "hipBridgeAbsRepsPlus",
    countId: "hipBridgeAbsRepsCount",
    goalInputId: "hipBridgeAbsGoal",
  },
  birdDogAbs: {
    minusId: "birdDogAbsRepsMinus",
    plusId: "birdDogAbsRepsPlus",
    countId: "birdDogAbsRepsCount",
    goalInputId: "birdDogAbsGoal",
  },
  deadBugAbs: {
    minusId: "deadBugAbsRepsMinus",
    plusId: "deadBugAbsRepsPlus",
    countId: "deadBugAbsRepsCount",
    goalInputId: "deadBugAbsGoal",
  },
  catCowAbs: {
    minusId: "catCowAbsRepsMinus",
    plusId: "catCowAbsRepsPlus",
    countId: "catCowAbsRepsCount",
    goalInputId: "catCowAbsGoal",
  },
  squats: {
    minusId: "squatsRepsMinus",
    plusId: "squatsRepsPlus",
    countId: "squatsRepsCount",
    goalInputId: "squatsGoal",
  },
  alternatingReverseLunges: {
    minusId: "alternatingReverseLungesRepsMinus",
    plusId: "alternatingReverseLungesRepsPlus",
    countId: "alternatingReverseLungesRepsCount",
    goalInputId: "alternatingReverseLungesGoal",
  },
  sumoSquats: {
    minusId: "sumoSquatsRepsMinus",
    plusId: "sumoSquatsRepsPlus",
    countId: "sumoSquatsRepsCount",
    goalInputId: "sumoSquatsGoal",
  },
  altSideSquats: {
    minusId: "altSideSquatsRepsMinus",
    plusId: "altSideSquatsRepsPlus",
    countId: "altSideSquatsRepsCount",
    goalInputId: "altSideSquatsGoal",
  },
  rdlRight: {
    minusId: "rdlRightRepsMinus",
    plusId: "rdlRightRepsPlus",
    countId: "rdlRightRepsCount",
    goalInputId: "rdlRightGoal",
  },
  rdlLeft: {
    minusId: "rdlLeftRepsMinus",
    plusId: "rdlLeftRepsPlus",
    countId: "rdlLeftRepsCount",
    goalInputId: "rdlLeftGoal",
  },
  calfRaises: {
    minusId: "calfRaisesRepsMinus",
    plusId: "calfRaisesRepsPlus",
    countId: "calfRaisesRepsCount",
    goalInputId: "calfRaisesGoal",
  },
  wideRowBack: {
    minusId: "wideRowBackRepsMinus",
    plusId: "wideRowBackRepsPlus",
    countId: "wideRowBackRepsCount",
    goalInputId: "wideRowBackGoal",
  },
  pullDownBack: {
    minusId: "pullDownBackRepsMinus",
    plusId: "pullDownBackRepsPlus",
    countId: "pullDownBackRepsCount",
    goalInputId: "pullDownBackGoal",
  },
  facePullsBack: {
    minusId: "facePullsBackRepsMinus",
    plusId: "facePullsBackRepsPlus",
    countId: "facePullsBackRepsCount",
    goalInputId: "facePullsBackGoal",
  },
  bicepCurls: {
    minusId: "bicepCurlsRepsMinus",
    plusId: "bicepCurlsRepsPlus",
    countId: "bicepCurlsRepsCount",
    goalInputId: "bicepCurlsGoal",
  },
  hammerCurls: {
    minusId: "hammerCurlsRepsMinus",
    plusId: "hammerCurlsRepsPlus",
    countId: "hammerCurlsRepsCount",
    goalInputId: "hammerCurlsGoal",
  },
  tricepKickbacksRight: {
    minusId: "tricepKickbacksRightRepsMinus",
    plusId: "tricepKickbacksRightRepsPlus",
    countId: "tricepKickbacksRightRepsCount",
    goalInputId: "tricepKickbacksRightGoal",
  },
  tricepKickbacksLeft: {
    minusId: "tricepKickbacksLeftRepsMinus",
    plusId: "tricepKickbacksLeftRepsPlus",
    countId: "tricepKickbacksLeftRepsCount",
    goalInputId: "tricepKickbacksLeftGoal",
  },
  skullCrushers: {
    minusId: "skullCrushersRepsMinus",
    plusId: "skullCrushersRepsPlus",
    countId: "skullCrushersRepsCount",
    goalInputId: "skullCrushersGoal",
  },
};

function initTrackers() {
  // water / steps / med / stretch
  Object.entries(SIMPLE_TRACKERS).forEach(([key, cfg]) => {
    const minusBtn = $(cfg.minusId);
    const plusBtn = $(cfg.plusId);
    const countSpan = $(cfg.countId);
    const goalInput = $(cfg.goalInputId);
    const winValueSpan = $(cfg.winValueId);
    const winGoalSpan = $(cfg.winGoalId);

    if (!state.trackers[key]) {
      state.trackers[key] = { count: 0, goal: cfg.defaultGoal };
    }

    const t = state.trackers[key];

    if (countSpan) countSpan.textContent = t.count ?? 0;
    if (goalInput && !goalInput.value) {
      goalInput.value = t.goal ?? cfg.defaultGoal;
    }
    if (winValueSpan) winValueSpan.textContent = t.count ?? 0;
    if (winGoalSpan) winGoalSpan.textContent = t.goal ?? cfg.defaultGoal;

    minusBtn?.addEventListener("click", async () => {
      t.count = Math.max(0, (t.count ?? 0) - cfg.step);
      if (countSpan) countSpan.textContent = t.count;
      if (winValueSpan) winValueSpan.textContent = t.count;
      await saveDayToFirestore();
      updateMovementSummaryAndBanner();
    });

    plusBtn?.addEventListener("click", async () => {
      t.count = (t.count ?? 0) + cfg.step;
      if (countSpan) countSpan.textContent = t.count;
      if (winValueSpan) winValueSpan.textContent = t.count;
      await saveDayToFirestore();
      updateMovementSummaryAndBanner();
    });

    goalInput?.addEventListener("change", async () => {
      const val = parseInt(goalInput.value, 10);
      const goal = Number.isFinite(val) ? val : cfg.defaultGoal;
      t.goal = goal;
      goalInput.value = goal;
      if (winGoalSpan) winGoalSpan.textContent = goal;
      await saveDayToFirestore();
      updateMovementSummaryAndBanner();
    });
  });

  // all the rep rows
  Object.entries(REP_TRACKERS).forEach(([key, cfg]) => {
    const minusBtn = $(cfg.minusId);
    const plusBtn = $(cfg.plusId);
    const countSpan = $(cfg.countId);
    const goalInput = $(cfg.goalInputId);

    if (!state.trackers[key]) {
      state.trackers[key] = { count: 0, goal: 30 };
    }

    const t = state.trackers[key];

    if (countSpan) countSpan.textContent = t.count ?? 0;
    if (goalInput && !goalInput.value) {
      goalInput.value = t.goal ?? 30;
    }

    minusBtn?.addEventListener("click", async () => {
      t.count = Math.max(0, (t.count ?? 0) - 1);
      if (countSpan) countSpan.textContent = t.count;
      await saveDayToFirestore();
      updateMovementSummaryAndBanner();
    });

    plusBtn?.addEventListener("click", async () => {
      t.count = (t.count ?? 0) + 1;
      if (countSpan) countSpan.textContent = t.count;
      await saveDayToFirestore();
      updateMovementSummaryAndBanner();
    });

    goalInput?.addEventListener("change", async () => {
      const val = parseInt(goalInput.value, 10);
      const goal = Number.isFinite(val) ? val : 30;
      t.goal = goal;
      goalInput.value = goal;
      await saveDayToFirestore();
      updateMovementSummaryAndBanner();
    });
  });

  updateMovementSummaryAndBanner();
}

function hydrateTrackersDom() {
  // simple four
  Object.entries(SIMPLE_TRACKERS).forEach(([key, cfg]) => {
    const countSpan = $(cfg.countId);
    const goalInput = $(cfg.goalInputId);
    const winValueSpan = $(cfg.winValueId);
    const winGoalSpan = $(cfg.winGoalId);
    const t = state.trackers[key] || { count: 0, goal: cfg.defaultGoal };

    if (countSpan) countSpan.textContent = t.count ?? 0;
    if (goalInput) goalInput.value = t.goal ?? cfg.defaultGoal;
    if (winValueSpan) winValueSpan.textContent = t.count ?? 0;
    if (winGoalSpan) winGoalSpan.textContent = t.goal ?? cfg.defaultGoal;
  });

  // reps
  Object.entries(REP_TRACKERS).forEach(([key, cfg]) => {
    const countSpan = $(cfg.countId);
    const goalInput = $(cfg.goalInputId);
    const t = state.trackers[key] || { count: 0, goal: 30 };
    if (countSpan) countSpan.textContent = t.count ?? 0;
    if (goalInput) goalInput.value = t.goal ?? 30;
  });

  updateMovementSummaryAndBanner();
}

function updateMovementSummaryAndBanner() {
  const movementWin = $("movementWinBanner");
  const winRepsValue = $("winRepsValue");
  const winRepsGoal = $("winRepsGoal");

  const w = state.trackers.water || { count: 0, goal: 0 };
  const s = state.trackers.steps || { count: 0, goal: 0 };
  const m = state.trackers.med || { count: 0, goal: 0 };
  const st = state.trackers.stretch || { count: 0, goal: 0 };

  const wGoal = w.goal ?? 0;
  const sGoal = s.goal ?? 0;
  const mGoal = m.goal ?? 0;
  const stGoal = st.goal ?? 0;

  // sum all reps + goals
  let totalReps = 0;
  let totalRepsGoal = 0;
  Object.keys(REP_TRACKERS).forEach((key) => {
    const t = state.trackers[key] || { count: 0, goal: 0 };
    totalReps += t.count ?? 0;
    totalRepsGoal += t.goal ?? 0;
  });

  if (winRepsValue) winRepsValue.textContent = totalReps;
  if (winRepsGoal) winRepsGoal.textContent = totalRepsGoal || 0;

  const hitWater = wGoal > 0 && w.count >= wGoal;
  const hitSteps = sGoal > 0 && s.count >= sGoal;
  const hitMed = mGoal > 0 && m.count >= mGoal;
  const hitStretch = stGoal > 0 && st.count >= stGoal;
  const hitReps = totalRepsGoal > 0 && totalReps >= totalRepsGoal;

  const allHit = hitWater && hitSteps && hitMed && hitStretch && hitReps;

  if (movementWin) {
    if (allHit) {
      movementWin.classList.add("movement-banner-visible");
    } else {
      movementWin.classList.remove("movement-banner-visible");
    }
  }
}

/* ---------- Rehydrate everything from state ---------- */

function rehydrateAllFromState() {
  // Context controls
  const dayOfWeek = $("dayOfWeek");
  const letterDay = $("letterDay");
  const planDate = $("planDate");
  const daycareToggle = $("daycareToggle");
  const therapyToggle = $("therapyToggle");

  if (dayOfWeek) dayOfWeek.value = state.context.dayOfWeek || "";
  if (letterDay) letterDay.value = state.context.letterDay || "";
  if (planDate) planDate.value = state.context.planDate || todayDateKey();
  if (daycareToggle) updateToggleButton(daycareToggle, state.context.daycare || "no");
  if (therapyToggle) updateToggleButton(therapyToggle, state.context.therapy || "no");

  renderDaySummary();
  renderTimeline();
  renderParking();
  renderLastTime();
  hydrateTrackersDom();
}

/* ---------- Auth init ---------- */

function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "../login.html";
      return;
    }

    if (!ALLOWED_EMAILS.includes(user.email)) {
      alert("This planner is only available to Mrs. A.");
      await signOut(auth);
      window.location.href = "../login.html";
      return;
    }

    currentUser = user;

    const planDate = $("planDate");
    if (planDate && !planDate.value) {
      planDate.value = todayDateKey();
    }
    currentDateKey = planDate?.value || todayDateKey();

    await loadDayFromFirestore();
    seedDefaultLastTimeIfNeeded();
    seedAutoTasksIfEmpty();
    await saveDayToFirestore();
    rehydrateAllFromState();
  });
}

/* ---------- Init on DOM ready ---------- */

document.addEventListener("DOMContentLoaded", () => {
  initContextForm();
  initLogout();
  initTimeline();
  initParkingLot();
  initLastTime();
  initTrackers();
  initAuth();
});
