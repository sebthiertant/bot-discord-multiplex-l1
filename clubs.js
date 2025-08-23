// clubs.js (CommonJS) - Variantes clubs avec pondération

// Communes (poids 3)
// Moins communes (poids 2)
// Rares (poids 1)
const CLUB_VARIANTS = {
  "ajaccio": [
    { text: "But pour le AC Ajaccio !", weight: 3 },
    { text: "C'est le but pour les Ajacciens !", weight: 3 },
    { text: "Ajaccio qui marque !", weight: 2 },
    { text: "Le AC Ajaccio à la baguette !", weight: 0.1 }
  ],
  "amiens": [
    { text: "But pour le SC Amiens !", weight: 3 },
    { text: "C'est le but pour les Amiénois !", weight: 3 },
    { text: "Amiens qui marque !", weight: 2 },
    { text: "Le SC Amiens à la baguette !", weight: 0.1 }
  ],
  "angers": [
    { text: "But pour le SCO !", weight: 3 },
    { text: "But pour les Angevins !", weight: 3 },
    { text: "Angers qui marque !", weight: 3 },
    { text: "But à Angers !", weight: 3 },
    { text: "Angers qui fait trembler les cages !", weight: 2 },
    { text: "But au stade Raymond-Kopa !", weight: 2 },
    { text: "Le SCO qui régale !", weight: 0.1 },
  ],
  "auxerre": [
    { text: "But pour l'AJ Auxerre !", weight: 3 },
    { text: "C'est le but pour les Auxerrois !", weight: 3 },
    { text: "Auxerre qui fait trembler les cages !", weight: 2 },
    { text: "L'AJA sur un pétard !", weight: 0.1 }
  ],
  "brest": [
    { text: "But pour le Stade Brestois !", weight: 3 },
    { text: "But pour les Brestois !", weight: 3 },
    { text: "Brest qui marque !", weight: 2 },
    { text: "Quel pétard des Brestois !", weight: 0.1 }
  ],
  "nantes": [
    { text: "But pour Nantes !", weight: 3 },
    { text: "C'est le but pour les Canaris !", weight: 3 },
    { text: "Le FC Nantes à la baguette !", weight: 2 },
    { text: "Les canaris qui marquent !", weight: 0.1 }
  ],
  "lehavre": [
    { text: "But pour le Havre AC !", weight: 3 },
    { text: "C'est le but pour les Havrais !", weight: 3 },
    { text: "Le HAC qui fait trembler les cages !", weight: 2 },
    { text: "Les Havreungeursses frappent encore !", weight: 0.1 }
  ],
  "stetienne": [
    { text: "But pour l'AS Saint-Étienne !", weight: 3 },
    { text: "C'est le but pour les Verts !", weight: 3 },
    { text: "Saint-Étienne qui fait trembler les cages !", weight: 2 }
  ],
  "nice": [
    { text: "Les Aiglons ouvrent le score !", weight: 3 },
    { text: "L'OGC Nice fait vibrer l'Allianz Riviera !", weight: 2 },
    { text: "Nice frappe fort !", weight: 2 }
  ],
  "lens": [
    { text: "But pour le RC Lens !", weight: 3 },
    { text: "C'est le but pour les Sang et Or !", weight: 3 },
    { text: "Lens qui font honneur aux corons !", weight: 2 },
    { text: "Le RC Lens qui rend hommage à Pierre Bachelet !", weight: 0.1 },
    { text: "Au nord c'était les corons ! Et les lensois qui tirent des boulets de canon !", weight: 0.1 }
  ],
  "lille": [
    { text: "Les Dogues font parler la poudre !", weight: 3 },
    { text: "Le LOSC débloque la situation !", weight: 2 },
    { text: "Lille trouve la faille !", weight: 2 }
  ],
  "lorient": [
    { text: "But pour le FC Lorient !", weight: 3 },
    { text: "C'est le but pour les Merlus !", weight: 3 },
    { text: "Lorient qui fait trembler les cages !", weight: 2 },
    { text: "Le FC Lorient à la baguette !", weight: 0.1 }
  ],
  "lyon": [
    { text: "But pour l'O elle !", weight: 3 },
    { text: "C'est le but pour les Gones !", weight: 3 },
    { text: "Lyon qui réveille les supporters !", weight: 2 },
    { text: "But du FC Lyon !", weight: 0.1 }
  ],
  "metz": [
    { text: "But pour le FC Metz !", weight: 3 },
    { text: "C'est le but pour les Grenats !", weight: 3 },
    { text: "Metz qui fait trembler les cages !", weight: 2 },
    { text: "Le FC Metz à la baguette !", weight: 0.1 }
  ],
  "montpellier": [
    { text: "But pour Montpellier !", weight: 3 },
    { text: "C'est le but pour les Pailladins !", weight: 3 },
    { text: "Montpellier qui fait trembler les cages !", weight: 2 },
    { text: "Bienvenue à la Paillade !", weight: 0.1 }
  ],
  "monaco": [
    { text: "Les Monégasques prennent l'avantage !", weight: 3 },
    { text: "L'AS Monaco fait trembler le Rocher !", weight: 2 },
    { text: "Monaco marque d'une belle action !", weight: 2 }
  ],
  "paris": [
    { text: "Le PSG fait la différence !", weight: 3 },
    { text: "Paris trouve le chemin des filets !", weight: 2 },
    { text: "Les Parisiens font sauter le verrou !", weight: 2 }
  ],
  "marseille": [
    { text: "L'O aime fait chavirer le Vélodrome !", weight: 3 },
    { text: "Marseille ouvre le score !", weight: 2 },
    { text: "Les Olympiens font trembler les filets !", weight: 2 }
  ],
  "reims": [
    { text: "But pour le Stade de Reims !", weight: 3 },
    { text: "C'est le but pour les Rémois !", weight: 3 },
    { text: "Reims qui marque !", weight: 2 },
    { text: "Le Stade de Reims à la baguette !", weight: 0.1 }
  ],
  "rennes": [
    { text: "But pour le Stade Rennais !", weight: 3 },
    { text: "C'est le but pour les Rouge et Noir !", weight: 3 },
    { text: "Rennes qui marque !", weight: 2 },
    { text: "Le Stade Rennais à la baguette !", weight: 0.1 }
  ],
  "rodez": [
    { text: "But pour le Rodez AF !", weight: 3 },
    { text: "C'est le but pour les Ruthénois !", weight: 3 },
    { text: "Rodez qui marque !", weight: 2 },
    { text: "Le Rodez AF à la baguette !", weight: 0.1 }
  ],
  "strasbourg": [
    { text: "But pour le RC Strasbourg !", weight: 3 },
    { text: "C'est le but pour les Alsaciens !", weight: 3 },
    { text: "Strasbourg qui marque !", weight: 2 },
    { text: "Le RC Strasbourg à la baguette !", weight: 0.1 }
  ],
  "toulouse": [
    { text: "But pour le Toulouse FC !", weight: 3 },
    { text: "C'est le but pour les Violets !", weight: 3 },
    { text: "Toulouse qui marque !", weight: 2 },
    { text: "Le Toulouse FC à la baguette !", weight: 0.1 }
  ]
};

// Phrases pour parler de l'équipe qui encaisse
const CONCEDING_TEAM_PHRASES = {
  default: [
    { text: "La défense de {team} qui s'écroule", weight: 3 },
    { text: "L'arrière-garde de {team} qui craque", weight: 3 },
    { text: "La défense de {team} qui vacille", weight: 2 },
    { text: "La ligne défensive de {team} qui cède", weight: 2 }, // Nouveau
    { text: "Les défenseurs de {team} aux abonnés absents", weight: 0.1 },
    { text: "C'est la débandade chez {team}", weight: 0.1 }
  ]
};

module.exports = { CLUB_VARIANTS, CONCEDING_TEAM_PHRASES };
