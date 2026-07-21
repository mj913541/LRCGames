/* ==========================================================
   PERSONAL DASHBOARD
   Progress JavaScript
   ========================================================== */

/* ---------- Safe Percent ---------- */

function getSafeProgressPercent(currentAmount, goalAmount) {
  if (goalAmount <= 0) {
    return 0;
  }

  const percent = Math.round((currentAmount / goalAmount) * 100);

  if (percent < 0) {
    return 0;
  }

  if (percent > 100) {
    return 100;
  }

  return percent;
}

/* ---------- Update Progress Bar ---------- */

function updateProgressBar(progressElement, currentAmount, goalAmount) {
  const percent = getSafeProgressPercent(currentAmount, goalAmount);

  progressElement.style.width = percent + "%";
}