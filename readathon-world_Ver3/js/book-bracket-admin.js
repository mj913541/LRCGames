// /readathon-world_Ver3/js/book-bracket-admin.js

import {
  requireRole,
  getCurrentUserId,
  getCurrentSchoolId,
} from "./firebase.js";

import {
  BOOK_BRACKET_EVENT_ID,
  BOOK_BRACKET_ROUNDS,
} from "./book-bracket-config.js";

import {
  fetchBookBracketEvent,
  fetchBookBracketMatchups,
  fetchBookBracketBooks,
  updateBookBracketEvent,
} from "./book-bracket-firebase.js";

console.log("✅ LOADED book-bracket-admin.js");

const els = {
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),

  adminTitle: document.getElementById("bbAdminTitle"),
  adminSubtitle: document.getElementById("bbAdminSubtitle"),
  adminRound: document.getElementById("bbAdminRound"),

  advanceBtn: document.getElementById("bbAdvanceRoundBtn"),
  refreshBtn: document.getElementById("bbRefreshBtn"),

  matchupsWrap: document.getElementById("bbAdminMatchups"),
};

const state = {
  schoolId: null,
  userId: null,
  event: null,
  matchups: [],
  books: [],
  booksById: new Map(),
};

/* =========================================================
   INIT
========================================================= */

async function init() {
  const allowed = await requireRole(["admin", "staff"], {
    redirectTo: "./index.html",
  });

  if (!allowed) return;

  state.schoolId = getCurrentSchoolId();
  state.userId = getCurrentUserId();

  await loadData();
  render();
  wireEvents();
}

/* =========================================================
   LOAD
========================================================= */

async function loadData() {
  state.event = await fetchBookBracketEvent(state.schoolId, BOOK_BRACKET_EVENT_ID);
  state.matchups = await fetchBookBracketMatchups(state.schoolId, BOOK_BRACKET_EVENT_ID);
  state.books = await fetchBookBracketBooks(state.schoolId, BOOK_BRACKET_EVENT_ID);

  state.booksById = new Map(
    state.books.map((b) => [b.bookId, b])
  );
}

/* =========================================================
   RENDER
========================================================= */

function render() {
  const round = state.event?.activeRound || 1;

  els.adminRound.textContent = BOOK_BRACKET_ROUNDS[round];

  const roundMatchups = state.matchups.filter(
    (m) => m.roundNumber === round
  );

  els.matchupsWrap.innerHTML = "";

  roundMatchups.forEach((m) => {
    const bookA = state.booksById.get(m.bookAId);
    const bookB = state.booksById.get(m.bookBId);

    const el = document.createElement("div");
    el.className = "bbPanelNote";

    el.innerHTML = `
      <strong>${bookA?.title} vs ${bookB?.title}</strong><br/>
      Votes A: ${m.votesA || 0} | Votes B: ${m.votesB || 0}
    `;

    els.matchupsWrap.appendChild(el);
  });
}

/* =========================================================
   ACTIONS
========================================================= */

async function advanceRound() {
  const current = state.event.activeRound || 1;
  const next = current + 1;

  if (next > 4) {
    alert("Already at final round!");
    return;
  }

  await updateBookBracketEvent(state.schoolId, BOOK_BRACKET_EVENT_ID, {
    activeRound: next,
  });

  await loadData();
  render();
}

/* =========================================================
   EVENTS
========================================================= */

function wireEvents() {
  els.advanceBtn.addEventListener("click", advanceRound);
  els.refreshBtn.addEventListener("click", async () => {
    await loadData();
    render();
  });
}

document.addEventListener("DOMContentLoaded", init);