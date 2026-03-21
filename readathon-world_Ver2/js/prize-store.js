// /js/prize-store.js
// Prize Store - streamlined to match prize-store.html + prize-store.css
// Uses:
// - #dataTitle / #dataSubtitle
// - [data-title] / [data-subtitle]
// - #prizeGrid shelf renderer
// - current rw-* CSS classes
// Keeps backend redemption flow flexible by reusing existing global functions if present.

(function () {
  "use strict";

  const state = {
    schoolId: "",
    userId: "",
    userProfile: {},
    prizes: [],
    filteredPrizes: [],
    activeQuickFilter: "all",
    activeCategory: "all",
    activeSearch: "",
    redeemingPrize: null,
  };

  const SHELVES = [
    {
      key: "shelf1",
      label: "Quick Finds",
      subtitle: "Easy wins to get your treasure hunt started.",
      donationsLabel: "$5–$25 raised",
      min: 0,
      max: 4.99,
      tone: "entry",
    },
    {
      key: "shelf2",
      label: "Explorer Gear",
      subtitle: "Fun rewards for readers building momentum.",
      donationsLabel: "$25–$75 raised",
      min: 5,
      max: 14.99,
      tone: "growth",
    },
    {
      key: "shelf3",
      label: "Treasure Picks",
      subtitle: "Bigger rewards for strong fundraising progress.",
      donationsLabel: "$75–$250 raised",
      min: 15,
      max: 39.99,
      tone: "motivation",
    },
    {
      key: "shelf4",
      label: "Dream Prizes",
      subtitle: "Top-tier treasure for legendary fundraisers.",
      donationsLabel: "$200+ raised",
      min: 40,
      max: Infinity,
      tone: "legend",
    },
  ];

  const els = {
    body: document.body,

    dataTitle: document.getElementById("dataTitle"),
    dataSubtitle: document.getElementById("dataSubtitle"),

    donationsRaisedValue: document.getElementById("donationsRaisedValue"),
    creditEarnedValue: document.getElementById("creditEarnedValue"),
    creditSpentValue: document.getElementById("creditSpentValue"),
    creditRemainingValue: document.getElementById("creditRemainingValue"),

    shopSpotlightTitle: document.getElementById("shopSpotlightTitle"),
    shopSpotlightText: document.getElementById("shopSpotlightText"),
    canBuyNowCount: document.getElementById("canBuyNowCount"),
    almostThereCount: document.getElementById("almostThereCount"),
    categoryCount: document.getElementById("categoryCount"),

    categoryFilter: document.getElementById("categoryFilter"),
    searchInput: document.getElementById("prizeSearchInput"),
    quickFilterButtons: Array.from(document.querySelectorAll("[data-quick-filter]")),

    nextPrizeTitle: document.getElementById("nextPrizeTitle"),
    nextPrizeSubtitle: document.getElementById("nextPrizeSubtitle"),
    nextPrizeRaisedValue: document.getElementById("nextPrizeRaisedValue"),
    nextPrizeNeededValue: document.getElementById("nextPrizeNeededValue"),
    nextPrizeProgressFill: document.getElementById("nextPrizeProgressFill"),
    nextPrizeFooter: document.getElementById("nextPrizeFooter"),

    shelfJumpNav: document.getElementById("shelfJumpNav"),
    prizeGrid: document.getElementById("prizeGrid"),
    prizeGridEmptyState: document.getElementById("prizeGridEmptyState"),

    modal: document.getElementById("redeemModal"),
    modalMessage: document.getElementById("redeemModalMessage"),
    modalCancel: document.getElementById("cancelRedeemBtn"),
    modalConfirm: document.getElementById("confirmRedeemBtn"),

    toast: document.getElementById("pageToast"),
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindUI();
    setHeaderFromPageData();
    await loadData();
    renderAll();
  }

  function bindUI() {
    if (els.searchInput) {
      els.searchInput.addEventListener("input", (e) => {
        state.activeSearch = String(e.target.value || "").trim().toLowerCase();
        renderAll();
      });
    }

    if (els.categoryFilter) {
      els.categoryFilter.addEventListener("change", (e) => {
        state.activeCategory = e.target.value || "all";
        renderAll();
      });
    }

    els.quickFilterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        els.quickFilterButtons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.activeQuickFilter = btn.dataset.quickFilter || "all";
        renderAll();
      });
    });

    if (els.modalCancel) {
      els.modalCancel.addEventListener("click", closeRedeemModal);
    }

    if (els.modalConfirm) {
      els.modalConfirm.addEventListener("click", confirmRedeem);
    }

    if (els.modal) {
      els.modal.addEventListener("click", (e) => {
        if (e.target === els.modal) closeRedeemModal();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.modal?.classList.contains("is-hidden")) {
        closeRedeemModal();
      }
    });
  }

  function setHeaderFromPageData() {
    const title =
      els.body?.dataset?.pageTitle ||
      document.querySelector('meta[name="data-title"]')?.content ||
      "Prize Store";

    const subtitle =
      els.body?.dataset?.pageSubtitle ||
      document.querySelector('meta[name="data-subtitle"]')?.content ||
      "Use 20% of your donations as prize credit.";

    if (els.dataTitle) els.dataTitle.textContent = title;
    if (els.dataSubtitle) els.dataSubtitle.textContent = subtitle;

    document.querySelectorAll("[data-title]").forEach((node) => {
      node.textContent = title;
    });

    document.querySelectorAll("[data-subtitle]").forEach((node) => {
      node.textContent = subtitle;
    });
  }

  async function loadData() {
    state.schoolId =
      getValue(
        typeof window.getCurrentSchoolId === "function" ? window.getCurrentSchoolId() : "",
        typeof window.getSchoolId === "function" ? window.getSchoolId() : "",
        localStorage.getItem("readathonV2_schoolId"),
        localStorage.getItem("schoolId"),
      ) || "";

    state.userId =
      getValue(
        typeof window.getCurrentUserId === "function" ? window.getCurrentUserId() : "",
        typeof window.getUserId === "function" ? window.getUserId() : "",
        localStorage.getItem("readathonV2_userId"),
        localStorage.getItem("uid"),
        localStorage.getItem("userId"),
      ) || "";

    state.userProfile = await fetchStudentProfileSafe(state.schoolId, state.userId);
    state.prizes = await fetchPrizesSafe(state.schoolId);

    if (!Array.isArray(state.prizes)) state.prizes = [];

    state.prizes = state.prizes
      .filter((prize) => prize && prize.active !== false)
      .map(normalizePrize)
      .sort((a, b) => {
        if (a.price !== b.price) return a.price - b.price;
        if (a.sort !== b.sort) return a.sort - b.sort;
        return a.name.localeCompare(b.name);
      });

    buildCategoryFilter();
  }

  async function fetchStudentProfileSafe(schoolId, userId) {
    try {
      if (typeof window.fetchStudentProfile === "function") {
        return (await window.fetchStudentProfile(schoolId, userId)) || {};
      }

      if (typeof window.getStudentProfile === "function") {
        return (await window.getStudentProfile(schoolId, userId)) || {};
      }

      if (typeof window.loadSummary === "function") {
        return (await window.loadSummary({ schoolId, userId })) || {};
      }

      return {};
    } catch (error) {
      console.warn("Could not load prize store student profile:", error);
      return {};
    }
  }

  async function fetchPrizesSafe(schoolId) {
    try {
      if (typeof window.fetchAllPrizes === "function") {
        return (await window.fetchAllPrizes(schoolId)) || [];
      }

      if (typeof window.fetchPrizeCatalog === "function") {
        return (await window.fetchPrizeCatalog(schoolId)) || [];
      }

      if (typeof window.getPrizeStoreItems === "function") {
        return (await window.getPrizeStoreItems(schoolId)) || [];
      }

      return [];
    } catch (error) {
      console.warn("Could not load prize catalog:", error);
      return [];
    }
  }

  function normalizePrize(prize) {
    const price = Number(prize.price || 0);
    const donationsNeeded =
      prize.donationsNeeded != null
        ? Number(prize.donationsNeeded)
        : Number((price * 5).toFixed(2));

    const stock =
      prize.stock == null || prize.stock === ""
        ? Infinity
        : Number(prize.stock);

    return {
      ...prize,
      prizeId: prize.prizeId || prize.id || prize.key || prize.name || cryptoRandomId(),
      name: String(prize.name || "Prize"),
      description: String(prize.description || ""),
      category: String(prize.category || "other").toLowerCase(),
      image: String(prize.image || "../img/prizes/placeholder.png"),
      price,
      donationsNeeded,
      stock,
      sort: prize.sort == null ? 9999 : Number(prize.sort),
      shelfKey: getShelfForPrice(price),
    };
  }

  function buildCategoryFilter() {
    if (!els.categoryFilter) return;

    const categories = Array.from(
      new Set(
        state.prizes
          .map((prize) => prize.category)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    els.categoryFilter.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Categories";
    els.categoryFilter.appendChild(allOption);

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = prettifyCategory(category);
      els.categoryFilter.appendChild(option);
    });

    els.categoryFilter.value = state.activeCategory;
  }

  function renderAll() {
    state.filteredPrizes = getFilteredPrizes();

    renderWallet();
    renderAtAGlance();
    renderProgress();
    renderShelfJumpNav();
    renderShelves();
  }

  function renderWallet() {
    const raised = getRaisedAmount();
    const earned = getEarnedCreditAmount();
    const spent = getSpentCreditAmount();
    const remaining = getRemainingCreditAmount();

    if (els.donationsRaisedValue) els.donationsRaisedValue.textContent = money(raised);
    if (els.creditEarnedValue) els.creditEarnedValue.textContent = money(earned);
    if (els.creditSpentValue) els.creditSpentValue.textContent = money(spent);
    if (els.creditRemainingValue) els.creditRemainingValue.textContent = money(remaining);
  }

  function renderAtAGlance() {
    const remaining = getRemainingCreditAmount();

    const canBuyNow = state.prizes.filter((prize) => isAffordable(prize, remaining) && isInStock(prize)).length;
    const almostThere = state.prizes.filter((prize) => {
      if (!isInStock(prize)) return false;
      const gap = prize.price - remaining;
      return gap > 0 && gap <= 5;
    }).length;

    const categoryCount = new Set(state.prizes.map((prize) => prize.category).filter(Boolean)).size;

    if (els.canBuyNowCount) els.canBuyNowCount.textContent = String(canBuyNow);
    if (els.almostThereCount) els.almostThereCount.textContent = String(almostThere);
    if (els.categoryCount) els.categoryCount.textContent = String(categoryCount);

    if (els.shopSpotlightTitle) {
      if (canBuyNow > 0) {
        els.shopSpotlightTitle.textContent = "You can shop right now!";
      } else if (almostThere > 0) {
        els.shopSpotlightTitle.textContent = "You’re so close to your next prize!";
      } else {
        els.shopSpotlightTitle.textContent = "Let’s go treasure hunting!";
      }
    }

    if (els.shopSpotlightText) {
      if (canBuyNow > 0) {
        els.shopSpotlightText.textContent = `Amazing job — you already have enough credit for ${canBuyNow} prize${canBuyNow === 1 ? "" : "s"}.`;
      } else if (almostThere > 0) {
        els.shopSpotlightText.textContent = `Keep fundraising — you’re almost there for ${almostThere} prize${almostThere === 1 ? "" : "s"}.`;
      } else {
        els.shopSpotlightText.textContent = "Every donation helps unlock more jungle treasure.";
      }
    }
  }

  function renderProgress() {
    const raised = getRaisedAmount();
    const remaining = getRemainingCreditAmount();

    const nextPrize = state.prizes
      .filter((prize) => isInStock(prize) && prize.price > remaining)
      .sort((a, b) => a.price - b.price)[0];

    if (!nextPrize) {
      if (els.nextPrizeTitle) els.nextPrizeTitle.textContent = "You can unlock any current prize";
      if (els.nextPrizeSubtitle) els.nextPrizeSubtitle.textContent = "You’ve reached the top of the currently available catalog.";
      if (els.nextPrizeRaisedValue) els.nextPrizeRaisedValue.textContent = money(raised);
      if (els.nextPrizeNeededValue) els.nextPrizeNeededValue.textContent = money(raised);
      if (els.nextPrizeProgressFill) els.nextPrizeProgressFill.style.width = "100%";
      if (els.nextPrizeFooter) els.nextPrizeFooter.textContent = "Legendary shopping power unlocked!";
      return;
    }

    const neededRaised = nextPrize.donationsNeeded;
    const progress = neededRaised <= 0 ? 100 : clamp((raised / neededRaised) * 100, 0, 100);
    const additionalRaisedNeeded = Math.max(0, neededRaised - raised);
    const additionalCreditNeeded = Math.max(0, nextPrize.price - remaining);

    if (els.nextPrizeTitle) els.nextPrizeTitle.textContent = nextPrize.name;
    if (els.nextPrizeSubtitle) {
      els.nextPrizeSubtitle.textContent =
        `${prettifyCategory(nextPrize.category)} • Costs ${money(nextPrize.price)} in prize credit`;
    }
    if (els.nextPrizeRaisedValue) els.nextPrizeRaisedValue.textContent = money(raised);
    if (els.nextPrizeNeededValue) els.nextPrizeNeededValue.textContent = money(neededRaised);
    if (els.nextPrizeProgressFill) els.nextPrizeProgressFill.style.width = `${progress}%`;
    if (els.nextPrizeFooter) {
      els.nextPrizeFooter.textContent =
        `You need ${money(additionalRaisedNeeded)} more in donations (${money(additionalCreditNeeded)} more in credit) to unlock this prize.`;
    }
  }

  function renderShelfJumpNav() {
    if (!els.shelfJumpNav) return;

    const visibleShelves = SHELVES.filter((shelf) =>
      state.filteredPrizes.some((prize) => prize.shelfKey === shelf.key)
    );

    if (!visibleShelves.length) {
      els.shelfJumpNav.innerHTML = "";
      els.shelfJumpNav.classList.add("is-hidden");
      return;
    }

    els.shelfJumpNav.innerHTML = visibleShelves
      .map((shelf) => {
        return `
          <a class="rw-shelf-jump-link" href="#${shelf.key}">
            ${escapeHtml(shelf.label)}
          </a>
        `;
      })
      .join("");

    els.shelfJumpNav.classList.remove("is-hidden");
  }

  function renderShelves() {
    if (!els.prizeGrid) return;

    const visibleShelves = SHELVES.map((shelf) => ({
      ...shelf,
      prizes: state.filteredPrizes.filter((prize) => prize.shelfKey === shelf.key),
    })).filter((shelf) => shelf.prizes.length > 0);

    if (!visibleShelves.length) {
      els.prizeGrid.innerHTML = "";
      els.prizeGridEmptyState?.classList.remove("is-hidden");
      return;
    }

    els.prizeGridEmptyState?.classList.add("is-hidden");

    els.prizeGrid.innerHTML = visibleShelves
      .map((shelf) => renderShelfMarkup(shelf))
      .join("");

    visibleShelves.forEach((shelf) => {
      shelf.prizes.forEach((prize) => {
        const btn = document.querySelector(`[data-redeem-prize-id="${cssEscape(prize.prizeId)}"]`);
        if (!btn) return;

        btn.addEventListener("click", () => {
          openRedeemModal(prize);
        });
      });
    });
  }

  function renderShelfMarkup(shelf) {
    const cards = shelf.prizes.map((prize) => renderPrizeCardMarkup(prize)).join("");

    return `
      <section
        class="rw-shelf-row"
        id="${escapeHtml(shelf.key)}"
        data-shelf-section="${escapeHtml(shelf.key)}"
        data-shelf-tone="${escapeHtml(shelf.tone)}"
        aria-labelledby="${escapeHtml(shelf.key)}-title"
      >
        <div class="rw-section-heading">
          <h3 class="rw-section-title" id="${escapeHtml(shelf.key)}-title">${escapeHtml(shelf.label)}</h3>
          <p class="rw-section-subtitle">
            ${escapeHtml(shelf.subtitle)} ${escapeHtml(shelf.donationsLabel)}
          </p>
        </div>

        <div class="rw-prize-grid">
          ${cards}
        </div>
      </section>
    `;
  }

  function renderPrizeCardMarkup(prize) {
    const remaining = getRemainingCreditAmount();
    const affordable = isAffordable(prize, remaining);
    const inStock = isInStock(prize);
    const gap = Math.max(0, prize.price - remaining);

    let statusClass = "";
    let statusText = "";
    let buttonLabel = "";
    let buttonDisabled = "";

    if (!inStock) {
      statusClass = " is-oos";
      statusText = "Out of stock right now";
      buttonLabel = "Unavailable";
      buttonDisabled = "disabled";
    } else if (affordable) {
      statusText = "Ready to redeem 🎉";
      buttonLabel = "Redeem Prize";
    } else {
      statusClass = " is-locked";
      statusText = `Need ${money(gap)} more credit`;
      buttonLabel = "Keep Going";
      buttonDisabled = "disabled";
    }

    const stockText =
      prize.stock === Infinity ? "Unlimited" : `${Math.max(0, prize.stock)} left`;

    return `
      <article class="rw-prize-card" aria-label="${escapeHtml(prize.name)}">
        <div class="rw-prize-card__image-wrap">
          <img
            class="rw-prize-card__image"
            src="${escapeAttribute(prize.image)}"
            alt="${escapeAttribute(prize.name)}"
            loading="lazy"
          />
        </div>

        <div class="rw-prize-card__body">
          <div class="rw-prize-card__meta">
            <span class="rw-prize-card__tag">${escapeHtml(prettifyCategory(prize.category))}</span>
            <span class="rw-prize-card__tag">${escapeHtml(stockText)}</span>
          </div>

          <h3 class="rw-prize-card__title">${escapeHtml(prize.name)}</h3>

          <p class="rw-prize-card__description">
            ${escapeHtml(prize.description || "A fun reward from the treasure shop.")}
          </p>

          <div class="rw-prize-card__details">
            <div class="rw-prize-card__detail-row">
              <span>Prize Credit</span>
              <strong>${money(prize.price)}</strong>
            </div>
            <div class="rw-prize-card__detail-row">
              <span>Donations Needed</span>
              <strong>${money(prize.donationsNeeded)}</strong>
            </div>
          </div>

          <div class="rw-prize-card__status${statusClass}">
            ${escapeHtml(statusText)}
          </div>

          <button
            type="button"
            class="rw-btn rw-btn-primary rw-btn-block"
            data-redeem-prize-id="${escapeAttribute(prize.prizeId)}"
            ${buttonDisabled}
          >
            ${escapeHtml(buttonLabel)}
          </button>
        </div>
      </article>
    `;
  }

  function getFilteredPrizes() {
    const remaining = getRemainingCreditAmount();

    return state.prizes.filter((prize) => {
      if (state.activeCategory !== "all" && prize.category !== state.activeCategory) {
        return false;
      }

      if (state.activeSearch) {
        const haystack = [
          prize.name,
          prize.description,
          prize.category,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(state.activeSearch)) {
          return false;
        }
      }

      if (state.activeQuickFilter === "affordable") {
        return isInStock(prize) && isAffordable(prize, remaining);
      }

      if (state.activeQuickFilter === "almost") {
        if (!isInStock(prize)) return false;
        const gap = prize.price - remaining;
        return gap > 0 && gap <= 5;
      }

      if (state.activeQuickFilter === "dream") {
        return prize.shelfKey === "shelf4";
      }

      return true;
    });
  }

  function openRedeemModal(prize) {
    state.redeemingPrize = prize;

    if (els.modalMessage) {
      els.modalMessage.innerHTML = `
        Redeem <strong>${escapeHtml(prize.name)}</strong> for
        <strong>${money(prize.price)}</strong> in prize credit?
      `;
    }

    if (els.modal) {
      els.modal.classList.remove("is-hidden");
      els.modal.setAttribute("aria-hidden", "false");
    }
  }

  function closeRedeemModal() {
    state.redeemingPrize = null;

    if (els.modal) {
      els.modal.classList.add("is-hidden");
      els.modal.setAttribute("aria-hidden", "true");
    }
  }

  async function confirmRedeem() {
    const prize = state.redeemingPrize;
    if (!prize) return;

    if (els.modalConfirm) {
      els.modalConfirm.disabled = true;
      els.modalConfirm.textContent = "Redeeming...";
    }

    try {
      await redeemPrizeWithExistingBackend(prize);
      closeRedeemModal();
      await loadData();
      renderAll();
      showToast(`🎉 ${prize.name} has been redeemed!`);
    } catch (error) {
      console.error("Redeem failed:", error);
      showToast(error?.message || "Sorry, something went wrong redeeming this prize.");
    } finally {
      if (els.modalConfirm) {
        els.modalConfirm.disabled = false;
        els.modalConfirm.textContent = "Redeem Prize";
      }
    }
  }

  async function redeemPrizeWithExistingBackend(prize) {
    if (typeof window.placePrizeOrder === "function") {
      return window.placePrizeOrder(prize);
    }

    if (typeof window.redeemPrize === "function") {
      return window.redeemPrize(prize);
    }

    if (typeof window.fnRedeemPrizeCredit === "function") {
      return window.fnRedeemPrizeCredit({
        schoolId: state.schoolId,
        userId: state.userId,
        prizeId: prize.prizeId,
      });
    }

    const callable = window.httpsCallable || window.firebase?.functions?.httpsCallable;
    const functionsInstance = window.functions || window.firebaseFunctions;

    if (typeof callable === "function" && functionsInstance) {
      const redeemFn = callable(functionsInstance, "fnRedeemPrizeCredit");
      return redeemFn({
        schoolId: state.schoolId,
        userId: state.userId,
        prizeId: prize.prizeId,
      });
    }

    throw new Error("No redemption function was found on the page.");
  }

  function showToast(message) {
    if (!els.toast) {
      alert(message);
      return;
    }

    els.toast.textContent = message;
    els.toast.classList.remove("is-hidden");

    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      els.toast.classList.add("is-hidden");
    }, 2600);
  }

  function getRaisedAmount() {
    return (
      Number(
        state.userProfile?.totalDonations ??
        state.userProfile?.donationsRaised ??
        state.userProfile?.fundraisingTotal ??
        state.userProfile?.raised ??
        0
      ) || 0
    );
  }

  function getEarnedCreditAmount() {
    const explicit =
      Number(
        state.userProfile?.prizeCreditEarned ??
        state.userProfile?.totalPrizeEarned ??
        state.userProfile?.earnedPrizeBalance ??
        NaN
      );

    if (!Number.isNaN(explicit)) return explicit;

    return Number((getRaisedAmount() * 0.2).toFixed(2));
  }

  function getSpentCreditAmount() {
    return (
      Number(
        state.userProfile?.totalPrizeSpent ??
        state.userProfile?.prizeSpent ??
        state.userProfile?.spentPrizeBalance ??
        0
      ) || 0
    );
  }

  function getRemainingCreditAmount() {
    const explicit =
      Number(
        state.userProfile?.prizeBalance ??
        state.userProfile?.availablePrizeBalance ??
        state.userProfile?.currentPrizeBalance ??
        NaN
      );

    if (!Number.isNaN(explicit)) return explicit;

    return Math.max(0, getEarnedCreditAmount() - getSpentCreditAmount());
  }

  function isAffordable(prize, remainingCredit) {
    return Number(prize.price || 0) <= Number(remainingCredit || 0);
  }

  function isInStock(prize) {
    return prize.stock === Infinity || Number(prize.stock || 0) > 0;
  }

  function getShelfForPrice(price) {
    if (price >= 40) return "shelf4";
    if (price >= 15) return "shelf3";
    if (price >= 5) return "shelf2";
    return "shelf1";
  }

  function prettifyCategory(category) {
    return String(category || "other")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(value || 0));
  }

  function getValue(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== "");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/"/g, '\\"');
  }

  function cryptoRandomId() {
    return `prize_${Math.random().toString(36).slice(2, 10)}`;
  }
})();