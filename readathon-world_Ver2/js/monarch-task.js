// /readathon-world_Ver3/js/monarch/monarch-task.js

import {
  MONARCH_TASK_TYPES,
  getCurrentUserId,
  getCurrentSchoolId,
  fetchMonarchConfig,
  fetchMonarchTasks,
  fetchMonarchRewards,
  fetchMonarchNominees,
  fetchUserMonarchSummary,
  ensureUserMonarchSummary,
  fetchUserTaskProgress,
  ensureUserTaskProgress,
  fetchUserVote,
  markTaskListenOpened,
  markTaskCompleted,
  saveUserVote,
  saveRewardFlag,
  touchUserMonarchSummary,
  buildUpdatedSummary,
  applyMonarchPageHeader
} from "./monarch-firebase.js";

/* =========================================================
   ELEMENTS
========================================================= */

const els = {
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),

  backBtn: document.getElementById("mqBackToBoardBtn"),
  taskStatusPill: document.getElementById("mqTaskStatusPill"),

  taskTitle: document.getElementById("mqTaskTitle"),
  taskSubtitle: document.getElementById("mqTaskSubtitle"),
  taskTypeLabel: document.getElementById("mqTaskTypeLabel"),
  taskOrderLabel: document.getElementById("mqTaskOrderLabel"),
  taskRewardPreviewLabel: document.getElementById("mqTaskRewardPreviewLabel"),

  nomineeList: document.getElementById("mqNomineeList"),

  votePanel: document.getElementById("mqVotePanel"),
  voteOptions: document.getElementById("mqVoteOptions"),
  voteSavedNotice: document.getElementById("mqVoteSavedNotice"),

  markOpenedBtn: document.getElementById("mqMarkOpenedBtn"),
  completeTaskBtn: document.getElementById("mqCompleteTaskBtn"),
  completeHelpText: document.getElementById("mqCompleteHelpText"),
  taskMessage: document.getElementById("mqTaskMessage"),

  checklistOpened: document.getElementById("mqChecklistOpened"),
  checklistVoted: document.getElementById("mqChecklistVoted"),
  checklistCompleted: document.getElementById("mqChecklistCompleted"),

  nextRewardTitle: document.getElementById("mqNextRewardTitle"),
  nextRewardSubtitle: document.getElementById("mqNextRewardSubtitle"),

  celebrationBanner: document.getElementById("mqTaskCelebrationBanner"),
  celebrationTitle: document.getElementById("mqTaskCelebrationTitle"),
  celebrationText: document.getElementById("mqTaskCelebrationText"),
};

/* =========================================================
   STATE
========================================================= */

const state = {
  schoolId: null,
  userId: null,
  taskId: null,

  config: null,
  tasks: [],
  rewards: [],
  nominees: [],
  task: null,
  summary: null,
  taskProgress: null,
  vote: null,
};

/* =========================================================
   INIT
========================================================= */

init();

async function init() {
  try {
    state.schoolId = getCurrentSchoolId();
    state.userId = getCurrentUserId();
    state.taskId = getTaskIdFromUrl();

    if (!state.schoolId) throw new Error("Missing schoolId.");
    if (!state.userId) throw new Error("No signed-in user found.");
    if (!state.taskId) throw new Error("Missing taskId.");

    await loadAllData();
    renderPage();
    wireEvents();
  } catch (err) {
    console.error("Monarch Task init error:", err);
    renderFatalError(err.message || "Unable to load this Monarch task.");
  }
}

async function loadAllData() {
  const [config, tasks, rewards, nominees] = await Promise.all([
    fetchMonarchConfig(state.schoolId),
    fetchMonarchTasks(state.schoolId),
    fetchMonarchRewards(state.schoolId),
    fetchMonarchNominees(state.schoolId),
  ]);

  state.config = config || {};
  state.tasks = Array.isArray(tasks) ? tasks : [];
  state.rewards = normalizeRewards(Array.isArray(rewards) ? rewards : []);
  state.nominees = Array.isArray(nominees) ? nominees : [];

  state.task = state.tasks.find((task) => task.taskId === state.taskId);
  if (!state.task) {
    throw new Error("This Monarch task could not be found.");
  }

  const existingSummary = await fetchUserMonarchSummary(state.schoolId, state.userId);
  state.summary = existingSummary || await ensureUserMonarchSummary(state.schoolId, state.userId);

  const existingTaskProgress = await fetchUserTaskProgress(state.schoolId, state.userId, state.taskId);
  state.taskProgress = existingTaskProgress || await ensureUserTaskProgress(
    state.schoolId,
    state.userId,
    state.taskId,
    state.task.type || MONARCH_TASK_TYPES.LISTEN
  );

  if (state.task.matchupId) {
    state.vote = await fetchUserVote(state.schoolId, state.userId, state.task.matchupId);
  }
}

/* =========================================================
   RENDER
========================================================= */

function renderPage() {
  applyMonarchPageHeader({
    kicker: "Readathon World Special Event",
    title: state.task?.title || "Monarch Quest Task",
    subtitle: state.task?.subtitle || "Complete this quest step to keep moving forward.",
  });

  renderTaskIntro();
  renderNominees();
  renderVoteSection();
  renderChecklist();
  renderNextReward();
  renderTaskButtons();
  renderCelebrationBanner();
}

function renderTaskIntro() {
  els.taskTitle.textContent = state.task?.title || "Monarch Task";
  els.taskSubtitle.textContent =
    state.task?.subtitle || "Complete this task to keep moving forward in Monarch Quest.";

  els.taskTypeLabel.textContent = formatTaskType(state.task?.type || "TASK");
  els.taskOrderLabel.textContent = String(state.task?.taskOrder || "—");
  els.taskRewardPreviewLabel.textContent = state.task?.rewardPreviewKey || "—";

  els.taskStatusPill.textContent = formatTaskStatus(getTaskProgressStatus());
}

/* =========================================================
   NOMINEES
========================================================= */

function renderNominees() {
  els.nomineeList.innerHTML = "";

  const nomineeIds = Array.isArray(state.task?.nomineeIds) ? state.task.nomineeIds : [];
  const nominees = nomineeIds
    .map((id) => state.nominees.find((nominee) => nominee.nomineeId === id))
    .filter(Boolean);

  if (!nominees.length) {
    els.nomineeList.innerHTML = `
      <div class="monarch-empty-state">
        <p>No book details were found for this task.</p>
      </div>
    `;
    return;
  }

  for (const nominee of nominees) {
    const card = document.createElement("article");
    card.className = "monarch-nominee-card";

    const coverImageUrl = nominee.coverImageUrl || "";
    const listenUrl = nominee.listenUrl || "#";

    card.innerHTML = `
      <img
        class="monarch-nominee-card__cover"
        src="${escapeHtml(coverImageUrl)}"
        alt="${escapeHtml(nominee.title || "Monarch nominee cover")}"
      />

      <div class="monarch-nominee-card__content">
        <h3 class="monarch-nominee-card__title">${escapeHtml(nominee.title || "Book Title")}</h3>
        <p class="monarch-nominee-card__author">by ${escapeHtml(nominee.author || "Unknown Author")}</p>
        <p class="monarch-nominee-card__desc">${escapeHtml(nominee.description || "Explore this Monarch nominee.")}</p>

        <div class="monarch-nominee-card__actions">
          <a
            class="monarch-btn monarch-btn--secondary"
            href="${escapeHtml(listenUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            data-listen-link="true"
          >
            Open Read-Aloud
          </a>
        </div>
      </div>
    `;

    els.nomineeList.appendChild(card);
  }
}

/* =========================================================
   VOTE SECTION
========================================================= */

function renderVoteSection() {
  const needsVote = !!state.task?.allowVote || state.task?.type === MONARCH_TASK_TYPES.MATCHUP;

  if (!needsVote) {
    els.votePanel.hidden = true;
    return;
  }

  els.votePanel.hidden = false;
  els.voteOptions.innerHTML = "";

  const nomineeIds = Array.isArray(state.task?.nomineeIds) ? state.task.nomineeIds : [];
  const nominees = nomineeIds
    .map((id) => state.nominees.find((nominee) => nominee.nomineeId === id))
    .filter(Boolean);

  for (const nominee of nominees) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "monarch-btn monarch-btn--vote";
    btn.dataset.nomineeId = nominee.nomineeId;
    btn.innerHTML = `
      <strong>${escapeHtml(nominee.title || "Nominee")}</strong><br>
      <span>Vote for this book</span>
    `;

    if (state.vote?.selectedNomineeId === nominee.nomineeId) {
      btn.classList.add("is-selected");
    }

    btn.addEventListener("click", async () => {
      await handleVoteSelection(nominee.nomineeId);
    });

    els.voteOptions.appendChild(btn);
  }

  els.voteSavedNotice.hidden = !state.vote;
}

/* =========================================================
   CHECKLIST / SIDEBAR
========================================================= */

function renderChecklist() {
  const opened = !!state.taskProgress?.listenOpened;
  const voted = !!state.taskProgress?.voteSubmitted;
  const completed = getTaskProgressStatus() === "COMPLETED";

  els.checklistOpened.textContent = opened ? "Yes" : "No";
  els.checklistVoted.textContent = needsVoteForTask() ? (voted ? "Yes" : "No") : "N/A";
  els.checklistCompleted.textContent = completed ? "Yes" : "No";
}

function renderNextReward() {
  const completedRequiredCount = Number(state.summary?.requiredCompletedTaskCount || 0);
  const nextReward = state.rewards.find((reward) => Number(reward.milestoneCount || 0) > completedRequiredCount);

  if (!nextReward) {
    els.nextRewardTitle.textContent = "Final milestone reached!";
    els.nextRewardSubtitle.textContent = "You have reached the last Monarch reward milestone.";
    return;
  }

  els.nextRewardTitle.textContent = nextReward.title || "Next Reward";
  els.nextRewardSubtitle.textContent =
    nextReward.subtitle ||
    `Complete ${nextReward.milestoneCount} required task${nextReward.milestoneCount === 1 ? "" : "s"} to earn this reward.`;
}

/* =========================================================
   BUTTONS / ACTIONS
========================================================= */

function renderTaskButtons() {
  const completed = getTaskProgressStatus() === "COMPLETED";
  const opened = !!state.taskProgress?.listenOpened;
  const voted = !!state.taskProgress?.voteSubmitted;

  els.markOpenedBtn.disabled = completed;
  els.completeTaskBtn.disabled = completed || !canCompleteTask();

  if (completed) {
    els.completeHelpText.textContent = "You already completed this task.";
  } else if (needsVoteForTask() && !voted) {
    els.completeHelpText.textContent = "Vote for your favorite book before completing this task.";
  } else if (!opened) {
    els.completeHelpText.textContent = "Open the read-aloud link first, then complete the task.";
  } else {
    els.completeHelpText.textContent = "You are ready to complete this task.";
  }
}

function wireEvents() {
  els.markOpenedBtn?.addEventListener("click", handleMarkOpened);
  els.completeTaskBtn?.addEventListener("click", handleCompleteTask);

  document.querySelectorAll('[data-listen-link="true"]').forEach((link) => {
    link.addEventListener("click", async () => {
      try {
        await markOpenedOnly();
        state.taskProgress = {
          ...(state.taskProgress || {}),
          listenOpened: true,
          status: state.taskProgress?.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
        };
        renderChecklist();
        renderTaskButtons();
        setTaskMessage("Listening link opened. Nice job!");
      } catch (err) {
        console.error(err);
      }
    });
  });
}

async function handleMarkOpened() {
  try {
    await markOpenedOnly();

    state.taskProgress = {
      ...(state.taskProgress || {}),
      listenOpened: true,
      status: state.taskProgress?.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    };

    renderChecklist();
    renderTaskButtons();
    setTaskMessage("Listening marked as opened.");
  } catch (err) {
    console.error(err);
    setTaskMessage(err.message || "Could not update this task.");
  }
}

async function markOpenedOnly() {
  await markTaskListenOpened(
    state.schoolId,
    state.userId,
    state.taskId,
    state.task?.type || MONARCH_TASK_TYPES.LISTEN
  );
}

async function handleVoteSelection(selectedNomineeId) {
  try {
    if (!state.task?.matchupId) return;

    await saveUserVote({
      schoolId: state.schoolId,
      userId: state.userId,
      matchupId: state.task.matchupId,
      taskId: state.taskId,
      selectedNomineeId,
    });

    state.vote = {
      matchupId: state.task.matchupId,
      taskId: state.taskId,
      selectedNomineeId,
    };

    state.taskProgress = {
      ...(state.taskProgress || {}),
      voteSubmitted: true,
      selectedNomineeId,
      updatedAt: new Date().toISOString(),
    };

    await ensureVoteStateStoredOnTaskProgress(selectedNomineeId);

    renderVoteSection();
    renderChecklist();
    renderTaskButtons();
    setTaskMessage("Your vote has been saved.");
  } catch (err) {
    console.error(err);
    setTaskMessage(err.message || "Could not save your vote.");
  }
}

async function ensureVoteStateStoredOnTaskProgress(selectedNomineeId) {
  await markTaskCompleted({
    schoolId: state.schoolId,
    userId: state.userId,
    taskId: state.taskId,
    type: state.task?.type || MONARCH_TASK_TYPES.MATCHUP,
    selectedNomineeId,
    voteSubmitted: true,
  });

  const existing = await fetchUserTaskProgress(state.schoolId, state.userId, state.taskId);

  if (existing?.status === "COMPLETED") {
    state.taskProgress = existing;
    return;
  }

  state.taskProgress = {
    ...(state.taskProgress || {}),
    taskId: state.taskId,
    type: state.task?.type || MONARCH_TASK_TYPES.MATCHUP,
    status: "IN_PROGRESS",
    listenOpened: true,
    listenCompleted: false,
    voteSubmitted: true,
    selectedNomineeId,
  };

  await touchPartialTaskProgress({
    voteSubmitted: true,
    selectedNomineeId,
    status: "IN_PROGRESS",
    listenOpened: !!state.taskProgress.listenOpened,
    listenCompleted: false,
  });
}

async function touchPartialTaskProgress(patch) {
  const { setDoc, doc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const { db } = await import("../firebase.js");
  const ref = doc(
    db,
    `readathonV2_schools/${state.schoolId}/users/${state.userId}/monarchQuest/taskProgress/${state.taskId}`
  );

  await setDoc(
    ref,
    {
      taskId: state.taskId,
      type: state.task?.type || MONARCH_TASK_TYPES.LISTEN,
      updatedAt: serverTimestamp(),
      ...patch,
    },
    { merge: true }
  );
}

async function handleCompleteTask() {
  try {
    if (!canCompleteTask()) {
      setTaskMessage("Please finish the required steps first.");
      return;
    }

    const selectedNomineeId = state.vote?.selectedNomineeId || state.taskProgress?.selectedNomineeId || null;
    const voteSubmitted = !!state.taskProgress?.voteSubmitted || !!state.vote;

    await markTaskCompleted({
      schoolId: state.schoolId,
      userId: state.userId,
      taskId: state.taskId,
      type: state.task?.type || MONARCH_TASK_TYPES.LISTEN,
      selectedNomineeId,
      voteSubmitted,
    });

    const requiredTaskCount =
      Number(state.config?.requiredTaskCount || 0) ||
      state.tasks.filter((task) => !!task.required).length ||
      state.tasks.length;

    const updatedSummary = buildUpdatedSummary({
      currentSummary: state.summary,
      tasks: state.tasks,
      rewards: state.rewards,
      justCompletedTaskId: state.taskId,
      requiredTaskCount,
    });

    await touchUserMonarchSummary(state.schoolId, state.userId, updatedSummary);

    state.summary = {
      ...(state.summary || {}),
      ...updatedSummary,
    };

    state.taskProgress = {
      ...(state.taskProgress || {}),
      status: "COMPLETED",
      listenOpened: true,
      listenCompleted: true,
      voteSubmitted,
      selectedNomineeId,
      completedAt: new Date().toISOString(),
    };

    await syncRewardFlags();

    renderTaskIntro();
    renderChecklist();
    renderNextReward();
    renderTaskButtons();
    renderCelebrationBanner();

    setTaskMessage("Task complete! Returning to the quest board...");
    setTimeout(() => {
      window.location.href = "../../html/monarch-quest.html";
    }, 1400);
  } catch (err) {
    console.error(err);
    setTaskMessage(err.message || "Could not complete this task.");
  }
}

async function syncRewardFlags() {
  const rewardKeysEarned = Array.isArray(state.summary?.rewardKeysEarned)
    ? state.summary.rewardKeysEarned
    : [];

  for (const rewardKey of rewardKeysEarned) {
    await saveRewardFlag({
      schoolId: state.schoolId,
      userId: state.userId,
      rewardKey,
      claimed: false,
      claimType: "AUTO",
      notes: "Earned from Monarch Quest milestone progress.",
    });
  }
}

/* =========================================================
   CELEBRATION
========================================================= */

function renderCelebrationBanner() {
  const completed = getTaskProgressStatus() === "COMPLETED";
  if (!completed) {
    els.celebrationBanner.hidden = true;
    return;
  }

  const latestRewardKey = Array.isArray(state.summary?.rewardKeysEarned)
    ? state.summary.rewardKeysEarned[state.summary.rewardKeysEarned.length - 1]
    : null;

  const latestReward = state.rewards.find((reward) => reward.rewardKey === latestRewardKey);

  els.celebrationTitle.textContent = "Task complete!";
  els.celebrationText.textContent = latestReward
    ? `Amazing work! You may have unlocked: ${latestReward.title}.`
    : "Amazing work! You completed this Monarch Quest task.";
  els.celebrationBanner.hidden = false;
}

/* =========================================================
   HELPERS
========================================================= */

function canCompleteTask() {
  const opened = !!state.taskProgress?.listenOpened;
  const completed = getTaskProgressStatus() === "COMPLETED";

  if (completed) return false;
  if (!opened) return false;

  if (needsVoteForTask()) {
    return !!state.taskProgress?.voteSubmitted || !!state.vote;
  }

  return true;
}

function needsVoteForTask() {
  return !!state.task?.allowVote || state.task?.type === MONARCH_TASK_TYPES.MATCHUP;
}

function getTaskProgressStatus() {
  return String(state.taskProgress?.status || "NOT_STARTED").toUpperCase();
}

function getTaskIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("taskId");
}

function formatTaskType(type) {
  const raw = String(type || "").toUpperCase();
  if (raw === "LISTEN") return "Listen";
  if (raw === "MATCHUP") return "Matchup";
  if (raw === "VOTE") return "Vote";
  if (raw === "BONUS") return "Bonus";
  return "Task";
}

function formatTaskStatus(status) {
  const raw = String(status || "").toUpperCase();
  if (raw === "COMPLETED") return "Complete";
  if (raw === "IN_PROGRESS") return "In Progress";
  return "Not Started";
}

function normalizeRewards(rewards) {
  return [...rewards].sort((a, b) => Number(a?.milestoneCount || 0) - Number(b?.milestoneCount || 0));
}

function setTaskMessage(message) {
  if (els.taskMessage) {
    els.taskMessage.textContent = message || "";
  }
}

function renderFatalError(message) {
  applyMonarchPageHeader({
    kicker: "Readathon World Special Event",
    title: "Monarch Quest Task",
    subtitle: "We ran into a loading problem.",
  });

  if (els.taskTitle) els.taskTitle.textContent = "Unable to load task";
  if (els.taskSubtitle) els.taskSubtitle.textContent = message;
  if (els.nomineeList) {
    els.nomineeList.innerHTML = `
      <div class="monarch-empty-state">
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}