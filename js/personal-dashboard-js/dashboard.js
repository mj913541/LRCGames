/* ==========================================================
   PERSONAL DASHBOARD
   Dashboard JavaScript
   ========================================================== */

/* ---------- Dashboard Goals ---------- */

const dashboardGoals = {

    water: 10,

    walking: 30

};

/* ---------- Dashboard Data ---------- */

function getDashboardData() {

    return dashboardData;
}

/* ---------- Dashboard Score ---------- */

function calculateDashboardScore() {

    let completedTasks = dashboardData.completedTasks.length;

    let taskScore =
        completedTasks / taskCheckboxes.length;

    let waterScore =
        dashboardData.waterCount / dashboardGoals.water;

    let walkingScore =
        dashboardData.walkingMinutes / dashboardGoals.walking;

    let totalScore =
        (taskScore + waterScore + walkingScore) / 3;

    return Math.round(totalScore * 100);

}

/* ---------- Dashboard Refresh ---------- */

function refreshDashboard() {

    waterCountElement.textContent =
        dashboardData.waterCount;

    walkingCountElement.textContent =
        dashboardData.walkingMinutes;

    updateProgressBar(
        waterProgressElement,
        dashboardData.waterCount,
        dashboardGoals.water
    );

    updateProgressBar(
        walkingProgressElement,
        dashboardData.walkingMinutes,
        dashboardGoals.walking
    );

    dailyScoreElement.textContent =
        calculateDashboardScore() + "%";

}