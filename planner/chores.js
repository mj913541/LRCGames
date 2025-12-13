/* planner/chores.js
   Tody-style chores with "dirtiness" increasing over time.

   Features:
   - Top 3 dirtiest section
   - 5-minute wins filter (difficulty 1–2)
   - Single cadence per chore (cadenceDays)
   - Mark done updates lastDoneISO + logs history + syncs

   Depends on:
     - window.PlannerApp (app.js)
*/

(() => {
  const Chores = {
    filter: "all", // all | quick

    renderChoresPage() {
      const host = document.getElementById("choresHost");
      if (!host) return;

      const chores = PlannerApp.getChores().filter(c => c.enabled !== false);

      // Compute dirtiness metrics
      const enriched = chores.map(c => ({
        ...c,
        daysSince: daysSinceISO(c.lastDoneISO),
        dirtiness: dirtinessScore(c.lastDoneISO, c.cadenceDays),
        label: dirtinessLabel(dirtinessScore(c.lastDoneISO, c.cadenceDays))
      }));

      const quickOnly = (Chores.filter === "quick");
      const visible = enriched
        .filter(c => (quickOnly ? c.difficulty <= 2 : true))
        .sort((a, b) => b.dirtiness - a.dirtiness);

      const top3 = [...enriched].sort((a, b) => b.dirtiness - a.dirtiness).slice(0, 3);

      host.innerHTML = `
        <div class="card">
          <div class="hd">
            <h2>Chores</h2>
            <div class="small muted">“Dirty” fills up as time passes since you last did it.</div>
          </div>
          <div class="bd">
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button id="chFilterAll" class="btn ${Chores.filter === "all" ? "primary" : ""}">All</button>
                <button id="chFilterQuick" class="btn ${Chores.filter === "quick" ? "primary" : ""}">5-minute wins</button>
              </div>
              <button id="chAddBtn" class="btn">+ Add chore</button>
            </div>

            <div style="margin-top:16px;">
              <div style="font-weight:900; margin-bottom:10px;">Top 3 dirtiest</div>
              <div id="top3Wrap" style="display:grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap:12px;"></div>
            </div>

            <div style="margin-top:18px;">
              <div style="font-weight:900; margin-bottom:10px;">All chores</div>
              <div id="chList"></div>
            </div>
          </div>
        </div>
      `;

      // Top 3 cards
      const topWrap = document.getElementById("top3Wrap");
      if (topWrap) {
        topWrap.innerHTML = "";
        for (const c of top3) {
          topWrap.appendChild(topCard(c));
        }
      }

      // Main list
      const list = document.getElementById("chList");
      if (list) {
        list.innerHTML = "";
        if (visible.length === 0) {
          list.innerHTML = `<div class="dropHint">No chores match this filter.</div>`;
        } else {
          for (const c of visible) list.appendChild(choreRow(c));
        }
      }

      // Buttons
      document.getElementById("chFilterAll")?.addEventListener("click", () => {
        Chores.filter = "all";
        Chores.renderChoresPage();
      });
      document.getElementById("chFilterQuick")?.addEventListener("click", () => {
        Chores.filter = "quick";
        Chores.renderChoresPage();
      });
      document.getElementById("chAddBtn")?.addEventListener("click", () => openChoreModal(null));
    }
  };

  window.PlannerChores = Chores;

  /* =========================================================
     Components
     ========================================================= */

  function topCard(c) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "0";

    card.innerHTML = `
      <div class="bd" style="padding:16px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div>
            <div style="font-weight:900; font-size:1rem;">${escapeHtml(c.name)}</div>
            <div class="small muted">${escapeHtml(c.area)} • last: ${fmtShort(c.lastDoneISO)}</div>
          </div>
          <button class="btn primary" data-done="${c.id}">Done</button>
        </div>

        <div style="margin-top:10px;">
          <div class="dirtBar"><div style="width:${Math.round(clamp(c.dirtiness / 2, 0, 1) * 100)}%"></div></div>
          <div class="small muted" style="margin-top:6px;">${c.label} • ${c.daysSince} day(s) since</div>
        </div>
      </div>
    `;

    card.querySelector(`[data-done="${c.id}"]`)?.addEventListener("click", async (e) => {
      e.stopPropagation();
      PlannerApp.markChoreDone(c.id, todayISO());
      await PlannerApp.saveNow();
      Chores.renderChoresPage();
    });

    card.addEventListener("click", () => openChoreModal(c.id));
    return card;
  }

  function choreRow(c) {
    const row = document.createElement("div");
    row.className = "choreRow";

    const left = document.createElement("div");
    left.innerHTML = `
      <div style="font-weight:900;">${escapeHtml(c.name)}</div>
      <div class="small muted">${escapeHtml(c.area)} • difficulty ${c.difficulty}/3</div>
      <div class="small muted">Last: ${fmtShort(c.lastDoneISO)} • every ${c.cadenceDays} day(s)</div>
    `;

    const mid = document.createElement("div");
    const pct = Math.round(clamp(c.dirtiness / 2, 0, 1) * 100);
    mid.innerHTML = `
      <div class="dirtBar"><div style="width:${pct}%"></div></div>
      <div class="small muted" style="margin-top:6px;">${c.label} • ${c.daysSince} day(s) since</div>
    `;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "10px";
    right.style.justifyContent = "flex-end";

    const done = document.createElement("button");
    done.className = "btn primary";
    done.textContent = "Done ✅";
    done.addEventListener("click", async (e) => {
      e.stopPropagation();
      PlannerApp.markChoreDone(c.id, todayISO());
      await PlannerApp.saveNow();
      Chores.renderChoresPage();
    });

    const edit = document.createElement("button");
    edit.className = "btn";
    edit.textContent = "Edit";
    edit.addEventListener("click", (e) => {
      e.stopPropagation();
      openChoreModal(c.id);
    });

    right.append(edit, done);
    row.append(left, mid, right);
    return row;
  }

  /* =========================================================
     Modal: add/edit chore
     ========================================================= */

  function openChoreModal(choreId) {
    const host = document.getElementById("modalHost");
    if (!host) return;

    const chores = PlannerApp.getChores();
    const existing = choreId ? chores.find(c => c.id === choreId) : null;

    const name = existing?.name || "";
    const area = existing?.area || "Home";
    const cadenceDays = existing?.cadenceDays || 7;
    const difficulty = existing?.difficulty || 2;
    const lastDone = existing?.lastDoneISO || todayISO();
    const enabled = existing?.enabled !== false;

    host.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>${existing ? "Edit" : "Add"} Chore</h3>

        <label class="small">Name</label>
        <input id="cm_name" class="input" value="${escapeHtml(name)}" placeholder="e.g., Vacuum living room" />

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
          <div>
            <label class="small">Area</label>
            <input id="cm_area" class="input" value="${escapeHtml(area)}" />
          </div>
          <div>
            <label class="small">Cadence (days)</label>
            <input id="cm_cadence" class="input" type="number" min="1" max="365" value="${cadenceDays}" />
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
          <div>
            <label class="small">Difficulty (1–3)</label>
            <select id="cm_diff" class="input">
              <option value="1" ${difficulty == 1 ? "selected" : ""}>1 (quick)</option>
              <option value="2" ${difficulty == 2 ? "selected" : ""}>2</option>
              <option value="3" ${difficulty == 3 ? "selected" : ""}>3 (big)</option>
            </select>
          </div>
          <div>
            <label class="small">Last done (ISO)</label>
            <input id="cm_last" class="input" value="${escapeHtml(lastDone)}" placeholder="YYYY-MM-DD" />
          </div>
        </div>

        <div style="display:flex; gap:10px; align-items:center; margin-top:10px;">
          <input id="cm_enabled" type="checkbox" ${enabled ? "checked" : ""} />
          <label for="cm_enabled" class="small">Enabled</label>
        </div>

        <div style="display:flex; gap:10px; margin-top:14px; justify-content:space-between; flex-wrap:wrap;">
          ${existing ? `<button id="cm_delete" class="btn danger">Delete</button>` : `<span></span>`}
          <div style="display:flex; gap:10px;">
            <button id="cm_cancel" class="btn">Cancel</button>
            <button id="cm_save" class="btn primary">${existing ? "Save" : "Add"}</button>
          </div>
        </div>
      </div>
    `;

    host.classList.add("active");
    host.setAttribute("aria-hidden", "false");

    host.addEventListener("click", (e) => {
      if (e.target === host) closeModal();
    }, { once: true });

    document.getElementById("cm_cancel")?.addEventListener("click", closeModal);

    document.getElementById("cm_delete")?.addEventListener("click", async () => {
      // hard delete
      const idx = chores.findIndex(c => c.id === choreId);
      if (idx >= 0) chores.splice(idx, 1);
      await PlannerApp.saveNow();
      closeModal();
      Chores.renderChoresPage();
    });

    document.getElementById("cm_save")?.addEventListener("click", async () => {
      const patch = {
        name: document.getElementById("cm_name")?.value?.trim() || "New chore",
        area: document.getElementById("cm_area")?.value?.trim() || "Home",
        cadenceDays: clamp(Number(document.getElementById("cm_cadence")?.value || 7), 1, 365),
        difficulty: clamp(Number(document.getElementById("cm_diff")?.value || 2), 1, 3),
        lastDoneISO: (document.getElementById("cm_last")?.value || todayISO()).trim(),
        enabled: !!document.getElementById("cm_enabled")?.checked
      };

      if (existing) {
        Object.assign(existing, patch);
      } else {
        PlannerApp.addChore(patch);
      }

      await PlannerApp.saveNow();
      closeModal();
      Chores.renderChoresPage();
    });
  }

  function closeModal() {
    const host = document.getElementById("modalHost");
    if (!host) return;
    host.classList.remove("active");
    host.setAttribute("aria-hidden", "true");
    host.innerHTML = "";
  }

  /* =========================================================
     Dirtiness math
     ========================================================= */

  function dirtinessScore(lastDoneISO, cadenceDays) {
    const ds = daysSinceISO(lastDoneISO);
    const c = Math.max(1, Number(cadenceDays || 7));
    // 0 = just done, 1 = due, 2 = very overdue (cap)
    return clamp(ds / c, 0, 2);
  }

  function dirtinessLabel(score) {
    if (score < 0.6) return "Fresh";
    if (score < 1.0) return "Getting there";
    if (score < 1.5) return "Due";
    return "Overdue";
  }

  function daysSinceISO(iso) {
    if (!iso) return 999;
    const t0 = new Date(iso + "T00:00:00");
    const t1 = new Date(todayISO() + "T00:00:00");
    const diff = (t1 - t0) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.round(diff));
  }

  /* =========================================================
     Utilities
     ========================================================= */

  function todayISO(d = new Date()) {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }

  function fmtShort(iso) {
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return iso || "";
    }
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
