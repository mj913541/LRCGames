import { db, getSchoolId } from "/readathon-world_Ver2/js/firebase.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/** Fallback prettifier: "hr_mederich" => "Mederich" */
function prettifyHomeroomId(homeroomId) {
  const raw = String(homeroomId || "").trim();
  if (!raw) return "Homeroom";
  return raw
    .replace(/^hr_/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Tries to resolve homeroomId => display name.
 * Looks up:
 * readathonV2_schools/{schoolId}/publicHomerooms/{homeroomId}  (field: name)
 * If missing, falls back to prettifyHomeroomId.
 */
async function getHomeroomName(schoolId, homeroomId) {
  if (!homeroomId) return "Homeroom";

  try {
    const ref = doc(db, `readathonV2_schools/${schoolId}/publicHomerooms/${homeroomId}`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const name = snap.get("name");
      if (name) return String(name);
    }
  } catch (e) {
    // ignore lookup errors; fallback below
  }

  return prettifyHomeroomId(homeroomId);
}

function fmtNum(n) {
  const x = Number(n || 0);
  return x.toLocaleString();
}

function safeDate(ts) {
  try {
    // Firestore Timestamp has toDate()
    if (ts && typeof ts.toDate === "function") return ts.toDate();
    // Might already be Date
    if (ts instanceof Date) return ts;
  } catch {}
  return null;
}

export async function renderLeaderboard(containerId = "leaderboard") {
  const schoolId = getSchoolId();
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `<p class="lb-empty">Loading leaderboard…</p>`;

  try {
    const ref = doc(db, `readathonV2_schools/${schoolId}/leaderboards/public`);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      container.innerHTML = `<p class="lb-empty">No leaderboard data yet.</p>`;
      return;
    }

    const data = snap.data() || {};
    const students = Array.isArray(data.topStudents) ? data.topStudents : [];
    const homerooms = Array.isArray(data.topHomerooms) ? data.topHomerooms : [];
    const grades = Array.isArray(data.topGrades) ? data.topGrades : [];
    const updatedAt = safeDate(data.updatedAt);

    // Resolve homeroom names (top 5 only, so this stays lightweight)
    const homeroomNames = new Map();
    await Promise.all(
      homerooms.map(async (h) => {
        const id = h.homeroomId || "";
        const nm = await getHomeroomName(schoolId, id);
        homeroomNames.set(id, nm);
      })
    );

    // Build HTML sections
    const updatedText = updatedAt
      ? `Updated: ${updatedAt.toLocaleString()}`
      : `Updated: just now`;

    const studentsHtml = students.length
      ? students
          .map((s, idx) => {
            const rank = idx + 1;
            const sub = (s.grade === 0 || s.grade) ? `Grade ${s.grade}` : "";
            return `
              <div class="lb-row rank-${rank}">
                <div class="lb-rank">${rank}</div>
                <div class="lb-main">
                  <div class="lb-name">${s.displayNamePublic || s.displayName || "Reader"}</div>
                  <div class="lb-sub">${sub}</div>
                </div>
                <div class="lb-metric">${fmtNum(s.minutes)} <span class="lb-sub">min</span></div>
              </div>
            `;
          })
          .join("")
      : `<p class="lb-empty">No student data yet.</p>`;

    const homeroomsHtml = homerooms.length
      ? homerooms
          .map((h, idx) => {
            const rank = idx + 1;
            const hrName = homeroomNames.get(h.homeroomId || "") || prettifyHomeroomId(h.homeroomId);
            return `
              <div class="lb-row rank-${rank}">
                <div class="lb-rank">${rank}</div>
                <div class="lb-main">
                  <div class="lb-name">${hrName}</div>
                  <div class="lb-sub">Top homeroom</div>
                </div>
                <div class="lb-metric">${fmtNum(h.minutes)} <span class="lb-sub">min</span></div>
              </div>
            `;
          })
          .join("")
      : `<p class="lb-empty">No homeroom data yet.</p>`;

    const gradesHtml = grades.length
      ? grades
          .map((g) => {
            const label = (g.grade === 0 || g.grade) ? `Grade ${g.grade}` : `Grade`;
            return `
              <div class="lb-row">
                <div class="lb-rank">🌿</div>
                <div class="lb-main">
                  <div class="lb-name">${label}</div>
                  <div class="lb-sub">Total minutes</div>
                </div>
                <div class="lb-metric">${fmtNum(g.minutes)} <span class="lb-sub">min</span></div>
              </div>
            `;
          })
          .join("")
      : `<p class="lb-empty">No grade data yet.</p>`;

    container.innerHTML = `
      <div class="lb-header">
        <h2 class="lb-title">🏆 Jungle Leaderboard</h2>
        <p class="lb-updated">${updatedText}</p>
      </div>

      <div class="leaderboard-grid">
        <div class="lb-card">
          <h3>⭐ Top Readers</h3>
          <div class="lb-list">${studentsHtml}</div>
        </div>

        <div class="lb-card">
          <h3>🏫 Top Homerooms</h3>
          <div class="lb-list">${homeroomsHtml}</div>
        </div>

        <div class="lb-card">
          <h3>🎓 Grade Leaders</h3>
          <div class="lb-list">${gradesHtml}</div>
        </div>
      </div>

      <p class="lb-footnote">Keep reading, explorers! Minutes update automatically.</p>
    `;
  } catch (err) {
    console.error("renderLeaderboard error:", err);
    container.innerHTML = `<p class="lb-empty">Error loading leaderboard.</p>`;
  }
}