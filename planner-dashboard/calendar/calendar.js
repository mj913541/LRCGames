console.log("Calendar JavaScript is connected!");

// =====================================================
// HELPERS
// =====================================================

function formatDateForURL(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getDateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const dateString = params.get("date");

    if (!dateString) {
        return new Date();
    }

    const [year, month, day] = dateString.split("-");
    return new Date(Number(year), Number(month) - 1, Number(day));
}

function getMonday(date) {
    const monday = new Date(date);
    const day = monday.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    monday.setDate(monday.getDate() + difference);
    return monday;
}

function updateURLDate(date) {
    const dateString = formatDateForURL(date);
    const newURL = `${window.location.pathname}?date=${dateString}`;
    window.history.replaceState({}, "", newURL);
}

// =====================================================
// MONTH VIEW
// =====================================================

const monthGrid = document.getElementById("month-grid");

if (monthGrid) {
    createMonthCalendar(2026, 7);
}

function createMonthCalendar(year, month) {
    monthGrid.innerHTML = "";

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numberOfDays = lastDay.getDate();

    const dayNames = [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat"
    ];

    dayNames.forEach(dayName => {
        const heading = document.createElement("div");
        heading.classList.add("calendar-day-heading");
        heading.textContent = dayName;
        monthGrid.appendChild(heading);
    });

    const startingDay = firstDay.getDay();

    for (let i = 0; i < startingDay; i++) {
        const emptyDay = document.createElement("div");
        emptyDay.classList.add("calendar-day", "calendar-day-empty");
        monthGrid.appendChild(emptyDay);
    }

    for (let day = 1; day <= numberOfDays; day++) {
        const date = new Date(year, month, day);
        const dateString = formatDateForURL(date);

        const dayBox = document.createElement("button");
        dayBox.type = "button";
        dayBox.classList.add("calendar-day");
        dayBox.dataset.date = dateString;

        const dayNumber = document.createElement("span");
        dayNumber.classList.add("calendar-day-number");
        dayNumber.textContent = day;

        const dayContent = document.createElement("div");
        dayContent.classList.add("calendar-day-content");

        dayBox.appendChild(dayNumber);
        dayBox.appendChild(dayContent);

        dayBox.addEventListener("click", () => {
            window.location.href = `./week.html?date=${dateString}`;
        });

        monthGrid.appendChild(dayBox);
    }
}

// =====================================================
// WEEK VIEW
// =====================================================

const weeklySpread = document.getElementById("weekly-spread");

if (weeklySpread) {
    let selectedWeekDate = getDateFromURL();

    const previousWeekButton = document.getElementById("previous-week");
    const todayWeekButton = document.getElementById("today-week");
    const nextWeekButton = document.getElementById("next-week");

    function renderWeek() {
        const monday = getMonday(selectedWeekDate);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const weekTitle = document.getElementById("week-title");

        weekTitle.textContent =
            `${monday.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric"
            })} – ${sunday.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric"
            })}`;

        const daySections = document.querySelectorAll(".week-day");

        daySections.forEach((section, index) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + index);

            const dateText = section.querySelector(".day-date");
            const dateString = formatDateForURL(date);

            dateText.textContent = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric"
            });

            section.dataset.date = dateString;

            section.onclick = () => {
                window.location.href = `./day.html?date=${dateString}`;
            };
        });

        updateURLDate(selectedWeekDate);
    }

    previousWeekButton.addEventListener("click", () => {
        selectedWeekDate.setDate(selectedWeekDate.getDate() - 7);
        renderWeek();
    });

    todayWeekButton.addEventListener("click", () => {
        selectedWeekDate = new Date();
        renderWeek();
    });

    nextWeekButton.addEventListener("click", () => {
        selectedWeekDate.setDate(selectedWeekDate.getDate() + 7);
        renderWeek();
    });

    renderWeek();
}

// =====================================================
// DAY VIEW
// =====================================================

const dayTimeline = document.getElementById("day-timeline");

if (dayTimeline) {
    let selectedDay = getDateFromURL();

    const dayTitle = document.getElementById("day-title");
    const previousDayButton = document.getElementById("previous-day");
    const todayDayButton = document.getElementById("today-day");
    const nextDayButton = document.getElementById("next-day");

    function renderDay() {
        dayTitle.textContent = selectedDay.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });

        dayTimeline.innerHTML = "";

        const startHour = 6;
        const endHour = 22;

        for (let hour = startHour; hour <= endHour; hour++) {
            for (let minute = 0; minute < 60; minute += 5) {
                const row = document.createElement("div");
                row.classList.add("day-time-row");

                if (minute === 0) {
                    row.classList.add("day-hour-row");
                }

                const time = document.createElement("span");
                time.classList.add("day-time");

                const slot = document.createElement("div");
                slot.classList.add("day-slot");

                const dateString = formatDateForURL(selectedDay);
                const formattedMinute = String(minute).padStart(2, "0");

                slot.dataset.date = dateString;
                slot.dataset.time = `${String(hour).padStart(2, "0")}:${formattedMinute}`;

                if (minute % 15 === 0) {
                    const displayHour = hour % 12 || 12;
                    const amPm = hour < 12 ? "AM" : "PM";

                    time.textContent =
                        `${displayHour}:${formattedMinute} ${amPm}`;
                }

                row.appendChild(time);
                row.appendChild(slot);
                dayTimeline.appendChild(row);
            }
        }

        updateURLDate(selectedDay);
    }

    previousDayButton.addEventListener("click", () => {
        selectedDay.setDate(selectedDay.getDate() - 1);
        renderDay();
    });

    todayDayButton.addEventListener("click", () => {
        selectedDay = new Date();
        renderDay();
    });

    nextDayButton.addEventListener("click", () => {
        selectedDay.setDate(selectedDay.getDate() + 1);
        renderDay();
    });

    renderDay();
}

makeDrawingCanvas({
    canvasId: "daily-notes-canvas",
    penId: "daily-pen",
    eraserId: "daily-eraser",
    undoId: "daily-undo",
    clearId: "daily-clear"
});

const weeklyCanvases = [
    "monday-notes",
    "tuesday-notes",
    "wednesday-notes",
    "thursday-notes",
    "friday-notes",
    "saturday-notes",
    "sunday-notes"
];

let activeWeeklyDrawing = null;

weeklyCanvases.forEach(canvasId => {
    const drawing = makeDrawingCanvas({
        canvasId: canvasId,
        penId: "week-pen",
        eraserId: "week-eraser",
        undoId: "week-undo",
        clearId: "week-clear"
    });

    if (!drawing) {
        return;
    }

    drawing.canvas.addEventListener("pointerdown", () => {
        activeWeeklyDrawing = drawing;
    });
});

const weekUndoButton = document.getElementById("week-undo");
const weekClearButton = document.getElementById("week-clear");

if (weekUndoButton && weekClearButton) {
    weekUndoButton.addEventListener("click", () => {
        if (activeWeeklyDrawing) {
            activeWeeklyDrawing.undo();
        }
    });

    weekClearButton.addEventListener("click", () => {
        if (activeWeeklyDrawing) {
            activeWeeklyDrawing.clear();
        }
    });
}