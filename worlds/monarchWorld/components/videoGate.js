/* worlds/monarchWorld/components/videoGate.js
   Watch-gate logic:
   - A battle is "unlocked" when BOTH videos have been watched to the end.
   - Stores watched state in progress.monarchWorld[season][roundId].watched.m{index}[title] = true

   Works with your core:
     import { getLocalProgress, saveProgress } from "../../../scripts/lrcQuestCore.js";
*/

function ensureRound(progress, season, roundId) {
  progress = progress || {};
  progress.monarchWorld = progress.monarchWorld || {};
  progress.monarchWorld[season] = progress.monarchWorld[season] || {};
  progress.monarchWorld[season][roundId] =
    progress.monarchWorld[season][roundId] || { watched: {}, votes: {} };

  const r = progress.monarchWorld[season][roundId];
  r.watched = r.watched || {};
  r.votes = r.votes || {};
  return { progress, round: r };
}

export function getWatchedMap(getLocalProgress, season, roundId) {
  const p = getLocalProgress() || {};
  const r = p?.monarchWorld?.[season]?.[roundId];
  return (r && r.watched) ? r.watched : {};
}

export function hasWatched(watchedMap, matchIndex, title) {
  const key = `m${matchIndex}`;
  return !!(watchedMap?.[key]?.[title]);
}

export function hasWatchedBoth(watchedMap, matchIndex, titleA, titleB) {
  return hasWatched(watchedMap, matchIndex, titleA) && hasWatched(watchedMap, matchIndex, titleB);
}

/**
 * Wire a <video> element so that when it ends, we mark the current book as watched.
 *
 * You provide a getter so videoGate doesn't need to know your UI state:
 *   getContext() -> { matchIndex, title }
 */
export function attachVideoGate({
  videoEl,
  getContext,
  season,
  roundId,
  getLocalProgress,
  saveProgress,
  onWatched // optional callback: ({ matchIndex, title, watchedMap }) => void
}) {
  if (!videoEl) throw new Error("attachVideoGate: videoEl is required");
  if (typeof getContext !== "function") throw new Error("attachVideoGate: getContext() is required");

  videoEl.addEventListener("ended", async () => {
    const ctx = getContext();
    if (!ctx || ctx.matchIndex == null || !ctx.title) return;

    const { matchIndex, title } = ctx;

    await saveProgress((progress) => {
      const { progress: p, round } = ensureRound(progress, season, roundId);
      const mKey = `m${matchIndex}`;
      round.watched[mKey] = round.watched[mKey] || {};
      round.watched[mKey][title] = true;
      return p;
    });

    // pull updated map for UI updates
    const watchedMap = getWatchedMap(getLocalProgress, season, roundId);

    if (typeof onWatched === "function") {
      onWatched({ matchIndex, title, watchedMap });
    }
  });
}
