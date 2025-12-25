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
 * 1. FIREBASE INIT
 * Paste your own Firebase config here (same project as the rest of LRCQuest/LRCGames).
 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ...rest of your config here
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
    { time24: "13:45", title: "5th Ultimo" },
    { time24: "14:45", title: "1st Rogers" }
  ],
  B: [
    { time24: "09:05", title: "4th Cavello" },
    { time24: "10:05", title: "2nd Schmidt" },
    { time24: "11:05", title: "Admin" },
    { time24: "13:45", title: "5th Isibindi" }
  ],
  C: [
    { time24: "09:05", title: "Admin" },
    { time24: "10:05", title: "2nd Adams" },
    { time24: "11:05", title: "3rd Pulsa" },
    { time24: "13:45", title: "5th Amistad" }
  ],
  D: [
    { time24: "12:45", title: "Prep" },
    { time24: "13:45", title: "Prep" },
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
  tasks: [],       // { id, label, block, type: 'task'|'appointment', time24?, completed, auto? }
  parkingLot: [],  // strings
  habits: [],      // { id, label, done }
  water: 0,
  steps: 0,
  workouts: [],    // { id, move, weight, notes }
  lastTimeItems: [], // { id, label, lastDone (yyyy-mm-dd) }
  note: ""
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

const habitListEl = document.getElementById("habitList");
const newHabitTextInput = document.getElementById("newHabitText");
const addHabitBtn = document.getElementById("addHabitBtn");

const waterMinusBtn = document.getElementById("waterMinus");
const waterPlusBtn = document.getElementById("waterPlus");
const waterCountEl = document.getElementById("waterCount");
const stepCountInput = document.getElementById("stepCount");

const workoutBody = document.getElementById("workoutBody");
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

  // Initialize date input to today if empty
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

function welcomeDefaultsIfEmpty() {
  if (!state.habits.length) {
    state.habits = [
      { id: uuid(), label: "Take meds", done: false },
      { id: uuid(), label: "Check school email", done: false },
      { id: uuid(), label: "Tidy 5 minutes", done: false }
    ];
  }
  if (!state.lastTimeItems.length) {
    state.lastTimeItems = [
      { id: uuid(), label: "Changed sheets", lastDone: todayDateKey() },
      { id: uuid(), label: "Cleaned car", lastDone: "" }
    ];
  }
}

// === FIRESTORE LOAD / SAVE ===
async function loadDayFromFirestore() {
  if (!currentUser || !currentDateKey) return;

  const docRef = doc(db, "plannerDays", `${currentUser.uid}_${currentDateKey}`);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    const data = snap.data() || {};
    // Merge stored data into current state
    state = { ...state, ...data };
  }

  // Always re-generate auto tasks & appointments
  generateTasksFromContext();
  welcomeDefaultsIfEmpty();
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
  if (state.context.letterDay) parts.push(`${state.context.letterDay} Day`);
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
  // reset tasks so we don't double-add old auto ones
  state.tasks = [];
  await loadDayFromFirestore();
  renderAll();
});

// === TASK / APPOINTMENT GENERATION ===
function generateTasksFromContext() {
  // Remove previous auto-generated tasks/appointments, keep manual
  state.tasks = state.tasks.filter((t) => !t.auto);

  const blockTasks = [];

  // Morning
  blockTasks.push({
    label: "Check dashboard & pick top 3 priorities",
    block: "morning"
  });
  if (state.context.daycareDay) {
    blockTasks.push({ label: "Pack daycare bag", block: "morning" });
  }
  blockTasks.push({ label: "Take meds", block: "morning" });

  // Work open
  blockTasks.push({
    label: "Open email / calendar, skim for surprises",
    block: "workOpen"
  });
  blockTasks.push({
    label: "Prep first class of the day",
    block: "workOpen"
  });

  // Midday
  blockTasks.push({
    label: "Midday reset (5-min tidy / water / stretch)",
    block: "midday"
  });

  // Work close
  blockTasks.push({
    label: "Look at tomorrow’s letter day",
    block: "workClose"
  });
  blockTasks.push({
    label: "Stack materials for first class tomorrow",
    block: "workClose"
  });

  // Evening
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

  // Bedtime
  blockTasks.push({
    label: "Wind-down routine (no scrolling last 15 mins)",
    block: "bedtime"
  });

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

  // Letter-day class schedule → appointments
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

function renderHabits() {
  habitListEl.innerHTML = "";
  state.habits.forEach((habit) => {
    const row = document.createElement("div");
    row.className = "habit-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = habit.done;
    cb.addEventListener("change", () => {
      habit.done = cb.checked;
      saveDayToFirestore();
    });

    const label = document.createElement("span");
    label.textContent = habit.label;

    row.appendChild(cb);
    row.appendChild(label);
    habitListEl.appendChild(row);
  });
}

function renderWaterAndSteps() {
  waterCountEl.textContent = state.water || 0;
  stepCountInput.value = state.steps || 0;
}

function renderWorkouts() {
  workoutBody.innerHTML = "";
  state.workouts.forEach((w, idx) => {
    const tr = document.createElement("tr");

    const moveTd = document.createElement("td");
    const moveInput = document.createElement("input");
    moveInput.type = "text";
    moveInput.value = w.move || "";
    moveInput.addEventListener("input", () => {
      w.move = moveInput.value;
      saveDayToFirestore();
    });
    moveTd.appendChild(moveInput);

    const weightTd = document.createElement("td");
    const weightInput = document.createElement("input");
    weightInput.type = "text";
    weightInput.value = w.weight || "";
    weightInput.addEventListener("input", () => {
      w.weight = weightInput.value;
      saveDayToFirestore();
    });
    weightTd.appendChild(weightInput);

    const notesTd = document.createElement("td");
    const notesInput = document.createElement("input");
    notesInput.type = "text";
    notesInput.value = w.notes || "";
    notesInput.addEventListener("input", () => {
      w.notes = notesInput.value;
      saveDayToFirestore();
    });
    notesTd.appendChild(notesInput);

    const removeTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.className = "tiny-btn";
    removeBtn.addEventListener("click", () => {
      state.workouts.splice(idx, 1);
      saveDayToFirestore();
      renderWorkouts();
    });
    removeTd.appendChild(removeBtn);

    tr.appendChild(moveTd);
    tr.appendChild(weightTd);
    tr.appendChild(notesTd);
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
  renderHabits();
  renderWaterAndSteps();
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

// Habits
addHabitBtn.addEventListener("click", async () => {
  const text = newHabitTextInput.value.trim();
  if (!text) return;
  state.habits.push({ id: uuid(), label: text, done: false });
  newHabitTextInput.value = "";
  await saveDayToFirestore();
  renderHabits();
});

// Water / steps
waterPlusBtn.addEventListener("click", async () => {
  state.water = (state.water || 0) + 1;
  await saveDayToFirestore();
  renderWaterAndSteps();
});

waterMinusBtn.addEventListener("click", async () => {
  state.water = Math.max(0, (state.water || 0) - 1);
  await saveDayToFirestore();
  renderWaterAndSteps();
});

stepCountInput.addEventListener("input", () => {
  state.steps = parseInt(stepCountInput.value || "0", 10);
  saveDayToFirestore();
});

// Workouts
addWorkoutRowBtn.addEventListener("click", async () => {
  state.workouts.push({ id: uuid(), move: "", weight: "", notes: "" });
  await saveDayToFirestore();
  renderWorkouts();
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
