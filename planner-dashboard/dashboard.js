import { auth, db } from "../js/firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

console.log("Dashboard JavaScript is connected!");

let plannerReady = false;

// =====================================================
// FIREBASE AUTH
// =====================================================

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "../index.html";
        return;
    }

    console.log("Signed in as:", user.email);
    plannerReady = true;

    await loadDashboardNotebook();
});

// =====================================================
// DASHBOARD NOTEBOOK FIRESTORE
// =====================================================

const dashboardDrawingRef = doc(
    db,
    "plannerDashboardUsers",
    "mj",
    "drawings",
    "dashboard-notebook"
);

let notebookSaveTimer = null;

const dashboardNotebook = makeDrawingCanvas({
    canvasId: "notebook-canvas",
    penId: "pen-tool",
    eraserId: "eraser-tool",
    undoId: "undo-tool",
    clearId: "clear-tool",

    onChange: strokes => {
        if (!plannerReady) {
            return;
        }

        clearTimeout(notebookSaveTimer);

        notebookSaveTimer = setTimeout(() => {
            saveDashboardNotebook(strokes);
        }, 500);
    }
});

async function loadDashboardNotebook() {
    try {
        const snapshot = await getDoc(dashboardDrawingRef);

        if (!snapshot.exists()) {
            return;
        }

        dashboardNotebook?.loadDrawing(
            snapshot.data().strokes || []
        );

        console.log("Dashboard notebook loaded.");
    } catch (error) {
        console.error(
            "Could not load dashboard notebook:",
            error
        );
    }
}

async function saveDashboardNotebook(strokes) {
    try {
        await setDoc(
            dashboardDrawingRef,
            {
                strokes,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );

        console.log("Dashboard notebook saved.");
    } catch (error) {
        console.error(
            "Could not save dashboard notebook:",
            error
        );
    }
}

// =====================================================
// TIMELINE
// =====================================================

const timelineList = document.getElementById("timeline-list");

if (timelineList) {
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

            const formattedMinute =
                String(minute).padStart(2, "0");

            const displayHour = hour % 12 || 12;
            const amPm = hour < 12 ? "AM" : "PM";

            if (minute % 15 === 0) {
                time.textContent =
                    `${displayHour}:${formattedMinute} ${amPm}`;
            }

            row.appendChild(time);
            row.appendChild(event);

            timelineList.appendChild(row);
        }
    }
}