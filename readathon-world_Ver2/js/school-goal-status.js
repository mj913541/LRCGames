import { db, getSchoolId } from "/readathon-world_Ver2/js/firebase.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function fmtNum(n) {
  return Number(n || 0).toLocaleString();
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function safeDate(ts) {
  try {
    if (ts && typeof ts.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;
  } catch {}
  return null;
}

function clampPercent(current, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(100, (Number(current || 0) / Number(goal)) * 100));
}

function buildThermometerCard({
  type,
  label,
  value,
  goal,
  displayValue,
  displayGoal,
  subLabel,
}) {
  const percent = clampPercent(value, goal);
  const remaining = Math.max(0, Number(goal || 0) - Number(value || 0));

  return `
    <div class="ss-card ${type}">
      <div class="ss-thermo-wrap">
        <div class="ss-thermo" aria-label="${label} progress: ${percent.toFixed(1)}%">
          <div class="ss-thermo-tube">
            <div class="ss-thermo-fill" style="height:${percent}%"></div>
          </div>
          <div class="ss-thermo-bulb"></div>
          <div class="ss-thermo-markers">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      <div class="ss-info">
        <h3 class="ss-label">${label}</h3>
        <div class="ss-big">${displayValue}</div>
        <div class="ss-goal">Goal: ${displayGoal}</div>

        <div class="ss-progress-bar" aria-hidden="true">
          <div class="ss-progress-bar-fill" style="width:${percent}%"></div>
        </div>

        <div class="ss-meta">
          <span><strong>${percent.toFixed(1)}%</strong> reached</span>
          <span><strong>${subLabel}${type === "donations" ? fmtMoney(remaining) : fmtNum(remaining)}</strong> to go</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * DATA OPTIONS:
 * Option A: pass values in directly
 * Option B: store them in Firestore and fetch them here
 */
export async function renderSchoolStatus(
  containerId = "schoolStatusWidget",
  options = {}
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const minuteGoal = Number(options.minuteGoal || 200000);
  const donationGoal = Number(options.donationGoal || 3000);

  container.innerHTML = `<p class="ss-empty">Loading school status…</p>`;

  try {
    let totalMinutes = Number(options.totalMinutes || 0);
    let totalDonations = Number(options.totalDonations || 0);
    let updatedAt = null;

    // If values were not passed in, fetch from Firestore
    if (!options.totalMinutes && !options.totalDonations) {
      const schoolId = getSchoolId();

      // CHANGE THIS PATH to wherever your school totals live
      const ref = doc(db, `readathonV2_schools/${schoolId}/widgets/schoolStatus`);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data() || {};
        totalMinutes = Number(data.totalMinutes || 0);
        totalDonations = Number(data.totalDonations || 0);
        updatedAt = safeDate(data.updatedAt);
      }
    }

    const updatedText = updatedAt
      ? `Updated: ${updatedAt.toLocaleString()}`
      : `Updated: just now`;

    container.innerHTML = `
      <div class="ss-header">
        <h2 class="ss-title">🏫 School Progress</h2>
        <p class="ss-updated">${updatedText}</p>
      </div>

      <div class="ss-grid">
        ${buildThermometerCard({
          type: "minutes",
          label: "Reading Minutes",
          value: totalMinutes,
          goal: minuteGoal,
          displayValue: fmtNum(totalMinutes),
          displayGoal: `${fmtNum(minuteGoal)} min`,
          subLabel: "",
        })}

        ${buildThermometerCard({
          type: "donations",
          label: "Donations Raised",
          value: totalDonations,
          goal: donationGoal,
          displayValue: `$${fmtMoney(totalDonations)}`,
          displayGoal: `$${fmtMoney(donationGoal)}`,
          subLabel: "$",
        })}
      </div>
    `;
  } catch (err) {
    console.error("renderSchoolStatus error:", err);
    container.innerHTML = `<p class="ss-empty">Error loading school status.</p>`;
  }
}