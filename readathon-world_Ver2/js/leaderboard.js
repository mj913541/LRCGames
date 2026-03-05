import { db, getSchoolId } from "/readathon-world_Ver2/js/firebase.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function renderLeaderboard(containerId = "leaderboard") {
  const schoolId = getSchoolId();
  const container = document.getElementById(containerId);

  if (!container) return;

  try {
    const ref = doc(
      db,
      `readathonV2_schools/${schoolId}/leaderboards/public`
    );

    const snap = await getDoc(ref);

    if (!snap.exists()) {
      container.innerHTML = "<p>No leaderboard data yet.</p>";
      return;
    }

    const data = snap.data();

    const students = data.topStudents || [];
    const homerooms = data.topHomerooms || [];
    const grades = data.topGrades || [];

    container.innerHTML = `
      <div class="leaderboard-grid">

        <div class="leaderboard-section">
          <h3>⭐ Top Readers</h3>
          ${students.map((s, i) =>
            `<div class="leader-row">${i+1}. ${s.displayNamePublic} — ${s.minutes.toLocaleString()} min</div>`
          ).join("")}
        </div>

        <div class="leaderboard-section">
          <h3>🏫 Top Homerooms</h3>
          ${homerooms.map((h, i) =>
            `<div class="leader-row">${i+1}. ${h.homeroomId.replace("hr_","")} — ${h.minutes.toLocaleString()}</div>`
          ).join("")}
        </div>

        <div class="leaderboard-section">
          <h3>🎓 Grade Leaders</h3>
          ${grades.map(g =>
            `<div class="leader-row">Grade ${g.grade} — ${g.minutes.toLocaleString()}</div>`
          ).join("")}
        </div>

      </div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Error loading leaderboard.</p>";
  }
}