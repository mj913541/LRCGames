/* planner/ui.js
   UI rendering + modals + drag/drop (Apple Pencil friendly)
   Depends on:
     - window.PlannerApp (app.js)
     - window.PlannerInk (ink.js) optional (we call if present)
     - window.PlannerChores (chores.js) optional (chores page calls into it)

   Pages are partial HTML injected into #pageHost by index.html.
*/

(() => {
  const UI = {
    currentRoute: null,
    drag: { active: false, payload: null, el: null, startX: 0, startY: 0, pointerId: null },
    pomoInterval: null,

    async onRouteLoaded(route) {
      UI.currentRoute = route;

      // Wire common nav deep-links (e.g. "Habit History" button)
      wireCommonLinks();

      if (route === "dashboard") {
        wireDashboardHandlers();
        renderDashboard();
      } else if (route === "weekly") {
        wireWeeklyHandlers();
        renderWeekly();
      } else if (route === "chores") {
        // chores.js owns rendering if present
        if (window.PlannerChores?.renderChoresPage) {
          window.PlannerChores.renderChoresPage();
        } else {
          mountMissingModuleCard("chores", "chores.js");
        }
      } else if (route === "habits") {
        wireHabitsHandlers();
        renderHabits();
      } else if (route === "habitHistory") {
        renderHabitHistory();
      } else if (route === "settings") {
        wireSettingsHandlers();
        renderSettings();
      }
    }
  };

  window.PlannerUI = UI;

  /* =========================================================
     Common helpers
     ========================================================= */

  function $(sel) { return document.querySelector(sel); }

  function fmtDateLong(d = new Date()) {
    return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  function hhmmFromMinutes(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function minutesFromHHMM(hhmm) {
    const [h, m] = (hhmm || "00:00").split(":").map(Number);
    return h * 60 + m;
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function todayISO(d = new Date()) {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function mountMissingModuleCard(route, file) {
    const host = $("#pageHost");
    host.innerHTML = `
      <div class="card">
        <div class="hd"><h2>${route}</h2></div>
        <div class="bd">
          <p class="muted">This screen needs <code>${file}</code> loaded.</p>
        </div>
      </div>
    `;
  }

  function wireCommonLinks() {
    // Any element with data-nav="habitHistory" etc will route via hash
    document.querySelectorAll("[data-nav]").forEach(el => {
      el.addEventListener("click", () => {
        const route = el.getAttribute("data-nav");
        location.hash = "#" + route;
      });
    });
  }

  function setNoSchoolBanner(isNoSchool) {
    const el = $("#noSchoolBanner");
    if (!el) return;
    el.classList.toggle("hidden", !isNoSchool);
  }

  function getLetterDayForISO(iso) {
    // Prefer app helper if present
    if (window.PlannerApp?.getLetterDayForDate) return window.PlannerApp.getLetterDayForDate(iso);

    const map = window.PlannerApp?.getSettings?.()?.letterDayByDate || {};
    if (Object.prototype.hasOwnProperty.call(map, iso)) return map[iso]; // may be null
    return undefined;
  }

  function tryApplyTemplateIfEmpty(iso) {
    // Prefer app helper if present (best place for this logic)
    if (window.PlannerApp?.ensureTemplateAppliedIfEmpty) {
      return window.PlannerApp.ensureTemplateAppliedIfEmpty(iso);
    }

    // Fallback: very conservative (never overwrite)
    const app = window.PlannerApp;
    const letter = getLetterDayForISO(iso);
    if (letter === undefined) return { applied: false, reason: "unknown-date" };
    if (letter === null) return { applied: false, reason: "no-school" };

    const day = app.ensureDay(iso);
    const existing = app.getScheduledBlocks?.(iso) || day?.scheduledBlocks || [];
    if (Array.isArray(existing) && existing.length > 0) return { applied: false, reason: "already-has-blocks" };

    const tpl = app.getSettings()?.letterSchedules?.[letter];
    if (!tpl?.blocks?.length) return { applied: false, reason: "missing-template" };

    // If app has an API to set blocks, we should use it. Otherwise, do nothing.
    // (Most builds should have ensureTemplateAppliedIfEmpty in app.js, so this fallback rarely runs.)
    return { applied: false, reason: "no-app-helper" };
  }

  /* =========================================================
     Timeline rendering (15-min slots)
     ========================================================= */

  function buildSlots(settings) {
    const start = minutesFromHHMM(settings.dayStart);
    const end = minutesFromHHMM(settings.dayEnd);
    const step = settings.timelineStep;

    const slots = [];
    for (let t = start; t < end; t += step) {
      slots.push({ startMin: t, endMin: t + step, label: hhmmFromMinutes(t) });
    }
    return slots;
  }

  function renderTimeline(container, blocks, opts = {}) {
    const app = window.PlannerApp;
    const settings = app.getSettings();
    const containerDate = container?.dataset?.date || null; // weekly drop needs this on slot rows

    const slots = buildSlots(settings);
    container.innerHTML = "";

    for (const s of slots) {
      const row = document.createElement("div");
      row.className = "slot";
      row.dataset.start = String(s.startMin);
      row.dataset.end = String(s.endMin);
      if (containerDate) row.dataset.date = containerDate;

      const time = document.createElement("div");
      time.className = "time";
      time.textContent = s.label;

      const cell = document.createElement("div");
      cell.className = "cell";

      row.appendChild(time);
      row.appendChild(cell);
      container.appendChild(row);
    }

    // Place blocks
    const startMin = slots[0].startMin;
    const step = settings.timelineStep;
    const rows = container.querySelectorAll(".slot");

    for (const b of blocks) {
      const idx = Math.floor((b.startMin - startMin) / step);
      const spanSteps = Math.max(1, Math.ceil((b.endMin - b.startMin) / step));
      const row = rows[idx];
      if (!row) continue;

      const cell = row.querySelector(".cell");
      const block = document.createElement("div");
      block.className = `block ${b.kind || ""} draggable`;
      block.dataset.blockId = b.id;
      block.dataset.blockKind = b.kind || "";
      block.dataset.dateISO = containerDate || (opts.dateISO || "");
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

      // Tap to edit
      block.addEventListener("click", (e) => {
        e.stopPropagation();
        openBlockModal(block.dataset.dateISO || opts.dateISO, b.id);
      });

      // Drag blocks? (optional later; currently tasks drag in, blocks edit via modal)
      // If you want block drag-move later, we can add it safely.
    }
  }

  /* =========================================================
     Drag/drop for tasks (Pencil-friendly pointer drag)
     ========================================================= */

  function enablePointerDrag(el, payload) {
    el.classList.add("draggable");

    el.addEventListener("pointerdown", (e) => {
      // Don’t start drag on checkbox clicks (handled separately)
      if (e.target.closest(".chk")) return;

      UI.drag.active = true;
      UI.drag.payload = payload;
      UI.drag.el = el;
      UI.drag.startX = e.clientX;
      UI.drag.startY = e.clientY;
      UI.drag.pointerId = e.pointerId;

      try { el.setPointerCapture(e.pointerId); } catch {}
      el.classList.add("dragging");
    });

    el.addEventListener("pointermove", (e) => {
      if (!UI.drag.active || UI.drag.el !== el) return;
      const dx = e.clientX - UI.drag.startX;
      const dy = e.clientY - UI.drag.startY;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    el.addEventListener("pointerup", async (e) => {
      if (!UI.drag.active || UI.drag.el !== el) return;

      try { el.releasePointerCapture(UI.drag.pointerId); } catch {}
      el.classList.remove("dragging");
      el.style.transform = "";

      const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
      await handleDrop(dropTarget, UI.drag.payload);

      UI.drag.active = false;
      UI.drag.payload = null;
      UI.drag.el = null;
      UI.drag.pointerId = null;
    });
  }

  async function handleDrop(target, payload) {
    // Walk up to find a weekly slot
    let t = target;
    while (t && t !== document.body) {
      if (t.classList?.contains("slot") && t.dataset.date) {
        return await dropOnWeeklySlot(t, payload);
      }
      t = t.parentElement;
    }
  }

  async function dropOnWeeklySlot(slotEl, payload) {
    const app = window.PlannerApp;
    const startMin = Number(slotEl.dataset.start);
    const targetDateISO = slotEl.dataset.date;

    if (payload.type === "task") {
      const { dateISO, listName, taskId } = payload;

      // Convert task -> block (task disappears)
      app.scheduleTask(dateISO, listName, taskId, targetDateISO, startMin, 30);
      await app.saveNow();

      // Re-render weekly + dashboard inbox if needed
      renderWeekly();
      if (UI.currentRoute === "dashboard") renderDashboard();
    }
  }

  /* =========================================================
     TASK UI (Must / Should / Could)
     ========================================================= */

  function taskCard(task, dateISO, listName) {
    const row = document.createElement("div");
    row.className = "taskRow";
    row.dataset.taskId = task.id;

    const left = document.createElement("div");
    left.className = "meta";

    const title = document.createElement("div");
    title.style.fontWeight = "750";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "small";
    meta.textContent = (task.time ? `⏱ ${task.time}` : (task.notes ? `🗒 ${task.notes}` : ""));

    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";
    right.style.alignItems = "center";

    const tag = document.createElement("span");
    tag.className = `tag ${task.bucket}`;
    tag.textContent = task.bucket.toUpperCase();

    const up = document.createElement("button");
    up.className = "btn";
    up.style.padding = "8px 10px";
    up.title = "Promote";
    up.textContent = "↑";
    up.addEventListener("click", async (e) => {
      e.stopPropagation();
      const next = promoteBucket(task.bucket);
      PlannerApp.updateTask(dateISO, listName, task.id, { bucket: next, manualBucket: true });
      await PlannerApp.saveNow();
      renderDashboard();
    });

    const down = document.createElement("button");
    down.className = "btn";
    down.style.padding = "8px 10px";
    down.title = "Demote";
    down.textContent = "↓";
    down.addEventListener("click", async (e) => {
      e.stopPropagation();
      const next = demoteBucket(task.bucket);
      PlannerApp.updateTask(dateISO, listName, task.id, { bucket: next, manualBucket: true });
      await PlannerApp.saveNow();
      renderDashboard();
    });

    const edit = document.createElement("button");
    edit.className = "btn";
    edit.style.padding = "8px 10px";
    edit.title = "Edit";
    edit.textContent = "✎";
    edit.addEventListener("click", (e) => {
      e.stopPropagation();
      openTaskModal(dateISO, listName, task.id);
    });

    const chk = document.createElement("div");
    chk.className = "chk" + (task.done ? " done" : "");
    chk.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    chk.addEventListener("click", async (e) => {
      e.stopPropagation();
      PlannerApp.updateTask(dateISO, listName, task.id, { done: !task.done });
      await PlannerApp.saveNow();
      renderDashboard();
    });

    right.append(tag, up, down, edit, chk);
    row.append(left, right);

    // Pencil-friendly drag to weekly time slot
    enablePointerDrag(row, { type: "task", dateISO, listName, taskId: task.id });

    return row;
  }

  function promoteBucket(bucket) {
    if (bucket === "could") return "should";
    if (bucket === "should") return "must";
    return "must";
  }
  function demoteBucket(bucket) {
    if (bucket === "must") return "should";
    if (bucket === "should") return "could";
    return "could";
  }

  /* =========================================================
     DASHBOARD
     ========================================================= */

  function wireDashboardHandlers() {
    $("#addQuickTaskBtn")?.addEventListener("click", async () => {
      const txt = $("#quickTask")?.value?.trim();
      if (!txt) return;
      PlannerApp.addTask(PlannerApp.getTodayISO(), "inbox", txt, {});
      $("#quickTask").value = "";
      await PlannerApp.saveNow();
      renderDashboard();
    });

    $("#openAddApptBtn")?.addEventListener("click", () => openAppointmentModal({ dateISO: PlannerApp.getTodayISO() }));

    // Pomodoro
    $("#pomoStart")?.addEventListener("click", togglePomodoro);
    $("#pomoFocus")?.addEventListener("click", () => resetPomodoro("focus"));
    $("#pomoBreak")?.addEventListener("click", () => resetPomodoro("break"));

    // Ink toggle
    $("#inkToggle")?.addEventListener("click", () => {
      const wrap = $("#dailyInkWrap");
      if (!wrap) return;
      wrap.classList.toggle("inkOn");
      const on = wrap.classList.contains("inkOn");
      $("#inkToggle").textContent = on ? "Ink: ON" : "Ink: OFF";
      if (window.PlannerInk?.setEnabled) window.PlannerInk.setEnabled(on);
    });
  }

  function renderDashboard() {
    const app = PlannerApp;
    const dateISO = app.getTodayISO();
    const settings = app.getSettings();

    $("#dashDate") && ($("#dashDate").textContent = fmtDateLong(new Date()));
    // Timeline blocks = appointments + anchors
    const blocks = [];

    // Appointments (all areas)
    const appts = app.getAppointments(dateISO);
    for (const a of appts) {
      blocks.push({
        id: a.id,
        kind: a.area === "home" ? "home" : (a.area === "lrc" ? "lrc" : "task"),
        title: a.title,
        startMin: minutesFromHHMM(a.start),
        endMin: minutesFromHHMM(a.end),
        meta: `${a.area.toUpperCase()} • ${a.start}–${a.end}`,
        source: { from: "appointment", dateISO, apptId: a.id }
      });
    }

    // Anchors for checklists
    blocks.push({
      id: "homeMorningAnchor",
      kind: "home",
      title: "Home Morning Tasks ✅",
      startMin: minutesFromHHMM(settings.homeMorningAnchor),
      endMin: minutesFromHHMM(settings.homeMorningAnchor) + settings.timelineStep,
      meta: "Tap checklist below"
    });
    blocks.push({
      id: "homeEveningAnchor",
      kind: "home",
      title: "Home Evening Tasks 🌙",
      startMin: minutesFromHHMM(settings.homeEveningAnchor),
      endMin: minutesFromHHMM(settings.homeEveningAnchor) + settings.timelineStep,
      meta: "Tap checklist below"
    });

    const tl = $("#dashTimeline");
    if (tl) renderTimeline(tl, blocks, { dateISO });

    // Checklists
    renderChecklist("#morningList", dateISO, "homeMorning");
    renderChecklist("#eveningList", dateISO, "homeEvening");

    // Tasks columns: Must/Should/Could
    const inbox = app.getTasks(dateISO, "inbox");
    const home = app.getTasks(dateISO, "home");
    const lrc = app.getTasks(dateISO, "lrc");
    const all = [
      ...inbox.map(t => ({ ...t, _list: "inbox" })),
      ...home.map(t => ({ ...t, _list: "home" })),
      ...lrc.map(t => ({ ...t, _list: "lrc" }))
    ].filter(t => !t.done);

    // Clear columns
    const mustCol = $("#mustCol");
    const shouldCol = $("#shouldCol");
    const couldCol = $("#couldCol");
    if (mustCol) mustCol.innerHTML = "";
    if (shouldCol) shouldCol.innerHTML = "";
    if (couldCol) couldCol.innerHTML = "";

    for (const t of all) {
      const card = taskCard(t, dateISO, t._list);
      if (t.bucket === "must") mustCol?.appendChild(card);
      else if (t.bucket === "should") shouldCol?.appendChild(card);
      else couldCol?.appendChild(card);
    }

    // Inbox list (optional quick view)
    const inboxWrap = $("#inboxList");
    if (inboxWrap) {
      inboxWrap.innerHTML = "";
      if (inbox.length === 0) {
        inboxWrap.innerHTML = `<div class="dropHint">Inbox empty. Add a task above 👆</div>`;
      } else {
        for (const t of inbox) inboxWrap.appendChild(taskCard(t, dateISO, "inbox"));
      }
    }

    // Habits summary
    renderHabitsSummary(dateISO);

    // Pomodoro
    renderPomodoro(dateISO);

    // Ink (daily) — mixed mode (typed + pencil). Canvas sits behind controls unless toggled on.
    if (window.PlannerInk?.mountDaily) {
      window.PlannerInk.mountDaily({
        wrapId: "dailyInkWrap",
        canvasId: "dailyInkCanvas",
        toolbarId: "dailyInkToolbar",
        dateISO
      });
    }
  }

  function renderChecklist(sel, dateISO, which) {
    const day = PlannerApp.ensureDay(dateISO);
    const items = day.checklists[which] || [];
    const wrap = $(sel);
    if (!wrap) return;
    wrap.innerHTML = "";

    for (const it of items) {
      const row = document.createElement("div");
      row.className = "taskRow";
      row.style.alignItems = "center";

      const left = document.createElement("div");
      left.className = "meta";
      const title = document.createElement("div");
      title.style.fontWeight = "700";
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
        await PlannerApp.saveNow();
        renderDashboard();
      });

      right.appendChild(chk);
      row.append(left, right);
      wrap.appendChild(row);
    }
  }

  /* =========================================================
     WEEKLY
     ========================================================= */

  function wireWeeklyHandlers() {
    $("#openAddApptBtnWeekly")?.addEventListener("click", () => {
      openAppointmentModal({ dateISO: todayISO() });
    });

    $("#weeklyInkToggle")?.addEventListener("click", () => {
      const wrap = $("#weeklyInkWrap");
      if (!wrap) return;
      wrap.classList.toggle("inkOn");
      const on = wrap.classList.contains("inkOn");
      $("#weeklyInkToggle").textContent = on ? "Ink: ON" : "Ink: OFF";
      if (window.PlannerInk?.setEnabled) window.PlannerInk.setEnabled(on);
    });
  }

  function renderWeekly() {
    const app = PlannerApp;
    const host = $("#weekColumns");
    if (!host) return;

    const days = app.getWeekRange(new Date());

    // Banner: show if the selected "week context" has at least one no-school day
    // (We’ll refine later if you add week navigation.)
    let anyNoSchool = false;

    // Auto-populate templates for EMPTY days (never overwrite)
    let changed = false;
    for (const d of days) {
      const iso = todayISO(d);
      const res = tryApplyTemplateIfEmpty(iso);
      if (res?.applied) changed = true;

      const letter = getLetterDayForISO(iso);
      if (letter === null) anyNoSchool = true;
    }
    if (changed) {
      // Save once after batch apply
      app.saveNow().catch(() => {});
    }

    setNoSchoolBanner(anyNoSchool);

    host.innerHTML = "";

    for (const d of days) {
      const iso = todayISO(d);

      const col = document.createElement("div");
      col.className = "card";

      const hd = document.createElement("div");
      hd.className = "hd";

      const map = app.getSettings().letterDayByDate || {};
      const hasOverride = iso in map;
      const letter = hasOverride ? map[iso] : null;
      const extra = hasOverride ? (letter ? ` • ${letter} Day` : " • No School") : "";

      hd.innerHTML = `<h2>${d.toLocaleDateString(undefined, { weekday: "short" })}
        <span class="small">${iso}${extra}</span></h2>`;

      const bd = document.createElement("div");
      bd.className = "bd";

      const wrap = document.createElement("div");
      wrap.className = "inkWrap";
      wrap.id = `weekWrap_${iso}`;

      const tl = document.createElement("div");
      tl.className = "timeline weekTimeline";
      tl.dataset.date = iso; // needed for slot rows

      // Blocks = scheduled blocks + appointments
      const blocks = [];

      // scheduled
      const scheduled = app.getScheduledBlocks(iso);
      for (const b of scheduled) {
        blocks.push({
          ...b,
          meta: b.meta || `${hhmmFromMinutes(b.startMin)}–${hhmmFromMinutes(b.endMin)}`
        });
      }

      // appointments
      const appts = app.getAppointments(iso);
      for (const a of appts) {
        blocks.push({
          id: `appt_${a.id}`,
          kind: a.area === "home" ? "home" : (a.area === "lrc" ? "lrc" : "task"),
          title: a.title,
          startMin: minutesFromHHMM(a.start),
          endMin: minutesFromHHMM(a.end),
          meta: `${a.area.toUpperCase()} • ${a.start}–${a.end}`,
          source: { from: "appointment", dateISO: iso, apptId: a.id }
        });
      }

      renderTimeline(tl, blocks, { dateISO: iso });

      // Click empty cell to quick-add appt at that time
      tl.addEventListener("click", (e) => {
        const slot = e.target.closest(".slot");
        if (!slot) return;
        const startMin = Number(slot.dataset.start);
        const start = hhmmFromMinutes(startMin);
        const end = hhmmFromMinutes(startMin + app.getSettings().timelineStep);
        openAppointmentModal({ dateISO: iso, start, end });
      });

      wrap.appendChild(tl);

      bd.appendChild(wrap);
      col.appendChild(hd);
      col.appendChild(bd);
      host.appendChild(col);
    }

    // Weekly inbox list (drag tasks onto time slots)
    const inboxWrap = $("#weeklyInbox");
    if (inboxWrap) {
      const dateISO = app.getTodayISO();
      const inbox = app.getTasks(dateISO, "inbox");
      inboxWrap.innerHTML = "";
      if (inbox.length === 0) {
        inboxWrap.innerHTML = `<div class="dropHint">Drag tasks onto a time slot. Add tasks on Dashboard.</div>`;
      } else {
        for (const t of inbox) inboxWrap.appendChild(taskCard(t, dateISO, "inbox"));
      }
    }

    // Mount weekly ink (single layer covering the weekly board container)
    if (window.PlannerInk?.mountWeekly) {
      const wkKey = PlannerApp.weekKey(new Date());
      window.PlannerInk.mountWeekly({
        wrapId: "weeklyInkWrap",
        canvasId: "weeklyInkCanvas",
        toolbarId: "weeklyInkToolbar",
        wkKey
      });
    }
  }

  /* =========================================================
     HABITS (page + summary)
     ========================================================= */

  function wireHabitsHandlers() {
    $("#toHabitHistoryBtn")?.addEventListener("click", () => (location.hash = "#habitHistory"));
  }

  function renderHabitsSummary(dateISO) {
    const wrap = $("#habitsSummary");
    if (!wrap) return;

    const app = PlannerApp;
    const habits = app.getSettings().habits || [];

    wrap.innerHTML = "";
    for (const h of habits) {
      const count = app.getHabitCount(dateISO, h.id);
      const pct = clamp(Math.round((count / h.goalPerDay) * 100), 0, 100);

      const item = document.createElement("div");
      item.className = "habitItem" + (count >= h.goalPerDay ? " habitGreen" : "");

      const left = document.createElement("div");
      left.style.minWidth = "140px";
      left.innerHTML = `<div style="font-weight:800">${h.name}</div>
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
      minus.textContent = "–";
      minus.addEventListener("click", async () => {
        PlannerApp.setHabitCount(dateISO, h.id, Math.max(0, count - 1));
        await PlannerApp.saveNow();
        renderDashboard();
      });

      const plus = document.createElement("button");
      plus.className = "btn primary";
      plus.textContent = "+";
      plus.addEventListener("click", async () => {
        PlannerApp.setHabitCount(dateISO, h.id, count + 1);
        await PlannerApp.saveNow();
        renderDashboard();
      });

      btns.append(minus, plus);
      item.append(left, bar, btns);
      wrap.appendChild(item);
    }
  }

  function renderHabits() {
    const dateISO = PlannerApp.getTodayISO();
    $("#habitsDate") && ($("#habitsDate").textContent = fmtDateLong(new Date()));
    renderHabitsSummary(dateISO);
  }

  function renderHabitHistory() {
    const wrap = $("#habitHistory");
    if (!wrap) return;

    const app = PlannerApp;
    const habits = app.getSettings().habits || [];
    const days = [];
    const start = new Date();
    start.setDate(start.getDate() - 20);
    for (let i = 0; i < 21; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }

    wrap.innerHTML = "";
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

    for (const h of habits) {
      grid.appendChild(cellBox(h.name, true));
      for (const d of days) {
        const iso = todayISO(d);
        const count = app.getHabitCount(iso, h.id);
        const ok = count >= h.goalPerDay;

        const box = document.createElement("div");
        box.style.height = "44px";
        box.style.borderRadius = "12px";
        box.style.border = "1px solid rgba(0,0,0,.08)";
        box.style.background = ok ? "rgba(34,197,94,.18)" : "rgba(0,0,0,.02)";
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
    c.style.border = "1px solid rgba(0,0,0,.08)";
    c.style.background = header ? "rgba(0,0,0,.03)" : "rgba(0,0,0,.02)";
    c.style.fontWeight = header ? "800" : "650";
    c.textContent = text;
    return c;
  }

  /* =========================================================
     POMODORO (simple; ADHD-friendly)
     ========================================================= */

  function renderPomodoro(dateISO) {
    const wrap = $("#pomoWrap");
    if (!wrap) return;

    const day = PlannerApp.ensureDay(dateISO);
    const p = day.pomodoro;

    $("#pomoMode") && ($("#pomoMode").textContent = p.mode === "focus" ? "Focus" : "Break");
    $("#pomoTime") && ($("#pomoTime").textContent = secToMMSS(p.remainingSec));
    $("#pomoStart") && ($("#pomoStart").textContent = p.running ? "Pause" : "Start");
  }

  function secToMMSS(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function togglePomodoro() {
    const dateISO = PlannerApp.getTodayISO();
    const day = PlannerApp.ensureDay(dateISO);
    const p = day.pomodoro;

    p.running = !p.running;
    p.lastTick = Date.now();

    if (p.running) {
      if (UI.pomoInterval) clearInterval(UI.pomoInterval);
      UI.pomoInterval = setInterval(async () => {
        const now = Date.now();
        const delta = Math.floor((now - p.lastTick) / 1000);
        if (delta <= 0) return;

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

        await PlannerApp.saveNow();
        renderPomodoro(dateISO);
      }, 500);
    } else {
      if (UI.pomoInterval) clearInterval(UI.pomoInterval);
    }

    await PlannerApp.saveNow();
    renderPomodoro(dateISO);
  }

  async function resetPomodoro(mode) {
    const dateISO = PlannerApp.getTodayISO();
    const day = PlannerApp.ensureDay(dateISO);
    const p = day.pomodoro;

    p.mode = mode;
    p.running = false;
    p.remainingSec = mode === "focus" ? 25 * 60 : 5 * 60;
    if (UI.pomoInterval) clearInterval(UI.pomoInterval);

    await PlannerApp.saveNow();
    renderPomodoro(dateISO);
  }

  /* =========================================================
     SETTINGS
     ========================================================= */

  function wireSettingsHandlers() {
    $("#saveSettingsBtn")?.addEventListener("click", async () => {
      const s = PlannerApp.getSettings();

      // Week map
      s.weekLetterMap = {
        Mon: $("#mapMon")?.value || "A",
        Tue: $("#mapTue")?.value || "B",
        Wed: $("#mapWed")?.value || "C",
        Thu: $("#mapThu")?.value || "D",
        Fri: $("#mapFri")?.value || "E"
      };

      // Optional JSON overrides (blank = keep current)
      const schedStr = ($("#scheduleJson")?.value || "").trim();
      const mapStr = ($("#dateMapJson")?.value || "").trim();

      if (schedStr.length) {
        try {
          s.letterSchedules = JSON.parse(schedStr);
        } catch (e) {
          alert("Schedule JSON is invalid. Fix it and try again.");
          return;
        }
      }

      if (mapStr.length) {
        try {
          s.letterDayByDate = JSON.parse(mapStr);
        } catch (e) {
          alert("Date Map JSON is invalid. Fix it and try again.");
          return;
        }
      }

      // Save settings back into state
      PlannerApp.getState().settings = s;
      await PlannerApp.saveNow();
      alert("Saved ✅");
    });
  }

  function renderSettings() {
    const s = PlannerApp.getSettings();
    $("#mapMon") && ($("#mapMon").value = s.weekLetterMap.Mon || "A");
    $("#mapTue") && ($("#mapTue").value = s.weekLetterMap.Tue || "B");
    $("#mapWed") && ($("#mapWed").value = s.weekLetterMap.Wed || "C");
    $("#mapThu") && ($("#mapThu").value = s.weekLetterMap.Thu || "D");
    $("#mapFri") && ($("#mapFri").value = s.weekLetterMap.Fri || "E");

    // Put JSON into textareas (optional edits)
    $("#scheduleJson") && ($("#scheduleJson").value = JSON.stringify(s.letterSchedules || {}, null, 2));
    $("#dateMapJson") && ($("#dateMapJson").value = JSON.stringify(s.letterDayByDate || {}, null, 2));
  }

  /* =========================================================
     MODALS
     ========================================================= */

  function openModal(innerHTML) {
    const host = $("#modalHost");
    if (!host) return;

    host.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        ${innerHTML}
      </div>
    `;
    host.classList.add("active");
    host.setAttribute("aria-hidden", "false");

    host.addEventListener("click", (e) => {
      if (e.target === host) closeModal();
    }, { once: true });
  }

  function closeModal() {
    const host = $("#modalHost");
    if (!host) return;
    host.classList.remove("active");
    host.setAttribute("aria-hidden", "true");
    host.innerHTML = "";
  }

  function openTaskModal(dateISO, listName, taskId) {
    const task = PlannerApp.getTasks(dateISO, listName).find(t => t.id === taskId);
    if (!task) return;

    openModal(`
      <h3>Edit Task</h3>
      <div class="small muted" style="margin-bottom:12px;">${listName.toUpperCase()} • ${dateISO}</div>

      <label class="small">Title</label>
      <input id="tm_title" class="input" value="${escapeHtml(task.title)}" />

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
        <div>
          <label class="small">Bucket</label>
          <select id="tm_bucket" class="input">
            <option value="must" ${task.bucket === "must" ? "selected" : ""}>Must</option>
            <option value="should" ${task.bucket === "should" ? "selected" : ""}>Should</option>
            <option value="could" ${task.bucket === "could" ? "selected" : ""}>Could</option>
          </select>
        </div>
        <div>
          <label class="small">Time (optional)</label>
          <input id="tm_time" class="input" placeholder="08:00" value="${escapeHtml(task.time || "")}" />
        </div>
      </div>

      <label class="small" style="margin-top:10px;">Notes (optional)</label>
      <textarea id="tm_notes" class="input" rows="3">${escapeHtml(task.notes || "")}</textarea>

      <div style="display:flex; gap:10px; margin-top:14px; justify-content:flex-end;">
        <button id="tm_delete" class="btn danger">Delete</button>
        <button id="tm_cancel" class="btn">Cancel</button>
        <button id="tm_save" class="btn primary">Save</button>
      </div>
    `);

    $("#tm_cancel")?.addEventListener("click", closeModal);
    $("#tm_delete")?.addEventListener("click", async () => {
      PlannerApp.deleteTask(dateISO, listName, taskId);
      await PlannerApp.saveNow();
      closeModal();
      if (UI.currentRoute === "dashboard") renderDashboard();
      if (UI.currentRoute === "weekly") renderWeekly();
    });
    $("#tm_save")?.addEventListener("click", async () => {
      PlannerApp.updateTask(dateISO, listName, taskId, {
        title: $("#tm_title")?.value?.trim() || task.title,
        bucket: $("#tm_bucket")?.value || task.bucket,
        time: $("#tm_time")?.value?.trim() || "",
        notes: $("#tm_notes")?.value?.trim() || "",
        manualBucket: true
      });
      await PlannerApp.saveNow();
      closeModal();
      if (UI.currentRoute === "dashboard") renderDashboard();
      if (UI.currentRoute === "weekly") renderWeekly();
    });
  }

  function openBlockModal(dateISO, blockId) {
    if (!dateISO) return;

    // block might be scheduled OR an appointment block (prefixed "appt_")
    if (String(blockId).startsWith("appt_")) {
      const apptId = String(blockId).replace("appt_", "");
      return openAppointmentModal({ dateISO, apptId });
    }

    const blocks = PlannerApp.getScheduledBlocks(dateISO);
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    openModal(`
      <h3>Edit Block</h3>
      <div class="small muted" style="margin-bottom:12px;">${dateISO}</div>

      <label class="small">Title</label>
      <input id="bm_title" class="input" value="${escapeHtml(block.title)}" />

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
        <div>
          <label class="small">Start</label>
          <input id="bm_start" class="input" value="${hhmmFromMinutes(block.startMin)}" />
        </div>
        <div>
          <label class="small">End</label>
          <input id="bm_end" class="input" value="${hhmmFromMinutes(block.endMin)}" />
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:14px; justify-content:space-between; flex-wrap:wrap;">
        <button id="bm_sendBack" class="btn">Send back to Tasks</button>
        <div style="display:flex; gap:10px;">
          <button id="bm_delete" class="btn danger">Delete</button>
          <button id="bm_cancel" class="btn">Cancel</button>
          <button id="bm_save" class="btn primary">Save</button>
        </div>
      </div>
    `);

    $("#bm_cancel")?.addEventListener("click", closeModal);

    $("#bm_delete")?.addEventListener("click", async () => {
      PlannerApp.deleteBlock(dateISO, blockId);
      await PlannerApp.saveNow();
      closeModal();
      renderWeekly();
    });

    $("#bm_save")?.addEventListener("click", async () => {
      const start = minutesFromHHMM($("#bm_start")?.value || hhmmFromMinutes(block.startMin));
      const end = minutesFromHHMM($("#bm_end")?.value || hhmmFromMinutes(block.endMin));
      PlannerApp.updateBlock(dateISO, blockId, {
        title: $("#bm_title")?.value?.trim() || block.title,
        startMin: start,
        endMin: Math.max(end, start + PlannerApp.getSettings().timelineStep)
      });
      await PlannerApp.saveNow();
      closeModal();
      renderWeekly();
    });

    $("#bm_sendBack")?.addEventListener("click", () => {
      openModal(`
        <h3>Send back to Tasks</h3>
        <div class="small muted" style="margin-bottom:12px;">Where should this go?</div>

        <label class="small">Destination list</label>
        <select id="sb_list" class="input">
          <option value="inbox">Inbox</option>
          <option value="home">Home</option>
          <option value="lrc">LRC</option>
        </select>

        <div style="display:flex; gap:10px; margin-top:14px; justify-content:flex-end;">
          <button id="sb_cancel" class="btn">Cancel</button>
          <button id="sb_go" class="btn primary">Send</button>
        </div>
      `);

      $("#sb_cancel")?.addEventListener("click", closeModal);
      $("#sb_go")?.addEventListener("click", async () => {
        const toList = $("#sb_list")?.value || "inbox";
        PlannerApp.unscheduleBlock(dateISO, blockId, toList, PlannerApp.getTodayISO());
        await PlannerApp.saveNow();
        closeModal();
        renderWeekly();
      });
    });
  }

  function openAppointmentModal({ dateISO, apptId = null, start = "", end = "" }) {
    const appts = PlannerApp.getAppointments(dateISO);
    const existing = apptId ? appts.find(a => a.id === apptId) : null;

    const title = existing?.title || "";
    const area = existing?.area || "personal";
    const s = existing?.start || start || "09:00";
    const e = existing?.end || end || "09:30";
    const notes = existing?.notes || "";

    openModal(`
      <h3>${existing ? "Edit" : "Add"} Appointment</h3>
      <div class="small muted" style="margin-bottom:12px;">${dateISO}</div>

      <label class="small">Title</label>
      <input id="am_title" class="input" value="${escapeHtml(title)}" placeholder="Doctor / Meeting / Daycare..." />

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
        <div>
          <label class="small">Start</label>
          <input id="am_start" class="input" value="${escapeHtml(s)}" />
        </div>
        <div>
          <label class="small">End</label>
          <input id="am_end" class="input" value="${escapeHtml(e)}" />
        </div>
      </div>

      <label class="small" style="margin-top:10px;">Area</label>
      <select id="am_area" class="input">
        <option value="home" ${area === "home" ? "selected" : ""}>Home</option>
        <option value="lrc" ${area === "lrc" ? "selected" : ""}>LRC</option>
        <option value="personal" ${area === "personal" ? "selected" : ""}>Personal</option>
        <option value="other" ${area === "other" ? "selected" : ""}>Other</option>
      </select>

      <label class="small" style="margin-top:10px;">Notes (optional)</label>
      <textarea id="am_notes" class="input" rows="3">${escapeHtml(notes)}</textarea>

      <div style="display:flex; gap:10px; margin-top:14px; justify-content:space-between; flex-wrap:wrap;">
        ${existing ? `<button id="am_delete" class="btn danger">Delete</button>` : `<span></span>`}
        <div style="display:flex; gap:10px;">
          <button id="am_cancel" class="btn">Cancel</button>
          <button id="am_save" class="btn primary">${existing ? "Save" : "Add"}</button>
        </div>
      </div>
    `);

    $("#am_cancel")?.addEventListener("click", closeModal);

    $("#am_delete")?.addEventListener("click", async () => {
      PlannerApp.deleteAppointment(dateISO, apptId);
      await PlannerApp.saveNow();
      closeModal();
      if (UI.currentRoute === "dashboard") renderDashboard();
      if (UI.currentRoute === "weekly") renderWeekly();
    });

    $("#am_save")?.addEventListener("click", async () => {
      const patch = {
        title: $("#am_title")?.value?.trim() || "Appointment",
        start: $("#am_start")?.value?.trim() || s,
        end: $("#am_end")?.value?.trim() || e,
        area: $("#am_area")?.value || area,
        notes: $("#am_notes")?.value?.trim() || ""
      };

      if (existing) {
        PlannerApp.updateAppointment(dateISO, apptId, patch);
      } else {
        PlannerApp.addAppointment({ dateISO, ...patch });
      }

      await PlannerApp.saveNow();
      closeModal();
      if (UI.currentRoute === "dashboard") renderDashboard();
      if (UI.currentRoute === "weekly") renderWeekly();
    });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
