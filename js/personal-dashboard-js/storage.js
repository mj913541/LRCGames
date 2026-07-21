/* ==========================================================
   PERSONAL DASHBOARD
   Storage JavaScript
   ========================================================== */

/* ---------- Storage Key ---------- */

const personalDashboardStorageKey = "personalDashboardData";

/* ---------- Save ---------- */

function savePersonalDashboardData(data) {
  localStorage.setItem(
    personalDashboardStorageKey,
    JSON.stringify(data)
  );
}

/* ---------- Load ---------- */

function loadPersonalDashboardData() {
  const savedData = localStorage.getItem(personalDashboardStorageKey);

  if (!savedData) {
    return null;
  }

  return JSON.parse(savedData);
}

/* ---------- Clear ---------- */

function clearPersonalDashboardData() {
  localStorage.removeItem(personalDashboardStorageKey);
}