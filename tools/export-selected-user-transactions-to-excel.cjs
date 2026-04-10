const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const ExcelJS = require('exceljs');

// Update this path if needed
const serviceAccount = require('C:/Users/malbr/OneDrive/Desktop/keys/lrcquest-3039e-serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const SCHOOL_ID = '308_longbeach_elementary';
const TARGET_DISPLAY_NAMES = [
  'Samiyah Muhammad',
  'Emily Waldvogel',
  'Kai Felton',
  'Ayra Hashmi',
  'Logan Pacenti',
];

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function safeSheetName(name) {
  return String(name || 'Sheet')
    .replace(/[\\/?*\[\]:]/g, '')
    .slice(0, 31) || 'Sheet';
}

function toIsoString(timestamp) {
  if (!timestamp) return '';
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return String(timestamp);
}

function styleHeaderRow(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' },
  };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
}

function autoFitColumns(worksheet, minWidth = 14, maxWidth = 40) {
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? '' : String(cell.value);
      maxLength = Math.max(maxLength, value.length);
    });
    column.width = Math.min(Math.max(maxLength + 2, minWidth), maxWidth);
  });
}

async function getUsersByDisplayNames() {
  const usersRef = db.collection('readathonV2_schools').doc(SCHOOL_ID).collection('users');
  const snapshot = await usersRef.get();

  const targetSet = new Set(TARGET_DISPLAY_NAMES.map(normalizeName));
  const matchedUsers = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const displayName = String(data.displayName || '').trim();
    if (targetSet.has(normalizeName(displayName))) {
      matchedUsers.push({
        userId: doc.id,
        displayName,
      });
    }
  });

  const unmatchedNames = TARGET_DISPLAY_NAMES.filter(
    (targetName) => !matchedUsers.some((u) => normalizeName(u.displayName) === normalizeName(targetName))
  );

  return { matchedUsers, unmatchedNames };
}

async function getTransactionsForUserIds(userMap) {
  const transactionsRef = db
    .collection('readathonV2_schools')
    .doc(SCHOOL_ID)
    .collection('transactions');

  const userIds = Object.keys(userMap);
  if (!userIds.length) return [];

  const results = [];

  // 'in' queries are limited; chunk defensively.
  for (let i = 0; i < userIds.length; i += 10) {
    const chunk = userIds.slice(i, i + 10);
    const snapshot = await transactionsRef
      .where('targetUserId', 'in', chunk)
      .get();

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      results.push({
        transactionId: doc.id,
        targetDisplayName: userMap[data.targetUserId] || '',
        actionType: data.actionType ?? '',
        deltaMinutes: data.deltaMinutes ?? '',
        deltaRubies: data.deltaRubies ?? '',
        note: data.note ?? '',
        source: data.source ?? '',
        status: data.status ?? '',
        submittedByUserId: data.submittedByUserId ?? '',
        targetUserId: data.targetUserId ?? '',
        timestamp: toIsoString(data.timestamp),
      });
    });
  }

  results.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return results;
}

async function buildWorkbook(matchedUsers, unmatchedNames, transactions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OpenAI';
  workbook.created = new Date();
  workbook.modified = new Date();

  const allColumns = [
    { header: 'transactionId', key: 'transactionId' },
    { header: 'targetDisplayName', key: 'targetDisplayName' },
    { header: 'actionType', key: 'actionType' },
    { header: 'deltaMinutes', key: 'deltaMinutes' },
    { header: 'deltaRubies', key: 'deltaRubies' },
    { header: 'note', key: 'note' },
    { header: 'source', key: 'source' },
    { header: 'status', key: 'status' },
    { header: 'submittedByUserId', key: 'submittedByUserId' },
    { header: 'targetUserId', key: 'targetUserId' },
    { header: 'timestamp', key: 'timestamp' },
  ];

  const summarySheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  summarySheet.columns = [
    { header: 'displayName', key: 'displayName', width: 28 },
    { header: 'userId', key: 'userId', width: 32 },
    { header: 'transactionCount', key: 'transactionCount', width: 18 },
    { header: 'matched', key: 'matched', width: 12 },
  ];
  styleHeaderRow(summarySheet.getRow(1));

  for (const targetName of TARGET_DISPLAY_NAMES) {
    const match = matchedUsers.find((u) => normalizeName(u.displayName) === normalizeName(targetName));
    const count = match
      ? transactions.filter((t) => t.targetUserId === match.userId).length
      : 0;

    summarySheet.addRow({
      displayName: targetName,
      userId: match ? match.userId : '',
      transactionCount: count,
      matched: match ? 'yes' : 'no',
    });
  }

  summarySheet.getCell('F1').value = 'Unmatched display names';
  summarySheet.getCell('F1').font = { bold: true };
  unmatchedNames.forEach((name, index) => {
    summarySheet.getCell(`F${index + 2}`).value = name;
  });
  autoFitColumns(summarySheet);

  const allSheet = workbook.addWorksheet('All_Transactions', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  allSheet.columns = allColumns;
  styleHeaderRow(allSheet.getRow(1));
  transactions.forEach((row) => allSheet.addRow(row));
  allSheet.getColumn('deltaMinutes').numFmt = '0';
  allSheet.getColumn('deltaRubies').numFmt = '0';
  autoFitColumns(allSheet, 14, 45);

  for (const targetName of TARGET_DISPLAY_NAMES) {
    const match = matchedUsers.find((u) => normalizeName(u.displayName) === normalizeName(targetName));
    const sheet = workbook.addWorksheet(safeSheetName(targetName), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = allColumns;
    styleHeaderRow(sheet.getRow(1));

    if (match) {
      transactions
        .filter((t) => t.targetUserId === match.userId)
        .forEach((row) => sheet.addRow(row));
    }

    sheet.getColumn('deltaMinutes').numFmt = '0';
    sheet.getColumn('deltaRubies').numFmt = '0';
    autoFitColumns(sheet, 14, 45);
  }

  return workbook;
}

async function main() {
  try {
    console.log('Finding users by display name...');
    const { matchedUsers, unmatchedNames } = await getUsersByDisplayNames();

    console.log(`Matched ${matchedUsers.length} user(s).`);
    matchedUsers.forEach((u) => console.log(`- ${u.displayName} (${u.userId})`));

    if (unmatchedNames.length) {
      console.log('Unmatched display names:');
      unmatchedNames.forEach((name) => console.log(`- ${name}`));
    }

    const userMap = Object.fromEntries(matchedUsers.map((u) => [u.userId, u.displayName]));

    console.log('Pulling transactions...');
    const transactions = await getTransactionsForUserIds(userMap);
    console.log(`Found ${transactions.length} transaction(s).`);

    const outputDir = path.resolve(__dirname, '../data_imports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const workbook = await buildWorkbook(matchedUsers, unmatchedNames, transactions);

    const xlsxPath = path.join(outputDir, 'selected_user_transactions.xlsx');
    const jsonPath = path.join(outputDir, 'selected_user_transactions.json');

    await workbook.xlsx.writeFile(xlsxPath);
    fs.writeFileSync(jsonPath, JSON.stringify(transactions, null, 2), 'utf8');

    console.log('Done!');
    console.log(`Excel saved to: ${xlsxPath}`);
    console.log(`JSON saved to: ${jsonPath}`);
  } catch (error) {
    console.error('Error exporting transactions:', error);
    process.exitCode = 1;
  }
}

main();
