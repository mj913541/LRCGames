/* ==========================================================
   PERSONAL DASHBOARD
   App JavaScript
   Touch-Friendly Version
   ========================================================== */

/* ---------- Goals ---------- */

const waterGoal = 10;
const walkingGoal = 30;

/* ---------- Starting Data ---------- */

let dashboardData = {
  waterCount: 0,
  walkingMinutes: 0,
  completedTasks: []
};

/* ---------- Elements ---------- */

const waterCountElement = document.getElementById("water-count");
const waterProgressElement = document.getElementById("water-progress");

const walkingCountElement = document.getElementById("walking-count");
const walkingProgressElement = document.getElementById("walking-progress");

const dailyScoreElement = document.getElementById("daily-score");

const addWaterButton = document.getElementById("add-water-button");
const removeWaterButton = document.getElementById("remove-water-button");

const walkButtons = document.querySelectorAll(".walk-button");
const taskCheckboxes = document.querySelectorAll(".task-checkbox");

/* ---------- Load Saved Data ---------- */

function loadDashboard() {
  const savedData = loadPersonalDashboardData();

  if (savedData) {
    dashboardData = savedData;
  }

  taskCheckboxes.forEach(function(task, index) {
    task.checked = dashboardData.completedTasks.includes(index);
  });

  updateDashboard();
}

/* ---------- Save Current Data ---------- */

function saveDashboard() {
  savePersonalDashboardData(dashboardData);
}

/* ---------- Touch-Friendly Button Feedback ---------- */

function addTouchFeedback(button) {
  button.addEventListener("touchstart", function() {
    button.classList.add("is-pressed");
  });

  button.addEventListener("touchend", function() {
    button.classList.remove("is-pressed");
  });

  button.addEventListener("touchcancel", function() {
    button.classList.remove("is-pressed");
  });
}

/* ---------- Water ---------- */

function addWater(amount) {
  dashboardData.waterCount = dashboardData.waterCount + amount;

  if (dashboardData.waterCount < 0) {
    dashboardData.waterCount = 0;
  }

  if (dashboardData.waterCount > waterGoal) {
    dashboardData.waterCount = waterGoal;
  }

  updateDashboard();
  saveDashboard();
}

/* ---------- Walking ---------- */

function addWalkingMinutes(amount) {
  dashboardData.walkingMinutes = dashboardData.walkingMinutes + amount;

  if (dashboardData.walkingMinutes < 0) {
    dashboardData.walkingMinutes = 0;
  }

  if (dashboardData.walkingMinutes > walkingGoal) {
    dashboardData.walkingMinutes = walkingGoal;
  }

  updateDashboard();
  saveDashboard();
}

/* ---------- Tasks ---------- */

function updateCompletedTasks() {
  dashboardData.completedTasks = [];

  taskCheckboxes.forEach(function(task, index) {
    if (task.checked) {
      dashboardData.completedTasks.push(index);
    }
  });

  updateDashboard();
  saveDashboard();
}

/* ---------- Progress Helpers ---------- */

function getProgressPercent(currentAmount, goalAmount) {
  return Math.round((currentAmount / goalAmount) * 100);
}

/* ---------- Daily Score ---------- */

function calculateDailyScore() {
  let completedTasks = dashboardData.completedTasks.length;

  const taskScore = completedTasks / taskCheckboxes.length;
  const waterScore = dashboardData.waterCount / waterGoal;
  const walkingScore = dashboardData.walkingMinutes / walkingGoal;

  const totalScore = (taskScore + waterScore + walkingScore) / 3;

  return Math.round(totalScore * 100);
}

/* ---------- Update Dashboard ---------- */

function updateDashboard() {
  waterCountElement.textContent = dashboardData.waterCount;
  walkingCountElement.textContent = dashboardData.walkingMinutes;

  waterProgressElement.style.width =
    getProgressPercent(dashboardData.waterCount, waterGoal) + "%";

  walkingProgressElement.style.width =
    getProgressPercent(dashboardData.walkingMinutes, walkingGoal) + "%";

  dailyScoreElement.textContent = calculateDailyScore() + "%";
}

/* ---------- Button Events ---------- */

addWaterButton.addEventListener("click", function() {
  addWater(1);
});

removeWaterButton.addEventListener("click", function() {
  addWater(-1);
});

walkButtons.forEach(function(button) {
  button.addEventListener("click", function() {
    const minutes = Number(button.dataset.minutes);
    addWalkingMinutes(minutes);
  });
});

taskCheckboxes.forEach(function(task) {
  task.addEventListener("change", updateCompletedTasks);
});

/* ---------- Apply Touch Feedback ---------- */

const allButtons = document.querySelectorAll("button");

allButtons.forEach(function(button) {
  addTouchFeedback(button);
});

/* ---------- Start App ---------- */

loadDashboard();