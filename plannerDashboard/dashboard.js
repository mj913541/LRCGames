// LRCGames/plannerDashboard/dashboard.js
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

/**
 * FIREBASE INIT
 */
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

// Simple helper to format YYYY-MM-DD
function todayDateKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyFromInput(inputEl) {
  return inputEl.value;
}

// Map time-of-day blocks
const TIME_BLOCK_LABELS = {
  morning: "Morning",
  workOpen: "Work open",
  midday: "Midday",
  workClose: "Work close",
  evening: "Arrive home",
  bedtime: "Bedtime"
};

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

// === STATE ===
let currentUser = null;
let currentDateKey = todayDateKey();

let state = {
  context: {
    dayOfWeek: "",
    letterDay: "",
    daycareDay: false,
    therapyTonight: false
  },
  tasks: [],          // { id, label, block, type: 'task'|'appointment', time24?, completed, auto? }
  parkingLot: [],     // strings
  metrics: {          // all trackers "like the water cup"
    water: 0,
    steps: 0,
    stretch: 0,
    meditate: 0,
    reps: 0          // computed from workouts
  },
  trackerGoals: {
    water: 8,
    steps: 6000,
    stretch: 10,
    meditate: 10,
    reps: 100       // global daily reps goal (per-move goal is 30 below)
  },
  workouts: [],       // { id, move, weight, reps, goal: 30 }
  lastTimeItems: [],  // { id, label, lastDone }
  note: "",
  celebration: {
    movementWin: false
  }
};

// === DOM REFS ===
const daySummaryEl = document.getElementById("daySummary");
const logoutBtn = document.getElementById("logoutBtn");

const contextForm = document.getElementById("contextForm");
const dayOfWeekSelect = document.getElementById("dayOfWeek");
const letterDaySelect = document.getElementById("letterDay");
const daycareToggle = document.getElementById("daycareToggle");
const therapyToggle = document.getElementById("therapyToggle");
const planDateInput = document.getElementById("planDate");
const reloadDayBtn = document.getElementById("reloadDayBtn");

const hideCompletedTasksCheckbox = document.getElementById("hideCompletedTasks");
const timelineContainer = document.getElementById("timelineContainer");
const newTaskBlockSelect = document.getElementById("newTaskBlock");
const newTaskTextInput = document.getElementById("newTaskText");
const addTaskBtn = document.getElementById("addTaskBtn");

const parkingListEl = document.getElementById("parkingList");
const parkingInput = document.getElementById("parkingInput");
const addParkingBtn = document.getElementById("addParkingBtn");

// Trackers
const waterMinusBtn = document.getElementById("waterMinus");
const waterPlusBtn = document.getElementById("waterPlus");
const waterCountEl = document.getElementById("waterCount");
const waterGoalInput = document.getElementById("waterGoal");

const stepMinusBtn = document.getElementById("stepMinus");
const stepPlusBtn = document.getElementById("stepPlus");
const stepCountEl = document.getElementById("stepCount");
const stepGoalInput = document.getElementById("stepGoal");

const stretchMinusBtn = document.getElementById("stretchMinus");
const stretchPlusBtn = document.getElementById("stretchPlus");
const stretchCountEl = document.getElementById("stretchCount");
const stretchGoalInput = document.getElementById("stretchGoal");

const medMinusBtn = document.getElementById("medMinus");
const medPlusBtn = document.getElementById("medPlus");
const medCountEl = document.getElementById("medCount");
const medGoalInput = document.getElementById("medGoal");

const repsCountEl = document.getElementById("repsCount");
const repsGoalInput = document.getElementById("repsGoal");

// Daily wins banner
const movementWinBanner = document.getElementById("movementWinBanner");

// Workouts
const workoutBody = document.getElementById("workoutBody");
const newWorkoutMoveInput = document.getElementById("newWorkoutMove");
const addWorkoutRowBtn = document.getElementById("addWorkoutRowBtn");

const lastTimeListEl = document.getElementById("lastTimeList");
const newLastTimeTextInput = document.getElementById("newLastTimeText");
const addLastTimeBtn = document.getElementById("addLastTimeBtn");

const noteBox = document.getElementById("noteBox");

// === AUTH ===
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

  if (!planDateInput.value) {
    planDateInput.value = todayDateKey();
  }
  currentDateKey = dateKeyFromInput(planDateInput);

  await loadDayFromFirestore();
  renderAll();
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../login.html";
});

// === HELPERS ===
function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatTime12h(time24) {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function daysBetween(dateKey) {
  if (!dateKey) return null;
  const parts = dateKey.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const diffMs = now - then;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function lastTimeColor(days) {
  if (days === null) return "green";
  if (days <= 2) return "green";
  if (days <= 6) return "yellow";
  return "red";
}

// Map a 24hr time to one of the blocks
function blockForTime(time24) {
  if (!time24) return "midday";
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const mins = h * 60 + parseInt(mStr, 10);

  if (mins < 9 * 60) return "morning";              // before 9:00
  if (mins < 11 * 60) return "workOpen";           // 9:00–10:59
  if (mins < 13 * 60) return "midday";             // 11:00–12:59
  if (mins < 16 * 60) return "workClose";          // 13:00–15:59
  if (mins < 21 * 60) return "evening";            // 16:00–20:59
  return "bedtime";                                // 21:00+
}

function isWeekday() {
  const d = state.context.dayOfWeek;
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(d);
}

// Compute total reps from workouts into metrics.reps
function updateRepsFromWorkouts() {
  const total = (state.workouts || []).reduce((sum, w) => {
    const r = parseInt(w.reps || 0, 10);
    return sum + (isNaN(r) ? 0 : r);
  }, 0);
  if (!state.metrics) state.metrics = {};
  state.metrics.reps = total;
}

function ensureDefaults() {
  if (!state.metrics) {
    state.metrics = {
      water: 0,
      steps: 0,
      stretch: 0,
      meditate: 0,
      reps: 0
    };
  }

  if (!state.trackerGoals) {
    state.trackerGoals = {
      water: 8,
      steps: 6000,
      stretch: 10,
      meditate: 10,
      reps: 100
    };
  } else {
    if (state.trackerGoals.water == null) state.trackerGoals.water = 8;
    if (state.trackerGoals.steps == null) state.trackerGoals.steps = 6000;
    if (state.trackerGoals.stretch == null) state.trackerGoals.stretch = 10;
    if (state.trackerGoals.meditate == null) state.trackerGoals.meditate = 10;
    if (state.trackerGoals.reps == null) state.trackerGoals.reps = 100;
  }

  // Default exercises list (goal 30 reps each)
  if (!state.workouts || !state.workouts.length) {
    const defaultMoves = [
      "front lift - shoulders",
      "side lift - shoulders",
      "reverse flys - shoulders",
      "press - chest",
      "fly - chest",
      "push ups",
      "heel taps - abs",
      "hip bridge - abs",
      "bird dog - abs",
      "dead bug - abs",
      "cat cow - abs",
      "squats",
      "alternating reverse lunges",
      "sumo squats",
      "Alt side squats",
      "RDL right",
      "RDL left",
      "Calf Raises",
      "wide row / rows - back",
      "pull down - back",
      "face pulls - back",
      "bicep curls",
      "hammer curls",
      "tricep kickbacks right",
      "tricep kickbacks left",
      "skull crushers"
    ];
    state.workouts = defaultMoves.map((m) => ({
      id: uuid(),
      move: m,
      weight: "",
      reps: 0,
      goal: 30
    }));
  }

  if (!state.lastTimeItems || !state.lastTimeItems.length) {
    state.lastTimeItems = [
      { id: uuid(), label: "Changed sheets", lastDone: todayDateKey() },
      { id: uuid(), label: "Cleaned car", lastDone: "" },
      { id: uuid(), label: "Shaved my armpits", lastDone: "" },
      { id: uuid(), label: "Cleaned eyebrows", lastDone: "" },
      { id: uuid(), label: "Shaved lips", lastDone: "" },
      { id: uuid(), label: "Shaved 🐱", lastDone: "" },
      { id: uuid(), label: "Washed hair", lastDone: "" },
      { id: uuid(), label: "Shaved legs", lastDone: "" },
      { id: uuid(), label: "Toenails", lastDone: "" },
      { id: uuid(), label: "Nails", lastDone: "" }
    ];
  }

  if (!state.celebration) {
    state.celebration = { movementWin: false };
  }

  updateRepsFromWorkouts();
}

// === FIRESTORE LOAD / SAVE ===
async function loadDayFromFirestore() {
  if (!currentUser || !currentDateKey) return;

  const docRef = doc(db, "plannerDays", `${currentUser.uid}_${currentDateKey}`);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    const data = snap.data() || {};
    state = { ...state, ...data };
  }

  generateTasksFromContext();
  ensureDefaults();
}

async function saveDayToFirestore() {
  if (!currentUser || !currentDateKey) return;
  const docRef = doc(db, "plannerDays", `${currentUser.uid}_${currentDateKey}`);
  const payload = { ...state };
  await setDoc(docRef, payload, { merge: true });
}

// === CONTEXT HANDLERS ===
function updateDaySummary() {
  const parts = [];
  if (state.context.dayOfWeek) parts.push(state.context.dayOfWeek);

  if (state.context.letterDay === "NONE") {
    parts.push("No school");
  } else if (state.context.letterDay) {
    parts.push(`${state.context.letterDay} Day`);
  }

  parts.push(state.context.daycareDay ? "Daycare ✓" : "No daycare");
  parts.push(state.context.therapyTonight ? "Therapy tonight" : "No therapy");
  parts.push(currentDateKey);
  daySummaryEl.textContent = parts.join(" · ");
}

function setToggle(btn, isOn) {
  btn.dataset.value = isOn ? "yes" : "no";
  if (isOn) {
    btn.classList.add("is-on");
    btn.textContent = "Yes";
  } else {
    btn.classList.remove("is-on");
    btn.textContent = "No";
  }
}

daycareToggle.addEventListener("click", () => {
  const currentlyYes = daycareToggle.dataset.value === "yes";
  setToggle(daycareToggle, !currentlyYes);
  state.context.daycareDay = !currentlyYes;
  generateTasksFromContext();
  saveDayToFirestore();
  renderTasksAndAppointments();
});

therapyToggle.addEventListener("click", () => {
  const currentlyYes = therapyToggle.dataset.value === "yes";
  setToggle(therapyToggle, !currentlyYes);
  state.context.therapyTonight = !currentlyYes;
  generateTasksFromContext();
  saveDayToFirestore();
  renderTasksAndAppointments();
});

contextForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  state.context.dayOfWeek = dayOfWeekSelect.value;
  state.context.letterDay = letterDaySelect.value;
  state.context.daycareDay = daycareToggle.dataset.value === "yes";
  state.context.therapyTonight = therapyToggle.dataset.value === "yes";

  currentDateKey = dateKeyFromInput(planDateInput);

  generateTasksFromContext();
  await saveDayToFirestore();
  renderAll();
});

reloadDayBtn.addEventListener("click", async () => {
  currentDateKey = dateKeyFromInput(planDateInput);
  state.tasks = [];
  await loadDayFromFirestore();
  renderAll();
});

// === TASK / APPOINTMENT GENERATION ===
function generateTasksFromContext() {
  // Remove previous auto-generated tasks/appointments, keep manual ones
  state.tasks = state.tasks.filter((t) => !t.auto);

  const blockTasks = [];

  // ----- MORNING -----
  blockTasks.push({
    label: "Check dashboard & pick top 3 priorities",
    block: "morning"
  });

  // AM Must-Do
  blockTasks.push({ label: "Switch dishwasher", block: "morning" });
  blockTasks.push({ label: "Clean glasses", block: "morning" });
  blockTasks.push({ label: "Deodorant", block: "morning" });
  blockTasks.push({ label: "Eat breakfast", block: "morning" });
  blockTasks.push({ label: "Levothyroxine", block: "morning" });
  blockTasks.push({ label: "Brush teeth (AM)", block: "morning" });
  blockTasks.push({ label: "Floss (AM)", block: "morning" });
  blockTasks.push({ label: "Get dressed", block: "morning" });
  blockTasks.push({ label: "Wash face (AM)", block: "morning" });
  blockTasks.push({ label: "Style hair", block: "morning" });
  blockTasks.push({ label: "Feed cat & refresh water", block: "morning" });

  if (isWeekday()) {
    blockTasks.push({ label: "Fill water bottle", block: "morning" });
    blockTasks.push({ label: "Pack lunch", block: "morning" });
    blockTasks.push({ label: "Pack school bag", block: "morning" });
  }

  if (state.context.daycareDay) {
    blockTasks.push({ label: "Lincoln diaper changed", block: "morning" });
    blockTasks.push({ label: "Lincoln bottle prepped", block: "morning" });
    blockTasks.push({ label: "Daycare bag packed", block: "morning" });
    blockTasks.push({ label: "Daycare notebook filled out", block: "morning" });
  }

  blockTasks.push({ label: "Take meds", block: "morning" });

  // ----- WORK OPEN -----
  blockTasks.push({ label: "Projector on", block: "workOpen" });
  blockTasks.push({ label: "Lunch in fridge", block: "workOpen" });
  blockTasks.push({
    label: "Sign into laptops & pull up Destiny",
    block: "workOpen"
  });
  blockTasks.push({ label: "Name tags out", block: "workOpen" });

  blockTasks.push({
    label: "Open email / calendar, skim for surprises",
    block: "workOpen"
  });
  blockTasks.push({
    label: "Prep first class of the day",
    block: "workOpen"
  });

  // ----- MIDDAY -----
  blockTasks.push({
    label: "Midday reset (5-min tidy / water / stretch)",
    block: "midday"
  });

  // ----- WORK CLOSE -----
  blockTasks.push({ label: "Sign out / projector off", block: "workClose" });
  blockTasks.push({ label: "Collect name tags", block: "workClose" });
  blockTasks.push({
    label: "5 minutes classroom straighten",
    block: "workClose"
  });
  blockTasks.push({ label: "Clear desk", block: "workClose" });

  blockTasks.push({
    label: "Look at tomorrow’s letter day",
    block: "workClose"
  });
  blockTasks.push({
    label: "Stack materials for first class tomorrow",
    block: "workClose"
  });

  // ----- EVENING -----
  if (state.context.therapyTonight) {
    blockTasks.push({
      label: "Prep notes & questions for therapy",
      block: "evening"
    });
  }
  blockTasks.push({
    label: "Lay out clothes for tomorrow",
    block: "evening"
  });

  // ----- BEDTIME / PM MUST-DO -----
  blockTasks.push({ label: "Brush teeth (PM)", block: "bedtime" });
  blockTasks.push({ label: "Floss (PM)", block: "bedtime" });
  blockTasks.push({ label: "Wash face (PM)", block: "bedtime" });
  blockTasks.push({
    label: "Water bottle & lunch dishes in dishwasher",
    block: "bedtime"
  });

  blockTasks.push({
    label: "Wind-down routine (no scrolling last 15 mins)",
    block: "bedtime"
  });

  // Push auto tasks into state
  blockTasks.forEach((t) => {
    state.tasks.push({
      id: uuid(),
      label: t.label,
      block: t.block,
      type: "task",
      completed: false,
      auto: true
    });
  });

  // Letter-day class schedule → appointments (skip "NONE")
  const letter = state.context.letterDay;
  if (letter && SCHEDULE_BY_LETTER_DAY[letter]) {
    SCHEDULE_BY_LETTER_DAY[letter].forEach((appt) => {
      state.tasks.push({
        id: uuid(),
        label: appt.title,
        block: blockForTime(appt.time24),
        time24: appt.time24,
        type: "appointment",
        completed: false,
        auto: true
      });
    });
  }
}

// === RENDER FUNCTIONS ===
function renderTasksAndAppointments() {
  timelineContainer.innerHTML = "";

  const hideCompleted = hideCompletedTasksCheckbox.checked;
  const blocks = Object.keys(TIME_BLOCK_LABELS);

  blocks.forEach((block) => {
    const items = state.tasks
      .filter((t) => t.block === block)
      .sort((a, b) => {
        const ta = a.time24 || "99:99";
        const tb = b.time24 || "99:99";
        return ta.localeCompare(tb);
      });

    if (!items.length) return;

    const groupDiv = document.createElement("div");
    groupDiv.className = "time-block-group";

    const headerDiv = document.createElement("div");
    headerDiv.className = "time-block-header";

    const labelSpan = document.createElement("span");
    labelSpan.className = "time-block-label";
    labelSpan.textContent = TIME_BLOCK_LABELS[block];

    const countSpan = document.createElement("span");
    const total = items.length;
    const done = items.filter((i) => i.completed).length;
    countSpan.textContent = `${total - done}/${total} left`;

    headerDiv.appendChild(labelSpan);
    headerDiv.appendChild(countSpan);

    const listDiv = document.createElement("div");
    listDiv.className = "time-block-list";

    items.forEach((item) => {
      if (hideCompleted && item.completed) return;

      const row = document.createElement("div");
      row.className = "timeline-item";
      if (item.completed) row.classList.add("completed");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = item.completed;
      cb.addEventListener("change", () => {
        item.completed = cb.checked;
        saveDayToFirestore();
        renderTasksAndAppointments();
      });

      const timeSpan = document.createElement("span");
      timeSpan.className = "time";
      timeSpan.textContent =
        item.type === "appointment" && item.time24
          ? formatTime12h(item.time24)
          : "";

      const titleSpan = document.createElement("span");
      titleSpan.className = "title";
      titleSpan.textContent = item.label;

      const badgeSpan = document.createElement("span");
      badgeSpan.className = "badge";
      badgeSpan.textContent =
        item.type === "appointment" ? "Class" : "Task";

      row.appendChild(cb);
      row.appendChild(timeSpan);
      row.appendChild(titleSpan);
      row.appendChild(badgeSpan);

      listDiv.appendChild(row);
    });

    groupDiv.appendChild(headerDiv);
    groupDiv.appendChild(listDiv);
    timelineContainer.appendChild(groupDiv);
  });
}

function renderParkingLot() {
  parkingListEl.innerHTML = "";
  state.parkingLot.forEach((text, index) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = text;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      state.parkingLot.splice(index, 1);
      saveDayToFirestore();
      renderParkingLot();
    });

    pill.appendChild(removeBtn);
    parkingListEl.appendChild(pill);
  });
}

// Trackers "like water cup"
function setMetric(value, goal, countEl, goalEl) {
  if (countEl) countEl.textContent = value ?? 0;
  if (goalEl && goal != null) goalEl.value = goal;
}

function setWinPillState(pillId, current, goal) {
  const pill = document.getElementById(pillId);
  if (!pill) return;
  pill.classList.remove("empty", "partial", "done");

  if (!goal || current === 0) {
    pill.classList.add("empty");
  } else if (current >= goal) {
    pill.classList.add("done");
  } else {
    pill.classList.add("partial");
  }
}

function renderTrackers() {
  const m = state.metrics;
  const g = state.trackerGoals;

  // Main metric rows
  setMetric(m.water, g.water, waterCountEl, waterGoalInput);
  setMetric(m.steps, g.steps, stepCountEl, stepGoalInput);
  setMetric(m.stretch, g.stretch, stretchCountEl, stretchGoalInput);
  setMetric(m.meditate, g.meditate, medCountEl, medGoalInput);
  setMetric(m.reps, g.reps, repsCountEl, repsGoalInput);

  // Daily wins values
  const winWaterValue = document.getElementById("winWaterValue");
  const winWaterGoal = document.getElementById("winWaterGoal");
  const winStepsValue = document.getElementById("winStepsValue");
  const winStepsGoal = document.getElementById("winStepsGoal");
  const winStretchValue = document.getElementById("winStretchValue");
  const winStretchGoal = document.getElementById("winStretchGoal");
  const winRepsValue = document.getElementById("winRepsValue");
  const winRepsGoal = document.getElementById("winRepsGoal");
  const winMedValue = document.getElementById("winMedValue");
  const winMedGoal = document.getElementById("winMedGoal");

  if (winWaterValue) winWaterValue.textContent = m.water ?? 0;
  if (winWaterGoal) winWaterGoal.textContent = g.water ?? 0;

  if (winStepsValue) winStepsValue.textContent = m.steps ?? 0;
  if (winStepsGoal) winStepsGoal.textContent = g.steps ?? 0;

  if (winStretchValue) winStretchValue.textContent = m.stretch ?? 0;
  if (winStretchGoal) winStretchGoal.textContent = g.stretch ?? 0;

  if (winRepsValue) winRepsValue.textContent = m.reps ?? 0;
  if (winRepsGoal) winRepsGoal.textContent = g.reps ?? 0;

  if (winMedValue) winMedValue.textContent = m.meditate ?? 0;
  if (winMedGoal) winMedGoal.textContent = g.meditate ?? 0;

  // Pill states
  setWinPillState("winWater", m.water, g.water);
  setWinPillState("winSteps", m.steps, g.steps);
  setWinPillState("winStretch", m.stretch, g.stretch);
  setWinPillState("winReps", m.reps, g.reps);
  setWinPillState("winMeditate", m.meditate, g.meditate);

  // Movement win: all metrics hit their goals
  const waterHit = g.water > 0 && m.water >= g.water;
  const stepsHit = g.steps > 0 && m.steps >= g.steps;
  const stretchHit = g.stretch > 0 && m.stretch >= g.stretch;
  const medHit = g.meditate > 0 && m.meditate >= g.meditate;
  const repsHit = g.reps > 0 && m.reps >= g.reps;

  const win = waterHit && stepsHit && stretchHit && medHit && repsHit;
  state.celebration.movementWin = win;

  if (movementWinBanner) {
    movementWinBanner.classList.toggle("show", win);
  }
}

function renderWorkouts() {
  workoutBody.innerHTML = "";
  state.workouts.forEach((w, idx) => {
    const tr = document.createElement("tr");

    // Move
    const moveTd = document.createElement("td");
    const moveInput = document.createElement("input");
    moveInput.type = "text";
    moveInput.value = w.move || "";
    moveInput.addEventListener("input", () => {
      w.move = moveInput.value;
      saveDayToFirestore();
    });
    moveTd.appendChild(moveInput);

    // Weight
    const weightTd = document.createElement("td");
    const weightInput = document.createElement("input");
    weightInput.type = "text";
    weightInput.value = w.weight || "";
    weightInput.addEventListener("input", () => {
      w.weight = weightInput.value;
      saveDayToFirestore();
    });
    weightTd.appendChild(weightInput);

    // Reps controls (like water cup)
    const repsTd = document.createElement("td");
    const repsControls = document.createElement("div");
    repsControls.className = "workout-reps-controls";

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "circle-btn";
    minusBtn.textContent = "−";

    const repsSpan = document.createElement("span");
    repsSpan.className = "big-number";
    repsSpan.style.fontSize = "0.85rem";
    repsSpan.textContent = w.reps ?? 0;

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "circle-btn";
    plusBtn.textContent = "+";

    minusBtn.addEventListener("click", async () => {
      const current = parseInt(w.reps || 0, 10);
      w.reps = Math.max(0, isNaN(current) ? 0 : current - 5);
      updateRepsFromWorkouts();
      await saveDayToFirestore();
      renderWorkouts();
      renderTrackers();
    });

    plusBtn.addEventListener("click", async () => {
      const current = parseInt(w.reps || 0, 10);
      w.reps = (isNaN(current) ? 0 : current) + 5;
      updateRepsFromWorkouts();
      await saveDayToFirestore();
      renderWorkouts();
      renderTrackers();
    });

    repsControls.appendChild(minusBtn);
    repsControls.appendChild(repsSpan);
    repsControls.appendChild(plusBtn);
    repsTd.appendChild(repsControls);

    // Goal (fixed 30 reps)
    const goalTd = document.createElement("td");
    const goalPill = document.createElement("div");
    goalPill.className = "workout-goal-pill";
    const goalVal = w.goal != null ? w.goal : 30;
    goalPill.textContent = `${goalVal} reps`;
    goalTd.appendChild(goalPill);

    // Remove
    const removeTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.className = "tiny-btn";
    removeBtn.addEventListener("click", async () => {
      state.workouts.splice(idx, 1);
      updateRepsFromWorkouts();
      await saveDayToFirestore();
      renderWorkouts();
      renderTrackers();
    });
    removeTd.appendChild(removeBtn);

    tr.appendChild(moveTd);
    tr.appendChild(weightTd);
    tr.appendChild(repsTd);
    tr.appendChild(goalTd);
    tr.appendChild(removeTd);

    workoutBody.appendChild(tr);
  });
}

function renderLastTimeList() {
  lastTimeListEl.innerHTML = "";
  state.lastTimeItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "last-time-row";

    const days = daysBetween(item.lastDone);
    const color = lastTimeColor(days);

    const dot = document.createElement("div");
    dot.className = `last-time-color-dot ${color}`;

    const label = document.createElement("span");
    label.className = "last-time-label";
    label.textContent = item.label;

    const age = document.createElement("span");
    age.className = "last-time-age";
    if (!item.lastDone) {
      age.textContent = "No date yet";
    } else if (days === 0) {
      age.textContent = "Today";
    } else if (days === 1) {
      age.textContent = "Yesterday";
    } else {
      age.textContent = `${days} days ago`;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tiny-btn";
    button.textContent = "Just did it";
    button.addEventListener("click", async () => {
      item.lastDone = todayDateKey();
      await saveDayToFirestore();
      renderLastTimeList();
    });

    row.appendChild(dot);
    row.appendChild(label);
    row.appendChild(age);
    row.appendChild(button);
    lastTimeListEl.appendChild(row);
  });
}

function renderNote() {
  noteBox.value = state.note || "";
}

function renderContextControls() {
  dayOfWeekSelect.value = state.context.dayOfWeek || "";
  letterDaySelect.value = state.context.letterDay || "";
  planDateInput.value = currentDateKey || todayDateKey();
  setToggle(daycareToggle, state.context.daycareDay);
  setToggle(therapyToggle, state.context.therapyTonight);
}

function renderAll() {
  renderContextControls();
  updateDaySummary();
  renderTasksAndAppointments();
  renderParkingLot();
  renderTrackers();
  renderWorkouts();
  renderLastTimeList();
  renderNote();
}

// === EVENT WIRES ===

// Add manual task
addTaskBtn.addEventListener("click", async () => {
  const text = newTaskTextInput.value.trim();
  if (!text) return;
  const block = newTaskBlockSelect.value || "midday";
  state.tasks.push({
    id: uuid(),
    label: text,
    block,
    type: "task",
    completed: false,
    auto: false
  });
  newTaskTextInput.value = "";
  await saveDayToFirestore();
  renderTasksAndAppointments();
});

hideCompletedTasksCheckbox.addEventListener("change", () => {
  renderTasksAndAppointments();
});

// Parking lot
addParkingBtn.addEventListener("click", async () => {
  const text = parkingInput.value.trim();
  if (!text) return;
  state.parkingLot.push(text);
  parkingInput.value = "";
  await saveDayToFirestore();
  renderParkingLot();
});

// Trackers: water-style controls
waterPlusBtn.addEventListener("click", async () => {
  state.metrics.water = (state.metrics.water || 0) + 1;
  await saveDayToFirestore();
  renderTrackers();
});

waterMinusBtn.addEventListener("click", async () => {
  state.metrics.water = Math.max(0, (state.metrics.water || 0) - 1);
  await saveDayToFirestore();
  renderTrackers();
});

stepPlusBtn.addEventListener("click", async () => {
  state.metrics.steps = (state.metrics.steps || 0) + 500;
  await saveDayToFirestore();
  renderTrackers();
});

stepMinusBtn.addEventListener("click", async () => {
  state.metrics.steps = Math.max(0, (state.metrics.steps || 0) - 500);
  await saveDayToFirestore();
  renderTrackers();
});

stretchPlusBtn.addEventListener("click", async () => {
  state.metrics.stretch = (state.metrics.stretch || 0) + 5;
  await saveDayToFirestore();
  renderTrackers();
});

stretchMinusBtn.addEventListener("click", async () => {
  state.metrics.stretch = Math.max(0, (state.metrics.stretch || 0) - 5);
  await saveDayToFirestore();
  renderTrackers();
});

medPlusBtn.addEventListener("click", async () => {
  state.metrics.meditate = (state.metrics.meditate || 0) + 5;
  await saveDayToFirestore();
  renderTrackers();
});

medMinusBtn.addEventListener("click", async () => {
  state.metrics.meditate = Math.max(0, (state.metrics.meditate || 0) - 5);
  await saveDayToFirestore();
  renderTrackers();
});

// Goals inputs
waterGoalInput.addEventListener("input", () => {
  const v = parseInt(waterGoalInput.value || "0", 10);
  state.trackerGoals.water = isNaN(v) ? 0 : v;
  saveDayToFirestore();
  renderTrackers();
});

stepGoalInput.addEventListener("input", () => {
  const v = parseInt(stepGoalInput.value || "0", 10);
  state.trackerGoals.steps = isNaN(v) ? 0 : v;
  saveDayToFirestore();
  renderTrackers();
});

stretchGoalInput.addEventListener("input", () => {
  const v = parseInt(stretchGoalInput.value || "0", 10);
  state.trackerGoals.stretch = isNaN(v) ? 0 : v;
  saveDayToFirestore();
  renderTrackers();
});

medGoalInput.addEventListener("input", () => {
  const v = parseInt(medGoalInput.value || "0", 10);
  state.trackerGoals.meditate = isNaN(v) ? 0 : v;
  saveDayToFirestore();
  renderTrackers();
});

repsGoalInput.addEventListener("input", () => {
  const v = parseInt(repsGoalInput.value || "0", 10);
  state.trackerGoals.reps = isNaN(v) ? 0 : v;
  saveDayToFirestore();
  renderTrackers();
});

// Workouts
addWorkoutRowBtn.addEventListener("click", async () => {
  const text = newWorkoutMoveInput.value.trim();
  const label = text || "New move";
  state.workouts.push({
    id: uuid(),
    move: label,
    weight: "",
    reps: 0,
    goal: 30
  });
  newWorkoutMoveInput.value = "";
  updateRepsFromWorkouts();
  await saveDayToFirestore();
  renderWorkouts();
  renderTrackers();
});

// Last time I...
addLastTimeBtn.addEventListener("click", async () => {
  const text = newLastTimeTextInput.value.trim();
  if (!text) return;
  state.lastTimeItems.push({
    id: uuid(),
    label: text,
    lastDone: ""
  });
  newLastTimeTextInput.value = "";
  await saveDayToFirestore();
  renderLastTimeList();
});

// Note box
noteBox.addEventListener("input", () => {
  state.note = noteBox.value;
  saveDayToFirestore();
});

// Initialize default date value for visual niceness if empty
if (!planDateInput.value) {
  planDateInput.value = todayDateKey();
}
