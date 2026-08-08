function makeDrawingCanvas(options) {
    const canvas = document.getElementById(options.canvasId);

    if (!canvas) {
        return null;
    }

    const ctx = canvas.getContext("2d");

    const penButton = document.getElementById(options.penId);
    const eraserButton = document.getElementById(options.eraserId);
    const undoButton = document.getElementById(options.undoId);
    const clearButton = document.getElementById(options.clearId);

    let isDrawing = false;
    let currentTool = "pen";
    let strokes = [];
    let history = [];
    let currentStroke = null;

    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        redraw();
    }

    function redraw() {
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        strokes.forEach(stroke => {
            if (!stroke.points || stroke.points.length < 2) {
                return;
            }

            ctx.beginPath();

            const firstPoint = stroke.points[0];
            ctx.moveTo(
                firstPoint.x * canvas.width,
                firstPoint.y * canvas.height
            );

            for (let i = 1; i < stroke.points.length; i++) {
                const point = stroke.points[i];

                ctx.lineTo(
                    point.x * canvas.width,
                    point.y * canvas.height
                );
            }

            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            if (stroke.tool === "eraser") {
                ctx.globalCompositeOperation = "destination-out";
                ctx.lineWidth = 18;
            } else {
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = "#3f5142";
                ctx.lineWidth = 2;
            }

            ctx.stroke();
        });

        ctx.globalCompositeOperation = "source-over";
    }

    function saveHistory() {
        history.push(JSON.stringify(strokes));
    }

    function selectTool(tool) {
        currentTool = tool;

        if (options.useSharedToolbar !== true) {
            penButton?.classList.remove("active");
            eraserButton?.classList.remove("active");

            if (tool === "pen") {
                penButton?.classList.add("active");
            }

            if (tool === "eraser") {
                eraserButton?.classList.add("active");
            }
        }
    }

    function undo() {
        if (history.length === 0) {
            return;
        }

        strokes = JSON.parse(history.pop());
        redraw();
        notifyChange();
    }

    function clear() {
        saveHistory();
        strokes = [];
        redraw();
        notifyChange();
    }

    function notifyChange() {
        if (typeof options.onChange === "function") {
            options.onChange(strokes);
        }
    }

    function loadDrawing(savedStrokes) {
        history = [];

        if (Array.isArray(savedStrokes)) {
            strokes = savedStrokes;
        } else {
            strokes = [];
        }

        redraw();
    }

    function getDrawing() {
        return strokes;
    }

    resizeCanvas();
    selectTool("pen");

    canvas.addEventListener("pointerdown", event => {
        isDrawing = true;
        saveHistory();

        const rect = canvas.getBoundingClientRect();

        currentStroke = {
            tool: currentTool,
            points: [{
                x: (event.clientX - rect.left) / rect.width,
                y: (event.clientY - rect.top) / rect.height
            }]
        };

        strokes.push(currentStroke);
    });

    canvas.addEventListener("pointermove", event => {
        if (!isDrawing || !currentStroke) {
            return;
        }

        const rect = canvas.getBoundingClientRect();

        currentStroke.points.push({
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height
        });

        redraw();
    });

    function finishStroke() {
        if (!isDrawing) {
            return;
        }

        isDrawing = false;
        currentStroke = null;
        notifyChange();
    }

    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);

    if (options.useSharedToolbar !== true) {
        penButton?.addEventListener("click", () => {
            selectTool("pen");
        });

        eraserButton?.addEventListener("click", () => {
            selectTool("eraser");
        });

        undoButton?.addEventListener("click", undo);
        clearButton?.addEventListener("click", clear);
    }

    window.addEventListener("resize", resizeCanvas);

    return {
        canvas,
        selectTool,
        undo,
        clear,
        loadDrawing,
        getDrawing
    };
}