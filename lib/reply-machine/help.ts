import type { ContextChunk } from "./contract";

// Static, in-repo help corpus (French-first; AsanaoConnect's voice). Ranked by
// keyword overlap — no vector DB (YAGNI at this scale). A DB/RAG-backed corpus
// is a later iteration.
type HelpDoc = { keywords: string[]; text: string };

const HELP_CORPUS: HelpDoc[] = [
  {
    keywords: ["inscription", "compte", "account", "register", "inscrire", "creer"],
    text: "Pour postuler, creez un compte candidat sur AsanaoConnect, completez votre profil (competences, secteurs, niveaux de langue) puis televersez vos documents.",
  },
  {
    keywords: ["statut", "candidature", "application", "status", "suivi", "ou en est"],
    text: "Le statut de chaque candidature evolue: deposee, preselection, entretien, offre, deploiement. Demandez votre statut et l'assistant le recupere pour votre compte.",
  },
  {
    keywords: ["offre", "emploi", "job", "offer", "poste", "annonce"],
    text: "Les offres actives precisent le titre, le secteur, le lieu (Maurice), le nombre de places, les prerequis et les langues demandees. Donnez l'identifiant d'une offre pour ses details.",
  },
  {
    keywords: ["document", "passeport", "visa", "kyc", "permis", "piece"],
    text: "Les documents (passeport, visa, permis de travail) sont verifies par l'equipe. Un document expire ou non conforme est signale; televersez une version a jour.",
  },
  {
    keywords: ["entreprise", "recruteur", "enterprise", "employer", "employeur"],
    text: "Les entreprises publient des offres, consultent des candidats anonymises et gerent leurs entretiens depuis leur tableau de bord.",
  },
  {
    keywords: ["langue", "francais", "anglais", "language", "test", "niveau"],
    text: "Le niveau de langue (francais/anglais) est auto-evalue puis peut etre verifie via le test de langue, ce qui affiche un badge verifie sur votre profil.",
  },
];

export function searchHelp(query: string, topK: number): ContextChunk[] {
  const q = query.toLowerCase();
  return HELP_CORPUS.map((d) => ({
    text: d.text,
    score: d.keywords.reduce((n, k) => (q.includes(k.toLowerCase()) ? n + 1 : n), 0),
  }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, topK));
}
