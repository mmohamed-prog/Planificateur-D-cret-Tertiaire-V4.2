export const APP_CONFIG = {
  appName: "EcoVerta — Planificateur Décret Tertiaire V4",
  version: "4.0.0",
  contactEmail: "contact@ecovertaconsult.com",
  defaultPortfolioName: "Portefeuille tertiaire EcoVerta",
  defaultWebhookUrl: "https://formspree.io/f/mdapedlv",
  currency: "EUR",
  locale: "fr-FR",
  // Webhook HubSpot / Folk — renseigner l'URL dans config
  hubspotWebhookUrl: "",
  folkWebhookUrl: "",
  riskThresholds: {
    criticalGap: 50,
    mediumGap: 20,
    highLeadScore: 70,
    mediumLeadScore: 40
  }
};
