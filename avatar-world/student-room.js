// student-room.js
import { db } from "./firebase.js";
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

async function getItemMapByIds(ids) {
  if (!ids.length) return new Map();

  // Simple approach: fetch active storeItems and map them.
  // (If storeItems gets huge later, we’ll optimize with indexed lookups.)
  const q = query(collection(db, "storeItems"), where("active", "==", true));
  const snap = await getDocs(q);

  const m = new Map();
  snap.forEach(d => m.set(d.id, { id: d.id, ...d.data() }));
  return m;
}

function clearStage(stageEl) {
  while (stageEl.firstChild) stageEl.removeChild(stageEl.firstChild);
}

function addLayer(stageEl, src, className) {
  if (!src) return;
  const img = document.createElement("img");
  img.className = `room-layer ${className || ""}`.trim();
  img.alt = "";
  img.src = src;
  stageEl.appendChild(img);
}

export async function initStudentRoom({ studentPath, stageId = "avatarStage" }) {
  const stageEl = document.getElementById(stageId);
  if (!stageEl) return;

  const studentRef = doc(db, studentPath);
  const studentSnap = await getDoc(studentRef);
  if (!studentSnap.exists()) return;

  const student = studentSnap.data();
  const equipped = student.equipped || {};

  // Collect equipped item IDs
  const equippedIds = Object.values(equipped).filter(Boolean);
  const itemMap = await getItemMapByIds(equippedIds);

  // Resolve image URLs
  const bg = itemMap.get(equipped.background)?.imageURL || itemMap.get(equipped.background)?.img || null;
  const decor = itemMap.get(equipped.decor)?.imageURL || itemMap.get(equipped.decor)?.img || null;
  const avatar = itemMap.get(equipped.body)?.imageURL || itemMap.get(equipped.body)?.img || null;
  const outfit = itemMap.get(equipped.outfit)?.imageURL || itemMap.get(equipped.outfit)?.img || null;
  const accessory = itemMap.get(equipped.accessory)?.imageURL || itemMap.get(equipped.accessory)?.img || null;
  const pet = itemMap.get(equipped.pet)?.imageURL || itemMap.get(equipped.pet)?.img || null;

  clearStage(stageEl);

  // Order matters (bottom → top)
  addLayer(stageEl, bg, "bg");
  addLayer(stageEl, decor, "decor");
  addLayer(stageEl, avatar, "avatar");
  addLayer(stageEl, outfit, "avatar");
  addLayer(stageEl, accessory, "avatar");
  addLayer(stageEl, pet, "avatar");
}
