/**
 * Les six documents administratifs de la section : leurs champs de saisie et leur titre par défaut.
 * Partagé par le formulaire de rédaction (navigateur) et la mise en page (serveur).
 * Le code du type entre dans le numéro : AEEMCI-ESATIC/{délégation}/{type}/{année}/{NNN}.
 */

export type TypeAdministratif = "LET" | "PV" | "CONV" | "COM" | "ATT" | "OM";
export type EtatValidation = "redaction" | "soumis" | "a_corriger" | "valide";

export interface ChampAdministratif {
  nom: string;
  libelle: string;
  genre: "ligne" | "texte" | "date" | "heure";
  requis?: boolean;
  aide?: string;
  exemple?: string;
}

export interface DefinitionType {
  code: TypeAdministratif;
  libelle: string;
  description: string;
  champs: ChampAdministratif[];
  /** Champ qui donne le titre par défaut du document. */
  champTitre: string;
}

export const TYPES_ADMINISTRATIFS: DefinitionType[] = [
  {
    code: "LET",
    libelle: "Lettre",
    description: "Courrier officiel à une autorité, un partenaire, une autre section.",
    champTitre: "objet",
    champs: [
      { nom: "destinataire", libelle: "Destinataire", genre: "texte", requis: true, aide: "Une ligne par ligne d'adresse.", exemple: "Monsieur le Directeur Général\nde l'ESATIC\nAbidjan" },
      { nom: "objet", libelle: "Objet", genre: "ligne", requis: true, exemple: "Demande de salle pour la conférence du 14 novembre" },
      { nom: "appel", libelle: "Formule d'appel", genre: "ligne", requis: true, exemple: "Monsieur le Directeur Général," },
      { nom: "corps", libelle: "Texte de la lettre", genre: "texte", requis: true, aide: "Vouvoiement de rigueur. Termine par la formule de politesse.", exemple: "Nous avons l'honneur de solliciter…\n\nDans l'attente d'une suite favorable, nous vous prions d'agréer, Monsieur le Directeur Général, l'expression de notre haute considération." },
      { nom: "pieces", libelle: "Pièces jointes", genre: "texte", aide: "Une pièce par ligne." },
    ],
  },
  {
    code: "PV",
    libelle: "Procès-verbal",
    description: "Compte rendu officiel d'une réunion, signé par le secrétaire de séance et le président.",
    champTitre: "reunion",
    champs: [
      { nom: "reunion", libelle: "Réunion", genre: "ligne", requis: true, exemple: "Réunion ordinaire du bureau exécutif" },
      { nom: "date", libelle: "Date", genre: "date", requis: true },
      { nom: "debut", libelle: "Début", genre: "heure", requis: true },
      { nom: "fin", libelle: "Fin", genre: "heure" },
      { nom: "lieu", libelle: "Lieu", genre: "ligne", requis: true, exemple: "Salle B12, ESATIC" },
      { nom: "presents", libelle: "Présents", genre: "texte", requis: true, aide: "Un nom par ligne." },
      { nom: "absents", libelle: "Absents", genre: "texte", aide: "Un nom par ligne, avec « (excusé) » le cas échéant." },
      { nom: "ordre", libelle: "Ordre du jour", genre: "texte", requis: true, aide: "Un point par ligne." },
      { nom: "deroulement", libelle: "Déroulement", genre: "texte", requis: true },
      { nom: "decisions", libelle: "Décisions et résolutions", genre: "texte", aide: "Une décision par ligne." },
    ],
  },
  {
    code: "CONV",
    libelle: "Convocation",
    description: "Convocation à une réunion ou une assemblée.",
    champTitre: "objet",
    champs: [
      { nom: "destinataires", libelle: "Destinataires", genre: "texte", requis: true, exemple: "Aux membres du bureau exécutif" },
      { nom: "objet", libelle: "Objet", genre: "ligne", requis: true, exemple: "Réunion ordinaire du bureau exécutif" },
      { nom: "date", libelle: "Date", genre: "date", requis: true },
      { nom: "heure", libelle: "Heure", genre: "heure", requis: true },
      { nom: "lieu", libelle: "Lieu", genre: "ligne", requis: true },
      { nom: "ordre", libelle: "Ordre du jour", genre: "texte", requis: true, aide: "Un point par ligne." },
      { nom: "mot", libelle: "Mot de fin", genre: "texte", exemple: "Compte tenu de l'importance de cette réunion, votre présence est vivement souhaitée." },
    ],
  },
  {
    code: "COM",
    libelle: "Communiqué",
    description: "Annonce officielle aux membres ou au public.",
    champTitre: "titre",
    champs: [
      { nom: "titre", libelle: "Titre", genre: "ligne", requis: true, exemple: "Report de la journée d'intégration" },
      { nom: "corps", libelle: "Texte du communiqué", genre: "texte", requis: true },
    ],
  },
  {
    code: "ATT",
    libelle: "Attestation",
    description: "Attestation de participation, d'engagement ou de responsabilité, délivrée par le président.",
    champTitre: "beneficiaire",
    champs: [
      { nom: "beneficiaire", libelle: "Bénéficiaire", genre: "ligne", requis: true, exemple: "Mlle Aïcha KONÉ" },
      { nom: "qualite", libelle: "Qualité", genre: "ligne", exemple: "étudiante en Licence 2 Télécommunications à l'ESATIC" },
      { nom: "objet", libelle: "Ce qui est attesté", genre: "texte", requis: true, aide: "Suite de la phrase « … atteste que [bénéficiaire], [qualité], … ».", exemple: "a été membre actif de la cellule communication durant le mandat 2025-2026." },
    ],
  },
  {
    code: "OM",
    libelle: "Ordre de mission",
    description: "Mission confiée à un membre, hors de la section.",
    champTitre: "missionnaire",
    champs: [
      { nom: "missionnaire", libelle: "Missionnaire", genre: "ligne", requis: true },
      { nom: "fonction", libelle: "Fonction", genre: "ligne", requis: true, exemple: "Secrétaire général" },
      { nom: "destination", libelle: "Destination", genre: "ligne", requis: true, exemple: "Bouaké" },
      { nom: "objet", libelle: "Objet de la mission", genre: "texte", requis: true },
      { nom: "depart", libelle: "Départ", genre: "date", requis: true },
      { nom: "retour", libelle: "Retour", genre: "date", requis: true },
      { nom: "transport", libelle: "Moyen de transport", genre: "ligne", exemple: "Car de transport en commun" },
    ],
  },
];

export const LIBELLES_ETATS: Record<EtatValidation, string> = {
  redaction: "En rédaction",
  soumis: "Soumis à validation",
  a_corriger: "À corriger",
  valide: "Validé",
};

export function definitionType(code: string): DefinitionType | undefined {
  return TYPES_ADMINISTRATIFS.find((t) => t.code === code);
}

export const LONGUEUR_MAX_CHAMP = { ligne: 300, texte: 8000, date: 10, heure: 5 } as const;

/** Champs requis absents ou mal formés, avec leur message. */
export function controlerContenu(t: DefinitionType, contenu: Record<string, string>): { champ: string; message: string }[] {
  const erreurs: { champ: string; message: string }[] = [];
  for (const c of t.champs) {
    const v = contenu[c.nom]?.trim() ?? "";
    if (!v) {
      if (c.requis) erreurs.push({ champ: c.nom, message: `${c.libelle} : champ requis.` });
      continue;
    }
    if (v.length > LONGUEUR_MAX_CHAMP[c.genre]) erreurs.push({ champ: c.nom, message: `${c.libelle} : texte trop long.` });
    else if (c.genre === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) erreurs.push({ champ: c.nom, message: `${c.libelle} : date invalide.` });
    else if (c.genre === "heure" && !/^\d{2}:\d{2}$/.test(v)) erreurs.push({ champ: c.nom, message: `${c.libelle} : heure invalide.` });
  }
  if (t.code === "OM" && contenu.depart && contenu.retour && contenu.retour < contenu.depart)
    erreurs.push({ champ: "retour", message: "Retour : la date précède le départ." });
  return erreurs;
}

export function titreParDefaut(t: DefinitionType, contenu: Record<string, string>): string {
  const v = contenu[t.champTitre]?.trim().replace(/\s+/g, " ");
  return (v ? `${t.libelle} · ${v}` : t.libelle).slice(0, 200);
}
