import { auth, db } from "../../js/firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// =====================================================
// SETTINGS
// =====================================================

const PLANNER_EMAILS = new Set([
    "malbrecht@sd308.org",
    "malbrecht3317@gmail.com"
]);

const PLANNER_PROFILE_ID = "mj";

const DAILY_EXERCISES = [
    "Push-ups",
    "Squats",
    "Glute bridges",
    "Backpack rows",
    "Calf raises",
    "Bird dog"
];

const DAYS = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun"
];

// =====================================================
// STATE
// =====================================================

let currentUser = null;
let workoutData = null;
let saveTimer = null;

const today = new Date();
const todayKey = formatDateKey(today);
const weekStart = getMonday(today);
const weekKey = formatDateKey(weekStart);

// =====================================================
// DOM HELPERS
// =====================================================

const $ = id => document.getElementById(id);

// =====================================================
// DATE HELPERS
// =====================================================

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getMonday(date) {
    const monday = new Date(date);

    monday.setHours(0, 0, 0, 0);

    const day = monday.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    monday.setDate(monday.getDate() + difference);

    return monday;
}

function addDays(date, amount) {
    const copy = new Date(date);

    copy.setDate(copy.getDate() + amount);

    return copy;
}

function weekDateKeys() {
    return DAYS.map((_, index) => {
        return formatDateKey(
            addDays(weekStart, index)
        );
    });
}

function displayDate(date) {
    return date.toLocaleDateString(
        "en-US",
        {
            weekday: "long",
            month: "long",
            day: "numeric"
        }
    );
}

function displayShortDate(dateKey) {
    const date = new Date(
        `${dateKey}T12:00:00`
    );

    return date.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric"
        }
    );
}

// =====================================================
// FIRESTORE PATH
// =====================================================

function workoutDoc() {
    return doc(
        db,
        "plannerDashboardUsers",
        PLANNER_PROFILE_ID,
        "workoutWeeks",
        weekKey
    );
}

// =====================================================
// DEFAULT DATA
// =====================================================

function createDefaultWorkoutData() {
    return {
        weekStart: weekKey,
        lifting: [],
        cardio: [],
        dailyExercises: {},
        stretching: {},
        notes: {},
        updatedAt: null
    };
}

// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "../../index.html";
        return;
    }

    const email =
        (user.email || "").toLowerCase();

    if (!PLANNER_EMAILS.has(email)) {
        await signOut(auth);
        window.location.href = "../../index.html";
        return;
    }

    currentUser = user;

    await loadWorkoutData();

    bindEvents();
    renderEverything();
});

// =====================================================
// LOAD
// =====================================================

async function loadWorkoutData() {
    setSaveStatus("Loading…");

    try {
        const snapshot =
            await getDoc(
                workoutDoc()
            );

        if (snapshot.exists()) {
            workoutData = {
                ...createDefaultWorkoutData(),
                ...snapshot.data()
            };
        } else {
            workoutData =
                createDefaultWorkoutData();
        }

        workoutData.lifting =
            workoutData.lifting || [];

        workoutData.cardio =
            workoutData.cardio || [];

        workoutData.dailyExercises =
            workoutData.dailyExercises || {};

        workoutData.stretching =
            workoutData.stretching || {};

        workoutData.notes =
            workoutData.notes || {};

        setSaveStatus("Saved");
    } catch (error) {
        console.error(
            "Workout load failed:",
            error
        );

        setSaveStatus("Load failed");
    }
}

// =====================================================
// SAVE
// =====================================================

function queueSave() {
    setSaveStatus("Saving…");

    clearTimeout(saveTimer);

    saveTimer = setTimeout(
        saveWorkoutData,
        500
    );
}

async function saveWorkoutData() {
    if (!currentUser || !workoutData) {
        return;
    }

    try {
        await setDoc(
            workoutDoc(),
            {
                ...workoutData,
                updatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );

        setSaveStatus("Saved");
    } catch (error) {
        console.error(
            "Workout save failed:",
            error
        );

        setSaveStatus("Save failed");
    }
}

function setSaveStatus(text) {
    const status =
        $("save-status");

    if (status) {
        status.textContent = text;
    }
}

// =====================================================
// EVENT BINDING
// =====================================================

function bindEvents() {
    $("add-lift")?.addEventListener(
        "click",
        openLiftingDialog
    );

    $("close-lifting-dialog")?.addEventListener(
        "click",
        closeLiftingDialog
    );

    $("lifting-form")?.addEventListener(
        "submit",
        saveLiftingExercise
    );

    document
        .querySelectorAll(
            "[data-cardio]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    addCardio(
                        Number(
                            button.dataset.cardio
                        )
                    );
                }
            );
        });

    document
        .querySelectorAll(
            "[data-stretch]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    toggleStretch(
                        button.dataset.stretch
                    );
                }
            );
        });

    $("workout-notes")?.addEventListener(
        "input",
        event => {
            workoutData.notes[todayKey] =
                event.target.value;

            queueSave();
        }
    );
}

// =====================================================
// MAIN RENDER
// =====================================================

function renderEverything() {
    $("workout-date").textContent =
        displayDate(today);

    renderSummary();
    renderLifting();
    renderCardio();
    renderDailyExercises();
    renderStretching();
    renderNotes();
    renderWeekGlance();
}

// =====================================================
// SUMMARY
// =====================================================

function renderSummary() {
    const weekKeys =
        weekDateKeys();

    const liftingDates =
        new Set(
            workoutData.lifting
                .filter(entry =>
                    weekKeys.includes(
                        entry.date
                    )
                )
                .map(
                    entry => entry.date
                )
        );

    const cardioMinutes =
        workoutData.cardio
            .filter(entry =>
                weekKeys.includes(
                    entry.date
                )
            )
            .reduce(
                (total, entry) =>
                    total +
                    Number(
                        entry.minutes || 0
                    ),
                0
            );

    const dailyDays =
        weekKeys.filter(dateKey => {
            return areDailyExercisesComplete(
                dateKey
            );
        }).length;

    const stretchDays =
        weekKeys.filter(dateKey => {
            return hasStretching(
                dateKey
            );
        }).length;

    $("lifting-summary").textContent =
        liftingDates.size;

    $("cardio-summary").textContent =
        cardioMinutes;

    $("daily-summary").textContent =
        `${dailyDays} / 7`;

    $("stretch-summary").textContent =
        `${stretchDays} / 7`;
}

// =====================================================
// LIFTING
// =====================================================

function renderLifting() {
    const list =
        $("lifting-list");

    const todayEntries =
        workoutData.lifting.filter(
            entry =>
                entry.date === todayKey
        );

    if (!todayEntries.length) {
        list.innerHTML = `
            <p class="empty-message">
                No lifting exercises yet.
            </p>
        `;

        return;
    }

    list.innerHTML =
        todayEntries
            .map(entry => {
                return `
                    <div class="workout-entry">
                        <div>
                            <div class="workout-entry-title">
                                ${escapeHTML(entry.exercise)}
                            </div>

                            <div class="workout-entry-meta">
                                ${entry.sets} × ${entry.reps}
                                ${
                                    Number(entry.weight)
                                        ? ` @ ${entry.weight} lb`
                                        : ""
                                }
                            </div>
                        </div>

                        <button
                            class="delete-workout"
                            type="button"
                            data-delete-lift="${entry.id}"
                            aria-label="Delete exercise"
                        >
                            ×
                        </button>
                    </div>
                `;
            })
            .join("");

    list
        .querySelectorAll(
            "[data-delete-lift]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    workoutData.lifting =
                        workoutData.lifting.filter(
                            entry =>
                                entry.id !==
                                button.dataset.deleteLift
                        );

                    renderEverything();
                    queueSave();
                }
            );
        });
}

function openLiftingDialog() {
    $("lifting-dialog")?.showModal();
}

function closeLiftingDialog() {
    $("lifting-dialog")?.close();
    $("lifting-form")?.reset();
}

function saveLiftingExercise(event) {
    event.preventDefault();

    const form =
        new FormData(
            event.currentTarget
        );

    const entry = {
        id: makeId(),
        date: todayKey,
        exercise:
            form
                .get("exercise")
                .trim(),
        sets:
            Number(
                form.get("sets")
            ),
        reps:
            Number(
                form.get("reps")
            ),
        weight:
            Number(
                form.get("weight") || 0
            )
    };

    workoutData.lifting.push(
        entry
    );

    closeLiftingDialog();
    renderEverything();
    queueSave();
}

// =====================================================
// CARDIO
// =====================================================

function addCardio(minutes) {
    workoutData.cardio.push({
        id: makeId(),
        date: todayKey,
        minutes
    });

    renderEverything();
    queueSave();
}

function getCardioMinutes(dateKey) {
    return workoutData.cardio
        .filter(
            entry =>
                entry.date === dateKey
        )
        .reduce(
            (total, entry) =>
                total +
                Number(
                    entry.minutes || 0
                ),
            0
        );
}

function renderCardio() {
    $("today-cardio").textContent =
        getCardioMinutes(
            todayKey
        );
}

// =====================================================
// DAILY EXERCISES
// =====================================================

function renderDailyExercises() {
    const container =
        $("daily-exercises");

    const state =
        workoutData.dailyExercises[
            todayKey
        ] || {};

    container.innerHTML =
        DAILY_EXERCISES
            .map(exercise => {
                const complete =
                    !!state[exercise];

                return `
                    <label class="daily-exercise-row${complete ? " is-done" : ""}">
                        <input
                            type="checkbox"
                            data-exercise="${escapeHTML(exercise)}"
                            ${complete ? "checked" : ""}
                        >

                        <span class="daily-exercise-name">
                            ${escapeHTML(exercise)}
                        </span>

                        <span class="exercise-reps">
                            10 reps
                        </span>
                    </label>
                `;
            })
            .join("");

    container
        .querySelectorAll(
            "[data-exercise]"
        )
        .forEach(input => {
            input.addEventListener(
                "change",
                () => {
                    workoutData.dailyExercises[
                        todayKey
                    ] =
                        workoutData.dailyExercises[
                            todayKey
                        ] || {};

                    workoutData.dailyExercises[
                        todayKey
                    ][
                        input.dataset.exercise
                    ] =
                        input.checked;

                    renderEverything();
                    queueSave();
                }
            );
        });
}

function areDailyExercisesComplete(
    dateKey
) {
    const state =
        workoutData.dailyExercises[
            dateKey
        ] || {};

    return DAILY_EXERCISES.every(
        exercise =>
            !!state[exercise]
    );
}

// =====================================================
// STRETCHING
// =====================================================

function toggleStretch(type) {
    const current =
        workoutData.stretching[
            todayKey
        ] || [];

    if (current.includes(type)) {
        workoutData.stretching[
            todayKey
        ] =
            current.filter(
                item =>
                    item !== type
            );
    } else {
        workoutData.stretching[
            todayKey
        ] = [
            ...current,
            type
        ];
    }

    renderEverything();
    queueSave();
}

function hasStretching(dateKey) {
    const stretches =
        workoutData.stretching[
            dateKey
        ];

    return (
        Array.isArray(stretches) &&
        stretches.length > 0
    );
}

function renderStretching() {
    const current =
        workoutData.stretching[
            todayKey
        ] || [];

    document
        .querySelectorAll(
            "[data-stretch]"
        )
        .forEach(button => {
            button.classList.toggle(
                "is-active",
                current.includes(
                    button.dataset.stretch
                )
            );
        });

    const status =
        $("stretch-status");

    if (!current.length) {
        status.textContent =
            "Nothing logged today.";
    } else {
        status.textContent =
            `Logged: ${current.join(", ")}`;
    }
}

// =====================================================
// NOTES
// =====================================================

function renderNotes() {
    $("workout-notes").value =
        workoutData.notes[
            todayKey
        ] || "";
}

// =====================================================
// WEEK AT A GLANCE
// =====================================================

function renderWeekGlance() {
    const container =
        $("week-glance");

    container.innerHTML =
        weekDateKeys()
            .map(
                (dateKey, index) => {
                    const hasLift =
                        workoutData.lifting.some(
                            entry =>
                                entry.date ===
                                dateKey
                        );

                    const cardio =
                        getCardioMinutes(
                            dateKey
                        );

                    const daily =
                        areDailyExercisesComplete(
                            dateKey
                        );

                    const stretch =
                        hasStretching(
                            dateKey
                        );

                    const icons = [
                        hasLift
                            ? "🏋️"
                            : "",
                        cardio
                            ? "♥"
                            : "",
                        daily
                            ? "✓"
                            : "",
                        stretch
                            ? "❀"
                            : ""
                    ]
                        .filter(Boolean)
                        .join(" ");

                    const labels = [
                        hasLift
                            ? "Lift"
                            : "",
                        cardio
                            ? `${cardio} min`
                            : "",
                        daily
                            ? "Daily"
                            : "",
                        stretch
                            ? "Stretch"
                            : ""
                    ]
                        .filter(Boolean)
                        .join(" • ");

                    return `
                        <div class="glance-day">
                            <strong>
                                ${DAYS[index]}
                            </strong>

                            <span class="glance-date">
                                ${displayShortDate(dateKey)}
                            </span>

                            <div class="glance-icons">
                                ${icons || "○"}
                            </div>

                            <div class="glance-label">
                                ${labels || "Open"}
                            </div>
                        </div>
                    `;
                }
            )
            .join("");
}

// =====================================================
// UTILITIES
// =====================================================

function makeId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()}`;
}

function escapeHTML(value = "") {
    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}