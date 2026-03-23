(function () {
  const SCHOOL_GOALS = {
    minutes: 200000,
    donations: 3000
  };

  const SCHOOL_PROGRESS = {
    minutes: 0,
    donations: 0
  };

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
      maximumFractionDigits: 0
    });
  }

  function getPercent(current, goal) {
    if (!goal) return 0;
    return (current / goal) * 100;
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
    const isComplete = current >= goal;

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
        const remaining = Math.max(goal - current, 0);
        footerEl.textContent = `${formatter(remaining)} to go`;
      }
    }

    card.classList.toggle("school-status-complete", isComplete);
  }

  function renderSchoolStatus() {
    updateSchoolStatusCard(
      "minutesThermometer",
      SCHOOL_PROGRESS.minutes,
      SCHOOL_GOALS.minutes,
      formatNumber,
      "Minutes"
    );

    updateSchoolStatusCard(
      "donationsThermometer",
      SCHOOL_PROGRESS.donations,
      SCHOOL_GOALS.donations,
      formatCurrency,
      "Donations"
    );
  }

  window.setSchoolStatusProgress = function setSchoolStatusProgress(data = {}) {
    if (typeof data.minutes === "number") {
      SCHOOL_PROGRESS.minutes = data.minutes;
    }

    if (typeof data.donations === "number") {
      SCHOOL_PROGRESS.donations = data.donations;
    }

    renderSchoolStatus();
  };

  document.addEventListener("DOMContentLoaded", function () {
    renderSchoolStatus();

    // Demo values for testing only
    window.setSchoolStatusProgress({
      minutes: 84250,
      donations: 1375
    });
  });
})();