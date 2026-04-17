import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  auth,
  db,
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  waitForAuthReady,
  fetchUserSummary,
  fnRedeemPrizeCredit,
} from "./firebase.js";

import { normalizeError } from "./app.js";

/* --------------------------------------------------
   State & Elements
-------------------------------------------------- */

const els = {
  title: document.querySelector("[data-title]"),
  subtitle: document.querySelector("[data-subtitle]"),
  
  currentDonationsDisplay: document.getElementById("currentDonationsDisplay"),
  availableToSpendDisplay: document.getElementById("availableToSpendDisplay"),
  remainingAfterCartDisplay: document.getElementById("remainingAfterCartDisplay"),
  categoryFilter: document.getElementById("categoryFilter"),
  searchInput: document.getElementById("searchInput"),
  storeStatus: document.getElementById("storeStatus"),
  prizeShelfGrid: document.getElementById("prizeShelfGrid"),
  prizeCardTemplate: document.getElementById("prizeCardTemplate"),

  cartList: document.getElementById("cartList"),
  cartEmptyState: document.getElementById("cartEmptyState"),
  cartTotalDisplay: document.getElementById("cartTotalDisplay"),
  cartAvailableDisplay: document.getElementById("cartAvailableDisplay"),
  cartRemainingDisplay: document.getElementById("cartRemainingDisplay"),
  clearCartBtn: document.getElementById("clearCartBtn"),
  submitCartBtn: document.getElementById("submitCartBtn"),
};

let state = {
  schoolId: null,
  user: null,
  summary: null,
  allPrizes: [],
  cart: [],
  isSubmittingCart: false,
};

/* --------------------------------------------------
   Initialization
-------------------------------------------------- */

async function init() {
  try {
    state.schoolId = getSchoolId() || DEFAULT_SCHOOL_ID;
    await waitForAuthReady();
    state.user = auth.currentUser;

    if (!state.user) {
      window.location.href = "../html/student-login.html";
      return;
    }

    await loadStudentStoreSummary();
    await loadPrizeCatalog();

    setupListeners();
    renderCart();
  } catch (error) {
    console.error("Init failed:", error);
    setStatus("Initialization error. Please refresh.");
  }
}

async function loadStudentStoreSummary() {
  try {
    const summary = await fetchUserSummary(state.schoolId, state.user.uid);
    state.summary = summary;

    // Use normalized values for display
    const donations = normalizePriceToCents(summary?.donationsCents);
    const available = normalizePriceToCents(summary?.prizeCreditCents);

    els.currentDonationsDisplay.textContent = formatMoney(donations);
    els.availableToSpendDisplay.textContent = formatMoney(available);
  } catch (error) {
    console.error("Failed to load user summary:", error);
  }
}

async function loadPrizeCatalog() {
  try {
    const prizeCatalogRef = collection(db, `readathonV2_schools/${state.schoolId}/prizeCatalog`);
    
    const qRef = query(
      prizeCatalogRef,
      where("active", "==", true),
      orderBy("price", "asc")
    );

    const snap = await getDocs(qRef);
    
    // Normalize prices immediately upon loading from Firestore
    state.allPrizes = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        price: normalizePriceToCents(data.price),
        donationsNeeded: normalizePriceToCents(data.donationsNeeded)
      };
    });
    
    applyFilters();
  } catch (error) {
    console.error("Failed to load catalog:", error);
    renderEmpty("Unable to load prize store. Please try again later.");
  }
}

/* --------------------------------------------------
   Filtering & UI Logic
-------------------------------------------------- */

function applyFilters() {
  const cat = els.categoryFilter?.value || "all";
  const search = els.searchInput?.value?.toLowerCase() || "";

  const filtered = state.allPrizes.filter(p => {
    const matchesCat = cat === "all" || p.category === cat;
    const matchesSearch = !search || 
      p.name?.toLowerCase().includes(search) || 
      p.description?.toLowerCase().includes(search);
    return matchesCat && matchesSearch;
  });

  renderPrizes(filtered);
}

function renderPrizes(list) {
  if (!els.prizeShelfGrid) return;
  els.prizeShelfGrid.innerHTML = "";

  if (list.length === 0) {
    renderEmpty("No prizes match your search.");
    return;
  }

  list.forEach(prize => {
    const clone = els.prizeCardTemplate.content.cloneNode(true);
    
    const img = clone.querySelector(".prize-image");
    img.src = prize.image || "../img/placeholders/prize-placeholder.png";
    
    clone.querySelector(".prize-name").textContent = prize.name;
    clone.querySelector(".prize-description").textContent = prize.description || "";
    clone.querySelector(".prize-category").textContent = prize.category || "General";
    
    // Values are now pre-normalized to cents
    clone.querySelector(".prize-price").textContent = formatMoney(prize.price);
    clone.querySelector(".prize-donations").textContent = formatMoney(prize.donationsNeeded);

    const qtyVal = clone.querySelector(".qty-value");
    const plus = clone.querySelector(".qty-plus");
    const minus = clone.querySelector(".qty-minus");
    const addBtn = clone.querySelector(".prize-request-btn");

    plus.onclick = () => { qtyVal.textContent = parseInt(qtyVal.textContent) + 1; };
    minus.onclick = () => {
      const cur = parseInt(qtyVal.textContent);
      if (cur > 1) qtyVal.textContent = cur - 1;
    };

    addBtn.onclick = () => {
      addToCart(prize, parseInt(qtyVal.textContent));
      qtyVal.textContent = 1;
    };

    els.prizeShelfGrid.appendChild(clone);
  });
}

/* --------------------------------------------------
   Cart Logic
-------------------------------------------------- */

function addToCart(prize, qty) {
  const existing = state.cart.find(item => item.id === prize.id);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({ ...prize, qty });
  }
  renderCart();
  setStatus(`Added ${qty} x ${prize.name} to cart.`);
}

function renderCart() {
  if (!els.cartList) return;
  els.cartList.innerHTML = "";

  let totalCents = 0;

  if (state.cart.length === 0) {
    els.cartEmptyState.classList.remove("hidden");
    els.submitCartBtn.disabled = true;
  } else {
    els.cartEmptyState.classList.add("hidden");
    els.submitCartBtn.disabled = state.isSubmittingCart;

    state.cart.forEach((item, index) => {
      const itemTotal = item.price * item.qty;
      totalCents += itemTotal;

      const li = document.createElement("li");
      li.className = "cart-item";
      li.innerHTML = `
        <div class="cart-item-info">
          <span class="cart-item-name">${item.name} (x${item.qty})</span>
          <span class="cart-item-price">${formatMoney(itemTotal)}</span>
        </div>
        <button class="cart-remove-btn" data-index="${index}">×</button>
      `;
      els.cartList.appendChild(li);
    });
  }

  const available = normalizePriceToCents(state.summary?.prizeCreditCents);
  const remaining = available - totalCents;

  els.cartTotalDisplay.textContent = formatMoney(totalCents);
  els.cartAvailableDisplay.textContent = formatMoney(available);
  els.cartRemainingDisplay.textContent = formatMoney(remaining);
  els.remainingAfterCartDisplay.textContent = formatMoney(remaining);

  if (remaining < 0) {
    els.cartRemainingDisplay.classList.add("negative");
    els.submitCartBtn.disabled = true;
  } else {
    els.cartRemainingDisplay.classList.remove("negative");
  }

  els.cartList.querySelectorAll(".cart-remove-btn").forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.cart.splice(idx, 1);
      renderCart();
    };
  });
}

async function handleSubmitCart() {
  if (state.isSubmittingCart || state.cart.length === 0) return;

  try {
    state.isSubmittingCart = true;
    renderCart();
    setStatus("Submitting your request...");

    for (const item of state.cart) {
      for (let i = 0; i < item.qty; i++) {
        await fnRedeemPrizeCredit({
          schoolId: state.schoolId,
          prizeId: item.id
        });
      }
    }

    state.cart = [];
    await loadStudentStoreSummary();
    applyFilters();
    renderCart();
    setStatus("Your prize request was submitted.");
  } catch (error) {
    console.error("Cart submit failed:", error);
    setStatus(normalizeError(error) || "Could not submit your prize request.");
  } finally {
    state.isSubmittingCart = false;
    renderCart();
  }
}

/* --------------------------------------------------
   Helpers
-------------------------------------------------- */

function setupListeners() {
  els.categoryFilter?.addEventListener("change", applyFilters);
  els.searchInput?.addEventListener("input", applyFilters);
  els.clearCartBtn?.addEventListener("click", () => {
    state.cart = [];
    renderCart();
    setStatus("Cart cleared.");
  });
  els.submitCartBtn?.addEventListener("click", handleSubmitCart);
}

function renderEmpty(message) {
  if (!els.prizeShelfGrid) return;
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message || "Nothing to show right now.";
  els.prizeShelfGrid.innerHTML = "";
  els.prizeShelfGrid.appendChild(empty);
}

function setStatus(message) {
  if (els.storeStatus) {
    els.storeStatus.textContent = message || "";
  }
}

/**
 * Ensures values are in cents. 
 * If value is >= 1000, assumes it's already cents.
 * Otherwise, multiplies by 100 to convert dollars to cents.
 */
function normalizePriceToCents(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;

  if (n >= 1000) return Math.round(n);
  return Math.round(n * 100);
}

function formatMoney(cents) {
  const dollars = (cents || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

init();