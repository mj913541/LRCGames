import {
  fnCompleteVideoReward,
  getSchoolId,
  getCurrentUserId,
} from "./firebase.js";

const MIN_WATCH_PERCENT = 90;

async function awardVideoCompletion(item, progress) {
  // Stop if this video was already completed in local state
  if (progress?.completed) return;

  // Get the active school id from local storage / default config
  const schoolId = getSchoolId();

  // Get the signed-in student's uid
  const userId = getCurrentUserId();

  // Stop if no signed-in user exists
  if (!userId) {
    throw new Error("No signed-in student found.");
  }

  // Read the watch numbers from the current progress object
  const watchPercent = Number(progress?.watchPercent || 0);
  const maxObservedTime = Number(progress?.maxObservedTime || 0);
  const durationSeconds = Number(progress?.durationSeconds || 0);

  // Only continue when the threshold is actually met
  if (watchPercent < MIN_WATCH_PERCENT) return;

  try {
    // Ask the backend to verify completion and grant reward safely
    const result = await fnCompleteVideoReward({
      schoolId,
      videoKey: item.key,
      watchPercent,
      maxObservedTime,
      durationSeconds,
    });

    // Mark the local progress so the UI updates immediately
    progress.completed = true;
    progress.rewardGranted = true;
    progress.rubiesAwarded = Number(result?.data?.rubiesAwarded || 0);
    progress.minutesAwarded = Number(result?.data?.minutesAwarded || 0);

    console.log("✅ Video reward granted:", result.data);
  } catch (err) {
    console.error("❌ Video reward failed:", err);
  }
}