// LRCGames/plannerDashboard/dashboard.js
// Calm planner dashboard for Mrs. A
// Connects to the same Firebase project as LRCQuest.
// TODO: copy your existing firebaseConfig from lrcQuestCore.js / login.html

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
  // 🔁 REPLACE THIS with your real config:
  // apiKey: "YOUR_KEY",
  // authDomain: "YOUR_DOMAIN",
  // projectId: "YOUR_PROJECT_ID",
  // etc.
};

const ALLOWED_EMAILS = [
  "malbrecht@sd308.org",
  "malbrecht3317@gmail.com",
];

// Path helpers
const DAILY_PREFIX = "plannerDaily";
const PARKING_DOC = "plannerParking";
const WEEKLY_PREFIX = "plannerWeekly";

// Default weekly tasks (you can tweak the names)
const DEFAULT_WEEKLY_TASKS = {
  work: [
    "Plan next week’s LRC lessons",
    "Update LRCQuest links / quests",
    "Refresh book displays",
    "Library communication (newsletters, Seesaw, etc.)",
  ],
  home: [
    "Meal plan & grocery list",
    "Laundry cycle(s)",
    "Tidy main rooms",
    "Budget / bills check-in",
  ],
};

// Schedules for each letter day (24h times for ordering)
const LETTER_DAY_SCHEDULES = {
  A: [
    { time24: "09:05", label: "4th Rosenthal" },
    { time24: "10:05", label: "2nd Peterson" },
    { time24: "11:05", label: "3rd Hossain" },
    { time24: "13:45", label: "5th Altruismo" },
    { time24: "14:45", label: "1st Rogers" },
  ],
  B: [
    { time24: "09:05", label: "4th Cavello" },
    { time24: "10:05", label: "2nd Schmidt" },
    { time24: "11:05", label: "Admin / Projects" },
    { time24: "13:45", label: "5th Isibindi" },
  ],
  C: [
    { time24: "08:45", label: "AM Duty & Opening" },
    { time24: "09:05", label: "Admin / Projects" },
    { time24: "10:05", label: "2nd Adams" },
    { time24: "11:05", label: "3rd Pulsa" },
    { time24: "13:45", label: "5th Amistad" },
    { time24: "14:30", label: "Prep / Closing" },
  ],
  D: [
    { time24: "12:20", label: "Lunch" },
    { time24: "12:45", label: "Prep" },
    { time24: "13:45", label: "Prep" },
    { time24: "14:30", label: "Prep" },
    { time24: "14:45", label: "1st Wilson" },
  ],
  E: [
    { time24: "09:05", label: "4th Tomter" },
    { time24: "10:05", label: "Prep" },
    { time24: "11:05", label: "3rd Carroll" },
    { time24: "13:45", label: "5th Reveur" },
    { time24: "14:45", label: "1st Day" },
  ],
};

// Generic work-day tasks (only shown when letter day is A–E)
const WORK_DAY_TASK_TEMPLATES = [
  { label: "Check email & respond to urgent messages", segment: "AM" },
  { label: "Quick building walk / reset library space", segment: "AM" },
  { label: "Lesson prep for tomorrow", segment: "MID" },
  { label: "Update LRCQuest / digital boards", segment: "MID" },
  { label: "Tidy library, turn off lights & tech", segment: "PM" },
];

// Daycare tasks (only when daycare = yes)
const DAYCARE_TASK_TEMPLATES = [
  { label: "Pack daycare bag (diapers/wipes/outfit)", segment: "AM" },
  { label: "Label bottles / snacks", segment: "AM" },
  { label: "Daycare pickup", segment: "PM" },
  { label: "Unpack daycare bag (papers, bottles, clothes)", segment: "PM" },
];

// Home anchors that always show
const HOME_ANCHORS = [
  { label: "Morning self-care (meds, clothes, teeth)", segment: "AM" },
  { label: "Quick reset: counters & hotspots", segment: "MID" },
  { label: "Evening reset: dishes, sink, launchpad for tomorrow", segment: "PM" },
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

// ---------- INIT ----------

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

// Assign AM / MID / PM from 24h time (string "HH:MM")
function segmentFromTime(time24) {
  const [h] = time24.split(":").map((v) => parseInt(v, 10));
  if (h < 12) return "AM";
  if (h < 16) return "MID";
  return "PM";
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

// ---------- LOAD & SAVE ----------

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
  if (!snap.exists()) return "";
  return snap.data().text || "";
}

async function saveParkingLot(text) {
  if (!currentUser) return;
  const ref = doc(db, PARKING_DOC, currentUser.uid);
  await setDoc(ref, { text }, { merge: true });
}

async function loadWeeklyTasks(user, weekKey) {
  const ref = doc(db, WEEKLY_PREFIX, `${user.uid}_${weekKey}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // seed with defaults, status "planned"
    return {
      weekKey,
      work: DEFAULT_WEEKLY_TASKS.work.map((title) => ({
        id: buildTaskId("weekly-work", title),
        title,
        status: "planned",
      })),
      home: DEFAULT_WEEKLY_TASKS.home.map((title) => ({
        id: buildTaskId("weekly-home", title),
        title,
        status: "planned",
      })),
    };
  }
  return snap.data();
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

// ---------- MERGED TASKS BUILD ----------

function buildMergedTasksFromContext(context, previousTasks = []) {
  const { letterDay, daycare } = context;
  /** @type {Record<string, any>} */
  const prevById = {};
  previousTasks.forEach((t) => {
    prevById[t.id] = t;
  });

  /** @type {Array<any>} */
  const tasks = [];

  // Letter day schedule (classes)
  if (letterDay && letterDay !== "NONE" && LETTER_DAY_SCHEDULES[letterDay]) {
    LETTER_DAY_SCHEDULES[letterDay].forEach((slot) => {
      const segment = segmentFromTime(slot.time24);
      const id = buildTaskId("class", slot.label, slot.time24);
      const prev = prevById[id];
      tasks.push({
        id,
        label: slot.label,
        detail: `${letterDay} Day • ${slot.time24}`,
        segment,
        source: "class",
        completed: prev ? !!prev.completed : false,
      });
    });

    // Work tasks (only on letter days)
    WORK_DAY_TASK_TEMPLATES.forEach((t) => {
      const id = buildTaskId("work", t.label);
      const prev = prevById[id];
      tasks.push({
        id,
        label: t.label,
        detail: "Work day",
        segment: t.segment,
        source: "work",
        completed: prev ? !!prev.completed : false,
      });
    });
  }

  // Daycare tasks
  if (daycare === "yes") {
    DAYCARE_TASK_TEMPLATES.forEach((t) => {
      const id = buildTaskId("daycare", t.label);
      const prev = prevById[id];
      tasks.push({
        id,
        label: t.label,
        detail: "Daycare",
        segment: t.segment,
        source: "daycare",
        completed: prev ? !!prev.completed : false,
      });
    });
  }

  // Home anchors (always)
  HOME_ANCHORS.forEach((t) => {
    const id = buildTaskId("home-anchor", t.label);
    const prev = prevById[id];
    tasks.push({
      id,
      label: t.label,
      detail: "Home anchor",
      segment: t.segment,
      source: "home",
      completed: prev ? !!prev.completed : false,
    });
  });

  // Sort by segment, then label
  const order = { AM: 0, MID: 1, PM: 2 };
  tasks.sort((a, b) => {
    const segDiff = (order[a.segment] ?? 0) - (order[b.segment] ?? 0);
    if (segDiff !== 0) return segDiff;
    return a.label.localeCompare(b.label);
  });

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
  const midList = document.getElementById("mid-task-list");
  const pmList = document.getElementById("pm-task-list");
  if (!amList || !midList || !pmList) return;

  amList.innerHTML = "";
  midList.innerHTML = "";
  pmList.innerHTML = "";

  const segments = {
    AM: amList,
    MID: midList,
    PM: pmList,
  };

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
    meta.textContent = task.detail || "";

    li.appendChild(checkbox);
    const contentWrap = document.createElement("div");
    contentWrap.style.flex = "1";
    contentWrap.appendChild(label);
    contentWrap.appendChild(meta);
    li.appendChild(contentWrap);

    const segKey = task.segment || "AM";
    const listEl = segments[segKey] || segments.AM;
    listEl.appendChild(li);
  });

  // If any band is empty, show a soft placeholder
  ["AM", "MID", "PM"].forEach((seg) => {
    const listEl = segments[seg];
    if (listEl && !listEl.children.length) {
      const empty = document.createElement("li");
      empty.className = "task-item";
      empty.innerHTML =
        '<span class="task-item-label" style="opacity:.6;">No tasks in this band yet.</span>';
      listEl.appendChild(empty);
    }
  });
}

function toggleTaskCompleted(taskId, completed) {
  const t = plannerState.mergedTasks.find((x) => x.id === taskId);
  if (!t) return;
  t.completed = completed;

  // Update DOM class quickly
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

function hydrateParkingLot(text) {
  const ta = document.getElementById("parking-lot");
  if (!ta) return;
  ta.value = text || "";
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
        "weekly-status-pill " + getWeeklyStatusClass(item.status);
      pill.textContent = statusLabel(item.status);
      pill.addEventListener("click", () => {
        cycleWeeklyStatus(weeklyState, groupKey, item.id);
      });

      header.appendChild(title);
      header.appendChild(pill);

      const track = document.createElement("div");
      track.className = "weekly-progress-track";

      const fill = document.createElement("div");
      fill.className = "weekly-progress-fill";
      fill.style.width = statusPercentage(item.status) + "%";
      track.appendChild(fill);

      root.appendChild(header);
      root.appendChild(track);

      container.appendChild(root);
    });
  }

  renderGroup(weeklyState.work, workWrap, "work");
  renderGroup(weeklyState.home, homeWrap, "home");
}

function getWeeklyStatusClass(status) {
  if (status === "prepped") return "weekly-status--prepped";
  if (status === "completed") return "weekly-status--completed";
  return "weekly-status--planned";
}

function statusLabel(status) {
  if (status === "prepped") return "Prepped";
  if (status === "completed") return "Completed";
  return "Planned";
}

function statusPercentage(status) {
  if (status === "prepped") return 66;
  if (status === "completed") return 100;
  return 33;
}

async function cycleWeeklyStatus(weeklyState, groupKey, taskId) {
  const list = weeklyState[groupKey];
  const item = list.find((x) => x.id === taskId);
  if (!item) return;

  const order = ["planned", "prepped", "completed"];
  const idx = order.indexOf(item.status || "planned");
  const next = order[(idx + 1) % order.length];
  item.status = next;

  // Re-render just weekly tasks (simple for now)
  renderWeeklyTasks(weeklyState);
  await saveWeeklyTasks(weeklyState);
}

// ---------- COLLAPSIBLES & UI EVENTS ----------

function setupCollapsibles() {
  document
    .querySelectorAll(".collapsible")
    .forEach((section) => {
      const header = section.querySelector(".collapsible-header");
      const toggleBtn = section.querySelector(".collapse-toggle");
      const body = section.querySelector(".collapsible-body");
      if (!header || !toggleBtn || !body) return;

      // initial state
      section.classList.remove("collapsed");

      header.addEventListener("click", (e) => {
        // avoid double-toggle when clicking inner buttons:
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

// ---------- MAIN FLOW ----------

async function initDashboardForUser(user) {
  currentUser = user;

  const userChip = document.getElementById("user-email");
  if (userChip) userChip.textContent = user.email || "Signed in";

  const today = new Date();
  plannerState.dateKey = getDateKey(today);
  renderToday(today);

  // Load daily state if present
  const existing = await loadDailyState(user, plannerState.dateKey);
  if (existing && existing.context) {
    plannerState.context = {
      dayOfWeek: existing.context.dayOfWeek || "",
      letterDay: existing.context.letterDay || "",
      daycare: existing.context.daycare || "no",
    };
    plannerState.mergedTasks = existing.mergedTasks || [];
  }

  // Hydrate context UI and rebuild tasks if needed
  hydrateContextForm(plannerState.context);
  if (!plannerState.mergedTasks.length) {
    plannerState.mergedTasks = buildMergedTasksFromContext(
      plannerState.context,
      []
    );
  }

  renderMergedTasks();

  // Parking lot
  const parkingText = await loadParkingLot(user);
  hydrateParkingLot(parkingText);

  const parking = document.getElementById("parking-lot");
  const parkingStatus = document.getElementById("parking-status");
  let parkingTimer = null;
  if (parking) {
    parking.addEventListener("input", () => {
      if (parkingStatus) parkingStatus.textContent = "Saving…";
      clearTimeout(parkingTimer);
      parkingTimer = setTimeout(async () => {
        await saveParkingLot(parking.value);
        if (parkingStatus) parkingStatus.textContent = "Saved automatically.";
      }, 400);
    });
  }

  // Weekly tasks
  const weekKey = getWeekKey(today);
  const weeklyState = await loadWeeklyTasks(user, weekKey);
  renderWeeklyTasks(weeklyState);

  // Weekly tasks clicks already wired (cycleWeeklyStatus saves)

  // Hide completed toggle
  const hideBox = document.getElementById("hide-completed");
  if (hideBox) {
    hideBox.checked = hideCompleted;
    hideBox.addEventListener("change", () => {
      hideCompleted = hideBox.checked;
      renderMergedTasks();
    });
  }

  // Context apply button
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

      // Rebuild merged tasks but preserve completion info where possible
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

  // Daycare toggle
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
      // Not logged in → go to login screen
      window.location.href = "../login.html";
      return;
    }

    if (!ALLOWED_EMAILS.includes(user.email || "")) {
      if (unauthorizedBanner) unauthorizedBanner.classList.remove("hidden");
      const userChip = document.getElementById("user-email");
      if (userChip) userChip.textContent = user.email || "Unauthorized";
      // Optionally sign out and send to login
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
