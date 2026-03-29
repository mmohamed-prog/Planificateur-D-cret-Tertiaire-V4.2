import { safeNum } from './calculator.js';

export function createEmptySite() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    name: '',
    usage: 'bureaux',
    zone: 'H2',
    surface: NaN,
    cRef: NaN,
    cAct: NaN,
    heating: 'gaz',
    gtb: 'non',
    notes: ''
  };
}

/** Synthèse pondérée du portefeuille */
export function computePortfolio(siteResults) {
  const totalSurface    = siteResults.reduce((s, r) => s + safeNum(r.surface), 0);
  const totalGapKwh     = siteResults.reduce((s, r) => s + safeNum(r.gapKwh), 0);
  const totalCapex      = siteResults.reduce((s, r) => s + safeNum(r.totalCapex), 0);
  const totalSavings    = siteResults.reduce((s, r) => s + safeNum(r.totalSavings), 0);
  const totalCo2        = siteResults.reduce((s, r) => s + safeNum(r.totalCo2), 0);
  const compliantCount  = siteResults.filter(r => r.compliant).length;

  const weightedGap = totalSurface > 0
    ? siteResults.reduce((s, r) => s + safeNum(r.gap) * safeNum(r.surface), 0) / totalSurface
    : 0;

  const avgProgress = siteResults.length
    ? siteResults.reduce((s, r) => s + safeNum(r.progress), 0) / siteResults.length
    : 0;

  let status;
  if (!siteResults.length)          status = 'À qualifier';
  else if (compliantCount === siteResults.length) status = 'Conforme';
  else if (compliantCount > 0)      status = 'Partiellement conforme';
  else if (weightedGap > 50)        status = 'Critique';
  else                              status = 'Non conforme';

  return {
    siteCount: siteResults.length,
    totalSurface,
    totalGapKwh,
    totalCapex,
    totalSavings,
    totalCo2,
    compliantCount,
    weightedGap,
    avgProgress,
    status
  };
}

/** Score conformité portefeuille 0-100 */
export function computePortfolioScore(portfolio) {
  if (!portfolio.siteCount) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - portfolio.weightedGap * 1.2)));
}

/** Top 3 actions cross-sites (meilleur ROI par phase) */
export function getTopActions(siteResults) {
  const all = siteResults.flatMap(r =>
    r.measures.map(m => ({ ...m, siteName: r.site.name || '—' }))
  );
  return all
    .filter(m => Number.isFinite(m.roi))
    .sort((a, b) => a.phase !== b.phase ? a.phase - b.phase : a.roi - b.roi)
    .slice(0, 3);
}

/** Synthèse des mesures par phase 2030/2040/2050 */
export function getTimelineSummary(siteResults) {
  const phases = { 2030: { count: 0, capex: 0, savings: 0 }, 2040: { count: 0, capex: 0, savings: 0 }, 2050: { count: 0, capex: 0, savings: 0 } };
  siteResults.forEach(r => {
    r.measures.forEach(m => {
      if (phases[m.phase]) {
        phases[m.phase].count++;
        phases[m.phase].capex   += safeNum(m.capex);
        phases[m.phase].savings += safeNum(m.savings);
      }
    });
  });
  return phases;
}
