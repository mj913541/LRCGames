// /readathon-world_Ver3/js/book-bracket-admin.js

import {
  requireRole,
  getCurrentUserId,
  getCurrentSchoolId,
  fnAdvanceBookBracketRound,
} from "./firebase.js";

import {
  normalizeError,
  showLoading,
  hideLoading,
} from "./app.js";

import {
  BOOK_BRACKET_EVENT_ID,
  BOOK_BRACKET_EVENT_TITLE,
  BOOK_BRACKET_ROUNDS,
} from "./book-bracket-config.js";

import {
  fetchBookBracketEvent,
  fetchBookBracketMatchups,
  fetchBookBracketBooks,
} from "./book-bracket-firebase.js";

console.log("✅ LOADED book-bracket-admin.js");

const els = {
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("bookBracketError"),

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

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function showError(message) {
  if (!els.errorBox) {
    console.error(message);
    return;
  }
  els.errorBox.textContent = message || "Something went wrong.";
  els.errorBox.style.display = "";
}

function clearError() {
  if (!els.errorBox) return;
  els.errorBox.textContent = "";
  els.errorBox.style.display = "none";
}

function applyPageHeader() {
  setText(els.pageTitle, "Book Madness Admin");
  setText(els.pageSubtitle, "Manage rounds and view results");
}

async function loadData() {
  state.event = await fetchBookBracketEvent(state.schoolId, BOOK_BRACKET_EVENT_ID);
  state.matchups = await fetchBookBracketMatchups(state.schoolId, BOOK_BRACKET_EVENT_ID);
  state.books = await fetchBookBracketBooks(state.schoolId, BOOK_BRACKET_EVENT_ID);

  state.booksById = new Map(
    state.books.map((b) => [b.bookId, b])
  );
}

function render() {
  const round = Number(state.event?.activeRound || 1);

  setText(els.adminTitle, state.event?.title || BOOK_BRACKET_EVENT_TITLE);
  setText(els.adminSubtitle, "Admin Dashboard");
  setText(els.adminRound, BOOK_BRACKET_ROUNDS[round] || `Round ${round}`);

  const roundMatchups = state.matchups.filter(
    (m) => Number(m.roundNumber) === round
  );

  if (!els.matchupsWrap) return;
  els.matchupsWrap.innerHTML = "";

  if (!roundMatchups.length) {
    const empty = document.createElement("div");
    empty.className = "bbPanelNote";
    empty.textContent = "No matchups found for the current round.";
    els.matchupsWrap.appendChild(empty);
    return;
  }

  roundMatchups.forEach((m) => {
    const bookA = state.booksById.get(m.bookAId);
    const bookB = state.booksById.get(m.bookBId);

    const card = document.createElement("div");
    card.className = "bbPanelNote";
    card.innerHTML = `
      <strong>${bookA?.title || "TBD"} vs ${bookB?.title || "TBD"}</strong><br/>
      Votes A: ${Number(m.voteCountA || 0)} | Votes B: ${Number(m.voteCountB || 0)}<br/>
      Status: ${m.status || "unknown"}
    `;

    els.matchupsWrap.appendChild(card);
  });
}

async function advanceRound() {
  clearError();

  try {
    els.advanceBtn.disabled = true;

    await fnAdvanceBookBracketRound({
      schoolId: state.schoolId,
      eventId: BOOK_BRACKET_EVENT_ID,
    });

    await loadData();
    render();
  } catch (err) {
    showError(normalizeError(err));
  } finally {
    els.advanceBtn.disabled = false;
  }
}

function wireEvents() {
  els.advanceBtn?.addEventListener("click", advanceRound);

  els.refreshBtn?.addEventListener("click", async () => {
    clearError();

    try {
      els.refreshBtn.disabled = true;
      await loadData();
      render();
    } catch (err) {
      showError(normalizeError(err));
    } finally {
      els.refreshBtn.disabled = false;
    }
  });
}

async function init() {
  applyPageHeader();
  clearError();

  try {
    showLoading(els.loadingOverlay, els.loadingText, "Loading Book Madness Admin...");

    const allowed = await requireRole(["admin", "staff"], {
      redirectTo: "./index.html",
    });

    if (!allowed) return;

    state.schoolId = getCurrentSchoolId();
    state.userId = getCurrentUserId();

    if (!state.schoolId) throw new Error("Missing schoolId.");
    if (!state.userId) throw new Error("Missing userId.");

    await loadData();
    render();
    wireEvents();
  } catch (err) {
    console.error(err);
    showError(normalizeError(err));
  } finally {
    hideLoading(els.loadingOverlay);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error("BookBracket admin init failed:", err);
    showError(normalizeError(err));
  });
});