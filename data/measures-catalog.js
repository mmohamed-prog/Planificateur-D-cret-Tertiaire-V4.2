// Catalogue V4 : 10 mesures (base V2) enrichies scoring V3
// gain      : réduction relative médiane de consommation
// capex     : €/m² médian
// capexMin/Max : fourchette V2
// effort    : 0-1 (complexité chantier)
// impact    : 0-1 (potentiel énergétique)
// priority  : quick-win | medium | heavy
// mandatory : true si prioritaire réglementairement (GTB/BACS)
// dependencies : mesures à réaliser avant

export const DEFAULT_CATALOG = [
  {
    id: "GTB",
    label: "Pilotage / GTB",
    category: "pilotage",
    gain: 0.085,
    capex: 6,
    capexMin: 3,
    capexMax: 10,
    effort: 0.20,
    impact: 0.55,
    priority: "quick-win",
    mandatory: true,
    dependencies: []
  },
  {
    id: "LED",
    label: "Éclairage LED",
    category: "eclairage",
    gain: 0.13,
    capex: 30,
    capexMin: 15,
    capexMax: 45,
    effort: 0.18,
    impact: 0.35,
    priority: "quick-win",
    mandatory: false,
    dependencies: []
  },
  {
    id: "CVC",
    label: "Optimisation CVC",
    category: "cvc",
    gain: 0.11,
    capex: 12,
    capexMin: 5,
    capexMax: 20,
    effort: 0.45,
    impact: 0.60,
    priority: "medium",
    mandatory: false,
    dependencies: ["GTB"]
  },
  {
    id: "PAC",
    label: "Remplacement générateurs / PAC",
    category: "cvc",
    gain: 0.175,
    capex: 130,
    capexMin: 60,
    capexMax: 200,
    effort: 0.62,
    impact: 0.72,
    priority: "medium",
    mandatory: false,
    dependencies: ["GTB"]
  },
  {
    id: "FROID",
    label: "Froid / climatisation",
    category: "cvc",
    gain: 0.14,
    capex: 100,
    capexMin: 40,
    capexMax: 160,
    effort: 0.50,
    impact: 0.50,
    priority: "medium",
    mandatory: false,
    dependencies: ["GTB"]
  },
  {
    id: "Isolation",
    label: "Isolation enveloppe",
    category: "enveloppe",
    gain: 0.20,
    capex: 300,
    capexMin: 150,
    capexMax: 450,
    effort: 0.85,
    impact: 0.90,
    priority: "heavy",
    mandatory: false,
    dependencies: []
  },
  {
    id: "Menuiseries",
    label: "Menuiseries",
    category: "enveloppe",
    gain: 0.13,
    capex: 235,
    capexMin: 120,
    capexMax: 350,
    effort: 0.65,
    impact: 0.42,
    priority: "heavy",
    mandatory: false,
    dependencies: []
  },
  {
    id: "PV",
    label: "Production photovoltaïque",
    category: "prod",
    gain: 0.075,
    capex: 160,
    capexMin: 70,
    capexMax: 250,
    effort: 0.58,
    impact: 0.28,
    priority: "medium",
    mandatory: false,
    dependencies: []
  },
  {
    id: "ECS",
    label: "ECS solaire",
    category: "ecs",
    gain: 0.07,
    capex: 21,
    capexMin: 8,
    capexMax: 35,
    effort: 0.30,
    impact: 0.22,
    priority: "medium",
    mandatory: false,
    dependencies: []
  },
  {
    id: "Sobriete",
    label: "Sobriété usage",
    category: "sobriete",
    gain: 0.055,
    capex: 2,
    capexMin: 0,
    capexMax: 5,
    effort: 0.10,
    impact: 0.15,
    priority: "quick-win",
    mandatory: false,
    dependencies: []
  }
];

export function cloneCatalog() {
  return JSON.parse(JSON.stringify(DEFAULT_CATALOG));
}
