function makeDrawingCanvas(options) {
    const canvas = document.getElementById(options.canvasId);

    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext("2d");

    const penButton = document.getElementById(options.penId);
    const eraserButton = document.getElementById(options.eraserId);
    const undoButton = document.getElementById(options.undoId);
    const clearButton = document.getElementById(options.clearId);

    let isDrawing = false;
    let currentTool = "pen";
    let drawingHistory = [];

    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    function saveDrawingState() {
        drawingHistory.push(canvas.toDataURL());
    }

    function restoreDrawingState(imageData) {
        const image = new Image();

        image.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        };

        image.src = imageData;
    }

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

    resizeCanvas();
    selectTool("pen");

    canvas.addEventListener("pointerdown", event => {
        isDrawing = true;
        saveDrawingState();

        ctx.beginPath();
        ctx.moveTo(event.offsetX, event.offsetY);
    });

    canvas.addEventListener("pointermove", event => {
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

    canvas.addEventListener("pointercancel", () => {
        isDrawing = false;
    });

    canvas.addEventListener("pointerleave", () => {
        isDrawing = false;
    });

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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
}