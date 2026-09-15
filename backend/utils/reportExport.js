/**
 * CSV and minimal PDF builders for report exports (no external deps).
 */

const EXPORT_MAX_ROWS = 5000;

function cellValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsvCell(value) {
  const s = cellValue(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(columns, rows) {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.value(row))).join(",")
  );
  // BOM helps Excel open UTF-8 correctly
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}

function pdfEscape(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

/**
 * Build a simple multi-page Helvetica PDF (letter size).
 * Suitable for tabular report dumps without pdfkit.
 */
function toSimplePdf({ title, subtitle = "", summaryLines = [], columns, rows }) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const lineHeight = 12;
  const titleSize = 14;
  const bodySize = 9;
  const usableWidth = pageWidth - margin * 2;
  const colWidths = columns.map(() => usableWidth / columns.length);

  function wrapRowCells(row) {
    return columns.map((c) => {
      const raw = cellValue(c.value(row));
      const maxChars = Math.max(8, Math.floor(colWidths[0] / 5.2));
      return raw.length > maxChars ? `${raw.slice(0, maxChars - 1)}…` : raw;
    });
  }

  const pages = [];
  let y = pageHeight - margin;
  let content = [];

  function flushPage() {
    pages.push(content.join("\n"));
    content = [];
    y = pageHeight - margin;
  }

  function ensureSpace(needed) {
    if (y - needed < margin) {
      flushPage();
      drawHeader(true);
    }
  }

  function drawHeader(continued) {
    content.push("BT");
    content.push(`/F1 ${titleSize} Tf`);
    content.push(`${margin} ${y} Td`);
    content.push(`(${pdfEscape(title)}${continued ? " (cont.)" : ""}) Tj`);
    content.push("ET");
    y -= titleSize + 6;

    if (subtitle) {
      content.push("BT");
      content.push(`/F1 ${bodySize} Tf`);
      content.push(`${margin} ${y} Td`);
      content.push(`(${pdfEscape(subtitle)}) Tj`);
      content.push("ET");
      y -= lineHeight + 2;
    }

    if (!continued && summaryLines.length) {
      for (const line of summaryLines) {
        content.push("BT");
        content.push(`/F1 ${bodySize} Tf`);
        content.push(`${margin} ${y} Td`);
        content.push(`(${pdfEscape(line)}) Tj`);
        content.push("ET");
        y -= lineHeight;
      }
      y -= 6;
    }

    // Column headers
    content.push("BT");
    content.push(`/F1 ${bodySize} Tf`);
    let x = margin;
    for (let i = 0; i < columns.length; i += 1) {
      content.push("1 0 0 1 0 0 Tm");
      content.push(`${x} ${y} Td`);
      content.push(`(${pdfEscape(columns[i].header)}) Tj`);
      x += colWidths[i];
    }
    content.push("ET");
    y -= lineHeight + 4;
  }

  drawHeader(false);

  const limited = rows.slice(0, EXPORT_MAX_ROWS);
  for (const row of limited) {
    ensureSpace(lineHeight + 2);
    const cells = wrapRowCells(row);
    content.push("BT");
    content.push(`/F1 ${bodySize} Tf`);
    let x = margin;
    for (let i = 0; i < cells.length; i += 1) {
      content.push("1 0 0 1 0 0 Tm");
      content.push(`${x} ${y} Td`);
      content.push(`(${pdfEscape(cells[i])}) Tj`);
      x += colWidths[i];
    }
    content.push("ET");
    y -= lineHeight;
  }

  if (rows.length > EXPORT_MAX_ROWS) {
    ensureSpace(lineHeight * 2);
    content.push("BT");
    content.push(`/F1 ${bodySize} Tf`);
    content.push(`${margin} ${y} Td`);
    content.push(
      `(Showing first ${EXPORT_MAX_ROWS} of ${rows.length} rows. Use CSV for full export.) Tj`
    );
    content.push("ET");
  }

  flushPage();

  const objects = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const pageObjectNumbers = [];
  let nextObj = 3;
  const contentObjectNumbers = [];

  for (let i = 0; i < pages.length; i += 1) {
    pageObjectNumbers.push(nextObj);
    contentObjectNumbers.push(nextObj + 1);
    nextObj += 2;
  }
  const fontObj = nextObj;

  const kids = pageObjectNumbers.map((n) => `${n} 0 R`).join(" ");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`
  );

  for (let i = 0; i < pages.length; i += 1) {
    const pageNo = pageObjectNumbers[i];
    const contentNo = contentObjectNumbers[i];
    const stream = pages[i];
    objects.push(
      `${pageNo} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentNo} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\nendobj\n`
    );
    objects.push(
      `${contentNo} 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  }

  objects.push(
    `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  );

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${offsets.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

function formatSummaryLines(summary = {}, reportType) {
  const lines = [`Report: ${reportType}`, `Generated: ${new Date().toISOString()}`];
  Object.entries(summary).forEach(([key, value]) => {
    if (value !== null && typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => {
        lines.push(`${key}.${k}: ${v}`);
      });
    } else if (key !== "note") {
      lines.push(`${key}: ${value}`);
    }
  });
  if (summary.note) lines.push(`Note: ${summary.note}`);
  return lines;
}

const BOOKING_COLUMNS = [
  { header: "Code", value: (r) => r.bookingCode },
  { header: "Property", value: (r) => r.propertyCode || r.propertyId },
  { header: "Client", value: (r) => r.clientName || r.clientId },
  { header: "Total Price", value: (r) => r.totalPrice },
  { header: "Down Payment", value: (r) => r.bookingAmount },
  { header: "Remaining", value: (r) => r.remainingBalance },
  { header: "Status", value: (r) => r.status },
  { header: "Booked At", value: (r) => r.bookedAt },
];

const PAYMENT_COLUMNS = [
  { header: "Code", value: (r) => r.paymentCode },
  { header: "Date", value: (r) => r.paymentDate },
  { header: "Amount", value: (r) => r.amount },
  { header: "Method", value: (r) => r.paymentMethodName || r.paymentMethodId },
  { header: "Booking", value: (r) => r.bookingCode || r.bookingId },
  { header: "Client", value: (r) => r.clientName || r.clientId },
  { header: "Property", value: (r) => r.propertyCode || r.propertyId },
  { header: "Reference", value: (r) => r.referenceNumber },
];

const EXPENSE_COLUMNS = [
  { header: "Code", value: (r) => r.expenseCode },
  { header: "Date", value: (r) => r.expenseDate },
  { header: "Category", value: (r) => r.categoryName || r.categoryId },
  { header: "Amount", value: (r) => r.amount },
  { header: "GST", value: (r) => r.gstSalesTax },
  { header: "Remaining", value: (r) => r.remainingAmount },
  { header: "Approval", value: (r) => r.approvalStatus },
  { header: "Property", value: (r) => r.propertyCode || r.propertyId },
  { header: "Vendor", value: (r) => r.vendorName || r.vendorId },
];

const PROPERTY_COLUMNS = [
  { header: "Code", value: (r) => r.propertyCode },
  { header: "Title", value: (r) => r.title },
  { header: "Type", value: (r) => r.propertyType },
  { header: "Purpose", value: (r) => r.purpose },
  { header: "Category", value: (r) => r.category },
  { header: "City", value: (r) => r.city },
  { header: "Asking Price", value: (r) => r.askingPrice },
  { header: "Status", value: (r) => r.status },
];

const REPORT_EXPORT_CONFIG = {
  bookings: { columns: BOOKING_COLUMNS, title: "EstateX Pro — Bookings Report" },
  payments: { columns: PAYMENT_COLUMNS, title: "EstateX Pro — Payments Report" },
  expenses: { columns: EXPENSE_COLUMNS, title: "EstateX Pro — Expenses Report" },
  properties: { columns: PROPERTY_COLUMNS, title: "EstateX Pro — Properties Report" },
};

function buildExportFile(reportType, format, { summary, items }) {
  const config = REPORT_EXPORT_CONFIG[reportType];
  if (!config) {
    throw new Error(`Unknown report type: ${reportType}`);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `estatex-${reportType}-report-${stamp}`;
  const summaryLines = formatSummaryLines(summary, reportType);

  if (format === "csv") {
    return {
      filename: `${baseName}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: toCsv(config.columns, items),
    };
  }

  if (format === "pdf") {
    return {
      filename: `${baseName}.pdf`,
      contentType: "application/pdf",
      body: toSimplePdf({
        title: config.title,
        subtitle: `Rows: ${items.length} (max ${EXPORT_MAX_ROWS})`,
        summaryLines,
        columns: config.columns,
        rows: items,
      }),
    };
  }

  throw new Error(`Unsupported export format: ${format}`);
}

function normalizeExportFormat(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const format = String(raw).trim().toLowerCase();
  if (format === "csv" || format === "excel" || format === "xlsx") return "csv";
  if (format === "pdf") return "pdf";
  return format;
}

module.exports = {
  EXPORT_MAX_ROWS,
  toCsv,
  toSimplePdf,
  buildExportFile,
  normalizeExportFormat,
  REPORT_EXPORT_CONFIG,
};
