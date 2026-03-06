// /readathon-world_Ver2/js/index.js
import { DEFAULT_SCHOOL_ID, getSchoolId, setSchoolId } from "/readathon-world_Ver2/js/firebase.js";

const schoolIdLabel = document.getElementById("schoolIdLabel");
const btnSetSchool = document.getElementById("btnSetSchool");
const dlg = document.getElementById("schoolDialog");
const input = document.getElementById("schoolIdInput");

function render() {
  schoolIdLabel.textContent = getSchoolId() || DEFAULT_SCHOOL_ID;
}
render();

btnSetSchool?.addEventListener("click", () => {
  input.value = getSchoolId() || DEFAULT_SCHOOL_ID;
  dlg.showModal();
});

dlg?.addEventListener("close", () => {
  if (dlg.returnValue === "ok") {
    const next = (input.value || "").trim() || DEFAULT_SCHOOL_ID;
    setSchoolId(next);
    render();
  }
});