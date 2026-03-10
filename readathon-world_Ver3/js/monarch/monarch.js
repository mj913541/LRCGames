// /readathon-world_Ver3/js/monarch/monarch-quest.js

import {
  getCurrentUserId,
  getCurrentSchoolId,
  fetchMonarchConfig,
  fetchMonarchTasks,
  fetchMonarchRewards,
  fetchMonarchNominees,
  fetchUserMonarchSummary,
  ensureUserMonarchSummary,
  isTaskUnlocked,
  applyMonarchPageHeader
} from "/readathon-world_Ver3/js/monarch/monarch-firebase.js";

/* =========================================================
   PAGE ELEMENTS
========================================================= */

const els = {
  pageKicker: document.getElementById("pageKicker"),
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),

  completedCount: document.getElementById("mqCompletedCount"),
  requiredCount: document.getElementById("mqRequiredCount"),
  rewardsEarnedCount: document.getElementById("mqRewardsEarnedCount"),
  progressLabel: document.getElementById("mqProgressLabel"),
  progressMiniLabel: document.getElementById("mqProgressMiniLabel"),
  progressFill: document.getElementById("mqProgressFill"),
  displayStatus: document.getElementById("mqDisplayStatus"),
  nextMilestoneText: document.getElementById("mqNextMilestoneText"),

  rewardPreviewList: document.getElementById("mqRewardPreviewList"),

  questBoard: document.getElementById("mqQuestBoard"),
  questBoardEmpty: document.getElementById("mqQuestBoardEmpty"),

  celebrationBanner: document.getElementById("mqCelebrationBanner"),
  celebrationTitle: document.getElementById("mqCelebrationTitle"),
  celebrationText: document.getElementById("mqCelebrationText"),
};

/* =========================================================
   PAGE STATE
========================================================= */

const state = {
  schoolId: null,
  userId: null,
  config: null,
  tasks: [],
  rewards: [],
  nominees: [],
  summary: null,
};

/* =========================================================
   INIT
========================================================= */

init();

async function init() {
  try {
    state.schoolId = getCurrentSchoolId();
    state.userId = getCurrentUserId();

    if (!state.schoolId) {
      throw new Error("Missing schoolId.");
    }

    if (!state.userId) {
      throw new Error("No signed-in user found.");
    }

    await loadAllData();
    renderPage();
  } catch (err) {
    console.error("Monarch Quest init error:", err);
    renderFatalError(err.message || "Unable to load Monarch Quest.");
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

  const existingSummary = await fetchUserMonarchSummary(state.schoolId, state.userId);
  state.summary = existingSummary || await ensureUserMonarchSummary(state.schoolId, state.userId);
}

/* =========================================================
   RENDER
========================================================= */

function renderPage() {
  applyMonarchPageHeader({
    kicker: "Readathon World Special Event",
    title: state.config?.title || "Monarch Quest 2026",
    subtitle:
      state.config?.subtitle ||
      "Listen to the Monarch nominees, complete your quest, and unlock special rewards!",
  });

  renderProgress();
  renderRewards();
  renderQuestBoard();
  renderCelebrationBanner();
}

/* =========================================================
   PROGRESS
========================================================= */

function renderProgress() {
  const requiredTaskCount =
    Number(state.config?.requiredTaskCount || 0) ||
    state.tasks.filter((task) => !!task.required).length ||
    state.tasks.length;

  const completedTaskIds = Array.isArray(state.summary?.completedTaskIds)
    ? state.summary.completedTaskIds
    : [];

  const completedTaskCount = Number(state.summary?.completedTaskCount || completedTaskIds.length || 0);
  const rewardKeysEarned = Array.isArray(state.summary?.rewardKeysEarned)
    ? state.summary.rewardKeysEarned
    : [];

  const completionPercent =
    Number(state.summary?.completionPercent || 0);

  els.completedCount.textContent = String(completedTaskCount);
  els.requiredCount.textContent = String(requiredTaskCount);
  els.rewardsEarnedCount.textContent = String(rewardKeysEarned.length);

  els.progressLabel.textContent = `${completionPercent}% Complete`;
  els.progressMiniLabel.textContent = `${completedTaskCount} / ${requiredTaskCount} Tasks`;
  els.progressFill.style.width = `${completionPercent}%`;

  const displayStatus = formatDisplayStatus(state.summary?.displayStatus || "NOT_STARTED");
  els.displayStatus.textContent = displayStatus;

  const nextReward = getNextReward(
    state.rewards,
    Number(state.summary?.requiredCompletedTaskCount || 0)
  );

  els.nextMilestoneText.textContent = nextReward
    ? `Next reward: ${nextReward.title} at ${nextReward.milestoneCount} completed task${nextReward.milestoneCount === 1 ? "" : "s"}.`
    : "You have reached the final reward milestone!";
}

/* =========================================================
   REWARDS
========================================================= */

function renderRewards() {
  if (!els.rewardPreviewList) return;

  els.rewardPreviewList.innerHTML = "";

  if (!state.rewards.length) {
    els.rewardPreviewList.innerHTML = `
      <div class="monarch-empty-state">
        <p>No Monarch rewards are set up yet.</p>
      </div>
    `;
    return;
  }

  const earnedKeys = new Set(
    Array.isArray(state.summary?.rewardKeysEarned) ? state.summary.rewardKeysEarned : []
  );

  for (const reward of state.rewards) {
    const earned = earnedKeys.has(reward.rewardKey);

    const card = document.createElement("article");
    card.className = "monarch-reward-preview-card";
    card.innerHTML = `
      <div class="monarch-reward-preview-card__icon">${earned ? "🏆" : "✨"}</div>
      <h4>${escapeHtml(reward.title || "Reward")}</h4>
      <span>${reward.milestoneCount} task${reward.milestoneCount === 1 ? "" : "s"}</span>
    `;

    if (earned) {
      card.style.outline = "2px solid #47d764";
    }

    els.rewardPreviewList.appendChild(card);
  }
}

function normalizeRewards(rewards) {
  return [...rewards].sort((a, b) => {
    const aCount = Number(a?.milestoneCount || 0);
    const bCount = Number(b?.milestoneCount || 0);
    return aCount - bCount;
  });
}

function getNextReward(rewards, completedRequiredCount) {
  return rewards.find((reward) => Number(reward.milestoneCount || 0) > completedRequiredCount) || null;
}

/* =========================================================
   QUEST BOARD
========================================================= */

function renderQuestBoard() {
  if (!els.questBoard) return;

  els.questBoard.innerHTML = "";

  if (!state.tasks.length) {
    els.questBoardEmpty.hidden = false;
    return;
  }

  els.questBoardEmpty.hidden = true;

  const completedTaskIds = Array.isArray(state.summary?.completedTaskIds)
    ? state.summary.completedTaskIds
    : [];

  const completedSet = new Set(completedTaskIds);

  for (const task of state.tasks) {
    const unlocked = isTaskUnlocked(task, completedTaskIds);
    const completed = completedSet.has(task.taskId);

    const card = document.createElement("article");
    card.className = buildTaskCardClassName({ unlocked, completed });

    const nomineeTitles = getTaskNomineeTitles(task);

    card.innerHTML = `
      <div class="monarch-quest-card__top">
        <span class="monarch-quest-card__badge">${buildTaskBadgeText(task, unlocked, completed)}</span>
      </div>

      <h3>${escapeHtml(task.title || "Monarch Task")}</h3>

      <p>${escapeHtml(task.subtitle || "Complete this quest task to keep moving forward.")}</p>

      <div class="monarch-quest-card__meta">
        <small>${escapeHtml(task.type || "TASK")}</small>
      </div>

      ${
        nomineeTitles.length
          ? `
            <div class="monarch-quest-card__books">
              ${nomineeTitles.map((title) => `<span class="monarch-quest-card__book">${escapeHtml(title)}</span>`).join("")}
            </div>
          `
          : ""
      }
    `;

    if (completed) {
      card.setAttribute("aria-label", `${task.title} complete`);
    } else if (!unlocked) {
      card.setAttribute("aria-label", `${task.title} locked`);
    } else {
      card.setAttribute("aria-label", `${task.title} open`);
    }

    if (unlocked) {
      card.addEventListener("click", () => {
        goToTask(task.taskId);
      });
      card.addEventListener("keypress", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToTask(task.taskId);
        }
      });
      card.tabIndex = 0;
    } else {
      card.tabIndex = -1;
    }

    els.questBoard.appendChild(card);
  }
}

function buildTaskCardClassName({ unlocked, completed }) {
  let className = "monarch-quest-card";

  if (!unlocked) className += " monarch-card-locked";
  if (completed) className += " monarch-card-complete";

  return className;
}

function buildTaskBadgeText(task, unlocked, completed) {
  if (completed) return "Complete";
  if (!unlocked) return "Locked";
  return task.type === "MATCHUP" ? "Battle Open" : "Quest Open";
}

function getTaskNomineeTitles(task) {
  const nomineeIds = Array.isArray(task?.nomineeIds) ? task.nomineeIds : [];
  if (!nomineeIds.length) return [];

  return nomineeIds
    .map((id) => state.nominees.find((nominee) => nominee.nomineeId === id))
    .filter(Boolean)
    .map((nominee) => nominee.title);
}

function goToTask(taskId) {
  window.location.href = `/readathon-world_Ver3/html/monarch-task.html?taskId=${encodeURIComponent(taskId)}`;
}

/* =========================================================
   CELEBRATION BANNER
========================================================= */

function renderCelebrationBanner() {
  if (!els.celebrationBanner) return;

  const rewardKeysEarned = Array.isArray(state.summary?.rewardKeysEarned)
    ? state.summary.rewardKeysEarned
    : [];

  if (!rewardKeysEarned.length) {
    els.celebrationBanner.hidden = true;
    return;
  }

  const lastRewardKey = rewardKeysEarned[rewardKeysEarned.length - 1];
  const reward = state.rewards.find((item) => item.rewardKey === lastRewardKey);

  if (!reward) {
    els.celebrationBanner.hidden = true;
    return;
  }

  els.celebrationTitle.textContent = reward.title || "Reward Unlocked!";
  els.celebrationText.textContent =
    reward.subtitle || "You unlocked a special Monarch Quest reward.";
  els.celebrationBanner.hidden = false;
}

/* =========================================================
   ERROR STATE
========================================================= */

function renderFatalError(message) {
  applyMonarchPageHeader({
    kicker: "Readathon World Special Event",
    title: "Monarch Quest",
    subtitle: "We ran into a loading problem.",
  });

  if (els.questBoardEmpty) {
    els.questBoardEmpty.hidden = false;
    els.questBoardEmpty.innerHTML = `
      <h3>Unable to load Monarch Quest</h3>
      <p>${escapeHtml(message)}</p>
    `;
  }

  if (els.questBoard) {
    els.questBoard.innerHTML = "";
  }
}

/* =========================================================
   HELPERS
========================================================= */

function formatDisplayStatus(status) {
  const raw = String(status || "").trim().toUpperCase();

  if (raw === "COMPLETE") return "Complete";
  if (raw === "IN_PROGRESS") return "In Progress";
  return "Not Started";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}