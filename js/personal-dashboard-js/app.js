/* ==========================================================
   PERSONAL DASHBOARD
   App JavaScript
   ========================================================== */

/* ---------- Starting Data ---------- */

let waterCount = 0;
let walkingMinutes = 0;

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

/* ---------- Goals ---------- */

const waterGoal = 10;
const walkingGoal = 30;

/* ---------- Water ---------- */

function addWater(amount) {
  waterCount = waterCount + amount;

  if (waterCount < 0) {
    waterCount = 0;
  }

  if (waterCount > waterGoal) {
    waterCount = waterGoal;
  }

  updateDashboard();
}

/* ---------- Walking ---------- */

function addWalkingMinutes(amount) {
  walkingMinutes = walkingMinutes + amount;

  if (walkingMinutes < 0) {
    walkingMinutes = 0;
  }

  if (walkingMinutes > walkingGoal) {
    walkingMinutes = walkingGoal;
  }

  updateDashboard();
}

/* ---------- Progress Helpers ---------- */

function getProgressPercent(currentAmount, goalAmount) {
  return Math.round((currentAmount / goalAmount) * 100);
}

/* ---------- Daily Score ---------- */

function calculateDailyScore() {
  let completedTasks = 0;

  taskCheckboxes.forEach(function(task) {
    if (task.checked) {
      completedTasks++;
    }
  });

  const taskScore = completedTasks / taskCheckboxes.length;
  const waterScore = waterCount / waterGoal;
  const walkingScore = walkingMinutes / walkingGoal;

  const totalScore = (taskScore + waterScore + walkingScore) / 3;

  return Math.round(totalScore * 100);
}

/* ---------- Update Dashboard ---------- */

function updateDashboard() {
  waterCountElement.textContent = waterCount;
  walkingCountElement.textContent = walkingMinutes;

  waterProgressElement.style.width =
    getProgressPercent(waterCount, waterGoal) + "%";

  walkingProgressElement.style.width =
    getProgressPercent(walkingMinutes, walkingGoal) + "%";

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
  task.addEventListener("change", updateDashboard);
});

/* ---------- Start App ---------- */

updateDashboard();