import { db, getSchoolId } from "/readathon-world_Ver2/js/firebase.js";
import {
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const DEFAULT_GOALS = {
  minutes: 200000,
  donations: 3000,
};

let unsubscribeSchoolStatus = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function getPercent(current, goal) {
  if (!goal) return 0;
  return (Number(current || 0) / Number(goal || 0)) * 100;
}

function formatPercent(current, goal) {
  return `${Math.round(getPercent(current, goal))}%`;
}

function updateSchoolStatusCard(cardId, current, goal, formatter, labelText) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const fill = card.querySelector(".school-status-thermo-fill");
  const percent = card.querySelector(".school-status-percent");
  const currentEl = card.querySelector(".school-status-current");
  const goalEl = card.querySelector(".school-status-goal");
  const footerEl = card.querySelector(".school-status-footer");

  const rawPercent = getPercent(current, goal);
  const clampedPercent = clamp(rawPercent, 0, 100);
  const isComplete = Number(current || 0) >= Number(goal || 0);

  if (fill) {
    fill.style.height = `${clampedPercent}%`;
  }

  if (percent) {
    percent.textContent = formatPercent(current, goal);
  }

  if (currentEl) {
    currentEl.textContent = formatter(current);
  }

  if (goalEl) {
    goalEl.textContent = formatter(goal);
  }

  if (footerEl) {
    if (isComplete) {
      footerEl.textContent = `${labelText} goal reached!`;
    } else {
      const remaining = Math.max(Number(goal || 0) - Number(current || 0), 0);
      footerEl.textContent = `${formatter(remaining)} to go`;
    }
  }

  card.classList.toggle("school-status-complete", isComplete);
}

function renderSchoolStatus({ minutes = 0, donations = 0, minutesGoal, donationsGoal } = {}) {
  const finalMinutesGoal = Number(minutesGoal || DEFAULT_GOALS.minutes);
  const finalDonationsGoal = Number(donationsGoal || DEFAULT_GOALS.donations);

  updateSchoolStatusCard(
    "minutesThermometer",
    Number(minutes || 0),
    finalMinutesGoal,
    formatNumber,
    "Minutes"
  );

  updateSchoolStatusCard(
    "donationsThermometer",
    Number(donations || 0),
    finalDonationsGoal,
    formatCurrency,
    "Donations"
  );
}

export function mountSchoolStatus() {
  const schoolId = getSchoolId();
  if (!schoolId) {
    console.warn("mountSchoolStatus: missing schoolId");
    renderSchoolStatus();
    return () => {};
  }

  const minutesCard = document.getElementById("minutesThermometer");
  const donationsCard = document.getElementById("donationsThermometer");

  if (!minutesCard && !donationsCard) {
    return () => {};
  }

  if (typeof unsubscribeSchoolStatus === "function") {
    unsubscribeSchoolStatus();
    unsubscribeSchoolStatus = null;
  }

  const ref = doc(db, `readathonV2_schools/${schoolId}/leaderboards/public`);

  unsubscribeSchoolStatus = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        renderSchoolStatus({
          minutes: 0,
          donations: 0,
          minutesGoal: DEFAULT_GOALS.minutes,
          donationsGoal: DEFAULT_GOALS.donations,
        });
        return;
      }

      const data = snap.data() || {};

      renderSchoolStatus({
        minutes: data.schoolMinutesTotal ?? data.totalMinutes ?? 0,
        donations: data.schoolDonationsTotal ?? data.totalDonations ?? 0,
        minutesGoal: data.minutesGoal ?? DEFAULT_GOALS.minutes,
        donationsGoal: data.donationsGoal ?? DEFAULT_GOALS.donations,
      });
    },
    (error) => {
      console.error("mountSchoolStatus onSnapshot error:", error);
      renderSchoolStatus({
        minutes: 0,
        donations: 0,
        minutesGoal: DEFAULT_GOALS.minutes,
        donationsGoal: DEFAULT_GOALS.donations,
      });
    }
  );

  return unsubscribeSchoolStatus;
}

window.addEventListener("beforeunload", () => {
  if (typeof unsubscribeSchoolStatus === "function") {
    unsubscribeSchoolStatus();
    unsubscribeSchoolStatus = null;
  }
});