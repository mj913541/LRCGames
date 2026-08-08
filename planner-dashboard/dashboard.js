console.log("Dashboard JavaScript is connected!");

const timelineList = document.getElementById("timeline-list");

const startHour = 7;
const endHour = 18;

for (let hour = startHour; hour <= endHour; hour++) {

    for (let minute = 0; minute < 60; minute += 5) {

        const row = document.createElement("div");
        row.classList.add("timeline-item");

        if (minute === 0) {
            row.classList.add("timeline-hour");
        }

        const time = document.createElement("span");
        time.classList.add("timeline-time");

        const event = document.createElement("span");
        event.classList.add("timeline-event");

        const formattedMinute = minute.toString().padStart(2, "0");

        const displayHour = hour % 12 || 12;
        const amPm = hour < 12 ? "AM" : "PM";

        if (minute % 15 === 0) {
            time.textContent = `${displayHour}:${formattedMinute} ${amPm}`;
        } else {
            time.textContent = "";
        }

        row.appendChild(time);
        row.appendChild(event);

        timelineList.appendChild(row);
    }
}


// -------------------------
// Notebook Drawing
// -------------------------

const canvas = document.getElementById("notebook-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

}

resizeCanvas();

let isDrawing = false;

canvas.addEventListener("pointerdown", (event) => {

    isDrawing = true;

    ctx.beginPath();
    ctx.moveTo(event.offsetX, event.offsetY);

});

canvas.addEventListener("pointermove", (event) => {

    if (!isDrawing) {
        return;
    }

    ctx.lineTo(event.offsetX, event.offsetY);

    ctx.strokeStyle = "#3f5142";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.stroke();

});

canvas.addEventListener("pointerup", () => {

    isDrawing = false;

});

canvas.addEventListener("pointerleave", () => {

    isDrawing = false;

});