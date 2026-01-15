/* worlds/monarchWorld/teacher/advanceRound.js
   Teacher tools: tally votes from players collection and generate Round 2 bracket.

   ✅ Locked to teacher allowlist:
     - malbrecht@sd308.org
     - malbrecht3317@gmail.com

   Data source:
     players/{uid}.progress.monarchWorld[season].r1.votes.m{index} = "Title"

   Output destination:
     monarchSeasons/{season} doc:
       {
         season,
         bracket: { r2: [[winner1,winner2], ...] },
         map: { unlocked:{...}, completed:{...} },
         updatedAt,
         generatedBy
       }

   NOTE: For true security, also enforce this allowlist in Firestore Security Rules.
*/

import { getAuthInstance } from "../../../scripts/lrcQuestCore.js";

// Firestore (client SDK)
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { ROUND1_MATCHUPS } from "../data/bracket-2026.js";

const db = getFirestore();

// ✅ Teacher allowlist
const TEACHER_EMAILS = new Set([
  "malbrecht@sd308.org",
  "malbrecht3317@gmail.com"
]);

function assertTeacher(user) {
  const email = (user?.email || "").toLowerCase().trim();
  if (!TEACHER_EMAILS.has(email)) {
    throw new Error(`AccessDenied: ${email || "unknown user"} is not allowed.`);
  }
  return email;
}

function getVoteFromProgress(progress, season, matchIndex) {
  // progress.monarchWorld[season].r1.votes.m{index} = "Title"
  return progress?.monarchWorld?.[season]?.r1?.votes?.[`m${matchIndex}`] || null;
}

/**
 * Compute Round 2 bracket from Round 1 votes.
 * Strategy: majority winner per match. If tied/none -> TBD.
 */
export async function previewRound2FromVotes({ season }) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in.");
  assertTeacher(user);

  const playersSnap = await getDocs(collection(db, "players"));

  // Tally: matchIndex -> { title -> count }
  const tallies = {};
  for (let i = 0; i < ROUND1_MATCHUPS.length; i++) tallies[i] = {};

  let totalPlayersDocs = 0;
  let totalVotesCounted = 0;

  playersSnap.forEach((docSnap) => {
    totalPlayersDocs += 1;
    const data = docSnap.data();
    const progress = data?.progress || {};

    ROUND1_MATCHUPS.forEach((pair, idx) => {
      const vote = getVoteFromProgress(progress, season, idx);
      if (!vote) return;
      tallies[idx][vote] = (tallies[idx][vote] || 0) + 1;
      totalVotesCounted += 1;
    });
  });

  const winners = ROUND1_MATCHUPS.map((pair, idx) => {
    const counts = tallies[idx];
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]); // desc

    if (entries.length === 0) {
      return { match: idx, pair, winner: "TBD", reason: "no votes", counts: {} };
    }

    if (entries.length > 1 && entries[0][1] === entries[1][1]) {
      return { match: idx, pair, winner: "TBD (tie)", reason: "tie", counts };
    }

    return { match: idx, pair, winner: entries[0][0], reason: "majority", counts };
  });

  // Pair winners into Round 2 matches (0v1, 2v3, 4v5, ...)
  const round2Matchups = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i]?.winner || "TBD";
    const b = winners[i + 1]?.winner || "TBD";
    round2Matchups.push([a, b]);
  }

  const hasTBD = winners.some(w => String(w.winner).startsWith("TBD"));

  return {
    ok: true,
    season,
    stats: {
      playerDocsScanned: totalPlayersDocs,
      totalVotesCounted
    },
    winners,
    round2Matchups,
    note: hasTBD
      ? "Some match winners are TBD (missing votes or ties). You can still generate Round 2, but consider resolving ties first."
      : "All Round 1 match winners computed successfully."
  };
}

/**
 * Save Round 2 bracket + unlock state into monarchSeasons/{season}.
 * Marks r1 completed + r2 unlocked.
 */
export async function generateAndUnlockRound2({ season }) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in.");

  const teacherEmail = assertTeacher(user);

  const preview = await previewRound2FromVotes({ season });

  const seasonRef = doc(db, "monarchSeasons", season);

  const payload = {
    season,
    updatedAt: new Date().toISOString(),
    generatedBy: teacherEmail,
    bracket: {
      r2: preview.round2Matchups
    },
    map: {
      unlocked: { r1: true, r2: true, r3: false, final: false },
      completed: { r1: true, r2: false, r3: false, final: false }
    }
  };

  await setDoc(seasonRef, payload, { merge: true });

  return {
    ok: true,
    message: "Round 2 bracket saved and Round 2 unlocked.",
    savedTo: `monarchSeasons/${season}`,
    payload,
    preview
  };
}

/**
 * Read monarchSeasons/{season} (for verification).
 */
export async function readSeasonDoc({ season }) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in.");
  assertTeacher(user);

  const seasonRef = doc(db, "monarchSeasons", season);
  const snap = await getDoc(seasonRef);

  if (!snap.exists()) {
    return {
      ok: true,
      season,
      exists: false,
      data: null,
      message: "Season doc does not exist yet. Generate Round 2 to create it."
    };
  }

  return {
    ok: true,
    season,
    exists: true,
    data: snap.data()
  };
}
