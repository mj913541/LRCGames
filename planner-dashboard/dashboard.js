import { auth, db } from "../js/firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

console.log("Dashboard JavaScript is connected!");

// =====================================================
// AUTH + FIRESTORE TEST
// =====================================================

onAuthStateChanged(auth, async user => {
    if (!user) {
        console.log("No Firebase user is signed in.");
        window.location.href = "../index.html";
        return;
    }

    console.log("Signed in as:", user.email);
    console.log("Firestore connection:", db);

    try {
        await setDoc(
            doc(
                db,
                "plannerDashboardUsers",
                "mj",
                "test",
                "dashboard"
            ),
            {
                message: "Planner Firebase is working!",
                email: user.email,
                updatedAt: serverTimestamp()
            }
        );

        console.log("Planner test saved successfully!");
    } catch (error) {
        console.error("Planner test save failed:", error);
    }
});

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

            const formattedMinute = String(minute).padStart(2, "0");
            const displayHour = hour % 12 || 12;
            const amPm = hour < 12 ? "AM" : "PM";

            if (minute % 15 === 0) {
                time.textContent = `${displayHour}:${formattedMinute} ${amPm}`;
            }

            row.appendChild(time);
            row.appendChild(event);
            timelineList.appendChild(row);
        }
    }
}

// =====================================================
// NOTEBOOK DRAWING
// =====================================================

makeDrawingCanvas({
    canvasId: "notebook-canvas",
    penId: "pen-tool",
    eraserId: "eraser-tool",
    undoId: "undo-tool",
    clearId: "clear-tool"
});