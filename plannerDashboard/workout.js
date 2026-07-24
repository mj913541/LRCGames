import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyDTKYFcm26i0LsrLo9UjtLnZpNKx4XsWG4",authDomain:"lrcquest-3039e.firebaseapp.com",projectId:"lrcquest-3039e",storageBucket:"lrcquest-3039e.firebasestorage.app",messagingSenderId:"72063656342",appId:"1:72063656342:web:bc08c6538437f50b53bdb7",measurementId:"G-5VXRYJ733C"};
const ALLOWED_EMAILS=new Set(["malbrecht@sd308.org","malbrecht3317@gmail.com"]);
const PLANNER_PROFILE_ID="mj";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
let user=null,data=null,liftProgram=null,absPlan={completed:{}},saveTimer=null,liftSaveTimer=null,absSaveTimer=null,dialogMode=null;
let minimumMode=false;

const today=new Date(),weekStart=startOfWeek(today),weekKey=localDateKey(weekStart),todayKey=localDateKey(today);
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const DAILY_EXERCISES=["Push-ups","Squats","Glute bridges","Backpack rows","Calf raises","Bird dog"];

const ROTATION=[
  {id:"pushA",label:"Push A",group:"Push",exercises:[
    ex("Press","3 × 8–12",8,12,true),
    ex("Shoulder Press","3 × 8–12",8,12,true),
    ex("Flyes","3 × 10–15",10,15,false),
    ex("Lateral Raise","3 × 12–15",12,15,true),
    ex("Kickbacks","3 × 10–15",10,15,false)
  ]},
  {id:"legsA",label:"Legs A",group:"Legs",exercises:[
    ex("Squat","3 × 8–12",8,12,true),
    ex("RDL","3 × 8–12",8,12,true),
    ex("Lunge","3 × 8–12 / leg",8,12,true),
    ex("Leg Curl","3 × 10–15",10,15,false),
    ex("Outer Lift","3 × 12–15 / side",12,15,false),
    ex("Calf Raise","3 × 12–20",12,20,false)
  ]},
  {id:"pullA",label:"Pull A",group:"Pull",exercises:[
    ex("Rows","3 × 8–12",8,12,true),
    ex("Lat Pulldown","3 × 8–12",8,12,true),
    ex("Face Pull","3 × 12–15",12,15,false),
    ex("Bent Lateral Raise","3 × 12–15",12,15,false),
    ex("Hammer Curl","3 × 8–12",8,12,true)
  ]},
  {id:"fullA",label:"Full A",group:"Full Body",exercises:[
    ex("Sumo Squat","3 × 8–12",8,12,true),
    ex("Press","3 × 8–12",8,12,true),
    ex("RDL","3 × 8–12",8,12,false),
    ex("Rows","3 × 8–12",8,12,true),
    ex("Rear Kick","3 × 12–15 / side",12,15,false),
    ex("Bicep Curl","3 × 10–15",10,15,false)
  ]},
  {id:"pushB",label:"Push B",group:"Push",exercises:[
    ex("Press","3 × 8–12",8,12,true),
    ex("Shoulder Press","3 × 8–12",8,12,true),
    ex("Push-ups","3 × comfortable max",6,30,true,true),
    ex("Front Raise","3 × 10–15",10,15,false),
    ex("Dips","3 × 8–15",8,15,false,true),
    ex("Nose Breaker","3 × 10–15",10,15,false)
  ]},
  {id:"legsB",label:"Legs B",group:"Legs",exercises:[
    ex("Squat","3 × 8–12",8,12,true),
    ex("RDL","3 × 8–12",8,12,true),
    ex("Side Lunge","3 × 8–12 / side",8,12,true),
    ex("Extension","3 × 10–15",10,15,false),
    ex("Inner Lift","3 × 12–15 / side",12,15,false),
    ex("Butt Blaster","3 × 12–15 / side",12,15,false)
  ]},
  {id:"pullB",label:"Pull B",group:"Pull",exercises:[
    ex("Lat Pulldown","3 × 8–12",8,12,true),
    ex("Rows","3 × 8–12",8,12,true),
    ex("DB Pullover","3 × 10–15",10,15,false),
    ex("Face Pull","3 × 12–15",12,15,false),
    ex("Bicep Curl","3 × 8–12",8,12,true),
    ex("Hammer Curl","3 × 10–15",10,15,false)
  ]},
  {id:"fullB",label:"Full B",group:"Full Body",exercises:[
    ex("Lunge","3 × 8–12 / leg",8,12,true),
    ex("Press","3 × 8–12",8,12,true),
    ex("DB Pullover","3 × 10–15",10,15,true),
    ex("Sumo Squat","3 × 10–15",10,15,false),
    ex("Upright Row","3 × 10–15",10,15,false),
    ex("Calf Raise","3 × 12–20",12,20,false)
  ]}
];

function ex(name,prescription,minReps,maxReps,minimum=false,bodyweight=false){
  return {name,prescription,minReps,maxReps,minimum,bodyweight};
}

const ABS_WORKOUTS={
  1:{title:"DR #1",equipment:"Bodyweight",url:"https://www.nourishmovelove.com/5-postpartum-recovery-ab-exercises-beginner/"},
  2:{title:"DR #2",equipment:"Pilates Ball",url:"https://www.nourishmovelove.com/5-pilates-ab-exercises-beginner/"},
  3:{title:"DR #3",equipment:"Long Band",url:"https://www.nourishmovelove.com/5-postpartum-ab-exercises-resistance-band-beginner/"},
  4:{title:"DR #4",equipment:"Bodyweight",url:"https://www.nourishmovelove.com/5-postpartum-recovery-ab-exercises-advanced/"},
  5:{title:"DR #5",equipment:"Pilates Ball",url:"https://www.nourishmovelove.com/5-pilates-ab-exercises-advanced/"},
  6:{title:"DR #6",equipment:"Long Band",url:"https://www.nourishmovelove.com/5-postpartum-ab-exercises-resistance-band-advanced/"},
  7:{title:"DR #7",equipment:"Bodyweight",url:"https://www.nourishmovelove.com/postpartum-recovery-diastasis-recti-exercises/"},
  8:{title:"DR #8",equipment:"Pilates Ball",url:"https://www.nourishmovelove.com/beginner-ab-workout/"},
  9:{title:"DR #9",equipment:"Mini Band",url:"https://www.nourishmovelove.com/5-postpartum-ab-exercises-mini-band/"}
};
const ABS_PLAN_DAYS=[1,2,3,1,2,3,null,4,5,6,4,5,6,null,7,8,9,7,8,9,null,4,5,6,7,8,9,null];

function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return x}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function localDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function weekKeys(){return DAYS.map((_,i)=>localDateKey(addDays(weekStart,i)))}
function uid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`}
function esc(v=""){const d=document.createElement("div");d.textContent=v;return d.innerHTML}
function fmtDate(key){const d=new Date(`${key}T12:00:00`);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}

function workoutDoc(){return doc(db,"plannerDashboardUsers",PLANNER_PROFILE_ID,"workoutWeeks",weekKey)}
function legacyWorkoutDoc(){return doc(db,"plannerDashboardUsers",user.uid,"workoutWeeks",weekKey)}
function liftingProgramDoc(){return doc(db,"plannerDashboardUsers",PLANNER_PROFILE_ID,"workoutPrograms","rollingLifting")}
function absPlanDoc(){return doc(db,"plannerDashboardUsers",PLANNER_PROFILE_ID,"workoutPrograms","diastasisRecti28")}

function defaultData(){return{weekStart:weekKey,lifting:[],cardio:[],daily:{},dailyExercises:{},stretch:{},dailyNotes:{},stretchSessions:[],updatedAt:null}}
function defaultLiftProgram(){return{rotationIndex:0,currentSession:null,exerciseHistory:{},completedSessions:[],updatedAt:null}}

function markSaving(){$("saveStatus").textContent="Saving…"}
function markSaved(){$("saveStatus").textContent="Saved"}
function showToast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1900)}
function queueSave(){markSaving();clearTimeout(saveTimer);saveTimer=setTimeout(saveWeekly,350)}
function queueLiftSave(){markSaving();clearTimeout(liftSaveTimer);liftSaveTimer=setTimeout(saveLiftProgram,300)}
function queueAbsSave(){markSaving();clearTimeout(absSaveTimer);absSaveTimer=setTimeout(saveAbsPlan,300)}
async function saveWeekly(){try{await setDoc(workoutDoc(),{...data,updatedAt:serverTimestamp()},{merge:true});markSaved()}catch(e){console.error(e);$("saveStatus").textContent="Save failed";showToast("Could not save workout data.")}}
async function saveLiftProgram(){try{await setDoc(liftingProgramDoc(),{...liftProgram,updatedAt:serverTimestamp()},{merge:true});markSaved()}catch(e){console.error(e);$("saveStatus").textContent="Save failed";showToast("Could not save lifting progress.")}}
async function saveAbsPlan(){try{await setDoc(absPlanDoc(),{completed:absPlan.completed||{},updatedAt:serverTimestamp()},{merge:true});markSaved()}catch(e){console.error(e);$("saveStatus").textContent="Save failed"}}

onAuthStateChanged(auth,async current=>{
  if(!current){location.replace("../login.html?redirect=plannerDashboard/workout.html");return}
  if(!ALLOWED_EMAILS.has((current.email||"").toLowerCase())){await signOut(auth);location.replace("../login.html?reason=unauthorized");return}
  user=current;
  try{
    let snap=await getDoc(workoutDoc());
    if(!snap.exists()){
      const legacy=await getDoc(legacyWorkoutDoc());
      if(legacy.exists()){await setDoc(workoutDoc(),legacy.data(),{merge:true});snap=await getDoc(workoutDoc())}
    }
    data=snap.exists()?{...defaultData(),...snap.data()}:defaultData();

    const liftSnap=await getDoc(liftingProgramDoc());
    liftProgram=liftSnap.exists()?{...defaultLiftProgram(),...liftSnap.data()}:defaultLiftProgram();
    normalizeLiftProgram();

    const absSnap=await getDoc(absPlanDoc());
    absPlan=absSnap.exists()?{completed:{},...absSnap.data()}:{completed:{}};
    absPlan.completed=absPlan.completed||{};

    bind();
    render();
    $("loadingScreen").classList.add("done");
  }catch(err){
    console.error(err);
    $("loadingScreen").classList.add("done");
    $("saveStatus").textContent="Load failed";
    showToast("Workout data could not load.");
  }
});

function normalizeLiftProgram(){
  liftProgram.rotationIndex=Number.isInteger(liftProgram.rotationIndex)?liftProgram.rotationIndex%ROTATION.length:0;
  liftProgram.exerciseHistory=liftProgram.exerciseHistory||{};
  liftProgram.completedSessions=Array.isArray(liftProgram.completedSessions)?liftProgram.completedSessions:[];
  if(liftProgram.currentSession && liftProgram.currentSession.workoutId!==ROTATION[liftProgram.rotationIndex].id){
    liftProgram.currentSession=null;
  }
}

function bind(){
  $("signOutBtn").onclick=()=>signOut(auth);
  $("minimumWorkoutBtn").onclick=()=>{
    minimumMode=!minimumMode;
    $("minimumWorkoutBtn").textContent=minimumMode?"✓ Minimum mode":"⚡ Minimum mode";
    renderRollingWorkout();
  };
  $("resetWorkoutBtn").onclick=()=>{
    if(!confirm("Clear the entries in your current lifting session? Your rotation will stay on the same workout."))return;
    liftProgram.currentSession=null;minimumMode=false;renderRollingWorkout();queueLiftSave();
  };
  $("finishWorkoutBtn").onclick=finishWorkout;
  $("addLiftBtn").onclick=()=>openDialog("lift");
  $("addCardioBtn").onclick=()=>openDialog("cardio");
  $("dialogClose").onclick=closeDialog;$("dialogCancel").onclick=closeDialog;$("entryForm").onsubmit=submitDialog;
  document.querySelectorAll("[data-cardio-min]").forEach(b=>b.onclick=()=>quickCardio(Number(b.dataset.cardioMin)));
  document.querySelectorAll("[data-stretch]").forEach(b=>b.onclick=()=>quickStretch(b.dataset.stretch));
  $("dailyNote").oninput=()=>{data.dailyNotes[todayKey]=$("dailyNote").value;queueSave()};
}

function currentWorkout(){return ROTATION[liftProgram.rotationIndex]}

function ensureCurrentSession(){
  const w=currentWorkout();
  if(!liftProgram.currentSession){
    liftProgram.currentSession={
      id:uid(),workoutId:w.id,workoutLabel:w.label,startedDate:todayKey,exercises:{}
    };
  }
  w.exercises.forEach(exercise=>{
    if(!liftProgram.currentSession.exercises[exercise.name]){
      const hist=liftProgram.exerciseHistory[exercise.name];
      const suggested=hist?.suggestedWeight ?? hist?.weight ?? 0;
      liftProgram.currentSession.exercises[exercise.name]={
        complete:false,
        sets:[1,2,3].map(()=>({weight:exercise.bodyweight?"":suggested||"",reps:"",feel:"good"}))
      };
    }
  });
}

function render(){
  const end=addDays(weekStart,6);
  $("weekLabel").textContent=`${weekStart.toLocaleDateString("en-US",{month:"long",day:"numeric"})} – ${end.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}`;
  $("liftingSessions").textContent=new Set(data.lifting.filter(x=>x.date).map(x=>x.sessionId||x.date)).size;
  $("cardioMinutes").textContent=data.cardio.reduce((s,x)=>s+Number(x.minutes||0),0);
  $("dailyDays").textContent=`${weekKeys().filter(k=>data.daily[k]).length} / 7`;
  $("stretchDays").textContent=`${weekKeys().filter(k=>data.stretch[k]).length} / 7`;
  $("totalVolume").textContent=`${Math.round(data.lifting.reduce((s,x)=>s+Number(x.volume||Number(x.sets||0)*Number(x.reps||0)*Number(x.weight||0)),0)).toLocaleString()} lbs`;
  $("dailyNote").value=data.dailyNotes[todayKey]||"";
  renderRollingWorkout();renderLifting();renderCardio();renderDailyExercises();renderDayChecks("dailyWeek","daily");renderDayChecks("stretchWeek","stretch");renderStretchRecent();renderAbsPlan();renderGlance();
}

function renderRollingWorkout(){
  ensureCurrentSession();
  const w=currentWorkout(),session=liftProgram.currentSession;

  $("nextWorkoutTitle").textContent=`${w.label} • ${w.group}`;
  $("nextWorkoutSubtitle").textContent=minimumMode?"Minimum workout: only the anchor movements are shown.":"Complete the lineup below. Your rotation advances only when you finish.";

  $("rotationStrip").innerHTML=ROTATION.map((item,i)=>{
    const offset=(i-liftProgram.rotationIndex+ROTATION.length)%ROTATION.length;
    return `<div class="rotation-pill ${i===liftProgram.rotationIndex?"active":""}">
      <b>${esc(item.label)}</b><span>${i===liftProgram.rotationIndex?"NOW":offset===1?"NEXT":`+${offset}`}</span>
    </div>`;
  }).join("");

  $("activeWorkoutList").innerHTML=w.exercises.map((exercise,index)=>{
    const s=session.exercises[exercise.name];
    const hist=liftProgram.exerciseHistory[exercise.name];
    const hidden=minimumMode&&!exercise.minimum;
    const note=progressionMessage(exercise,hist);
    return `<article class="lift-exercise ${s.complete?"complete":""} ${hidden?"minimum-hidden":""}" data-exercise="${esc(exercise.name)}">
      <div class="exercise-top">
        <input class="exercise-check" type="checkbox" data-complete-ex="${esc(exercise.name)}" ${s.complete?"checked":""} aria-label="Complete ${esc(exercise.name)}">
        <div><div class="exercise-name">${esc(exercise.name)}</div><div class="exercise-prescription">${esc(exercise.prescription)}${exercise.minimum?' • minimum-workout anchor':''}</div></div>
        <div class="exercise-last">${hist?`Last time<strong>${hist.weight?`${hist.weight} lb • `:""}${hist.reps?.join("/")||"—"}</strong>`:"No history yet"}</div>
      </div>
      <div class="set-grid header"><span></span><span>Weight</span><span>Reps</span><span>Feel</span><span class="feel-cell">Set</span></div>
      ${s.sets.map((set,i)=>`<div class="set-grid">
        <span class="set-label">Set ${i+1}</span>
        <input inputmode="decimal" type="number" min="0" step=".5" data-set-field="${esc(exercise.name)}|${i}|weight" value="${esc(set.weight)}" placeholder="${exercise.bodyweight?"BW":"lb"}" aria-label="${esc(exercise.name)} set ${i+1} weight">
        <input inputmode="numeric" type="number" min="0" data-set-field="${esc(exercise.name)}|${i}|reps" value="${esc(set.reps)}" placeholder="reps" aria-label="${esc(exercise.name)} set ${i+1} reps">
        <select class="feel-select" data-set-field="${esc(exercise.name)}|${i}|feel" aria-label="${esc(exercise.name)} set ${i+1} feel">
          ${["easy","good","hard","tooHeavy"].map(v=>`<option value="${v}" ${set.feel===v?"selected":""}>${{easy:"😌 Easy",good:"👍 Good",hard:"🥵 Hard",tooHeavy:"🛑 Too heavy"}[v]}</option>`).join("")}
        </select>
        <span class="feel-cell subtle">${set.reps?`${set.reps} reps`:"—"}</span>
      </div>`).join("")}
      ${note?`<div class="progression-note ${note.ready?"ready":""}">${esc(note.text)}</div>`:""}
    </article>`;
  }).join("");

  document.querySelectorAll("[data-set-field]").forEach(el=>{
    el.onchange=el.oninput=()=>{
      const [name,index,field]=el.dataset.setField.split("|");
      const target=liftProgram.currentSession.exercises[name].sets[Number(index)];
      target[field]=field==="feel"?el.value:el.value;
      updateExerciseAutoComplete(name);
      updateRollingSummary();
      queueLiftSave();
    };
  });
  document.querySelectorAll("[data-complete-ex]").forEach(el=>{
    el.onchange=()=>{
      liftProgram.currentSession.exercises[el.dataset.completeEx].complete=el.checked;
      renderRollingWorkout();queueLiftSave();
    };
  });
  updateRollingSummary();
}

function updateExerciseAutoComplete(name){
  const x=liftProgram.currentSession.exercises[name];
  const filled=x.sets.every(s=>Number(s.reps)>0);
  if(filled)x.complete=true;
}

function visibleExercises(){
  const w=currentWorkout();
  return minimumMode?w.exercises.filter(e=>e.minimum):w.exercises;
}

function updateRollingSummary(){
  const vis=visibleExercises(),session=liftProgram.currentSession;
  const done=vis.filter(e=>session.exercises[e.name]?.complete).length;
  const pct=vis.length?Math.round(done/vis.length*100):0;
  $("liftProgressLabel").textContent=`${done} of ${vis.length} exercises complete`;
  $("liftProgressPercent").textContent=`${pct}%`;
  $("liftProgressFill").style.width=`${pct}%`;

  let volume=0;
  vis.forEach(e=>session.exercises[e.name].sets.forEach(s=>volume+=Number(s.weight||0)*Number(s.reps||0)));
  $("sessionVolume").textContent=`Session volume: ${Math.round(volume).toLocaleString()} lb`;

  $("finishWorkoutBtn").disabled=done===0;
  $("finishHint").textContent=done===vis.length?"Everything shown is complete — nice work!":minimumMode?"Minimum mode still counts. Finish whenever the anchor lifts are done.":"You can finish after completing the workout, or stop after what you managed today.";
}

function progressionMessage(exercise,hist){
  if(!hist)return null;
  if(hist.readyToIncrease)return {ready:true,text:`🎉 Last time you hit the top of the range. Try ${hist.suggestedWeight} lb when it feels appropriate.`};
  return {ready:false,text:`Last saved: ${hist.weight?hist.weight+" lb • ":""}${(hist.reps||[]).join(" / ")}. Keep building within ${exercise.minReps}–${exercise.maxReps} reps.`};
}

async function finishWorkout(){
  ensureCurrentSession();
  const w=currentWorkout(),session=liftProgram.currentSession,vis=visibleExercises();
  const performed=vis.filter(e=>{
    const s=session.exercises[e.name];
    return s.complete||s.sets.some(set=>Number(set.reps)>0);
  });
  if(!performed.length){showToast("Log at least one exercise first.");return}

  const completedAt=new Date().toISOString();
  performed.forEach(exercise=>{
    const s=session.exercises[exercise.name];
    const validSets=s.sets.filter(set=>Number(set.reps)>0);
    const weights=validSets.map(set=>Number(set.weight||0));
    const reps=validSets.map(set=>Number(set.reps||0));
    const weight=weights.length?Math.max(...weights):0;
    const feels=validSets.map(set=>set.feel);
    const topRange=reps.length===3&&reps.every(r=>r>=exercise.maxReps);
    const anyTooHeavy=feels.includes("tooHeavy");
    const increment=weight>=50?5:2.5;
    const readyToIncrease=topRange&&!anyTooHeavy&&!exercise.bodyweight&&weight>0;
    const suggestedWeight=readyToIncrease?weight+increment:weight;

    liftProgram.exerciseHistory[exercise.name]={
      weight,reps,feels,readyToIncrease,suggestedWeight,date:todayKey,workoutId:w.id
    };

    const volume=validSets.reduce((sum,set)=>sum+Number(set.weight||0)*Number(set.reps||0),0);
    data.lifting.push({
      id:uid(),sessionId:session.id,date:todayKey,exercise:exercise.name,
      workoutId:w.id,workoutLabel:w.label,sets:validSets.length,
      reps:reps.length?Math.round(reps.reduce((a,b)=>a+b,0)/reps.length):0,
      repsBySet:reps,weight,volume,minimumMode
    });
  });

  liftProgram.completedSessions.push({
    id:session.id,date:todayKey,completedAt,workoutId:w.id,workoutLabel:w.label,
    minimumMode,exerciseNames:performed.map(e=>e.name)
  });
  liftProgram.completedSessions=liftProgram.completedSessions.slice(-100);

  liftProgram.rotationIndex=(liftProgram.rotationIndex+1)%ROTATION.length;
  liftProgram.currentSession=null;
  minimumMode=false;

  await Promise.all([saveWeekly(),saveLiftProgram()]);
  render();
  showToast(`Finished ${w.label}! Next up: ${currentWorkout().label}.`);
}

function renderLifting(){
  const rows=[...data.lifting].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,14);
  $("liftingList").innerHTML=rows.length?rows.map(x=>`<div class="entry">
    <div><div class="entry-title">${esc(x.exercise)}${x.workoutLabel?` • ${esc(x.workoutLabel)}`:""}</div><div class="entry-meta">${x.repsBySet?.length?x.repsBySet.join(" / "):`${x.sets} × ${x.reps}`}${Number(x.weight)?` @ ${x.weight} lb`:""}</div></div>
    <span class="entry-date">${fmtDate(x.date)}</span><button class="delete-entry" data-delete-lift="${x.id}" aria-label="Delete">×</button>
  </div>`).join(""):`<div class="empty">No lifting logged yet. Your rolling program is ready above.</div>`;
  $("liftingList").querySelectorAll("[data-delete-lift]").forEach(b=>b.onclick=()=>{
    data.lifting=data.lifting.filter(x=>x.id!==b.dataset.deleteLift);render();queueSave();
  });
}

function renderCardio(){
  const totals={};weekKeys().forEach(k=>totals[k]=0);
  data.cardio.forEach(x=>{if(x.date in totals)totals[x.date]+=Number(x.minutes||0)});
  const max=Math.max(30,...Object.values(totals));
  $("cardioWeek").innerHTML=weekKeys().map((k,i)=>`<div class="bar-row"><b>${DAYS[i]}</b><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,totals[k]/max*100)}%"></div></div><span>${totals[k]} min</span></div>`).join("");
  const rows=[...data.cardio].sort((a,b)=>b.date.localeCompare(a.date));
  $("cardioList").innerHTML=rows.length?rows.slice(0,7).map(x=>`<div class="entry"><div><div class="entry-title">${esc(x.type||"Cardio")}</div><div class="entry-meta">${x.minutes} minutes</div></div><span class="entry-date">${fmtDate(x.date)}</span><button class="delete-entry" data-delete-cardio="${x.id}">×</button></div>`).join(""):"";
  $("cardioList").querySelectorAll("[data-delete-cardio]").forEach(b=>b.onclick=()=>{data.cardio=data.cardio.filter(x=>x.id!==b.dataset.deleteCardio);render();queueSave()});
}

function renderDailyExercises(){
  data.dailyExercises=data.dailyExercises||{};
  const dayState=data.dailyExercises[todayKey]||{};
  $("dailyExerciseList").innerHTML=DAILY_EXERCISES.map(name=>{
    const done=!!dayState[name];
    return `<label class="daily-exercise-row${done?" is-done":""}"><input type="checkbox" data-daily-exercise="${esc(name)}" ${done?"checked":""}><span class="daily-exercise-name">${esc(name)}</span><strong>10 reps</strong></label>`;
  }).join("");
  $("dailyExerciseList").querySelectorAll("[data-daily-exercise]").forEach(input=>input.onchange=()=>{
    const name=input.dataset.dailyExercise;
    data.dailyExercises[todayKey]=data.dailyExercises[todayKey]||{};
    data.dailyExercises[todayKey][name]=input.checked;
    data.daily[todayKey]=DAILY_EXERCISES.every(ex=>!!data.dailyExercises[todayKey][ex]);
    render();queueSave();
    if(data.daily[todayKey])showToast("Daily exercises complete!");
  });
}

function renderDayChecks(id,kind){
  const el=$(id);
  el.innerHTML=weekKeys().map((k,i)=>`<button class="day-check ${data[kind][k]?"done":""}" data-kind="${kind}" data-date="${k}"><b>${DAYS[i]}</b><span>${data[kind][k]?"✓":new Date(`${k}T12:00:00`).getDate()}</span></button>`).join("");
  el.querySelectorAll(".day-check").forEach(b=>b.onclick=()=>{const obj=data[b.dataset.kind];obj[b.dataset.date]=!obj[b.dataset.date];render();queueSave()});
}

function renderStretchRecent(){
  const rows=[...data.stretchSessions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  $("stretchRecent").innerHTML=rows.length?rows.map(x=>`<div class="recent-row"><span>✓ ${esc(x.type)}</span><span>${fmtDate(x.date)}</span><button class="delete-entry" data-delete-stretch="${x.id}">×</button></div>`).join(""):`<div class="empty">No stretching logged yet.</div>`;
  $("stretchRecent").querySelectorAll("[data-delete-stretch]").forEach(b=>b.onclick=()=>{
    const session=data.stretchSessions.find(x=>x.id===b.dataset.deleteStretch);
    data.stretchSessions=data.stretchSessions.filter(x=>x.id!==b.dataset.deleteStretch);
    if(session&&!data.stretchSessions.some(x=>x.date===session.date))data.stretch[session.date]=false;
    render();queueSave();
  });
}

function renderAbsPlan(){
  const el=$("absPlanCalendar"),completedCount=ABS_PLAN_DAYS.reduce((sum,w,index)=>sum+(w&&absPlan.completed[String(index+1)]?1:0),0);
  $("absPlanProgress").textContent=`${completedCount} / 24`;
  el.innerHTML=ABS_PLAN_DAYS.map((workoutId,index)=>{
    const day=index+1;
    if(!workoutId)return `<article class="abs-day rest-day"><div class="abs-day-top"><span class="abs-day-number">${String(day).padStart(2,"0")}</span></div><div class="abs-rest">Rest Day</div></article>`;
    const w=ABS_WORKOUTS[workoutId],done=!!absPlan.completed[String(day)];
    return `<article class="abs-day${done?" done":""}"><div class="abs-day-top"><span class="abs-day-number">${String(day).padStart(2,"0")}</span><label class="abs-complete"><input type="checkbox" data-abs-day="${day}" ${done?"checked":""}><span>✓</span></label></div><a class="abs-workout-link" href="${w.url}" target="_blank" rel="noopener noreferrer"><strong>${w.title}</strong><span>(${w.equipment})</span></a><div class="abs-duration">10 Minutes ↗</div></article>`;
  }).join("");
  el.querySelectorAll("[data-abs-day]").forEach(input=>input.onchange=()=>{
    absPlan.completed[String(input.dataset.absDay)]=input.checked;renderAbsPlan();queueAbsSave();
  });
}

function renderGlance(){
  $("weekGlance").innerHTML=weekKeys().map((k,i)=>{
    const lift=data.lifting.some(x=>x.date===k),card=data.cardio.some(x=>x.date===k),daily=!!data.daily[k],stretch=!!data.stretch[k];
    const icons=[lift?"🏋️":"",card?"♥":"",daily?"✓":"",stretch?"❀":""].filter(Boolean).join(" ");
    const labels=[lift?"Lift":"",card?"Cardio":"",daily?"Move":"",stretch?"Stretch":""].filter(Boolean).join(" • ")||"Rest / open";
    return `<div class="glance-day"><strong>${DAYS[i]}</strong><span class="glance-date">${fmtDate(k)}</span><div class="glance-icons">${icons||"○"}</div><div class="glance-label">${labels}</div></div>`;
  }).join("");
}

function quickCardio(minutes){openDialog("cardio",minutes)}
function quickStretch(type){data.stretch[todayKey]=true;data.stretchSessions.push({id:uid(),date:todayKey,type});render();queueSave();showToast(`${type} stretch logged`)}

function openDialog(mode,presetMinutes=null){
  dialogMode=mode;
  $("dialogTitle").textContent=mode==="lift"?"Add extra lifting exercise":presetMinutes?`Add ${presetMinutes} min cardio`:"Add cardio";
  $("dialogFields").innerHTML=mode==="lift"?
    `<label>Date<input name="date" type="date" value="${todayKey}" required></label><label>Exercise<input name="exercise" type="text" placeholder="Goblet squat" required></label><label>Sets<input name="sets" type="number" min="1" value="3" required></label><label>Reps<input name="reps" type="number" min="1" value="10" required></label><label>Weight (lb)<input name="weight" type="number" min="0" step=".5" value="0"></label>`:
    `<label>Date<input name="date" type="date" value="${todayKey}" required></label><label>Cardio type<input name="type" type="text" placeholder="Walk, bike, treadmill…" required></label><label>Minutes<input name="minutes" type="number" min="1" value="${presetMinutes||20}" required></label>`;
  $("entryDialog").showModal();
}
function closeDialog(){$("entryDialog").close();$("entryForm").reset()}
function submitDialog(e){
  e.preventDefault();const fd=new FormData(e.currentTarget);
  if(dialogMode==="lift"){
    const sets=Number(fd.get("sets")),reps=Number(fd.get("reps")),weight=Number(fd.get("weight")||0);
    data.lifting.push({id:uid(),date:fd.get("date"),exercise:fd.get("exercise"),sets,reps,weight,volume:sets*reps*weight,extra:true});
  }else{
    data.cardio.push({id:uid(),date:fd.get("date"),type:fd.get("type"),minutes:Number(fd.get("minutes"))});
  }
  closeDialog();render();queueSave();showToast("Saved!");
}
