// LRCGames/plannerDashboard/dashboard.js
// Calm planner dashboard for Mrs. A

import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ---------- CONFIG ----------

const firebaseConfig = {
  apiKey: "AIzaSyDTKYFcm26i0LsrLo9UjtLnZpNKx4XsWG4",
  authDomain: "lrcquest-3039e.firebaseapp.com",
  projectId: "lrcquest-3039e",
  storageBucket: "lrcquest-3039e.firebasestorage.app",
  messagingSenderId: "72063656342",
  appId: "1:72063656342:web:bc08c6538437f50b53bdb7",
  measurementId: "G-5VXRYJ733C",
};

const ALLOWED_EMAILS = [
  "malbrecht@sd308.org",
  "malbrecht3317@gmail.com",
];

// Firestore collection prefixes
const DAILY_PREFIX = "plannerDaily";
const PARKING_DOC = "plannerParking";
const WEEKLY_PREFIX = "plannerWeekly";
const GOALS_PREFIX = "plannerGoalsDaily";
const LASTTIME_PREFIX = "plannerLastTime";

// ---------- SCHEDULE & TEMPLATE TASKS ----------

// SCHOOL LETTER DAY SCHEDULE (24-hr times)
const SCHEDULE_BY_LETTER_DAY = {
  A: [
    { time24: "09:05", title: "4th Rosenthal" },
    { time24: "10:05", title: "2nd Peterson" },
    { time24: "11:05", title: "3rd Hossain" },
    { time24: "13:45", title: "5th Altruismo" },
    { time24: "14:45", title: "1st Rogers" },
  ],
  B: [
    { time24: "09:05", title: "4th Cavello" },
    { time24: "10:05", title: "2nd Schmidt" },
    { time24: "13:45", title: "5th Isibindi" },
  ],
  C: [
    { time24: "08:45", title: "AM Duty" },
    { time24: "10:05", title: "2nd Adams" },
    { time24: "11:05", title: "3rd Pulsa" },
    { time24: "13:45", title: "5th Amistad" },
  ],
  D: [
    { time24: "09:20", title: "HC 5th Green" },
    { time24: "10:05", title: "HC 1st Green" },
    { time24: "14:45", title: "1st Wilson" },
  ],
  E: [
    { time24: "09:05", title: "4th Tomter" },
    { time24: "11:05", title: "3rd Carroll" },
    { time24: "13:45", title: "5th Reveur" },
    { time24: "14:45", title: "1st Day" },
  ],
};

// Everyday AM tasks (06:00)
const EVERYDAY_AM_TASKS = [
  "Levothyroxine",
  "Switch Dishwasher",
  "Reset Coffee",
  "Clean Glasses",
  "Deodorant",
  "Eat Breakfast",
  "Brush teeth",
  "Floss",
  "Get Dressed",
  "Wash Face",
  "Style Hair",
  "Feed Cat & Refresh Water",
].map((label) => ({ label, time24: "06:00" }));

// Everyday PM tasks (20:00)
const EVERYDAY_PM_TASKS = [
  "Brush teeth",
  "Floss",
  "Wash Face",
  "Water Bottle & Lunch dishes in dishwasher",
  "Clothes for tomorrow",
].map((label) => ({ label, time24: "20:00" }));

// School day AM (Mon–Fri & letter day A–E) (06:00)
const SCHOOL_AM_TASKS = [
  "Water Bottle (school day)",
  "Pack Lunch (school day)",
  "Pack School bag (school day)",
].map((label) => ({ label, time24: "06:00" }));

// Daycare AM tasks (06:00)
const DAYCARE_AM_TASKS = [
  "Lincoln Diaper Changed (daycare)",
  "Lincoln Bottle (daycare)",
  "Daycare bag packed",
  "Daycare Notebook Filled Out",
].map((label) => ({ label, time24: "06:00" }));

// Work open (09:00) on letter days A–E
const WORK_OPEN_TASKS = [
  "Projector on",
  "Lunch in fridge",
  "Sign into laptops & pull up Destiny",
  "Name tags out",
].map((label) => ({ label, time24: "09:00" }));

// Work close (after last scheduled class)
const WORK_CLOSE_TASKS = [
  "Sign out / projector off",
  "Collect name tags",
  "5 minutes classroom straighten",
  "Clear desk",
  "Plug in chromebooke",
];

// Weekly big rocks
const DEFAULT_WEEKLY_TASKS = {
  work: [
    { title: "Next week 1st grade lessons", statusType: "lessons" },
    { title: "Next week 2nd grade lessons", statusType: "lessons" },
    { title: "Next week 3rd grade lessons", statusType: "lessons" },
    { title: "Next week 4th grade lessons", statusType: "lessons" },
    { title: "Next week 5th grade lessons", statusType: "lessons" },
    { title: "Process 5 new books", statusType: "generic" },
    { title: "5 Book hospital books", statusType: "generic" },
    { title: "Evaluation Evidence", statusType: "generic" },
    { title: "Sub plans", statusType: "generic" },
    { title: "Read-A-Thon Fundraiser", statusType: "generic" },
    { title: "Ordering supplies", statusType: "generic" },
    {title: "Decorate 2 shelves to match the genre color sections", statusType: "generic",},
  ],
  home: [
    { title: "Meal plan & grocery list", statusType: "generic" },
    { title: "Laundry", statusType: "laundry" },
    { title: "Tidy main rooms", statusType: "generic" },
    { title: "Budget check-in", statusType: "generic" },
  ],
};

const WEEKLY_STATUS_TYPES = {
  // For lesson planning (3-step)
  lessons: {
    order: ["planned", "prepped", "slides", "completed"],
    labelMap: {
      planned: "Planned",
      prepped: "Prepped",
      slides: "slides",
      completed: "Completed",
    },
    percentageMap: {
      planned: 25,
      prepped: 50,
      slides: 75,
      completed: 100,
    },
    classMap: {
      planned: "weekly-status--planned",
      prepped: "weekly-status--prepped",
      prepped: "weekly-status--prepped",
      completed: "weekly-status--completed",
    },
  },

  // Default generic 3-step
  generic: {
    order: ["planned", "prepped", "completed"],
    labelMap: {
      planned: "Planned",
      prepped: "Prepped",
      completed: "Completed",
    },
    percentageMap: {
      planned: 33,
      prepped: 66,
      completed: 100,
    },
    classMap: {
      planned: "weekly-status--planned",
      prepped: "weekly-status--prepped",
      completed: "weekly-status--completed",
    },
  },

  // Laundry (4-step)
  laundry: {
    order: ["wash", "dry", "fold", "putaway"],
    labelMap: {
      wash: "Wash",
      dry: "Dry",
      fold: "Fold",
      putaway: "Put away",
    },
    percentageMap: {
      wash: 25,
      dry: 50,
      fold: 75,
      putaway: 100,
    },
    // Re-uses your existing color classes:
    classMap: {
      wash: "weekly-status--planned",
      dry: "weekly-status--prepped",
      fold: "weekly-status--prepped",
      putaway: "weekly-status--completed",
    },
  },
};

function inferStatusTypeFromTitle(title) {
  const lower = (title || "").toLowerCase();
  if (lower.includes("laundry")) return "laundry";
  if (lower.includes("lesson")) return "lessons";
  return "generic";
}

function getStatusConfigForItem(item) {
  const key = item.statusType || inferStatusTypeFromTitle(item.title);
  return WEEKLY_STATUS_TYPES[key] || WEEKLY_STATUS_TYPES.generic;
}

function initialStatusForItem(item) {
  const cfg = getStatusConfigForItem(item);
  return cfg.order[0] || "planned";
}

// Simple daily goal trackers (per-day counts)
// You can tweak dailyTarget numbers any time.
const GOAL_TRACKERS = [
  // --- General health habits ---
  { id: "water",      label: "Water (cups)",  dailyTarget: 8 },
  { id: "steps",      label: "Steps goal",    dailyTarget: 1 },
  { id: "stretching", label: "Stretching",    dailyTarget: 10 },
  { id: "cardio",     label: "Cardio",        dailyTarget: 10 },
  { id: "meditate",   label: "Meditate",      dailyTarget: 10 },
  { id: "eyedrops",   label: "Eye Drops",      dailyTarget: 10 },
  
  // --- Weight lifting / strength: shoulders ---
  { id: "front-lift-shoulders",   label: "Front lift – shoulders",    dailyTarget: 10 },
  { id: "side-lift-shoulders",    label: "Side lift – shoulders",     dailyTarget: 10 },
  { id: "reverse-flys-shoulders", label: "Reverse flys – shoulders",  dailyTarget: 10 },

  // --- Chest ---
  { id: "press-chest", label: "Press – chest", dailyTarget: 10 },
  { id: "fly-chest",   label: "Fly – chest",   dailyTarget: 10 },
  { id: "push-ups",    label: "Push ups",      dailyTarget: 10 },

  // --- Abs / core ---
  { id: "heel-taps",   label: "Heel taps – abs",   dailyTarget: 10 },
  { id: "hip-bridge",  label: "Hip bridge – abs",  dailyTarget: 10 },
  { id: "bird-dog",    label: "Bird dog – abs",    dailyTarget: 10 },
  { id: "dead-bug",    label: "Dead bug – abs",    dailyTarget: 10 },
  { id: "cat-cow",     label: "Cat cow – abs",     dailyTarget: 10 },

  // --- Legs / glutes ---
  { id: "squats",                 label: "Squats",                    dailyTarget: 10 },
  { id: "alt-reverse-lunges",     label: "Alternating reverse lunges",dailyTarget: 10 },
  { id: "sumo-squats",            label: "Sumo squats",               dailyTarget: 10 },
  { id: "alt-side-squats",        label: "Alternating side squats",   dailyTarget: 10 },
  { id: "rdl-right",              label: "RDL – right",               dailyTarget: 10 },
  { id: "rdl-left",               label: "RDL – left",                dailyTarget: 10 },
  { id: "calf-raises",            label: "Calf raises",               dailyTarget: 10 },

  // --- Back ---
  { id: "rows-back",       label: "Wide row / rows – back", dailyTarget: 10 },
  { id: "pulldown-back",   label: "Pull down – back",        dailyTarget: 10 },
  { id: "face-pulls-back", label: "Face pulls – back",       dailyTarget: 10 },

  // --- Arms ---
  { id: "bicep-curls",          label: "Bicep curls",             dailyTarget: 10 },
  { id: "hammer-curls",         label: "Hammer curls",            dailyTarget: 10 },
  { id: "tricep-kickbacks-r",   label: "Tricep kickbacks – right",dailyTarget: 10 },
  { id: "tricep-kickbacks-l",   label: "Tricep kickbacks – left", dailyTarget: 10 },
  { id: "skull-crushers",       label: "Skull crushers",          dailyTarget: 10 },
];

// "When was the last time I…" — body care & routines
const LAST_TIME_ITEMS = [
  {
    id: "bathed-baby",
    label: "Bathed baby",
    greenDays: 0,
    yellowDays: 2,
    redDays: 4,
  },
  {
    id: "litter-box",
    label: "Litter Box",
    greenDays: 0,
    yellowDays: 3,
    redDays: 5,
  },
  {
    id: "shaved-armpits",
    label: "Shaved armpits",
    greenDays: 0,
    yellowDays: 2,
    redDays: 4,
  },
  {
    id: "cleaned-eyebrows",
    label: "Cleaned eyebrows",
    greenDays: 0,
    yellowDays: 6,
    redDays: 10,
  },
  {
    id: "shaved-upper-lip",
    label: "Shaved upper lip",
    greenDays: 0,
    yellowDays: 6,
    redDays: 10,
  },
  {
    id: "shaved-bikini",
    label: "Shaved bikini area",
    greenDays: 0,
    yellowDays: 6,
    redDays: 10,
  },
  {
    id: "washed-hair",
    label: "Washed hair",
    greenDays: 0,
    yellowDays: 2,
    redDays: 4,
  },
  {
    id: "shaved-legs",
    label: "Shaved legs",
    greenDays: 0,
    yellowDays: 6,
    redDays: 10,
  },
  {
    id: "trimmed-toenails",
    label: "Trimmed toenails",
    greenDays: 0,
    yellowDays: 21,
    redDays: 35,
  },
  {
    id: "trimmed-nails",
    label: "Trimmed fingernails",
    greenDays: 0,
    yellowDays: 10,
    redDays: 21,
  },
];

// ---------- STATE ----------

let app;
let auth;
let db;
let currentUser = null;

let plannerState = {
  dateKey: null,
  context: {
    dayOfWeek: "",
    letterDay: "",
    daycare: "no",
  },
  mergedTasks: [],
  weeklyTasks: {
    work: [],
    home: [],
  },
};

let hideCompleted = false;

// goal/last-time local state
let goalCountsState = {};   // { goalId: countToday }
let hideCompletedGoals = false;
let lastTimeState = {};     // { itemId: "YYYY-MM-DD" }

// ---------- HELPERS ----------

function initFirebase() {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
  db = getFirestore(app);
}

function formatTodayLabel(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekKey(date) {
  const year = date.getFullYear();
  const start = new Date(year, 0, 1);
  const diffDays = Math.floor((date - start) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return `${year}-W${week}`;
}

function segmentFromTime(time24) {
  const [h] = time24.split(":").map((v) => parseInt(v, 10));
  if (h < 12) return "AM";
  if (h < 16) return "MID";
  return "PM";
}

function isWeekday(dayOfWeek) {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(
    dayOfWeek
  );
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildTaskId(source, label, extra = "") {
  return `${source}-${slugify(label)}${extra ? "-" + extra : ""}`;
}

function formatTime12(time24) {
  if (!time24) return "";
  const parts = time24.split(":");
  if (parts.length < 2) return time24;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function formatDateShort(date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((start - end) / msPerDay);
}

// ---------- LOAD & SAVE (FIRESTORE) ----------

async function loadDailyState(user, dateKey) {
  const ref = doc(db, DAILY_PREFIX, `${user.uid}_${dateKey}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function saveDailyState() {
  if (!currentUser || !plannerState.dateKey) return;
  const ref = doc(db, DAILY_PREFIX, `${currentUser.uid}_${plannerState.dateKey}`);
  const payload = {
    context: plannerState.context,
    mergedTasks: plannerState.mergedTasks,
    dateKey: plannerState.dateKey,
  };
  await setDoc(ref, payload, { merge: true });
}

async function loadParkingLot(user) {
  const ref = doc(db, PARKING_DOC, user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { work: "", home: "" };
  }

  const data = snap.data() || {};

  // Backwards compatibility: if there used to be one big text field,
  // treat it as "work" by default.
  const legacyText =
    typeof data.text === "string" ? data.text : "";

  return {
    work: data.work ?? legacyText ?? "",
    home: data.home ?? "",
  };
}

async function saveParkingLot(partial) {
  if (!currentUser) return;
  const ref = doc(db, PARKING_DOC, currentUser.uid);
  await setDoc(ref, partial, { merge: true });
}

// 🔄 UPDATED: Weekly tasks now merge Firestore + DEFAULT_WEEKLY_TASKS
async function loadWeeklyTasks(user, weekKey) {
  const ref = doc(db, WEEKLY_PREFIX, `${user.uid}_${weekKey}`);
  const snap = await getDoc(ref);

  // Normalize a stored task (adds statusType + safe status)
  const normalizeStored = (task) => {
    if (!task) return null;
    const title = task.title || "";
    const statusType =
      task.statusType || inferStatusTypeFromTitle(title);
    const cfg =
      WEEKLY_STATUS_TYPES[statusType] || WEEKLY_STATUS_TYPES.generic;
    const fallbackStatus = cfg.order[0] || "planned";
    const status =
      task.status && cfg.order.includes(task.status)
        ? task.status
        : fallbackStatus;

    return {
      id: task.id || buildTaskId("weekly", title),
      title,
      statusType,
      status,
    };
  };

  const buildFromDefaults = () => {
    const buildGroup = (defs, groupKey) =>
      defs.map((def) => {
        const title = typeof def === "string" ? def : def.title;
        const statusType =
          typeof def === "string"
            ? inferStatusTypeFromTitle(title)
            : def.statusType || inferStatusTypeFromTitle(title);

        const item = {
          id: buildTaskId(`weekly-${groupKey}`, title),
          title,
          statusType,
        };
        item.status = initialStatusForItem(item);
        return item;
      });

    return {
      weekKey,
      work: buildGroup(DEFAULT_WEEKLY_TASKS.work, "work"),
      home: buildGroup(DEFAULT_WEEKLY_TASKS.home, "home"),
    };
  };

  // First time this week → build from defaults
  if (!snap.exists()) {
    return buildFromDefaults();
  }

  // Merge existing Firestore data with current defaults
  const data = snap.data() || {};
  const storedWorkRaw = Array.isArray(data.work) ? data.work : [];
  const storedHomeRaw = Array.isArray(data.home) ? data.home : [];

  const storedWork = storedWorkRaw.map(normalizeStored).filter(Boolean);
  const storedHome = storedHomeRaw.map(normalizeStored).filter(Boolean);

  const workByTitle = new Map(storedWork.map((t) => [t.title, t]));
  const homeByTitle = new Map(storedHome.map((t) => [t.title, t]));

  const mergeDefaults = (defs, groupKey, byTitle) =>
    defs.map((def) => {
      const title = typeof def === "string" ? def : def.title;
      const existing = byTitle.get(title);
      if (existing) return existing;

      const statusType =
        typeof def === "string"
          ? inferStatusTypeFromTitle(title)
          : def.statusType || inferStatusTypeFromTitle(title);

      const item = {
        id: buildTaskId(`weekly-${groupKey}`, title),
        title,
        statusType,
      };
      item.status = initialStatusForItem(item);
      return item;
    });

  const mergedWork = mergeDefaults(
    DEFAULT_WEEKLY_TASKS.work,
    "work",
    workByTitle
  );
  const mergedHome = mergeDefaults(
    DEFAULT_WEEKLY_TASKS.home,
    "home",
    homeByTitle
  );

  // Keep any extra user-created tasks
  storedWork.forEach((t) => {
    if (!mergedWork.some((x) => x.title === t.title)) {
      mergedWork.push(t);
    }
  });
  storedHome.forEach((t) => {
    if (!mergedHome.some((x) => x.title === t.title)) {
      mergedHome.push(t);
    }
  });

  return {
    weekKey,
    work: mergedWork,
    home: mergedHome,
  };
}

async function saveWeeklyTasks(weeklyState) {
  if (!currentUser || !weeklyState || !weeklyState.weekKey) return;
  const ref = doc(
    db,
    WEEKLY_PREFIX,
    `${currentUser.uid}_${weeklyState.weekKey}`
  );
  await setDoc(ref, weeklyState, { merge: true });
}

// --- Firestore for goal trackers ---

async function loadGoalCountsFromFirestore(user, dateKey) {
  const ref = doc(db, GOALS_PREFIX, `${user.uid}_${dateKey}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    goalCountsState = {};
    return;
  }
  const data = snap.data();
  goalCountsState = data.counts || {};
}

async function saveGoalCountsToFirestore() {
  if (!currentUser || !plannerState.dateKey) return;
  const ref = doc(
    db,
    GOALS_PREFIX,
    `${currentUser.uid}_${plannerState.dateKey}`
  );
  await setDoc(
    ref,
    {
      counts: goalCountsState,
      dateKey: plannerState.dateKey,
    },
    { merge: true }
  );
}

// --- Firestore for "last time I..." ---

async function loadLastTimeStateFromFirestore(user) {
  const ref = doc(db, LASTTIME_PREFIX, user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    lastTimeState = {};
    return;
  }
  const data = snap.data();
  lastTimeState = data.lastDone || {};
}

async function saveLastTimeStateToFirestore() {
  if (!currentUser) return;
  const ref = doc(db, LASTTIME_PREFIX, currentUser.uid);
  await setDoc(ref, { lastDone: lastTimeState }, { merge: true });
}

// ---------- MERGED TASKS BUILD ----------

function buildMergedTasksFromContext(context, previousTasks = []) {
  const { dayOfWeek, letterDay, daycare } = context;
  console.log("Rebuilding merged tasks with context:", context);

  const hasLetterDay = !!letterDay && letterDay !== "NONE";
  const isSchoolDay = isWeekday(dayOfWeek) && hasLetterDay;

  const prevById = {};
  (previousTasks || []).forEach((t) => {
    if (t && t.id) prevById[t.id] = t;
  });

  const tasks = [];

  function addTask({ source, label, detail, time24, segment }) {
    const id = buildTaskId(source, label, time24 || "");
    const prev = prevById[id];
    tasks.push({
      id,
      label,
      detail,
      time24: time24 || "",
      segment: segment || segmentFromTime(time24 || "09:00"),
      source,
      completed: prev ? !!prev.completed : false,
    });
  }

  // 1) Everyday AM tasks
  EVERYDAY_AM_TASKS.forEach((item) => {
    addTask({
      source: "everyday-am",
      label: item.label,
      detail: "Daily @ 06:00",
      time24: item.time24,
      segment: "AM",
    });
  });

  // 2) Everyday PM tasks
  EVERYDAY_PM_TASKS.forEach((item) => {
    addTask({
      source: "everyday-pm",
      label: item.label,
      detail: "Daily @ 20:00",
      time24: item.time24,
      segment: "PM",
    });
  });

  // 3) School-day AM tasks
  if (isSchoolDay) {
    SCHOOL_AM_TASKS.forEach((item) => {
      addTask({
        source: "school-am",
        label: item.label,
        detail: "School day @ 06:00",
        time24: item.time24,
        segment: "AM",
      });
    });
  }

  // 4) Daycare AM tasks
  if (daycare === "yes") {
    DAYCARE_AM_TASKS.forEach((item) => {
      addTask({
        source: "daycare-am",
        label: item.label,
        detail: "Daycare @ 06:00",
        time24: item.time24,
        segment: "AM",
      });
    });
  }

  // 5) Letter day schedule (classes)
  if (hasLetterDay && SCHEDULE_BY_LETTER_DAY[letterDay]) {
    const slots = SCHEDULE_BY_LETTER_DAY[letterDay];

    slots.forEach((slot) => {
      addTask({
        source: "class",
        label: slot.title,
        detail: `${letterDay} Day • ${slot.time24}`,
        time24: slot.time24,
        segment: segmentFromTime(slot.time24),
      });
    });

    // 6) Work open
    WORK_OPEN_TASKS.forEach((item) => {
      addTask({
        source: "work-open",
        label: item.label,
        detail: "Work open @ 09:00",
        time24: item.time24,
        segment: segmentFromTime(item.time24),
      });
    });

    // 7) Work close (after last scheduled class)
    const sortedSlots = [...slots].sort((a, b) =>
      a.time24.localeCompare(b.time24)
    );
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    const lastTime = lastSlot ? lastSlot.time24 : "15:30";
    const closeSegment = segmentFromTime(lastTime);

    WORK_CLOSE_TASKS.forEach((label) => {
      addTask({
        source: "work-close",
        label,
        detail: `Work close (after last class ~${lastTime})`,
        time24: lastTime,
        segment: closeSegment,
      });
    });
  }

  const segmentOrder = { AM: 0, MID: 1, PM: 2 };
  tasks.sort((a, b) => {
    const segDiff =
      (segmentOrder[a.segment] ?? 0) - (segmentOrder[b.segment] ?? 0);
    if (segDiff !== 0) return segDiff;

    if (a.time24 && b.time24 && a.time24 !== b.time24) {
      return a.time24.localeCompare(b.time24);
    }

    return a.label.localeCompare(b.label);
  });

  console.log("Merged tasks count:", tasks.length);
  return tasks;
}

// ---------- RENDERING ----------

function renderToday(date) {
  const el = document.getElementById("today-label");
  if (el) {
    el.textContent = formatTodayLabel(date);
  }
}

function hydrateContextForm(context) {
  const daySelect = document.getElementById("day-of-week");
  const letterSelect = document.getElementById("letter-day");
  const daycareToggle = document.getElementById("daycare-toggle");
  const status = document.getElementById("context-status");

  if (daySelect) daySelect.value = context.dayOfWeek || "";
  if (letterSelect) letterSelect.value = context.letterDay || "";
  if (daycareToggle) {
    Array.from(daycareToggle.querySelectorAll(".pill-option")).forEach(
      (btn) => {
        const v = btn.dataset.value;
        if (v === context.daycare) {
          btn.classList.add("pill-option--active");
        } else {
          btn.classList.remove("pill-option--active");
        }
      }
    );
  }
  if (status) {
    if (context.letterDay || context.dayOfWeek) {
      status.textContent = "Context applied. You can update anytime.";
    } else {
      status.textContent = "Context not applied yet.";
    }
  }
}

function renderMergedTasks() {
  const amList = document.getElementById("am-task-list");
  const arriveList = document.getElementById("arrive-task-list");
  const midList = document.getElementById("mid-task-list");
  const pmList = document.getElementById("pm-task-list");
  if (!amList || !arriveList || !midList || !pmList) return;

  amList.innerHTML = "";
  arriveList.innerHTML = "";
  midList.innerHTML = "";
  pmList.innerHTML = "";

  plannerState.mergedTasks.forEach((task) => {
    if (hideCompleted && task.completed) return;

    const li = document.createElement("li");
    li.className = "task-item" + (task.completed ? " completed" : "");
    li.dataset.taskId = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!task.completed;
    checkbox.addEventListener("change", () => {
      toggleTaskCompleted(task.id, checkbox.checked);
    });

    const label = document.createElement("div");
    label.className = "task-item-label";
    label.textContent = task.label;

    const meta = document.createElement("div");
    meta.className = "task-item-meta";

    let metaText = "";
    if (task.time24) {
      const pretty = formatTime12(task.time24);
      if (task.detail) {
        if (task.detail.includes(task.time24)) {
          metaText = task.detail.replace(task.time24, pretty);
        } else {
          metaText = `${task.detail} • ${pretty}`;
        }
      } else {
        metaText = pretty;
      }
    } else {
      metaText = task.detail || "";
    }
    meta.textContent = metaText;

    li.appendChild(checkbox);
    const contentWrap = document.createElement("div");
    contentWrap.style.flex = "1";
    contentWrap.appendChild(label);
    contentWrap.appendChild(meta);
    li.appendChild(contentWrap);

    const seg = task.segment || "AM";
    const source = task.source || "";

    let targetList = null;

    // Morning personal + school/daycare AM routines
    if (
      seg === "AM" &&
      (source === "everyday-am" ||
        source === "school-am" ||
        source === "daycare-am")
    ) {
      targetList = amList;
    }
    // Work Arrive: work-open tasks + AM classes
    else if (
      source === "work-open" ||
      (source === "class" && seg === "AM")
    ) {
      targetList = arriveList;
    }
    // Midday tasks
    else if (seg === "MID") {
      targetList = midList;
    }
    // PM tasks
    else if (seg === "PM") {
      targetList = pmList;
    }
    // Fallback: route by segment
    else if (seg === "AM") {
      targetList = amList;
    } else {
      targetList = pmList;
    }

    targetList.appendChild(li);
  });

  function ensurePlaceholder(listEl) {
    if (!listEl) return;
    if (listEl.children.length === 0) {
      const empty = document.createElement("li");
      empty.className = "task-item";
      empty.innerHTML =
        '<span class="task-item-label" style="opacity:.6;">No tasks in this band yet.</span>';
      listEl.appendChild(empty);
    }
  }

  ensurePlaceholder(amList);
  ensurePlaceholder(arriveList);
  ensurePlaceholder(midList);
  ensurePlaceholder(pmList);
}

function toggleTaskCompleted(taskId, completed) {
  const t = plannerState.mergedTasks.find((x) => x.id === taskId);
  if (!t) return;
  t.completed = completed;

  const node = document.querySelector(
    `.task-item[data-task-id="${CSS.escape(taskId)}"]`
  );
  if (node) {
    if (completed) node.classList.add("completed");
    else node.classList.remove("completed");
  }

  saveDailyState().catch(console.error);
}

// Parking lot

function hydrateParkingLots(data) {
  const workTa = document.getElementById("parking-work");
  const homeTa = document.getElementById("parking-home");

  if (workTa) workTa.value = (data && data.work) || "";
  if (homeTa) homeTa.value = (data && data.home) || "";
}

// Weekly tasks

function renderWeeklyTasks(weeklyState) {
  const workWrap = document.getElementById("weekly-work-list");
  const homeWrap = document.getElementById("weekly-home-list");
  if (!workWrap || !homeWrap) return;

  workWrap.innerHTML = "";
  homeWrap.innerHTML = "";

  function renderGroup(list, container, groupKey) {
    list.forEach((item) => {
      const root = document.createElement("div");
      root.className = "weekly-task";
      root.dataset.taskId = item.id;
      root.dataset.group = groupKey;

      const header = document.createElement("div");
      header.className = "weekly-task-header";

      const title = document.createElement("div");
      title.className = "weekly-task-title";
      title.textContent = item.title;

      const pill = document.createElement("button");
      pill.type = "button";
      pill.className =
        "weekly-status-pill " + getWeeklyStatusClass(item.status, item);
      pill.textContent = statusLabel(item.status, item);
      pill.addEventListener("click", () => {
        cycleWeeklyStatus(weeklyState, groupKey, item.id);
      });

      header.appendChild(title);
      header.appendChild(pill);

      const track = document.createElement("div");
      track.className = "weekly-progress-track";

      const fill = document.createElement("div");
      fill.className = "weekly-progress-fill";
      fill.style.width = statusPercentage(item.status, item) + "%";
      track.appendChild(fill);

      root.appendChild(header);
      root.appendChild(track);

      container.appendChild(root);
    });
  }

  renderGroup(weeklyState.work, workWrap, "work");
  renderGroup(weeklyState.home, homeWrap, "home");
}

function getWeeklyStatusClass(status, item) {
  const cfg = getStatusConfigForItem(item || {});
  const fallback = cfg.order[0] || "planned";
  const key =
    status && cfg.order.includes(status) ? status : fallback;
  return cfg.classMap[key] || "weekly-status--planned";
}

function statusLabel(status, item) {
  const cfg = getStatusConfigForItem(item || {});
  const fallback = cfg.order[0] || "planned";
  const key =
    status && cfg.order.includes(status) ? status : fallback;
  return cfg.labelMap[key] || "Planned";
}

function statusPercentage(status, item) {
  const cfg = getStatusConfigForItem(item || {});
  const fallback = cfg.order[0] || "planned";
  const key =
    status && cfg.order.includes(status) ? status : fallback;
  return cfg.percentageMap[key] ?? 0;
}

async function cycleWeeklyStatus(weeklyState, groupKey, taskId) {
  const list = weeklyState[groupKey];
  const item = list.find((x) => x.id === taskId);
  if (!item) return;

  const cfg = getStatusConfigForItem(item);
  const order = cfg.order && cfg.order.length ? cfg.order : ["planned"];

  const current =
    item.status && order.includes(item.status)
      ? item.status
      : order[0];

  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length];
  item.status = next;

  renderWeeklyTasks(weeklyState);
  await saveWeeklyTasks(weeklyState);
}

// ---------- GOAL TRACKERS ----------

function renderGoalTrackers() {
  const listEl = document.getElementById("goal-tracker-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  const items = GOAL_TRACKERS.map((def) => {
    const count = goalCountsState[def.id] || 0;
    const completed = count >= def.dailyTarget;
    return { ...def, count, completed };
  });

  // Incomplete first, completed last
  items.sort((a, b) => Number(a.completed) - Number(b.completed));

  items.forEach((item) => {
    if (hideCompletedGoals && item.completed) return;

    const li = document.createElement("li");
    li.className = "goal-row";
    li.dataset.goalId = item.id;

    const main = document.createElement("div");
    main.className = "goal-main";

    const label = document.createElement("div");
    label.className = "goal-label";
    label.textContent = item.label;

    const sub = document.createElement("div");
    sub.className = "goal-sub";
    sub.textContent = `${item.count} / ${item.dailyTarget} today`;

    main.appendChild(label);
    main.appendChild(sub);

    const controls = document.createElement("div");
    controls.className = "goal-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "goal-btn";
    minus.textContent = "−";
    minus.addEventListener("click", () => {
      changeGoalCount(item.id, -1);
    });

    const bubble = document.createElement("span");
    bubble.className = "goal-count-bubble";
    bubble.textContent = String(item.count);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "goal-btn";
    plus.textContent = "+";
    plus.addEventListener("click", () => {
      changeGoalCount(item.id, +1);
    });

    controls.appendChild(minus);
    controls.appendChild(bubble);
    controls.appendChild(plus);

    li.appendChild(main);
    li.appendChild(controls);

    listEl.appendChild(li);
  });

  if (!listEl.children.length) {
    const li = document.createElement("li");
    li.className = "goal-row";
    const span = document.createElement("span");
    span.className = "goal-sub";
    span.textContent = "No visible goals – unhide completed to see all.";
    li.appendChild(span);
    listEl.appendChild(li);
  }
}

async function changeGoalCount(goalId, delta) {
  const current = goalCountsState[goalId] || 0;
  const next = Math.max(0, current + delta);
  goalCountsState[goalId] = next;
  await saveGoalCountsToFirestore();
  renderGoalTrackers();
}

// ---------- LAST-TIME TRACKER ----------

function computeLastTimeStatus(def, today) {
  const iso = lastTimeState[def.id];
  if (!iso) {
    // Never done: treat like yellow so it shows up gently
    return { status: "yellow", daysSince: null };
  }
  const last = new Date(iso);
  const diff = daysBetween(today, last); // today - last
  let status;
  if (diff <= def.greenDays) {
    status = "green";
  } else if (diff <= def.yellowDays) {
    status = "yellow";
  } else {
    status = "red";
  }
  return { status, daysSince: diff };
}

function renderLastTimeList() {
  const listEl = document.getElementById("last-time-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  const today = new Date();

  const statusRank = { red: 0, yellow: 1, green: 2 };

  const items = LAST_TIME_ITEMS.map((def) => {
    const info = computeLastTimeStatus(def, today);
    return { ...def, ...info };
  });

  // Overdue (red) at top, then yellow, then green.
  // Within same color, longer ago floats first.
  items.sort((a, b) => {
    const r = statusRank[a.status] - statusRank[b.status];
    if (r !== 0) return r;
    const da = a.daysSince == null ? -1 : a.daysSince;
    const db = b.daysSince == null ? -1 : b.daysSince;
    return db - da;
  });

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "last-time-row";
    li.dataset.itemId = item.id;

    const main = document.createElement("div");
    main.className = "last-time-main";

    const label = document.createElement("div");
    label.className = "last-time-label";
    label.textContent = item.label;

    const sub = document.createElement("div");
    sub.className = "last-time-sub";

    if (item.daysSince == null) {
      sub.textContent = "Not tracked yet.";
    } else if (item.daysSince === 0) {
      sub.textContent = "Today";
    } else if (item.daysSince === 1) {
      sub.textContent = "1 day ago";
    } else {
      const last = new Date(lastTimeState[item.id]);
      sub.textContent = `${item.daysSince} days ago (${formatDateShort(
        last
      )})`;
    }

    main.appendChild(label);
    main.appendChild(sub);

    const controls = document.createElement("div");
    controls.className = "last-time-controls";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "last-time-btn";
    btn.textContent = "Just did it";
    btn.addEventListener("click", async () => {
      lastTimeState[item.id] = getDateKey(today);
      await saveLastTimeStateToFirestore();
      renderLastTimeList();
    });

    const pill = document.createElement("span");
    pill.className =
      "last-time-status-pill " + `last-time-status--${item.status}`;
    pill.textContent =
      item.status === "green"
        ? "Good"
        : item.status === "yellow"
        ? "Soon"
        : "Overdue";

    controls.appendChild(btn);
    controls.appendChild(pill);

    li.appendChild(main);
    li.appendChild(controls);

    listEl.appendChild(li);
  });
}

// ---------- COLLAPSIBLES & MINI HIDES ----------

function setupCollapsibles() {
  document.querySelectorAll(".collapsible").forEach((section) => {
    const header = section.querySelector(".collapsible-header");
    const toggleBtn = section.querySelector(".collapse-toggle");
    const body = section.querySelector(".collapsible-body");
    if (!header || !toggleBtn || !body) return;

    section.classList.remove("collapsed");

    header.addEventListener("click", (e) => {
      if (e.target.closest("button") && e.target !== toggleBtn) return;
      toggleSection(section, toggleBtn);
    });

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSection(section, toggleBtn);
    });
  });
}

function toggleSection(section, toggleBtn) {
  const isCollapsed = section.classList.toggle("collapsed");
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
    const label = toggleBtn.querySelector(".collapse-label");
    if (label) label.textContent = isCollapsed ? "Show" : "Hide";
  }
}

function setupWeeklyMiniHides() {
  document.querySelectorAll(".mini-hide-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      if (!targetId) return;

      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const isHidden = targetEl.classList.toggle("hidden");
      btn.textContent = isHidden ? "Show" : "Hide";
    });
  });
}

// ---------- MAIN FLOW ----------

async function initDashboardForUser(user) {
  currentUser = user;

  const userChip = document.getElementById("user-email");
  if (userChip) userChip.textContent = user.email || "Signed in";

  const today = new Date();
  plannerState.dateKey = getDateKey(today);
  renderToday(today);

  // Daily merged tasks
  const existing = await loadDailyState(user, plannerState.dateKey);
  if (existing && existing.context) {
    plannerState.context = {
      dayOfWeek: existing.context.dayOfWeek || "",
      letterDay: existing.context.letterDay || "",
      daycare: existing.context.daycare || "no",
    };
    plannerState.mergedTasks = existing.mergedTasks || [];
  }

  hydrateContextForm(plannerState.context);
  if (!plannerState.mergedTasks.length) {
    plannerState.mergedTasks = buildMergedTasksFromContext(
      plannerState.context,
      []
    );
  }

  renderMergedTasks();

  // Parking lot (work + home)
  const parkingData = await loadParkingLot(user);
  hydrateParkingLots(parkingData);

  const parkingWork = document.getElementById("parking-work");
  const parkingHome = document.getElementById("parking-home");
  const parkingWorkStatus = document.getElementById("parking-work-status");
  const parkingHomeStatus = document.getElementById("parking-home-status");

  let parkingWorkTimer = null;
  let parkingHomeTimer = null;

  if (parkingWork) {
    parkingWork.addEventListener("input", () => {
      if (parkingWorkStatus) parkingWorkStatus.textContent = "Saving…";
      clearTimeout(parkingWorkTimer);
      parkingWorkTimer = setTimeout(async () => {
        await saveParkingLot({ work: parkingWork.value });
        if (parkingWorkStatus) {
          parkingWorkStatus.textContent = "Saved automatically.";
        }
      }, 400);
    });
  }

  if (parkingHome) {
    parkingHome.addEventListener("input", () => {
      if (parkingHomeStatus) parkingHomeStatus.textContent = "Saving…";
      clearTimeout(parkingHomeTimer);
      parkingHomeTimer = setTimeout(async () => {
        await saveParkingLot({ home: parkingHome.value });
        if (parkingHomeStatus) {
          parkingHomeStatus.textContent = "Saved automatically.";
        }
      }, 400);
    });
  }

  // Weekly tasks

  const weekKey = getWeekKey(today);
  const weeklyState = await loadWeeklyTasks(user, weekKey);
  renderWeeklyTasks(weeklyState);
  setupWeeklyMiniHides();

  // Goal trackers (daily, Firestore)
  await loadGoalCountsFromFirestore(user, plannerState.dateKey);
  renderGoalTrackers();

  const hideGoalsBox = document.getElementById("hide-completed-goals");
  if (hideGoalsBox) {
    hideCompletedGoals = hideGoalsBox.checked;
    hideGoalsBox.addEventListener("change", () => {
      hideCompletedGoals = hideGoalsBox.checked;
      renderGoalTrackers();
    });
  }

  // Last-time tracker (per user, Firestore)
  await loadLastTimeStateFromFirestore(user);
  renderLastTimeList();

  // Hide completed merged tasks toggle
  const hideBox = document.getElementById("hide-completed");
  if (hideBox) {
    hideBox.checked = hideCompleted;
    hideBox.addEventListener("change", () => {
      hideCompleted = hideBox.checked;
      renderMergedTasks();
    });
  }

  // Context apply
  const applyBtn = document.getElementById("apply-context");
  if (applyBtn) {
    applyBtn.addEventListener("click", async () => {
      const daySelect = document.getElementById("day-of-week");
      const letterSelect = document.getElementById("letter-day");
      const daycareToggle = document.getElementById("daycare-toggle");
      const status = document.getElementById("context-status");

      const dayOfWeek = daySelect ? daySelect.value : "";
      const letterDay = letterSelect ? letterSelect.value : "";
      let daycare = plannerState.context.daycare || "no";
      if (daycareToggle) {
        const active = daycareToggle.querySelector(".pill-option--active");
        if (active) daycare = active.dataset.value || "no";
      }

      plannerState.context = { dayOfWeek, letterDay, daycare };

      plannerState.mergedTasks = buildMergedTasksFromContext(
        plannerState.context,
        plannerState.mergedTasks
      );
      renderMergedTasks();
      await saveDailyState();

      hydrateContextForm(plannerState.context);
      if (status) {
        status.textContent = "Context updated for today.";
      }
    });
  }

  // Daycare toggle visual state
  const daycareToggle = document.getElementById("daycare-toggle");
  if (daycareToggle) {
    daycareToggle.querySelectorAll(".pill-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        daycareToggle.querySelectorAll(".pill-option").forEach((b) =>
          b.classList.remove("pill-option--active")
        );
        btn.classList.add("pill-option--active");
      });
    });
  }

  setupCollapsibles();
}

// ---------- AUTH GUARD ----------

async function start() {
  initFirebase();

  const unauthorizedBanner = document.getElementById("unauthorized-banner");

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "../login.html";
      return;
    }

    if (!ALLOWED_EMAILS.includes(user.email || "")) {
      if (unauthorizedBanner) unauthorizedBanner.classList.remove("hidden");
      const userChip = document.getElementById("user-email");
      if (userChip) userChip.textContent = user.email || "Unauthorized";
      setTimeout(async () => {
        try {
          await signOut(auth);
        } catch (e) {
          console.error(e);
        }
        window.location.href = "../login.html";
      }, 3500);
      return;
    }

    if (unauthorizedBanner) unauthorizedBanner.classList.add("hidden");
    await initDashboardForUser(user);
  });
}

start().catch(console.error);
