console.log("Calendar JavaScript is connected!");


// ---------------------------------
// Monthly Calendar
// ---------------------------------

const monthGrid = document.getElementById("month-grid");

if (monthGrid) {

    const year = 2026;
    const month = 7;

    const monthName = "August";

    createMonthCalendar(year, month, monthName);
}


// ---------------------------------
// Create Month Calendar
// ---------------------------------

function createMonthCalendar(year, month, monthName) {

    const firstDay = new Date(year, month, 1);

    const lastDay = new Date(year, month + 1, 0);

    const numberOfDays = lastDay.getDate();


    // -----------------------------
    // Day-of-week headings
    // -----------------------------

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


    // -----------------------------
    // Empty spaces before day 1
    // -----------------------------

    const startingDay = firstDay.getDay();

    for (let i = 0; i < startingDay; i++) {

        const emptyDay = document.createElement("div");

        emptyDay.classList.add(
            "calendar-day",
            "calendar-day-empty"
        );

        monthGrid.appendChild(emptyDay);

    }


    // -----------------------------
    // Calendar days
    // -----------------------------

    for (let day = 1; day <= numberOfDays; day++) {

        const dayBox = document.createElement("button");

        dayBox.type = "button";

        dayBox.classList.add("calendar-day");


        const dayNumber = document.createElement("span");

        dayNumber.classList.add("calendar-day-number");

        dayNumber.textContent = day;


        const dayContent = document.createElement("div");

        dayContent.classList.add("calendar-day-content");


        dayBox.appendChild(dayNumber);

        dayBox.appendChild(dayContent);


        // -------------------------
        // Date stored on the box
        // -------------------------

        const dateString =
            `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        dayBox.dataset.date = dateString;


        // -------------------------
        // Click day → weekly spread
        // -------------------------

        dayBox.addEventListener("click", () => {

            window.location.href =
                `./week.html?date=${dateString}`;

        });


        monthGrid.appendChild(dayBox);

    }

}