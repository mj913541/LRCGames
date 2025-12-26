// LRCGames/plannerDashboard/dashboard.js
// Simple, localStorage-based planner dashboard logic

const STORAGE_KEY = "plannerDashboard_v1";

const TIME_BLOCKS = [
  { id: "morning", label: "🌅 Morning" },
  { id: "workOpen", label: "🏫 Work open" },
  { id: "midday", label: "🌤 Midday" },
  { id: "workClose", label: "🏁 Work close" },
  { id: "evening", label: "🏠 Arrive home" },
  { id: "bedtime", label: "🌙 Bedtime" },
];

// Base shape of state
const DEFAULT_STATE = {
  context: {
    dayOfWeek: "",
    letterDay: "",
    daycare: "no",
    therapy: "no",
    planDate: "",
  },
  tasks: TIME_BLOCKS.reduce((acc, b) => {
    acc[b.id] = [];
    return acc;
  }, {}),
  parking: [],
  lastTime: [],
  trackers: {
    // daily ones
    water: { count: 0, goal: 8 },
    steps: { count: 0, goal: 6000 },
    med: { count: 0, goal: 10 },
    stretch: { count: 0, goal: 10 },
    // reps exercises (all default 0 / 30)
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

let state = loadState();

// ---------- Storage helpers ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    // cheap merge to make sure new fields exist
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      context: { ...DEFAULT_STATE.context, ...(parsed.context || {}) },
      tasks: { ...DEFAULT_STATE.tasks, ...(parsed.tasks || {}) },
      parking: parsed.parking || [],
      lastTime: parsed.lastTime || [],
      trackers: { ...DEFAULT_STATE.trackers, ...(parsed.trackers || {}) },
    };
  } catch (e) {
    console.error("Error loading planner state:", e);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Error saving planner state:", e);
  }
}

// ---------- DOM helpers ----------

function $(id) {
  return document.getElementById(id);
}

// ---------- Context + summary ----------

function initContextForm() {
  const form = $("contextForm");
  const dayOfWeek = $("dayOfWeek");
  const letterDay = $("letterDay");
  const planDate = $("planDate");
  const daycareToggle = $("daycareToggle");
  const therapyToggle = $("therapyToggle");
  const reloadBtn = $("reloadDayBtn");

  if (!form) return;

  // hydrate form from state
  dayOfWeek.value = state.context.dayOfWeek || "";
  letterDay.value = state.context.letterDay || "";
  planDate.value = state.context.planDate || "";

  updateToggleButton(daycareToggle, state.context.daycare);
  updateToggleButton(therapyToggle, state.context.therapy);
  renderDaySummary();

  daycareToggle.addEventListener("click", () => {
    toggleBtnValue(daycareToggle);
    state.context.daycare = daycareToggle.dataset.value;
    saveState();
    renderDaySummary();
  });

  therapyToggle.addEventListener("click", () => {
    toggleBtnValue(therapyToggle);
    state.context.therapy = therapyToggle.dataset.value;
    saveState();
    renderDaySummary();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    state.context.dayOfWeek = dayOfWeek.value;
    state.context.letterDay = letterDay.value;
    state.context.planDate = planDate.value;
    saveState();
    renderDaySummary();
  });

  reloadBtn.addEventListener("click", () => {
    const fresh = loadState();
    state = fresh;
    // rehydrate
    dayOfWeek.value = state.context.dayOfWeek || "";
    letterDay.value = state.context.letterDay || "";
    planDate.value = state.context.planDate || "";
    updateToggleButton(daycareToggle, state.context.daycare);
    updateToggleButton(therapyToggle, state.context.therapy);
    renderDaySummary();
    renderTimeline();
    renderParking();
    renderLastTime();
    hydrateTrackersDom();
    updateMovementSummaryAndBanner();
  });
}

function toggleBtnValue(btn) {
  const current = btn.dataset.value === "yes" ? "no" : "yes";
  updateToggleButton(btn, current);
}

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

// ---------- Logout (stub) ----------

function initLogout() {
  const btn = $("logoutBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    // If you wire Firebase, replace this with signOut(...)
    // For now, just clear state & reload
    if (confirm("Sign out and clear saved planner data?")) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
}

// ---------- Timeline: merged tasks & appointments ----------

function initTimeline() {
  const addBtn = $("addTaskBtn");
  const hideCompleted = $("hideCompletedTasks");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const blockSel = $("newTaskBlock");
      const textInput = $("newTaskText");
      const blockId = blockSel.value;
      const text = textInput.value.trim();
      if (!text) return;
      const item = {
        id: Date.now().toString() + Math.random().toString(16).slice(2),
        text,
        done: false,
      };
      state.tasks[blockId].push(item);
      textInput.value = "";
      saveState();
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
    const wrapper = document.createElement("div");
    wrapper.className = "time-block";

    const header = document.createElement("div");
    header.className = "time-block-header";
    header.textContent = block.label;
    wrapper.appendChild(header);

    const list = document.createElement("div");
    list.className = "time-block-list";

    const items = state.tasks[block.id] || [];
    items
      .filter((item) => !(hideCompleted && item.done))
      .forEach((item) => {
        const row = document.createElement("div");
        row.className = "timeline-item";

        const left = document.createElement("label");
        left.className = "timeline-item-left";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = item.done;
        checkbox.addEventListener("change", () => {
          item.done = checkbox.checked;
          saveState();
          renderTimeline();
        });

        const span = document.createElement("span");
        span.textContent = item.text;

        left.appendChild(checkbox);
        left.appendChild(span);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "tiny-icon-btn";
        delBtn.textContent = "✕";
        delBtn.addEventListener("click", () => {
          state.tasks[block.id] = state.tasks[block.id].filter((t) => t.id !== item.id);
          saveState();
          renderTimeline();
        });

        row.appendChild(left);
        row.appendChild(delBtn);
        list.appendChild(row);
      });

    wrapper.appendChild(list);
    container.appendChild(wrapper);
  });
}

// ---------- Parking lot ----------

function initParkingLot() {
  const addBtn = $("addParkingBtn");
  const input = $("parkingInput");
  if (!addBtn || !input) return;

  addBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    state.parking.push({
      id: Date.now().toString() + Math.random().toString(16).slice(2),
      text,
    });
    input.value = "";
    saveState();
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
    delBtn.addEventListener("click", () => {
      state.parking = state.parking.filter((p) => p.id !== item.id);
      saveState();
      renderParking();
    });

    pill.appendChild(span);
    pill.appendChild(delBtn);

    container.appendChild(pill);
  });
}

// ---------- “When was the last time I…” ----------

function initLastTime() {
  const addBtn = $("addLastTimeBtn");
  const input = $("newLastTimeText");
  if (!addBtn || !input) return;

  addBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    state.lastTime.push({
      id: Date.now().toString() + Math.random().toString(16).slice(2),
      text,
      lastDone: null, // not yet done
    });
    input.value = "";
    saveState();
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
        row.classList.add("status-ok"); // green
      } else if (days <= 14) {
        row.classList.add("status-warning"); // yellow
      } else {
        row.classList.add("status-overdue"); // red
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
    didBtn.addEventListener("click", () => {
      item.lastDone = new Date().toISOString().slice(0, 10);
      saveState();
      renderLastTime();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "tiny-icon-btn";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", () => {
      state.lastTime = state.lastTime.filter((x) => x.id !== item.id);
      saveState();
      renderLastTime();
    });

    actions.appendChild(didBtn);
    actions.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(actions);
    container.appendChild(row);
  });
}

// ---------- Trackers ----------

// config for the “simple” four
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

// config for all the rep-based exercise rows
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
  // simple trackers (water/steps/med/stretch)
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

    // hydrate DOM from state
    const t = state.trackers[key];
    if (countSpan) countSpan.textContent = t.count ?? 0;
    if (goalInput) {
      if (!goalInput.value) {
        goalInput.value = t.goal ?? cfg.defaultGoal;
      }
    }
    if (winValueSpan) winValueSpan.textContent = t.count ?? 0;
    if (winGoalSpan) winGoalSpan.textContent = t.goal ?? cfg.defaultGoal;

    minusBtn?.addEventListener("click", () => {
      t.count = Math.max(0, (t.count ?? 0) - cfg.step);
      if (countSpan) countSpan.textContent = t.count;
      if (winValueSpan) winValueSpan.textContent = t.count;
      saveState();
      updateMovementSummaryAndBanner();
    });

    plusBtn?.addEventListener("click", () => {
      t.count = (t.count ?? 0) + cfg.step;
      if (countSpan) countSpan.textContent = t.count;
      if (winValueSpan) winValueSpan.textContent = t.count;
      saveState();
      updateMovementSummaryAndBanner();
    });

    goalInput?.addEventListener("change", () => {
      const val = parseInt(goalInput.value, 10);
      const goal = Number.isFinite(val) ? val : cfg.defaultGoal;
      t.goal = goal;
      goalInput.value = goal;
      if (winGoalSpan) winGoalSpan.textContent = goal;
      saveState();
      updateMovementSummaryAndBanner();
    });
  });

  // rep-based trackers
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
    if (goalInput && !goalInput.value) goalInput.value = t.goal ?? 30;

    minusBtn?.addEventListener("click", () => {
      t.count = Math.max(0, (t.count ?? 0) - 1);
      if (countSpan) countSpan.textContent = t.count;
      saveState();
      updateMovementSummaryAndBanner();
    });

    plusBtn?.addEventListener("click", () => {
      t.count = (t.count ?? 0) + 1;
      if (countSpan) countSpan.textContent = t.count;
      saveState();
      updateMovementSummaryAndBanner();
    });

    goalInput?.addEventListener("change", () => {
      const val = parseInt(goalInput.value, 10);
      const goal = Number.isFinite(val) ? val : 30;
      t.goal = goal;
      goalInput.value = goal;
      saveState();
      updateMovementSummaryAndBanner();
    });
  });

  updateMovementSummaryAndBanner();
}

function hydrateTrackersDom() {
  // re-hydrate counts/goals from state (used on reload)
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

  // simple trackers
  const w = state.trackers.water || { count: 0, goal: 0 };
  const s = state.trackers.steps || { count: 0, goal: 0 };
  const m = state.trackers.med || { count: 0, goal: 0 };
  const st = state.trackers.stretch || { count: 0, goal: 0 };

  const wGoal = w.goal ?? 0;
  const sGoal = s.goal ?? 0;
  const mGoal = m.goal ?? 0;
  const stGoal = st.goal ?? 0;

  // reps totals
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

// ---------- Init ----------

document.addEventListener("DOMContentLoaded", () => {
  initContextForm();
  initLogout();
  initTimeline();
  initParkingLot();
  initLastTime();
  initTrackers();
});
