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

makeDrawingCanvas({
    canvasId: "notebook-canvas",
    penId: "pen-tool",
    eraserId: "eraser-tool",
    undoId: "undo-tool",
    clearId: "clear-tool"
});