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
    
    // Crucial: ensure Auth is fully ready before fetching summary
    // to avoid the 401 Unauthorized issues seen in logs
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
    setStatus("Error loading profile. Please refresh.");
  }
}

async function loadStudentStoreSummary() {
  try {
    const summary = await fetchUserSummary(state.schoolId, state.user.uid);
    if (!summary) {
      console.warn("No summary found for user:", state.user.uid);
      return;
    }
    state.summary = summary;

    // Support all known donation field variations in your database
    const rawDonations = summary.donationsCents || 
                         summary.moneyRaisedCents || 
                         summary.totalDonationsCents || 0;
    
    state.donationsRaisedCents = normalizePriceToCents(rawDonations);
    
    // Readathon World Rule: 20% credit
    state.availableToSpendCents = Math.floor(state.donationsRaisedCents * 0.2);

    updateSummaryUI();
  } catch (error) {
    console.error("Failed to load user summary:", error);
  }
}

function updateSummaryUI() {
  if (els.currentDonationsDisplay) {
    els.currentDonationsDisplay.textContent = formatMoney(state.donationsRaisedCents);
  }
  if (els.availableToSpendDisplay) {
    els.availableToSpendDisplay.textContent = formatMoney(state.availableToSpendCents);
  }
  
  renderCart(); // Refresh cart calculations
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
    renderEmpty("Store temporarily unavailable.");
  }
}

/* --------------------------------------------------
   Cart & Submission Logic
-------------------------------------------------- */

function renderCart() {
  if (!els.cartList) return;
  els.cartList.innerHTML = "";

  let cartTotal = 0;
  state.cart.forEach((item, index) => {
    const itemTotal = item.price * item.qty;
    cartTotal += itemTotal;

    const li = document.createElement("li");
    li.className = "cart-item";
    li.innerHTML = `
      <span>${item.name} (x${item.qty})</span>
      <strong>${formatMoney(itemTotal)}</strong>
    `;
    els.cartList.appendChild(li);
  });

  const remaining = state.availableToSpendCents - cartTotal;

  if (els.cartTotalDisplay) els.cartTotalDisplay.textContent = formatMoney(cartTotal);
  if (els.cartAvailableDisplay) els.cartAvailableDisplay.textContent = formatMoney(state.availableToSpendCents);
  if (els.cartRemainingDisplay) els.cartRemainingDisplay.textContent = formatMoney(remaining);
  if (els.remainingAfterCartDisplay) els.remainingAfterCartDisplay.textContent = formatMoney(remaining);

  // Disable submit if over budget
  if (els.submitCartBtn) {
    els.submitCartBtn.disabled = (remaining < 0 || state.cart.length === 0 || state.isSubmittingCart);
  }
}

async function handleSubmitCart() {
  if (state.isSubmittingCart || state.cart.length === 0) return;

  try {
    state.isSubmittingCart = true;
    setStatus("Processing request...");
    renderCart();

    // Loop through cart items and redeem
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
    setStatus("Prizes requested successfully!");
  } catch (error) {
    console.error("Submission error:", error);
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
  // Assume values 100 or higher are already cents ($1.00+)
  if (n >= 100) return Math.round(n);
  // Treat smaller values as dollars and convert
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
  });
}

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
    clone.querySelector(".prize-name").textContent = prize.name;
    clone.querySelector(".prize-price").textContent = formatMoney(prize.price);
    clone.querySelector(".prize-request-btn").onclick = () => {
      const qty = parseInt(clone.querySelector(".qty-value").textContent) || 1;
      state.cart.push({ ...prize, qty });
      renderCart();
    };
    els.prizeShelfGrid.appendChild(clone);
  });
}

function renderEmpty(msg) {
  els.prizeShelfGrid.innerHTML = `<div class="empty-state">${msg}</div>`;
}

init();