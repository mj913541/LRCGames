// js/login.js (UI only — Firestore later)

const params = new URLSearchParams(location.search);
const isStaffMode = params.get("mode") === "staff";

const steps = {
  grade: document.querySelector('[data-step="grade"]'),
  homeroom: document.querySelector('[data-step="homeroom"]'),
  student: document.querySelector('[data-step="student"]'),
  pin: document.querySelector('[data-step="pin"]'),
  staff: document.querySelector('[data-step="staff"]'),
};

const flowTitle = document.getElementById("flowTitle");
const flowHint = document.getElementById("flowHint");
const trailText = document.getElementById("trailText");

const gradeChoices = document.getElementById("gradeChoices");
const homeroomChoices = document.getElementById("homeroomChoices");
const studentChoices = document.getElementById("studentChoices");

const backBtn = document.getElementById("backBtn");
const resetBtn = document.getElementById("resetBtn");

const pinInput = document.getElementById("pinInput");
const pinGo = document.getElementById("pinGo");

const staffCode = document.getElementById("staffCode");
const staffGo = document.getElementById("staffGo");

// Fake data just for UI testing
const GRADES = ["EC", "K", "1", "2", "3", "4", "5"];
const HOMEROOMS_BY_GRADE = {
  EC: ["Ms. Panda", "Mr. Toucan"],
  K: ["Mrs. Tiger", "Ms. Monkey"],
  1: ["Mr. Gecko", "Ms. Gazelle"],
  2: ["Mrs. Owl", "Mr. Hippo"],
  3: ["Ms. Koala", "Mr. Croc"],
  4: ["Mrs. Zebra", "Ms. Parrot"],
  5: ["Mr. Rhino", "Mrs. Flamingo"],
};
const STUDENTS_BY_HOMEROOM = {
  "Ms. Panda": ["Ava", "Noah", "Mia"],
  "Mr. Toucan": ["Liam", "Olivia", "Ethan"],
  "Mrs. Tiger": ["Sophia", "Jackson", "Emma"],
  "Ms. Monkey": ["Lucas", "Amelia", "Mason"],
  "Mr. Gecko": ["Harper", "Elijah", "Ella"],
  "Ms. Gazelle": ["Logan", "Aria", "James"],
  "Mrs. Owl": ["Benjamin", "Luna", "Henry"],
  "Mr. Hippo": ["Chloe", "Jack", "Zoey"],
  "Ms. Koala": ["Levi", "Nora", "Sebastian"],
  "Mr. Croc": ["Riley", "Owen", "Isla"],
  "Mrs. Zebra": ["Hannah", "Carter", "Grace"],
  "Ms. Parrot": ["Wyatt", "Scarlett", "Aiden"],
  "Mr. Rhino": ["Layla", "Caleb", "Victoria"],
  "Mrs. Flamingo": ["Isaac", "Penelope", "Julian"],
};

let state = {
  step: "grade",
  grade: null,
  homeroom: null,
  student: null,
};

function showOnly(stepName){
  Object.entries(steps).forEach(([name, el]) => {
    el.classList.toggle("hidden", name !== stepName);
  });
  state.step = stepName;

  const map = { grade:"Grade", homeroom:"Homeroom", student:"Student", pin:"PIN", staff:"Staff" };
  trailText.textContent = `Trail: ${map[stepName] || stepName}`;
}

function setHeader(){
  if (isStaffMode) {
    flowTitle.textContent = "Staff Login";
    flowHint.textContent = "Enter your staff code.";
  } else {
    flowTitle.textContent = "Student Login";
    flowHint.textContent = "Pick your grade to begin.";
  }
}

function makeChoiceButton(label, emoji){
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "choice";
  btn.innerHTML = `<div class="choice-emoji">${emoji || "🌿"}</div><div class="choice-label">${label}</div>`;
  return btn;
}

function renderGrades(){
  gradeChoices.innerHTML = "";
  GRADES.forEach(g => {
    const emoji = g === "EC" ? "🐣" : g === "K" ? "🧩" : "📘";
    const btn = makeChoiceButton(g, emoji);
    btn.addEventListener("click", () => {
      state.grade = g;
      renderHomerooms();
      showOnly("homeroom");
      flowHint.textContent = "Now choose your homeroom.";
    });
    gradeChoices.appendChild(btn);
  });
}

function renderHomerooms(){
  homeroomChoices.innerHTML = "";
  const rooms = HOMEROOMS_BY_GRADE[state.grade] || [];
  rooms.forEach(r => {
    const btn = makeChoiceButton(r, "🏕️");
    btn.addEventListener("click", () => {
      state.homeroom = r;
      renderStudents();
      showOnly("student");
      flowHint.textContent = "Choose your name.";
    });
    homeroomChoices.appendChild(btn);
  });
}

function renderStudents(){
  studentChoices.innerHTML = "";
  const kids = STUDENTS_BY_HOMEROOM[state.homeroom] || [];
  kids.forEach(name => {
    const btn = makeChoiceButton(name, "🧒");
    btn.classList.add("choice-row");
    btn.addEventListener("click", () => {
      state.student = name;
      showOnly("pin");
      flowHint.textContent = `Hi ${name}! Enter your PIN.`;
      pinInput.value = "";
      pinInput.focus();
    });
    studentChoices.appendChild(btn);
  });
}

function goBack(){
  if (isStaffMode) return location.href = "index.html";
  if (state.step === "pin") return showOnly("student");
  if (state.step === "student") return showOnly("homeroom");
  if (state.step === "homeroom") return showOnly("grade");
  return location.href = "index.html";
}

function resetFlow(){
  state = { step:"grade", grade:null, homeroom:null, student:null };
  flowHint.textContent = "Pick your grade to begin.";
  showOnly("grade");
}

backBtn.addEventListener("click", goBack);
resetBtn.addEventListener("click", resetFlow);

pinGo.addEventListener("click", () => {
  alert(`(Demo) Logged in as ${state.student} in ${state.homeroom} — PIN: ${pinInput.value}`);
});

staffGo?.addEventListener("click", () => {
  alert(`(Demo) Staff login code: ${staffCode.value}`);
});

// Init
setHeader();
if (isStaffMode) {
  showOnly("staff");
} else {
  renderGrades();
  showOnly("grade");
}
