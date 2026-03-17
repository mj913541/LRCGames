// /js/admin-prize-panel.js

import {
  db,
  schoolRoot,
  fnFulfillPrizeOrder,
  fnDeliverPrizeOrder,
  fnCancelPrizeOrder,
} from "./firebase.js";

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function mountPrizeAdminDashboard({ mountEl, schoolId }) {
  const mount = document.querySelector(mountEl);
  if (!mount) return;

  mount.innerHTML = `
    <section class="panel panel--prize-admin">
      <div class="prizeAdminHeader">
        <div>
          <div class="pill">Prize Store Admin</div>
          <h2 class="h2 prizeAdminTitle">Prize Orders</h2>
          <p class="sub prizeAdminSub">
            Track reserved prizes, fulfill orders, and deliver rewards.
          </p>
        </div>
      </div>

      <div class="prizeAdminStats" id="prizeAdminStats">
        <div class="emptyNote">Loading prize stats...</div>
      </div>

      <div class="prizeAdminList" id="prizeAdminList">
        <div class="emptyNote">Loading orders...</div>
      </div>
    </section>
  `;

  await loadOrders({ schoolId, mount });
}

async function loadOrders({ schoolId, mount }) {
  const listEl = mount.querySelector("#prizeAdminList");
  const statsEl = mount.querySelector("#prizeAdminStats");

  const q = query(
    collection(db, `${schoolRoot(schoolId)}/prizeOrders`),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  const snap = await getDocs(q);
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  renderStats(orders, statsEl);
  renderOrders(orders, listEl, schoolId);
}

function renderStats(orders, el) {
  const counts = {
    reserved: 0,
    fulfilled: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const o of orders) {
    if (o.status === "cancelled") counts.cancelled += 1;
    else if (o.fulfillmentStatus === "delivered") counts.delivered += 1;
    else if (o.fulfillmentStatus === "fulfilled") counts.fulfilled += 1;
    else counts.reserved += 1;
  }

  el.innerHTML = `
    <div class="prizeStatCard">
      <div class="prizeStatCard__label">Reserved</div>
      <div class="prizeStatCard__value">${counts.reserved}</div>
    </div>

    <div class="prizeStatCard">
      <div class="prizeStatCard__label">Fulfilled</div>
      <div class="prizeStatCard__value">${counts.fulfilled}</div>
    </div>

    <div class="prizeStatCard">
      <div class="prizeStatCard__label">Delivered</div>
      <div class="prizeStatCard__value">${counts.delivered}</div>
    </div>

    <div class="prizeStatCard">
      <div class="prizeStatCard__label">Cancelled</div>
      <div class="prizeStatCard__value">${counts.cancelled}</div>
    </div>
  `;
}

function renderOrders(orders, el, schoolId) {
  el.innerHTML = "";

  if (!orders.length) {
    el.innerHTML = `<div class="emptyNote">No prize orders yet.</div>`;
    return;
  }

  for (const o of orders) {
    const card = document.createElement("article");
    card.className = "prizeOrderCard";

    const statusLabel = getStatusLabel(o);
    const price = Number(o.price || 0).toFixed(2);

    card.innerHTML = `
      <div class="prizeOrderCard__top">
        <div class="prizeOrderCard__main">
          <h3 class="prizeOrderCard__title">${escapeHtml(o.prizeName || "Prize")}</h3>
          <p class="prizeOrderCard__student">${escapeHtml(o.studentDisplayName || "Student")}</p>
        </div>
        <div class="prizeOrderCard__status">${escapeHtml(statusLabel)}</div>
      </div>

      <div class="prizeOrderCard__meta">
        <div class="prizeOrderCard__metaRow">
          <span>Price</span>
          <strong>$${price}</strong>
        </div>
        <div class="prizeOrderCard__metaRow">
          <span>Order ID</span>
          <strong>${escapeHtml(o.orderId || o.id)}</strong>
        </div>
      </div>

      <div class="prizeOrderCard__actions">
        ${buildActions(o)}
      </div>
    `;

    wireButtons(card, o, schoolId);
    el.appendChild(card);
  }
}

function buildActions(o) {
  if (o.status === "cancelled") {
    return `<span class="prizeOrderDone">Cancelled</span>`;
  }

  if (o.fulfillmentStatus === "delivered") {
    return `<span class="prizeOrderDone">Delivered</span>`;
  }

  if (o.fulfillmentStatus === "fulfilled") {
    return `
      <button type="button" class="btn-action btn-donate" data-action="deliver">
        Mark Delivered
      </button>
      <button type="button" class="btn-action btn-approve-minutes" data-action="cancel">
        Cancel
      </button>
    `;
  }

  return `
    <button type="button" class="btn-action btn-submit-minutes" data-action="fulfill">
      Fulfill
    </button>
    <button type="button" class="btn-action btn-approve-minutes" data-action="cancel">
      Cancel
    </button>
  `;
}

function wireButtons(card, order, schoolId) {
  const btns = card.querySelectorAll("button");

  btns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;

      try {
        btn.disabled = true;

        if (action === "fulfill") {
          await fnFulfillPrizeOrder({ orderId: order.id, schoolId });
        }

        if (action === "deliver") {
          await fnDeliverPrizeOrder({ orderId: order.id, schoolId });
        }

        if (action === "cancel") {
          const ok = window.confirm("Cancel this order and refund the student?");
          if (!ok) {
            btn.disabled = false;
            return;
          }
          await fnCancelPrizeOrder({ orderId: order.id, schoolId });
        }

        window.location.reload();
      } catch (err) {
        btn.disabled = false;
        window.alert(err?.message || "Something went wrong.");
      }
    });
  });
}

function getStatusLabel(o) {
  if (o.status === "cancelled") return "Cancelled";
  if (o.fulfillmentStatus === "delivered") return "Delivered";
  if (o.fulfillmentStatus === "fulfilled") return "Fulfilled";
  return "Reserved";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}