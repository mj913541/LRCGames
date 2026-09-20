/* ==================================================
   skill-game-mastery.js
   Shared mastery helpers for all skill games
================================================== */

/**
 * Safe number helper
 */
function n(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Returns a safe accuracy from 0 to 1
 */
export function getSkillGameAccuracy(progress = {}) {
  const totalQuestions = n(progress.totalQuestions, 0);
  const correctAnswers = n(progress.correctAnswers, 0);

  if (totalQuestions <= 0) return 0;

  return correctAnswers / totalQuestions;
}

/**
 * Returns whether the game uses mastery
 */
export function masteryEnabled(config = {}) {
  return !!config?.masterySettings?.enabled;
}

/**
 * Returns the mastery state string for a game
 */
export function getSkillGameMasteryState(progress = {}, config = {}) {
  const mastery = config?.masterySettings || {};

  if (!mastery.enabled) {
    return "not_used";
  }

  const roundsRequired = n(mastery.roundsRequired, 0);
  const accuracyThreshold = n(mastery.accuracyThreshold, 1);
  const streakRequired = n(mastery.streakRequired, 0);
  const masteryStateOnComplete =
    mastery.masteryStateOnComplete || "basic_mastered";

  const totalRoundsPlayed = n(progress.totalRoundsPlayed, 0);
  const currentStreak = n(progress.currentStreak, 0);
  const accuracy = getSkillGameAccuracy(progress);

  const mastered =
    totalRoundsPlayed >= roundsRequired &&
    accuracy >= accuracyThreshold &&
    currentStreak >= streakRequired;

  return mastered ? masteryStateOnComplete : "learning";
}

/**
 * Returns whether challenge mode should unlock
 */
export function isSkillGameChallengeUnlocked(progress = {}, config = {}) {
  const state =
    progress.masteryState || getSkillGameMasteryState(progress, config);

  return state === (config?.masterySettings?.masteryStateOnComplete || "basic_mastered");
}

/**
 * Returns whether a mastered player should stop earning in basic mode
 */
export function shouldBasicModeStopPaying(progress = {}, config = {}) {
  if (!masteryEnabled(config)) return false;

  const masteryState =
    progress.masteryState || getSkillGameMasteryState(progress, config);

  return masteryState === (config?.masterySettings?.masteryStateOnComplete || "basic_mastered");
}

/**
 * Builds the next progress object after a completed round
 * This does NOT save anything. It only calculates the next state.
 */
export function buildNextSkillGameProgress({
  progress = {},
  config = {},
  score = 0,
  totalQuestions = 0,
  passed = false,
  weakItems = [],
  mode = "basic",
  actualReward = 0,
  todayKey = "",
}) {
  const existingModeStats = progress.modeStats || {};

  const next = {
    ...progress,
    totalRoundsPlayed: n(progress.totalRoundsPlayed, 0) + 1,
    totalRoundsPassed: n(progress.totalRoundsPassed, 0) + (passed ? 1 : 0),
    totalQuestions: n(progress.totalQuestions, 0) + n(totalQuestions, 0),
    correctAnswers: n(progress.correctAnswers, 0) + n(score, 0),
    currentStreak: passed ? n(progress.currentStreak, 0) + 1 : 0,
    bestStreak: Math.max(
      n(progress.bestStreak, 0),
      passed ? n(progress.currentStreak, 0) + 1 : 0
    ),
    weakItems: Array.from(
      new Set([...(progress.weakItems || []), ...(weakItems || [])])
    ).slice(0, 20),

    lifetimeRubiesEarned:
      n(progress.lifetimeRubiesEarned, 0) + n(actualReward, 0),

    daily: {
      dateKey: todayKey,
      rewardWins:
        n(progress?.daily?.rewardWins, 0) + (actualReward > 0 ? 1 : 0),
      rubiesEarnedToday:
        n(progress?.daily?.rubiesEarnedToday, 0) + n(actualReward, 0),
    },

    modeStats: {
      ...existingModeStats,
      [mode]: {
        played: n(existingModeStats?.[mode]?.played, 0) + 1,
        passed: n(existingModeStats?.[mode]?.passed, 0) + (passed ? 1 : 0),
      },
    },
  };

  next.masteryState = getSkillGameMasteryState(next, config);
  next.challengeUnlocked = isSkillGameChallengeUnlocked(next, config);

  return next;
}

/**
 * Creates a clean initial progress object for any skill game
 */
export function buildInitialSkillGameProgress({
  gameId,
  title,
  todayKey,
}) {
  return {
    gameId,
    title,
    totalRoundsPlayed: 0,
    totalRoundsPassed: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    currentStreak: 0,
    bestStreak: 0,
    masteryState: "learning",
    challengeUnlocked: false,
    lifetimeRubiesEarned: 0,
    daily: {
      dateKey: todayKey,
      rewardWins: 0,
      rubiesEarnedToday: 0,
    },
    modeStats: {
      practice: { played: 0, passed: 0 },
      basic: { played: 0, passed: 0 },
      challenge: { played: 0, passed: 0 },
    },
    weakItems: [],
    lastPlayedAt: null,
    lastRewardedAt: null,
  };
}

/**
 * Resets only the daily section if the date changed
 */
export function normalizeSkillGameDaily(progress = {}, todayKey = "") {
  const existingDateKey = progress?.daily?.dateKey || "";

  if (existingDateKey === todayKey) {
    return {
      ...progress,
      daily: {
        dateKey: existingDateKey,
        rewardWins: n(progress?.daily?.rewardWins, 0),
        rubiesEarnedToday: n(progress?.daily?.rubiesEarnedToday, 0),
      },
    };
  }

  return {
    ...progress,
    daily: {
      dateKey: todayKey,
      rewardWins: 0,
      rubiesEarnedToday: 0,
    },
  };
}