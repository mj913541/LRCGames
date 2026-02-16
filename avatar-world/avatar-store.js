import { auth, db } from "/readathon-world/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc
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
let equipped = {}; // { body, outfit, accessory, background, pet }

/* ===============================
   UI Helpers
================================ */

function setMsg(text, ok = false) {
  msg.textContent = text || "";
  msg.className = `notice ${ok ? "good" : "bad"}`;
}

function updateBalanceUI() {
  const amt = balanceChip.querySelector(".amt");
  if (amt) amt.textContent = rubiesBalance;
}

/* ===============================
   Data Loaders
================================ */

async function loadSession(u) {
  const snap = await getDoc(doc(db, "users", u));
  return snap.exists() ? snap.data() : null;
}

async function loadStudentData(studentId) {
  const snap = await getDoc(doc(db, "students", studentId));
  const data = snap.exists() ? snap.data() : {};
  rubiesBalance = Number(data.rubiesBalance ?? 0);
  equipped = data.equipped || {};
  updateBalanceUI();
}

async function loadOwned(studentId) {
  owned = new Set();
  const invSnap = await getDocs(
    collection(db, "students", studentId, "inventory")
  );
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

/* ===============================
   Render
================================ */

function render() {
  const category = cat.value;
  const q = (search.value || "").trim().toLowerCase();

  const filtered = items.filter(it => {
    if (category !== "all" && it.category !== category) return false;
    if (q && !String(it.name || "").toLowerCase().includes(q)) return false;
    return true;
  });

  grid.innerHTML = filtered.map(it => {

    const isOwned = owned.has(it.id);
    const isEquipped = equipped[it.category] === it.id;
    const price = Number(it.price ?? 0);
    const canAfford = rubiesBalance >= price;

    let buttonHTML = "";

    if (!isOwned) {
      buttonHTML = `
        <button class="btn buy"
          data-buy="${it.id}"
          ${!canAfford ? "disabled" : ""}>
          ${canAfford ? `Buy 💎 ${price}` : "Not enough 💎"}
        </button>
      `;
    } else if (!isEquipped) {
      buttonHTML = `
        <button class="btn equip"
          data-equip="${it.id}"
          data-cat="${it.category}">
          Equip
        </button>
      `;
    } else {
      buttonHTML = `
        <button class="btn unequip" disabled>
          Equipped ✅
        </button>
      `;
    }

    return `
      <div class="card ${isEquipped ? "equipped" : ""}">
        <div class="cardTop">
          <div class="leftMini">
            <div class="emoji">
              ${it.emoji || "🎁"}
            </div>
            <div class="titleBox">
              <h3 class="itemName">${it.name || it.id}</h3>
              <div class="meta">${it.category}</div>
            </div>
          </div>

          <div class="priceTag">
            <div class="rubyRow">💎 ${price}</div>
          </div>
        </div>

        <p class="desc">${it.description || ""}</p>

        <div class="btnRow">
          ${buttonHTML}
        </div>
      </div>
    `;
  }).join("");

  /* Buy buttons */
  grid.querySelectorAll("[data-buy]").forEach(btn => {
    btn.addEventListener("click", () =>
      buy(btn.getAttribute("data-buy"))
    );
  });

  /* Equip buttons */
  grid.querySelectorAll("[data-equip]").forEach(btn => {
    btn.addEventListener("click", () =>
      equip(
        btn.getAttribute("data-equip"),
        btn.getAttribute("data-cat")
      )
    );
  });
}

/* ===============================
   Purchase
================================ */

async function buy(itemId) {

  const studentId = session?.studentId;
  if (!uid || !studentId) return setMsg("Please sign in again.");

  const itemRef = doc(db, "storeItems", itemId);
  const studentRef = doc(db, "students", studentId);
  const invRef = doc(db, "students", studentId, "inventory", itemId);

  try {
    await runTransaction(db, async (tx) => {

      const itemSnap = await tx.get(itemRef);
      const stuSnap = await tx.get(studentRef);
      const invSnap = await tx.get(invRef);

      if (!itemSnap.exists()) throw new Error("Item missing.");
      if (invSnap.exists()) throw new Error("You already own this.");

      const item = itemSnap.data();
      const price = Number(item.price ?? 0);
      const stu = stuSnap.exists() ? stuSnap.data() : {};
      const current = Number(stu.rubiesBalance ?? 0);

      if (current < price) throw new Error("Not enough rubies.");

      tx.set(studentRef, {
        rubiesBalance: current - price
      }, { merge: true });

      tx.set(invRef, {
        itemId,
        pricePaid: price,
        purchasedAt: serverTimestamp()
      });
    });

    await loadStudentData(studentId);
    await loadOwned(studentId);
    render();

    setMsg("Purchased! 🎉", true);

  } catch (err) {
    console.error(err);
    setMsg(err.message || "Purchase failed.");
  }
}

/* ===============================
   Equip
================================ */

async function equip(itemId, category) {

  const studentId = session?.studentId;
  if (!studentId) return;

  const studentRef = doc(db, "students", studentId);

  try {
    await setDoc(studentRef, {
      equipped: {
        [category]: itemId
      }
    }, { merge: true });

    equipped[category] = itemId;

    render();
    setMsg("Equipped! 🌿", true);

  } catch (err) {
    console.error(err);
    setMsg("Could not equip item.");
  }
}

/* ===============================
   Init
================================ */

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
    loadStudentData(session.studentId),
    loadOwned(session.studentId)
  ]);

  render();

  cat.addEventListener("change", render);
  search.addEventListener("input", render);
});
