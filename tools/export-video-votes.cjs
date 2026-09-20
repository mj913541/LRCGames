const admin = require("firebase-admin");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

// 🔐 SERVICE ACCOUNT (your working path)
const serviceAccount = require("C:/Users/malbr/OneDrive/Desktop/keys/lrcquest-3039e-serviceAccount.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ==============================
// CONFIG
// ==============================
const SCHOOL_ID = "308_longbeach_elementary";
const USERS_ROOT = `readathonV2_schools/${SCHOOL_ID}/users`;

const OUTPUT_DIR = path.join(__dirname, "../data_imports");
const OUTPUT_FILE = path.join(OUTPUT_DIR, `video-votes-${SCHOOL_ID}.xlsx`);

// ==============================
// HELPERS
// ==============================
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safe(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function toIso(value) {
  if (!value) return "";
  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  } catch (err) {
    return "";
  }
}

function parseVoteDocId(voteDocId) {
  // Example: round1_match8
  const match = String(voteDocId).match(/round(\d+)_match(\d+)/i);

  if (!match) {
    return {
      roundNumber: "",
      matchNumber: "",
    };
  }

  return {
    roundNumber: Number(match[1]),
    matchNumber: Number(match[2]),
  };
}

function autoFitColumns(worksheet, minWidth = 12, maxWidth = 40) {
  worksheet.columns.forEach((column) => {
    let longest = minWidth;

    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? "" : String(cell.value);
      if (value.length + 2 > longest) {
        longest = Math.min(value.length + 2, maxWidth);
      }
    });

    column.width = longest;
  });
}

function styleHeader(row) {
  row.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };

  row.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
}

function addBorderToUsedCells(ws) {
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };
    });
  });
}

// ==============================
// MAIN
// ==============================
async function runExport() {
  console.log("Starting video vote export...");
  ensureDir(OUTPUT_DIR);

  const rawRows = [];
  const countsBySelectedVideoId = new Map();
  const countsByVoteDocId = new Map();

  let totalUsersScanned = 0;
  let usersWithVotes = 0;
  let totalVoteDocs = 0;

  let lastDoc = null;

  while (true) {
    let query = db
      .collection(USERS_ROOT)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(200);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const userSnap = await query.get();

    if (userSnap.empty) {
      break;
    }

    for (const userDoc of userSnap.docs) {
      totalUsersScanned++;

      const userId = userDoc.id;
      const userData = userDoc.data() || {};

      const displayName = safe(userData.displayName);
      const firstName = safe(userData.firstName);
      const lastName = safe(userData.lastName);
      const grade = safe(userData.grade);
      const teacher = safe(userData.teacher || userData.teacherName);

      const votesSnap = await db.collection(`${USERS_ROOT}/${userId}/videoVotes`).get();

      if (!votesSnap.empty) {
        usersWithVotes++;
      }

      for (const voteDoc of votesSnap.docs) {
        totalVoteDocs++;

        const voteDocId = voteDoc.id;
        const voteData = voteDoc.data() || {};
        const selectedVideoId = safe(voteData.selectedVideoId);

        const { roundNumber, matchNumber } = parseVoteDocId(voteDocId);

        const rawRow = {
          userId,
          displayName,
          firstName,
          lastName,
          grade,
          teacher,
          voteDocId,
          roundNumber,
          matchNumber,
          selectedVideoId,
          path: `${USERS_ROOT}/${userId}/videoVotes/${voteDocId}`,
          createdAt: toIso(voteData.createdAt),
          updatedAt: toIso(voteData.updatedAt),
          rawData: JSON.stringify(voteData),
        };

        rawRows.push(rawRow);

        if (selectedVideoId) {
          countsBySelectedVideoId.set(
            selectedVideoId,
            (countsBySelectedVideoId.get(selectedVideoId) || 0) + 1
          );
        }

        countsByVoteDocId.set(
          voteDocId,
          (countsByVoteDocId.get(voteDocId) || 0) + 1
        );
      }

      if (totalUsersScanned % 50 === 0) {
        console.log(`Processed ${totalUsersScanned} users...`);
      }
    }

    lastDoc = userSnap.docs[userSnap.docs.length - 1];
  }

  // ==============================
  // BUILD WORKBOOK
  // ==============================
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OpenAI";
  workbook.created = new Date();

  // ------------------------------
  // TAB 1: RAW VOTES
  // ------------------------------
  const rawSheet = workbook.addWorksheet("Raw Votes", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  rawSheet.columns = [
    { header: "userId", key: "userId" },
    { header: "displayName", key: "displayName" },
    { header: "firstName", key: "firstName" },
    { header: "lastName", key: "lastName" },
    { header: "grade", key: "grade" },
    { header: "teacher", key: "teacher" },
    { header: "voteDocId", key: "voteDocId" },
    { header: "roundNumber", key: "roundNumber" },
    { header: "matchNumber", key: "matchNumber" },
    { header: "selectedVideoId", key: "selectedVideoId" },
    { header: "path", key: "path" },
    { header: "createdAt", key: "createdAt" },
    { header: "updatedAt", key: "updatedAt" },
    { header: "rawData", key: "rawData" },
  ];

  styleHeader(rawSheet.getRow(1));

  for (const row of rawRows) {
    rawSheet.addRow(row);
  }

  rawSheet.autoFilter = {
    from: "A1",
    to: "N1",
  };

  autoFitColumns(rawSheet, 12, 55);
  addBorderToUsedCells(rawSheet);

  // ------------------------------
  // TAB 2: VOTE COUNTS
  // ------------------------------
  const countsSheet = workbook.addWorksheet("Vote Counts", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  countsSheet.columns = [
    { header: "selectedVideoId", key: "selectedVideoId" },
    { header: "voteCount", key: "voteCount" },
  ];

  styleHeader(countsSheet.getRow(1));

  const sortedVideoCounts = Array.from(countsBySelectedVideoId.entries())
    .map(([selectedVideoId, voteCount]) => ({
      selectedVideoId,
      voteCount,
    }))
    .sort((a, b) => {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return String(a.selectedVideoId).localeCompare(String(b.selectedVideoId));
    });

  for (const row of sortedVideoCounts) {
    countsSheet.addRow(row);
  }

  countsSheet.autoFilter = {
    from: "A1",
    to: "B1",
  };

  autoFitColumns(countsSheet, 12, 24);
  addBorderToUsedCells(countsSheet);

  // ------------------------------
  // TAB 3: SUMMARY
  // ------------------------------
  const summarySheet = workbook.addWorksheet("Summary");

  summarySheet.views = [{ showGridLines: false }];
  summarySheet.columns = [
    { width: 34 },
    { width: 24 },
  ];

  summarySheet.mergeCells("A1:B1");
  summarySheet.getCell("A1").value = "Video Vote Export Summary";
  summarySheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  summarySheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "center",
  };
  summarySheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };

  const topVideo = sortedVideoCounts[0] || { selectedVideoId: "", voteCount: 0 };

  const summaryRows = [
    ["School ID", SCHOOL_ID],
    ["Generated At", new Date().toISOString()],
    ["Total Users Scanned", totalUsersScanned],
    ["Users With Votes", usersWithVotes],
    ["Total Vote Docs", totalVoteDocs],
    ["Unique selectedVideoIds", countsBySelectedVideoId.size],
    ["Top selectedVideoId", topVideo.selectedVideoId],
    ["Top selectedVideoId Vote Count", topVideo.voteCount],
    ["Raw Votes Tab", "Raw Votes"],
    ["Vote Counts Tab", "Vote Counts"],
  ];

  let rowIndex = 3;

  for (const [label, value] of summaryRows) {
    summarySheet.getCell(`A${rowIndex}`).value = label;
    summarySheet.getCell(`B${rowIndex}`).value = value;

    summarySheet.getCell(`A${rowIndex}`).font = { bold: true };
    summarySheet.getCell(`A${rowIndex}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E2F3" },
    };

    rowIndex++;
  }

  rowIndex += 1;

  summarySheet.getCell(`A${rowIndex}`).value = "Top Videos";
  summarySheet.getCell(`A${rowIndex}`).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  summarySheet.getCell(`A${rowIndex}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF5B9BD5" },
  };
  summarySheet.getCell(`B${rowIndex}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF5B9BD5" },
  };

  rowIndex++;
  summarySheet.getCell(`A${rowIndex}`).value = "selectedVideoId";
  summarySheet.getCell(`B${rowIndex}`).value = "voteCount";
  summarySheet.getRow(rowIndex).font = { bold: true };

  for (const item of sortedVideoCounts.slice(0, 10)) {
    rowIndex++;
    summarySheet.getCell(`A${rowIndex}`).value = item.selectedVideoId;
    summarySheet.getCell(`B${rowIndex}`).value = item.voteCount;
  }

  addBorderToUsedCells(summarySheet);

  // ------------------------------
  // TAB 4: COUNTS BY MATCH
  // ------------------------------
  const matchCountsSheet = workbook.addWorksheet("Counts By Match", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  matchCountsSheet.columns = [
    { header: "voteDocId", key: "voteDocId" },
    { header: "voteCount", key: "voteCount" },
  ];

  styleHeader(matchCountsSheet.getRow(1));

  const sortedMatchCounts = Array.from(countsByVoteDocId.entries())
    .map(([voteDocId, voteCount]) => ({
      voteDocId,
      voteCount,
    }))
    .sort((a, b) => {
      if (a.voteDocId < b.voteDocId) return -1;
      if (a.voteDocId > b.voteDocId) return 1;
      return 0;
    });

  for (const row of sortedMatchCounts) {
    matchCountsSheet.addRow(row);
  }

  matchCountsSheet.autoFilter = {
    from: "A1",
    to: "B1",
  };

  autoFitColumns(matchCountsSheet, 12, 28);
  addBorderToUsedCells(matchCountsSheet);

  // ==============================
  // SAVE FILE
  // ==============================
  await workbook.xlsx.writeFile(OUTPUT_FILE);

  console.log("==================================");
  console.log("Export complete.");
  console.log(`Users scanned: ${totalUsersScanned}`);
  console.log(`Users with votes: ${usersWithVotes}`);
  console.log(`Vote docs found: ${totalVoteDocs}`);
  console.log(`Saved file: ${OUTPUT_FILE}`);
  console.log("==================================");
}

runExport().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});