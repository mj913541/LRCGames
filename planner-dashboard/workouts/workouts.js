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

const DAYS = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun"
];

const DAILY_EXERCISES = [
    "Push-ups",
    "Squats",
    "Glute bridges",
    "Backpack rows",
    "Calf raises",
    "Bird dog"
];

// =====================================================
// ROLLING LIFTING PROGRAM
// =====================================================

const LIFTING_ROTATION = [
    {
        name: "Push A",
        focus: "Chest + shoulders + triceps",
        exercises: [
            exercise("Press", "8–12", true),
            exercise("Shoulder Press", "8–12", true),
            exercise("Flyes", "10–15"),
            exercise("Lateral Raise", "12–15", true),
            exercise("Kickbacks", "10–15")
        ]
    },

    {
        name: "Legs A",
        focus: "Squat emphasis",
        exercises: [
            exercise("Squat", "8–12", true),
            exercise("RDL", "8–12", true),
            exercise("Lunge", "8–12 / leg", true),
            exercise("Leg Curl", "10–15"),
            exercise("Outer Lift", "12–15 / side"),
            exercise("Calf Raise", "12–20")
        ]
    },

    {
        name: "Pull A",
        focus: "Back + biceps",
        exercises: [
            exercise("Rows", "8–12", true),
            exercise("Lat Pulldown", "8–12", true),
            exercise("Face Pull", "12–15"),
            exercise("Bent Lateral Raise", "12–15"),
            exercise("Hammer Curl", "8–12", true)
        ]
    },

    {
        name: "Full A",
        focus: "Full body",
        exercises: [
            exercise("Sumo Squat", "8–12", true),
            exercise("Press", "8–12", true),
            exercise("RDL", "8–12"),
            exercise("Rows", "8–12", true),
            exercise("Rear Kick", "12–15 / side"),
            exercise("Bicep Curl", "10–15")
        ]
    },

    {
        name: "Push B",
        focus: "Chest + shoulders + triceps",
        exercises: [
            exercise("Press", "8–12", true),
            exercise("Shoulder Press", "8–12", true),
            exercise("Push-ups", "Comfortable max", true),
            exercise("Front Raise", "10–15"),
            exercise("Dips", "8–15"),
            exercise("Nose Breaker", "10–15")
        ]
    },

    {
        name: "Legs B",
        focus: "Leg strength + accessories",
        exercises: [
            exercise("Squat", "8–12", true),
            exercise("RDL", "8–12", true),
            exercise("Side Lunge", "8–12 / side", true),
            exercise("Extension", "10–15"),
            exercise("Inner Lift", "12–15 / side"),
            exercise("Butt Blaster", "12–15 / side")
        ]
    },

    {
        name: "Pull B",
        focus: "Back + biceps",
        exercises: [
            exercise("Lat Pulldown", "8–12", true),
            exercise("Rows", "8–12", true),
            exercise("DB Pullover", "10–15"),
            exercise("Face Pull", "12–15"),
            exercise("Bicep Curl", "8–12", true),
            exercise("Hammer Curl", "10–15")
        ]
    },

    {
        name: "Full B",
        focus: "Full body",
        exercises: [
            exercise("Lunge", "8–12 / leg", true),
            exercise("Press", "8–12", true),
            exercise("DB Pullover", "10–15", true),
            exercise("Sumo Squat", "10–15"),
            exercise("Upright Row", "10–15"),
            exercise("Calf Raise", "12–20")
        ]
    }
];

function exercise(name, range, minimum = false) {
    return {
        name,
        range,
        minimum
    };
}

// =====================================================
// DR PROGRAM
// =====================================================

const DR_WORKOUTS = {
    1: {
        title: "DR #1",
        equipment: "Bodyweight",
        url: "https://www.nourishmovelove.com/5-postpartum-recovery-ab-exercises-beginner/"
    },

    2: {
        title: "DR #2",
        equipment: "Pilates Ball",
        url: "https://www.nourishmovelove.com/5-pilates-ab-exercises-beginner/"
    },

    3: {
        title: "DR #3",
        equipment: "Long Band",
        url: "https://www.nourishmovelove.com/5-postpartum-ab-exercises-resistance-band-beginner/"
    },

    4: {
        title: "DR #4",
        equipment: "Bodyweight",
        url: "https://www.nourishmovelove.com/5-postpartum-recovery-ab-exercises-advanced/"
    },

    5: {
        title: "DR #5",
        equipment: "Pilates Ball",
        url: "https://www.nourishmovelove.com/5-pilates-ab-exercises-advanced/"
    },

    6: {
        title: "DR #6",
        equipment: "Long Band",
        url: "https://www.nourishmovelove.com/5-postpartum-ab-exercises-resistance-band-advanced/"
    },

    7: {
        title: "DR #7",
        equipment: "Bodyweight",
        url: "https://www.nourishmovelove.com/postpartum-recovery-diastasis-recti-exercises/"
    },

    8: {
        title: "DR #8",
        equipment: "Pilates Ball",
        url: "https://www.nourishmovelove.com/beginner-ab-workout/"
    },

    9: {
        title: "DR #9",
        equipment: "Mini Band",
        url: "https://www.nourishmovelove.com/5-postpartum-ab-exercises-mini-band/"
    }
};

const DR_PLAN = [
    1, 2, 3, 1, 2, 3, null,
    4, 5, 6, 4, 5, 6, null,
    7, 8, 9, 7, 8, 9, null,
    4, 5, 6, 7, 8, 9, null
];

// =====================================================
// STATE
// =====================================================

const $ = id => document.getElementById(id);

let currentUser = null;

let weeklyData = null;
let liftingProgram = null;
let drProgram = null;

let weeklySaveTimer = null;
let liftingSaveTimer = null;
let drSaveTimer = null;

let minimumMode = false;

const today = new Date();
const todayKey = formatDateKey(today);

const weekStart = getMonday(today);
const weekKey = formatDateKey(weekStart);

// =====================================================
// DATE HELPERS
// =====================================================

function formatDateKey(date) {
    const year = date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getMonday(date) {
    const monday =
        new Date(date);

    monday.setHours(
        0,
        0,
        0,
        0
    );

    const day =
        monday.getDay();

    const difference =
        day === 0
            ? -6
            : 1 - day;

    monday.setDate(
        monday.getDate() +
        difference
    );

    return monday;
}

function addDays(date, amount) {
    const copy =
        new Date(date);

    copy.setDate(
        copy.getDate() +
        amount
    );

    return copy;
}

function weekDateKeys() {
    return DAYS.map(
        (_, index) =>
            formatDateKey(
                addDays(
                    weekStart,
                    index
                )
            )
    );
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
    const date =
        new Date(
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
// FIRESTORE PATHS
// =====================================================

function weeklyWorkoutDoc() {
    return doc(
        db,
        "plannerDashboardUsers",
        PLANNER_PROFILE_ID,
        "workoutWeeks",
        weekKey
    );
}

function liftingProgramDoc() {
    return doc(
        db,
        "plannerDashboardUsers",
        PLANNER_PROFILE_ID,
        "workoutPrograms",
        "rollingLifting"
    );
}

function drProgramDoc() {
    return doc(
        db,
        "plannerDashboardUsers",
        PLANNER_PROFILE_ID,
        "workoutPrograms",
        "diastasisRecti28"
    );
}

// =====================================================
// DEFAULT WEEK DATA
// =====================================================

function defaultWeeklyData() {
    return {
        weekStart: weekKey,
        cardio: [],
        dailyExercises: {},
        stretching: {},
        notes: {},
        updatedAt: null
    };
}

// =====================================================
// DEFAULT LIFTING PROGRAM
// =====================================================

function defaultLiftingProgram() {
    return {
        rotationIndex: 0,

        activeWorkout: null,

        exerciseHistory: {},

        recentSessions: [],

        updatedAt: null
    };
}

// =====================================================
// DEFAULT DR PROGRAM
// =====================================================

function defaultDRProgram() {
    return {
        completed: {},
        updatedAt: null
    };
}

// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {
            window.location.href =
                "../../index.html";

            return;
        }

        const email =
            (
                user.email || ""
            ).toLowerCase();

        if (
            !PLANNER_EMAILS.has(email)
        ) {
            await signOut(auth);

            window.location.href =
                "../../index.html";

            return;
        }

        currentUser = user;

        console.log(
            "Workout signed in as:",
            user.email
        );

        await Promise.all([
            loadWeeklyData(),
            loadLiftingProgram(),
            loadDRProgram()
        ]);

        ensureActiveWorkout();

        bindStaticEvents();

        renderEverything();
    }
);

// =====================================================
// LOAD WEEK DATA
// =====================================================

async function loadWeeklyData() {
    try {
        const snapshot =
            await getDoc(
                weeklyWorkoutDoc()
            );

        weeklyData =
            snapshot.exists()
                ? {
                    ...defaultWeeklyData(),
                    ...snapshot.data()
                }
                : defaultWeeklyData();

        weeklyData.cardio =
            weeklyData.cardio || [];

        weeklyData.dailyExercises =
            weeklyData.dailyExercises || {};

        weeklyData.stretching =
            weeklyData.stretching || {};

        weeklyData.notes =
            weeklyData.notes || {};
    } catch (error) {
        console.error(
            "Weekly workout load failed:",
            error
        );

        weeklyData =
            defaultWeeklyData();
    }
}

// =====================================================
// LOAD LIFTING
// =====================================================

async function loadLiftingProgram() {
    try {
        const snapshot =
            await getDoc(
                liftingProgramDoc()
            );

        liftingProgram =
            snapshot.exists()
                ? {
                    ...defaultLiftingProgram(),
                    ...snapshot.data()
                }
                : defaultLiftingProgram();

        liftingProgram.exerciseHistory =
            liftingProgram.exerciseHistory || {};

        liftingProgram.recentSessions =
            liftingProgram.recentSessions || [];
    } catch (error) {
        console.error(
            "Lifting program load failed:",
            error
        );

        liftingProgram =
            defaultLiftingProgram();
    }
}

// =====================================================
// LOAD DR
// =====================================================

async function loadDRProgram() {
    try {
        const snapshot =
            await getDoc(
                drProgramDoc()
            );

        drProgram =
            snapshot.exists()
                ? {
                    ...defaultDRProgram(),
                    ...snapshot.data()
                }
                : defaultDRProgram();

        drProgram.completed =
            drProgram.completed || {};
    } catch (error) {
        console.error(
            "DR program load failed:",
            error
        );

        drProgram =
            defaultDRProgram();
    }
}

// =====================================================
// SAVE STATUS
// =====================================================

function setSaveStatus(text) {
    const status =
        $("save-status");

    if (status) {
        status.textContent =
            text;
    }
}

// =====================================================
// SAVE WEEK DATA
// =====================================================

function queueWeeklySave() {
    setSaveStatus(
        "Saving…"
    );

    clearTimeout(
        weeklySaveTimer
    );

    weeklySaveTimer =
        setTimeout(
            saveWeeklyData,
            450
        );
}

async function saveWeeklyData() {
    try {
        await setDoc(
            weeklyWorkoutDoc(),
            {
                ...weeklyData,
                updatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );

        setSaveStatus(
            "Saved"
        );
    } catch (error) {
        console.error(
            "Weekly save failed:",
            error
        );

        setSaveStatus(
            "Save failed"
        );
    }
}

// =====================================================
// SAVE LIFTING
// =====================================================

function queueLiftingSave() {
    setSaveStatus(
        "Saving…"
    );

    clearTimeout(
        liftingSaveTimer
    );

    liftingSaveTimer =
        setTimeout(
            saveLiftingProgram,
            350
        );
}

async function saveLiftingProgram() {
    try {
        await setDoc(
            liftingProgramDoc(),
            {
                ...liftingProgram,
                updatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );

        setSaveStatus(
            "Saved"
        );
    } catch (error) {
        console.error(
            "Lifting save failed:",
            error
        );

        setSaveStatus(
            "Save failed"
        );
    }
}

// =====================================================
// SAVE DR
// =====================================================

function queueDRSave() {
    setSaveStatus(
        "Saving…"
    );

    clearTimeout(
        drSaveTimer
    );

    drSaveTimer =
        setTimeout(
            saveDRProgram,
            350
        );
}

async function saveDRProgram() {
    try {
        await setDoc(
            drProgramDoc(),
            {
                ...drProgram,
                updatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );

        setSaveStatus(
            "Saved"
        );
    } catch (error) {
        console.error(
            "DR save failed:",
            error
        );

        setSaveStatus(
            "Save failed"
        );
    }
}

// =====================================================
// ACTIVE LIFTING WORKOUT
// =====================================================

function ensureActiveWorkout() {
    if (
        liftingProgram.activeWorkout
    ) {
        return;
    }

    const workout =
        LIFTING_ROTATION[
            liftingProgram.rotationIndex
        ];

    liftingProgram.activeWorkout = {
        name: workout.name,
        startedDate: todayKey,
        exercises:
            workout.exercises.map(
                exercise => ({
                    name:
                        exercise.name,

                    range:
                        exercise.range,

                    minimum:
                        exercise.minimum,

                    weight:
                        getSuggestedStartingWeight(
                            exercise.name
                        ),

                    reps: [
                        "",
                        "",
                        ""
                    ],

                    effort: "",

                    complete: false
                })
            )
    };

    queueLiftingSave();
}

function getCurrentRotationWorkout() {
    return LIFTING_ROTATION[
        liftingProgram.rotationIndex
    ];
}

// =====================================================
// LAST PERFORMANCE
// =====================================================

function getExerciseHistory(name) {
    return (
        liftingProgram
            .exerciseHistory[
                name
            ] || null
    );
}

function getSuggestedStartingWeight(name) {
    const history =
        getExerciseHistory(name);

    if (!history) {
        return "";
    }

    return history.weight ?? "";
}

// =====================================================
// STATIC EVENTS
// =====================================================

function bindStaticEvents() {

    $("minimum-mode")
        ?.addEventListener(
            "click",
            () => {

                minimumMode =
                    !minimumMode;

                renderLiftingProgram();
            }
        );

    $("finish-workout")
        ?.addEventListener(
            "click",
            finishWorkout
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

    $("workout-notes")
        ?.addEventListener(
            "input",
            event => {

                weeklyData.notes[
                    todayKey
                ] =
                    event.target.value;

                queueWeeklySave();
            }
        );
}

// =====================================================
// MAIN RENDER
// =====================================================

function renderEverything() {

    if ($("workout-date")) {
        $("workout-date")
            .textContent =
                displayDate(today);
    }

    renderSummary();

    renderLiftingProgram();

    renderCardio();

    renderDailyExercises();

    renderStretching();

    renderNotes();

    renderDRCalendar();

    renderWeekGlance();

    setSaveStatus(
        "Saved"
    );
}

// =====================================================
// LIFTING PROGRAM HEADER
// =====================================================

function renderLiftingProgram() {

    ensureActiveWorkout();

    const workout =
        getCurrentRotationWorkout();

    const active =
        liftingProgram.activeWorkout;

    $("lifting-workout-name")
        .textContent =
            workout.name;

    $("lifting-workout-focus")
        .textContent =
            workout.focus;

    $("rotation-position")
        .textContent =
            liftingProgram
                .rotationIndex + 1;

    document
        .querySelectorAll(
            "[data-rotation-name]"
        )
        .forEach(item => {

            item.classList.toggle(
                "is-current",
                item.dataset.rotationName ===
                    workout.name
            );
        });

    $("minimum-mode")
        ?.classList.toggle(
            "is-active",
            minimumMode
        );

    renderLiftingExercises(
        active
    );

    renderLiftingProgress();

    renderSessionVolume();

    updateFinishButton();
}

// =====================================================
// LIFTING EXERCISES
// =====================================================

function renderLiftingExercises(active) {

    const container =
        $("rolling-lifting-list");

    if (!container) {
        return;
    }

    container.innerHTML =
        active.exercises
            .map(
                (
                    exercise,
                    index
                ) => {

                    const hidden =
                        minimumMode &&
                        !exercise.minimum;

                    const history =
                        getExerciseHistory(
                            exercise.name
                        );

                    const previous =
                        history
                            ? formatPreviousPerformance(
                                history
                            )
                            : "No previous workout";

                    const suggestion =
                        getProgressionSuggestion(
                            exercise,
                            history
                        );

                    return `
                        <article
                            class="
                                lifting-exercise
                                ${exercise.complete ? "is-complete" : ""}
                                ${hidden ? "is-hidden" : ""}
                            "
                            data-lift-index="${index}"
                        >

                            <div class="lifting-exercise-heading">

                                <div>

                                    <div class="exercise-title">

                                        ${escapeHTML(exercise.name)}

                                        ${
                                            exercise.minimum
                                                ? `
                                                    <span class="minimum-badge">
                                                        Minimum
                                                    </span>
                                                `
                                                : ""
                                        }

                                    </div>

                                    <div class="exercise-range">
                                        3 × ${escapeHTML(exercise.range)}
                                    </div>

                                </div>

                                <div class="previous-performance">
                                    Previous:<br>
                                    ${previous}
                                </div>

                            </div>


                            <div class="exercise-input-grid">

                                <label>
                                    Weight
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        data-weight-index="${index}"
                                        value="${exercise.weight ?? ""}"
                                        placeholder="lb"
                                    >
                                </label>

                                <label>
                                    Set 1
                                    <input
                                        type="number"
                                        min="0"
                                        data-rep-index="${index}"
                                        data-set-index="0"
                                        value="${exercise.reps[0] ?? ""}"
                                        placeholder="reps"
                                    >
                                </label>

                                <label>
                                    Set 2
                                    <input
                                        type="number"
                                        min="0"
                                        data-rep-index="${index}"
                                        data-set-index="1"
                                        value="${exercise.reps[1] ?? ""}"
                                        placeholder="reps"
                                    >
                                </label>

                                <label>
                                    Set 3
                                    <input
                                        type="number"
                                        min="0"
                                        data-rep-index="${index}"
                                        data-set-index="2"
                                        value="${exercise.reps[2] ?? ""}"
                                        placeholder="reps"
                                    >
                                </label>

                            </div>


                            <div class="effort-row">

                                ${effortButton(
                                    index,
                                    "easy",
                                    "😌 Easy",
                                    exercise.effort
                                )}

                                ${effortButton(
                                    index,
                                    "good",
                                    "👍 Good",
                                    exercise.effort
                                )}

                                ${effortButton(
                                    index,
                                    "hard",
                                    "🥵 Hard",
                                    exercise.effort
                                )}

                                ${effortButton(
                                    index,
                                    "too-heavy",
                                    "🛑 Too Heavy",
                                    exercise.effort
                                )}

                            </div>


                            ${
                                suggestion
                                    ? `
                                        <div
                                            class="
                                                progression-note
                                                ${suggestion.className}
                                            "
                                        >
                                            ${suggestion.text}
                                        </div>
                                    `
                                    : ""
                            }


                            <div class="exercise-complete-row">

                                <button
                                    type="button"
                                    class="
                                        exercise-complete-button
                                        ${exercise.complete ? "is-done" : ""}
                                    "
                                    data-complete-index="${index}"
                                >

                                    ${
                                        exercise.complete
                                            ? "✓ Complete"
                                            : "Mark Complete"
                                    }

                                </button>

                            </div>

                        </article>
                    `;
                }
            )
            .join("");

    bindLiftingExerciseEvents();
}

// =====================================================
// EFFORT BUTTON HTML
// =====================================================

function effortButton(
    index,
    value,
    label,
    current
) {

    return `
        <button
            type="button"
            class="
                effort-button
                ${current === value ? "is-selected" : ""}
            "
            data-effort-index="${index}"
            data-effort-value="${value}"
        >
            ${label}
        </button>
    `;
}

// =====================================================
// LIFTING FIELD EVENTS
// =====================================================

function bindLiftingExerciseEvents() {

    document
        .querySelectorAll(
            "[data-weight-index]"
        )
        .forEach(input => {

            input.addEventListener(
                "input",
                () => {

                    const index =
                        Number(
                            input.dataset.weightIndex
                        );

                    liftingProgram
                        .activeWorkout
                        .exercises[
                            index
                        ]
                        .weight =
                            input.value;

                    renderSessionVolume();

                    queueLiftingSave();
                }
            );
        });

    document
        .querySelectorAll(
            "[data-rep-index]"
        )
        .forEach(input => {

            input.addEventListener(
                "input",
                () => {

                    const exerciseIndex =
                        Number(
                            input.dataset.repIndex
                        );

                    const setIndex =
                        Number(
                            input.dataset.setIndex
                        );

                    liftingProgram
                        .activeWorkout
                        .exercises[
                            exerciseIndex
                        ]
                        .reps[
                            setIndex
                        ] =
                            input.value;

                    renderSessionVolume();

                    queueLiftingSave();
                }
            );
        });

    document
        .querySelectorAll(
            "[data-effort-index]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            button.dataset.effortIndex
                        );

                    const value =
                        button.dataset.effortValue;

                    liftingProgram
                        .activeWorkout
                        .exercises[
                            index
                        ]
                        .effort =
                            value;

                    renderLiftingProgram();

                    queueLiftingSave();
                }
            );
        });

    document
        .querySelectorAll(
            "[data-complete-index]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            button.dataset.completeIndex
                        );

                    const exercise =
                        liftingProgram
                            .activeWorkout
                            .exercises[
                                index
                            ];

                    exercise.complete =
                        !exercise.complete;

                    renderLiftingProgram();

                    queueLiftingSave();
                }
            );
        });
}

// =====================================================
// LIFTING PROGRESS
// =====================================================

function getRequiredExercises() {

    const exercises =
        liftingProgram
            .activeWorkout
            .exercises;

    if (!minimumMode) {
        return exercises;
    }

    return exercises.filter(
        exercise =>
            exercise.minimum
    );
}

function renderLiftingProgress() {

    const required =
        getRequiredExercises();

    const complete =
        required.filter(
            exercise =>
                exercise.complete
        ).length;

    const total =
        required.length;

    $("lifting-progress-text")
        .textContent =
            `${complete} / ${total}`;

    const percent =
        total
            ? (
                complete /
                total
            ) * 100
            : 0;

    $("lifting-progress-bar")
        .style.width =
            `${percent}%`;
}

// =====================================================
// SESSION VOLUME
// =====================================================

function calculateSessionVolume() {

    return liftingProgram
        .activeWorkout
        .exercises
        .reduce(
            (
                total,
                exercise
            ) => {

                const weight =
                    Number(
                        exercise.weight || 0
                    );

                const reps =
                    exercise.reps.reduce(
                        (
                            repTotal,
                            reps
                        ) =>
                            repTotal +
                            Number(
                                reps || 0
                            ),
                        0
                    );

                return (
                    total +
                    (
                        weight *
                        reps
                    )
                );
            },
            0
        );
}

function renderSessionVolume() {

    const volume =
        calculateSessionVolume();

    $("session-volume")
        .textContent =
            `${Math.round(
                volume
            ).toLocaleString()} lbs`;
}

// =====================================================
// FINISH BUTTON
// =====================================================

function updateFinishButton() {

    const required =
        getRequiredExercises();

    const allComplete =
        required.length > 0 &&
        required.every(
            exercise =>
                exercise.complete
        );

    $("finish-workout")
        .disabled =
            !allComplete;
}

// =====================================================
// FINISH WORKOUT
// =====================================================

async function finishWorkout() {

    const required =
        getRequiredExercises();

    const allComplete =
        required.every(
            exercise =>
                exercise.complete
        );

    if (!allComplete) {
        return;
    }

    const active =
        liftingProgram
            .activeWorkout;

    const session = {
        id: makeId(),
        workoutName:
            active.name,
        date:
            todayKey,
        minimumMode,
        volume:
            calculateSessionVolume(),
        exercises:
            active.exercises
                .filter(
                    exercise =>
                        !minimumMode ||
                        exercise.minimum
                )
                .map(
                    exercise => ({
                        ...exercise
                    })
                )
    };

    // Save last performance
    session.exercises.forEach(
        exercise => {

            liftingProgram
                .exerciseHistory[
                    exercise.name
                ] = {
                    weight:
                        Number(
                            exercise.weight || 0
                        ),

                    reps:
                        exercise.reps.map(
                            reps =>
                                Number(
                                    reps || 0
                                )
                        ),

                    effort:
                        exercise.effort || "",

                    date:
                        todayKey,

                    workoutName:
                        active.name
                };
        }
    );

    // Save history
    liftingProgram
        .recentSessions
        .unshift(
            session
        );

    // Prevent document growing forever
    liftingProgram.recentSessions =
        liftingProgram
            .recentSessions
            .slice(0, 100);

    // Advance rotation
    liftingProgram.rotationIndex =
        (
            liftingProgram
                .rotationIndex +
            1
        ) %
        LIFTING_ROTATION.length;

    liftingProgram.activeWorkout =
        null;

    minimumMode = false;

    ensureActiveWorkout();

    await saveLiftingProgram();

    renderEverything();
}

// =====================================================
// PREVIOUS PERFORMANCE
// =====================================================

function formatPreviousPerformance(
    history
) {

    const weight =
        Number(
            history.weight || 0
        );

    const reps =
        Array.isArray(
            history.reps
        )
            ? history.reps
                .filter(
                    value =>
                        Number(value) > 0
                )
                .join(" / ")
            : "";

    if (
        !weight &&
        !reps
    ) {
        return "—";
    }

    if (weight) {
        return `${weight} lb • ${reps || "—"}`;
    }

    return reps;
}

// =====================================================
// PROGRESSION SUGGESTION
// =====================================================

function getProgressionSuggestion(
    exercise,
    history
) {

    if (!history) {
        return {
            className: "",
            text:
                "First logged session — establish a comfortable baseline."
        };
    }

    if (
        history.effort ===
        "too-heavy"
    ) {
        return {
            className:
                "reduce",

            text:
                "Last time was too heavy. Consider reducing the weight."
        };
    }

    if (
        history.effort ===
        "hard"
    ) {
        return {
            className:
                "hold",

            text:
                "Last time was hard. Keep the same weight and build reps."
        };
    }

    const reps =
        history.reps || [];

    const numericRange =
        getNumericRepRange(
            exercise.range
        );

    if (!numericRange) {
        return {
            className:
                "hold",

            text:
                "Use your last performance as today's starting point."
        };
    }

    const max =
        numericRange.max;

    const hitTop =
        reps.length >= 3 &&
        reps
            .slice(0, 3)
            .every(
                rep =>
                    Number(rep) >= max
            );

    if (
        hitTop &&
        history.effort !==
            "too-heavy" &&
        history.effort !==
            "hard"
    ) {
        return {
            className:
                "increase",

            text:
                "🎉 You hit the top of the range last time. Consider a small weight increase."
        };
    }

    return {
        className:
            "hold",

        text:
            "Stay at the current weight and work toward the top of the rep range."
    };
}

function getNumericRepRange(range) {

    const match =
        range.match(
            /(\d+)\s*[–-]\s*(\d+)/
        );

    if (!match) {
        return null;
    }

    return {
        min:
            Number(
                match[1]
            ),

        max:
            Number(
                match[2]
            )
    };
}

// =====================================================
// SUMMARY
// =====================================================

function renderSummary() {

    const dates =
        weekDateKeys();

    const liftingSessions =
        liftingProgram
            .recentSessions
            .filter(
                session =>
                    dates.includes(
                        session.date
                    )
            )
            .length;

    const cardioMinutes =
        weeklyData.cardio
            .filter(
                entry =>
                    dates.includes(
                        entry.date
                    )
            )
            .reduce(
                (
                    total,
                    entry
                ) =>
                    total +
                    Number(
                        entry.minutes || 0
                    ),
                0
            );

    const dailyDays =
        dates.filter(
            dateKey =>
                dailyComplete(
                    dateKey
                )
        ).length;

    const stretchDays =
        dates.filter(
            dateKey =>
                hasStretching(
                    dateKey
                )
        ).length;

    $("lifting-summary")
        .textContent =
            liftingSessions;

    $("cardio-summary")
        .textContent =
            cardioMinutes;

    $("daily-summary")
        .textContent =
            `${dailyDays} / 7`;

    $("stretch-summary")
        .textContent =
            `${stretchDays} / 7`;
}

// =====================================================
// CARDIO
// =====================================================

function addCardio(minutes) {

    weeklyData.cardio.push({
        id:
            makeId(),
        date:
            todayKey,
        minutes
    });

    renderEverything();

    queueWeeklySave();
}

function cardioMinutesForDate(
    dateKey
) {

    return weeklyData
        .cardio
        .filter(
            entry =>
                entry.date ===
                dateKey
        )
        .reduce(
            (
                total,
                entry
            ) =>
                total +
                Number(
                    entry.minutes || 0
                ),
            0
        );
}

function renderCardio() {

    $("today-cardio")
        .textContent =
            cardioMinutesForDate(
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
        weeklyData
            .dailyExercises[
                todayKey
            ] || {};

    container.innerHTML =
        DAILY_EXERCISES
            .map(
                exercise => {

                    const done =
                        !!state[
                            exercise
                        ];

                    return `
                        <label
                            class="
                                daily-exercise-row
                                ${done ? "is-done" : ""}
                            "
                        >

                            <input
                                type="checkbox"
                                data-daily-exercise="${escapeHTML(exercise)}"
                                ${done ? "checked" : ""}
                            >

                            <span class="daily-exercise-name">
                                ${escapeHTML(exercise)}
                            </span>

                            <span class="exercise-reps">
                                10 reps
                            </span>

                        </label>
                    `;
                }
            )
            .join("");

    container
        .querySelectorAll(
            "[data-daily-exercise]"
        )
        .forEach(input => {

            input.addEventListener(
                "change",
                () => {

                    weeklyData
                        .dailyExercises[
                            todayKey
                        ] =
                            weeklyData
                                .dailyExercises[
                                    todayKey
                                ] || {};

                    weeklyData
                        .dailyExercises[
                            todayKey
                        ][
                            input.dataset.dailyExercise
                        ] =
                            input.checked;

                    renderEverything();

                    queueWeeklySave();
                }
            );
        });
}

function dailyComplete(dateKey) {

    const state =
        weeklyData
            .dailyExercises[
                dateKey
            ] || {};

    return DAILY_EXERCISES
        .every(
            exercise =>
                !!state[
                    exercise
                ]
        );
}

// =====================================================
// STRETCHING
// =====================================================

function toggleStretch(type) {

    const current =
        weeklyData
            .stretching[
                todayKey
            ] || [];

    if (
        current.includes(type)
    ) {
        weeklyData
            .stretching[
                todayKey
            ] =
                current.filter(
                    item =>
                        item !== type
                );
    } else {
        weeklyData
            .stretching[
                todayKey
            ] = [
                ...current,
                type
            ];
    }

    renderEverything();

    queueWeeklySave();
}

function hasStretching(
    dateKey
) {

    const stretches =
        weeklyData
            .stretching[
                dateKey
            ];

    return (
        Array.isArray(
            stretches
        ) &&
        stretches.length > 0
    );
}

function renderStretching() {

    const current =
        weeklyData
            .stretching[
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

    status.textContent =
        current.length
            ? `Logged: ${current.join(", ")}`
            : "Nothing logged today.";
}

// =====================================================
// NOTES
// =====================================================

function renderNotes() {

    $("workout-notes")
        .value =
            weeklyData.notes[
                todayKey
            ] || "";
}

// =====================================================
// DR CALENDAR
// =====================================================

function renderDRCalendar() {

    const container =
        $("dr-calendar");

    if (!container) {
        return;
    }

    const completedCount =
        DR_PLAN.reduce(
            (
                total,
                workoutId,
                index
            ) => {

                if (
                    workoutId &&
                    drProgram.completed[
                        String(
                            index + 1
                        )
                    ]
                ) {
                    return total + 1;
                }

                return total;
            },
            0
        );

    $("dr-progress")
        .textContent =
            `${completedCount} / 24`;

    container.innerHTML =
        DR_PLAN
            .map(
                (
                    workoutId,
                    index
                ) => {

                    const day =
                        index + 1;

                    if (!workoutId) {

                        return `
                            <article class="dr-day">

                                <div class="dr-day-number">
                                    Day ${day}
                                </div>

                                <div class="dr-rest">
                                    Rest Day
                                </div>

                            </article>
                        `;
                    }

                    const workout =
                        DR_WORKOUTS[
                            workoutId
                        ];

                    const done =
                        !!drProgram
                            .completed[
                                String(day)
                            ];

                    return `
                        <article
                            class="
                                dr-day
                                ${done ? "is-done" : ""}
                            "
                        >

                            <div class="dr-day-top">

                                <span class="dr-day-number">
                                    Day ${day}
                                </span>

                                <button
                                    type="button"
                                    class="dr-check"
                                    data-dr-day="${day}"
                                    aria-label="Mark Day ${day} complete"
                                >
                                    ✓
                                </button>

                            </div>

                            <a
                                class="dr-workout-link"
                                href="${workout.url}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >

                                <strong>
                                    ${workout.title}
                                </strong>

                                <span>
                                    ${workout.equipment}
                                </span>

                            </a>

                        </article>
                    `;
                }
            )
            .join("");

    container
        .querySelectorAll(
            "[data-dr-day]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const day =
                        button.dataset.drDay;

                    drProgram.completed[
                        day
                    ] =
                        !drProgram.completed[
                            day
                        ];

                    renderDRCalendar();

                    queueDRSave();
                }
            );
        });
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
                (
                    dateKey,
                    index
                ) => {

                    const lift =
                        liftingProgram
                            .recentSessions
                            .some(
                                session =>
                                    session.date ===
                                    dateKey
                            );

                    const cardio =
                        cardioMinutesForDate(
                            dateKey
                        );

                    const daily =
                        dailyComplete(
                            dateKey
                        );

                    const stretch =
                        hasStretching(
                            dateKey
                        );

                    const icons = [
                        lift
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
                        lift
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

    if (
        crypto.randomUUID
    ) {
        return (
            crypto.randomUUID()
        );
    }

    return (
        `${Date.now()}-${Math.random()}`
    );
}

function escapeHTML(
    value = ""
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value;

    return div.innerHTML;
}