// ============================================================
// EcoVerta V4.1 — Export PDF amélioré
// Utilise jsPDF (chargé via CDN dans index.html)
// ============================================================

import { safeNum } from './calculator.js';

const GREEN  = [24, 180, 91];
const GREEN_DARK = [22, 109, 55];
const DARK   = [28, 33, 31];
const GRAY   = [108, 112, 109];
const LGRAY  = [240, 243, 240];
const WHITE  = [255, 255, 255];
const ORANGE = [186, 117, 23];
const RED    = [163, 45, 45];
const BLUE   = [74, 167, 220];

function statusColor(status) {
  if (status === 'Conforme' || status === 'conforme') return GREEN_DARK;
  if (status === 'Critique' || status === 'critique') return RED;
  if (status === 'à risque' || status === 'Partiellement conforme' || status === 'Non conforme') return ORANGE;
  return GRAY;
}

function scoreColor(score) {
  if (score >= 70) return GREEN_DARK;
  if (score >= 40) return ORANGE;
  return RED;
}

function formatInt(n) {
  n = safeNum(n, NaN);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('fr-FR') : '—';
}

function formatNum(n, digits = 1) {
  n = safeNum(n, NaN);
  return Number.isFinite(n) ? n.toFixed(digits).replace('.', ',') : '—';
}

function formatEur(n) {
  n = safeNum(n, NaN);
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return 'Gratuit';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M€';
  if (n >= 1e3) return Math.round(n / 1e3) + ' k€';
  return Math.round(n) + ' €';
}

function truncate(text, max = 26) {
  const str = String(text || '').trim();
  if (!str) return '—';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function siteName(name, idx) {
  const n = String(name || '').trim();
  return n || `Site ${idx + 1}`;
}

function sectionTitle(doc, text, y, ml, mr, color = GREEN_DARK) {
  doc.setTextColor(...color);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(text, ml, y - 1);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(ml, y + 1.5, mr, y + 1.5);
}

function boxKpi(doc, x, y, w, h, label, value, opts = {}) {
  const fill = opts.fill || LGRAY;
  const dark = !!opts.dark;
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');

  doc.setTextColor(...(dark ? WHITE : GRAY));
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + 3, y + 4.5);

  doc.setTextColor(...(opts.valueColor || (dark ? WHITE : DARK)));
  doc.setFontSize(opts.valueSize || 12);
  doc.setFont('helvetica', 'bold');
  doc.text(String(value), x + 3, y + 10.5);
}

function addWrappedText(doc, text, x, y, width, lineHeight = 4.2) {
  const lines = doc.splitTextToSize(String(text || ''), width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function generatePdf({ portfolioMeta, portfolioResult, siteResults, topActions, timelineSummary, lead }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const W = 210, H = 297;
  const ML = 14, MR = 196, TW = MR - ML;
  let y = 0;

  const conformityScore = portfolioResult.siteCount
    ? Math.max(0, Math.min(100, Math.round(100 - safeNum(portfolioResult.weightedGap) * 1.2)))
    : 0;

  // Header
  doc.setFillColor(19, 30, 34);
  doc.rect(0, 0, W, 30, 'F');

  doc.setFillColor(...GREEN);
  doc.roundedRect(ML, 8, 56, 6, 2, 2, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('EcoVerta — Rapport Décret Tertiaire', ML + 3, 12);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(truncate(portfolioMeta.portfolioName || 'Portefeuille tertiaire EcoVerta', 48), ML, 22);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(`Horizon ${portfolioMeta.horizon} · Généré le ${dateStr}`, MR, 12, { align: 'right' });

  const leadLine = [lead.firstname, lead.lastname].filter(Boolean).join(' ') || 'Contact non renseigné';
  const companyLine = lead.company || 'Organisation non renseignée';
  const emailLine = lead.email || 'Email non renseigné';
  doc.text(truncate(leadLine, 36), MR, 18, { align: 'right' });
  doc.text(truncate(companyLine, 36), MR, 22, { align: 'right' });
  doc.text(truncate(emailLine, 36), MR, 26, { align: 'right' });

  y = 36;

  // KPI row 1 & 2
  const kpiW = (TW - 6) / 4;
  boxKpi(doc, ML + 0 * (kpiW + 2), y, kpiW, 14, 'Sites analysés', String(portfolioResult.siteCount));
  boxKpi(doc, ML + 1 * (kpiW + 2), y, kpiW, 14, 'Surface totale', `${formatInt(portfolioResult.totalSurface)} m²`);
  boxKpi(doc, ML + 2 * (kpiW + 2), y, kpiW, 14, 'Gap pondéré', `${formatNum(portfolioResult.weightedGap)} kWh/m²`);
  boxKpi(doc, ML + 3 * (kpiW + 2), y, kpiW, 14, 'Score conformité', `${conformityScore} / 100`, {
    fill: [22, 42, 34], dark: true, valueColor: scoreColor(conformityScore)
  });
  y += 17;

  boxKpi(doc, ML + 0 * (kpiW + 2), y, kpiW, 14, 'CAPEX total', formatEur(portfolioResult.totalCapex));
  boxKpi(doc, ML + 1 * (kpiW + 2), y, kpiW, 14, 'Économies / an', formatEur(portfolioResult.totalSavings));
  boxKpi(doc, ML + 2 * (kpiW + 2), y, kpiW, 14, 'Statut portefeuille', portfolioResult.status || '—', {
    valueColor: statusColor(portfolioResult.status)
  });
  boxKpi(doc, ML + 3 * (kpiW + 2), y, kpiW, 14, 'Sites conformes', `${portfolioResult.compliantCount} / ${portfolioResult.siteCount}`);
  y += 20;

  // Top actions
  sectionTitle(doc, 'Top 3 actions recommandées', y, ML, MR, GREEN_DARK);
  y += 6;
  if (topActions && topActions.length) {
    topActions.slice(0, 3).forEach((a, i) => {
      doc.setFillColor(250, 252, 250);
      doc.roundedRect(ML, y, TW, 12, 2, 2, 'F');
      doc.setFillColor(...GREEN);
      doc.circle(ML + 4, y + 4.2, 2.3, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1), ML + 4, y + 5.1, { align: 'center' });

      doc.setTextColor(...DARK);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(truncate(a.label, 48), ML + 9, y + 4.5);

      const info = [
        `Site : ${siteName(a.siteName, i)}`,
        `Phase ${a.phase}`,
        Number.isFinite(a.roi) ? `ROI ${formatNum(a.roi, 1)} ans` : 'ROI n.c.',
        Number.isFinite(a.capex) ? `CAPEX ${formatEur(a.capex)}` : '',
        Number.isFinite(a.savings) ? `Économies ${formatEur(a.savings)}/an` : ''
      ].filter(Boolean).join('  ·  ');
      doc.setTextColor(...GRAY);
      doc.setFontSize(7.3);
      doc.setFont('helvetica', 'normal');
      doc.text(truncate(info, 108), ML + 9, y + 9.2);
      y += 14;
    });
  } else {
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.text('Aucune action calculée.', ML, y + 4);
    y += 8;
  }

  // Timeline
  sectionTitle(doc, 'Plan d’actions par phase', y, ML, MR, GREEN_DARK);
  y += 6;
  const phases = [2030, 2040, 2050];
  const phW = (TW - 4) / 3;
  phases.forEach((ph, i) => {
    const data = timelineSummary?.[ph] || { count: 0, capex: 0, savings: 0 };
    const px = ML + i * (phW + 2);
    doc.setFillColor(...LGRAY);
    doc.roundedRect(px, y, phW, 17, 2, 2, 'F');
    doc.setFillColor(...BLUE);
    doc.roundedRect(px, y, phW, 5, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Horizon ${ph}`, px + phW / 2, y + 3.5, { align: 'center' });
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(`${data.count} mesure(s)`, px + 3, y + 9);
    doc.text(`CAPEX ${formatEur(data.capex)}`, px + 3, y + 12.5);
    doc.text(`Économies ${formatEur(data.savings)}/an`, px + 3, y + 16);
  });
  y += 22;

  // Table header
  sectionTitle(doc, 'Détail par site', y, ML, MR, GREEN_DARK);
  y += 6;
  const cols = [
    { label: 'Site', w: 34 },
    { label: 'Usage', w: 22 },
    { label: 'Surface', w: 18 },
    { label: 'Conso act.', w: 18 },
    { label: 'Cible', w: 18 },
    { label: 'Gap', w: 14 },
    { label: 'Statut', w: 24 },
    { label: 'CAPEX', w: 20 }
  ];

  doc.setFillColor(...GREEN_DARK);
  doc.rect(ML, y, TW, 6, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let cx = ML + 2;
  cols.forEach(c => { doc.text(c.label, cx, y + 4.1); cx += c.w; });
  y += 6;

  siteResults.forEach((r, idx) => {
    const rowH = 7;
    if (y > H - 24) {
      doc.addPage();
      y = 14;
      doc.setFillColor(...GREEN_DARK);
      doc.rect(ML, y, TW, 6, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      let hx = ML + 2;
      cols.forEach(c => { doc.text(c.label, hx, y + 4.1); hx += c.w; });
      y += 6;
    }
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 249);
      doc.rect(ML, y, TW, rowH, 'F');
    }
    const vals = [
      siteName(r.site?.name, idx),
      r.site?.usage || '—',
      `${formatInt(r.surface)} m²`,
      Number.isFinite(r.site?.cAct) ? formatNum(r.site.cAct, 0) : '—',
      Number.isFinite(r.target) ? formatNum(r.target, 0) : '—',
      Number.isFinite(r.gap) ? formatNum(r.gap, 0) : '—',
      r.complianceStatus || '—',
      formatEur(r.totalCapex)
    ];
    cx = ML + 2;
    vals.forEach((v, vi) => {
      if (vi === 6) {
        doc.setTextColor(...statusColor(r.complianceStatus));
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(...DARK);
        doc.setFont('helvetica', 'normal');
      }
      doc.setFontSize(7);
      doc.text(truncate(String(v), vi === 0 ? 20 : 18), cx, y + 4.6);
      cx += cols[vi].w;
    });
    y += rowH;
  });

  y += 6;

  // Carbon + note
  doc.setFillColor(232, 246, 238);
  doc.roundedRect(ML, y, TW, 10, 2, 2, 'F');
  doc.setTextColor(...GREEN_DARK);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bilan carbone estimé : ${(safeNum(portfolioResult.totalCo2) / 1000).toFixed(1).replace('.', ',')} tCO2/an évitées sur le portefeuille`, ML + 3, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.setFontSize(7);
  doc.text('Document généré automatiquement à partir des hypothèses saisies. Livrable indicatif, non contractuel.', ML + 3, y + 8);
  y += 15;

  // Footer
  doc.setDrawColor(...LGRAY);
  doc.line(ML, H - 12, MR, H - 12);
  doc.setTextColor(...GRAY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('EcoVerta — contact@ecovertaconsult.com · www.ecovertaconsult.com', ML, H - 7);
  doc.text('Document généré automatiquement — non contractuel', MR, H - 7, { align: 'right' });

  const fileName = `EcoVerta-rapport-${String(portfolioMeta.portfolioName || 'portefeuille').replace(/[\\/:*?"<>|]+/g, '-').trim()}-${portfolioMeta.horizon}.pdf`;
  doc.save(fileName);
}
