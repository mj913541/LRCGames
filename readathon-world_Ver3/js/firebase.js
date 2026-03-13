// /readathon-world_Ver3/js/firebase.js
// Firebase v9+ (modular) via CDN. Shared app-wide Firebase + Monarch helpers.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

console.log("✅ LOADED firebase.js: V3 ./firebase.js");

/* --------------------------------------------------
   Firebase Config
-------------------------------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyDpXoneclJAl5kFr7doJmSlgqoN6teGWzI",
  authDomain: "lrcquest-3039e.web.app",
  projectId: "lrcquest-3039e",
  storageBucket: "lrcquest-3039e.firebasestorage.app",
  messagingSenderId: "72063656342",
  appId: "1:72063656342:web:e355f9119293b3d953bdb7",
  measurementId: "G-VRKVK0QWY2",
};

export const DEFAULT_SCHOOL_ID = "308_longbeach_elementary";

/* --------------------------------------------------
   Initialize Firebase
-------------------------------------------------- */

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("⚠️ setPersistence failed:", err);
});

export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

/* --------------------------------------------------
   Callable Cloud Functions
-------------------------------------------------- */

export const fnVerifyPin = httpsCallable(functions, "verifyPin");
export const fnSubmitTransaction = httpsCallable(functions, "submitTransaction");
export const fnAwardHomeroom = httpsCallable(functions, "awardHomeroom");
export const fnApprovePendingMinutes = httpsCallable(functions, "approvePendingMinutes");
export const fnBuyAvatarItem = httpsCallable(functions, "buyAvatarItem");
export const fnRedeemPrizeCredit = httpsCallable(functions, "redeemPrizeCredit");

/* --------------------------------------------------
   School ID Helpers
-------------------------------------------------- */

export function getSchoolId() {
  return localStorage.getItem("readathonV2_schoolId") || DEFAULT_SCHOOL_ID;
}

export function setSchoolId(schoolId) {
  localStorage.setItem("readathonV2_schoolId", schoolId);
}

/* --------------------------------------------------
   Auth Helpers
-------------------------------------------------- */

export async function signInWithToken(customToken) {
  const cred = await signInWithCustomToken(auth, customToken);
  await cred.user.getIdToken(true);
  return cred;
}

export async function signOutUser() {
  await signOut(auth);
}

export function waitForAuthReady() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function getIdTokenClaims(forceRefresh = false) {
  const u = auth.currentUser;
  if (!u) return null;
  const tokenResult = await u.getIdTokenResult(forceRefresh);
  return tokenResult?.claims || null;
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function requireSignedIn({
  redirectTo = "../index.html",
} = {}) {
  await waitForAuthReady();

  if (!auth.currentUser) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

export async function requireRole(
  allowedRoles = [],
  { redirectTo = "../html/index.html" } = {}
) {
  const ok = await requireSignedIn({ redirectTo });
  if (!ok) return false;

  let claims = await getIdTokenClaims(false);
  if (!claims?.role) claims = await getIdTokenClaims(true);

  if (!claims?.role || !allowedRoles.includes(claims.role)) {
    window.location.href = redirectTo;
    return false;
  }

  return true;
}

/* --------------------------------------------------
   Firestore Path Helpers
-------------------------------------------------- */

export function schoolRoot(schoolId) {
  return `readathonV2_schools/${schoolId}`;
}

export function userDocRef(schoolId, userId) {
  return doc(db, `${schoolRoot(schoolId)}/users/${userId}`);
}

export function userSummaryRef(schoolId, userId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    "users",
    userId,
    "readathon",
    "summary"
  );
}

export function publicStudentsCol(schoolId) {
  return collection(db, `${schoolRoot(schoolId)}/publicStudents`);
}

export function homeroomsCol(schoolId) {
  return collection(db, `${schoolRoot(schoolId)}/homerooms`);
}

export function transactionsCol(schoolId) {
  return collection(db, `${schoolRoot(schoolId)}/transactions`);
}

/* --------------------------------------------------
   Read Helpers
-------------------------------------------------- */

export async function fetchActivePublicStudentsByGrade(schoolId, gradeNum) {
  const qRef = query(
    publicStudentsCol(schoolId),
    where("active", "==", true),
    where("grade", "==", gradeNum),
    orderBy("homeroomId"),
    orderBy("displayName"),
    limit(5000)
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchActiveHomeroomsByGrade(schoolId, gradeNum) {
  const qRef = query(
    homeroomsCol(schoolId),
    where("active", "==", true),
    where("grade", "==", gradeNum),
    orderBy("homeroomId"),
    limit(500)
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchActivePublicStudentsByHouse(schoolId, houseId) {
  const pub = collection(db, `readathonV2_schools/${schoolId}/publicStudents`);
  const qy = query(
    pub,
    where("active", "==", true),
    where("houseId", "==", String(houseId || "").trim())
  );

  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchUserSummary(schoolId, userId) {
  const ref = userSummaryRef(schoolId, userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/* --------------------------------------------------
   MONARCH QUEST CONSTANTS
-------------------------------------------------- */

export const MONARCH_EVENT_ID = "monarch_2026";

export const MONARCH_TASK_TYPES = {
  LISTEN: "LISTEN",
  MATCHUP: "MATCHUP",
  VOTE: "VOTE",
  BONUS: "BONUS",
};

export const MONARCH_TASK_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
};

export const MONARCH_DISPLAY_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE: "COMPLETE",
};

/* --------------------------------------------------
   MONARCH SESSION HELPERS
-------------------------------------------------- */

export function getCurrentUser() {
  return auth.currentUser || null;
}

export function getCurrentUserId() {
  return auth.currentUser?.uid || null;
}

export function getCurrentSchoolId() {
  return getSchoolId();
}

export async function requireMonarchSession({
  redirectTo = "../html/index.html",
  allowedRoles = ["student", "staff", "admin"],
} = {}) {
  await waitForAuthReady();

  const user = auth.currentUser;
  const schoolId = getCurrentSchoolId();

  if (!schoolId) {
    throw new Error("Missing schoolId.");
  }

  if (!user) {
    window.location.href = redirectTo;
    throw new Error("No signed-in user found.");
  }

  let claims = await getIdTokenClaims(false);
  if (!claims?.role) {
    claims = await getIdTokenClaims(true);
  }

  const role = claims?.role || null;

  if (role && allowedRoles.length && !allowedRoles.includes(role)) {
    window.location.href = redirectTo;
    throw new Error("You do not have access to Monarch Quest.");
  }

  return {
    user,
    userId: user.uid,
    schoolId,
    claims,
    role,
  };
}

/* --------------------------------------------------
   MONARCH PATH HELPERS
-------------------------------------------------- */

export function monarchEventPath(schoolId) {
  return `${schoolRoot(schoolId)}/monarchQuest/${MONARCH_EVENT_ID}`;
}

export function monarchRoot(schoolId) {
  return monarchEventPath(schoolId);
}

export function monarchConfigPath(schoolId) {
  return monarchEventPath(schoolId);
}

export function monarchNomineesPath(schoolId) {
  return `${monarchEventPath(schoolId)}/nominees`;
}

export function monarchNomineePath(schoolId, nomineeId) {
  return `${monarchEventPath(schoolId)}/nominees/${nomineeId}`;
}

export function monarchTasksPath(schoolId) {
  return `${monarchEventPath(schoolId)}/tasks`;
}

export function monarchTaskPath(schoolId, taskId) {
  return `${monarchEventPath(schoolId)}/tasks/${taskId}`;
}

export function monarchRewardsPath(schoolId) {
  return `${monarchEventPath(schoolId)}/rewards`;
}

export function monarchRewardPath(schoolId, rewardKey) {
  return `${monarchEventPath(schoolId)}/rewards/${rewardKey}`;
}

/* --------------------------------------------------
   MONARCH DEFAULT DATA BUILDERS
-------------------------------------------------- */

export function buildDefaultMonarchSummary() {
  return {
    eventId: MONARCH_EVENT_ID,
    startedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    displayStatus: MONARCH_DISPLAY_STATUS.NOT_STARTED,
    completedTaskCount: 0,
    requiredCompletedTaskCount: 0,
    completionPercent: 0,
    completedTaskIds: [],
    unlockedTaskIds: ["task_001"],
    rewardKeysEarned: [],
    voteCount: 0,
    questCompleted: false,
    questCompletedAt: null,
  };
}

export function buildDefaultTaskProgress(taskId, type = MONARCH_TASK_TYPES.LISTEN, nomineeIds = []) {
  const cleanedNomineeIds = Array.isArray(nomineeIds) ? nomineeIds.filter(Boolean) : [];

  const videoCompletionMap = {};
  for (const nomineeId of cleanedNomineeIds) {
    videoCompletionMap[nomineeId] = false;
  }

  return {
    taskId,
    type,
    nomineeIds: cleanedNomineeIds,
    videoCompletionMap,
    allVideosCompleted: false,
    voteUnlocked: false,
    voteSubmitted: false,
    selectedNomineeId: null,
    status: MONARCH_TASK_STATUS.NOT_STARTED,
    completedAt: null,
    updatedAt: serverTimestamp(),
  };
}

/* --------------------------------------------------
   MONARCH READ: SCHOOL-LEVEL DATA
-------------------------------------------------- */

export async function fetchMonarchConfig(schoolId) {
  const ref = doc(db, monarchConfigPath(schoolId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchMonarchNominees(schoolId) {
  const qRef = query(
    collection(db, monarchNomineesPath(schoolId)),
    where("active", "==", true),
    orderBy("taskOrder", "asc")
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchMonarchTasks(schoolId) {
  const qRef = query(
    collection(db, monarchTasksPath(schoolId)),
    where("active", "==", true),
    orderBy("taskOrder", "asc")
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchMonarchRewards(schoolId) {
  const qRef = query(
    collection(db, monarchRewardsPath(schoolId)),
    where("active", "==", true)
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchSingleMonarchTask(schoolId, taskId) {
  const ref = doc(db, monarchTaskPath(schoolId, taskId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* --------------------------------------------------
   MONARCH READ: USER DATA
-------------------------------------------------- */

export async function fetchUserMonarchSummary(schoolId, userId) {
  const ref = doc(db, userMonarchSummaryPath(schoolId, userId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function ensureUserTaskProgress(
  schoolId,
  userId,
  taskId,
  type = MONARCH_TASK_TYPES.LISTEN,
  nomineeIds = []
) {
  const ref = doc(db, userMonarchTaskProgressPath(schoolId, userId, taskId));
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  const starter = buildDefaultTaskProgress(taskId, type, nomineeIds);
  await setDoc(ref, starter, { merge: true });
  return starter;
}

export async function fetchUserTaskProgress(schoolId, userId, taskId) {
  const ref = doc(db, userMonarchTaskProgressPath(schoolId, userId, taskId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchUserVote(schoolId, userId, matchupId) {
  const ref = doc(db, userMonarchVotePath(schoolId, userId, matchupId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchUserRewardFlag(schoolId, userId, rewardKey) {
  const ref = doc(db, userMonarchRewardFlagPath(schoolId, userId, rewardKey));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* --------------------------------------------------
   MONARCH WRITE: USER SUMMARY
-------------------------------------------------- */

export async function touchUserMonarchSummary(schoolId, userId, patch = {}) {
  const ref = doc(db, userMonarchSummaryPath(schoolId, userId));
  await setDoc(
    ref,
    {
      ...patch,
      lastActiveAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setUserMonarchStarted(schoolId, userId) {
  const ref = doc(db, userMonarchSummaryPath(schoolId, userId));
  await setDoc(
    ref,
    {
      eventId: MONARCH_EVENT_ID,
      startedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      displayStatus: MONARCH_DISPLAY_STATUS.IN_PROGRESS,
    },
    { merge: true }
  );
}

/* --------------------------------------------------
   MONARCH WRITE: TASK PROGRESS
-------------------------------------------------- */

export async function markTaskListenOpened(
  schoolId,
  userId,
  taskId,
  type = MONARCH_TASK_TYPES.LISTEN
) {
  const ref = doc(db, userMonarchTaskProgressPath(schoolId, userId, taskId));
  await setDoc(
    ref,
    {
      taskId,
      type,
      status: MONARCH_TASK_STATUS.IN_PROGRESS,
      listenOpened: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function markTaskCompleted({
  schoolId,
  userId,
  taskId,
  type = MONARCH_TASK_TYPES.MATCHUP,
  nomineeIds = [],
  selectedNomineeId = null,
  voteSubmitted = false,
}) {
  const cleanedNomineeIds = Array.isArray(nomineeIds) ? nomineeIds.filter(Boolean) : [];
  const completedMap = {};

  for (const nomineeId of cleanedNomineeIds) {
    completedMap[nomineeId] = true;
  }

  const ref = doc(db, userMonarchTaskProgressPath(schoolId, userId, taskId));

  await setDoc(
    ref,
    {
      taskId,
      type,
      nomineeIds: cleanedNomineeIds,
      videoCompletionMap: completedMap,
      allVideosCompleted: true,
      voteUnlocked: true,
      voteSubmitted,
      selectedNomineeId,
      status: MONARCH_TASK_STATUS.COMPLETED,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function touchMonarchTaskProgress({
  schoolId,
  userId,
  taskId,
  type = MONARCH_TASK_TYPES.LISTEN,
  patch = {},
}) {
  const ref = doc(db, userMonarchTaskProgressPath(schoolId, userId, taskId));

  await setDoc(
    ref,
    {
      taskId,
      type,
      updatedAt: serverTimestamp(),
      ...patch,
    },
    { merge: true }
  );
}
export async function markNomineeVideoCompleted({
  schoolId,
  userId,
  taskId,
  type = MONARCH_TASK_TYPES.MATCHUP,
  nomineeIds = [],
  completedNomineeId,
}) {
  const ref = doc(db, userMonarchTaskProgressPath(schoolId, userId, taskId));
  const snap = await getDoc(ref);

  const existing = snap.exists()
    ? snap.data()
    : buildDefaultTaskProgress(taskId, type, nomineeIds);

  const cleanedNomineeIds = Array.isArray(nomineeIds) ? nomineeIds.filter(Boolean) : [];
  const currentMap =
    existing && typeof existing.videoCompletionMap === "object" && existing.videoCompletionMap
      ? { ...existing.videoCompletionMap }
      : {};

  for (const nomineeId of cleanedNomineeIds) {
    if (typeof currentMap[nomineeId] !== "boolean") {
      currentMap[nomineeId] = false;
    }
  }

  if (completedNomineeId && cleanedNomineeIds.includes(completedNomineeId)) {
    currentMap[completedNomineeId] = true;
  }

  const allVideosCompleted =
    cleanedNomineeIds.length >= 2 &&
    cleanedNomineeIds.every((nomineeId) => currentMap[nomineeId] === true);

  const nextStatus = allVideosCompleted
    ? MONARCH_TASK_STATUS.IN_PROGRESS
    : existing?.status === MONARCH_TASK_STATUS.COMPLETED
      ? MONARCH_TASK_STATUS.COMPLETED
      : MONARCH_TASK_STATUS.IN_PROGRESS;

  await setDoc(
    ref,
    {
      taskId,
      type,
      nomineeIds: cleanedNomineeIds,
      videoCompletionMap: currentMap,
      allVideosCompleted,
      voteUnlocked: allVideosCompleted,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
/* --------------------------------------------------
   MONARCH WRITE: VOTES
-------------------------------------------------- */

export async function saveUserVote({
  schoolId,
  userId,
  matchupId,
  taskId,
  selectedNomineeId,
}) {
  const ref = doc(db, userMonarchVotePath(schoolId, userId, matchupId));

  await setDoc(
    ref,
    {
      matchupId,
      taskId,
      selectedNomineeId,
      submittedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* --------------------------------------------------
   MONARCH WRITE: REWARD FLAGS
-------------------------------------------------- */

export async function saveRewardFlag({
  schoolId,
  userId,
  rewardKey,
  claimed = false,
  claimType = "AUTO",
  notes = "",
}) {
  const ref = doc(db, userMonarchRewardFlagPath(schoolId, userId, rewardKey));

  await setDoc(
    ref,
    {
      rewardKey,
      earnedAt: serverTimestamp(),
      claimed,
      claimType,
      notes,
    },
    { merge: true }
  );
}

/* --------------------------------------------------
   MONARCH FRONTEND LOGIC HELPERS
-------------------------------------------------- */

export function isTaskUnlocked(task, completedTaskIds = []) {
  const unlockAfterTaskIds = task?.unlockAfterTaskIds || [];
  if (!unlockAfterTaskIds.length) return true;
  return unlockAfterTaskIds.every((id) => completedTaskIds.includes(id));
}

export function calculateCompletionPercent(requiredCompletedTaskCount, requiredTaskCount) {
  if (!requiredTaskCount || requiredTaskCount <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((requiredCompletedTaskCount / requiredTaskCount) * 100))
  );
}

export function getEarnedRewardKeys(rewards = [], requiredCompletedTaskCount = 0) {
  return rewards
    .filter((reward) => {
      if (!reward.active) return false;
      return requiredCompletedTaskCount >= (reward.milestoneCount || 0);
    })
    .map((reward) => reward.rewardKey);
}

export function getNextUnlockedTaskIds(tasks = [], completedTaskIds = []) {
  return tasks
    .filter((task) => isTaskUnlocked(task, completedTaskIds))
    .map((task) => task.taskId);
}

export function buildUpdatedSummary({
  currentSummary,
  tasks,
  rewards,
  justCompletedTaskId,
  requiredTaskCount,
}) {
  const prevCompletedTaskIds = Array.isArray(currentSummary?.completedTaskIds)
    ? currentSummary.completedTaskIds
    : [];

  const completedTaskIds = prevCompletedTaskIds.includes(justCompletedTaskId)
    ? prevCompletedTaskIds
    : [...prevCompletedTaskIds, justCompletedTaskId];

  const requiredTaskMap = new Map(tasks.map((task) => [task.taskId, task]));
  const requiredCompletedTaskCount = completedTaskIds.filter((taskId) => {
    const task = requiredTaskMap.get(taskId);
    return !!task?.required;
  }).length;

  const completionPercent = calculateCompletionPercent(
    requiredCompletedTaskCount,
    requiredTaskCount
  );

  const unlockedTaskIds = getNextUnlockedTaskIds(tasks, completedTaskIds);
  const rewardKeysEarned = getEarnedRewardKeys(rewards, requiredCompletedTaskCount);
  const questCompleted = requiredCompletedTaskCount >= requiredTaskCount;

  return {
    eventId: MONARCH_EVENT_ID,
    displayStatus: questCompleted
      ? MONARCH_DISPLAY_STATUS.COMPLETE
      : MONARCH_DISPLAY_STATUS.IN_PROGRESS,
    completedTaskCount: completedTaskIds.length,
    requiredCompletedTaskCount,
    completionPercent,
    completedTaskIds,
    unlockedTaskIds,
    rewardKeysEarned,
    questCompleted,
    questCompletedAt: questCompleted ? serverTimestamp() : null,
    lastActiveAt: serverTimestamp(),
  };
}

/* --------------------------------------------------
   MONARCH PAGE HEADER HELPER
-------------------------------------------------- */

export function applyMonarchPageHeader({
  kicker = "Readathon World Special Event",
  title = "Monarch Quest 2026",
  subtitle = "Listen, explore, vote, and unlock special rewards!",
} = {}) {
  const kickerEl = document.getElementById("pageKicker");
  const titleEl = document.getElementById("pageTitle");
  const subtitleEl = document.getElementById("pageSubtitle");

  if (kickerEl) kickerEl.textContent = kicker;
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
}