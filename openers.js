// openers.js - Phrases d'ouverture avec pondération

const OPENERS = [
  // Très communes (poids 5)
  { text: "Oh oui ! C'est le but !", weight: 5 },
  { text: "Incroyable !", weight: 5 },
  { text: "Quel but !", weight: 5 },
  { text: "Magnifique !", weight: 5 },
  { text: "Superbe !", weight: 5 },
  { text: "C'est au fond !", weight: 5 },
  { text: "But !", weight: 5 },

  // Communes (poids 1.5)
  { text: "Quel bombasso !", weight: 1.5 },
  { text: "La frappe !", weight: 1.5 },
  { text: "Quel tir !", weight: 1.5 },
  { text: "C'est pas possible ! Quel but !", weight: 1.5 },
  { text: "Quelle mine !", weight: 1.5 },
  { text: "C'est dans la lucarne !", weight: 1.5 },
  
  // Moins communes (poids 0.8)
  { text: "Oh la minasse !", weight: 0.8 },
  { text: "C'est la surprise du chef !", weight: 0.8 },
  { text: "BADABOUM !", weight: 0.8 },
  { text: "Aïe Aïe Aïe !", weight: 0.8 },

  // Rares (poids 0.1)
  { text: "Po po po !", weight: 0.1 },
  { text: "Quelle merveille !", weight: 0.1 },
  { text: "Fantastique !", weight: 0.1 },
  { text: "Magistral !", weight: 0.1 }
];

// Phrases pour parler de l'équipe qui encaisse
const CONCEDING_OPENERS = [
  // Communes (poids 3) - SANS "défense" pour éviter les doublons
  { text: "Ça s'écroule complètement derrière !", weight: 3 },
  { text: "La défense qui s'effondre !", weight: 3 },
  { text: "La charnière qui se troue !", weight: 3 },
  { text: "Ça va trop vite pour eux derrière !", weight: 3 },

  // Moins communes (poids 2)
  { text: "Quelle bourde défensive !", weight: 2 },
  { text: "L'arrière-garde qui flanche !", weight: 2 },
  { text: "Les défenseurs qui perdent pied !", weight: 2 },
  { text: "Quel manque de concentration défensive !", weight: 2 },
  { text: "Que ça manque d'aggressivité derrière !", weight: 2 },
  
  // Rares (poids 0.1)
  { text: "La défense est aux abonnés absents ce soir !", weight: 0.1 },
  { text: "C'est un festival offensif !", weight: 0.1 },
  { text: "Ils sont en train de boire la tasse en défense !", weight: 0.1 }
];

// Openers pour pattern minimaliste (plus directs)
const MINIMAL_OPENERS = [
  // Très communes (poids 5)
  { text: "Et voilà !", weight: 5 },
  { text: "C'est fait !", weight: 5 },
  { text: "Hop !", weight: 5 },
  
  // Communes (poids 3)
  { text: "Paf !", weight: 3 },
  { text: "Boum !", weight: 3 },
  { text: "Tac !", weight: 3 },
  
  // Rares (poids 0.1)
  { text: "Clac !", weight: 0.1 },
  { text: "Vlan !", weight: 0.1 }
];

// Structures d'annonces avec différents patterns - RÉÉQUILIBRAGE
const ANNOUNCEMENT_PATTERNS = [
  // Pattern classique : Opener + Club + Scorer (réduit de 4 à 2.5)
  { type: 'classic', weight: 2.5 },
  
  // Pattern buteur en premier : Opener + Scorer + Club (augmenté de 3 à 3.5)
  { type: 'scorer_first', weight: 3.5 },
  
  // Pattern sans club : Opener + Scorer seulement (augmenté de 2 à 2.5)
  { type: 'scorer_only', weight: 2.5 },
  
  // Pattern défense qui craque : comme avant (augmenté de 2 à 2.5)
  { type: 'conceding', weight: 2.5 },
  
  // Pattern minimaliste : Juste le but + scorer (augmenté de 0.1 à 0.5)
  { type: 'minimal', weight: 0.5 }
];

// Templates minimalistes (juste l'action)
const MINIMAL_TEMPLATES = [
  // Communes (poids 3)
  { text: "But de {scorer} !", weight: 3 },
  { text: "{scorer} marque !", weight: 3 },
  { text: "C'est {scorer} !", weight: 3 },
  
  // Moins communes (poids 2)
  { text: "{scorer} à la conclusion !", weight: 2 },
  { text: "{scorer} ajuste à la perfection !", weight: 2 },
  
  // Rares (poids 0.1)
  { text: "{scorer} à la baguette !", weight: 0.1 },
  { text: "{scorer} dans ses oeuvres !", weight: 0.1 }
];

function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      // Pour les ANNOUNCEMENT_PATTERNS, on retourne l'objet complet
      // Pour les autres arrays (textes), on retourne juste le texte
      return item.type ? item : item.text;
    }
  }
  return items[0].type ? items[0] : items[0].text; // fallback
}

module.exports = { OPENERS, CONCEDING_OPENERS, MINIMAL_OPENERS, ANNOUNCEMENT_PATTERNS, MINIMAL_TEMPLATES, weightedRandom };