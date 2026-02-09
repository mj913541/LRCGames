import { auth, db } from "../firebase.js";

import {
  doc, writeBatch, serverTimestamp,
  getDocs, collection, query, where, documentId
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";


// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const csvFile = $("csvFile");
const parseBtn = $("parseBtn");
const uploadBtn = $("uploadBtn");
const overwrite = $("overwrite");
const dryRun = $("dryRun");
const statusBox = $("status");
const previewBox = $("preview");
const summaryBox = $("summary");
const progressWrap = $("progressWrap");
const progressBar = $("progressBar");

let parsedRows = [];     // normalized + validated
let validRows = [];      // rows ready to upload

function setStatus(message, type = "ok") {
  statusBox.style.display = "block";
  statusBox.classList.toggle("err", type === "err");
  statusBox.innerHTML = message;
}

function resetUI() {
  previewBox.innerHTML = "";
  summaryBox.innerHTML = "";
  statusBox.style.display = "none";
  progressWrap.style.display = "none";
  progressBar.style.width = "0%";
  uploadBtn.disabled = true;
  parsedRows = [];
  validRows = [];
}

// ---------- CSV Parsing (no external libs) ----------
function parseCSV(text) {
  // Minimal CSV parser supporting quoted cells, commas, and newlines
  const rows = [];
  let cur = "";
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') { // escaped quote
      cur += '"'; i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      row.push(cur); cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur); cur = "";
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some(c => c.trim() !== "")) rows.push(row);
  return rows;
}

// ---------- Validation & normalization ----------
const REQUIRED_HEADERS = ["displayName", "grade", "homeroom", "studentId", "pin"];

function normalizeGrade(raw) {
  const s = (raw ?? "").toString().trim();
  if (!s) return "";
  const up = s.toUpperCase();
  if (up === "K" || up === "KG" || up === "KINDER" || up === "KINDERGARTEN") return "K";
  // allow 0-12 but you said K-5; we’ll validate later
  const n = up.replace(/[^\d]/g, "");
  return n || up;
}

function kidFriendlyError(rowNum, msg) {
  return `Row ${rowNum}: <strong>Oops!</strong> ${msg}`;
}

function validateRows(objects) {
  const errors = [];
  const ok = [];
  const seenIds = new Set();

  objects.forEach((r, idx) => {
    const rowNum = idx + 2; // +2 because headers are row 1

    const displayName = (r.displayName ?? "").toString().trim();
    const homeroom = (r.homeroom ?? "").toString().trim();
    const studentId = (r.studentId ?? "").toString().trim();
    const pin = (r.pin ?? "").toString().trim();
    const grade = normalizeGrade(r.grade);

    if (!displayName) errors.push(kidFriendlyError(rowNum, `Missing <span class="mono">displayName</span>.`));
    if (!homeroom) errors.push(kidFriendlyError(rowNum, `Missing <span class="mono">homeroom</span> for ${displayName || "this student"}.`));
    if (!studentId) errors.push(kidFriendlyError(rowNum, `Missing <span class="mono">studentId</span> for ${displayName || "this student"}.`));

    // grade: allow K, 1-5
    const gradeOk = (grade === "K") || (["1","2","3","4","5"].includes(grade));
    if (!gradeOk) errors.push(kidFriendlyError(rowNum, `Grade should be K, 1, 2, 3, 4, or 5 (found: <span class="mono">${grade || "blank"}</span>).`));

    // PIN: recommend 4 digits; allow 3-6 digits
    const pinOk = /^\d{3,6}$/.test(pin);
    if (!pinOk) errors.push(kidFriendlyError(rowNum, `PIN should be 3–6 digits (example: <span class="mono">1234</span>).`));

    if (studentId && seenIds.has(studentId)) {
      errors.push(kidFriendlyError(rowNum, `Duplicate <span class="mono">studentId</span> in this file: <span class="mono">${studentId}</span>.`));
    }
    if (studentId) seenIds.add(studentId);

    // If no new errors for this row, keep it
    const rowHasAnyError =
      (!displayName) || (!homeroom) || (!studentId) || (!gradeOk) || (!pinOk);

    if (!rowHasAnyError) {
      ok.push({ displayName, grade, homeroom, studentId, pin });
    }
  });

  return { ok, errors };
}

// ---------- PIN hashing (Web Crypto SHA-256) ----------
function randomSalt(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin) {
  const salt = randomSalt(16);
  const pinHash = await sha256Hex(`${salt}:${pin}`);
  return { pinSalt: salt, pinHash };
}

// ---------- Firestore helpers ----------
async function fetchExistingIds(ids) {
  // Firestore "in" query max is 10 ids, so we chunk
  const existing = new Set();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

  for (const chunk of chunks) {
    const q = query(collection(db, "students"), where(documentId(), "in", chunk));
    const snap = await getDocs(q);
    snap.forEach(docSnap => existing.add(docSnap.id));
  }
  return existing;
}

async function uploadStudents(rows, { allowOverwrite, isDryRun }) {
  const ids = rows.map(r => r.studentId);
  const existing = await fetchExistingIds(ids);

  const toCreate = [];
  const toUpdate = [];
  const skipped = [];

  rows.forEach(r => {
    if (existing.has(r.studentId)) {
      if (allowOverwrite) toUpdate.push(r);
      else skipped.push(r);
    } else {
      toCreate.push(r);
    }
  });

  // Dry run summary only
  if (isDryRun) {
    return { created: 0, updated: 0, skipped: skipped.length, errors: 0, dryRun: true, toCreate, toUpdate };
  }

  // Build write operations with batching (max 500 ops/batch)
  const ops = [];

  for (const r of [...toCreate, ...toUpdate]) {
    ops.push(async () => {
      const { pinHash, pinSalt } = await hashPin(r.pin);
      const ref = doc(db, "students", r.studentId);
      const payload = {
        studentId: r.studentId,
        displayName: r.displayName,
        grade: r.grade,
        homeroom: r.homeroom,
        pinHash,
        pinSalt,
        active: true,
        updatedAt: serverTimestamp(),
      };
      // Only set createdAt for new docs
      if (!existing.has(r.studentId)) payload.createdAt = serverTimestamp();
      return { ref, payload, merge: allowOverwrite };
    });
  }

  progressWrap.style.display = "block";

  let created = 0;
  let updated = 0;

  // Execute ops in batches of 450-ish to leave headroom
  const BATCH_SIZE = 450;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const slice = ops.slice(i, i + BATCH_SIZE);

    // Resolve payloads (hashing happens here)
    const resolved = [];
    for (let j = 0; j < slice.length; j++) {
      const item = await slice[j]();
      resolved.push(item);
      const pct = Math.round(((i + j + 1) / ops.length) * 100);
      progressBar.style.width = `${pct}%`;
    }

    const batch = writeBatch(db);
    resolved.forEach(({ ref, payload, merge }) => {
      batch.set(ref, payload, { merge });
      if (existing.has(ref.id)) updated++;
      else created++;
    });
    await batch.commit();
  }

  return { created, updated, skipped: skipped.length, errors: 0, dryRun: false };
}

// ---------- Main flow ----------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    setStatus(`Please log in as an admin first.`, "err");
    parseBtn.disabled = true;
    uploadBtn.disabled = true;
  }
});

parseBtn.addEventListener("click", async () => {
  resetUI();

  if (!csvFile.files?.length) {
    setStatus(`Choose a CSV file first. 🌿`, "err");
    return;
  }

  const file = csvFile.files[0];
  const text = await file.text();
  const rows = parseCSV(text);
  if (!rows.length) {
    setStatus(`That file looks empty. Try exporting again.`, "err");
    return;
  }

  const headers = rows[0].map(h => (h ?? "").toString().trim());
  const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
  if (missing.length) {
    setStatus(`Your CSV is missing headers: <span class="mono">${missing.join(", ")}</span>`, "err");
    return;
  }

  // Convert to objects
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const objects = rows.slice(1).map(r => ({
    displayName: r[idx.displayName] ?? "",
    grade: r[idx.grade] ?? "",
    homeroom: r[idx.homeroom] ?? "",
    studentId: r[idx.studentId] ?? "",
    pin: r[idx.pin] ?? "",
  }));

  const { ok, errors } = validateRows(objects);
  parsedRows = objects;
  validRows = ok;

  // Summary + preview
  const errorHtml = errors.length
    ? `<div class="status err"><strong>Fix these first:</strong><ul>${errors.slice(0, 25).map(e => `<li>${e}</li>`).join("")}</ul>${errors.length > 25 ? `<div class="hint">(+ ${errors.length - 25} more…)</div>` : ""}</div>`
    : "";

  summaryBox.innerHTML = `
    <div class="row">
      <div><span class="badge ok">Valid: ${ok.length}</span></div>
      <div><span class="badge ${errors.length ? "bad" : "ok"}">Issues: ${errors.length}</span></div>
      <div class="hint">Dry run is <strong>${dryRun.checked ? "ON" : "OFF"}</strong></div>
    </div>
    ${errorHtml}
  `;

  const previewCount = Math.min(ok.length, 25);
  const previewRows = ok.slice(0, previewCount).map(r => `
    <tr>
      <td>${r.displayName}</td>
      <td>${r.grade}</td>
      <td>${r.homeroom}</td>
      <td class="mono">${r.studentId}</td>
      <td class="mono">••••</td>
    </tr>
  `).join("");

  previewBox.innerHTML = `
    <h3 style="margin-top:14px;">Preview (first ${previewCount})</h3>
    <table>
      <thead><tr>
        <th>displayName</th><th>grade</th><th>homeroom</th><th>studentId</th><th>pin</th>
      </tr></thead>
      <tbody>${previewRows || `<tr><td colspan="5" class="hint">No valid rows yet.</td></tr>`}</tbody>
    </table>
  `;

  uploadBtn.disabled = (errors.length > 0 || ok.length === 0);
  if (!uploadBtn.disabled) {
    setStatus(`Preview looks good! You can upload when ready. 📚💎`);
  }
});

uploadBtn.addEventListener("click", async () => {
  if (!validRows.length) {
    setStatus(`Nothing to upload yet. Preview your CSV first.`, "err");
    return;
  }

  uploadBtn.disabled = true;
  parseBtn.disabled = true;

  try {
    setStatus(`Working on it… (This may take a minute for big files) 🌿`);

    const result = await uploadStudents(validRows, {
      allowOverwrite: overwrite.checked,
      isDryRun: dryRun.checked
    });

    if (result.dryRun) {
      setStatus(
        `✅ Dry run complete. If it looks right, uncheck “Dry run” and click Upload again.<br/>
         Would create <strong>${result.toCreate.length}</strong> new students and update <strong>${result.toUpdate.length}</strong> existing (if overwrite is on).`
      );
    } else {
      setStatus(
        `✅ Upload complete!<br/>
         Created: <strong>${result.created}</strong> • Updated: <strong>${result.updated}</strong> • Skipped (duplicates): <strong>${result.skipped}</strong>`
      );
    }
  } catch (e) {
    console.error(e);
    setStatus(`Something went wrong: <span class="mono">${(e?.message || e).toString()}</span>`, "err");
  } finally {
    parseBtn.disabled = false;
    uploadBtn.disabled = false;
  }
});
