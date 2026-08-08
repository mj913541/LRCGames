import { auth, db } from "../../js/firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// =====================================================
// SETTINGS
// =====================================================

const ALLOWED_EMAILS = new Set([
    "malbrecht@sd308.org",
    "malbrecht3317@gmail.com"
]);

const PLANNER_PROFILE_ID = "mj";

const WEEKDAY_LABELS = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday"
};

const MONTH_LABELS = {
    1: "January",
    2: "February",
    3: "March",
    4: "April",
    5: "May",
    6: "June",
    7: "July",
    8: "August",
    9: "September",
    10: "October",
    11: "November",
    12: "December"
};

// =====================================================
// STATE
// =====================================================

let currentUser = null;
let tasks = [];
let editingTaskId = null;

// =====================================================
// DOM HELPERS
// =====================================================

const $ = id =>
    document.getElementById(id);

// =====================================================
// FIRESTORE PATH
// =====================================================

function taskCollection() {
    return collection(
        db,
        "plannerDashboardUsers",
        PLANNER_PROFILE_ID,
        "taskLibrary"
    );
}

function taskDoc(taskId) {
    return doc(
        db,
        "plannerDashboardUsers",
        PLANNER_PROFILE_ID,
        "taskLibrary",
        taskId
    );
}

// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href =
            "../../index.html";

        return;
    }

    const email =
        (user.email || "").toLowerCase();

    if (!ALLOWED_EMAILS.has(email)) {
        await signOut(auth);

        window.location.href =
            "../../index.html";

        return;
    }

    currentUser = user;

    console.log(
        "Task Library signed in as:",
        user.email
    );

    bindStaticEvents();

    await loadTasks();

    renderEverything();
});

// =====================================================
// LOAD TASKS
// =====================================================

async function loadTasks() {
    setSaveStatus("Loading…");

    try {
        const snapshot =
            await getDocs(
                taskCollection()
            );

        tasks =
            snapshot.docs.map(
                documentSnapshot => ({
                    id:
                        documentSnapshot.id,

                    ...documentSnapshot.data()
                })
            );

        normalizeTasks();

        setSaveStatus("Saved");
    } catch (error) {
        console.error(
            "Task load failed:",
            error
        );

        tasks = [];

        setSaveStatus(
            "Load failed"
        );
    }
}

// =====================================================
// NORMALIZE DATA
// =====================================================

function normalizeTasks() {
    tasks = tasks.map(task => ({
        id: task.id,
        title: task.title || "",
        category: task.category || "",
        weekdays:
            Array.isArray(task.weekdays)
                ? task.weekdays
                : [],
        months:
            Array.isArray(task.months)
                ? task.months.map(Number)
                : [],
        active:
            task.active !== false,
        notes: task.notes || "",
        createdAt:
            task.createdAt || null,
        updatedAt:
            task.updatedAt || null
    }));
}

// =====================================================
// SAVE STATUS
// =====================================================

function setSaveStatus(text) {
    const element =
        $("task-save-status");

    if (element) {
        element.textContent =
            text;
    }
}

// =====================================================
// STATIC EVENTS
// =====================================================

function bindStaticEvents() {
    $("add-task")
        ?.addEventListener(
            "click",
            openNewTaskDialog
        );

    $("close-task-dialog")
        ?.addEventListener(
            "click",
            closeTaskDialog
        );

    $("cancel-task")
        ?.addEventListener(
            "click",
            closeTaskDialog
        );

    $("task-form")
        ?.addEventListener(
            "submit",
            saveTaskFromForm
        );

    $("delete-task")
        ?.addEventListener(
            "click",
            deleteCurrentTask
        );

    $("category-filter")
        ?.addEventListener(
            "change",
            renderTaskList
        );

    $("weekday-filter")
        ?.addEventListener(
            "change",
            renderTaskList
        );

    $("month-filter")
        ?.addEventListener(
            "change",
            renderTaskList
        );

    $("show-all-tasks")
        ?.addEventListener(
            "click",
            resetFilters
        );

    $("task-dialog")
        ?.addEventListener(
            "click",
            event => {
                if (
                    event.target.id ===
                    "task-dialog"
                ) {
                    closeTaskDialog();
                }
            }
        );
}

// =====================================================
// MAIN RENDER
// =====================================================

function renderEverything() {
    renderSummary();
    renderCategoryFilter();
    renderTaskList();
}

// =====================================================
// SUMMARY
// =====================================================

function renderSummary() {
    const activeTasks =
        tasks.filter(
            task =>
                task.active
        );

    const weekdayTasks =
        activeTasks.filter(
            task =>
                task.weekdays.length > 0 &&
                task.months.length === 0
        );

    const monthlyTasks =
        activeTasks.filter(
            task =>
                task.months.length > 0 &&
                task.weekdays.length === 0
        );

    const combinedTasks =
        activeTasks.filter(
            task =>
                task.weekdays.length > 0 &&
                task.months.length > 0
        );

    $("active-task-count").textContent =
        activeTasks.length;

    $("weekday-task-count").textContent =
        weekdayTasks.length;

    $("monthly-task-count").textContent =
        monthlyTasks.length;

    $("combined-task-count").textContent =
        combinedTasks.length;
}

// =====================================================
// CATEGORY FILTER
// =====================================================

function renderCategoryFilter() {
    const select =
        $("category-filter");

    if (!select) {
        return;
    }

    const currentValue =
        select.value || "all";

    const categories =
        [
            ...new Set(
                tasks
                    .map(task =>
                        task.category.trim()
                    )
                    .filter(Boolean)
            )
        ].sort(
            (a, b) =>
                a.localeCompare(b)
        );

    select.innerHTML = `
        <option value="all">
            All Categories
        </option>

        ${categories
            .map(category => `
                <option
                    value="${escapeHTML(category)}"
                >
                    ${escapeHTML(category)}
                </option>
            `)
            .join("")}
    `;

    if (
        categories.includes(
            currentValue
        )
    ) {
        select.value =
            currentValue;
    } else {
        select.value =
            "all";
    }
}

// =====================================================
// FILTER TASKS
// =====================================================

function getFilteredTasks() {
    const category =
        $("category-filter")
            ?.value ||
        "all";

    const weekday =
        $("weekday-filter")
            ?.value ||
        "all";

    const month =
        $("month-filter")
            ?.value ||
        "all";

    return tasks
        .filter(task => {
            if (
                category !== "all" &&
                task.category !== category
            ) {
                return false;
            }

            if (
                weekday !== "all" &&
                !task.weekdays.includes(
                    weekday
                )
            ) {
                return false;
            }

            if (
                month !== "all" &&
                !task.months.includes(
                    Number(month)
                )
            ) {
                return false;
            }

            return true;
        })
        .sort(sortTasks);
}

function sortTasks(a, b) {
    if (
        a.active !== b.active
    ) {
        return a.active
            ? -1
            : 1;
    }

    const categoryCompare =
        a.category.localeCompare(
            b.category
        );

    if (categoryCompare !== 0) {
        return categoryCompare;
    }

    return a.title.localeCompare(
        b.title
    );
}

// =====================================================
// TASK LIST
// =====================================================

function renderTaskList() {
    const container =
        $("task-list");

    if (!container) {
        return;
    }

    const filteredTasks =
        getFilteredTasks();

    if (!filteredTasks.length) {
        container.innerHTML = `
            <p class="empty-message">
                No tasks match these filters.
            </p>
        `;

        return;
    }

    container.innerHTML =
        filteredTasks
            .map(task =>
                taskCardHTML(task)
            )
            .join("");

    container
        .querySelectorAll(
            "[data-edit-task]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    openEditTaskDialog(
                        button.dataset.editTask
                    );
                }
            );
        });
}

// =====================================================
// TASK CARD
// =====================================================

function taskCardHTML(task) {
    const scheduleChips =
        buildScheduleChips(task);

    return `
        <article
            class="task-card${task.active ? "" : " is-inactive"}"
        >

            <div class="task-card-main">

                <div class="task-card-title-row">

                    <span class="task-card-title">
                        ${escapeHTML(task.title)}
                    </span>

                    ${
                        task.category
                            ? `
                                <span class="task-category-badge">
                                    ${escapeHTML(task.category)}
                                </span>
                            `
                            : ""
                    }

                    ${
                        !task.active
                            ? `
                                <span class="schedule-chip">
                                    Inactive
                                </span>
                            `
                            : ""
                    }

                </div>

                <div class="task-card-schedule">
                    ${scheduleChips}
                </div>

                ${
                    task.notes
                        ? `
                            <div class="task-card-notes">
                                ${escapeHTML(task.notes)}
                            </div>
                        `
                        : ""
                }

            </div>

            <div class="task-card-actions">

                <button
                    class="task-edit-button"
                    type="button"
                    data-edit-task="${task.id}"
                >
                    Edit
                </button>

            </div>

        </article>
    `;
}

// =====================================================
// SCHEDULE CHIPS
// =====================================================

function buildScheduleChips(task) {
    const chips = [];

    if (
        task.weekdays.length
    ) {
        task.weekdays.forEach(
            weekday => {
                chips.push(`
                    <span class="schedule-chip">
                        ${WEEKDAY_LABELS[weekday]}
                    </span>
                `);
            }
        );
    }

    if (
        task.months.length
    ) {
        task.months
            .slice()
            .sort(
                (a, b) =>
                    a - b
            )
            .forEach(month => {
                chips.push(`
                    <span class="schedule-chip">
                        ${MONTH_LABELS[month]}
                    </span>
                `);
            });
    }

    if (
        !task.weekdays.length &&
        !task.months.length
    ) {
        chips.push(`
            <span class="schedule-chip">
                Unscheduled
            </span>
        `);
    }

    if (
        task.weekdays.length &&
        !task.months.length
    ) {
        chips.push(`
            <span class="schedule-chip">
                All Year
            </span>
        `);
    }

    return chips.join("");
}

// =====================================================
// RESET FILTERS
// =====================================================

function resetFilters() {
    if ($("category-filter")) {
        $("category-filter").value =
            "all";
    }

    if ($("weekday-filter")) {
        $("weekday-filter").value =
            "all";
    }

    if ($("month-filter")) {
        $("month-filter").value =
            "all";
    }

    renderTaskList();
}

// =====================================================
// NEW TASK
// =====================================================

function openNewTaskDialog() {
    editingTaskId = null;

    $("task-dialog-title").textContent =
        "New Task";

    $("task-title").value =
        "";

    $("task-category").value =
        "";

    $("task-notes").value =
        "";

    $("task-active").checked =
        true;

    document
        .querySelectorAll(
            "[data-task-weekday]"
        )
        .forEach(checkbox => {
            checkbox.checked =
                false;
        });

    document
        .querySelectorAll(
            "[data-task-month]"
        )
        .forEach(checkbox => {
            checkbox.checked =
                false;
        });

    $("delete-task").hidden =
        true;

    $("task-dialog")
        .showModal();

    setTimeout(() => {
        $("task-title")
            ?.focus();
    }, 50);
}

// =====================================================
// EDIT TASK
// =====================================================

function openEditTaskDialog(taskId) {
    const task =
        tasks.find(
            item =>
                item.id === taskId
        );

    if (!task) {
        return;
    }

    editingTaskId =
        taskId;

    $("task-dialog-title").textContent =
        "Edit Task";

    $("task-title").value =
        task.title;

    $("task-category").value =
        task.category;

    $("task-notes").value =
        task.notes;

    $("task-active").checked =
        task.active;

    document
        .querySelectorAll(
            "[data-task-weekday]"
        )
        .forEach(checkbox => {
            checkbox.checked =
                task.weekdays.includes(
                    checkbox.value
                );
        });

    document
        .querySelectorAll(
            "[data-task-month]"
        )
        .forEach(checkbox => {
            checkbox.checked =
                task.months.includes(
                    Number(
                        checkbox.value
                    )
                );
        });

    $("delete-task").hidden =
        false;

    $("task-dialog")
        .showModal();
}

// =====================================================
// CLOSE TASK DIALOG
// =====================================================

function closeTaskDialog() {
    $("task-dialog")
        ?.close();

    editingTaskId =
        null;
}

// =====================================================
// READ FORM DATA
// =====================================================

function getTaskFormData() {
    const weekdays =
        Array.from(
            document.querySelectorAll(
                "[data-task-weekday]:checked"
            )
        ).map(
            checkbox =>
                checkbox.value
        );

    const months =
        Array.from(
            document.querySelectorAll(
                "[data-task-month]:checked"
            )
        ).map(
            checkbox =>
                Number(
                    checkbox.value
                )
        );

    return {
        title:
            $("task-title")
                .value
                .trim(),

        category:
            $("task-category")
                .value
                .trim(),

        weekdays,

        months,

        active:
            $("task-active")
                .checked,

        notes:
            $("task-notes")
                .value
                .trim()
    };
}

// =====================================================
// SAVE TASK
// =====================================================

async function saveTaskFromForm(event) {
    event.preventDefault();

    const formData =
        getTaskFormData();

    if (!formData.title) {
        return;
    }

    setSaveStatus(
        "Saving…"
    );

    try {
        if (editingTaskId) {
            const existingTask =
                tasks.find(
                    task =>
                        task.id ===
                        editingTaskId
                );

            await setDoc(
                taskDoc(
                    editingTaskId
                ),
                {
                    ...formData,

                    createdAt:
                        existingTask
                            ?.createdAt ||
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()
                },
                {
                    merge: true
                }
            );
        } else {
            const taskId =
                makeId();

            await setDoc(
                taskDoc(taskId),
                {
                    ...formData,

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()
                }
            );
        }

        closeTaskDialog();

        await loadTasks();

        renderEverything();

        setSaveStatus(
            "Saved"
        );
    } catch (error) {
        console.error(
            "Task save failed:",
            error
        );

        setSaveStatus(
            "Save failed"
        );
    }
}

// =====================================================
// DELETE TASK
// =====================================================

async function deleteCurrentTask() {
    if (!editingTaskId) {
        return;
    }

    const task =
        tasks.find(
            item =>
                item.id ===
                editingTaskId
        );

    const confirmed =
        window.confirm(
            `Delete "${task?.title || "this task"}"?`
        );

    if (!confirmed) {
        return;
    }

    setSaveStatus(
        "Deleting…"
    );

    try {
        await deleteDoc(
            taskDoc(
                editingTaskId
            )
        );

        closeTaskDialog();

        await loadTasks();

        renderEverything();

        setSaveStatus(
            "Saved"
        );
    } catch (error) {
        console.error(
            "Task delete failed:",
            error
        );

        setSaveStatus(
            "Delete failed"
        );
    }
}

// =====================================================
// TASK SCHEDULING HELPERS
// These will also be useful when we connect Calendar.
// =====================================================

function taskMatchesDate(
    task,
    date
) {
    if (!task.active) {
        return false;
    }

    const month =
        date.getMonth() + 1;

    const weekday =
        getWeekdayKey(
            date
        );

    const hasWeekdays =
        task.weekdays.length > 0;

    const hasMonths =
        task.months.length > 0;

    // No schedule at all.
    if (
        !hasWeekdays &&
        !hasMonths
    ) {
        return false;
    }

    // Weekday-only:
    // Every matching weekday all year.
    if (
        hasWeekdays &&
        !hasMonths
    ) {
        return task.weekdays.includes(
            weekday
        );
    }

    // Month-only:
    // This is a monthly task, not a daily repeating task.
    if (
        !hasWeekdays &&
        hasMonths
    ) {
        return false;
    }

    // Weekday + month:
    // Only matching weekdays inside matching months.
    return (
        task.weekdays.includes(
            weekday
        ) &&
        task.months.includes(
            month
        )
    );
}

function taskMatchesMonth(
    task,
    month
) {
    if (!task.active) {
        return false;
    }

    return task.months.includes(
        Number(month)
    );
}

function getWeekdayKey(date) {
    return [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ][date.getDay()];
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
        document.createElement(
            "div"
        );

    div.textContent =
        value;

    return div.innerHTML;
}