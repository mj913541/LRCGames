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

const penButton = document.getElementById("pen-tool");
const eraserButton = document.getElementById("eraser-tool");
const undoButton = document.getElementById("undo-tool");
const clearButton = document.getElementById("clear-tool");

let isDrawing = false;
let currentTool = "pen";

let drawingHistory = [];


// -------------------------
// Canvas Size
// -------------------------

function resizeCanvas() {

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

}

resizeCanvas();


// -------------------------
// Save Drawing State
// -------------------------

function saveDrawingState() {

    const image = canvas.toDataURL();

    drawingHistory.push(image);

}


// -------------------------
// Restore Drawing State
// -------------------------

function restoreDrawingState(imageData) {

    const image = new Image();

    image.onload = () => {

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
        );

    };

    image.src = imageData;

}


// -------------------------
// Tool Selection
// -------------------------

function selectTool(tool) {

    currentTool = tool;

    penButton.classList.remove("active");
    eraserButton.classList.remove("active");

    if (tool === "pen") {

        penButton.classList.add("active");

    }

    if (tool === "eraser") {

        eraserButton.classList.add("active");

    }

}

selectTool("pen");


// -------------------------
// Drawing
// -------------------------

canvas.addEventListener("pointerdown", (event) => {

    isDrawing = true;

    saveDrawingState();

    ctx.beginPath();
    ctx.moveTo(event.offsetX, event.offsetY);

});


canvas.addEventListener("pointermove", (event) => {

    if (!isDrawing) {
        return;
    }

    ctx.lineTo(event.offsetX, event.offsetY);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";


    if (currentTool === "pen") {

        ctx.globalCompositeOperation = "source-over";

        ctx.strokeStyle = "#3f5142";
        ctx.lineWidth = 2;

    }


    if (currentTool === "eraser") {

        ctx.globalCompositeOperation = "destination-out";

        ctx.lineWidth = 18;

    }


    ctx.stroke();

});


canvas.addEventListener("pointerup", () => {

    isDrawing = false;

});


canvas.addEventListener("pointerleave", () => {

    isDrawing = false;

});


// -------------------------
// Buttons
// -------------------------

penButton.addEventListener("click", () => {

    selectTool("pen");

});


eraserButton.addEventListener("click", () => {

    selectTool("eraser");

});


undoButton.addEventListener("click", () => {

    if (drawingHistory.length === 0) {
        return;
    }

    const previousDrawing = drawingHistory.pop();

    restoreDrawingState(previousDrawing);

});


clearButton.addEventListener("click", () => {

    saveDrawingState();

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

});