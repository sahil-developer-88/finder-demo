import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface Form1099BData {
  taxYear: number;
  // Payer (Value Exchange)
  payerName: string;
  payerAddress: string;
  payerCityStateZip: string;
  payerTin: string;
  // Recipient (merchant)
  recipientName: string;
  recipientLegalName: string;
  recipientAddress: string;
  recipientCityStateZip: string;
  recipientTin: string;
  taxIdType: string;
  // Amounts
  grossBarter: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

const C = {
  black:     rgb(0,    0,    0),
  gray:      rgb(0.4,  0.4,  0.4),
  lightGray: rgb(0.85, 0.85, 0.85),
  border:    rgb(0.7,  0.7,  0.7),
  blue:      rgb(0.12, 0.25, 0.60),
  red:       rgb(0.75, 0.1,  0.1),
  white:     rgb(1,    1,    1),
};

function maskTin(tin: string): string {
  if (!tin) return '—';
  const clean = tin.replace(/\D/g, '');
  if (clean.length >= 4) return '***-**-' + clean.slice(-4);
  return tin;
}

function dollars(n: number): string {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export async function generate1099BPdf(data: Form1099BData): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();

  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const ml = 48; // margin left
  const mr = width - 48; // margin right
  let y = height - 48;

  // ── Header bar ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: ml, y: y - 36, width: mr - ml, height: 36, color: C.blue });
  page.drawText('FORM 1099-B', { x: ml + 12, y: y - 24, size: 14, font: bold, color: C.white });
  page.drawText('Proceeds From Barter Exchange Transactions', { x: ml + 120, y: y - 24, size: 10, font: regular, color: C.white });
  page.drawText(`Tax Year ${data.taxYear}`, { x: mr - 90, y: y - 24, size: 11, font: bold, color: C.white });
  y -= 50;

  // ── IRS notice ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: ml, y: y - 20, width: mr - ml, height: 20, color: C.lightGray });
  page.drawText('COPY B — FOR RECIPIENT  |  This is important tax information and is being furnished to the IRS.', {
    x: ml + 8, y: y - 14, size: 7.5, font: regular, color: C.gray,
  });
  y -= 32;

  // ── Two-column section: PAYER | RECIPIENT ─────────────────────────────────
  const colMid = ml + (mr - ml) / 2;

  // Payer box
  page.drawRectangle({ x: ml, y: y - 90, width: colMid - ml - 6, height: 90, borderColor: C.border, borderWidth: 0.5, color: C.white });
  page.drawText("PAYER'S name, address, and TIN", { x: ml + 6, y: y - 12, size: 7, font: regular, color: C.gray });
  page.drawText(data.payerName,         { x: ml + 6, y: y - 24, size: 10, font: bold,    color: C.black });
  page.drawText(data.payerAddress,      { x: ml + 6, y: y - 37, size: 8,  font: regular, color: C.black });
  page.drawText(data.payerCityStateZip, { x: ml + 6, y: y - 49, size: 8,  font: regular, color: C.black });
  page.drawText(`TIN: ${data.payerTin}`,{ x: ml + 6, y: y - 63, size: 8,  font: regular, color: C.black });

  // Recipient box
  page.drawRectangle({ x: colMid + 6, y: y - 90, width: mr - colMid - 6, height: 90, borderColor: C.border, borderWidth: 0.5, color: C.white });
  page.drawText("RECIPIENT'S name, address, and TIN", { x: colMid + 12, y: y - 12, size: 7, font: regular, color: C.gray });
  page.drawText(data.recipientLegalName || data.recipientName, { x: colMid + 12, y: y - 24, size: 10, font: bold,    color: C.black });
  if (data.recipientName !== data.recipientLegalName && data.recipientName) {
    page.drawText(`DBA: ${data.recipientName}`, { x: colMid + 12, y: y - 36, size: 8, font: regular, color: C.gray });
  }
  page.drawText(data.recipientAddress,      { x: colMid + 12, y: y - 49, size: 8, font: regular, color: C.black });
  page.drawText(data.recipientCityStateZip, { x: colMid + 12, y: y - 61, size: 8, font: regular, color: C.black });
  page.drawText(`TIN: ${maskTin(data.recipientTin)} (${data.taxIdType || 'SSN'})`, { x: colMid + 12, y: y - 73, size: 8, font: regular, color: C.black });
  y -= 104;

  // ── Box 13: Bartering ─────────────────────────────────────────────────────
  page.drawRectangle({ x: ml, y: y - 52, width: mr - ml, height: 52, borderColor: C.border, borderWidth: 0.5, color: C.white });
  page.drawText('Box 13 — Bartering', { x: ml + 8, y: y - 14, size: 8, font: bold, color: C.gray });
  page.drawText('Gross barter proceeds received during the year', { x: ml + 8, y: y - 25, size: 7.5, font: regular, color: C.gray });
  page.drawText(dollars(data.grossBarter), { x: mr - 110, y: y - 28, size: 20, font: bold, color: C.blue });
  page.drawRectangle({ x: mr - 120, y: y - 38, width: 120, height: 22, color: rgb(0.92, 0.95, 1) });
  y -= 66;

  // ── Quarterly breakdown ───────────────────────────────────────────────────
  page.drawText('Quarterly Breakdown', { x: ml, y: y - 4, size: 9, font: bold, color: C.black });
  y -= 18;

  const qw = (mr - ml) / 4;
  const quarters = [
    { label: 'Q1 (Jan–Mar)', amount: data.q1 },
    { label: 'Q2 (Apr–Jun)', amount: data.q2 },
    { label: 'Q3 (Jul–Sep)', amount: data.q3 },
    { label: 'Q4 (Oct–Dec)', amount: data.q4 },
  ];

  quarters.forEach((q, i) => {
    const qx = ml + i * qw;
    page.drawRectangle({ x: qx, y: y - 36, width: qw - 4, height: 36, borderColor: C.border, borderWidth: 0.5, color: C.white });
    page.drawText(q.label,          { x: qx + 6, y: y - 13, size: 7.5, font: regular, color: C.gray });
    page.drawText(dollars(q.amount),{ x: qx + 6, y: y - 27, size: 10,  font: bold,    color: q.amount > 0 ? C.black : C.gray });
  });
  y -= 50;

  // ── IRS reporting note ────────────────────────────────────────────────────
  page.drawRectangle({ x: ml, y: y - 44, width: mr - ml, height: 44, color: rgb(1, 0.97, 0.90), borderColor: rgb(0.9, 0.8, 0.5), borderWidth: 0.5 });
  page.drawText('IRS Reporting Requirement', { x: ml + 8, y: y - 13, size: 8, font: bold, color: rgb(0.6, 0.4, 0) });
  page.drawText('Barter exchanges are required to report ALL barter transactions on Form 1099-B (IRC §6045).', { x: ml + 8, y: y - 25, size: 7.5, font: regular, color: C.black });
  page.drawText('There is no minimum dollar threshold for barter income reporting. Include this amount on your tax return.', { x: ml + 8, y: y - 36, size: 7.5, font: regular, color: C.black });
  y -= 58;

  // ── Instructions ──────────────────────────────────────────────────────────
  page.drawText('RECIPIENT INSTRUCTIONS', { x: ml, y: y - 4, size: 9, font: bold, color: C.black });
  y -= 16;

  const instructions = [
    'Report the amount in Box 13 as ordinary income on your federal tax return.',
    'If you received these barter credits in the course of your business, report on Schedule C (Form 1040).',
    'If this is non-business barter income, report on Schedule 1 (Form 1040), Line 8.',
    'Keep this form for your records. Contact your tax advisor if you have questions.',
  ];

  instructions.forEach(line => {
    page.drawText(`•  ${line}`, { x: ml, y, size: 7.5, font: regular, color: C.black });
    y -= 13;
  });
  y -= 10;

  // ── Divider ───────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ml, y }, end: { x: mr, y }, thickness: 0.5, color: C.border });
  y -= 14;

  // ── Footer ────────────────────────────────────────────────────────────────
  page.drawText(`Generated by ${data.payerName}  •  ${data.taxYear} Tax Year  •  This document is not an official IRS form — it is a substitute statement.`, {
    x: ml, y, size: 7, font: regular, color: C.gray,
  });
  y -= 12;
  page.drawText(`Generated on ${new Date().toLocaleDateString()}`, { x: ml, y, size: 7, font: regular, color: C.gray });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function download1099BPdf(data: Form1099BData): Promise<void> {
  const url  = await generate1099BPdf(data);
  const link = document.createElement('a');
  link.href  = url;
  link.download = `1099-B_${(data.recipientLegalName || data.recipientName).replace(/\s+/g, '-')}_${data.taxYear}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
