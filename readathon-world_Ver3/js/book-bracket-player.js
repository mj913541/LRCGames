// /readathon-world_Ver3/js/book-bracket-student.js

import {
  requireRole,
  getCurrentUserId,
  getCurrentSchoolId,
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
  getBookById,
} from "./book-bracket-config.js";

import {
  fetchBookBracketEvent,
  fetchBookBracketBooks,
  fetchBookBracketMatchups,
  fetchBookBracketUserProgress,
  ensureBookBracketUserProgress,
  ensureBookBracketMatchupState,
  isMatchupVoteUnlocked,
  hasUserVotedMatchup,
  isMatchupCompleted,
  touchBookBracketUserProgress,
  saveBookBracketVote,
  logBookBracketUserAction,
  logBookBracketAdminAction,
} from "./book-bracket-firebase.js";

import {
  mountBookBracketPlayer,
} from "./book-bracket-player.js";

console.log("✅ LOADED book-bracket-student.js");

/* =========================================================
   ELEMENTS
========================================================= */

const els = {
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorBox: document.getElementById("bookBracketError"),

  eventTitle: document.getElementById("bbEventTitle"),
  eventSubtitle: document.getElementById("bbEventSubtitle"),
  roundBadge: document.getElementById("bbRoundBadge"),
  regionBadge: document.getElementById("bbRegionBadge"),
  matchupCounter: document.getElementById("bbMatchupCounter"),

  matchupTitle: document.getElementById("bbMatchupTitle"),
  matchupSubtext: document.getElementById("bbMatchupSubtext"),

  progressText: document.getElementById("bbProgressText"),
  voteUnlockText: document.getElementById("bbVoteUnlockText"),

  bookACard: document.getElementById("bbBookACard"),
  bookBCard: document.getElementById("bbBookBCard"),

  bookACover: document.getElementById("bbBookACover"),
  bookBCover: document.getElementById("bbBookBCover"),

  bookATitle: document.getElementById("bbBookATitle"),
  bookBTitle: document.getElementById("bbBookBTitle"),

  bookAAuthor: document.getElementById("bbBookAAuthor"),
  bookBAuthor: document.getElementById("bbBookBAuthor"),

  bookASeed: document.getElementById("bbBookASeed"),
  bookBSeed: document.getElementById("bbBookBSeed"),

  bookAStatus: document.getElementById("bbBookAStatus"),
  bookBStatus: document.getElementById("bbBookBStatus"),

  listenABtn: document.getElementById("bbListenABtn"),
  listenBBtn: document.getElementById("bbListenBBtn"),

  chooseABtn: document.getElementById("bbChooseABtn"),
  chooseBBtn: document.getElementById("bbChooseBBtn"),

  teacherUnlockWrap: document.getElementById("bbTeacherUnlockWrap"),
  teacherUnlockBtn: document.getElementById("bbTeacherUnlockBtn"),
  teacherUnlockReason: document.getElementById("bbTeacherUnlockReason"),

  prevBtn: document.getElementById("bbPrevBtn"),
  nextBtn: document.getElementById("bbNextBtn"),

  playerModal: document.getElementById("bbPlayerModal"),
  playerModalTitle: document.getElementById("bbPlayerModalTitle"),
  playerModalSubtitle: document.getElementById("bbPlayerModalSubtitle"),
  playerMount: document.getElementById("bookBracketPlayer"),
  closePlayerBtn: document.getElementById("bbClosePlayerBtn"),

  playerStatus: document.getElementById("bbPlayerStatus"),
  playerProgressText: document.getElementById("bbPlayerProgressText"),
};

const state = {
  schoolId: null,
  userId: null,
  role: "student",

  eventDoc: null,
  books: [],
  booksById: new Map(),
  allMatchups: [],
  roundMatchups: [],
  currentMatchupIndex: 0,

  progress: null,
  activePlayerSession: null,
  activeListeningBookId: null,
  activeListeningMatchupId: null,
};

/* =========================================================
   BASIC HELPERS
========================================================= */

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function setVisible(el, visible) {
  if (!el) return;
  el.style.display = visible ? "" : "none";
}

function setDisabled(el, disabled) {
  if (!el) return;
  el.disabled = !!disabled;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getRoleFromStorage() {
  return (
    localStorage.getItem("readathonV2_role") ||
    localStorage.getItem("role") ||
    "student"
  ).toLowerCase();
}

function getCurrentRoundNumber() {
  return Number(state.eventDoc?.activeRound || 1);
}

function getCurrentRoundLabel() {
  const roundNumber = getCurrentRoundNumber();
  return BOOK_BRACKET_ROUNDS[roundNumber] || `Round ${roundNumber}`;
}

function getCurrentMatchup() {
  return state.roundMatchups[state.currentMatchupIndex] || null;
}

function buildBooksByIdMap(books = []) {
  return new Map(books.map((book) => [book.bookId, book]));
}

function getBookFromState(bookId) {
  return state.booksById.get(bookId) || getBookById(bookId) || null;
}

function getProgressBookState(bookId) {
  return state.progress?.bookStates?.[bookId] || null;
}

function getProgressMatchupState(matchupId) {
  return state.progress?.matchupStates?.[matchupId] || null;
}

function isBookCompletedLocal(bookId) {
  return !!getProgressBookState(bookId)?.completed;
}

function isTeacherUnlockActive(matchupId) {
  return !!getProgressMatchupState(matchupId)?.teacherUnlocked;
}

function getCompletedCountThisRound() {
  return state.roundMatchups.filter((m) => isMatchupCompleted(state.progress, m.matchupId)).length;
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

/* =========================================================
   PAGE HEADER
========================================================= */

function applyBookBracketPageHeader() {
  setText(els.pageTitle, BOOK_BRACKET_EVENT_TITLE);
  setText(els.pageSubtitle, "Listen to both books, then vote for your favorite.");
}

/* =========================================================
   LOADERS
========================================================= */

async function loadInitialData() {
  await requireRole(["student", "staff", "admin"], {
    redirectTo: "./html/index.html",
  });

  state.schoolId = getCurrentSchoolId();
  state.userId = getCurrentUserId();
  state.role = getRoleFromStorage();

  if (!state.schoolId) throw new Error("Missing schoolId.");
  if (!state.userId) throw new Error("Missing userId.");

  state.eventDoc = await fetchBookBracketEvent(state.schoolId, BOOK_BRACKET_EVENT_ID);
  state.books = await fetchBookBracketBooks(state.schoolId, BOOK_BRACKET_EVENT_ID);
  state.booksById = buildBooksByIdMap(state.books);
  state.allMatchups = await fetchBookBracketMatchups(state.schoolId, BOOK_BRACKET_EVENT_ID);

  await ensureBookBracketUserProgress(state.schoolId, state.userId, {
    eventId: BOOK_BRACKET_EVENT_ID,
  });

  state.progress = await fetchBookBracketUserProgress(state.schoolId, state.userId);

  if (!state.eventDoc) {
    throw new Error("Book Madness event has not been seeded yet.");
  }

  const activeRound = getCurrentRoundNumber();

  state.roundMatchups = state.allMatchups.filter(
    (m) => Number(m.roundNumber) === activeRound
  );

  if (!state.roundMatchups.length) {
    throw new Error(`No matchups found for round ${activeRound}.`);
  }
}

/* =========================================================
   RENDER HELPERS
========================================================= */

function renderEventChrome() {
  setText(els.eventTitle, state.eventDoc?.title || BOOK_BRACKET_EVENT_TITLE);
  setText(
    els.eventSubtitle,
    state.eventDoc?.status === "live"
      ? "Listen carefully, then cast your vote!"
      : `Event status: ${state.eventDoc?.status || "draft"}`
  );
}

function renderCurrentMatchup() {
  const matchup = getCurrentMatchup();
  if (!matchup) return;

  const bookA = getBookFromState(matchup.bookAId);
  const bookB = getBookFromState(matchup.bookBId);

  const matchupNumber = state.currentMatchupIndex + 1;
  const totalMatchups = state.roundMatchups.length;
  const roundCompleted = getCompletedCountThisRound();

  setText(els.roundBadge, matchup.roundLabel || getCurrentRoundLabel());
  setText(els.regionBadge, matchup.regionLabel || "");
  setText(els.matchupCounter, `Matchup ${matchupNumber} of ${totalMatchups}`);

  setText(
    els.matchupTitle,
    `${bookA?.title || "Book A"} vs ${bookB?.title || "Book B"}`
  );
  setText(
    els.matchupSubtext,
    `${roundCompleted}/${totalMatchups} matchups completed this round`
  );

  setText(
    els.progressText,
    `Round progress: ${roundCompleted}/${totalMatchups} completed`
  );

  renderBookSide({
    side: "A",
    book: bookA,
    titleEl: els.bookATitle,
    authorEl: els.bookAAuthor,
    coverEl: els.bookACover,
    seedEl: els.bookASeed,
    statusEl: els.bookAStatus,
    listenBtnEl: els.listenABtn,
  });

  renderBookSide({
    side: "B",
    book: bookB,
    titleEl: els.bookBTitle,
    authorEl: els.bookBAuthor,
    coverEl: els.bookBCover,
    seedEl: els.bookBSeed,
    statusEl: els.bookBStatus,
    listenBtnEl: els.listenBBtn,
  });

  renderVoteArea(matchup, bookA, bookB);
  renderTeacherUnlock(matchup);
  renderNavButtons();
}

function renderBookSide({
  side,
  book,
  titleEl,
  authorEl,
  coverEl,
  seedEl,
  statusEl,
  listenBtnEl,
}) {
  const bookState = getProgressBookState(book?.bookId);
  const completed = !!bookState?.completed;
  const watchPercent = Number(bookState?.watchPercent || 0);

  setText(titleEl, book?.title || `Book ${side}`);
  setText(authorEl, book?.author ? `by ${book.author}` : "");
  setText(seedEl, book?.seed ? `Seed ${book.seed}` : "");

  if (coverEl) {
    coverEl.src = book?.coverImage || "";
    coverEl.alt = book?.title ? `${book.title} cover` : `Book ${side} cover`;
  }

  if (completed) {
    setText(statusEl, "✅ Completed");
  } else if (watchPercent > 0) {
    setText(statusEl, `▶ ${Math.round(watchPercent * 100)}% watched`);
  } else {
    setText(statusEl, "Not started");
  }

  setDisabled(listenBtnEl, !book?.youtubeVideoId);
}

function renderVoteArea(matchup, bookA, bookB) {
  const voteUnlocked = isMatchupVoteUnlocked(state.progress, matchup);
  const alreadyVoted =
    hasUserVotedMatchup(state.progress, matchup.matchupId) ||
    !!getProgressMatchupState(matchup.matchupId)?.voted;

  if (alreadyVoted) {
    setText(els.voteUnlockText, "✅ Vote already submitted for this matchup.");
  } else if (voteUnlocked) {
    setText(els.voteUnlockText, "🗳 Voting unlocked! Choose your favorite.");
  } else {
    setText(els.voteUnlockText, "🔒 Finish both books to unlock voting.");
  }

  setDisabled(els.chooseABtn, !voteUnlocked || alreadyVoted || !bookA);
  setDisabled(els.chooseBBtn, !voteUnlocked || alreadyVoted || !bookB);
}

function renderTeacherUnlock(matchup) {
  const canOverride = state.role === "staff" || state.role === "admin";
  const alreadyUnlocked = isTeacherUnlockActive(matchup.matchupId);

  setVisible(els.teacherUnlockWrap, canOverride);

  if (!canOverride) return;

  if (alreadyUnlocked) {
    setDisabled(els.teacherUnlockBtn, true);
    if (els.teacherUnlockReason && !els.teacherUnlockReason.value) {
      els.teacherUnlockReason.value = "Already unlocked";
    }
  } else {
    setDisabled(els.teacherUnlockBtn, false);
  }
}

function renderNavButtons() {
  setDisabled(els.prevBtn, state.currentMatchupIndex <= 0);
  setDisabled(els.nextBtn, state.currentMatchupIndex >= state.roundMatchups.length - 1);
}

/* =========================================================
   PLAYER MODAL
========================================================= */

function openPlayerModal({ book, matchup }) {
  setText(els.playerModalTitle, book?.title || "Read Aloud");
  setText(
    els.playerModalSubtitle,
    `${matchup?.roundLabel || ""} • ${matchup?.regionLabel || ""}`
  );
  setText(els.playerStatus, "Loading player...");
  setText(els.playerProgressText, "");
  setVisible(els.playerModal, true);
}

async function closePlayerModal() {
  try {
    if (state.activePlayerSession) {
      await state.activePlayerSession.destroy();
    }
  } catch (err) {
    console.warn("Failed to destroy active player session:", err);
  }

  state.activePlayerSession = null;
  state.activeListeningBookId = null;
  state.activeListeningMatchupId = null;
  setVisible(els.playerModal, false);
}

async function startListeningForBook(side) {
  clearError();

  const matchup = getCurrentMatchup();
  if (!matchup) return;

  const bookId = side === "A" ? matchup.bookAId : matchup.bookBId;
  const book = getBookFromState(bookId);

  if (!book?.youtubeVideoId) {
    showError("This book does not have a YouTube video ID yet.");
    return;
  }

  await closePlayerModal();

  state.activeListeningBookId = bookId;
  state.activeListeningMatchupId = matchup.matchupId;

  openPlayerModal({ book, matchup });

  state.activePlayerSession = await mountBookBracketPlayer({
    schoolId: state.schoolId,
    userId: state.userId,
    eventId: BOOK_BRACKET_EVENT_ID,
    matchupId: matchup.matchupId,
    bookId,
    youtubeVideoId: book.youtubeVideoId,
    playerElementId: "bookBracketPlayer",

    onReady: (playerState) => {
      setText(els.playerStatus, "▶ Player ready. Start watching!");
      updatePlayerProgressUi(playerState);
    },

    onProgress: (playerState) => {
      updatePlayerProgressUi(playerState);
    },

    onCompleted: async (playerState) => {
      setText(els.playerStatus, "✅ Book completed!");
      updatePlayerProgressUi(playerState);
      await refreshProgressFromFirestore();
      renderCurrentMatchup();
    },

    onStateChange: (playerState) => {
      if (playerState?.completed) {
        setText(els.playerStatus, "✅ Book completed!");
      } else if (playerState?.isPlaybackActive) {
        setText(els.playerStatus, "▶ Watching...");
      } else {
        setText(els.playerStatus, "⏸ Paused");
      }
    },

    onError: (err) => {
      showError(normalizeError(err));
      setText(els.playerStatus, "Player error");
    },
  });
}

function updatePlayerProgressUi(playerState) {
  const watched = Math.floor(playerState?.watchSeconds || 0);
  const percent = Math.round(Number(playerState?.watchPercent || 0) * 100);
  const threshold = Math.floor(playerState?.completionThresholdSeconds || 0);
  const suspicious = Number(playerState?.suspiciousSeekCount || 0);

  setText(
    els.playerProgressText,
    `Watched: ${watched}s • Progress: ${percent}% • Threshold: ${threshold}s${
      suspicious > 0 ? ` • Suspicious skips: ${suspicious}` : ""
    }`
  );
}

/* =========================================================
   VOTING
========================================================= */

async function castVoteForSide(side) {
  clearError();

  const matchup = getCurrentMatchup();
  if (!matchup) return;

  const bookId = side === "A" ? matchup.bookAId : matchup.bookBId;
  const matchupState = getProgressMatchupState(matchup.matchupId) || {};
  const voteUnlocked = isMatchupVoteUnlocked(state.progress, matchup);

  if (!voteUnlocked) {
    showError("Voting is still locked. Finish both books first.");
    return;
  }

  if (matchupState.voted) {
    showError("You already voted in this matchup.");
    return;
  }

  try {
    setDisabled(els.chooseABtn, true);
    setDisabled(els.chooseBBtn, true);

    await saveBookBracketVote({
      schoolId: state.schoolId,
      userId: state.userId,
      matchupId: matchup.matchupId,
      selectedBookId: bookId,
      selectedSide: side,
      eventId: BOOK_BRACKET_EVENT_ID,
      teacherOverrideUsed: !!matchupState.teacherUnlocked,
      voteSource: state.role === "student" ? "student" : "staff",
    });

    await touchBookBracketUserProgress(state.schoolId, state.userId, {
      [`matchupStates.${matchup.matchupId}.voted`]: true,
      [`matchupStates.${matchup.matchupId}.voteUnlocked`]: true,
      [`matchupStates.${matchup.matchupId}.matchupCompleted`]: true,
      votedMatchupIds: Array.from(
        new Set([...(safeArray(state.progress?.votedMatchupIds)), matchup.matchupId])
      ),
      completedMatchupIds: Array.from(
        new Set([...(safeArray(state.progress?.completedMatchupIds)), matchup.matchupId])
      ),
    });

    await logBookBracketUserAction({
      schoolId: state.schoolId,
      userId: state.userId,
      eventId: BOOK_BRACKET_EVENT_ID,
      matchupId: matchup.matchupId,
      bookId,
      actionType: "vote_cast",
      source: "student_page",
      metadata: {
        selectedSide: side,
        teacherOverrideUsed: !!matchupState.teacherUnlocked,
      },
    });

    await refreshProgressFromFirestore();
    renderCurrentMatchup();
  } catch (err) {
    showError(normalizeError(err));
    renderCurrentMatchup();
  }
}

/* =========================================================
   TEACHER UNLOCK
========================================================= */

async function handleTeacherUnlock() {
  clearError();

  const matchup = getCurrentMatchup();
  if (!matchup) return;

  if (!(state.role === "staff" || state.role === "admin")) {
    showError("Only staff or admin can use teacher unlock.");
    return;
  }

  const reason =
    (els.teacherUnlockReason?.value || "").trim() || "Teacher override";

  try {
    setDisabled(els.teacherUnlockBtn, true);

    await ensureBookBracketMatchupState({
      schoolId: state.schoolId,
      userId: state.userId,
      matchupId: matchup.matchupId,
    });

    await touchBookBracketUserProgress(state.schoolId, state.userId, {
      [`matchupStates.${matchup.matchupId}.teacherUnlocked`]: true,
      [`matchupStates.${matchup.matchupId}.teacherUnlockedBy`]: state.userId,
      [`matchupStates.${matchup.matchupId}.teacherUnlockedAt`]: new Date().toISOString(),
      [`matchupStates.${matchup.matchupId}.teacherUnlockReason`]: reason,
      [`matchupStates.${matchup.matchupId}.voteUnlocked`]: true,
      teacherUnlockedMatchupIds: Array.from(
        new Set([...(safeArray(state.progress?.teacherUnlockedMatchupIds)), matchup.matchupId])
      ),
    });

    await logBookBracketAdminAction({
      schoolId: state.schoolId,
      eventId: BOOK_BRACKET_EVENT_ID,
      actionType: "teacher_unlock_matchup",
      performedBy: state.userId,
      performedByRole: state.role,
      targetUserId: state.userId,
      matchupId: matchup.matchupId,
      metadata: {
        reason,
      },
    });

    await refreshProgressFromFirestore();
    renderCurrentMatchup();
  } catch (err) {
    showError(normalizeError(err));
    setDisabled(els.teacherUnlockBtn, false);
  }
}

/* =========================================================
   REFRESH
========================================================= */

async function refreshProgressFromFirestore() {
  state.progress = await fetchBookBracketUserProgress(state.schoolId, state.userId);
}

/* =========================================================
   EVENTS
========================================================= */

function wireEvents() {
  els.listenABtn?.addEventListener("click", () => startListeningForBook("A"));
  els.listenBBtn?.addEventListener("click", () => startListeningForBook("B"));

  els.chooseABtn?.addEventListener("click", () => castVoteForSide("A"));
  els.chooseBBtn?.addEventListener("click", () => castVoteForSide("B"));

  els.teacherUnlockBtn?.addEventListener("click", handleTeacherUnlock);

  els.prevBtn?.addEventListener("click", () => {
    if (state.currentMatchupIndex <= 0) return;
    state.currentMatchupIndex -= 1;
    renderCurrentMatchup();
  });

  els.nextBtn?.addEventListener("click", () => {
    if (state.currentMatchupIndex >= state.roundMatchups.length - 1) return;
    state.currentMatchupIndex += 1;
    renderCurrentMatchup();
  });

  els.closePlayerBtn?.addEventListener("click", () => {
    closePlayerModal().catch((err) => {
      console.warn("Failed to close player modal:", err);
    });
  });
}

/* =========================================================
   INIT
========================================================= */

async function initBookBracketStudentPage() {
  applyBookBracketPageHeader();
  clearError();

  try {
    showLoading(els.loadingOverlay, els.loadingText, "Loading Book Madness...");

    await loadInitialData();
    renderEventChrome();
    renderCurrentMatchup();
    wireEvents();
  } catch (err) {
    console.error(err);
    showError(normalizeError(err));
  } finally {
    hideLoading(els.loadingOverlay);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initBookBracketStudentPage().catch((err) => {
    console.error("BookBracket student init failed:", err);
    showError(normalizeError(err));
  });
});