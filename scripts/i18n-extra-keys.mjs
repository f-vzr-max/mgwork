// Keys for the 5 delegated admin client forms (not covered by the scout).
// Appends to en.json + fr.json with parity; idempotent (skips existing).
import fs from "node:fs";
const ROOT = "c:/Users/Administrator/OneDrive/EXECUTIVE ASISTANT/projects/mgwork";
const EN = ROOT + "/i18n/en.json", FR = ROOT + "/i18n/fr.json";

const EXTRA = {
  // shared atoms
  "common.requestFailed": { en: "Request failed ({status})", fr: "Échec de la requête ({status})" },
  "common.saving": { en: "Saving…", fr: "Enregistrement…" },
  "common.creating": { en: "Creating…", fr: "Création…" },
  "common.yes": { en: "Yes", fr: "Oui" },
  "common.no": { en: "No", fr: "Non" },
  "common.key": { en: "Key", fr: "Clé" },
  "common.value": { en: "Value", fr: "Valeur" },
  "common.action": { en: "Action", fr: "Action" },
  "common.enabled": { en: "Enabled", fr: "Activé" },
  // MarkPaidForm
  "app.admin.invoices.markPaidForm.paymentMethod": { en: "Payment method", fr: "Méthode de paiement" },
  "app.admin.invoices.markPaidForm.reference": { en: "Reference", fr: "Référence" },
  "app.admin.invoices.markPaidForm.referencePlaceholder": { en: "Bank transfer ref / mobile money txn id", fr: "Réf. virement / ID transaction mobile money" },
  // NewInvoiceForm
  "app.admin.invoices.newForm.enterprise": { en: "Enterprise", fr: "Entreprise" },
  "app.admin.invoices.newForm.selectEnterprise": { en: "Select enterprise", fr: "Sélectionner une entreprise" },
  "app.admin.invoices.newForm.amount": { en: "Amount", fr: "Montant" },
  "app.admin.invoices.newForm.currency": { en: "Currency", fr: "Devise" },
  "app.admin.invoices.newForm.paymentMethod": { en: "Payment method", fr: "Méthode de paiement" },
  "app.admin.invoices.newForm.reference": { en: "Reference", fr: "Référence" },
  "app.admin.invoices.newForm.referencePlaceholder": { en: "Internal ref or PO number", fr: "Réf. interne ou numéro de bon de commande" },
  "app.admin.invoices.newForm.notes": { en: "Notes", fr: "Notes" },
  // UserActionsMenu
  "app.admin.userActions.viewDetail": { en: "View detail", fr: "Voir le détail" },
  "app.admin.userActions.ban": { en: "Ban", fr: "Bannir" },
  "app.admin.userActions.unban": { en: "Unban", fr: "Réintégrer" },
  "app.admin.userActions.changeRole": { en: "Change role", fr: "Changer de rôle" },
  "app.admin.userActions.impersonate": { en: "Impersonate", fr: "Impersonation" },
  "app.admin.userActions.confirmBan": { en: "Ban {email}?", fr: "Bannir {email} ?" },
  "app.admin.userActions.confirmUnban": { en: "Unban {email}?", fr: "Réintégrer {email} ?" },
  "app.admin.userActions.promptRole": { en: "New role for {email} (one of: {roles})", fr: "Nouveau rôle pour {email} (parmi : {roles})" },
  "app.admin.userActions.invalidRole": { en: "Invalid role", fr: "Rôle invalide" },
  "app.admin.userActions.confirmImpersonate": { en: "Open impersonation for {email}?", fr: "Ouvrir l'impersonation pour {email} ?" },
  // FeatureFlagsManager
  "app.admin.featureFlags.addTitle": { en: "Add or replace flag", fr: "Ajouter ou remplacer un flag" },
  "app.admin.featureFlags.existingTitle": { en: "Existing flags", fr: "Flags existants" },
  "app.admin.featureFlags.colUpdated": { en: "Updated", fr: "Mis à jour" },
  "app.admin.featureFlags.empty": { en: "No feature flags defined yet.", fr: "Aucun feature flag défini pour le moment." },
  "app.admin.featureFlags.enable": { en: "Enable", fr: "Activer" },
  "app.admin.featureFlags.disable": { en: "Disable", fr: "Désactiver" },
  // TranslationsManager
  "app.admin.i18nManager.languageLabel": { en: "Language:", fr: "Langue :" },
  "app.admin.i18nManager.addTitle": { en: "Add or replace key", fr: "Ajouter ou remplacer une clé" },
  "app.admin.i18nManager.valuePlaceholder": { en: "Translated value", fr: "Valeur traduite" },
  "app.admin.i18nManager.translationsCount": { en: "{lang} translations ({count})", fr: "Traductions {lang} ({count})" },
  "app.admin.i18nManager.empty": { en: "No DB overrides. JSON file values are used.", fr: "Aucune surcharge en base. Les valeurs du fichier JSON sont utilisées." },
};

const en = JSON.parse(fs.readFileSync(EN, "utf8"));
const fr = JSON.parse(fs.readFileSync(FR, "utf8"));
let added = 0;
for (const k of Object.keys(EXTRA).sort()) {
  if (!(k in en)) { en[k] = EXTRA[k].en; fr[k] = EXTRA[k].fr; added++; }
}
fs.writeFileSync(EN, JSON.stringify(en, null, 2) + "\n", "utf8");
fs.writeFileSync(FR, JSON.stringify(fr, null, 2) + "\n", "utf8");
const ek = Object.keys(en), fk = Object.keys(fr);
console.log(`added ${added}; en=${ek.length} fr=${fk.length}; onlyEn=${ek.filter(k=>!fk.includes(k)).length} onlyFr=${fk.filter(k=>!ek.includes(k)).length}`);
