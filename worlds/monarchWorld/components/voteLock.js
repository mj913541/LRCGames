/* worlds/monarchWorld/components/voteLock.js
   Vote-lock logic:
   - One vote per match (m0, m1, ...)
   - Stores vote in progress.monarchWorld[season][roundId].votes.m{index} = "Title"
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

export function getVoteMap(getLocalProgress, season, roundId) {
  const p = getLocalProgress() || {};
  const r = p?.monarchWorld?.[season]?.[roundId];
  return (r && r.votes) ? r.votes : {};
}

export function getVoteForMatch(voteMap, matchIndex) {
  return voteMap?.[`m${matchIndex}`] || null;
}

export function isVoted(voteMap, matchIndex) {
  return !!getVoteForMatch(voteMap, matchIndex);
}

export async function saveVote({
  matchIndex,
  title,
  season,
  roundId,
  saveProgress
}) {
  await saveProgress((progress) => {
    const { progress: p, round } = ensureRound(progress, season, roundId);
    round.votes[`m${matchIndex}`] = title;
    return p;
  });
}

/**
 * Apply "voted" visuals to a set of buttons for a match.
 * voteBtnsByTitle: { [title]: HTMLButtonElement }
 */
export function applyVotedUI({ voteBtnsByTitle, votedTitle }) {
  Object.entries(voteBtnsByTitle).forEach(([t, btn]) => {
    btn.disabled = true;
    btn.classList.add("mw-locked", "mw-muted");
    btn.classList.remove("mw-success");

    if (t === votedTitle) {
      btn.classList.remove("mw-muted");
      btn.classList.add("mw-chosen");
      btn.textContent = `✅ WINNER: "${votedTitle}"`;
    } else {
      btn.textContent = "—";
    }
  });
}

/**
 * Unlock voting UI for a match (when videoGate says both watched).
 */
export function unlockVoteUI({ voteBtnsByTitle }) {
  Object.entries(voteBtnsByTitle).forEach(([t, btn]) => {
    btn.disabled = false;
    btn.classList.remove("mw-locked", "mw-muted");
    btn.classList.add("mw-success");
    btn.textContent = `🗳️ Vote for "${t}"`;
  });
}

/**
 * Lock voting UI for a match (default state before both watched).
 */
export function lockVoteUI({ voteBtnsByTitle }) {
  Object.values(voteBtnsByTitle).forEach((btn) => {
    btn.disabled = true;
    btn.classList.add("mw-locked");
    btn.classList.remove("mw-success", "mw-muted", "mw-chosen");
    btn.textContent = "🔒 Vote";
  });
}
