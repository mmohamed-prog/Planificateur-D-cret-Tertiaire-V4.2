import { APP_CONFIG } from '../config.js';
import { safeNum } from './calculator.js';

// ── Lead scoring ───────────────────────────────────────────────
export function computeLeadScore(r) {
  let s = 0;
  const gap = safeNum(r.gap);
  if (gap > 50) s += 40; else if (gap > 20) s += 22; else if (gap > 0) s += 10;
  const surf = safeNum(r.surface);
  if (surf > 5000) s += 30; else if (surf > 2000) s += 20; else if (surf > 1000) s += 10;
  const gtb = r.site?.gtb;
  if (gtb === 'non') s += 18; else if (gtb === 'partielle') s += 9;
  if (r.complianceStatus === 'critique') s += 10; else if (r.complianceStatus === 'à risque') s += 5;
  const roi = r.globalRoi;
  if (Number.isFinite(roi) && roi < 4) s += 8;
  return Math.min(100, s);
}

function urgency(score) {
  return score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
}

// ── Payload webhook ───────────────────────────────────────────
export function buildWebhookPayload({ portfolioMeta, portfolioResult, siteResults, lead }) {
  const portfolioScore = portfolioResult.siteCount
    ? Math.max(0, Math.min(100, Math.round(100 - portfolioResult.weightedGap * 1.2)))
    : 0;

  const sites = siteResults.map(r => {
    const ls = computeLeadScore(r);
    return {
      name:              r.site.name || '—',
      usage:             r.site.usage,
      zone:              r.site.zone,
      surface_m2:        safeNum(r.surface),
      heating:           r.site.heating,
      gtb:               r.site.gtb,
      current_kwh_m2:    safeNum(r.site.cAct),
      ref_kwh_m2:        safeNum(r.site.cRef),
      target_kwh_m2:     safeNum(r.target),
      relative_target:   safeNum(r.relativeTarget),
      absolute_target:   safeNum(r.absoluteTarget),
      gap_kwh_m2:        safeNum(r.gap),
      gap_kwh_year:      safeNum(r.gapKwh),
      compliance_status: r.complianceStatus,
      progress_pct:      Math.round(safeNum(r.progress) * 100),
      capex_eur:         Math.round(safeNum(r.totalCapex)),
      annual_savings_eur:Math.round(safeNum(r.totalSavings)),
      annual_co2_kg:     Math.round(safeNum(r.totalCo2)),
      global_roi_years:  r.globalRoi ? +r.globalRoi.toFixed(1) : null,
      lead_score:        ls,
      urgency:           urgency(ls),
      top_measure:       r.measures[0]?.label ?? null,
      measures:          r.measures.map(m => ({
        id:       m.id,
        label:    m.label,
        phase:    m.phase,
        roi:      m.roi ? +m.roi.toFixed(1) : null,
        capex:    Math.round(safeNum(m.capex)),
        savings:  Math.round(safeNum(m.savings)),
        co2_kg:   Math.round(safeNum(m.co2Saved))
      }))
    };
  });

  return {
    app:       APP_CONFIG.appName,
    version:   APP_CONFIG.version,
    sent_at:   new Date().toISOString(),
    lead: {
      firstname: lead.firstname || '',
      lastname:  lead.lastname  || '',
      email:     lead.email     || '',
      phone:     lead.phone     || '',
      company:   lead.company   || '',
      message:   lead.message   || ''
    },
    portfolio: {
      name:               portfolioMeta.portfolioName || '',
      horizon:            portfolioMeta.horizon,
      mode:               portfolioMeta.mode,
      zone:               portfolioMeta.zone,
      ref_year:           portfolioMeta.refYear,
      site_count:         portfolioResult.siteCount,
      total_surface_m2:   Math.round(safeNum(portfolioResult.totalSurface)),
      total_gap_kwh_year: Math.round(safeNum(portfolioResult.totalGapKwh)),
      total_capex_eur:    Math.round(portfolioResult.totalCapex),
      annual_savings_eur: Math.round(portfolioResult.totalSavings),
      annual_co2_t:       +(portfolioResult.totalCo2 / 1000).toFixed(1),
      compliant_count:    portfolioResult.compliantCount,
      status:             portfolioResult.status,
      conformity_score:   portfolioScore,
      weighted_gap:       +portfolioResult.weightedGap.toFixed(1)
    },
    sites
  };
}

// ── Envoi webhook ─────────────────────────────────────────────
export async function sendWebhook(payload, url) {
  if (!url) return { ok: false, skipped: true, reason: 'URL non configurée' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
