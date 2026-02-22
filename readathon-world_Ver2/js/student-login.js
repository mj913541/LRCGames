// aaa /readathon-world_Ver2/js/student-login.js
import {
  DEFAULT_SCHOOL_ID,
  getSchoolId,
  setSchoolId,
  fnVerifyPin,
  signInWithToken,
  fetchActivePublicStudentsByGrade,
} from "/readathon-world_Ver2/js/firebase.js";

const ABS = {
  studentHome: "/readathon-world_Ver2/html/student-home.html",
  index: "/readathon-world_Ver2/html/index.html",
};

const els = {
  schoolIdLabel: document.getElementById("schoolIdLabel"),
  btnChangeSchool: document.getElementById("btnChangeSchool"),
  schoolDialog: document.getElementById("schoolDialog"),
  schoolIdInput: document.getElementById("schoolIdInput"),
  btnSaveSchool: document.getElementById("btnSaveSchool"),

  stepGrade: document.getElementById("stepGrade"),
  gradeGrid: document.getElementById("gradeGrid"),

  stepHomeroom: document.getElementById("stepHomeroom"),
  homeroomChips: document.getElementById("homeroomChips"),
  btnBackToGrade: document.getElementById("btnBackToGrade"),

  stepStudent: document.getElementById("stepStudent"),
  studentList: document.getElementById("studentList"),
  btnBackToHomeroom: document.getElementById("btnBackToHomeroom"),

  stepPin: document.getElementById("stepPin"),
  whoBox: document.getElementById("whoBox"),
  pinForm: document.getElementById("pinForm"),
  pinInput: document.getElementById("pinInput"),
  btnLogin: document.getElementById("btnLogin"),
  btnBackToStudents: document.getElementById("btnBackToStudents"),
  btnClearPin: document.getElementById("btnClearPin"),
  errorBox: document.getElementById("errorBox"),

  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
};

// Grade icon mapping (PLACEHOLDER naming convention).
// Swap these filenames to match your actual PNG names.
const gradeIconPath = (gradeNum) => `/readathon-world_Ver2/img/grades/grade_${gradeNum}.png`;
// If you have Kindergarten as a different filename, we can map it later.

const gradeLabels = {
  0: "Kindergarten",
  1: "1st Grade",
  2: "2nd Grade",
  3: "3rd Grade",
  4: "4th Grade",
  5: "5th Grade",
};

let state = {
  schoolId: getSchoolId(),
  grade: null,
  homeroomId: null,
  student: null, // {id, displayName, grade, homeroomId}
  studentsByGrade: [],
};

init();

function init() {
  // Ensure a schoolId exists
  if (!state.schoolId) {
    state.schoolId = DEFAULT_SCHOOL_ID;
    setSchoolId(state.schoolId);
  }
  renderSchool();

  wireSchoolDialog();
  renderGradeGrid();

// Do NOT auto-select a grade on page load.
// Students should always tap their grade.
state.grade = null;
showStep("grade");
}

function wireSchoolDialog() {
  els.btnChangeSchool.addEventListener("click", () => {
    els.schoolIdInput.value = state.schoolId || DEFAULT_SCHOOL_ID;
    els.schoolDialog.showModal();
  });

  els.schoolDialog.addEventListener("close", () => {
    // Only save if "ok" pressed (dialog returns value "ok" based on button)
    // We used a submit button with value="ok", so dialog.returnValue is "ok"
    if (els.schoolDialog.returnValue === "ok") {
      const next = (els.schoolIdInput.value || "").trim();
      state.schoolId = next || DEFAULT_SCHOOL_ID;
      setSchoolId(state.schoolId);

      // Reset flow
      state.grade = null;
      state.homeroomId = null;
      state.student = null;
      state.studentsByGrade = [];

      renderSchool();
      showStep("grade");
      clearChildren(els.homeroomChips);
      clearChildren(els.studentList);
      els.pinInput.value = "";
      hideError();
      renderGradeGrid();
    }
  });
}

function renderSchool() {
  els.schoolIdLabel.textContent = state.schoolId || DEFAULT_SCHOOL_ID;
}

function renderGradeGrid() {
  clearChildren(els.gradeGrid);

  for (let g = 0; g <= 5; g++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gradeBtn";
    btn.dataset.grade = String(g);

    const img = document.createElement("img");
    img.className = "gradeIcon";
    img.alt = `${gradeLabels[g]} icon`;
    img.src = gradeIconPath(g);
    img.loading = "lazy";

    const text = document.createElement("div");
    text.className = "gradeText";
    text.innerHTML = `<strong>${gradeLabels[g]}</strong><em>Tap to continue</em>`;

    btn.appendChild(img);
    btn.appendChild(text);

    btn.addEventListener("click", () => {
      selectGrade(g).catch((e) => showFriendlyError(e));
    });

    els.gradeGrid.appendChild(btn);
  }
}

async function selectGrade(gradeNum) {
  state.grade = gradeNum;
  showLoading(`Loading ${gradeLabels[gradeNum]}…`);

  // Load active public students for this grade (single query)
  const students = await fetchActivePublicStudentsByGrade(state.schoolId, gradeNum);
  state.studentsByGrade = students;

  // Derive homerooms from student list (simplest + reliable)
  const homeroomSet = new Set();
  for (const s of students) {
    if (s.homeroomId) homeroomSet.add(s.homeroomId);
  }
  const homerooms = Array.from(homeroomSet).sort();

  renderHomerooms(homerooms);
  hideLoading();

  showStep("homeroom");
}

function renderHomerooms(homeroomIds) {
  clearChildren(els.homeroomChips);

  if (!homeroomIds.length) {
    const empty = document.createElement("div");
    empty.className = "msg msg--error";
    empty.textContent = "No classes found for this grade yet. (Check publicStudents + active=true.)";
    els.homeroomChips.appendChild(empty);
    return;
  }

  for (const hr of homeroomIds) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = prettyHomeroom(hr);

    chip.addEventListener("click", () => {
      selectHomeroom(hr);
    });

    els.homeroomChips.appendChild(chip);
  }

  els.btnBackToGrade.onclick = () => {
    state.homeroomId = null;
    state.student = null;
    showStep("grade");
  };
}

function selectHomeroom(homeroomId) {
  state.homeroomId = homeroomId;
  state.student = null;

  // Highlight active chip
  for (const node of els.homeroomChips.querySelectorAll(".chip")) {
    node.classList.toggle("chip--active", node.textContent === prettyHomeroom(homeroomId));
  }

  const list = state.studentsByGrade
    .filter((s) => s.homeroomId === homeroomId)
    .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));

  renderStudents(list);
  showStep("student");
}

function renderStudents(students) {
  clearChildren(els.studentList);

  if (!students.length) {
    const empty = document.createElement("div");
    empty.className = "msg msg--error";
    empty.textContent = "No student names found in this class yet.";
    els.studentList.appendChild(empty);
    return;
  }

  for (const s of students) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "studentBtn";

    const left = document.createElement("div");
    left.textContent = s.displayName || s.id;

    const right = document.createElement("small");
    right.textContent = prettyHomeroom(s.homeroomId);

    btn.appendChild(left);
    btn.appendChild(right);

    btn.addEventListener("click", () => {
      state.student = { id: s.id, displayName: s.displayName, grade: s.grade, homeroomId: s.homeroomId };
      goPinStep();
    });

    els.studentList.appendChild(btn);
  }

  els.btnBackToHomeroom.onclick = () => {
    state.student = null;
    showStep("homeroom");
  };
}

function goPinStep() {
  hideError();
  els.pinInput.value = "";
  const s = state.student;
  els.whoBox.textContent = `Logging in: ${s.displayName} • ${gradeLabels[s.grade]} • ${prettyHomeroom(s.homeroomId)}`;

  showStep("pin");
  els.pinInput.focus();

  els.btnBackToStudents.onclick = () => showStep("student");
  els.btnClearPin.onclick = () => {
    els.pinInput.value = "";
    els.pinInput.focus();
    hideError();
  };

  els.pinForm.onsubmit = async (e) => {
  e.preventDefault();
  hideError();

  const pin = (els.pinInput.value || "").trim();
  if (!/^\d{4}$/.test(pin)) {
    showError("Please enter a 4-digit PIN.");
    els.pinInput.focus();
    return;
  }

  // FORCE safe strings
  const userId = String(state.student?.id || "").trim().toLowerCase();
  const schoolId = String(state.schoolId || DEFAULT_SCHOOL_ID).trim();

  console.log("verifyPin payload check:", { schoolId, userId, pin, pinLen: pin.length });

  // Extra guard so you get a friendly UI error instead of a 400
  if (!schoolId || !userId) {
    showError("Missing school or student. Please go back and select your name again.");
    return;
  }

  try {
    showLoading("Checking PIN…");

    const res = await fnVerifyPin({ schoolId, userId, pin });
    const customToken = res?.data?.customToken;

    if (!customToken) {
      throw new Error("Missing customToken from verifyPin.");
    }

    showLoading("Signing you in…");
    await signInWithToken(customToken);

    // Save some session hints
    localStorage.setItem("readathonV2_schoolId", schoolId);
    localStorage.setItem("readathonV2_userId", userId);
    localStorage.setItem("readathonV2_role", "student");

    hideLoading();
    window.location.href = ABS.studentHome;
  } catch (err) {
    hideLoading();
    showFriendlyError(err);
  }
};
}

function showStep(which) {
  els.stepGrade.classList.toggle("isHidden", which !== "grade");
  els.stepHomeroom.classList.toggle("isHidden", which !== "homeroom");
  els.stepStudent.classList.toggle("isHidden", which !== "student");
  els.stepPin.classList.toggle("isHidden", which !== "pin");
}

function showLoading(text) {
  els.loadingText.textContent = text || "Loading…";
  els.loadingOverlay.classList.remove("isHidden");
}
function hideLoading() {
  els.loadingOverlay.classList.add("isHidden");
}

function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.classList.remove("isHidden");
}
function hideError() {
  els.errorBox.classList.add("isHidden");
  els.errorBox.textContent = "";
}

function showFriendlyError(err) {
  console.error(err);
  const msg = normalizeError(err);
  showError(msg);
}

function normalizeError(err) {
  const raw =
    err?.message ||
    err?.toString?.() ||
    "Something went wrong. Please try again.";

  // Friendlier messages for common callable errors
  if (raw.includes("unauthenticated") || raw.includes("UNAUTHENTICATED")) {
    return "Login problem. Please try again.";
  }
  if (raw.toLowerCase().includes("wrong pin") || raw.toLowerCase().includes("invalid pin")) {
    return "That PIN didn’t match. Try again!";
  }
  if (raw.toLowerCase().includes("inactive")) {
    return "Your account is not active yet. Ask your teacher for help.";
  }
  if (raw.toLowerCase().includes("not found")) {
    return "We couldn’t find your account. Ask your teacher for help.";
  }
  return raw;
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function prettyHomeroom(homeroomId) {
  if (!homeroomId) return "";
  // hr_peterson -> "Peterson"
  return homeroomId.startsWith("hr_")
    ? homeroomId.replace("hr_", "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : homeroomId;
}