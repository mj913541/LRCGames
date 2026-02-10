import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const el = (id) => document.getElementById(id);

const msgEl = el("msg");
const outEl = el("out");
const teacherIdEl = el("teacherId");
const dryRunBtn = el("dryRunBtn");
const convertBtn = el("convertBtn");

function setMsg(text, ok=false) {
  msgEl.textContent = text || "";
  msgEl.style.color = ok ? "green" : "crimson";
}

function setOut(obj) {
  outEl.textContent = obj ? JSON.stringify(obj, null, 2) : "";
}

const functions = getFunctions();
const convertRubies = httpsCallable(functions, "convertRubies");

async function run(dryRun) {
  setMsg("");
  setOut(null);

  const teacherId = teacherIdEl.value.trim();

  try {
    setMsg(dryRun ? "Running dry run…" : "Converting…", true);
    const res = await convertRubies({
      dryRun,
      ...(teacherId ? { teacherId } : {})
    });
    setOut(res.data);
    setMsg("✅ Done.", true);
  } catch (err) {
    console.error(err);
    setMsg(err.message || "Conversion failed.");
  }
}

dryRunBtn.addEventListener("click", () => run(true));
convertBtn.addEventListener("click", () => run(false));

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "./admin.html";
});
