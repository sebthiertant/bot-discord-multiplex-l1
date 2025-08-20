// scorer.js - Templates buteur avec pondération

const SCORER_TEMPLATES = [
  // Très communes (poids 5) - Enlever "fait trembler les filets" (déplacé vers SCORER_FIRST)
  { text: "Buuuuut de {scorer} !", weight: 5 },
  { text: "Et c'est {scorer} qui marque !", weight: 5 },
  { text: "{scorer} illumine le stade !", weight: 5 }, // Nouveau pour remplacer

  // Communes (poids 3)
  { text: "{scorer} conclut une action de grande classe !", weight: 3 },
  { text: "Quel but fantastique de {scorer} !", weight: 3 },
  { text: "{scorer} est en feu ce soir !", weight: 3 },
  { text: "{scorer} a encore frappé !", weight: 3 },

  // Moins communes (poids 2)
  { text: "La frappe chirurgicale de {scorer} qui vient se loger petit filet !", weight: 2 },
  { text: "C'est ce diable de {scorer} !", weight: 2 },
  { text: "La classe de {scorer} ! Quel joueur !", weight: 2 },
  { text: "{scorer} est un véritable artiste !", weight: 2 },
  { text: "Quand on parle de joueur décisif, {scorer} en est l'exemple parfait !", weight: 2 },

  // Rares (poids 0.1)
  { text: "El fenomeno ! {scorer} !", weight: 0.1 },
  { text: "¡Qué golazo de {scorer}!", weight: 0.1 },
  { text: "Ce qu'il nous a cuisiné {scorer} ! Quel poulet !", weight: 0.1 },
  { text: "{scorer} qui envoie une patate de forain tout droit dans la lucarne !", weight: 0.1 },
  { text: "C'est Olive et Tom ou quoi ? Le tir de l'aigle ! Appelez le {scorer} Atonne !", weight: 0.1 },
  { text: "{scorer} a cramé la mèche, et c'est au fond !", weight: 0.1 },
  { text: "L'artilleur {scorer} mitraille le gardien !", weight: 0.1 }
];

// Templates pour parler du buteur qui "enfonce le clou"
const FINISHING_SCORER_TEMPLATES = [
  // Communes (poids 3)
  { text: "C'est {scorer} qui enfonce le clou !", weight: 3 },
  { text: "{scorer} qui aggrave la marque !", weight: 3 },
  { text: "{scorer} qui assène le coup de grâce !", weight: 3 },
  
  // Moins communes (poids 2)
  { text: "{scorer} qui porte l'estocade !", weight: 2 },
  { text: "{scorer} qui donne le coup de massue !", weight: 2 },
  
  // Rares (poids 0.1)
  { text: "{scorer} qui plante le dernier clou du cercueil !", weight: 0.1 },
  { text: "{scorer} qui achève le travail !", weight: 0.1 }
];

// Templates pour parler du buteur en premier (nouvelles phrases)
const SCORER_FIRST_TEMPLATES = [
  // Communes (poids 3) - Éviter doublon avec "frappe"
  { text: "{scorer} qui ouvre le score", weight: 3 },
  { text: "{scorer} trouve la faille", weight: 3 },
  { text: "{scorer} qui fait mouche", weight: 3 }, // Changé "frappe fort" → "fait mouche"
  { text: "{scorer} fait trembler les filets", weight: 3 }, // Déplacé ici depuis SCORER_TEMPLATES
  
  // Moins communes (poids 2)
  { text: "{scorer} surgit dans la surface", weight: 2 },
  { text: "{scorer} fait parler la poudre", weight: 2 },
  { text: "{scorer} place sa frappe", weight: 2 },
  { text: "{scorer} ajuste parfaitement", weight: 2 },
  
  // Rares (poids 0.1)
  { text: "{scorer} sort de sa boîte", weight: 0.1 },
  { text: "{scorer} envoie une praline", weight: 0.1 },
  { text: "{scorer} dégaine plus vite que son ombre", weight: 0.1 }
];

// Templates minimalistes pour pattern direct
const MINIMAL_SCORER_TEMPLATES = [
  // Très communes (poids 5)
  { text: "But de {scorer} !", weight: 5 },
  { text: "{scorer} marque !", weight: 5 },
  { text: "C'est {scorer} !", weight: 5 },
  
  // Communes (poids 3)
  { text: "{scorer} conclut !", weight: 3 },
  { text: "{scorer} ajuste !", weight: 3 },
  { text: "{scorer} frappe !", weight: 3 },
  
  // Moins communes (poids 2)
  { text: "{scorer} qui égalise !", weight: 2 },
  { text: "{scorer} qui donne l'avantage !", weight: 2 },
  
  // Rares (poids 0.1)
  { text: "{scorer} crucifie !", weight: 0.1 },
  { text: "{scorer} transperce !", weight: 0.1 },
  { text: "{scorer} atomise !", weight: 0.1 }
];

// Templates pour les scores humiliants spéciaux
const HUMILIATION_TEMPLATES = {
  manita: [
    // 5-0 : La Manita
    { text: "Mesdames et messieurs, c'est une manita pour {team} ! C'est {scorer} qui se charge de transformer {conceding_team} en petites marionnettes !", weight: 5 },
    { text: "La manita ! {team} humilie {conceding_team} ! {scorer} enfonce le clou de cette démonstration !", weight: 3 },
    { text: "Cinq à zéro ! La manita pour {team} ! {scorer} parachève cette leçon de football !", weight: 2 }
  ],
  
  fanni: [
    // 10-0 : Fanni
    { text: "{conceding_team} est fanni et va devoir passer sous le babi ! 10 à zéro ! Quelle humiliation !", weight: 5 },
  ]
};

module.exports = { 
  SCORER_TEMPLATES, 
  FINISHING_SCORER_TEMPLATES, 
  SCORER_FIRST_TEMPLATES, 
  MINIMAL_SCORER_TEMPLATES,
  HUMILIATION_TEMPLATES
};