// `value` is the DB/URL filter value (stored in French) and stays untranslated;
// only the displayed `labelKey` is localized so EN users keep working filters.
// labelKeys are relative to the app.enterprise namespace.
export const QUICK_SECTORS: { value: string; labelKey: string }[] = [
  { value: "Hôtellerie", labelKey: "candidates.filter.quickSector.hotellerie" },
  { value: "Cuisine", labelKey: "candidates.filter.quickSector.cuisine" },
  { value: "Construction", labelKey: "candidates.filter.quickSector.construction" },
  { value: "Santé", labelKey: "candidates.filter.quickSector.sante" },
  { value: "Logistique", labelKey: "candidates.filter.quickSector.logistique" },
];

export function sectorLabel(sector: string, tEnt: (key: string) => string): string {
  const m = QUICK_SECTORS.find((q) => q.value === sector);
  return m ? tEnt(m.labelKey) : sector;
}
