import { auth, db } from "/readathon-world/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection, query, where, orderBy, getDocs, doc, getDoc,
  runTransaction, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById("grid");
const msg = document.getElementById("msg");
const cat = document.getElementById("cat");
const search = document.getElementById("search");
const balanceChip = document.getElementById("balanceChip");

let uid = null;
let session = null;
let rubiesBalance = 0;
let items = [];
let owned = new Set();

function setMsg(text, ok=false) {
  msg.textContent = text || "";
  msg.style.color = ok ? "green" : "crimson";
}

async function loadSession(u) {
  const s = await getDoc(doc(db, "users", u));
  return s.exists() ? s.data() : null;
}

async function loadBalance(studentId) {
  const snap = await getDoc(doc(db, "students", studentId));
  const data = snap.exists() ? snap.data() : {};
  rubiesBalance = Number(data.rubiesBalance ?? 0);
  balanceChip.querySelector(".amt").textContent = rubiesBalance;
}

async function loadOwned(studentId) {
  owned = new Set();
  const invCol = collection(db, "students", studentId, "inventory");
  const invSnap = await getDocs(invCol);
  invSnap.forEach(d => owned.add(d.id));
}

async function loadItems() {
  const qRef = query(
    collection(db, "storeItems"),
    where("active", "==", true),
    orderBy("sortOrder", "asc")
  );
  const snap = await getDocs(qRef);
  items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function render() {
  const category = cat.value;
  const q = (search.value || "").trim().toLowerCase();

  const filtered = items.filter(it => {
    if (category !== "all" && it.category !== category) return false;
    if (q && !(String(it.name || "").toLowerCase().includes(q))) return false;
    return true;
  });

  grid.innerHTML = filtered.map(it => {
    const isOwned = owned.has(it.id);
    const canAfford = (rubiesBalance >= (it.price || 0));
    const disabled = isOwned || !canAfford;

    return `
      <div class="card" style="padding:12px; border-radius:14px;">
        <div style="aspect-ratio: 1 / 1; border-radius:12px; overflow:hidden; background:rgba(0,0,0,.08); display:flex; align-items:center; justify-content:center;">
          ${it.imageUrl ? `<img src="${it.imageUrl}" alt="${it.name || "Item"}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="font-size:40px;">🧺</div>`}
        </div>
        <h3 style="margin:10px 0 6px 0;">${it.name || it.id}</h3>
        <div class="chip">💎 ${it.price ?? 0}</div>
        <div style="margin-top:10px; display:flex; gap:8px;">
          <button class="btn" data-buy="${it.id}" ${disabled ? "disabled" : ""}>
            ${isOwned ? "Owned ✅" : (canAfford ? "Buy" : "Not enough 💎")}
          </button>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("[data-buy]").forEach(btn => {
    btn.addEventListener("click", () => buy(btn.getAttribute("data-buy")));
  });
}

async function buy(itemId) {
  setMsg("");
  const studentId = session?.studentId;
  if (!uid || !studentId) return setMsg("Please sign in again.");

  const itemRef = doc(db, "storeItems", itemId);
  const studentRef = doc(db, "students", studentId);
  const invRef = doc(db, "students", studentId, "inventory", itemId);
  const purchaseRef = doc(collection(db, "purchases")); // auto id

  try {
    await runTransaction(db, async (tx) => {
      const [itemSnap, stuSnap, invSnap] = await Promise.all([
        tx.get(itemRef),
        tx.get(studentRef),
        tx.get(invRef)
      ]);

      if (!itemSnap.exists()) throw new Error("Item missing.");
      const item = itemSnap.data();
      if (!item.active) throw new Error("Item not active.");

      if (invSnap.exists()) throw new Error("You already own this.");

      const price = Number(item.price ?? 0);
      const stu = stuSnap.exists() ? stuSnap.data() : {};
      const current = Number(stu.rubiesBalance ?? 0);

      if (current < price) throw new Error("Not enough rubies.");

      // 1) deduct rubies (spendable balance)
      tx.set(studentRef, { rubiesBalance: current - price }, { merge: true });

      // 2) create inventory doc
      tx.set(invRef, {
        itemId,
        pricePaid: price,
        purchasedAt: serverTimestamp()
      });

      // 3) ledger entry
      tx.set(purchaseRef, {
        studentId,
        studentUid: uid,
        itemId,
        pricePaid: price,
        purchasedAt: serverTimestamp()
      });
    });

    // refresh local view
    await loadBalance(studentId);
    await loadOwned(studentId);
    render();
    setMsg("Purchased! 🎉", true);

  } catch (err) {
    console.error(err);
    setMsg(err.message || "Purchase failed.");
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/readathon-world/index.html";
    return;
  }

  uid = user.uid;
  session = await loadSession(uid);
  if (!session?.studentId) {
    setMsg("No student session found. Please sign in again.");
    return;
  }

  await Promise.all([
    loadItems(),
    loadBalance(session.studentId),
    loadOwned(session.studentId)
  ]);

  render();

  cat.addEventListener("change", render);
  search.addEventListener("input", render);
});