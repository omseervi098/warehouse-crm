import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {Bill, BillingHistoryItem, Charge, CompanyProfileData, GatepassData, Party, StockBalance} from '../types';
import { chargesApi, companyApi, paymentsApi, stockBalanceApi } from './api';

export interface ExportOptions {
  title?: string;
  headers?: string[] | { [key: string]: string };
  orientation?: 'portrait' | 'landscape';
  unit?: 'pt' | 'mm' | 'cm' | 'in';
  format?: string | number[];
  margin?: number;
  autoTableOptions?: Record<string, any>;
  outPath?: string;
  bodyColumnStyles?: Array<{
    header: string;                  // exact header text to match
    styles: Record<string, any> & {
      textColor?: string | [number, number, number];
      fillColor?: string | [number, number, number];
    };
  }>;
}
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

async function getCompanyProfileOrNull(): Promise<CompanyProfileData | null> {
  try {
    const { data } = await companyApi.get();
    return data ?? null;
  } catch (error) {
    console.warn('Could not fetch company profile for PDF export:', error);
    return null;
  }
}

function getCompanyDisplayName(companyProfile?: CompanyProfileData | null): string {
  const warehouseName = companyProfile?.warehouseName?.trim();
  if (warehouseName) {
    return warehouseName;
  }

  // @ts-ignore
  const appName = import.meta.env.VITE_APP_NAME?.trim();
  return appName || "WAREHOUSE CRM";
}

async function previewPdf(doc: jsPDF, fileName: string) {
  const dataUri = doc.output('datauristring', { filename: fileName + '.pdf' });
  const result = await window.electron?.window?.pdfPreview?.(dataUri, fileName);
  if (result && !result.ok) {
    alert("Failed to open PDF preview: " + (result.error || "Unknown error"));
  }
}
export async function downloadStockReportPdf(stockBalance: StockBalance) {
  // set page a4
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = margin;

  let title = "";
  if (stockBalance.quantity === 0) {
    title = "Nil Stock Report";
  }
  else {
    title = "Stock Report";
  }

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, y, { align: "center" });
  y += 10;
  await generateStockReportSinglePage(stockBalance, doc, y);
  await previewPdf(doc, `StockReport_${stockBalance.party.name}_${stockBalance.item.name}_${stockBalance.lotNumber.split('|')[3]}`);

}
export async function generateStockReportSinglePage(stockBalance: StockBalance, doc: jsPDF, startY: number) {
  const margin = 12;
  let y = startY;


  // Metadata Card
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const headers = [], values = [];
  if (stockBalance.party?.name && stockBalance.party?.name !== "null") {
    headers.push("Party");
    values.push(stockBalance.party.name);
  }
  if (stockBalance.item?.name && stockBalance.item?.name !== "null") {
    headers.push("Item");
    values.push(stockBalance.item.name);
  }
  if (stockBalance.item?.category && stockBalance.item?.category !== "null") {
    headers.push("Category");
    values.push(stockBalance.item.category);
  }
  if (stockBalance.inwardDates.length) {
    headers.push("Inward Dates");
    values.push(new Date(stockBalance.inwardDates[0]).toLocaleDateString("en-GB", { timeZone: "UTC" }));
  }
  if (stockBalance.lotNumber) {
    headers.push("Lot Number");
    values.push(stockBalance.lotNumber.split('|')[3]);
  }
  if (stockBalance.isNil && stockBalance.latestEntryAt) {
    headers.push("Nil Date");
    values.push(new Date(stockBalance.latestEntryAt).toLocaleDateString("en-GB"));
  }
  if (stockBalance.unit?.name) {
    headers.push("Packaging");
    values.push(stockBalance.unit.name);
  }
  if (stockBalance.quantity !== undefined) {
    headers.push("Remaining Quanitity");
    values.push(String(stockBalance.quantity));
  }
  if (!stockBalance.chargeable) {
    headers.push("Stored");
    values.push("No");
  }
  const metadata = [];
  const breakIndex = Math.ceil(headers.length / 2);
  metadata.push(headers.slice(0, breakIndex));
  metadata.push(values.slice(0, breakIndex));
  metadata.push(Array(headers.length).fill(""));
  metadata.push(headers.slice(breakIndex));
  metadata.push(values.slice(breakIndex));

  autoTable(doc, {
    startY: y,
    body: metadata,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 0.5,
      textColor: [0, 0, 0],
      lineWidth: 0,
    },
    didParseCell: function (data: any) {
      if (data.section === "body") {
        if (data.row.index === 0 || data.row.index === 3) {
          data.cell.styles.textColor = hexToRgb("#0F172A");
        } else {
          data.cell.styles.textColor = [7, 16, 38];
          if ([0, 1, 2, 3].includes(data.column.index)) {
            data.cell.styles.fontStyle = "bold";
          }
        }

      }
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Transactions Table
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const transactions = [
    ["Date & Time", "Type", "Vehicle Number", "DO Number", "Qty", "Shortage", "Extra", "Remarks", "Balance"],
    ...stockBalance.transactions.map(t => [
      new Date(t.enteredAt).toLocaleDateString("en-GB", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase(),
      t.type,
      t.vehicleNumber || "-",
      t.doNumber || "-",
      String(t.quantity ?? "-"),
      String(t.shortage ?? "-"),
      String(t.extra ?? "-"),
      String(t.remark ?? "-"),
      String(t.balance ?? "-")
    ]),
    [
      "Total",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      stockBalance.quantity
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [transactions[0]],
    body: transactions.slice(1),
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    didParseCell: function (data: any) {
      if (data.section === "body") {
        if ([4, 5, 6, 8].includes(data.column.index)) {
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: margin, right: margin },
  });
}
export async function downloadStocksReportPdf(
  stockBalances: StockBalance[],
  partyName?: string,
  itemName?: string,
  nilStockIncluded?: string,
  storeFilter?: string,
  dateRange?: [Date | null, Date | null]
) {
  // set page a4
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = margin;

  let title = "Stock Report";
  if (nilStockIncluded === "onlyNil") {
    title = "Nil Stock Report";
  }
  else if (nilStockIncluded === "withoutNil") {
    title = "Stock Report (without Nil Stock)";
  }
  if (partyName !== "All Parties") {
    title += ` - ${partyName}`;
  }
  if (itemName !== "All Items") {
    title += ` - ${itemName}`;
  }
  if (storeFilter === "onlyStored") {
    title += " (Stored Only)";
  } else if (storeFilter === "withoutStored") {
    title += " (Unstored Only)";
  }

  if (dateRange && (dateRange[0] || dateRange[1])) {
    title += ` (${dateRange[0] ? new Date(dateRange[0]).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "Any"} - ${dateRange[1] ? new Date(dateRange[1]).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "Any"})`;
  }

  const companyProfile = await getCompanyProfileOrNull();
  const companyName = getCompanyDisplayName(companyProfile);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 6;

  // Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, y, { align: "center" });
  y += 10;
  // fetch transactions for each stock balance using parallel processing await
  const newStockBalances = await Promise.all(stockBalances.map(async (sb) => {
    const resp = await stockBalanceApi.getById(sb._id)
    sb = resp.data;
    return sb;
  }));
  for (let i = 0; i < newStockBalances.length; i++) {
    const sb = newStockBalances[i];
    if (partyName !== "All Parties") sb.party = { name: "null", _id: "null" };
    await generateStockReportSinglePage(sb, doc, y);
    if (i < newStockBalances.length - 1) {
      doc.addPage();
      y = margin;
    }
  }

  y = (doc as any).lastAutoTable.finalY + 5;
  const fileName = (partyName && partyName !== "All Parties" ? partyName.replace(/\s+/g, '_') + "_" : "") + "StockReport";

  await previewPdf(doc, fileName);
}
export async function downloadChargeReportPdf(
  charge: Charge
) {
  // set page a4
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 6;
  let y = margin;

  const companyProfile = await getCompanyProfileOrNull();
  const companyName = getCompanyDisplayName(companyProfile);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 6;

  let title = "Warehouse Charge Report";

  // Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, y, { align: "center" });
  y += 10;

  // Metadata Card
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const headers = [], values = [];
  if (charge.party?.name && charge.party?.name !== "null") {
    headers.push("Party");
    values.push(charge.party.name);
  }
  if (charge.item?.name && charge.item?.name !== "null") {
    headers.push("Item");
    values.push(charge.item.name);
  }
  if (charge.item?.category && charge.item?.category !== "null") {
    headers.push("Category");
    values.push(charge.item.category);
  }
  if (charge.lotNumber) {
    headers.push("Lot Number");
    values.push(charge.lotNumber.split('|')[3]);
  }
  if (charge.isNil && charge.latestEntryAt) {
    headers.push("Nil Date");
    values.push(new Date(charge.latestEntryAt).toLocaleDateString("en-GB"));
  }
  if (charge.unit?.name) {
    headers.push("Packaging");
    values.push(charge.unit.name);
  }
  if (charge.quantity !== undefined) {
    headers.push("Quantity");
    values.push
      (String(charge.quantity));
  }
  if ((charge.chargeRate ?? charge.unit.rate) !== undefined) {
    headers.push("Rate");
    values.push("Rs" + String(charge.chargeRate ?? charge.unit.rate));
  }
  if (charge.totalCharge !== undefined) {
    headers.push("Total Amount");
    values.push("Rs " + String(charge.totalCharge));
  }

  const metadata = [];
  const breakIndex = Math.ceil(headers.length / 2);
  metadata.push(headers.slice(0, breakIndex));
  metadata.push(values.slice(0, breakIndex));
  metadata.push(Array(headers.length).fill(""));
  metadata.push(headers.slice(breakIndex));
  metadata.push(values.slice(breakIndex));

  autoTable(doc, {
    startY: y,
    body: metadata,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 0.5,
      textColor: [0, 0, 0],
      lineWidth: 0,
      align: "center",
    },
    didParseCell: function (data: any) {
      if (data.section === "body") {
        if (data.row.index === 0 || data.row.index === 3) {
          data.cell.styles.textColor = hexToRgb("#0F172A");
        }
        else {
          data.cell.styles.textColor = [7, 16, 38];
          if ([0, 1, 2, 3].includes(data.column.index)) {
            data.cell.styles.fontStyle = "bold";
          }
        }

      }
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Transactions Table
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const transactions = [
    ["Date & Time", "Type", "Vehicle Number", "DO Number", "Qty", "Shortage", "Extra", "Remarks", "Balance", "Amount"],
    ...charge.breakdown.map(t => [
      new Date(t.date).toLocaleDateString("en-GB", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase(),
      t.type || t.label || "-",
      t.vehicleNumber || "-",
      t.doNumber || "-",
      String(t.quantity ?? "-"),
      String(t.shortage ?? "-"),
      String(t.extra ?? "-"),
      String(t.remark ?? "-"),
      String(t.balance || t.balanceAtBoundary || "-"),
      t.amount ? ("Rs " + String(t.amount)) : "-"
    ]),
    [
      "Total",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Rs " + charge.totalCharge
    ]
  ];

  let chargesRowIndexs: number[] = [];
  charge.breakdown.forEach((row, index) => {
    if (row.kind === "charge") {
      chargesRowIndexs.push(index); // -1 because of header row
    }
  });

  autoTable(doc, {
    startY: y,
    head: [transactions[0]],
    body: transactions.slice(1),
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    didParseCell: function (data: any) {
      if (data.section === "body") {
        if ([4, 5, 6, 8].includes(data.column.index)) {
          data.cell.styles.fontStyle = "bold";
        }
        //higlight charges row
        if (chargesRowIndexs.includes(data.row.index)) {
          data.cell.styles.fillColor = hexToRgb("#FEF3C7");
          data.cell.styles.textColor = hexToRgb("#92400E");
          data.cell.styles.fontStyle = "bold";
        }
        //highlight total row
        if (data.row.index === transactions.length - 2) {
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  const filename = `ChargeReport_${charge.lotNumber}`
  await previewPdf(doc, filename);

}
export async function downloadChargesReportPdf(
  charges: Charge[],
  partyName?: string,
  dateRange?: [Date | null, Date | null]
) {
  // set page a4
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = margin;


  const companyProfile = await getCompanyProfileOrNull();
  const companyName = getCompanyDisplayName(companyProfile);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 6;

  let title = "Warehouse Charge Report";
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, y, { align: "center" });
  y += 10;
  const headers = [], values = [];
  if (partyName && partyName !== "All Parties") {
    headers.push("Party");
    values.push(partyName);
  }
  if (dateRange && (dateRange[0] || dateRange[1])) {
    headers.push("Date Range");
    values.push(`${dateRange[0] ? new Date(dateRange[0]).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "Any"} - ${dateRange[1] ? new Date(dateRange[1]).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "Any"}`);
  }
  headers.push("Total Charges");
  values.push("Rs " + charges.reduce((sum, c) => sum + (c.totalCharge || 0), 0));
  const metadataTable = [
    headers,
    values
  ];


  autoTable(doc, {
    startY: y,
    body: metadataTable,
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 0.5,
      textColor: [0, 0, 0],
      lineWidth: 0,
    },
    didParseCell: function (data: any) {
      if (data.section === "body") {
        if (data.row.index === 0) {
          data.cell.styles.textColor = hexToRgb("#0F172A");
        }
        else {
          data.cell.styles.textColor = [7, 16, 38];
          if ([0, 1, 2].includes(data.column.index)) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Transactions Table
  const tableData = [
    ["Sr No", "Item", "Lot No", "From Date", "To Date", "W/H Charges"],
    ...charges.map((c, index) => [
      String(index + 1),
      c.item?.name ? c.item.name : "-",
      c.lotNumber ? c.lotNumber.split('|')[3] : "-",
      c.earliestEntryAt ? new Date(c.earliestEntryAt).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "-",
      c.latestEntryAt ? new Date(c.latestEntryAt).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "-",
      c.totalCharge !== undefined ? ("Rs " + String(c.totalCharge)) : "-"
    ]),
    [
      "Total",
      "",
      "",
      "",
      "",
      "Rs " + charges.reduce((sum, c) => sum + (c.totalCharge || 0), 0)
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [tableData[0]],
    body: tableData.slice(1),
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
      halign: "center",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    didParseCell: function (data: any) {
      if (data.section === "body") {
        if (data.column.index === 1 || data.column.index === 5) {
          data.cell.styles.fontStyle = "bold";
        }
        if (data.row.index === charges.length) {
          data.cell.styles.fontStyle = "bold";
        }
      }
    }
    ,
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  const filename = (partyName && partyName !== "All Parties" ? partyName.replace(/\s+/g, '_') + "_" : "") + "ChargeReport"
  await previewPdf(doc, filename);

}
export async function downloadGatepassPdf(gatepassData: GatepassData) {
  // A6 page in portrait
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
  const companyProfile = await getCompanyProfileOrNull();
  const companyName = getCompanyDisplayName(companyProfile);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10; // mm
  let y = margin;

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(companyName.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 7;

  // small helper to draw pill/label + value (rounded rect + text)
  function drawPillLabel(label: string, value: string, pillColor: [number, number, number], alignLeftX: number, currentY: number) {
    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(7, 16, 38);
    doc.text(label, alignLeftX, currentY);

    // Value pill: compute width from text width
    const fontSize = 12;
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "bold");
    const paddingX = 1; // mm left/right
    const paddingY = 0; // mm top/bottom
    const txt = value || "-";
    const txtWidth = doc.getTextWidth(txt) * (fontSize / doc.getFontSize()); // getTextWidth already in current font size, but safe
    const pillW = txtWidth + paddingX * 2;
    const pillH = fontSize * 0.4 + paddingY * 2;

    const pillX = alignLeftX + 30; // space after label
    const pillY = currentY - fontSize * 0.3 - paddingY / 2;

    // Fill pill
    doc.setDrawColor(0);
    doc.setFillColor(...pillColor);
    // roundedRect(x, y, w, h, rx, ry, style)
    doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, "F");

    // Text on pill
    doc.setTextColor(6, 16, 38);
    doc.text(txt, pillX + paddingX, currentY);
  }

  // Draw metadata pills (left column stacked)
  y += 2;
  drawPillLabel("Party:", (gatepassData.party?.name ?? "-"), [255, 255, 255], 2, y);
  y += 8;
  drawPillLabel("Date:", new Date(gatepassData.date).toLocaleDateString("en-GB", {
    timeZone: "UTC"
  }), [255, 255, 255], 2, y);
  y += 8;
  drawPillLabel("D.O. No.:", String(gatepassData.doNumber ?? "-"), [255, 255, 255], 2, y);
  y += 8;
  drawPillLabel("Vehicle:", (gatepassData.vehicleNumber ?? "-"), [255, 255, 255], 2, y);
  y += 4;

  // Prepare table data (compact)
  const headers = ["Material", "Lot No", "Qty", "Packaging", "Gala No.", "Bal."];
  const body = gatepassData.items.map(it => [
    it.itemName,
    it.lotNumber.split('|')[3],
    String(it.quantity ?? ""),
    it.unitName ?? "",
    it.warehouses ?? "",
    String(it.balance ?? "")
  ]);

  // AutoTable config tuned for A6 small page
  autoTable(doc, {
    startY: y,
    head: [headers],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,     // compact font size
      cellPadding: 2.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    didParseCell: function (data: any) {
      if (data.section === "body") {
        data.cell.styles.textColor = [7, 16, 38];
        if ([1, 2, 5].includes(data.column.index)) {
          data.cell.styles.fontStyle = "bold";
        }

      }
    },
    margin: { left: 2, right: 2 }
  });

  // After table, place footer line - ensure we get final Y properly
  const finalY = (doc as any).lastAutoTable?.finalY ?? (pageH - 18);
  let footerY = finalY + 10;
  if (footerY > pageH - 10) footerY = pageH - 10;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");


  drawPillLabel("Labour Name : ", "", [255, 255, 255], margin, footerY)

  // Open in new tab
  await previewPdf(doc, `gatePass_${gatepassData.doNumber}`);
}

// Helper for number to words (Indian numbering system approximation for bill)
function numberToWords(num: number): string {
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const numStr = ('000000000' + num).substr(-9);
  const n = numStr.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'crore ' : '';
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'lakh ' : '';
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'thousand ' : '';
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'hundred ' : '';
  str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
  return str.toUpperCase();
}

export async function downloadBillPdf(bill: Bill) {
  // Create A4 page in portrait
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  // 1. Fetch Company Data (Dynamic)
  const companyProfile = await getCompanyProfileOrNull();
  const companyName = getCompanyDisplayName(companyProfile);

  // 2. Fetch Party Data (Dynamic for address) if needed
  // Note: bill.party (if from create/history) might be populated. 
  // We assume bill.party contains 'address' if fully populated, but if unrelated to history fetch, it might be sparse.
  // However, for now we will check if address exists on bill.party, if not we assume it is missing or try to use what we have.
  // Ideally, valid Bills should be loaded with populate('party').

  const partyName = bill.party?.name || 'Unknown Party';
  const partyAddress = (bill.party as any)?.address || '';
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, pageW - 2 * margin, pageH - 2 * margin);

  const jurisdictionPlace = companyProfile?.jurisdiction?.trim();
  if (jurisdictionPlace) {
    const jurisdictionLine = `Subject to ${jurisdictionPlace} Jurisdiction`;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(jurisdictionLine, pageW / 2, y + 5, { align: 'center' });
    const textWidth = doc.getTextWidth(jurisdictionLine);
    doc.line(pageW / 2 - textWidth / 2, y + 6, pageW / 2 + textWidth / 2, y + 6);
    y += 10;
  }

  const headerBottomY = y + 30;
  const leftX = margin + 2;
  let textY = y + 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 150);

  if (companyProfile?.address) {
    const lines = doc.splitTextToSize(companyProfile.address, (pageW / 2) - 20);
    doc.text(lines, leftX, textY);
    textY += (lines.length * 5);
  }
  if (companyProfile?.contactNos?.length) {
    doc.text(`Mobile : ${companyProfile.contactNos.join(' / ')}`, leftX, textY + 2);
  }

  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 80);
  // @ts-ignore
  const appName = import.meta.env.VITE_APP_NAME || "WAREHOUSE CRM";
  if (companyName.toUpperCase().includes(appName)) {
    doc.text(appName.split(" ")[0], pageW - margin - 5, y + 8, { align: 'right' });
    doc.text(appName.split(" ")[0], pageW - margin - 5, y + 18, { align: 'right' });
  } else {
    doc.text(companyName, pageW - margin - 5, y + 12, { align: 'right' });
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, headerBottomY, pageW - margin, headerBottomY);
  y = headerBottomY;

  const splitX = pageW * 0.70;
  const partyColLeft = margin + 4;
  const partyColWidth = splitX - margin - 10;
  const lineHeight = 4.5;
  const topPad = 6;
  const bottomPad = 4;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const addrLines: string[] = partyAddress
    ? doc.splitTextToSize(String(partyAddress).trim(), partyColWidth)
    : [];
  const maxAddrLines = 4;
  const displayAddrLines = addrLines.slice(0, maxAddrLines);
  if (addrLines.length > maxAddrLines) {
    const last = displayAddrLines[maxAddrLines - 1];
    displayAddrLines[maxAddrLines - 1] = last.length > 3 ? last.slice(0, -3) + '...' : last + '...';
  }

  const contentLines = 2 + (displayAddrLines.length > 0 ? displayAddrLines.length : 2);
  const infoHeight = Math.max(25, topPad + contentLines * lineHeight + bottomPad);

  doc.line(splitX, y, splitX, y + infoHeight);
  doc.line(margin, y + infoHeight, pageW - margin, y + infoHeight);

  let infoY = y + topPad + 1;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const nameLines = doc.splitTextToSize('M/s.   ' + partyName, partyColWidth);
  doc.text(nameLines[0], partyColLeft, infoY);
  infoY += lineHeight;

  doc.setFont('helvetica', 'bold');
  doc.text('ADDRESS :-', partyColLeft, infoY);
  infoY += lineHeight;

  doc.setFont('helvetica', 'normal');
  if (displayAddrLines.length > 0) {
    for (const line of displayAddrLines) {
      doc.text(line, partyColLeft, infoY);
      infoY += lineHeight;
    }
  } else {
    doc.line(partyColLeft, infoY, splitX - 5, infoY);
    infoY += lineHeight;
    doc.line(partyColLeft, infoY, splitX - 5, infoY);
  }

  let billInfoY = y + topPad + 1;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 150);
  doc.text('Bill No.', splitX + 2, billInfoY);
  doc.setTextColor(0, 0, 0);
  doc.text(bill.billNumber.split('|').length === 3 ? bill.billNumber.split('|')[2] : bill.billNumber, splitX + 20, billInfoY);

  billInfoY += 10;
  doc.setTextColor(50, 50, 150);
  doc.text('Date:', splitX + 2, billInfoY);
  doc.setTextColor(0, 0, 0);
  doc.text(new Date(bill.billDate).toLocaleDateString('en-GB'), splitX + 20, billInfoY);

  y += infoHeight;

  // --- Main Table ---

  const getQuarterDates = (quarter: string, year: number) => {
    // Financial year, same as the rest of billing: Q1 Apr–Jun, Q2 Jul–Sep,
    // Q3 Oct–Dec of `year`; Q4 is Jan–Mar of the next calendar year.
    const qMap: Record<string, { startMonth: number; calendarYear: number }> = {
      Q1: { startMonth: 3, calendarYear: year },
      Q2: { startMonth: 6, calendarYear: year },
      Q3: { startMonth: 9, calendarYear: year },
      Q4: { startMonth: 0, calendarYear: year + 1 },
    };
    const spec = qMap[quarter] ?? qMap.Q1;

    const format = (date: Date) => {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${date.getFullYear()}`;
    };

    const months = [];
    for (let i = 0; i < 3; i++) {
      const m = spec.startMonth + i;
      const start = new Date(spec.calendarYear, m, 1);
      const end = new Date(spec.calendarYear, m + 1, 0);
      months.push({
        start: format(start),
        end: format(end),
        name: start.toLocaleString('en-GB', { month: 'long' })
      });
    }
    const qStart = new Date(spec.calendarYear, spec.startMonth, 1);
    const qEnd = new Date(spec.calendarYear, spec.startMonth + 3, 0);
    return { months, full: { start: format(qStart), end: format(qEnd) } };
  };

  const { months, full } = getQuarterDates(bill.quarter, bill.year);
  const bodyRows: any[] = [];

  let mainParticulars = bill.particulars;
  if (!mainParticulars) {
    mainParticulars = bill.isSplit
      ? "WAREHOUSING CHARGES\nFOR YOUR MATERIALS\nSTORED FOR APP. 2000 SQ.\nFT. ON MONTHLY RENTAL\nBASIS."
      : "WAREHOUSING CHARGES\nFOR 'EXTRA SPACE'\nPROVIDED FOR YOUR\nMATERIALS STORED FOR THE\nPERIOD.";
  }

  // Row 1: The text
  bodyRows.push([
    { content: mainParticulars, colSpan: 1, styles: { minCellHeight: 10 } },
    '', '', '', ''
  ]);

  // 2. Add Billing Rows
  if (bill.isSplit) {
    const monthlyAmount = Math.floor(bill.amount / 3);
    const remainder = bill.amount - (monthlyAmount * 3);

    months.forEach((m, i) => {
      const amt = i === 2 ? monthlyAmount + remainder : monthlyAmount;
      bodyRows.push([
        '',
        `${m.start} - ${m.end}`,
        '',
        '',
        amt.toLocaleString('en-IN')
      ]);
    });
  } else {
    // Single Row details
    bodyRows.push([
      '',
      `${full.start} TO ${full.end}`,
      '',
      '',
      bill.amount.toLocaleString('en-IN')
    ]);
  }

  // Fetch payments for this bill to get notes, receipt dates, and amounts
  let paymentsInfo: { notes: string, date: string, amount: string }[] = [];
  try {
    const { data: paymentsData } = await paymentsApi.getAll({ billId: bill._id, limit: 100 });
    const payments = (paymentsData as any).payments || [];
    payments.forEach((payment: any) => {
      let notes = 'PAYMENT RECEIVED';
      if (payment.notes && payment.notes.trim()) {
        notes = payment.notes.trim();
      } else if (payment.paymentMethod) {
        notes = payment.paymentMethod.toUpperCase().replace('_', ' ') + ' PAYMENT RECEIVED';
      }

      paymentsInfo.push({
        notes: notes,
        date: payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-GB') : '',
        amount: payment.amount ? payment.amount.toLocaleString('en-IN') : ''
      });
    });
  } catch (error) {
    console.warn('Could not fetch payments for bill PDF:', error);
  }
  // Add payment notes as separate rows with red text if exists
  if (paymentsInfo.length > 0) {
    // push empty row
    bodyRows.push([
      '', '', '', '', ''
    ]);

    paymentsInfo.forEach((payment) => {
      bodyRows.push([
        { content: payment.notes, colSpan: 1, styles: { textColor: [220, 53, 69], fontStyle: 'bold' } },
        '',
        payment.date,
        '',
        { content: payment.amount, styles: { textColor: [40, 167, 69], fontStyle: 'bold' } }
      ]);
    });
  }

  // Define table bottom explicitly
  const tableBottomY = pageH - 45;

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'PARTICULARS', styles: { halign: 'center', valign: 'middle' } },
      { content: 'BILLING DATE', styles: { halign: 'center', valign: 'middle', cellWidth: 50 } },
      { content: 'RECEIPT DATE', styles: { halign: 'center', valign: 'middle', cellWidth: 22 } },
      { content: 'BALANCE', styles: { halign: 'center', valign: 'middle', cellWidth: 22 } },
      { content: 'AMOUNT', styles: { halign: 'center', valign: 'middle', cellWidth: 22 } }
    ]],
    body: bodyRows,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 2,
      textColor: 0,
      lineWidth: 0,
      lineColor: 0,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 'center' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' }
    },
    headStyles: {
      fillColor: 255,
      textColor: [50, 50, 150],
      fontStyle: 'bold',
      lineWidth: 0.2,
      lineColor: 0
    },
    margin: { left: margin, right: margin },
  });

  // --- Drawing the Box and Vertical Lines ---
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageW - 2 * margin, tableBottomY - y);

  const table = (doc as any).lastAutoTable;
  const columns = table.columns;
  let xPos = margin;

  // Header line
  doc.line(margin, y + table.head[0].height, pageW - margin, y + table.head[0].height);

  // Draw verticals
  columns.forEach((col: any) => {
    xPos += col.width;
    if (xPos < pageW - margin - 1) {
      doc.line(xPos, y, xPos, tableBottomY);
    }
  });

  // --- Footer Section inside the Table Box ---
  const totalRowHeight = 10;
  const totalLineY = tableBottomY - totalRowHeight;
  doc.line(margin, totalLineY, pageW - margin, totalLineY);

  // AMOUNT IN WORDS inside body
  const amountWords = `Rs. ${numberToWords(Math.round(bill.amount)).trim()} ONLY`.split(/\s+/);
  const mid = amountWords.length / 2;
  const firstLine = amountWords.slice(0, mid).join(' ');
  const secondLine = amountWords.slice(mid).join(' ');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  // PUT WORDS IN 2-3 LINE
  doc.text(firstLine, margin + 5, totalLineY + 4);
  doc.text(secondLine, margin + 5, totalLineY + 8);

  // TOTAL calculation
  const colWidths = columns.map((c: any) => c.width);
  const balanceColX = margin + colWidths[0] + colWidths[1] + colWidths[2]; // Start of Balance col
  const balanceColW = colWidths[3];
  const amountColX = balanceColX + balanceColW; // Start of Amount col
  const amountColW = colWidths[4];

  // TOTAL Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const totalLabel = 'TOTAL';
  const totalLabelW = doc.getTextWidth(totalLabel);
  // Center in Balance Column or right align? Image looks roughly centered/right
  doc.text(totalLabel, balanceColX + (balanceColW - totalLabelW) / 2, tableBottomY - 3);

  // Amount Value
  const totalAmt = bill.amount.toLocaleString('en-IN');
  doc.text(totalAmt, amountColX + amountColW - 2, tableBottomY - 3, { align: 'right' });

  // --- Footer Section ---
  const footerY = tableBottomY;

  // For Title (Right side)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 150);

  doc.text(`For ${companyName.toUpperCase()}`, pageW - margin - 5, footerY + 6, { align: 'right' });

  await previewPdf(doc, `Bill_${bill.billNumber}`);
}

function formatPdfDate(date?: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB');
}

function formatPdfAmount(amount: number) {
  return amount.toFixed(2);
}

function getDisplayBillNumber(billNumber?: string) {
  if (!billNumber) return '';
  const parts = billNumber.split('|');
  return parts.length > 1 ? parts[parts.length - 1] : billNumber;
}

function getFinancialYearStartFromDate(date: string) {
  const dt = new Date(date);
  return dt.getMonth() + 1 < 4 ? dt.getFullYear() - 1 : dt.getFullYear();
}

function getQuarterFromDate(date: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  const month = new Date(date).getMonth() + 1;
  if (month >= 4 && month <= 6) return 'Q1';
  if (month >= 7 && month <= 9) return 'Q2';
  if (month >= 10 && month <= 12) return 'Q3';
  return 'Q4';
}

function getQuarterPeriodLabel(quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', financialYear: number) {
  if (quarter === 'Q1') return `APR-JUN ${financialYear}`;
  if (quarter === 'Q2') return `JUL-SEP ${financialYear}`;
  if (quarter === 'Q3') return `OCT-DEC ${financialYear}`;
  return `JAN-MAR ${financialYear + 1}`;
}

function getFinancialYearLabel(financialYear: number) {
  return `${financialYear}-${financialYear + 1}`;
}

function getPaymentModeText(item: BillingHistoryItem) {
  const ref = item.bankDetails?.accountNumber || item.paymentNumber || '';
  if (item.paymentMethod === 'bank') return ref ? `BANK ${ref}` : 'BANK';
  if (item.paymentMethod === 'cash') return 'CASH';
  return ref;
}

function getPaymentBankText(item: BillingHistoryItem) {
  const parts = [
    item.bankDetails?.bankName,
    item.bankDetails?.accountNumber ? `A/C ${item.bankDetails.accountNumber}` : undefined,
    item.notes
  ].filter(Boolean);
  return parts.join(' | ');
}

export async function downloadBillingHistoryPdf(
  party: Pick<Party, '_id' | 'name'>,
  historyItems: BillingHistoryItem[]
) {
  // Fetch all history items for the party to ensure correct brought forward and annual calculations
  let allHistoryItems: BillingHistoryItem[] = [];
  try {
    const { data } = await paymentsApi.getBillingHistory(party._id);
    allHistoryItems = Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Could not fetch all billing history items for PDF calculations:', error);
  }

  const resolvedFinancialYears = Array.from(new Set(
    historyItems
      .map(item => item.financialYear ?? item.billYear ?? getFinancialYearStartFromDate(item.date))
      .filter((year): year is number => Number.isFinite(year))
  ));

  const financialYear = resolvedFinancialYears.sort((a, b) => b - a)[0] ?? getFinancialYearStartFromDate(new Date().toISOString());

  // Filter historyItems to only include current financial year (respects user filters!)
  const yearHistoryItems = historyItems.filter(item => {
    const y = item.financialYear ?? item.billYear ?? getFinancialYearStartFromDate(item.date);
    return y === financialYear;
  });

  // Filter unfiltered history to only include current financial year (for accurate summary!)
  const unfilteredYearHistoryItems = allHistoryItems.filter(item => {
    const y = item.financialYear ?? item.billYear ?? getFinancialYearStartFromDate(item.date);
    return y === financialYear;
  });

  const quarterlyChargeTotals: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number> = {
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0
  };
  const bills = yearHistoryItems
    .filter((item) => item.type === 'bill')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const now = new Date();

  await Promise.all((['Q1', 'Q2', 'Q3', 'Q4'] as const).map(async (quarter) => {
    try {
      let startMonth = 3; // April
      let startYear = financialYear;
      if (quarter === 'Q2') {
          startMonth = 6;
      } else if (quarter === 'Q3') {
          startMonth = 9;
      } else if (quarter === 'Q4') {
          startMonth = 0;
          startYear = financialYear + 1;
      }
      const quarterStart = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0));

      if (quarterStart > now) {
          quarterlyChargeTotals[quarter] = 0;
          return;
      }

      const { data } = await chargesApi.getQuarterCharges(party._id, quarter, financialYear);
      const charges = Array.isArray(data) ? data : [];
      quarterlyChargeTotals[quarter] = charges.reduce((sum, charge) => sum + (charge.totalCharge || 0), 0);
    } catch (error) {
      console.warn(`Could not load quarter charges for ${quarter} ${financialYear}:`, error);
      quarterlyChargeTotals[quarter] = 0;
    }
  }));

  let carriedForward = 0;
  try {
    const prevBills = allHistoryItems
      .filter((item) => {
        if (item.type !== 'bill') return false;
        const y = item.financialYear ?? item.billYear ?? getFinancialYearStartFromDate(item.date);
        return y < financialYear;
      })
      .reduce((sum, item) => sum + item.amount, 0);

    const prevPayments = allHistoryItems
      .filter((item) => {
        if (item.type !== 'payment' || item.paymentFor === 'rent') return false;
        const y = item.financialYear ?? item.billYear ?? getFinancialYearStartFromDate(item.date);
        return y < financialYear;
      })
      .reduce((sum, item) => sum + item.amount, 0);

    carriedForward = prevBills - prevPayments;
  } catch (error) {
    console.warn('Could not calculate carried forward balance:', error);
  }

  const payments = yearHistoryItems
    .filter((item) => item.type === 'payment' && item.paymentFor !== 'rent')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const quarterlyDebits: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', BillingHistoryItem[]> = {
    Q1: [],
    Q2: [],
    Q3: [],
    Q4: []
  };

  unfilteredYearHistoryItems
    .filter((item) => item.type === 'payment' && item.paymentFor === 'rent')
    .forEach((item) => {
      const quarter = item.quarter || getQuarterFromDate(item.date);
      quarterlyDebits[quarter].push(item);
    });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 12;

  const companyProfile = await getCompanyProfileOrNull();
  const companyName = getCompanyDisplayName(companyProfile);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase(), pageW / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`PAYMENT DETAILS (${party.name.toUpperCase()})`, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9.5);
  doc.text(`YEAR ${getFinancialYearLabel(financialYear)}`, pageW / 2, y, { align: 'center' });
  y += 5;

  const topRowCount = Math.max(bills.length, payments.length, 1);
  const topRows = Array.from({ length: topRowCount }, (_, index) => {
    const bill = bills[index];
    const payment = payments[index];
    return [
      `${index + 1}`,
      bill ? formatPdfDate(bill.billDate || bill.date) : '',
      getDisplayBillNumber(bill?.billNumber),
      bill?.quarter ? getQuarterPeriodLabel(bill.quarter, bill.billYear || financialYear) : '',
      bill ? formatPdfAmount(bill.amount) : '',
      payment ? formatPdfDate(payment.date) : '',
      payment ? getPaymentModeText(payment) : '',
      payment ? formatPdfAmount(payment.amount) : '',
      payment ? getPaymentBankText(payment) : ''
    ];
  });

  topRows.push([
    'TOTAL',
    '',
    '',
    '',
    formatPdfAmount(bills.reduce((sum, item) => sum + item.amount, 0)),
    '',
    '',
    formatPdfAmount(payments.reduce((sum, item) => sum + item.amount, 0)),
    ''
  ]);

  autoTable(doc, {
    startY: y,
    head: [['SR.NO.', 'DATE', 'BILL NO.', 'B. PERIOD', 'AMT.', 'DATE', 'CQ / ECS', 'AMT.', 'BANK DET.']],
    body: topRows,
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: 0,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      fontSize: 7.5
    },
    bodyStyles: {
      fontSize: 7.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: 20
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 18 },
      2: { cellWidth: 18 },
      3: { cellWidth: 26 },
      4: { cellWidth: 15, halign: 'right' },
      5: { cellWidth: 18 },
      6: { cellWidth: 24 },
      7: { cellWidth: 15, halign: 'right' },
      8: { cellWidth: 34 }
    },
    didParseCell: (data: any) => {
      if (data.row.index === topRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ACTUAL WAREHOUSE CHARGES / RENT CREDITS', pageW / 2, y, { align: 'center' });
  y += 3;

  const bottomRows: string[][] = [];
  let rowIndex = 1;
  const nowForRows = new Date();

  // Add Carried Forward Balance at start of second table
  if (carriedForward !== 0) {
    bottomRows.push([
      '',
      'Brought Forward',
      'Previous Balance',
      '',
      formatPdfAmount(carriedForward),
      'Balance brought forward from previous year(s)'
    ]);
  }
  
  (['Q1', 'Q2', 'Q3', 'Q4'] as const).forEach((quarter) => {
    let startMonth = 3; // April
    let startYear = financialYear;
    if (quarter === 'Q2') {
        startMonth = 6;
    } else if (quarter === 'Q3') {
        startMonth = 9;
    } else if (quarter === 'Q4') {
        startMonth = 0;
        startYear = financialYear + 1;
    }
    const quarterStart = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0));

    if (quarterStart > nowForRows) {
        return;
    }

    bottomRows.push([
      `${rowIndex}`,
      getQuarterPeriodLabel(quarter, financialYear),
      'Warehouse Charges',
      '',
      formatPdfAmount(quarterlyChargeTotals[quarter]),
      ''
    ]);
    rowIndex++;

    const debits = quarterlyDebits[quarter].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (debits.length > 0) {
      debits.forEach((debit) => {
        bottomRows.push([
          '',
          '',
          'Rent',
          formatPdfDate(debit.date),
          `-${formatPdfAmount(debit.amount)}`,
          debit.description
        ]);
      });
    }
  });

  const currentYearCharges = Object.values(quarterlyChargeTotals).reduce((sum, amount) => sum + amount, 0);
  
  // Sum rent payments in the current year (deducted in-between)
  const currentYearRent = quarterlyDebits.Q1.concat(quarterlyDebits.Q2, quarterlyDebits.Q3, quarterlyDebits.Q4)
    .reduce((sum, item) => sum + item.amount, 0);

  const totalChargesAfterRent = currentYearCharges + carriedForward - currentYearRent;

  // Sum bill payments (non-rent payments) in the current year from unfiltered history
  const currentYearPayments = unfilteredYearHistoryItems
    .filter((item) => item.type === 'payment' && item.paymentFor !== 'rent')
    .reduce((sum, item) => sum + item.amount, 0);

  const remainingCharges = totalChargesAfterRent - currentYearPayments;

  bottomRows.push(
    ['SUBTOTAL', '', 'Net Charges (with Rent & Prev. Balance)', '', formatPdfAmount(totalChargesAfterRent), ''],
    ['LESS', '', 'Payments Made', '', `-${formatPdfAmount(currentYearPayments)}`, 'Total bill payments for current year'],
    ['TOTAL', '', 'Remaining Outstanding Balance', '', formatPdfAmount(remainingCharges), remainingCharges !== 0 ? 'Carried forward to next year' : '']
  );

  autoTable(doc, {
    startY: y,
    head: [['SR.NO.', 'PERIOD', 'ENTRY', 'DATE', 'AMOUNT', 'PARTICULARS']],
    body: bottomRows,
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: 0,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      fontSize: 7.5
    },
    bodyStyles: {
      fontSize: 7.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: 20
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 74 }
    },
    didParseCell: (data: any) => {
      const entry = bottomRows[data.row.index]?.[2];
      const isNegative = typeof data.cell.text?.[0] === 'string' && data.cell.text[0].startsWith('-');
      if (entry === 'Rent' || isNegative) {
        data.cell.styles.textColor = [200, 40, 40];
      }
      // Bold Brought Forward (first row) and summary rows (last 3 rows)
      const isBroughtForwardRow = data.row.index === 0 && carriedForward !== 0;
      if (isBroughtForwardRow || data.row.index >= bottomRows.length - 3) {
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  await previewPdf(doc, `AnnualBilling_${party.name.replace(/\s+/g, '_')}_${financialYear}-${financialYear + 1}`);
}
