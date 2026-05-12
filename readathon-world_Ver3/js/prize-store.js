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
    
    // Ensure auth is solid to prevent 401s
    await waitForAuthReady();
    state.user = auth.currentUser;

    if (!state.user) {
      window.location.href = "../html/student-login.html";
      return;
    }

    // Parallel load for efficiency
    await Promise.all([
      loadStudentStoreSummary(),
      loadPrizeCatalog()
    ]);

    setupListeners();
    renderCart();
  } catch (error) {
    console.error("Init failed:", error);
    setStatus("Connection error. Please refresh the page.");
  }
}

async function loadStudentStoreSummary() {
  try {
    const summary = await fetchUserSummary(state.schoolId, state.user.uid);
    if (!summary) return;
    
    state.summary = summary;

    // Field variations support
    const rawDonations = summary.donationsCents || 
                         summary.moneyRaisedCents || 
                         summary.totalDonationsCents || 0;
    
    state.donationsRaisedCents = normalizePriceToCents(rawDonations);
    
    // 20% calculation logic
    state.availableToSpendCents = Math.floor(state.donationsRaisedCents * 0.2);

    updateSummaryUI();
  } catch (error) {
    console.error("Summary load failed:", error);
  }
}

function updateSummaryUI() {
  if (els.currentDonationsDisplay) {
    els.currentDonationsDisplay.textContent = formatMoney(state.donationsRaisedCents);
  }
  if (els.availableToSpendDisplay) {
    els.availableToSpendDisplay.textContent = formatMoney(state.availableToSpendCents);
  }
  renderCart();
}

async function loadPrizeCatalog() {
  try {
    const prizeCatalogRef = collection(db, `readathonV2_schools/${state.schoolId}/prizeCatalog`);
    const qRef = query(prizeCatalogRef, where("active", "==", true), orderBy("price", "asc"));

    const snap = await getDocs(qRef);
    state.allPrizes = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        price: normalizePriceToCents(d.price),
        donationsNeeded: normalizePriceToCents(d.donationsNeeded)
      };
    });
    
    applyFilters();
  } catch (error) {
    console.error("Catalog load failed:", error);
    renderEmpty("Store is currently unavailable.");
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
    const matchesSearch = !search || p.name?.toLowerCase().includes(search);
    return matchesCat && matchesSearch;
  });

  renderPrizes(filtered);
}

function renderPrizes(list) {
  if (!els.prizeShelfGrid) return;
  els.prizeShelfGrid.innerHTML = "";

  list.forEach(prize => {
    const clone = els.prizeCardTemplate.content.cloneNode(true);
    
    // Fill basic details
    clone.querySelector(".prize-name").textContent = prize.name;
    clone.querySelector(".prize-price").textContent = formatMoney(prize.price);
    clone.querySelector(".prize-donations").textContent = formatMoney(prize.donationsNeeded);
    
    // Handle the image
    const img = clone.querySelector(".prize-image");
    if (img) {
      img.src = prize.image || "../assets/placeholder-prize.png";
      img.alt = prize.name;
    }

    // Set up the "Add to Cart" button logic
    const addBtn = clone.querySelector(".prize-request-btn");
    addBtn.addEventListener("click", () => {
      // You may need to define an addToCart function or logic here
      console.log("Added to cart:", prize.name);
    });

    els.prizeShelfGrid.appendChild(clone);
  });

  // Clear the loading status once done
  if (list.length > 0) {
    setStatus(""); 
  } else {
    setStatus("No prizes found matching your search.");
  }
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

  let total = 0;
  state.cart.forEach((item, index) => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;

    const li = document.createElement("li");
    li.className = "cart-item";
    li.innerHTML = `
      <span>${item.name} (x${item.qty})</span>
      <strong>${formatMoney(itemTotal)}</strong>
    `;
    els.cartList.appendChild(li);
  });

  const remaining = state.availableToSpendCents - total;

  if (els.cartTotalDisplay) els.cartTotalDisplay.textContent = formatMoney(total);
  if (els.cartAvailableDisplay) els.cartAvailableDisplay.textContent = formatMoney(state.availableToSpendCents);
  if (els.cartRemainingDisplay) els.cartRemainingDisplay.textContent = formatMoney(remaining);
  if (els.remainingAfterCartDisplay) els.remainingAfterCartDisplay.textContent = formatMoney(remaining);

  if (els.submitCartBtn) {
    els.submitCartBtn.disabled = (remaining < 0 || state.cart.length === 0 || state.isSubmittingCart);
  }
}

async function handleSubmitCart() {
  if (state.isSubmittingCart || state.cart.length === 0) return;

  try {
    state.isSubmittingCart = true;
    setStatus("Submitting your prizes...");
    renderCart();

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
    setStatus("Prize request successful!");
  } catch (error) {
    console.error("Submission failed:", error);
    setStatus(normalizeError(error));
  } finally {
    state.isSubmittingCart = false;
    renderCart();
  }
}

/* --------------------------------------------------
   Helpers
-------------------------------------------------- */

function normalizePriceToCents(value) {
  const n = Number(value || 0);
  if (n >= 100) return Math.round(n);
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

function setupListeners() {
  els.categoryFilter?.addEventListener("change", applyFilters);
  els.searchInput?.addEventListener("input", applyFilters);
  els.submitCartBtn?.addEventListener("click", handleSubmitCart);
  els.clearCartBtn?.addEventListener("click", () => {
    state.cart = [];
    renderCart();
    setStatus("Cart cleared.");
  });
}

function renderEmpty(msg) {
  if (els.prizeShelfGrid) {
    els.prizeShelfGrid.innerHTML = `<div class="empty-state">${msg}</div>`;
  }
}

init();