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
  seedEntireBookBracket,
} from "./book-bracket-firebase.js";

console.log("✅ LOADED book-bracket-admin.js");

const els = {
  dataTitle: document.getElementById("dataTitle"),
  dataSubtitle: document.getElementById("dataSubtitle"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("bookBracketError"),

  adminTitle: document.getElementById("bbAdminTitle"),
  adminSubtitle: document.getElementById("bbAdminSubtitle"),
  adminRound: document.getElementById("bbAdminRound"),

  seedBtn: document.getElementById("bbSeedBtn"),
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

function setDisabled(el, disabled) {
  if (el) el.disabled = !!disabled;
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
  setText(els.dataTitle, "Book Madness Admin");
  setText(els.dataSubtitle, "Manage rounds and view results");
}

async function loadData() {
  state.event = await fetchBookBracketEvent(state.schoolId, BOOK_BRACKET_EVENT_ID);

  if (!state.event) {
    state.matchups = [];
    state.books = [];
    state.booksById = new Map();
    return;
  }

  state.matchups = await fetchBookBracketMatchups(state.schoolId, BOOK_BRACKET_EVENT_ID);
  state.books = await fetchBookBracketBooks(state.schoolId, BOOK_BRACKET_EVENT_ID);

  state.booksById = new Map(
    state.books.map((book) => [book.bookId, book])
  );
}

function buildMatchupCard(matchup) {
  const bookA = state.booksById.get(matchup.bookAId);
  const bookB = state.booksById.get(matchup.bookBId);

  const card = document.createElement("div");
  card.className = "bbPanelNote";

  const winnerBookId = matchup.winnerBookId || null;
  const winnerLabel =
    winnerBookId === matchup.bookAId
      ? `Winner: ${bookA?.title || "Book A"}`
      : winnerBookId === matchup.bookBId
        ? `Winner: ${bookB?.title || "Book B"}`
        : "Winner: TBD";

  card.innerHTML = `
    <strong>${bookA?.title || "TBD"} vs ${bookB?.title || "TBD"}</strong><br/>
    Votes A: ${Number(matchup.voteCountA || 0)} | Votes B: ${Number(matchup.voteCountB || 0)}<br/>
    Status: ${matchup.status || "unknown"}<br/>
    ${winnerLabel}
  `;

  return card;
}

function renderEmptyState(message) {
  if (!els.matchupsWrap) return;
  els.matchupsWrap.innerHTML = "";

  const empty = document.createElement("div");
  empty.className = "bbPanelNote";
  empty.innerHTML = message;
  els.matchupsWrap.appendChild(empty);
}

function render() {
  if (!state.event) {
    setText(els.adminTitle, "Book Madness Not Initialized");
    setText(els.adminSubtitle, "Click 'Seed Book Bracket' to begin");
    setText(els.adminRound, "-");

    renderEmptyState(
      `No event found yet. Click <strong>Seed Book Bracket</strong> to initialize the event, books, and matchups.`
    );

    setDisabled(els.advanceBtn, true);
    return;
  }

  const round = Number(state.event.activeRound || 1);

  setText(els.adminTitle, state.event.title || BOOK_BRACKET_EVENT_TITLE);
  setText(els.adminSubtitle, `Admin Dashboard • Status: ${state.event.status || "draft"}`);
  setText(els.adminRound, BOOK_BRACKET_ROUNDS[round] || `Round ${round}`);

  const roundMatchups = state.matchups
    .filter((matchup) => Number(matchup.roundNumber) === round)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

  if (!els.matchupsWrap) return;
  els.matchupsWrap.innerHTML = "";

  if (!roundMatchups.length) {
    renderEmptyState("No matchups found for the current round.");
    setDisabled(els.advanceBtn, false);
    return;
  }

  roundMatchups.forEach((matchup) => {
    els.matchupsWrap.appendChild(buildMatchupCard(matchup));
  });

  setDisabled(els.advanceBtn, false);
}

async function refreshAndRender() {
  await loadData();
  render();
}

async function seedBracket() {
  clearError();

  try {
    setDisabled(els.seedBtn, true);
    setDisabled(els.refreshBtn, true);
    setDisabled(els.advanceBtn, true);

    showLoading(els.loadingOverlay, els.loadingText, "Seeding Book Madness...");

    await seedEntireBookBracket(state.schoolId, {
      actorUserId: state.userId,
    });

    await refreshAndRender();
  } catch (err) {
    console.error(err);
    showError(normalizeError(err));
  } finally {
    setDisabled(els.seedBtn, false);
    setDisabled(els.refreshBtn, false);
    hideLoading(els.loadingOverlay);
  }
}

async function advanceRound() {
  clearError();

  try {
    setDisabled(els.advanceBtn, true);
    setDisabled(els.seedBtn, true);
    setDisabled(els.refreshBtn, true);

    showLoading(els.loadingOverlay, els.loadingText, "Advancing round...");

    await fnAdvanceBookBracketRound({
      schoolId: state.schoolId,
      eventId: BOOK_BRACKET_EVENT_ID,
    });

    await refreshAndRender();
  } catch (err) {
    console.error(err);
    showError(normalizeError(err));
  } finally {
    setDisabled(els.advanceBtn, false);
    setDisabled(els.seedBtn, false);
    setDisabled(els.refreshBtn, false);
    hideLoading(els.loadingOverlay);
  }
}

async function refreshData() {
  clearError();

  try {
    setDisabled(els.refreshBtn, true);
    setDisabled(els.seedBtn, true);
    setDisabled(els.advanceBtn, true);

    showLoading(els.loadingOverlay, els.loadingText, "Refreshing Book Madness data...");

    await refreshAndRender();
  } catch (err) {
    console.error(err);
    showError(normalizeError(err));
  } finally {
    setDisabled(els.refreshBtn, false);
    setDisabled(els.seedBtn, false);
    setDisabled(els.advanceBtn, false);
    hideLoading(els.loadingOverlay);
  }
}

function wireEvents() {
  els.seedBtn?.addEventListener("click", seedBracket);
  els.advanceBtn?.addEventListener("click", advanceRound);
  els.refreshBtn?.addEventListener("click", refreshData);
}

async function init() {
  applyPageHeader();
  clearError();

  try {
    showLoading(els.loadingOverlay, els.loadingText, "Loading Book Madness Admin...");

    const allowed = await requireRole(["admin"], {
      redirectTo: "./index.html",
    });

    if (!allowed) return;

    state.schoolId = getCurrentSchoolId();
    state.userId = getCurrentUserId();

    if (!state.schoolId) throw new Error("Missing schoolId.");
    if (!state.userId) throw new Error("Missing userId.");

    await refreshAndRender();
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