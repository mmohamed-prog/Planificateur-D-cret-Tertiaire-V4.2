// ============================================================
// EcoVerta V4 — Moteur de calcul
// Fusion V2 (CABS absolu, CO₂, parser FR) + V3 (scoring, dépendances, phasage)
// ============================================================

// --- Réductions relatives réglementaires ---
export const REL = { 2030: 0.40, 2040: 0.50, 2050: 0.60 };

// --- CABS par usage × zone (kWh/m²/an) — valeurs absolues arrêté 2020/2022/2025 ---
export const CABS = {
  bureaux:      { H1: { 2030: 90,  2040: 80,  2050: 70  }, H2: { 2030: 80,  2040: 72,  2050: 64  }, H3: { 2030: 72,  2040: 65,  2050: 58  } },
  enseignement: { H1: { 2030: 85,  2040: 75,  2050: 66  }, H2: { 2030: 76,  2040: 68,  2050: 60  }, H3: { 2030: 68,  2040: 61,  2050: 54  } },
  commerce:     { H1: { 2030: 140, 2040: 125, 2050: 110 }, H2: { 2030: 128, 2040: 114, 2050: 101 }, H3: { 2030: 118, 2040: 105, 2050: 93  } },
  sante:        { H1: { 2030: 210, 2040: 190, 2050: 170 }, H2: { 2030: 190, 2040: 172, 2050: 155 }, H3: { 2030: 175, 2040: 158, 2050: 142 } },
  hotel:        { H1: { 2030: 170, 2040: 150, 2050: 135 }, H2: { 2030: 155, 2040: 138, 2050: 124 }, H3: { 2030: 140, 2040: 126, 2050: 113 } },
  restauration: { H1: { 2030: 380, 2040: 340, 2050: 300 }, H2: { 2030: 350, 2040: 315, 2050: 280 }, H3: { 2030: 320, 2040: 288, 2050: 260 } },
  logistique:   { H1: { 2030: 65,  2040: 58,  2050: 52  }, H2: { 2030: 58,  2040: 52,  2050: 47  }, H3: { 2030: 52,  2040: 47,  2050: 42  } },
  data:         { H1: { 2030: 600, 2040: 540, 2050: 480 }, H2: { 2030: 560, 2040: 504, 2050: 448 }, H3: { 2030: 520, 2040: 468, 2050: 416 } }
};

// --- Facteurs d'émission CO₂ par énergie (kgCO₂/kWh) ---
export const FE_DEFAULT = {
  elec:   0.053,
  gaz:    0.204,
  fioul:  0.300,
  reseau: 0.150,
  autre:  0.250,
  pac:    0.053
};

// ============================================================
// Utilitaires
// ============================================================

/** Parse un nombre saisi en français (virgule décimale, espace insécable, €) */
export function parseFrNumber(raw) {
  if (raw === null || raw === undefined) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  s = s.replace(/\u00A0/g, '').replace(/\s+/g, '').replace(/€/g, '');
  const commaCount = (s.match(/,/g) || []).length;
  const dotCount   = (s.match(/\./g) || []).length;
  if (commaCount > 0 && dotCount > 0) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (commaCount > 0) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

export function safeNum(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

export function getDefaultCabs(usage, zone, horizon) {
  return CABS[usage]?.[zone]?.[horizon] ?? null;
}

export function getEmissionFactor(heating, override) {
  // 0 saisi par erreur ne doit pas annuler tout le CO₂ du portefeuille.
  if (Number.isFinite(override) && override > 0) return override;
  return FE_DEFAULT[heating] ?? FE_DEFAULT.gaz;
}

// ============================================================
// Cible réglementaire (relative + absolue)
// ============================================================

export function computeTargets(site, globals) {
  const horizon = Number(globals.horizon || 2030);

  // Relatif
  const relativeTarget = Number.isFinite(site.cRef)
    ? site.cRef * (1 - REL[horizon])
    : NaN;

  // Absolu CABS (avec coefs)
  const cabsBase = getDefaultCabs(site.usage, site.zone, horizon);
  const absoluteTarget = cabsBase != null
    ? cabsBase * safeNum(globals.coefClimat, 1) * safeNum(globals.coefIntensite, 1)
    : NaN;

  // Cible retenue selon mode
  let selected;
  if (globals.mode === 'relative') selected = relativeTarget;
  else if (globals.mode === 'absolue') selected = absoluteTarget;
  else {
    // favorable = méthode la plus avantageuse (la plus haute)
    if (Number.isFinite(relativeTarget) && Number.isFinite(absoluteTarget))
      selected = Math.max(relativeTarget, absoluteTarget);
    else
      selected = Number.isFinite(relativeTarget) ? relativeTarget : absoluteTarget;
  }

  return { relativeTarget, absoluteTarget, selected, horizon };
}

// ============================================================
// Score de priorisation par mesure (V3)
// ============================================================

function computeMeasureScore(measure, remaining, site, prixKwh) {
  const savingsValue = remaining * measure.gain * safeNum(prixKwh, 0.18);
  const roiRatio = measure.capex > 0 ? savingsValue / measure.capex : 0;
  const impact = safeNum(measure.impact, measure.gain);
  const effort = safeNum(measure.effort, 0.5);

  let score = (roiRatio * 0.5) + (impact * 0.3) - (effort * 0.2);

  if (measure.priority === 'quick-win') score *= 1.2;
  if (measure.mandatory)               score *= 1.5;
  if (site.gtb === 'non' && measure.id === 'GTB') score *= 1.35;

  return score;
}

// ============================================================
// Calcul complet d'un site — cœur V4
// ============================================================

export function computeSiteV4(site, catalog, globals) {
  const horizon  = Number(globals.horizon || 2030);
  const prixKwh  = safeNum(globals.prixKWh, 0.18);
  const fe       = getEmissionFactor(site.heating, safeNum(globals.facteurCO2, -1));
  const surface  = safeNum(site.surface, 0);

  // Cibles
  const { relativeTarget, absoluteTarget, selected: target } = computeTargets(site, globals);
  const gap       = Number.isFinite(site.cAct) && Number.isFinite(target)
    ? Math.max(0, site.cAct - target)
    : NaN;
  const gapKwh   = Number.isFinite(gap) ? gap * surface : NaN;

  // Progression vers la cible
  const progress = (Number.isFinite(site.cRef) && Number.isFinite(target) && Number.isFinite(site.cAct))
    ? Math.min(1, Math.max(0, site.cRef - site.cAct) / Math.max(0.0001, site.cRef - target))
    : NaN;

  // Plan de mesures avec scoring + dépendances
  let remaining = safeNum(site.cAct, 0);
  const selected = [];
  const measures = [];

  const sorted = [...catalog]
    .filter(m => m.active !== false)
    .sort((a, b) =>
      computeMeasureScore(b, remaining, site, prixKwh) -
      computeMeasureScore(a, remaining, site, prixKwh)
    );

  sorted.forEach(m => {
    const deps = Array.isArray(m.dependencies) ? m.dependencies : [];
    if (deps.length && !deps.every(d => selected.includes(d))) return;

    // Score capturé avant décrément de remaining pour rester cohérent avec l'ordre réel de tri.
    const score = computeMeasureScore(m, remaining, site, prixKwh);
    const gainIntensity = remaining * m.gain;
    remaining -= gainIntensity;

    const gainKwh   = gainIntensity * surface;
    const savings   = gainKwh * prixKwh;
    const capex     = m.capex * surface;
    const co2Saved  = gainKwh * fe;          // kgCO₂/an
    const roi       = savings > 0 ? capex / savings : null;
    const phase     = roi !== null ? (roi < 3 ? 2030 : roi < 7 ? 2040 : 2050) : 2050;

    measures.push({
      id: m.id,
      label: m.label,
      category: m.category,
      priority: m.priority,
      gainRate: m.gain,
      gainIntensity,
      gainKwh,
      savings,
      capex,
      co2Saved,
      roi,
      phase,
      score
    });

    selected.push(m.id);
  });

  const totalCapex    = measures.reduce((s, m) => s + safeNum(m.capex), 0);
  const totalSavings  = measures.reduce((s, m) => s + safeNum(m.savings), 0);
  const totalCo2      = measures.reduce((s, m) => s + safeNum(m.co2Saved), 0);
  const totalGainKwh  = measures.reduce((s, m) => s + safeNum(m.gainKwh), 0);
  const globalRoi     = totalSavings > 0 ? totalCapex / totalSavings : null;

  const complianceStatus = !Number.isFinite(gap)
    ? 'inconnu'
    : gap <= 0
      ? 'conforme'
      : gap > 50
        ? 'critique'
        : 'à risque';

  return {
    // inputs
    site,
    // cibles
    target,
    relativeTarget,
    absoluteTarget,
    gap,
    gapKwh,
    progress,
    compliant: Number.isFinite(gap) ? gap <= 0 : false,
    complianceStatus,
    // plan
    measures,
    selected,
    totalCapex,
    totalSavings,
    totalCo2,
    totalGainKwh,
    globalRoi,
    // contexte
    horizon,
    fe,
    prixKwh,
    surface
  };
}
