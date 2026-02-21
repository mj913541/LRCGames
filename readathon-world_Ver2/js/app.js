// /readathon-world_Ver2/js/app.js
import {
  getSchoolId,
  DEFAULT_SCHOOL_ID,
  auth,
  signOutUser,
  getIdTokenClaims,
  userSummaryRef,
  db,
} from "/readathon-world_Ver2/js/firebase.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  limit,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const ABS = {
  index: "/readathon-world_Ver2/html/index.html",

  studentLogin: "/readathon-world_Ver2/html/student-login.html",
  staffLogin: "/readathon-world_Ver2/html/staff-login.html",
  adminLogin: "/readathon-world_Ver2/html/admin-login.html",

  studentHome: "/readathon-world_Ver2/html/student-home.html",
  staffHome: "/readathon-world_Ver2/html/staff-home.html",
  adminHome: "/readathon-world_Ver2/html/admin-home.html",

  studentMinutesSubmit: "/readathon-world_Ver2/html/student-minutes-submit.html",
  staffMinutesSubmit: "/readathon-world_Ver2/html/staff-minutes-submit.html",
  adminMinutesApprove: "/readathon-world_Ver2/html/admin-minutes-approve.html",
};

export function fmtMoneyCents(cents) {
  const n = Number(cents || 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n / 100);
}

export function fmtInt(n) {
  return new Intl.NumberFormat("en-US").format(Number(n || 0));
}

export function safeText(s) {
  return (s ?? "").toString();
}

export function setHeaderUser(el, { title, subtitle }) {
  if (!el) return;
  const schoolId = getSchoolId() || DEFAULT_SCHOOL_ID;
  const userId = auth.currentUser?.uid || localStorage.getItem("readathonV2_userId") || "";
  el.querySelector("[data-title]").textContent = title || "Readathon World";
  el.querySelector("[data-subtitle]").textContent =
    subtitle || `${schoolId} • ${userId}`;
}

export function wireSignOut(btnEl) {
  if (!btnEl) return;
  btnEl.addEventListener("click", async () => {
    try {
      btnEl.disabled = true;
      await signOutUser();
    } finally {
      localStorage.removeItem("readathonV2_role");
      localStorage.removeItem("readathonV2_userId");
      // keep schoolId for convenience
      window.location.href = ABS.index;
    }
  });
}

export async function guardRoleOrRedirect(allowedRoles = [], redirectToLogin) {
  // must be signed in
  const u = auth.currentUser;
  if (!u) {
    window.location.href = redirectToLogin || ABS.index;
    return null;
  }
  const claims = await getIdTokenClaims(true);
  if (!claims?.role || !allowedRoles.includes(claims.role)) {
    window.location.href = redirectToLogin || ABS.index;
    return null;
  }
  return claims; // includes schoolId/userId/role from custom claims
}

export async function loadSummary({ schoolId, userId }) {
  const ref = userSummaryRef(schoolId, userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function loadInventory({ schoolId, userId, maxItems = 60 }) {
  const invCol = collection(db, `readathonV2_schools/${schoolId}/users/${userId}/readathon/inventory`);
  const qRef = query(invCol, orderBy("__name__"), limit(maxItems));
  const snap = await getDocs(qRef);
  return snap.docs.map(d => ({ itemId: d.id, ...d.data() }));
}

/**
 * Avatar “equipped preview”
 * We store equipped item IDs locally for now (no new collections invented).
 * Later, we can persist equipped state in the existing user doc or readathon subdoc
 * once you tell me your preferred schema.
 */
const equipKey = (schoolId, userId) => `readathonV2_equipped_${schoolId}_${userId}`;

export function getEquippedLocal({ schoolId, userId }) {
  try {
    const raw = localStorage.getItem(equipKey(schoolId, userId));
    return raw ? JSON.parse(raw) : { head: null, body: null, accessory: null, pet: null, room: null };
  } catch {
    return { head: null, body: null, accessory: null, pet: null, room: null };
  }
}

export function setEquippedLocal({ schoolId, userId }, equippedObj) {
  localStorage.setItem(equipKey(schoolId, userId), JSON.stringify(equippedObj));
}

export function pickSlotForItem(itemId) {
  // Simple heuristic you can refine later:
  // item_head_*, item_body_*, item_pet_*, item_room_*, item_acc_*
  const id = (itemId || "").toLowerCase();
  if (id.includes("head")) return "head";
  if (id.includes("body") || id.includes("shirt") || id.includes("outfit")) return "body";
  if (id.includes("pet")) return "pet";
  if (id.includes("room") || id.includes("bg")) return "room";
  return "accessory";
}

export function normalizeError(err) {
  const raw =
    err?.message ||
    err?.toString?.() ||
    "Something went wrong. Please try again.";
  return raw;
}

export function showLoading(overlayEl, textEl, text) {
  if (!overlayEl) return;
  if (textEl) textEl.textContent = text || "Loading…";
  overlayEl.classList.remove("isHidden");
}

export function hideLoading(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.add("isHidden");
}