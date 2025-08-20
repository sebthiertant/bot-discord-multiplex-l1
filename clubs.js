// clubs.js (CommonJS) - Variantes clubs avec pondération

// Communes (poids 3)
// Moins communes (poids 2)
// Rares (poids 1)
const CLUB_VARIANTS = {
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
  "lille": [
    { text: "Les Dogues font parler la poudre !", weight: 3 },
    { text: "Le LOSC débloque la situation !", weight: 2 },
    { text: "Lille trouve la faille !", weight: 2 }
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
