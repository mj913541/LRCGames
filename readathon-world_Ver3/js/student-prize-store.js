import { auth, db, fnRedeemPrizeCredit } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ======================================================
   CONFIG
====================================================== */

const CREDIT_RATE = 0.20;

const CONFIG = {
  usersCollection: "users",
  prizeCatalogCollection: "prizeCatalog",
  prizeRedemptionsCollection: "prizeRedemptions",

  // Student donation total can live under one of these fields.
  donationFieldCandidates: [
    "donationsTotal",
    "fundraisingTotal",
    "amountRaised",
    "raisedTotal",
    "donationTotal"
  ],

  prizePriceField: "price",
  prizeStockField: "stock",
  prizeActiveField: "active",
  prizeCategoryField: "category",
  prizeNameField: "name",
  prizeImageField: "image",
  prizeDescriptionField: "description",

  prizeCreditSpentField: "prizeCreditSpent"
};

/* ======================================================
   PAGE ELEMENTS
====================================================== */

const pageTitleEl = document.getElementById("pageTitle");
const pageSubtitleEl = document.getElementById("pageSubtitle");

const donationsRaisedValueEl = document.getElementById("donationsRaisedValue");
const creditEarnedValueEl = document.getElementById("creditEarnedValue");
const creditSpentValueEl = document.getElementById("creditSpentValue");
const creditRemainingValueEl = document.getElementById("creditRemainingValue");

const categoryFilterEl = document.getElementById("categoryFilter");
const prizeSearchInputEl = document.getElementById("prizeSearchInput");
const prizeGridEl = document.getElementById("prizeGrid");

const redeemModalEl = document.getElementById("redeemModal");
const redeemModalMessageEl = document.getElementById("redeemModalMessage");
const cancelRedeemBtnEl = document.getElementById("cancelRedeemBtn");
const confirmRedeemBtnEl = document.getElementById("confirmRedeemBtn");

const pageToastEl = document.getElementById("pageToast");

/* ======================================================
   STATE
====================================================== */

const state = {
  schoolId: null,
  user: null,
  userDoc: null,
  prizes: [],
  filteredPrizes: [],
  selectedPrize: null,
  loading: false
};

/* ======================================================
   HELPERS
====================================================== */

function formatMoney(value) {
  const safeValue = Number(value || 0);
  return safeValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function showToast(message) {
  if (!pageToastEl) return;

  pageToastEl.textContent = message;
  pageToastEl.classList.remove("is-hidden");

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    pageToastEl.classList.add("is-hidden");
  }, 2600);
}

function setLoading(isLoading) {
  state.loading = isLoading;

  if (confirmRedeemBtnEl) {
    confirmRedeemBtnEl.disabled = isLoading;
    confirmRedeemBtnEl.textContent = isLoading ? "Redeeming..." : "Redeem Prize";
  }
}

function setPageIdentity() {
  const body = document.body;
  const titleFromBody = body?.dataset?.pageTitle || "Prize Store";
  const subtitleFromBody =
    body?.dataset?.pageSubtitle || "Use 20% of your donations as prize credit.";

  if (pageTitleEl) pageTitleEl.textContent = titleFromBody;
  if (pageSubtitleEl) pageSubtitleEl.textContent = subtitleFromBody;
  document.title = `${titleFromBody} | Readathon World V2`;
}

function getSchoolId() {
  const urlSchoolId = new URLSearchParams(window.location.search).get("schoolId");
  if (urlSchoolId) return urlSchoolId;

  const localCandidates = [
    localStorage.getItem("readathonV2_schoolId"),
    localStorage.getItem("schoolId"),
    sessionStorage.getItem("readathonV2_schoolId"),
    sessionStorage.getItem("schoolId")
  ].filter(Boolean);

  if (localCandidates.length) return localCandidates[0];

  return null;
}

function getSchoolRoot(schoolId) {
  return `readathonV2_schools/${schoolId}`;
}

function getDonationTotalFromUser(userData = {}) {
  for (const fieldName of CONFIG.donationFieldCandidates) {
    const value = Number(userData[fieldName]);
    if (!Number.isNaN(value) && value >= 0) return value;
  }
  return 0;
}

function getPrizeCreditSpentFromUser(userData = {}) {
  const value = Number(userData[CONFIG.prizeCreditSpentField]);
  if (!Number.isNaN(value) && value >= 0) return value;
  return 0;
}

function getCreditEarned(donationsRaised) {
  return Number((Number(donationsRaised || 0) * CREDIT_RATE).toFixed(2));
}

function getCreditRemaining(donationsRaised, creditSpent) {
  return Number(Math.max(0, getCreditEarned(donationsRaised) - Number(creditSpent || 0)).toFixed(2));
}

function getMinimumDonationsNeeded(prizePrice) {
  return Number((Number(prizePrice || 0) / CREDIT_RATE).toFixed(2));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ======================================================
   FIRESTORE PATHS
====================================================== */

function getUserDocRef(schoolId, uid) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    "users",
    uid
  );
}

function getPrizeCatalogCollectionRef(schoolId) {
  return collection(
    db,
    "readathonV2_schools",
    schoolId,
    "prizeCatalog"
  );
}

function getPrizeDocRef(schoolId, prizeId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    "prizeCatalog",
    prizeId
  );
}

function getPrizeRedemptionsCollectionRef(schoolId) {
  return collection(
    db,
    "readathonV2_schools",
    schoolId,
    "prizeRedemptions"
  );
}

/* ======================================================
   RENDER
====================================================== */

function renderWalletSummary() {
  const userData = state.userDoc || {};
  const donationsRaised = getDonationTotalFromUser(userData);
  const creditSpent = getPrizeCreditSpentFromUser(userData);
  const creditEarned = getCreditEarned(donationsRaised);
  const creditRemaining = getCreditRemaining(donationsRaised, creditSpent);

  if (donationsRaisedValueEl) donationsRaisedValueEl.textContent = formatMoney(donationsRaised);
  if (creditEarnedValueEl) creditEarnedValueEl.textContent = formatMoney(creditEarned);
  if (creditSpentValueEl) creditSpentValueEl.textContent = formatMoney(creditSpent);
  if (creditRemainingValueEl) creditRemainingValueEl.textContent = formatMoney(creditRemaining);
}

function renderEmptyState(message) {
  if (!prizeGridEl) return;

  prizeGridEl.innerHTML = `
    <div class="rw-empty-state">
      ${escapeHtml(message)}
    </div>
  `;
}

function getFilteredPrizes() {
  const selectedCategory = normalizeText(categoryFilterEl?.value || "all");
  const searchValue = normalizeText(prizeSearchInputEl?.value || "");

  return state.prizes.filter((prize) => {
    const category = normalizeText(prize.category);
    const name = normalizeText(prize.name);
    const description = normalizeText(prize.description);

    const matchesCategory =
      selectedCategory === "all" || category === selectedCategory;

    const matchesSearch =
      !searchValue ||
      name.includes(searchValue) ||
      description.includes(searchValue) ||
      category.includes(searchValue);

    return matchesCategory && matchesSearch;
  });
}

function renderPrizeGrid() {
  if (!prizeGridEl) return;

  const userData = state.userDoc || {};
  const donationsRaised = getDonationTotalFromUser(userData);
  const creditSpent = getPrizeCreditSpentFromUser(userData);
  const creditRemaining = getCreditRemaining(donationsRaised, creditSpent);

  state.filteredPrizes = getFilteredPrizes();

  if (!state.filteredPrizes.length) {
    renderEmptyState("No prizes match your search right now.");
    return;
  }

  prizeGridEl.innerHTML = state.filteredPrizes
    .map((prize) => {
      const prizePrice = Number(prize.price || 0);
      const minDonationsNeeded = getMinimumDonationsNeeded(prizePrice);
      const donationsStillNeeded = Number(
        Math.max(0, minDonationsNeeded - donationsRaised).toFixed(2)
      );

      const canAfford = creditRemaining >= prizePrice;
      const inStock = Number(prize.stock || 0) > 0;

      const statusClass = canAfford ? "" : "is-locked";
      const statusText = canAfford
        ? "You can afford this prize right now."
        : `Raise ${formatMoney(donationsStillNeeded)} more in donations to earn enough credit.`;

      const buttonText = !inStock
        ? "Out of Stock"
        : canAfford
          ? `Redeem for ${formatMoney(prizePrice)} credit`
          : `Raise ${formatMoney(donationsStillNeeded)} More`;

      const disabledAttr = !canAfford || !inStock ? "disabled" : "";

      return `
        <article class="rw-prize-card">
          <div class="rw-prize-card__image-wrap">
            <img
              class="rw-prize-card__image"
              src="${escapeHtml(prize.image || "/readathon-world_Ver2/img/prizes/prize-placeholder.png")}"
              alt="${escapeHtml(prize.name || "Prize")}"
            />
          </div>

          <div class="rw-prize-card__body">
            <span class="rw-prize-card__category">${escapeHtml(prize.category || "Prize")}</span>

            <h3 class="rw-prize-card__title">${escapeHtml(prize.name || "Unnamed Prize")}</h3>

            <p class="rw-prize-card__description">${escapeHtml(prize.description || "")}</p>

            <div class="rw-prize-card__details">
              <div class="rw-prize-card__detail-row">
                <span>Prize Price:</span>
                <strong>${formatMoney(prizePrice)} credit</strong>
              </div>

              <div class="rw-prize-card__detail-row">
                <span>Minimum Donations Needed:</span>
                <strong>${formatMoney(minDonationsNeeded)}</strong>
              </div>

              <div class="rw-prize-card__detail-row">
                <span>Your Remaining Credit:</span>
                <strong>${formatMoney(creditRemaining)}</strong>
              </div>

              <div class="rw-prize-card__detail-row">
                <span>Stock:</span>
                <strong>${inStock ? escapeHtml(String(prize.stock)) : "Out of stock"}</strong>
              </div>
            </div>

            <div class="rw-prize-card__status ${statusClass}">
              ${escapeHtml(statusText)}
            </div>

            <button
              type="button"
              class="rw-btn rw-btn-primary rw-btn-block rw-redeem-btn"
              data-prize-id="${escapeHtml(prize.id)}"
              ${disabledAttr}
            >
              ${escapeHtml(buttonText)}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  prizeGridEl.querySelectorAll(".rw-redeem-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const prizeId = button.dataset.prizeId;
      const prize = state.prizes.find((item) => item.id === prizeId);
      if (!prize) return;
      openRedeemModal(prize);
    });
  });
}

/* ======================================================
   MODAL
====================================================== */

function openRedeemModal(prize) {
  state.selectedPrize = prize;

  const donationsRaised = getDonationTotalFromUser(state.userDoc || {});
  const creditSpent = getPrizeCreditSpentFromUser(state.userDoc || {});
  const creditRemaining = getCreditRemaining(donationsRaised, creditSpent);
  const minimumDonationsNeeded = getMinimumDonationsNeeded(prize.price);

  if (redeemModalMessageEl) {
    redeemModalMessageEl.innerHTML = `
      <strong>${escapeHtml(prize.name)}</strong><br><br>
      Prize Price: <strong>${escapeHtml(formatMoney(prize.price))}</strong> credit<br>
      Minimum Donations Needed: <strong>${escapeHtml(formatMoney(minimumDonationsNeeded))}</strong><br>
      Your Remaining Credit: <strong>${escapeHtml(formatMoney(creditRemaining))}</strong>
    `;
  }

  redeemModalEl?.classList.remove("is-hidden");
  redeemModalEl?.setAttribute("aria-hidden", "false");
}

function closeRedeemModal() {
  state.selectedPrize = null;
  redeemModalEl?.classList.add("is-hidden");
  redeemModalEl?.setAttribute("aria-hidden", "true");
}

/* ======================================================
   DATA LOAD
====================================================== */

async function loadCurrentUserDoc() {
  const uid = state.user?.uid;
  const schoolId = state.schoolId;

  if (!uid || !schoolId) {
    throw new Error("Missing user or school ID.");
  }

  const userRef = getUserDocRef(schoolId, uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("Student user record not found.");
  }

  state.userDoc = {
    id: userSnap.id,
    ...userSnap.data()
  };
}

async function loadPrizeCatalog() {
  const schoolId = state.schoolId;
  if (!schoolId) throw new Error("Missing school ID.");

  const catalogRef = getPrizeCatalogCollectionRef(schoolId);
  const prizeQuery = query(catalogRef, orderBy(CONFIG.prizeNameField));

  const snapshot = await getDocs(prizeQuery);

  state.prizes = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        name: data[CONFIG.prizeNameField] || "",
        category: data[CONFIG.prizeCategoryField] || "other",
        price: Number(data[CONFIG.prizePriceField] || 0),
        stock: Number(data[CONFIG.prizeStockField] || 0),
        active: Boolean(data[CONFIG.prizeActiveField] !== false),
        image: data[CONFIG.prizeImageField] || "",
        description: data[CONFIG.prizeDescriptionField] || ""
      };
    })
    .filter((prize) => prize.active);
}

async function refreshPageData() {
  await loadCurrentUserDoc();
  await loadPrizeCatalog();
  renderWalletSummary();
  renderPrizeGrid();
}

/* ======================================================
   REDEMPTION
====================================================== */

async function redeemSelectedPrize() {

  const prize = state.selectedPrize;

  if (!prize) {
    showToast("No prize selected.");
    return;
  }

  try {

    setLoading(true);

    const result = await fnRedeemPrizeCredit({
      prizeId: prize.id
    });

    closeRedeemModal();

    await refreshPageData();

    showToast("Prize redeemed successfully!");

  } catch (error) {

    console.error("Redeem failed:", error);

    const message =
      error?.message ||
      error?.details ||
      "Prize redemption failed.";

    showToast(message);

  } finally {

    setLoading(false);

  }
}

/* ======================================================
   EVENTS
====================================================== */

function bindEvents() {
  categoryFilterEl?.addEventListener("change", renderPrizeGrid);
  prizeSearchInputEl?.addEventListener("input", renderPrizeGrid);

  cancelRedeemBtnEl?.addEventListener("click", closeRedeemModal);
  confirmRedeemBtnEl?.addEventListener("click", redeemSelectedPrize);

  redeemModalEl?.addEventListener("click", (event) => {
    if (event.target === redeemModalEl) {
      closeRedeemModal();
    }
  });
}

/* ======================================================
   INIT
====================================================== */

async function initPageForUser(user) {
  state.user = user;
  state.schoolId = getSchoolId();

  if (!state.schoolId) {
    renderEmptyState("No school ID was found. Add ?schoolId=YOUR_SCHOOL_ID to the URL or store the school ID in local/session storage.");
    showToast("Missing school ID.");
    return;
  }

  try {
    await refreshPageData();
  } catch (error) {
    console.error("Student prize store init failed:", error);
    renderEmptyState(error?.message || "Unable to load the prize store.");
    showToast(error?.message || "Unable to load the prize store.");
  }
}

function init() {
  setPageIdentity();
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      renderEmptyState("You must be signed in to view the Prize Store.");
      showToast("Please sign in first.");
      return;
    }

    await initPageForUser(user);
  });
}

init();