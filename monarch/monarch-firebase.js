// /js/monarch/monarch-firebase.js
// Simplified frontend-first Monarch Quest helpers

import { db, auth } from "../firebase.js";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================================
   CONSTANTS
========================================================= */

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

/* =========================================================
   BASIC SESSION HELPERS
========================================================= */

export function getCurrentUser() {
  return auth.currentUser || null;
}

export function getCurrentUserId() {
  return auth.currentUser?.uid || null;
}

import { getSchoolId } from "../firebase.js";

export function getCurrentSchoolId() {
  return getSchoolId();
}

/* =========================================================
   FIRESTORE PATH HELPERS
========================================================= */

export function schoolRoot(schoolId) {
  return `readathonV2_schools/${schoolId}`;
}

export function monarchRoot(schoolId) {
  return `${schoolRoot(schoolId)}/monarchQuest`;
}

export function monarchConfigPath(schoolId) {
  return `${monarchRoot(schoolId)}/config`;
}

export function monarchNomineesPath(schoolId) {
  return `${monarchRoot(schoolId)}/nominees`;
}

export function monarchNomineePath(schoolId, nomineeId) {
  return `${monarchRoot(schoolId)}/nominees/${nomineeId}`;
}

export function monarchTasksPath(schoolId) {
  return `${monarchRoot(schoolId)}/tasks`;
}

export function monarchTaskPath(schoolId, taskId) {
  return `${monarchRoot(schoolId)}/tasks/${taskId}`;
}

export function monarchRewardsPath(schoolId) {
  return `${monarchRoot(schoolId)}/rewards`;
}

export function monarchRewardPath(schoolId, rewardKey) {
  return `${monarchRoot(schoolId)}/rewards/${rewardKey}`;
}

export function userMonarchRoot(schoolId, userId) {
  return `${schoolRoot(schoolId)}/users/${userId}/monarchQuest`;
}

export function userMonarchSummaryPath(schoolId, userId) {
  return `${userMonarchRoot(schoolId, userId)}/summary`;
}

export function userMonarchTaskProgressPath(schoolId, userId, taskId) {
  return `${userMonarchRoot(schoolId, userId)}/taskProgress/${taskId}`;
}

export function userMonarchVotesPath(schoolId, userId) {
  return `${userMonarchRoot(schoolId, userId)}/votes`;
}

export function userMonarchVotePath(schoolId, userId, matchupId) {
  return `${userMonarchRoot(schoolId, userId)}/votes/${matchupId}`;
}

export function userMonarchRewardFlagsPath(schoolId, userId) {
  return `${userMonarchRoot(schoolId, userId)}/rewardFlags`;
}

export function userMonarchRewardFlagPath(schoolId, userId, rewardKey) {
  return `${userMonarchRoot(schoolId, userId)}/rewardFlags/${rewardKey}`;
}

/* =========================================================
   DEFAULT DATA BUILDERS
========================================================= */

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

export function buildDefaultTaskProgress(taskId, type = MONARCH_TASK_TYPES.LISTEN) {
  return {
    taskId,
    type,
    status: MONARCH_TASK_STATUS.NOT_STARTED,
    listenOpened: false,
    listenCompleted: false,
    voteSubmitted: false,
    selectedNomineeId: null,
    completedAt: null,
    updatedAt: serverTimestamp(),
  };
}

/* =========================================================
   READ: SCHOOL-LEVEL MONARCH DATA
========================================================= */

export async function fetchMonarchConfig(schoolId) {
  const ref = doc(db, monarchConfigPath(schoolId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchMonarchNominees(schoolId) {
  const q = query(
    collection(db, monarchNomineesPath(schoolId)),
    where("active", "==", true),
    orderBy("taskOrder", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchMonarchTasks(schoolId) {
  const q = query(
    collection(db, monarchTasksPath(schoolId)),
    where("active", "==", true),
    orderBy("taskOrder", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchMonarchRewards(schoolId) {
  const q = query(
    collection(db, monarchRewardsPath(schoolId)),
    where("active", "==", true)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchSingleMonarchTask(schoolId, taskId) {
  const ref = doc(db, monarchTaskPath(schoolId, taskId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* =========================================================
   READ: USER MONARCH DATA
========================================================= */

export async function fetchUserMonarchSummary(schoolId, userId) {
  const ref = doc(db, userMonarchSummaryPath(schoolId, userId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function ensureUserMonarchSummary(schoolId, userId) {
  const ref = doc(db, userMonarchSummaryPath(schoolId, userId));
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  const starter = buildDefaultMonarchSummary();
  await setDoc(ref, starter, { merge: true });
  return starter;
}

export async function fetchUserTaskProgress(schoolId, userId, taskId) {
  const ref = doc(db, userMonarchTaskProgressPath(schoolId, userId, taskId));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function ensureUserTaskProgress(schoolId, userId, taskId, type = MONARCH_TASK_TYPES.LISTEN) {
  const ref = doc(db, userMonarchTaskProgressPath(schoolId, userId, taskId));
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  const starter = buildDefaultTaskProgress(taskId, type);
  await setDoc(ref, starter, { merge: true });
  return starter;
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

/* =========================================================
   WRITE: USER MONARCH SUMMARY
========================================================= */

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

/* =========================================================
   WRITE: TASK PROGRESS
========================================================= */

export async function markTaskListenOpened(schoolId, userId, taskId, type = MONARCH_TASK_TYPES.LISTEN) {
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
  type = MONARCH_TASK_TYPES.LISTEN,
  selectedNomineeId = null,
  voteSubmitted = false,
}) {
  const ref = doc(db, userMonarchTaskProgressPath(schoolId, userId, taskId));

  await setDoc(
    ref,
    {
      taskId,
      type,
      status: MONARCH_TASK_STATUS.COMPLETED,
      listenOpened: true,
      listenCompleted: true,
      voteSubmitted,
      selectedNomineeId,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* =========================================================
   WRITE: VOTES
========================================================= */

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

/* =========================================================
   WRITE: REWARD FLAGS
========================================================= */

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

/* =========================================================
   FRONTEND LOGIC HELPERS
========================================================= */

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

/* =========================================================
   PAGE HEADER HELPER
========================================================= */

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