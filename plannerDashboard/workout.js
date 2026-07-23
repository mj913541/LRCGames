import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyDTKYFcm26i0LsrLo9UjtLnZpNKx4XsWG4",authDomain:"lrcquest-3039e.firebaseapp.com",projectId:"lrcquest-3039e",storageBucket:"lrcquest-3039e.firebasestorage.app",messagingSenderId:"72063656342",appId:"1:72063656342:web:bc08c6538437f50b53bdb7",measurementId:"G-5VXRYJ733C"};
const ALLOWED_EMAILS=new Set(["malbrecht@sd308.org","malbrecht3317@gmail.com"]);
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
let user=null,data=null,saveTimer=null,dialogMode=null;
const today=new Date(), weekStart=startOfWeek(today), weekKey=localDateKey(weekStart), todayKey=localDateKey(today);
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return x}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function localDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function workoutDoc(){return doc(db,"plannerDashboardUsers",user.uid,"workoutWeeks",weekKey)}
function defaultData(){return{weekStart:weekKey,lifting:[],cardio:[],daily:{},stretch:{},dailyNotes:{},stretchSessions:[],updatedAt:null}}
function uid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`}
function showToast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1800)}
function markSaving(){$("saveStatus").textContent="Saving…"} function markSaved(){$("saveStatus").textContent="Saved"}
function queueSave(){markSaving();clearTimeout(saveTimer);saveTimer=setTimeout(save,400)}
async function save(){try{await setDoc(workoutDoc(),{...data,updatedAt:serverTimestamp()},{merge:true});markSaved()}catch(e){console.error(e);$("saveStatus").textContent="Save failed";showToast("Could not save workout data.")}}
function esc(v=""){const d=document.createElement("div");d.textContent=v;return d.innerHTML}
function fmtDate(key){const d=new Date(`${key}T12:00:00`);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}

onAuthStateChanged(auth,async current=>{if(!current){location.replace("../login.html?redirect=plannerDashboard/workout.html");return}if(!ALLOWED_EMAILS.has((current.email||"").toLowerCase())){await signOut(auth);location.replace("../login.html?reason=unauthorized");return}user=current;const snap=await getDoc(workoutDoc());data=snap.exists()?{...defaultData(),...snap.data()}:defaultData();bind();render();$("loadingScreen").classList.add("done")});

function bind(){
  $("signOutBtn").onclick=()=>signOut(auth);
  $("addLiftBtn").onclick=()=>openDialog("lift"); $("addCardioBtn").onclick=()=>openDialog("cardio");
  $("dialogClose").onclick=closeDialog; $("dialogCancel").onclick=closeDialog;
  $("entryForm").onsubmit=submitDialog;
  document.querySelectorAll("[data-cardio-min]").forEach(b=>b.onclick=()=>quickCardio(Number(b.dataset.cardioMin)));
  document.querySelectorAll("[data-stretch]").forEach(b=>b.onclick=()=>quickStretch(b.dataset.stretch));
  $("dailyNote").oninput=()=>{data.dailyNotes[todayKey]=$("dailyNote").value;queueSave()};
}

function render(){
  const end=addDays(weekStart,6);$("weekLabel").textContent=`${weekStart.toLocaleDateString("en-US",{month:"long",day:"numeric"})} – ${end.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}`;
  const liftDates=new Set(data.lifting.map(x=>x.date)); $("liftingSessions").textContent=liftDates.size;
  $("cardioMinutes").textContent=data.cardio.reduce((s,x)=>s+Number(x.minutes||0),0);
  $("dailyDays").textContent=`${weekKeys().filter(k=>data.daily[k]).length} / 7`; $("stretchDays").textContent=`${weekKeys().filter(k=>data.stretch[k]).length} / 7`;
  $("totalVolume").textContent=`${Math.round(data.lifting.reduce((s,x)=>s+(Number(x.sets||0)*Number(x.reps||0)*Number(x.weight||0)),0)).toLocaleString()} lbs`;
  $("dailyNote").value=data.dailyNotes[todayKey]||"";
  renderLifting();renderCardio();renderDayChecks("dailyWeek","daily");renderDayChecks("stretchWeek","stretch");renderStretchRecent();renderGlance();
}
function weekKeys(){return DAYS.map((_,i)=>localDateKey(addDays(weekStart,i)))}
function renderLifting(){const el=$("liftingList");const rows=[...data.lifting].sort((a,b)=>b.date.localeCompare(a.date));el.innerHTML=rows.length?rows.map(x=>`<div class="entry"><div><div class="entry-title">${esc(x.exercise)}</div><div class="entry-meta">${x.sets} × ${x.reps}${Number(x.weight)?` @ ${x.weight} lb`:""}</div></div><span class="entry-date">${fmtDate(x.date)}</span><button class="delete-entry" data-delete-lift="${x.id}" aria-label="Delete">×</button></div>`).join(""):`<div class="empty">No lifting logged yet. Start with one exercise.</div>`;el.querySelectorAll("[data-delete-lift]").forEach(b=>b.onclick=()=>{data.lifting=data.lifting.filter(x=>x.id!==b.dataset.deleteLift);render();queueSave()})}
function renderCardio(){const totals={};weekKeys().forEach(k=>totals[k]=0);data.cardio.forEach(x=>{if(x.date in totals)totals[x.date]+=Number(x.minutes||0)});const max=Math.max(30,...Object.values(totals));$("cardioWeek").innerHTML=weekKeys().map((k,i)=>`<div class="bar-row"><b>${DAYS[i]}</b><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,totals[k]/max*100)}%"></div></div><span>${totals[k]} min</span></div>`).join("");const rows=[...data.cardio].sort((a,b)=>b.date.localeCompare(a.date));$("cardioList").innerHTML=rows.length?rows.slice(0,7).map(x=>`<div class="entry"><div><div class="entry-title">${esc(x.type||"Cardio")}</div><div class="entry-meta">${x.minutes} minutes</div></div><span class="entry-date">${fmtDate(x.date)}</span><button class="delete-entry" data-delete-cardio="${x.id}">×</button></div>`).join(""):"";$("cardioList").querySelectorAll("[data-delete-cardio]").forEach(b=>b.onclick=()=>{data.cardio=data.cardio.filter(x=>x.id!==b.dataset.deleteCardio);render();queueSave()})}
function renderDayChecks(id,kind){const el=$(id);el.innerHTML=weekKeys().map((k,i)=>`<button class="day-check ${data[kind][k]?"done":""}" data-kind="${kind}" data-date="${k}"><b>${DAYS[i]}</b><span>${data[kind][k]?"✓":new Date(`${k}T12:00:00`).getDate()}</span></button>`).join("");el.querySelectorAll(".day-check").forEach(b=>b.onclick=()=>{const obj=data[b.dataset.kind];obj[b.dataset.date]=!obj[b.dataset.date];render();queueSave()})}
function renderStretchRecent(){const rows=[...data.stretchSessions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);$("stretchRecent").innerHTML=rows.map(x=>`<div class="recent-row"><span>✓ ${esc(x.type)}</span><span>${fmtDate(x.date)}</span></div>`).join("")}
function renderGlance(){$("weekGlance").innerHTML=weekKeys().map((k,i)=>{const lift=data.lifting.some(x=>x.date===k),card=data.cardio.some(x=>x.date===k),daily=!!data.daily[k],stretch=!!data.stretch[k];const icons=[lift?"🏋️":"",card?"♥":"",daily?"✓":"",stretch?"❀":""].filter(Boolean).join(" ");const labels=[lift?"Lift":"",card?"Cardio":"",daily?"Move":"",stretch?"Stretch":""].filter(Boolean).join(" • ")||"Rest / open";return `<div class="glance-day"><strong>${DAYS[i]}</strong><span class="glance-date">${fmtDate(k)}</span><div class="glance-icons">${icons||"○"}</div><div class="glance-label">${labels}</div></div>`}).join("")}
function quickCardio(minutes){data.cardio.push({id:uid(),date:todayKey,type:"Cardio",minutes});data.daily[todayKey]=true;render();queueSave();showToast(`Added ${minutes} cardio minutes`)}
function quickStretch(type){data.stretch[todayKey]=true;data.stretchSessions.push({id:uid(),date:todayKey,type});render();queueSave();showToast(`${type} stretch logged`)}
function openDialog(mode){dialogMode=mode;$("dialogTitle").textContent=mode==="lift"?"Add lifting exercise":"Add cardio";$("dialogFields").innerHTML=mode==="lift"?`<label>Date<input name="date" type="date" value="${todayKey}" required></label><label>Exercise<input name="exercise" type="text" placeholder="Goblet squat" required></label><label>Sets<input name="sets" type="number" min="1" value="3" required></label><label>Reps<input name="reps" type="number" min="1" value="10" required></label><label>Weight (lb)<input name="weight" type="number" min="0" step=".5" value="0"></label>`:`<label>Date<input name="date" type="date" value="${todayKey}" required></label><label>Cardio type<input name="type" type="text" placeholder="Walk, bike, treadmill…" required></label><label>Minutes<input name="minutes" type="number" min="1" value="20" required></label>`;$("entryDialog").showModal()}
function closeDialog(){$("entryDialog").close();$("entryForm").reset()}
function submitDialog(e){e.preventDefault();const f=new FormData(e.currentTarget);if(dialogMode==="lift"){const row={id:uid(),date:f.get("date"),exercise:f.get("exercise").trim(),sets:Number(f.get("sets")),reps:Number(f.get("reps")),weight:Number(f.get("weight")||0)};data.lifting.push(row);data.daily[row.date]=true}else{const row={id:uid(),date:f.get("date"),type:f.get("type").trim(),minutes:Number(f.get("minutes"))};data.cardio.push(row);data.daily[row.date]=true}closeDialog();render();queueSave()}
