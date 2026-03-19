// /readathon-world_Ver3/js/book-bracket-firebase.js

import {
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  db,
  auth,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  getCurrentUserId,
  getCurrentSchoolId,
} from "./firebase.js";

import {
  BOOK_BRACKET_EVENT_ID,
  BOOK_BRACKET_EVENT_SEED,
  BOOK_BRACKET_BOOKS,
  BOOK_BRACKET_MATCHUPS,
  BOOK_BRACKET_ROUNDS,
  BOOK_BRACKET_EVENT_STATUS,
  BOOK_BRACKET_MATCHUP_STATUS,
  BOOK_BRACKET_ACTION_TYPES,
  BOOK_BRACKET_REWARD_TYPES,
  createEmptyUserProgress,
  createEmptyBookState,
  createEmptyMatchupState,
  getBookById,
  getMatchupById,
} from "./book-bracket-config.js";

console.log("✅ LOADED book-bracket-firebase.js");

/* --------------------------------------------------
   Constants
-------------------------------------------------- */

export const BOOK_BRACKET_COLLECTIONS = {
  events: "bookBracketEvents",
  books: "bookBracketBooks",
  matchups: "bookBracketMatchups",
  votes: "bookBracketVotes",
  userProgress: "bookBracketUserProgress",
  userActions: "bookBracketUserActions",
  userRewards: "bookBracketUserRewards",
  adminActions: "bookBracketAdminActions",
};

/* --------------------------------------------------
   Session Helpers
-------------------------------------------------- */

export function getCurrentBookBracketSchoolId() {
  return getCurrentSchoolId?.() || getSchoolId() || DEFAULT_SCHOOL_ID;
}

export function getCurrentBookBracketUserId() {
  return getCurrentUserId?.() || auth.currentUser?.uid || null;
}

/* --------------------------------------------------
   Root Path Helpers
-------------------------------------------------- */

export function bookBracketSchoolRoot(schoolId) {
  return `readathonV2_schools/${schoolId}`;
}

export function bookBracketCollectionPath(schoolId, collectionName) {
  return `${bookBracketSchoolRoot(schoolId)}/${collectionName}`;
}

/* --------------------------------------------------
   Document / Collection Refs
-------------------------------------------------- */

export function bookBracketEventRef(
  schoolId,
  eventId = BOOK_BRACKET_EVENT_ID
) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.events,
    eventId
  );
}

export function bookBracketBooksCol(schoolId) {
  return collection(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.books
  );
}

export function bookBracketBookRef(schoolId, bookId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.books,
    bookId
  );
}

export function bookBracketMatchupsCol(schoolId) {
  return collection(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.matchups
  );
}

export function bookBracketMatchupRef(schoolId, matchupId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.matchups,
    matchupId
  );
}

export function bookBracketVotesCol(schoolId) {
  return collection(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.votes
  );
}

export function bookBracketVoteRef(schoolId, voteId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.votes,
    voteId
  );
}

export function bookBracketUserProgressRef(schoolId, userId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.userProgress,
    userId
  );
}

export function bookBracketUserActionsCol(schoolId) {
  return collection(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.userActions
  );
}

export function bookBracketUserRewardRef(schoolId, rewardId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.userRewards,
    rewardId
  );
}

export function bookBracketAdminActionsCol(schoolId) {
  return collection(
    db,
    "readathonV2_schools",
    schoolId,
    BOOK_BRACKET_COLLECTIONS.adminActions
  );
}

/* --------------------------------------------------
   ID Builders
-------------------------------------------------- */

export function buildBookBracketVoteId({
  eventId = BOOK_BRACKET_EVENT_ID,
  matchupId,
  userId,
}) {
  return `${eventId}_${matchupId}_${userId}`;
}

export function buildBookBracketBookRewardId({
  eventId = BOOK_BRACKET_EVENT_ID,
  userId,
  bookId,
}) {
  return `${eventId}_${userId}_book_${bookId}`;
}

export function buildBookBracketVoteRewardId({
  eventId = BOOK_BRACKET_EVENT_ID,
  userId,
  matchupId,
}) {
  return `${eventId}_${userId}_vote_${matchupId}`;
}

export function buildBookBracketMatchupRewardId({
  eventId = BOOK_BRACKET_EVENT_ID,
  userId,
  matchupId,
}) {
  return `${eventId}_${userId}_matchup_${matchupId}`;
}

/* --------------------------------------------------
   Timestamp Helpers
-------------------------------------------------- */

export function buildCreatedUpdatedFields({
  createdBy = null,
  updatedBy = null,
} = {}) {
  return {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(createdBy ? { createdBy } : {}),
    ...(updatedBy ? { updatedBy } : {}),
  };
}

export function buildUpdatedFields({ updatedBy = null } = {}) {
  return {
    updatedAt: serverTimestamp(),
    ...(updatedBy ? { updatedBy } : {}),
  };
}

/* --------------------------------------------------
   Read Helpers
-------------------------------------------------- */

export async function fetchBookBracketEvent(
  schoolId,
  eventId = BOOK_BRACKET_EVENT_ID
) {
  const snap = await getDoc(bookBracketEventRef(schoolId, eventId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchBookBracketBooks(
  schoolId,
  eventId = BOOK_BRACKET_EVENT_ID
) {
  const qRef = query(
    bookBracketBooksCol(schoolId),
    where("eventId", "==", eventId),
    orderBy("regionKey", "asc"),
    orderBy("seed", "asc")
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchBookBracketBook(schoolId, bookId) {
  const snap = await getDoc(bookBracketBookRef(schoolId, bookId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchBookBracketMatchups(
  schoolId,
  eventId = BOOK_BRACKET_EVENT_ID
) {
  const qRef = query(
    bookBracketMatchupsCol(schoolId),
    where("eventId", "==", eventId),
    orderBy("roundNumber", "asc"),
    orderBy("sortOrder", "asc")
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchBookBracketMatchupsByRound(
  schoolId,
  roundNumber,
  eventId = BOOK_BRACKET_EVENT_ID
) {
  const qRef = query(
    bookBracketMatchupsCol(schoolId),
    where("eventId", "==", eventId),
    where("roundNumber", "==", Number(roundNumber)),
    orderBy("sortOrder", "asc")
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchBookBracketMatchup(schoolId, matchupId) {
  const snap = await getDoc(bookBracketMatchupRef(schoolId, matchupId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchBookBracketUserProgress(schoolId, userId) {
  const snap = await getDoc(bookBracketUserProgressRef(schoolId, userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchBookBracketVote({
  schoolId,
  matchupId,
  userId,
  eventId = BOOK_BRACKET_EVENT_ID,
}) {
  const voteId = buildBookBracketVoteId({ eventId, matchupId, userId });
  const snap = await getDoc(bookBracketVoteRef(schoolId, voteId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchBookBracketRewardFlag(schoolId, rewardId) {
  const snap = await getDoc(bookBracketUserRewardRef(schoolId, rewardId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchRecentBookBracketActions({
  schoolId,
  userId,
  eventId = BOOK_BRACKET_EVENT_ID,
  maxResults = 25,
}) {
  const qRef = query(
    bookBracketUserActionsCol(schoolId),
    where("eventId", "==", eventId),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* --------------------------------------------------
   Ensure / Init Helpers
-------------------------------------------------- */

export async function ensureBookBracketEvent(
  schoolId,
  {
    eventId = BOOK_BRACKET_EVENT_ID,
    actorUserId = null,
  } = {}
) {
  const ref = bookBracketEventRef(schoolId, eventId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  const starter = {
    ...BOOK_BRACKET_EVENT_SEED,
    ...buildCreatedUpdatedFields({
      createdBy: actorUserId,
      updatedBy: actorUserId,
    }),
  };

  await setDoc(ref, starter, { merge: true });
  return starter;
}

export async function ensureBookBracketUserProgress(
  schoolId,
  userId,
  {
    eventId = BOOK_BRACKET_EVENT_ID,
  } = {}
) {
  if (!schoolId) throw new Error("Missing schoolId.");
  if (!userId) throw new Error("Missing userId.");

  const ref = bookBracketUserProgressRef(schoolId, userId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const existing = snap.data() || {};
    let shouldPatch = false;

    const patch = {};

    if (!existing.eventId) {
      patch.eventId = eventId;
      shouldPatch = true;
    }

    if (!existing.schoolId) {
      patch.schoolId = schoolId;
      shouldPatch = true;
    }

    if (!existing.userId) {
      patch.userId = userId;
      shouldPatch = true;
    }

    if (!Array.isArray(existing.completedMatchupIds)) {
      patch.completedMatchupIds = [];
      shouldPatch = true;
    }

    if (!Array.isArray(existing.votedMatchupIds)) {
      patch.votedMatchupIds = [];
      shouldPatch = true;
    }

    if (!Array.isArray(existing.teacherUnlockedMatchupIds)) {
      patch.teacherUnlockedMatchupIds = [];
      shouldPatch = true;
    }

    if (!existing.bookStates || typeof existing.bookStates !== "object") {
      patch.bookStates = {};
      shouldPatch = true;
    }

    if (!existing.matchupStates || typeof existing.matchupStates !== "object") {
      patch.matchupStates = {};
      shouldPatch = true;
    }

    if (!existing.roundCompletion || typeof existing.roundCompletion !== "object") {
      patch.roundCompletion = {};
      shouldPatch = true;
    }

    if (typeof existing.totalRubiesAwarded !== "number") {
      patch.totalRubiesAwarded = Number(existing.totalRubiesAwarded || 0);
      shouldPatch = true;
    }

    if (shouldPatch) {
      patch.updatedAt = serverTimestamp();
      patch.lastActionAt = serverTimestamp();
      await setDoc(ref, patch, { merge: true });
      const patchedSnap = await getDoc(ref);
      return patchedSnap.exists() ? { id: patchedSnap.id, ...patchedSnap.data() } : null;
    }

    return { id: snap.id, ...existing };
  }

  const starter = {
    ...createEmptyUserProgress({ schoolId, userId }),
    eventId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActionAt: serverTimestamp(),
  };

  await setDoc(ref, starter, { merge: true });
  return starter;
}

export async function ensureBookBracketBookState({
  schoolId,
  userId,
  bookId,
}) {
  const progress = await ensureBookBracketUserProgress(schoolId, userId);
  const bookStates = progress?.bookStates || {};
  const existingState = bookStates?.[bookId];

  if (existingState && typeof existingState === "object") {
    return existingState;
  }

  const freshState = createEmptyBookState();

  await setDoc(
    bookBracketUserProgressRef(schoolId, userId),
    {
      [`bookStates.${bookId}`]: freshState,
      updatedAt: serverTimestamp(),
      lastActionAt: serverTimestamp(),
    },
    { merge: true }
  );

  return freshState;
}

export async function ensureBookBracketMatchupState({
  schoolId,
  userId,
  matchupId,
}) {
  const progress = await ensureBookBracketUserProgress(schoolId, userId);
  const matchupStates = progress?.matchupStates || {};
  const existingState = matchupStates?.[matchupId];

  if (existingState && typeof existingState === "object") {
    return existingState;
  }

  const freshState = createEmptyMatchupState();

  await setDoc(
    bookBracketUserProgressRef(schoolId, userId),
    {
      [`matchupStates.${matchupId}`]: freshState,
      updatedAt: serverTimestamp(),
      lastActionAt: serverTimestamp(),
    },
    { merge: true }
  );

  return freshState;
}

/* --------------------------------------------------
   Seed Helpers
-------------------------------------------------- */

export async function seedBookBracketEvent(
  schoolId,
  { actorUserId = null } = {}
) {
  return ensureBookBracketEvent(schoolId, {
    eventId: BOOK_BRACKET_EVENT_ID,
    actorUserId,
  });
}

export async function seedBookBracketBooks(
  schoolId,
  { actorUserId = null } = {}
) {
  const writes = BOOK_BRACKET_BOOKS.map((book) => {
    const ref = bookBracketBookRef(schoolId, book.bookId);

    return setDoc(
      ref,
      {
        eventId: BOOK_BRACKET_EVENT_ID,
        ...book,
        videoDurationSeconds: null,
        completionThresholdPercent: 0.9,
        allowManualTeacherUnlock: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(actorUserId ? { createdBy: actorUserId, updatedBy: actorUserId } : {}),
      },
      { merge: true }
    );
  });

  await Promise.all(writes);
  return true;
}

export async function seedBookBracketMatchups(
  schoolId,
  { actorUserId = null } = {}
) {
  const writes = BOOK_BRACKET_MATCHUPS.map((matchup) => {
    const ref = bookBracketMatchupRef(schoolId, matchup.matchupId);

    const isRound1 = matchup.roundNumber === 1;

    return setDoc(
      ref,
      {
        eventId: BOOK_BRACKET_EVENT_ID,
        ...matchup,
        status: isRound1
          ? BOOK_BRACKET_MATCHUP_STATUS.live
          : BOOK_BRACKET_MATCHUP_STATUS.locked,
        voteCountA: 0,
        voteCountB: 0,
        winnerBookId: null,
        winnerSource: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(actorUserId ? { createdBy: actorUserId, updatedBy: actorUserId } : {}),
      },
      { merge: true }
    );
  });

  await Promise.all(writes);
  return true;
}

export async function seedEntireBookBracket(
  schoolId,
  { actorUserId = null } = {}
) {
  await seedBookBracketEvent(schoolId, { actorUserId });
  await seedBookBracketBooks(schoolId, { actorUserId });
  await seedBookBracketMatchups(schoolId, { actorUserId });
  return true;
}

/* --------------------------------------------------
   Write Helpers: Progress / Actions
-------------------------------------------------- */

export async function touchBookBracketUserProgress(
  schoolId,
  userId,
  patch = {}
) {
  await setDoc(
    bookBracketUserProgressRef(schoolId, userId),
    {
      ...patch,
      updatedAt: serverTimestamp(),
      lastActionAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function logBookBracketUserAction({
  schoolId,
  userId,
  eventId = BOOK_BRACKET_EVENT_ID,
  matchupId = null,
  bookId = null,
  actionType,
  source = "app",
  metadata = {},
}) {
  if (!schoolId) throw new Error("Missing schoolId.");
  if (!userId) throw new Error("Missing userId.");
  if (!actionType) throw new Error("Missing actionType.");

  const ref = await addDoc(bookBracketUserActionsCol(schoolId), {
    eventId,
    userId,
    matchupId,
    bookId,
    actionType,
    source,
    metadata,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function saveBookBracketRewardFlag({
  schoolId,
  rewardId,
  rewardType,
  userId,
  matchupId = null,
  bookId = null,
  rubyAmount = 0,
  eventId = BOOK_BRACKET_EVENT_ID,
  granted = true,
  metadata = {},
}) {
  await setDoc(
    bookBracketUserRewardRef(schoolId, rewardId),
    {
      rewardId,
      rewardType,
      eventId,
      userId,
      matchupId,
      bookId,
      rubyAmount,
      granted,
      metadata,
      grantedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function saveBookBracketVote({
  schoolId,
  userId,
  matchupId,
  selectedBookId,
  selectedSide,
  eventId = BOOK_BRACKET_EVENT_ID,
  teacherOverrideUsed = false,
  voteSource = "student",
}) {
  const voteId = buildBookBracketVoteId({ eventId, matchupId, userId });

  await setDoc(
    bookBracketVoteRef(schoolId, voteId),
    {
      voteId,
      eventId,
      matchupId,
      userId,
      selectedBookId,
      selectedSide,
      voteSource,
      teacherOverrideUsed,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return voteId;
}

export async function logBookBracketAdminAction({
  schoolId,
  eventId = BOOK_BRACKET_EVENT_ID,
  actionType,
  performedBy,
  performedByRole = null,
  targetUserId = null,
  matchupId = null,
  metadata = {},
}) {
  if (!schoolId) throw new Error("Missing schoolId.");
  if (!actionType) throw new Error("Missing actionType.");

  const ref = await addDoc(bookBracketAdminActionsCol(schoolId), {
    eventId,
    actionType,
    performedBy,
    performedByRole,
    targetUserId,
    matchupId,
    metadata,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

/* --------------------------------------------------
   Derived Helpers
-------------------------------------------------- */

export function isBookCompleted(progress, bookId) {
  return !!progress?.bookStates?.[bookId]?.completed;
}

export function isMatchupTeacherUnlocked(progress, matchupId) {
  return !!progress?.matchupStates?.[matchupId]?.teacherUnlocked;
}

export function hasUserVotedMatchup(progress, matchupId) {
  return !!progress?.matchupStates?.[matchupId]?.voted;
}

export function isMatchupVoteUnlocked(progress, matchup) {
  if (!progress || !matchup) return false;

  const matchupState = progress.matchupStates?.[matchup.matchupId] || {};
  if (matchupState.teacherUnlocked) return true;

  const aDone = matchup.bookAId ? isBookCompleted(progress, matchup.bookAId) : false;
  const bDone = matchup.bookBId ? isBookCompleted(progress, matchup.bookBId) : false;

  return !!(aDone && bDone);
}

export function isMatchupCompleted(progress, matchupId) {
  return !!progress?.matchupStates?.[matchupId]?.matchupCompleted;
}

export function getCompletedMatchupCountForRound(progress, roundMatchups = []) {
  if (!progress || !Array.isArray(roundMatchups)) return 0;

  return roundMatchups.filter((m) => {
    return !!progress?.matchupStates?.[m.matchupId]?.matchupCompleted;
  }).length;
}

export function getWinnerFromMatchup(matchupDoc) {
  if (!matchupDoc) return null;
  return matchupDoc.winnerBookId || null;
}

export function buildNextRoundBooksFromWinners(matchups = []) {
  const byId = new Map(matchups.map((m) => [m.matchupId, m]));
  const result = [];

  for (const matchup of matchups) {
    if (!matchup.sourceMatchupAId && !matchup.sourceMatchupBId) continue;

    const sourceA = matchup.sourceMatchupAId ? byId.get(matchup.sourceMatchupAId) : null;
    const sourceB = matchup.sourceMatchupBId ? byId.get(matchup.sourceMatchupBId) : null;

    result.push({
      matchupId: matchup.matchupId,
      bookAId: sourceA?.winnerBookId || null,
      bookBId: sourceB?.winnerBookId || null,
    });
  }

  return result;
}

/* --------------------------------------------------
   Convenience Init
-------------------------------------------------- */

export async function initializeBookBracketForCurrentUser() {
  const schoolId = getCurrentBookBracketSchoolId();
  const userId = getCurrentBookBracketUserId();

  if (!schoolId) throw new Error("Missing schoolId.");
  if (!userId) throw new Error("Missing userId.");

  await ensureBookBracketEvent(schoolId);
  await ensureBookBracketUserProgress(schoolId, userId);

  return {
    schoolId,
    userId,
    eventId: BOOK_BRACKET_EVENT_ID,
  };
}