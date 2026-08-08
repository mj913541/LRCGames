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

const ALLOWED_EMAILS = new Set([
  "malbrecht@sd308.org",
  "malbrecht3317@gmail.com"
]);

const $ = id => document.getElementById(id);

let user = null;
let data = null;
let saveTimer = null;
let dialogMode = null;
let absPlan = { completed: {} };
let absSaveTimer = null;

const today = new Date();
const weekStart = startOfWeek(today);
const weekKey = localDateKey(weekStart);
const todayKey = localDateKey(today);

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

const ABS_WORKOUTS = {
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

const ABS_PLAN_DAYS = [
  1, 2, 3, 1, 2, 3, null,
  4, 5, 6, 4, 5, 6, null,
  7, 8, 9, 7, 8, 9, null,
  4, 5, 6, 7, 8, 9, null
];

// =====================================================
// DATE HELPERS
// =====================================================

function startOfWeek(d) {
  const x = new Date(d);

  x.setHours(0, 0, 0, 0);

  const day = (x.getDay() + 6) % 7;

  x.setDate(x.getDate() - day);

  return x;
}

function addDays(d, n) {
  const x = new Date(d);

  x.setDate(x.getDate() + n);

  return x;
}

function localDateKey(d) {
  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmtDate(key) {
  const d = new Date(`${key}T12:00:00`);

  return d.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric"
    }
  );
}

function weekKeys() {
  return DAYS.map(
    (_, i) =>
      localDateKey(
        addDays(weekStart, i)
      )
  );
}

// =====================================================
// FIRESTORE PATHS
// =====================================================

const PLANNER_PROFILE_ID = "mj";

function workoutDoc() {
  return doc(
    db,
    "plannerDashboardUsers",
    PLANNER_PROFILE_ID,
    "workoutWeeks",
    weekKey
  );
}

function legacyWorkoutDoc() {
  return doc(
    db,
    "plannerDashboardUsers",
    user.uid,
    "workoutWeeks",
    weekKey
  );
}

function absPlanDoc() {
  return doc(
    db,
    "plannerDashboardUsers",
    PLANNER_PROFILE_ID,
    "workoutPrograms",
    "diastasisRecti28"
  );
}

// =====================================================
// DEFAULT DATA
// =====================================================

function defaultData() {
  return {
    weekStart: weekKey,
    lifting: [],
    cardio: [],
    daily: {},
    dailyExercises: {},
    stretch: {},
    dailyNotes: {},
    stretchSessions: [],
    updatedAt: null
  };
}

// =====================================================
// GENERAL HELPERS
// =====================================================

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function esc(v = "") {
  const d = document.createElement("div");

  d.textContent = v;

  return d.innerHTML;
}

function showToast(msg) {
  $("toast").textContent = msg;
  $("toast").classList.add("show");

  setTimeout(() => {
    $("toast").classList.remove("show");
  }, 1800);
}

// =====================================================
// SAVE STATUS
// =====================================================

function markSaving() {
  $("saveStatus").textContent =
    "Saving…";
}

function markSaved() {
  $("saveStatus").textContent =
    "Saved";
}

function queueSave() {
  markSaving();

  clearTimeout(saveTimer);

  saveTimer = setTimeout(
    save,
    400
  );
}

function queueAbsSave() {
  markSaving();

  clearTimeout(absSaveTimer);

  absSaveTimer = setTimeout(
    saveAbsPlan,
    350
  );
}

// =====================================================
// FIRESTORE SAVING
// =====================================================

async function save() {
  try {
    await setDoc(
      workoutDoc(),
      {
        ...data,
        updatedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );

    markSaved();
  } catch (error) {
    console.error(
      "Workout save failed:",
      error
    );

    $("saveStatus").textContent =
      "Save failed";

    showToast(
      "Could not save workout data."
    );
  }
}

async function saveAbsPlan() {
  try {
    await setDoc(
      absPlanDoc(),
      {
        completed:
          absPlan.completed || {},
        updatedAt:
          serverTimestamp()
      },
      {
        merge: true
      }
    );

    markSaved();
  } catch (error) {
    console.error(
      "Abs plan save failed:",
      error
    );

    $("saveStatus").textContent =
      "Save failed";

    showToast(
      "Could not save abs plan progress."
    );
  }
}

// =====================================================
// AUTH + INITIAL LOAD
// =====================================================

onAuthStateChanged(
  auth,
  async current => {
    if (!current) {
      location.replace(
        "../../index.html"
      );

      return;
    }

    const email =
      (
        current.email || ""
      ).toLowerCase();

    if (
      !ALLOWED_EMAILS.has(email)
    ) {
      await signOut(auth);

      location.replace(
        "../../index.html"
      );

      return;
    }

    console.log(
      "Workout signed in as:",
      current.email
    );

    user = current;

    try {
      let snap =
        await getDoc(
          workoutDoc()
        );

      // ---------------------------------
      // Check old UID-based storage
      // ---------------------------------

      if (!snap.exists()) {
        const legacy =
          await getDoc(
            legacyWorkoutDoc()
          );

        if (legacy.exists()) {
          console.log(
            "Moving legacy workout data to shared planner profile."
          );

          await setDoc(
            workoutDoc(),
            legacy.data(),
            {
              merge: true
            }
          );

          snap =
            await getDoc(
              workoutDoc()
            );
        }
      }

      data = snap.exists()
        ? {
            ...defaultData(),
            ...snap.data()
          }
        : defaultData();

      // ---------------------------------
      // Load abs program
      // ---------------------------------

      const absSnap =
        await getDoc(
          absPlanDoc()
        );

      absPlan =
        absSnap.exists()
          ? {
              completed: {},
              ...absSnap.data()
            }
          : {
              completed: {}
            };

      absPlan.completed =
        absPlan.completed || {};

      bind();
      render();

      $("loadingScreen")
        ?.classList.add("done");

      console.log(
        "Workout data loaded successfully."
      );
    } catch (error) {
      console.error(
        "Workout data failed to load:",
        error
      );

      $("loadingScreen")
        ?.classList.add("done");

      showToast(
        "Could not load workout data."
      );
    }
  }
);

// =====================================================
// EVENT BINDINGS
// =====================================================

function bind() {
  $("signOutBtn").onclick =
    async () => {
      await signOut(auth);

      location.replace(
        "../../index.html"
      );
    };

  $("addLiftBtn").onclick =
    () => openDialog("lift");

  $("addCardioBtn").onclick =
    () => openDialog("cardio");

  $("dialogClose").onclick =
    closeDialog;

  $("dialogCancel").onclick =
    closeDialog;

  $("entryForm").onsubmit =
    submitDialog;

  document
    .querySelectorAll(
      "[data-cardio-min]"
    )
    .forEach(button => {
      button.onclick = () =>
        quickCardio(
          Number(
            button.dataset.cardioMin
          )
        );
    });

  document
    .querySelectorAll(
      "[data-stretch]"
    )
    .forEach(button => {
      button.onclick = () =>
        quickStretch(
          button.dataset.stretch
        );
    });

  $("dailyNote").oninput =
    () => {
      data.dailyNotes[todayKey] =
        $("dailyNote").value;

      queueSave();
    };
}

// =====================================================
// MAIN RENDER
// =====================================================

function render() {
  const end =
    addDays(
      weekStart,
      6
    );

  $("weekLabel").textContent =
    `${weekStart.toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric"
      }
    )} – ${end.toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    )}`;

  const liftDates =
    new Set(
      data.lifting.map(
        x => x.date
      )
    );

  $("liftingSessions").textContent =
    liftDates.size;

  $("cardioMinutes").textContent =
    data.cardio.reduce(
      (sum, x) =>
        sum +
        Number(
          x.minutes || 0
        ),
      0
    );

  $("dailyDays").textContent =
    `${
      weekKeys().filter(
        key => data.daily[key]
      ).length
    } / 7`;

  $("stretchDays").textContent =
    `${
      weekKeys().filter(
        key => data.stretch[key]
      ).length
    } / 7`;

  const totalVolume =
    data.lifting.reduce(
      (sum, x) =>
        sum +
        (
          Number(x.sets || 0) *
          Number(x.reps || 0) *
          Number(x.weight || 0)
        ),
      0
    );

  $("totalVolume").textContent =
    `${Math.round(
      totalVolume
    ).toLocaleString()} lbs`;

  $("dailyNote").value =
    data.dailyNotes[todayKey] ||
    "";

  renderLifting();
  renderCardio();
  renderDailyExercises();

  renderDayChecks(
    "dailyWeek",
    "daily"
  );

  renderDayChecks(
    "stretchWeek",
    "stretch"
  );

  renderStretchRecent();
  renderAbsPlan();
  renderGlance();
}

// =====================================================
// DAILY EXERCISES
// =====================================================

function renderDailyExercises() {
  data.dailyExercises =
    data.dailyExercises || {};

  const dayState =
    data.dailyExercises[
      todayKey
    ] || {};

  const el =
    $("dailyExerciseList");

  if (!el) {
    return;
  }

  el.innerHTML =
    DAILY_EXERCISES
      .map(name => {
        const done =
          !!dayState[name];

        return `
          <label class="daily-exercise-row${done ? " is-done" : ""}">
            <input
              type="checkbox"
              data-daily-exercise="${esc(name)}"
              ${done ? "checked" : ""}
            >

            <span class="daily-exercise-name">
              ${esc(name)}
            </span>

            <strong>
              10 reps
            </strong>
          </label>
        `;
      })
      .join("");

  el
    .querySelectorAll(
      "[data-daily-exercise]"
    )
    .forEach(input => {
      input.onchange = () => {
        const name =
          input.dataset.dailyExercise;

        data.dailyExercises[
          todayKey
        ] =
          data.dailyExercises[
            todayKey
          ] || {};

        data.dailyExercises[
          todayKey
        ][name] =
          input.checked;

        const allDone =
          DAILY_EXERCISES.every(
            exercise =>
              !!data.dailyExercises[
                todayKey
              ][exercise]
          );

        data.daily[todayKey] =
          allDone;

        render();
        queueSave();

        if (allDone) {
          showToast(
            "Daily exercises complete!"
          );
        }
      };
    });
}

// =====================================================
// LIFTING
// =====================================================

function renderLifting() {
  const el =
    $("liftingList");

  const rows =
    [...data.lifting].sort(
      (a, b) =>
        b.date.localeCompare(
          a.date
        )
    );

  el.innerHTML =
    rows.length
      ? rows
          .map(x => `
            <div class="entry">
              <div>
                <div class="entry-title">
                  ${esc(x.exercise)}
                </div>

                <div class="entry-meta">
                  ${x.sets} × ${x.reps}
                  ${
                    Number(x.weight)
                      ? ` @ ${x.weight} lb`
                      : ""
                  }
                </div>
              </div>

              <span class="entry-date">
                ${fmtDate(x.date)}
              </span>

              <button
                class="delete-entry"
                data-delete-lift="${x.id}"
                aria-label="Delete"
              >
                ×
              </button>
            </div>
          `)
          .join("")
      : `
          <div class="empty">
            No lifting logged yet.
            Start with one exercise.
          </div>
        `;

  el
    .querySelectorAll(
      "[data-delete-lift]"
    )
    .forEach(button => {
      button.onclick = () => {
        data.lifting =
          data.lifting.filter(
            x =>
              x.id !==
              button.dataset.deleteLift
          );

        render();
        queueSave();
      };
    });
}

// =====================================================
// CARDIO
// =====================================================

function renderCardio() {
  const totals = {};

  weekKeys().forEach(
    key => {
      totals[key] = 0;
    }
  );

  data.cardio.forEach(x => {
    if (x.date in totals) {
      totals[x.date] +=
        Number(
          x.minutes || 0
        );
    }
  });

  const max =
    Math.max(
      30,
      ...Object.values(
        totals
      )
    );

  $("cardioWeek").innerHTML =
    weekKeys()
      .map((key, i) => `
        <div class="bar-row">
          <b>
            ${DAYS[i]}
          </b>

          <div class="bar-track">
            <div
              class="bar-fill"
              style="width:${Math.min(
                100,
                totals[key] /
                  max *
                  100
              )}%"
            ></div>
          </div>

          <span>
            ${totals[key]} min
          </span>
        </div>
      `)
      .join("");

  const rows =
    [...data.cardio].sort(
      (a, b) =>
        b.date.localeCompare(
          a.date
        )
    );

  $("cardioList").innerHTML =
    rows.length
      ? rows
          .slice(0, 7)
          .map(x => `
            <div class="entry">
              <div>
                <div class="entry-title">
                  ${esc(
                    x.type ||
                    "Cardio"
                  )}
                </div>

                <div class="entry-meta">
                  ${x.minutes}
                  minutes
                </div>
              </div>

              <span class="entry-date">
                ${fmtDate(x.date)}
              </span>

              <button
                class="delete-entry"
                data-delete-cardio="${x.id}"
              >
                ×
              </button>
            </div>
          `)
          .join("")
      : "";

  $("cardioList")
    .querySelectorAll(
      "[data-delete-cardio]"
    )
    .forEach(button => {
      button.onclick = () => {
        data.cardio =
          data.cardio.filter(
            x =>
              x.id !==
              button.dataset.deleteCardio
          );

        render();
        queueSave();
      };
    });
}

// =====================================================
// WEEKLY CHECKS
// =====================================================

function renderDayChecks(
  id,
  kind
) {
  const el = $(id);

  el.innerHTML =
    weekKeys()
      .map((key, i) => `
        <button
          class="day-check ${data[kind][key] ? "done" : ""}"
          data-kind="${kind}"
          data-date="${key}"
        >
          <b>
            ${DAYS[i]}
          </b>

          <span>
            ${
              data[kind][key]
                ? "✓"
                : new Date(
                    `${key}T12:00:00`
                  ).getDate()
            }
          </span>
        </button>
      `)
      .join("");

  el
    .querySelectorAll(
      ".day-check"
    )
    .forEach(button => {
      button.onclick = () => {
        const obj =
          data[
            button.dataset.kind
          ];

        obj[
          button.dataset.date
        ] =
          !obj[
            button.dataset.date
          ];

        render();
        queueSave();
      };
    });
}

// =====================================================
// STRETCHING
// =====================================================

function renderStretchRecent() {
  const rows =
    [...data.stretchSessions]
      .sort(
        (a, b) =>
          b.date.localeCompare(
            a.date
          )
      )
      .slice(0, 8);

  const el =
    $("stretchRecent");

  el.innerHTML =
    rows.length
      ? rows
          .map(x => `
            <div class="recent-row">
              <span>
                ✓ ${esc(x.type)}
              </span>

              <span>
                ${fmtDate(x.date)}
              </span>

              <button
                class="delete-entry"
                data-delete-stretch="${x.id}"
                aria-label="Delete ${esc(x.type)} stretch"
              >
                ×
              </button>
            </div>
          `)
          .join("")
      : `
          <div class="empty">
            No stretching logged yet.
          </div>
        `;

  el
    .querySelectorAll(
      "[data-delete-stretch]"
    )
    .forEach(button => {
      button.onclick = () => {
        const session =
          data.stretchSessions.find(
            x =>
              x.id ===
              button.dataset.deleteStretch
          );

        data.stretchSessions =
          data.stretchSessions.filter(
            x =>
              x.id !==
              button.dataset.deleteStretch
          );

        if (
          session &&
          !data.stretchSessions.some(
            x =>
              x.date ===
              session.date
          )
        ) {
          data.stretch[
            session.date
          ] = false;
        }

        render();
        queueSave();

        showToast(
          "Stretching entry deleted"
        );
      };
    });
}

function quickStretch(type) {
  data.stretch[
    todayKey
  ] = true;

  data.stretchSessions.push({
    id: uid(),
    date: todayKey,
    type
  });

  render();
  queueSave();

  showToast(
    `${type} stretch logged`
  );
}

// =====================================================
// 28-DAY ABS PLAN
// =====================================================

function renderAbsPlan() {
  const el =
    $("absPlanCalendar");

  if (!el) {
    return;
  }

  absPlan.completed =
    absPlan.completed || {};

  const completedCount =
    ABS_PLAN_DAYS.reduce(
      (
        sum,
        workoutId,
        index
      ) =>
        sum +
        (
          workoutId &&
          absPlan.completed[
            String(index + 1)
          ]
            ? 1
            : 0
        ),
      0
    );

  $("absPlanProgress").textContent =
    `${completedCount} / 24`;

  el.innerHTML =
    ABS_PLAN_DAYS
      .map(
        (
          workoutId,
          index
        ) => {
          const day =
            index + 1;

          if (!workoutId) {
            return `
              <article class="abs-day rest-day">
                <div class="abs-day-number">
                  ${String(day).padStart(2, "0")}
                </div>

                <div class="abs-rest">
                  Rest Day
                </div>
              </article>
            `;
          }

          const workout =
            ABS_WORKOUTS[
              workoutId
            ];

          const done =
            !!absPlan.completed[
              String(day)
            ];

          return `
            <article class="abs-day${done ? " done" : ""}">
              <div class="abs-day-top">
                <span class="abs-day-number">
                  ${String(day).padStart(2, "0")}
                </span>

                <label
                  class="abs-complete"
                  title="Mark Day ${day} complete"
                >
                  <input
                    type="checkbox"
                    data-abs-day="${day}"
                    ${done ? "checked" : ""}
                  >

                  <span>
                    ✓
                  </span>
                </label>
              </div>

              <a
                class="abs-workout-link"
                href="${workout.url}"
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>
                  ${workout.title}
                </strong>

                <span>
                  (${workout.equipment})
                </span>
              </a>

              <div class="abs-duration">
                10 Minutes
                <span aria-hidden="true">
                  ↗
                </span>
              </div>
            </article>
          `;
        }
      )
      .join("");

  el
    .querySelectorAll(
      "[data-abs-day]"
    )
    .forEach(input => {
      input.onchange = () => {
        absPlan.completed[
          String(
            input.dataset.absDay
          )
        ] =
          input.checked;

        renderAbsPlan();
        queueAbsSave();

        if (input.checked) {
          showToast(
            `Abs Day ${input.dataset.absDay} complete!`
          );
        }
      };
    });
}

// =====================================================
// WEEK AT A GLANCE
// =====================================================

function renderGlance() {
  $("weekGlance").innerHTML =
    weekKeys()
      .map((key, i) => {
        const lift =
          data.lifting.some(
            x =>
              x.date === key
          );

        const card =
          data.cardio.some(
            x =>
              x.date === key
          );

        const daily =
          !!data.daily[key];

        const stretch =
          !!data.stretch[key];

        const icons = [
          lift ? "🏋️" : "",
          card ? "♥" : "",
          daily ? "✓" : "",
          stretch ? "❀" : ""
        ]
          .filter(Boolean)
          .join(" ");

        const labels = [
          lift ? "Lift" : "",
          card ? "Cardio" : "",
          daily ? "Move" : "",
          stretch
            ? "Stretch"
            : ""
        ]
          .filter(Boolean)
          .join(" • ") ||
          "Rest / open";

        return `
          <div class="glance-day">
            <strong>
              ${DAYS[i]}
            </strong>

            <span class="glance-date">
              ${fmtDate(key)}
            </span>

            <div class="glance-icons">
              ${icons || "○"}
            </div>

            <div class="glance-label">
              ${labels}
            </div>
          </div>
        `;
      })
      .join("");
}

// =====================================================
// QUICK CARDIO
// =====================================================

function quickCardio(minutes) {
  openDialog(
    "cardio",
    minutes
  );
}

// =====================================================
// ADD ENTRY DIALOG
// =====================================================

function openDialog(
  mode,
  presetMinutes = null
) {
  dialogMode = mode;

  $("dialogTitle").textContent =
    mode === "lift"
      ? "Add lifting exercise"
      : presetMinutes
        ? `Add ${presetMinutes} min cardio`
        : "Add cardio";

  $("dialogFields").innerHTML =
    mode === "lift"
      ? `
          <label>
            Date
            <input
              name="date"
              type="date"
              value="${todayKey}"
              required
            >
          </label>

          <label>
            Exercise
            <input
              name="exercise"
              type="text"
              placeholder="Goblet squat"
              required
            >
          </label>

          <label>
            Sets
            <input
              name="sets"
              type="number"
              min="1"
              value="3"
              required
            >
          </label>

          <label>
            Reps
            <input
              name="reps"
              type="number"
              min="1"
              value="10"
              required
            >
          </label>

          <label>
            Weight (lb)
            <input
              name="weight"
              type="number"
              min="0"
              step=".5"
              value="0"
            >
          </label>
        `
      : `
          <label>
            Date
            <input
              name="date"
              type="date"
              value="${todayKey}"
              required
            >
          </label>

          <label>
            Cardio type
            <input
              name="type"
              type="text"
              placeholder="Walk, bike, treadmill…"
              required
              autofocus
            >
          </label>

          <label>
            Minutes
            <input
              name="minutes"
              type="number"
              min="1"
              value="${presetMinutes ?? 20}"
              required
            >
          </label>
        `;

  $("entryDialog").showModal();
}

function closeDialog() {
  $("entryDialog").close();
  $("entryForm").reset();
}

function submitDialog(event) {
  event.preventDefault();

  const form =
    new FormData(
      event.currentTarget
    );

  if (
    dialogMode === "lift"
  ) {
    const row = {
      id: uid(),
      date: form.get("date"),
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
          form.get(
            "weight"
          ) || 0
        )
    };

    data.lifting.push(row);

    data.daily[
      row.date
    ] = true;
  } else {
    const row = {
      id: uid(),
      date:
        form.get("date"),
      type:
        form
          .get("type")
          .trim(),
      minutes:
        Number(
          form.get(
            "minutes"
          )
        )
    };

    data.cardio.push(row);

    data.daily[
      row.date
    ] = true;
  }

  closeDialog();
  render();
  queueSave();
}