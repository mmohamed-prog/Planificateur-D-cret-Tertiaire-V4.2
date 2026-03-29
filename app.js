import { APP_CONFIG } from './config.js';
import { cloneCatalog } from './data/measures-catalog.js';
import { parseFrNumber, computeSiteV4, safeNum } from './services/calculator.js';
import { createEmptySite, computePortfolio, computePortfolioScore, getTopActions, getTimelineSummary } from './services/multi-site.js';
import { buildWebhookPayload, sendWebhook, computeLeadScore } from './services/webhook.js';
import { generatePdf } from './services/pdf.js';

// ── État ──────────────────────────────────────────────────────
let catalog  = cloneCatalog();
let sites    = [createEmptySite()];
let results  = [];
let portfolio = {}, portfolioScore = 0, topActions = [], timelineSummary = {};

const globals = {
  horizon: 2030, mode: 'favorable', zone: 'H2',
  coefClimat: 1, coefIntensite: 1, prixKWh: 0.18, facteurCO2: -1, refYear: 2021
};

const STEPS = [
  { name: 'Paramètres globaux' },
  { name: 'Sites du portefeuille' },
  { name: 'Catalogue des mesures' },
  { name: 'Résultats & export' }
];
let currentStep = 0;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindHero();
  bindWizardNav();
  bindChips();
  bindGlobalsInputs();
  bindSitesStep();
  bindResults();
  bindFaq();
  goToStep(0);
});

// ── Hero ──────────────────────────────────────────────────────
function bindHero() {
  ['open-wizard','open-wizard-2'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => openWizard());
  });
  document.getElementById('close-wizard')?.addEventListener('click', closeWizard);
  document.getElementById('modal-wizard')?.addEventListener('click', e => {
    if (e.target.id === 'modal-wizard') closeWizard();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeWizard();
  });
}

function openWizard() {
  document.getElementById('modal-wizard').classList.add('open');
  document.body.style.overflow = 'hidden';
  goToStep(0);
}
function closeWizard() {
  document.getElementById('modal-wizard').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Navigation wizard ─────────────────────────────────────────

function validateStepBeforeNext(step) {
  if (step === 1) {
    if (!sites.length) {
      showToast('Ajoutez au moins un site avant de calculer.', 'err');
      return false;
    }

    const invalid = sites.find(s =>
      !Number.isFinite(safeNum(s.surface, NaN)) || safeNum(s.surface, NaN) <= 0 ||
      !Number.isFinite(safeNum(s.cRef, NaN))    || safeNum(s.cRef, NaN) <= 0 ||
      !Number.isFinite(safeNum(s.cAct, NaN))    || safeNum(s.cAct, NaN) <= 0
    );

    if (invalid) {
      showToast(`Le site "${invalid.name || 'sans nom'}" est incomplet : surface, conso. référence et conso. actuelle sont obligatoires.`, 'err');
      return false;
    }
  }
  return true;
}

function bindWizardNav() {
  document.getElementById('nextBtn')?.addEventListener('click', () => {
    if (currentStep < STEPS.length - 1) {
      if (!validateStepBeforeNext(currentStep)) return;
      goToStep(currentStep + 1);
    }
  });
  document.getElementById('prevBtn')?.addEventListener('click', () => {
    if (currentStep > 0) goToStep(currentStep - 1);
  });
}

function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`sp${n}`)?.classList.add('active');
  currentStep = n;

  const pct = Math.round((n / (STEPS.length - 1)) * 100);
  document.getElementById('pFill').style.width = pct + '%';
  document.getElementById('pTxt').textContent  = `Étape ${n + 1} / ${STEPS.length}`;
  document.getElementById('sNum').textContent  = n + 1;
  document.getElementById('sName').textContent = STEPS[n].name;

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  prevBtn.style.display = n === 0 ? 'none' : '';
  if (n === STEPS.length - 1) {
    nextBtn.style.display = 'none';
  } else {
    nextBtn.style.display = '';
    nextBtn.textContent = n === STEPS.length - 2 ? 'Calculer →' : 'Suivant →';
  }

  if (n === 1 && !document.getElementById('sites-container').children.length) {
    renderSites();
  }
  if (n === 2) renderCatalogEditor();
  if (n === 3) compute();
}

// ── Chips ─────────────────────────────────────────────────────
function bindChips() {
  ['c-horizon','c-mode','c-zone'].forEach(groupId => {
    document.getElementById(groupId)?.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.getElementById(groupId).querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        chip.classList.add('on');
        const v = chip.dataset.v;
        if (groupId === 'c-horizon')  globals.horizon = Number(v);
        if (groupId === 'c-mode')     globals.mode    = v;
        if (groupId === 'c-zone')     globals.zone    = v;
      });
    });
  });
}

// ── Globals inputs ────────────────────────────────────────────
function bindGlobalsInputs() {
  ['prixKWh','coefClimat','coefIntensite','facteurCO2'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', e => {
      const parsed = parseFrNumber(e.target.value);
      if (Number.isFinite(parsed)) globals[id] = parsed;
      else e.target.value = String(globals[id]).replace('.', ',');
    });
  });
}

// ── Sites ─────────────────────────────────────────────────────
function bindSitesStep() {
  document.getElementById('btn-add-site')?.addEventListener('click', () => {
    sites.push(createEmptySite());
    renderSites();
  });
}

function renderSites() {
  const container = document.getElementById('sites-container');
  container.innerHTML = '';
  sites.forEach((site, i) => container.appendChild(buildSiteCard(site, i)));
}

function buildSiteCard(site) {
  const card = document.createElement('div');
  card.className = 'site-card';

  const usages   = ['bureaux','enseignement','commerce','sante','hotel','restauration','logistique','data'];
  const zones    = ['H1','H2','H3'];
  const heatings = ['elec','gaz','fioul','reseau','autre','pac'];
  const gtbs     = ['non','partielle','oui'];

  card.innerHTML = `
    <div class="site-header">
      <input class="site-name-input" type="text" placeholder="Nom du site" value="${site.name || ''}">
      <button class="btn-remove-site" title="Supprimer">✕</button>
    </div>
    <div class="site-fields">
      <div class="ifield">
        <label>Usage</label>
        <select data-f="usage">${usages.map(u=>`<option value="${u}"${site.usage===u?' selected':''}>${ucfirst(u)}</option>`).join('')}</select>
      </div>
      <div class="ifield">
        <label>Zone climatique</label>
        <select data-f="zone">${zones.map(z=>`<option value="${z}"${site.zone===z?' selected':''}>${z}</option>`).join('')}</select>
      </div>
      <div class="ifield">
        <label>Surface (m²)</label>
        <input type="text" data-f="surface" value="${fmt(site.surface)}" placeholder="ex. 2500">
      </div>
      <div class="ifield">
        <label>Conso. référence (kWh/m²/an)</label>
        <input type="text" data-f="cRef" value="${fmt(site.cRef)}" placeholder="ex. 180">
      </div>
      <div class="ifield">
        <label>Conso. actuelle (kWh/m²/an)</label>
        <input type="text" data-f="cAct" value="${fmt(site.cAct)}" placeholder="ex. 165">
      </div>
      <div class="ifield">
        <label>Énergie principale</label>
        <select data-f="heating">${heatings.map(h=>`<option value="${h}"${site.heating===h?' selected':''}>${h}</option>`).join('')}</select>
      </div>
      <div class="ifield">
        <label>GTB existante ?</label>
        <select data-f="gtb">${gtbs.map(g=>`<option value="${g}"${site.gtb===g?' selected':''}>${ucfirst(g)}</option>`).join('')}</select>
      </div>
      <div class="ifield field-full">
        <label>Notes <span class="q-opt">optionnel</span></label>
        <input type="text" data-f="notes" value="${site.notes || ''}" placeholder="Contraintes, contexte…">
      </div>
    </div>
    <div class="site-result-band" id="sres-${site.id}"></div>
  `;

  card.querySelector('.site-name-input').addEventListener('input', e => { site.name = e.target.value; });
  card.querySelector('.btn-remove-site').addEventListener('click', () => {
    if (sites.length > 1) { sites = sites.filter(s => s.id !== site.id); renderSites(); }
  });
  card.querySelectorAll('[data-f]').forEach(el => {
    el.addEventListener('change', () => {
      const f = el.dataset.f;
      site[f] = ['surface','cRef','cAct'].includes(f) ? parseFrNumber(el.value) : el.value;
    });
  });

  return card;
}

// ── Catalogue éditeur ─────────────────────────────────────────
function renderCatalogEditor() {
  const container = document.getElementById('catalog-editor');
  if (!container) return;
  container.innerHTML = '';

  catalog.forEach(m => {
    const row = document.createElement('div');
    row.className = 'catalog-item';
    row.innerHTML = `
      <div class="catalog-item-top">
        <label class="catalog-toggle">
          <input type="checkbox" ${m.active !== false ? 'checked' : ''} data-cid="${m.id}">
          <span class="catalog-name ${m.active === false ? 'dimmed' : ''}" id="cname-${m.id}">${m.label}</span>
          <span class="catalog-priority priority-${m.priority}">${m.priority}</span>
        </label>
      </div>
      <div class="catalog-item-fields ${m.active === false ? 'hidden' : ''}" id="cfields-${m.id}">
        <div class="ifield" style="margin-bottom:0">
          <label>Gain <span class="q-opt">%</span></label>
          <input type="text" value="${(m.gain * 100).toFixed(0)}" data-cgain="${m.id}" style="text-align:right">
        </div>
        <div class="ifield" style="margin-bottom:0">
          <label>CAPEX <span class="q-opt">€/m²</span></label>
          <input type="text" value="${m.capex}" data-ccapex="${m.id}" style="text-align:right">
        </div>
        ${m.dependencies?.length ? `<div class="catalog-dep">Dépend de : ${m.dependencies.join(', ')}</div>` : ''}
      </div>
    `;

    // Toggle actif
    row.querySelector(`input[data-cid]`).addEventListener('change', e => {
      m.active = e.target.checked;
      const fields = document.getElementById(`cfields-${m.id}`);
      const name   = document.getElementById(`cname-${m.id}`);
      fields?.classList.toggle('hidden', !m.active);
      name?.classList.toggle('dimmed', !m.active);
    });

    // Gain
    row.querySelector(`input[data-cgain]`)?.addEventListener('change', e => {
      const v = parseFrNumber(e.target.value);
      if (Number.isFinite(v) && v > 0 && v <= 100) m.gain = v / 100;
      else e.target.value = (m.gain * 100).toFixed(0);
    });

    // CAPEX
    row.querySelector(`input[data-ccapex]`)?.addEventListener('change', e => {
      const v = parseFrNumber(e.target.value);
      if (Number.isFinite(v) && v >= 0) m.capex = v;
      else e.target.value = m.capex;
    });

    container.appendChild(row);
  });
}
function compute() {
  results      = sites.map(s => computeSiteV4(s, catalog, globals));
  portfolio    = computePortfolio(results);
  portfolioScore = computePortfolioScore(portfolio);
  topActions   = getTopActions(results);
  timelineSummary = getTimelineSummary(results);

  renderSiteResults();
  renderPortfolioScores();
  renderPortfolioDetail();
  renderTopActions();
  renderTimeline();
  renderCo2();
}

function renderSiteResults() {
  results.forEach(r => {
    const el = document.getElementById(`sres-${r.site.id}`);
    if (!el) return;
    if (!Number.isFinite(r.gap)) { el.innerHTML = ''; return; }

    const cls = r.complianceStatus === 'conforme' ? 'rpill-ok'
      : r.complianceStatus === 'critique' ? 'rpill-crit' : 'rpill-warn';

    el.innerHTML = `
      <div class="result-pills">
        <span class="rpill ${cls}">${r.complianceStatus}</span>
        <span class="rpill">Cible ${fmtN(r.target)} kWh/m²</span>
        <span class="rpill">Gap ${fmtN(r.gap)} kWh/m²</span>
        <span class="rpill">CAPEX ${fmtEur(r.totalCapex)}</span>
        <span class="rpill">ROI ${r.globalRoi ? r.globalRoi.toFixed(1)+' ans' : '—'}</span>
        <span class="rpill" style="color:var(--brand2)">Lead ${computeLeadScore(r)}/100</span>
      </div>
      <div class="prog-site"><div class="prog-site-fill" style="width:${Math.round(safeNum(r.progress)*100)}%"></div></div>
      <div class="prog-site-label">${Math.round(safeNum(r.progress)*100)}% vers la cible</div>
      ${r.measures.length ? `<div class="measures-mini">${r.measures.slice(0,5).map(m=>`
        <div class="measure-mini-row">
          <span class="measure-mini-name">${m.label}</span>
          <span class="measure-mini-phase ph-${m.phase}">Ph.${m.phase}</span>
          <span class="measure-mini-num">-${(m.gainRate*100).toFixed(0)}% · ${m.roi ? 'ROI '+m.roi.toFixed(1)+'ans' : '—'} · ${fmtEur(m.capex)}</span>
        </div>`).join('')}</div>` : ''}
    `;
  });
}

// ── Résultats portefeuille ────────────────────────────────────
function renderPortfolioScores() {
  const el = document.getElementById('portfolio-scores');
  if (!el || !results.length) return;

  const co2T  = (safeNum(portfolio.totalCo2)/1000).toFixed(1);
  const score = portfolioScore;
  const roiG  = portfolio.totalSavings > 0
    ? (portfolio.totalCapex / portfolio.totalSavings).toFixed(1)
    : null;

  el.innerHTML = [
    { label:'Score conformité', val:score, max:100, color:'#18b45b', tag: tagLabel(score) },
    { label:'Économies / an', val: Math.round(portfolio.totalSavings/1000), unit:'k€', noRing:true },
    { label:'CO₂ évité', val: co2T, unit:'tCO₂/an', noRing:true }
  ].map((c,i) => {
    if (c.noRing) return `
      <div class="score-card">
        <div class="score-card-label">${c.label}</div>
        <div style="font-size:28px;font-weight:900;color:#fff;margin:14px 0 10px">${c.val}<span style="font-size:14px;font-weight:600;color:rgba(255,255,255,.5)"> ${c.unit}</span></div>
        <div class="score-tag ${i===1?'tag-green':'tag-amber'}">${i===1 ? fmtEur(portfolio.totalSavings)+'/an' : co2T+' tCO₂/an'}</div>
      </div>`;
    const circ = 2 * Math.PI * 28;
    const off  = circ * (1 - score/100);
    return `
      <div class="score-card">
        <div class="score-card-label">${c.label}</div>
        <div class="score-ring">
          <svg width="68" height="68" viewBox="0 0 68 68">
            <circle class="score-ring-bg" cx="34" cy="34" r="28"/>
            <circle class="score-ring-fill" cx="34" cy="34" r="28" stroke="${c.color}"
              stroke-dasharray="${circ}" stroke-dashoffset="${off}"/>
          </svg>
          <div class="score-ring-val" style="color:${c.color}">${score}</div>
        </div>
        <div class="score-tag ${tagClass(score)}">${c.tag}</div>
      </div>`;
  }).join('');
}

function renderPortfolioDetail() {
  const el = document.getElementById('portfolio-detail');
  if (!el || !results.length) return;
  el.innerHTML = `
    <h4>Synthèse portefeuille</h4>
    ${row('Sites analysés', `${portfolio.siteCount} site(s)`)}
    ${row('Surface totale', `${Math.round(safeNum(portfolio.totalSurface)).toLocaleString('fr-FR')} m²`)}
    ${row('Gap pondéré', `${safeNum(portfolio.weightedGap).toFixed(1)} kWh/m²`)}
    ${row('Sites conformes', `${portfolio.compliantCount} / ${portfolio.siteCount}`)}
    ${row('CAPEX total estimé', fmtEur(portfolio.totalCapex))}
    ${row('Économies annuelles', fmtEur(portfolio.totalSavings))}
    ${row('Statut global', portfolio.status)}
  `;
}

function renderTopActions() {
  const el = document.getElementById('top-actions-box');
  if (!el) return;
  el.innerHTML = '<h4>Top 3 actions recommandées</h4>';
  if (!topActions.length) { el.innerHTML += '<p style="font-size:12px;color:rgba(255,255,255,.4)">—</p>'; return; }
  el.innerHTML += topActions.map((a,i) => `
    <div class="top-action-item">
      <div class="rank-circle">${i+1}</div>
      <div class="top-action-info">
        <strong>${a.label}</strong>
        <span>${a.siteName ? 'Site : '+a.siteName+' · ' : ''}Phase ${a.phase} · ROI ${a.roi ? a.roi.toFixed(1)+' ans' : '—'} · CAPEX ${fmtEur(a.capex)} · ${fmtEur(a.savings)}/an</span>
      </div>
    </div>`).join('');
}

function renderTimeline() {
  const el = document.getElementById('timeline-box');
  if (!el) return;
  el.innerHTML = `<h4>Plan d'actions par phase</h4>
  <div class="timeline-phases">
    ${[2030,2040,2050].map(ph => {
      const d = timelineSummary[ph] || {};
      return `<div class="timeline-phase">
        <div class="ph-head ph-head-${ph}">Horizon ${ph}</div>
        <div class="ph-body">
          <span>${d.count||0} action(s)</span>
          <span>CAPEX ${fmtEur(d.capex||0)}</span>
          <span>→ ${fmtEur(d.savings||0)}/an</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderCo2() {
  const el = document.getElementById('co2-box');
  if (!el || !portfolio.siteCount) return;
  const co2T = (safeNum(portfolio.totalCo2)/1000).toFixed(1);
  el.style.display = 'block';
  el.innerHTML = `<h4>Bilan carbone estimé</h4>
    ${row('CO₂ évité / an', co2T+' tCO₂')}
    ${row('Énergie économisée', Math.round(safeNum(portfolio.totalGapKwh||0)/1000)+' MWh/an')}
  `;
}

// ── Gate PDF & Webhook ────────────────────────────────────────
function bindResults() {
  document.getElementById('btn-pdf-gate')?.addEventListener('click', validateAndExportPdf);
}

function validateAndExportPdf() {
  const fn = v('g-prenom'), ln = v('g-nom'), em = v('g-email');
  const consent = document.getElementById('g-rgpd')?.checked;
  let ok = true;

  clearErr(['err-g-prenom','err-g-nom','err-g-email','err-g-rgpd']);

  if (!fn) { showErr('err-g-prenom'); ok = false; }
  if (!ln) { showErr('err-g-nom'); ok = false; }
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { showErr('err-g-email'); ok = false; }
  if (!consent) { showErr('err-g-rgpd'); ok = false; }
  if (!ok) return;

  if (!results.length) { compute(); }
  if (typeof window.jspdf === 'undefined') return showToast('jsPDF non chargé', 'err');

  const lead = {
    firstname: fn, lastname: ln, email: em,
    company: v('g-societe'), phone: v('g-telephone'), message: ''
  };
  const meta = getPortfolioMeta();
  const payload = buildWebhookPayload({ portfolioMeta: meta, portfolioResult: portfolio, siteResults: results, lead });
  generatePdf({ portfolioMeta: meta, portfolioResult: portfolio, siteResults: results, topActions, timelineSummary, lead, payload });

  // Envoi auto webhook si configuré dans config.js
  const url = APP_CONFIG.defaultWebhookUrl;
  if (url) {
    // Formspree attend un objet plat avec email en champ racine
    const formspreePayload = {
      email:             lead.email,
      prenom:            lead.firstname,
      nom:               lead.lastname,
      societe:           lead.company || '',
      telephone:         lead.phone || '',
      portefeuille:      meta.portfolioName,
      horizon:           meta.horizon,
      nb_sites:          portfolio.siteCount,
      surface_m2:        Math.round(safeNum(portfolio.totalSurface)),
      gap_moyen:         safeNum(portfolio.weightedGap).toFixed(1),
      score_conformite:  portfolioScore,
      statut:            portfolio.status,
      capex_eur:         Math.round(portfolio.totalCapex),
      economies_eur_an:  Math.round(portfolio.totalSavings),
      co2_t_an:          +(portfolio.totalCo2/1000).toFixed(1),
      top_action_1:      topActions[0]?.label || '',
      top_action_2:      topActions[1]?.label || '',
      top_action_3:      topActions[2]?.label || '',
      _subject:          `[EcoVerta DT] ${lead.firstname} ${lead.lastname} — ${portfolio.siteCount} site(s) · score ${portfolioScore}/100`
    };
    sendWebhook(formspreePayload, url);
  }

  showToast('PDF téléchargé ✓', 'ok');
}

// ── FAQ ───────────────────────────────────────────────────────
function bindFaq() {
  document.querySelectorAll('.faq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-icon').textContent = '+';
      });
      if (!wasOpen) {
        item.classList.add('open');
        item.querySelector('.faq-icon').textContent = '×';
      }
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────
function getPortfolioMeta() {
  return {
    portfolioName: document.getElementById('portfolioName')?.value?.trim() || APP_CONFIG.defaultPortfolioName,
    horizon: globals.horizon, mode: globals.mode, zone: globals.zone, refYear: globals.refYear
  };
}

function v(id) { return (document.getElementById(id)?.value||'').trim(); }
function fmt(n) { return Number.isFinite(n) ? String(n) : ''; }
function fmtN(n){ return Number.isFinite(n) ? n.toFixed(1) : '—'; }
function fmtEur(n) {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return 'Gratuit';
  if (n >= 1e6) return (n/1e6).toFixed(1)+' M€';
  if (n >= 1e3) return Math.round(n/1e3)+' k€';
  return Math.round(n)+' €';
}
function ucfirst(s){ return s ? s[0].toUpperCase()+s.slice(1) : ''; }
function row(k,v){ return `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`; }
function tagLabel(s){ return s>=70?'Maîtrisé':s>=40?'À surveiller':'Critique'; }
function tagClass(s){ return s>=70?'tag-green':s>=40?'tag-amber':'tag-red'; }

function clearErr(ids){ ids.forEach(id => { const e = document.getElementById(id); if(e) e.classList.remove('show'); }); }
function showErr(id){ const e = document.getElementById(id); if(e) e.classList.add('show'); }

function showToast(msg, type='ok'){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}
