/* Read-A-Thon Survey — survey.js
   - Put index.html, styles.css, and this file in the same folder.
   - Update ENDPOINT if needed.
*/

const ENDPOINT = "https://script.google.com/macros/s/AKfycbzYb0s4THN4hcBm7X9hDeIKRToDSuQWbxRje-wVwiR9f38KJ0X8l82Aa0hw-LO8OsO3cQ/exec";

const form = document.getElementById("survey");
const msg = document.getElementById("msg");
const resetBtn = document.getElementById("resetBtn");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");

const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const endpointHint = document.getElementById("endpointHint");

const steps = Array.from(document.querySelectorAll(".step"));
let stepIndex = 0; // 0-based

function showStep(i){
  steps.forEach((s, idx) => s.classList.toggle("active", idx === i));
  const humanStep = i + 1;
  progressText.textContent = `Step ${humanStep} of ${steps.length}`;
  progressBar.style.width = `${(humanStep / steps.length) * 100}%`;

  backBtn.disabled = (i === 0);

  if (i === steps.length - 1){
    nextBtn.textContent = "✅ Submit";
  } else {
    nextBtn.textContent = "Next ➜";
  }

  msg.textContent = "";
  msg.className = "msg";
}

function getChecked(groupName){
  const boxWrap = document.querySelector(`[data-group="${groupName}"]`);
  if(!boxWrap) return [];
  return Array.from(boxWrap.querySelectorAll("input[type=checkbox]:checked"))
    .map(cb => cb.value);
}

// Prize checkboxes are spread across cards, so we tag them with data-prize="1"
function getPrizeChecks(){
  return Array.from(document.querySelectorAll('input[type="checkbox"][data-prize="1"]:checked'))
    .map(cb => cb.value);
}

function valRadio(name){
  const el = form.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}

function validateCurrentStep(){
  // Only enforce required fields in Step 1
  if (stepIndex === 0){
    const grade = valRadio("grade");
    const teacher = valRadio("teacher");
    if(!grade || !teacher){
      msg.textContent = "Please choose your grade and teacher to continue.";
      msg.className = "msg bad";
      return false;
    }
  }
  return true;
}

resetBtn.addEventListener("click", () => {
  form.reset();
  stepIndex = 0;
  showStep(stepIndex);
});

backBtn.addEventListener("click", () => {
  if (stepIndex > 0){
    stepIndex--;
    showStep(stepIndex);
  }
});

nextBtn.addEventListener("click", async () => {
  if (!validateCurrentStep()) return;

  if (stepIndex < steps.length - 1){
    stepIndex++;
    showStep(stepIndex);
    return;
  }

  // Last step -> submit
  msg.textContent = "Submitting…";
  msg.className = "msg";

  const fd = new FormData(form);

  const payload = {
    grade: valRadio("grade"),
    teacher: valRadio("teacher"),
    teacherOther: fd.get("teacherOther") || "",

    currencyName: fd.get("currencyName") || "",
    currencyOther: fd.get("currencyOther") || "",
    spendFrequency: valRadio("spendFrequency"),
    spendFrequencyOther: fd.get("spendFrequencyOther") || "",

    avatarTypes: getChecked("avatarTypes"),
    avatarTypesOther: fd.get("avatarTypesOther") || "",
    avatarVibe: valRadio("avatarVibe"),
    avatarVibeOther: fd.get("avatarVibeOther") || "",

    wantsPets: valRadio("wantsPets"),
    wantsPetsOther: fd.get("wantsPetsOther") || "",
    petTypes: getChecked("petTypes"),
    petTypesOther: fd.get("petTypesOther") || "",

    itemTypes: getChecked("itemTypes"),
    itemTypesOther: fd.get("itemTypesOther") || "",

    highCostItems: getChecked("highCostItems"),
    highCostOther: fd.get("highCostOther") || "",

    roomThemes: getChecked("roomThemes"),
    roomThemesOther: fd.get("roomThemesOther") || "",

    decorTypes: getChecked("decorTypes"),
    decorOther: fd.get("decorOther") || "",

    otherSpendIdeas: fd.get("otherSpendIdeas") || "",
    streakRewards: fd.get("streakRewards") || "",

    fundraiserPrizeInterests: getPrizeChecks(),
    fundraiserOther: fd.get("fundraiserOther") || "",

    topPrize: fd.get("topPrize") || "",
    oneBigIdea: fd.get("oneBigIdea") || ""
  };

  try{
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const out = await res.json();

    if(out.ok){
      msg.textContent = "✅ Submitted! Thank you!";
      msg.className = "msg ok";
      form.reset();
      stepIndex = 0;
      showStep(stepIndex);
    } else {
      msg.textContent = "❌ Something went wrong: " + (out.error || "Unknown error");
      msg.className = "msg bad";
    }
  } catch(err){
    msg.textContent = "❌ Could not submit. " + err;
    msg.className = "msg bad";
  }
});

// init
try{
  if (!ENDPOINT || ENDPOINT.includes("PASTE") || !ENDPOINT.startsWith("https://script.google.com/")){
    endpointHint.hidden = false;
  }
} catch(e){ /* ignore */ }

showStep(stepIndex);
