/* planner/app.js
   Core state + storage/sync + shared helpers.
   SPA pages are injected into #pageHost by index.html, then this file exposes:
     window.PlannerApp.init()
     window.PlannerApp.onRouteLoaded(route)
     window.PlannerApp.saveNow()

   This file is intentionally UI-agnostic. UI lives in ui.js / ink.js / chores.js.
*/

(() => {
  const LS_KEY = "planner_state_v2";
  const APP_ID = "plannerApp"; // Firestore doc name under users/{uid}/apps/{APP_ID}

  const PlannerApp = {
    version: "0.2.0",
    user: null,
    state: null,
    settings: null,
    todayKey: null,

    /* ---------- Public API ---------- */
    async init() {
      await loadState();
      PlannerApp.todayKey = todayISO();
      ensureDay(PlannerApp.todayKey);
      ensureWeek(weekKey(new Date()));
      applyRecurringTasksForDate(PlannerApp.todayKey);
      await saveState();
      updateUserPill();
    },

    async onRouteLoaded(route) {
      // Route-specific pre-work
      if (route === "weekly") {
        const wk = weekKey(new Date());
        ensureWeek(wk);

        // Safe auto-populate that never overwrites existing blocks
        autoPopulateWeekIfEmpty(wk);

        await saveState();
      }

      // Delegate render/init to UI modules if present
      if (window.PlannerUI?.onRouteLoaded) {
        await window.PlannerUI.onRouteLoaded(route);
      } else {
        // Minimal fallback (helps debugging if ui.js isn't loaded yet)
        console.warn("PlannerUI not loaded yet. Route:", route);
      }

      updateUserPill();
    },

    async saveNow() {
      await saveState();
      updateUserPill(true);
    },

    /* ---------- Read helpers ---------- */
    getUser() { return PlannerApp.user; },
    getState() { return PlannerApp.state; },
    getSettings() { return PlannerApp.settings; },
    getTodayISO() { return PlannerApp.todayKey; },

    ensureDay,
    ensureWeek,
    weekKey,
    getWeekRange,

    /* ---------- Letter day helpers ---------- */
    getLetterDayForDate,
    ensureTemplateAppliedIfEmpty,

    /* ---------- Appointments (synced) ---------- */
    getAppointments(iso) {
      PlannerApp.state.appointmentsByDate ||= {};
      return PlannerApp.state.appointmentsByDate[iso] || [];
    },

    addAppointment(appt) {
      // appt: {dateISO, title, start, end, area, notes?, color?}
      PlannerApp.state.appointmentsByDate ||= {};
      const iso = appt.dateISO;
      PlannerApp.state.appointmentsByDate[iso] ||= [];
      const item = {
        id: uid(),
        title: appt.title || "Appointment",
        start: appt.start || "09:00",
        end: appt.end || "09:30",
        area: appt.area || "personal", // home|lrc|personal|other
        notes: appt.notes || "",
        color: appt.color || appt.area || "personal"
      };
      PlannerApp.state.appointmentsByDate[iso].push(item);
      return item;
    },

    updateAppointment(dateISO, apptId, patch) {
      PlannerApp.state.appointmentsByDate ||= {};
      const arr = PlannerApp.state.appointmentsByDate[dateISO] || [];
      const idx = arr.findIndex(a => a.id === apptId);
      if (idx === -1) return null;
      arr[idx] = { ...arr[idx], ...patch };
      return arr[idx];
    },

    deleteAppointment(dateISO, apptId) {
      PlannerApp.state.appointmentsByDate ||= {};
      const arr = PlannerApp.state.appointmentsByDate[dateISO] || [];
      PlannerApp.state.appointmentsByDate[dateISO] = arr.filter(a => a.id !== apptId);
    },

    /* ---------- Tasks (daily lists) ---------- */
    getTasks(dateISO, listName) {
      ensureDay(dateISO);
      return PlannerApp.state.days[dateISO].tasks[listName] || [];
    },

    addTask(dateISO, listName, title, opts = {}) {
      ensureDay(dateISO);
      const t = {
        id: uid(),
        title: (title || "New task").trim(),
        bucket: opts.bucket || categorizeTask(title || ""),
        done: !!opts.done,
        time: opts.time || "",
        area: opts.area || listName, // home|lrc|inbox
        notes: opts.notes || "",
        manualBucket: !!opts.manualBucket
      };
      PlannerApp.state.days[dateISO].tasks[listName].unshift(t);
      return t;
    },

    updateTask(dateISO, listName, taskId, patch) {
      ensureDay(dateISO);
      const arr = PlannerApp.state.days[dateISO].tasks[listName] || [];
      const idx = arr.findIndex(t => t.id === taskId);
      if (idx === -1) return null;
      arr[idx] = { ...arr[idx], ...patch };
      return arr[idx];
    },

    deleteTask(dateISO, listName, taskId) {
      ensureDay(dateISO);
      const arr = PlannerApp.state.days[dateISO].tasks[listName] || [];
      PlannerApp.state.days[dateISO].tasks[listName] = arr.filter(t => t.id !== taskId);
    },

    moveTask(dateISO, fromList, toList, taskId) {
      ensureDay(dateISO);
      const from = PlannerApp.state.days[dateISO].tasks[fromList] || [];
      const idx = from.findIndex(t => t.id === taskId);
      if (idx === -1) return null;
      const [task] = from.splice(idx, 1);
      PlannerApp.state.days[dateISO].tasks[fromList] = from;
      PlannerApp.state.days[dateISO].tasks[toList] ||= [];
      PlannerApp.state.days[dateISO].tasks[toList].unshift(task);
      return task;
    },

    /* ---------- Weekly scheduled blocks ---------- */
    getScheduledBlocks(dateISO) {
      const wk = weekKey(new Date(dateISO));
      ensureWeek(wk);
      PlannerApp.state.weeks[wk].days[dateISO] ||= { scheduled: [] };
      return PlannerApp.state.weeks[wk].days[dateISO].scheduled;
    },

    addBlock(dateISO, block) {
      const wk = weekKey(new Date(dateISO));
      ensureWeek(wk);
      PlannerApp.state.weeks[wk].days[dateISO] ||= { scheduled: [] };
      const b = {
        id: uid(),
        kind: block.kind || "task", // task|lrc|home
        title: block.title || "Block",
        startMin: Number(block.startMin ?? 9 * 60),
        endMin: Number(block.endMin ?? 9 * 60 + 30),
        meta: block.meta || "",
        source: block.source || null
      };
      PlannerApp.state.weeks[wk].days[dateISO].scheduled.push(b);
      return b;
    },

    updateBlock(dateISO, blockId, patch) {
      const wk = weekKey(new Date(dateISO));
      ensureWeek(wk);
      PlannerApp.state.weeks[wk].days[dateISO] ||= { scheduled: [] };
      const arr = PlannerApp.state.weeks[wk].days[dateISO].scheduled;
      const idx = arr.findIndex(b => b.id === blockId);
      if (idx === -1) return null;
      arr[idx] = { ...arr[idx], ...patch };
      return arr[idx];
    },

    deleteBlock(dateISO, blockId) {
      const wk = weekKey(new Date(dateISO));
      ensureWeek(wk);
      PlannerApp.state.weeks[wk].days[dateISO] ||= { scheduled: [] };
      PlannerApp.state.weeks[wk].days[dateISO].scheduled =
        PlannerApp.state.weeks[wk].days[dateISO].scheduled.filter(b => b.id !== blockId);
    },

    // Convert task -> time block (task disappears)
    scheduleTask(dateISO, fromList, taskId, targetDateISO, startMin, durationMin = 30) {
      ensureDay(dateISO);
      const arr = PlannerApp.state.days[dateISO].tasks[fromList] || [];
      const idx = arr.findIndex(t => t.id === taskId);
      if (idx === -1) return null;

      const [task] = arr.splice(idx, 1);
      PlannerApp.state.days[dateISO].tasks[fromList] = arr;

      const block = PlannerApp.addBlock(targetDateISO, {
        kind: "task",
        title: task.title,
        startMin,
        endMin: clamp(
          startMin + durationMin,
          startMin + PlannerApp.settings.timelineStep,
          minutesFromHHMM(PlannerApp.settings.dayEnd)
        ),
        source: { from: "taskList", originalTask: { ...task }, fromList, fromDateISO: dateISO }
      });

      return block;
    },

    // Send block back to tasks (block disappears)
    unscheduleBlock(targetDateISO, blockId, toList = "inbox", toDateISO = PlannerApp.todayKey) {
      const wk = weekKey(new Date(targetDateISO));
      ensureWeek(wk);
      PlannerApp.state.weeks[wk].days[targetDateISO] ||= { scheduled: [] };

      const arr = PlannerApp.state.weeks[wk].days[targetDateISO].scheduled;
      const idx = arr.findIndex(b => b.id === blockId);
      if (idx === -1) return null;

      const [block] = arr.splice(idx, 1);
      PlannerApp.state.weeks[wk].days[targetDateISO].scheduled = arr;

      // Restore a task
      const original = block.source?.originalTask || { title: block.title, bucket: "should" };
      const t = PlannerApp.addTask(toDateISO, toList, original.title, {
        bucket: original.bucket || "should",
        done: false,
        area: original.area || toList,
        notes: original.notes || "",
        manualBucket: !!original.manualBucket
      });

      return { task: t, block };
    },

    /* ---------- Habits ---------- */
    getHabitCount(dateISO, habitId) {
      ensureDay(dateISO);
      const day = PlannerApp.state.days[dateISO];
      day.habits ||= {};
      return Number(day.habits[habitId] || 0);
    },

    setHabitCount(dateISO, habitId, count) {
      ensureDay(dateISO);
      const day = PlannerApp.state.days[dateISO];
      day.habits ||= {};
      day.habits[habitId] = Math.max(0, Number(count || 0));
    },

    /* ---------- Ink storage (strokes JSON) ---------- */
    getInkDaily(dateISO) {
      PlannerApp.state.ink ||= { daily: {}, weekly: {} };
      PlannerApp.state.ink.daily[dateISO] ||= { strokes: [], updatedAt: 0 };
      return PlannerApp.state.ink.daily[dateISO];
    },

    setInkDaily(dateISO, strokes) {
      PlannerApp.state.ink ||= { daily: {}, weekly: {} };
      PlannerApp.state.ink.daily[dateISO] = { strokes: strokes || [], updatedAt: Date.now() };
    },

    getInkWeekly(wkKey) {
      PlannerApp.state.ink ||= { daily: {}, weekly: {} };
      PlannerApp.state.ink.weekly[wkKey] ||= { strokes: [], updatedAt: 0 };
      return PlannerApp.state.ink.weekly[wkKey];
    },

    setInkWeekly(wkKey, strokes) {
      PlannerApp.state.ink ||= { daily: {}, weekly: {} };
      PlannerApp.state.ink.weekly[wkKey] = { strokes: strokes || [], updatedAt: Date.now() };
    },

    /* ---------- Chores ---------- */
    getChores() {
      PlannerApp.state.chores ||= defaultChores();
      return PlannerApp.state.chores;
    },

    addChore(chore) {
      PlannerApp.state.chores ||= defaultChores();
      const c = {
        id: uid(),
        name: chore.name || "New chore",
        area: chore.area || "Home",
        cadenceDays: clamp(Number(chore.cadenceDays || 7), 1, 365),
        lastDoneISO: chore.lastDoneISO || todayISO(),
        difficulty: clamp(Number(chore.difficulty || 2), 1, 3),
        enabled: chore.enabled !== false
      };
      PlannerApp.state.chores.push(c);
      return c;
    },

    markChoreDone(choreId, doneISO = todayISO()) {
      PlannerApp.state.chores ||= defaultChores();
      PlannerApp.state.choreHistory ||= [];
      const c = PlannerApp.state.chores.find(x => x.id === choreId);
      if (!c) return null;
      c.lastDoneISO = doneISO;
      PlannerApp.state.choreHistory.push({ id: uid(), choreId, doneISO, ts: Date.now() });
      return c;
    }
  };

  window.PlannerApp = PlannerApp;

  /* =========================================================
     Internal helpers & defaults
     ========================================================= */

  function defaultState() {
    return {
      meta: { createdAt: Date.now(), updatedAt: Date.now(), version: PlannerApp.version },
      settings: defaultSettings(),
      // daily state (tasks/checklists/habits/pomodoro)
      days: {},
      // weekly scheduled blocks
      weeks: {},
      // appointments stored by actual date and synced
      appointmentsByDate: {},
      // ink strokes JSON
      ink: { daily: {}, weekly: {} },
      // chores
      chores: defaultChores(),
      choreHistory: []
    };
  }

  function defaultSettings() {
    return {
      dayStart: "06:00",
      dayEnd: "22:00",
      timelineStep: 15,
      homeMorningAnchor: "06:00",
      homeEveningAnchor: "17:00",

      // School letter day templates (DEFAULTS NOW FILLED)
      letterSchedules: {
        A: [
          { start: "09:05", end: "09:50", title: "4th Rosenthal", area: "lrc" },
          { start: "10:05", end: "10:50", title: "2nd Peterson", area: "lrc" },
          { start: "11:05", end: "11:50", title: "3rd Hossain", area: "lrc" },
          { start: "12:05", end: "12:45", title: "Lunch", area: "personal" },
          { start: "12:45", end: "13:45", title: "Admin", area: "lrc" },
          { start: "13:45", end: "14:30", title: "5th Ultimo", area: "lrc" },
          { start: "14:30", end: "14:45", title: "Prep", area: "personal" },
          { start: "14:45", end: "15:30", title: "1st Rogers", area: "lrc" }
        ],
        B: [
          { start: "09:05", end: "09:50", title: "4th Cavello", area: "lrc" },
          { start: "10:05", end: "10:50", title: "2nd Schmidt", area: "lrc" },
          { start: "11:05", end: "12:05", title: "Admin", area: "lrc" },
          { start: "12:05", end: "12:45", title: "Lunch", area: "personal" },
          { start: "12:45", end: "13:45", title: "Admin", area: "lrc" },
          { start: "13:45", end: "14:30", title: "5th Isibindi", area: "lrc" }
        ],
        C: [
          { start: "08:45", end: "09:05", title: "AM Duty & Opening", area: "lrc" },
          { start: "09:05", end: "09:50", title: "Admin", area: "lrc" },
          { start: "10:05", end: "10:50", title: "2nd Adams", area: "lrc" },
          { start: "11:05", end: "12:05", title: "3rd Pulsa", area: "lrc" },
          { start: "12:05", end: "12:45", title: "Lunch", area: "personal" },
          { start: "12:45", end: "13:45", title: "Admin", area: "lrc" },
          { start: "13:45", end: "14:30", title: "5th Amistad", area: "lrc" },
          { start: "14:30", end: "15:30", title: "Prep", area: "personal" },
          { start: "15:30", end: "15:45", title: "Closing", area: "lrc" }
        ],
        D: [
          { start: "12:20", end: "13:00", title: "Lunch", area: "personal" },
          { start: "12:45", end: "14:45", title: "Prep", area: "personal" },
          { start: "14:45", end: "15:30", title: "1st Wilson", area: "lrc" }
        ],
        E: [
          { start: "09:05", end: "09:50", title: "4th Tomter", area: "lrc" },
          { start: "10:05", end: "10:50", title: "Prep", area: "personal" },
          { start: "11:05", end: "12:05", title: "3rd Carroll", area: "lrc" },
          { start: "12:05", end: "12:45", title: "Lunch", area: "personal" },
          { start: "12:45", end: "13:45", title: "Prep", area: "personal" },
          { start: "13:45", end: "14:30", title: "5th Reveur", area: "lrc" },
          { start: "14:30", end: "14:45", title: "Prep", area: "personal" },
          { start: "14:45", end: "15:30", title: "1st Day", area: "lrc" }
        ]
      },

      // weekday fallback for dates not covered by the mapping
      weekLetterMap: { Mon: "A", Tue: "B", Wed: "C", Thu: "D", Fri: "E" },

      // Date->Letter mapping (your PDF range). null = No School
      // NOTE: Tail corrected: 2026-05-26..05-29 now A/B/C/D and 2026-06-01 added as E.
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
        "2026-05-25": null,
        "2026-05-26": "A",
        "2026-05-27": "B",
        "2026-05-28": "C",
        "2026-05-29": "D",

        // Jun 2026
        "2026-06-01": "E"
      },

      habits: [
        { id: "water", name: "Water", goalPerDay: 6, unit: "cups" },
        { id: "move", name: "Movement", goalPerDay: 1, unit: "done" },
        { id: "plan", name: "Plan day (2 min)", goalPerDay: 1, unit: "done" }
      ],

      recurring: {
        daily: [
          { title: "Quick inbox sweep (2 min)", bucket: "should", time: "08:00", list: "inbox" }
        ]
      }
    };
  }

  function defaultDay() {
    return {
      tasks: { inbox: [], home: [], lrc: [] },
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
      habits: {},
      pomodoro: { mode: "focus", remainingSec: 25 * 60, running: false, lastTick: null }
    };
  }

  function defaultWeek() {
    return { days: {} }; // days[iso] = { scheduled: [] }
  }

  function defaultChores() {
    // starter set you can edit in the UI later
    const t = todayISO();
    return [
      { id: uid(), name: "Dishes", area: "Kitchen", cadenceDays: 1, lastDoneISO: t, difficulty: 2, enabled: true },
      { id: uid(), name: "Wipe counters", area: "Kitchen", cadenceDays: 2, lastDoneISO: t, difficulty: 1, enabled: true },
      { id: uid(), name: "Laundry", area: "Home", cadenceDays: 7, lastDoneISO: t, difficulty: 3, enabled: true },
      { id: uid(), name: "Bathroom quick clean", area: "Bathroom", cadenceDays: 7, lastDoneISO: t, difficulty: 2, enabled: true }
    ];
  }

  /* ---------- Ensure containers ---------- */

  function ensureDay(dateISO) {
    PlannerApp.state.days ||= {};
    if (!PlannerApp.state.days[dateISO]) PlannerApp.state.days[dateISO] = defaultDay();
    // Ensure shape
    PlannerApp.state.days[dateISO].tasks ||= { inbox: [], home: [], lrc: [] };
    PlannerApp.state.days[dateISO].checklists ||= { homeMorning: [], homeEvening: [] };
    PlannerApp.state.days[dateISO].habits ||= {};
    PlannerApp.state.days[dateISO].pomodoro ||= { mode: "focus", remainingSec: 25 * 60, running: false, lastTick: null };
    return PlannerApp.state.days[dateISO];
  }

  function ensureWeek(wkKey) {
    PlannerApp.state.weeks ||= {};
    if (!PlannerApp.state.weeks[wkKey]) PlannerApp.state.weeks[wkKey] = defaultWeek();
    PlannerApp.state.weeks[wkKey].days ||= {};
    return PlannerApp.state.weeks[wkKey];
  }

  /* ---------- Letter day lookups ---------- */

  function getLetterDayForDate(iso) {
    const map = PlannerApp.settings.letterDayByDate || {};
    if (Object.prototype.hasOwnProperty.call(map, iso)) {
      return map[iso]; // "A".."E" OR null
    }
    return undefined; // not specified
  }

  function weekdayKeyShort(dateObj) {
    // Return Mon/Tue/Wed/Thu/Fri/Sat/Sun consistently
    const s = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    return s.replace(".", "");
  }

  function getFallbackLetterForDate(iso) {
    const d = new Date(iso);
    const dow = weekdayKeyShort(d); // Mon/Tue...
    const wkMap = PlannerApp.settings.weekLetterMap || {};
    return wkMap[dow] || null;
  }

  function kindFromTemplateArea(area) {
    const a = (area || "").toLowerCase();
    if (a === "lrc") return "lrc";
    if (a === "home") return "home";
    // personal/other -> render as task (neutral)
    return "task";
  }

  /**
   * Applies letter schedule blocks for a given date ONLY if that date has zero scheduled blocks.
   * Never overwrites an existing schedule.
   * Returns: { applied: boolean, reason?: string, letter?: string|null }
   */
  function ensureTemplateAppliedIfEmpty(dateISO) {
    const wk = weekKey(new Date(dateISO));
    ensureWeek(wk);
    PlannerApp.state.weeks[wk].days[dateISO] ||= { scheduled: [] };

    const existing = PlannerApp.state.weeks[wk].days[dateISO].scheduled || [];
    if (existing.length > 0) return { applied: false, reason: "already-has-blocks" };

    // 1) explicit date map
    let letter = getLetterDayForDate(dateISO);

    // 2) fallback weekday map when not specified
    if (letter === undefined) {
      letter = getFallbackLetterForDate(dateISO);
    }

    // no school day (explicit null) OR unknown weekend fallback null
    if (letter === null) return { applied: false, reason: "no-school", letter: null };

    const template = PlannerApp.settings.letterSchedules?.[letter] || [];
    if (!template.length) return { applied: false, reason: "missing-template", letter };

    for (const item of template) {
      PlannerApp.addBlock(dateISO, {
        kind: kindFromTemplateArea(item.area),
        title: `${letter} Day • ${item.title}${item.location ? " (" + item.location + ")" : ""}`,
        startMin: minutesFromHHMM(item.start),
        endMin: minutesFromHHMM(item.end),
        meta: `${item.start}–${item.end}`,
        source: { from: "letterSchedule", letter }
      });
    }

    return { applied: true, letter };
  }

  /* ---------- Recurring tasks (simple daily) ---------- */

  function applyRecurringTasksForDate(dateISO) {
    ensureDay(dateISO);
    const day = PlannerApp.state.days[dateISO];
    const already = new Set([
      ...(day.tasks.inbox || []).map(t => t.title),
      ...(day.tasks.home || []).map(t => t.title),
      ...(day.tasks.lrc || []).map(t => t.title)
    ]);

    const rec = PlannerApp.settings.recurring?.daily || [];
    for (const r of rec) {
      if (already.has(r.title)) continue;
      PlannerApp.addTask(dateISO, r.list || "inbox", r.title, {
        bucket: r.bucket || "should",
        time: r.time || "",
        manualBucket: false
      });
    }
  }

  /* ---------- Auto-populate weekly schedule from letter day templates ---------- */

  function autoPopulateWeekIfEmpty(wkKey) {
    const wk = ensureWeek(wkKey);
    const mondayISO = wkKey.replace("wk_", "");
    const days = getWeekRange(new Date(mondayISO));

    for (const d of days) {
      const iso = todayISO(d);
      wk.days[iso] ||= { scheduled: [] };

      // Only apply if empty. Never overwrite.
      ensureTemplateAppliedIfEmpty(iso);
    }
  }

  /* ---------- Storage / Sync ---------- */

  async function loadState() {
    // 1) Require login if available
    if (window.lrcQuestCore?.requireLogin) {
      await window.lrcQuestCore.requireLogin();
      PlannerApp.user = window.lrcQuestCore.getCurrentUser?.() || null;
    }

    // 2) Load local
    const local = safeJSON(localStorage.getItem(LS_KEY));

    // 3) Try cloud
    let cloud = null;
    if (window.lrcQuestCore?.loadUserData) {
      cloud = await window.lrcQuestCore.loadUserData(APP_ID);
    } else if (window.lrcQuestCore?.db && PlannerApp.user) {
      try {
        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
        const ref = doc(window.lrcQuestCore.db, "users", PlannerApp.user.uid, "apps", APP_ID);
        const snap = await getDoc(ref);
        cloud = snap.exists() ? snap.data()?.data : null;
      } catch (e) {
        cloud = null;
      }
    }

    PlannerApp.state = cloud || local || defaultState();
    PlannerApp.state.meta ||= { createdAt: Date.now(), updatedAt: Date.now(), version: PlannerApp.version };
    PlannerApp.state.settings ||= defaultSettings();
    PlannerApp.settings = PlannerApp.state.settings;

    // Ensure top-level collections
    PlannerApp.state.days ||= {};
    PlannerApp.state.weeks ||= {};
    PlannerApp.state.appointmentsByDate ||= {};
    PlannerApp.state.ink ||= { daily: {}, weekly: {} };
    PlannerApp.state.chores ||= defaultChores();
    PlannerApp.state.choreHistory ||= [];
  }

  async function saveState() {
    if (!PlannerApp.state) return;

    PlannerApp.state.meta ||= {};
    PlannerApp.state.meta.updatedAt = Date.now();
    PlannerApp.state.meta.version = PlannerApp.version;

    // local always
    localStorage.setItem(LS_KEY, JSON.stringify(PlannerApp.state));

    // cloud if possible
    if (window.lrcQuestCore?.saveUserData) {
      try {
        await window.lrcQuestCore.saveUserData(APP_ID, PlannerApp.state);
      } catch (_) {}
    } else if (window.lrcQuestCore?.db && PlannerApp.user) {
      try {
        const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
        const ref = doc(window.lrcQuestCore.db, "users", PlannerApp.user.uid, "apps", APP_ID);
        await setDoc(ref, { data: PlannerApp.state, updatedAt: Date.now(), version: PlannerApp.version }, { merge: true });
      } catch (_) {}
    }
  }

  /* ---------- UI pill ---------- */

  function updateUserPill(showSaved = false) {
    const el = document.getElementById("userPill");
    if (!el) return;

    const email = PlannerApp.user?.email || null;
    if (!email) {
      el.textContent = showSaved ? "Local mode • saved" : "Local mode (not signed in)";
      return;
    }
    el.textContent = showSaved ? `Signed in: ${email} • synced` : `Signed in: ${email}`;
  }

  /* ---------- Utilities ---------- */

  function safeJSON(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function todayISO(d = new Date()) {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }

  function weekKey(date) {
    // Monday-start key: wk_YYYY-MM-DD (Monday)
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - day);
    return "wk_" + todayISO(d);
  }

  function getWeekRange(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Mon=0
    const mon = new Date(d);
    mon.setDate(d.getDate() - day);

    const out = [];
    for (let i = 0; i < 7; i++) {
      const x = new Date(mon);
      x.setDate(mon.getDate() + i);
      out.push(x);
    }
    return out;
  }

  function minutesFromHHMM(hhmm) {
    const [h, m] = (hhmm || "00:00").split(":").map(Number);
    return h * 60 + m;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function categorizeTask(text) {
    const t = (text || "").toLowerCase();
    if (t.includes("pay") || t.includes("deadline") || t.includes("due") || t.includes("call") || t.includes("email")) return "must";
    if (t.includes("plan") || t.includes("prep") || t.includes("tidy") || t.includes("laundry")) return "should";
    return "could";
  }
})();
