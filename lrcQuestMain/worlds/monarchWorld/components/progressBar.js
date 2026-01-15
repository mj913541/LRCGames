/* worlds/monarchWorld/components/progressBar.js
   Simple progress display helpers for rounds.

   Expects the page to have:
     - #progressText (optional)
*/

export function setProgressText(done, total) {
  const el = document.getElementById("progressText");
  if (!el) return;
  el.textContent = `Battles completed: ${done} / ${total}`;
}

export function countCompletedVotes(voteMap = {}) {
  // voteMap shape: { m0: "Title", m1: "Title", ... }
  return Object.keys(voteMap).length;
}
