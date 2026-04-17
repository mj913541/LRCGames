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
  // Required data attributes for project standards
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
  donationsRaisedCents: 0,
  availableToSpendCents: 0,
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

    // Load balances first
    await loadStudentStoreSummary();
    // Then load catalog
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

    // Fix: Check for multiple field name possibilities from Firebase
    const rawDonations = summary?.donationsCents || summary?.moneyRaisedCents || 0;
    
    // Normalize to cents and update state
    state.donationsRaisedCents = normalizePriceToCents(rawDonations);
    
    // Readathon World Rule: Students get 20% of donations as prize credit
    state.availableToSpendCents = Math.floor(state.donationsRaisedCents * 0.2);

    updateSummaryDisplays();
  } catch (error) {
    console.error("Failed to load user summary:", error);
  }
}

function updateSummaryDisplays() {
  if (els.currentDonationsDisplay) {
    els.currentDonationsDisplay.textContent = formatMoney(state.donationsRaisedCents);
  }

  if (els.availableToSpendDisplay) {
    els.availableToSpendDisplay.textContent = formatMoney(state.availableToSpendCents);
  }

  const totalInCart = getCartTotalCents();
  const remaining = state.availableToSpendCents - totalInCart;

  if (els.remainingAfterCartDisplay) {
    els.remainingAfterCartDisplay.textContent = formatMoney(remaining);
  }

  if (els.cartAvailableDisplay) {
    els.cartAvailableDisplay.textContent = formatMoney(state.availableToSpendCents);
  }

  if (els.cartTotalDisplay) {
    els.cartTotalDisplay.textContent = formatMoney(totalInCart);
  }

  if (els.cartRemainingDisplay) {
    els.cartRemainingDisplay.textContent = formatMoney(remaining);
  }
}

async function loadPrizeCatalog() {
  try {
    const prizeCatalogRef = collection(db, `readathonV2_schools/${state.schoolId}/prizeCatalog`);
    
    // Using a simplified query to ensure stability
    const qRef = query(
      prizeCatalogRef,
      where("active", "==", true),
      orderBy("price", "asc")
    );

    const snap = await getDocs(qRef);
    
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
    renderEmpty("Unable to load prize store.");
  }
}

/* --------------------------------------------------
   UI & Cart Logic
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

  list.forEach(prize => {
    const clone = els.prizeCardTemplate.content.cloneNode(true);
    
    clone.querySelector(".prize-image").src = prize.image || "../img/placeholders/prize-placeholder.png";
    clone.querySelector(".prize-name").textContent = prize.name;
    clone.querySelector(".prize-price").textContent = formatMoney(prize.price);
    clone.querySelector(".prize-donations").textContent = formatMoney(prize.donationsNeeded);

    const qtyVal = clone.querySelector(".qty-value");
    clone.querySelector(".qty-plus").onclick = () => { qtyVal.textContent = parseInt(qtyVal.textContent) + 1; };
    clone.querySelector(".qty-minus").onclick = () => {
      const cur = parseInt(qtyVal.textContent);
      if (cur > 1) qtyVal.textContent = cur - 1;
    };

    clone.querySelector(".prize-request-btn").onclick = () => {
      addToCart(prize, parseInt(qtyVal.textContent));
      qtyVal.textContent = 1;
    };

    els.prizeShelfGrid.appendChild(clone);
  });
}

function addToCart(prize, qty) {
  const existing = state.cart.find(item => item.id === prize.id);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({ ...prize, qty });
  }
  renderCart();
}

function renderCart() {
  if (!els.cartList) return;
  els.cartList.innerHTML = "";

  state.cart.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "cart-item";
    li.innerHTML = `
      <span>${item.name} (x${item.qty})</span>
      <span>${formatMoney(item.price * item.qty)}</span>
    `;
    els.cartList.appendChild(li);
  });

  updateSummaryDisplays();
}

function getCartTotalCents() {
  return state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

/* --------------------------------------------------
   Helpers
-------------------------------------------------- */

function setupListeners() {
  els.categoryFilter?.addEventListener("change", applyFilters);
  els.searchInput?.addEventListener("input", applyFilters);
  els.submitCartBtn?.addEventListener("click", handleSubmitCart);
}

async function handleSubmitCart() {
  if (state.isSubmittingCart || state.cart.length === 0) return;
  state.isSubmittingCart = true;
  setStatus("Submitting...");
  
  try {
    for (const item of state.cart) {
      for (let i = 0; i < item.qty; i++) {
        await fnRedeemPrizeCredit({ schoolId: state.schoolId, prizeId: item.id });
      }
    }
    state.cart = [];
    await loadStudentStoreSummary();
    renderCart();
    setStatus("Submitted!");
  } catch (e) {
    setStatus(normalizeError(e));
  } finally {
    state.isSubmittingCart = false;
  }
}

function normalizePriceToCents(value) {
  const n = Number(value || 0);
  // If it's already a high number (like 100 for $1.00), treat as cents
  if (n >= 100) return Math.round(n);
  // Otherwise multiply by 100 to convert dollars to cents
  return Math.round(n * 100);
}

function formatMoney(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function setStatus(msg) {
  if (els.storeStatus) els.storeStatus.textContent = msg;
}

init();