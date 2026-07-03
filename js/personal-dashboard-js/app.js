/* ==========================================================
   PERSONAL DASHBOARD
   Main App
   ========================================================== */

const dashboardData = {
  energy: "normal",
  waterCount: 0,
  walkingMinutes: 0,
  completedTasks: []
};

const savedData = loadPersonalDashboardData();

if (savedData) {
  dashboardData.energy = savedData.energy || "normal";
  dashboardData.waterCount = savedData.waterCount || 0;
  dashboardData.walkingMinutes = savedData.walkingMinutes || 0;
  dashboardData.completedTasks = savedData.completedTasks || [];
}

const waterGoal = 10;
const walkingGoal = 30;

const energyButtons = document.querySelectorAll(".energy-button");
const waterCount = document.getElementById("water-count");
const waterProgress = document.getElementById("water-progress");
const addWaterButton = document.getElementById("add-water-button");
const removeWaterButton = document.getElementById("remove-water-button");

const walkingCount = document.getElementById("walking-count");
const walkingProgress = document.getElementById("walking-progress");
const walkButtons = document.querySelectorAll(".walk-button");

const taskCheckboxes = document.querySelectorAll(".task-checkbox");
const dailyScore = document.getElementById("daily-score");

function saveDashboard() {
  savePersonalDashboardData(dashboardData);
}

function updateProgressBar(element, current, goal) {
  const percent = Math.min(100, Math.max(0, (current / goal) * 100));
  element.style.width = percent + "%";
}

function updateScore() {
  const taskTotal = taskCheckboxes.length;
  const taskDone = dashboardData.completedTasks.length;

  const taskScore = taskDone / taskTotal;
  const waterScore = dashboardData.waterCount / waterGoal;
  const walkingScore = dashboardData.walkingMinutes / walkingGoal;

  const score = Math.round(((taskScore + waterScore + walkingScore) / 3) * 100);

  dailyScore.textContent = score + "%";
}

function refreshDashboard() {
  waterCount.textContent = dashboardData.waterCount;
  walkingCount.textContent = dashboardData.walkingMinutes;

  updateProgressBar(waterProgress, dashboardData.waterCount, waterGoal);
  updateProgressBar(walkingProgress, dashboardData.walkingMinutes, walkingGoal);

  energyButtons.forEach(function(button) {
    button.classList.remove("selected");

    if (button.dataset.energy === dashboardData.energy) {
      button.classList.add("selected");
    }
  });

  taskCheckboxes.forEach(function(checkbox, index) {
    checkbox.checked = dashboardData.completedTasks.includes(index);
  });

  updateScore();
  saveDashboard();
}

energyButtons.forEach(function(button) {
  button.addEventListener("click", function() {
    dashboardData.energy = button.dataset.energy;
    refreshDashboard();
  });
});

addWaterButton.addEventListener("click", function() {
  dashboardData.waterCount = Math.min(waterGoal, dashboardData.waterCount + 1);
  refreshDashboard();
});

removeWaterButton.addEventListener("click", function() {
  dashboardData.waterCount = Math.max(0, dashboardData.waterCount - 1);
  refreshDashboard();
});

walkButtons.forEach(function(button) {
  button.addEventListener("click", function() {
    const minutes = Number(button.dataset.minutes);
    dashboardData.walkingMinutes = Math.min(
      walkingGoal,
      Math.max(0, dashboardData.walkingMinutes + minutes)
    );
    refreshDashboard();
  });
});

taskCheckboxes.forEach(function(checkbox, index) {
  checkbox.addEventListener("change", function() {
    if (checkbox.checked) {
      if (!dashboardData.completedTasks.includes(index)) {
        dashboardData.completedTasks.push(index);
      }
    } else {
      dashboardData.completedTasks = dashboardData.completedTasks.filter(function(taskIndex) {
        return taskIndex !== index;
      });
    }

    refreshDashboard();
  });
});

document.querySelectorAll("button").forEach(function(button) {
  button.addEventListener("touchstart", function() {
    button.classList.add("is-pressed");
  });

  button.addEventListener("touchend", function() {
    button.classList.remove("is-pressed");
  });

  button.addEventListener("touchcancel", function() {
    button.classList.remove("is-pressed");
  });
});

refreshDashboard();