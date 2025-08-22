// ending.js - Templates d'annonces de fin de match avec pondération

const ENDING_TEMPLATES = [
  // Très communes (poids 5) - Annonces génériques
  { text: "C'est terminé ! Score final : {team} {scoreFor}, {opponent} {scoreAgainst}.", weight: 5 },
  { text: "Coup de sifflet final ! {team} {scoreFor}, {opponent} {scoreAgainst}.", weight: 5 },
  { text: "Fin de la rencontre ! {team} {scoreFor}, {opponent} {scoreAgainst}.", weight: 5 },
  
  // Communes (poids 3) - Plus descriptives
  { text: "L'arbitre siffle la fin de cette rencontre ! Score final : {team} {scoreFor}, {opponent} {scoreAgainst}.", weight: 3 },
  { text: "C'est fini ! Une belle rencontre qui se termine sur le score de {team} {scoreFor}, {opponent} {scoreAgainst}.", weight: 3 },
  { text: "Terminé ! Au terme de ces 90 minutes, {team} {scoreFor}, {opponent} {scoreAgainst}.", weight: 3 },
  
  // Moins communes (poids 2) - Avec contexte
  { text: "C'est la fin de cette partie ! {team} s'impose {scoreFor} buts à {scoreAgainst} face à {opponent}.", weight: 2 },
  { text: "Triple coup de sifflet ! {team} remporte cette rencontre {scoreFor} à {scoreAgainst} contre {opponent}.", weight: 2 },
  { text: "Et voilà, c'est terminé ! {team} l'emporte {scoreFor} buts à {scoreAgainst} face à {opponent}.", weight: 2 },
  
  // Rares (poids 0.1) - Très spécifiques
  { text: "Les 90 minutes sont écoulées ! Quel match ! Score final : {team} {scoreFor}, {opponent} {scoreAgainst}.", weight: 0.1 },
  { text: "L'arbitre met un terme à cette belle opposition ! {team} {scoreFor}, {opponent} {scoreAgainst}.", weight: 0.1 },
  { text: "C'est dans les livres ! {team} {scoreFor}, {opponent} {scoreAgainst} ! Quelle rencontre !", weight: 0.1 }
];

// Templates spéciaux selon le type de résultat
const VICTORY_TEMPLATES = [
  // Victoire nette (2+ buts d'écart)
  { text: "Victoire éclatante de {team} ! {scoreFor} à {scoreAgainst} face à {opponent} !", weight: 3 },
  { text: "Succès probant pour {team} qui domine {opponent} {scoreFor} buts à {scoreAgainst} !", weight: 2 },
  { text: "Démonstration de force ! {team} écrase {opponent} {scoreFor} à {scoreAgainst} !", weight: 0.1 }
];

const NARROW_VICTORY_TEMPLATES = [
  // Victoire courte (1 but d'écart)
  { text: "Victoire à l'arraché pour {team} ! {scoreFor} à {scoreAgainst} face à {opponent}.", weight: 3 },
  { text: "Succès dans la douleur ! {team} s'impose de justesse {scoreFor} à {scoreAgainst} contre {opponent}.", weight: 2 },
  { text: "Ça passe ! {team} prend les trois points {scoreFor} à {scoreAgainst} face à {opponent}.", weight: 2 }
];

const DRAW_TEMPLATES = [
  // Match nul
  { text: "Match nul ! {team} et {opponent} se séparent sur un score de {scoreFor} partout.", weight: 3 },
  { text: "Partage des points ! {team} {scoreFor}, {opponent} {scoreAgainst}.", weight: 3 },
  { text: "Égalisation parfaite ! {team} et {opponent} font match nul {scoreFor} à {scoreAgainst}.", weight: 2 }
];

const DEFEAT_TEMPLATES = [
  // Défaite
  { text: "Défaite pour {team} ! {opponent} l'emporte {scoreAgainst} à {scoreFor}.", weight: 3 },
  { text: "Revers pour {team} qui s'incline {scoreFor} à {scoreAgainst} face à {opponent}.", weight: 2 },
  { text: "Déception pour {team} qui perd {scoreFor} à {scoreAgainst} contre {opponent}.", weight: 2 }
];

const HEAVY_DEFEAT_TEMPLATES = [
  // Défaite lourde (3+ buts d'écart)
  { text: "Lourde défaite pour {team} ! {opponent} l'emporte largement {scoreAgainst} à {scoreFor}.", weight: 3 },
  { text: "Correction pour {team} qui s'effondre {scoreFor} à {scoreAgainst} face à {opponent}.", weight: 2 },
  { text: "Débâcle ! {team} prend une raclée {scoreFor} à {scoreAgainst} contre {opponent}.", weight: 0.1 }
];

const CLEAN_SHEET_TEMPLATES = [
  // Score à zéro (clean sheet)
  { text: "Clean sheet pour {winningTeam} ! Victoire {winningScore} à zéro face à {losingTeam}.", weight: 3 },
  { text: "Cage inviolée ! {winningTeam} bat {losingTeam} {winningScore} à zéro.", weight: 2 },
  { text: "Porte fermée ! {winningTeam} gagne {winningScore} à zéro contre {losingTeam}.", weight: 2 }
];

const GOALLESS_DRAW_TEMPLATES = [
  // Match nul 0-0
  { text: "Match nul et vierge ! {team} et {opponent} se neutralisent zéro à zéro.", weight: 3 },
  { text: "Zéro pointé ! {team} et {opponent} ne parviennent pas à se départager.", weight: 2 },
  { text: "Match fermé ! {team} et {opponent} font match blanc zéro à zéro.", weight: 0.1 }
];

const HIGH_SCORING_TEMPLATES = [
  // Match à buts (6+ buts au total)
  { text: "Festival offensif ! {team} {scoreFor}, {opponent} {scoreAgainst} ! Quel spectacle !", weight: 3 },
  { text: "Match de folie ! {team} et {opponent} nous ont régalés ! Score final : {scoreFor} à {scoreAgainst}.", weight: 2 },
  { text: "Avalanche de buts ! {team} {scoreFor}, {opponent} {scoreAgainst} ! Les défenses ont pris cher !", weight: 0.1 }
];

function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item.text;
    }
  }
  return items[0].text; // fallback
}

/**
 * Génère l'annonce de fin de match appropriée selon le contexte
 */
function buildEndingAnnouncement(team, opponent, scoreFor, scoreAgainst) {
  if (!team || !opponent || scoreFor == null || scoreAgainst == null) {
    return "Fin du match.";
  }

  const totalGoals = scoreFor + scoreAgainst;
  const scoreDiff = Math.abs(scoreFor - scoreAgainst);
  
  let selectedTemplates = ENDING_TEMPLATES;
  
  // Sélection du type de template selon le contexte
  if (scoreFor === 0 && scoreAgainst === 0) {
    // Match nul 0-0
    selectedTemplates = GOALLESS_DRAW_TEMPLATES;
  } else if (totalGoals >= 6) {
    // Match à buts (6+ buts)
    selectedTemplates = HIGH_SCORING_TEMPLATES;
  } else if (scoreFor === scoreAgainst) {
    // Match nul
    selectedTemplates = DRAW_TEMPLATES;
  } else if ((scoreFor > scoreAgainst && scoreAgainst === 0) || (scoreAgainst > scoreFor && scoreFor === 0)) {
    // Clean sheet
    const winningTeam = scoreFor > scoreAgainst ? team : opponent;
    const losingTeam = scoreFor > scoreAgainst ? opponent : team;
    const winningScore = Math.max(scoreFor, scoreAgainst);
    
    selectedTemplates = CLEAN_SHEET_TEMPLATES;
    const template = weightedRandom(selectedTemplates);
    return template
      .replace('{winningTeam}', winningTeam)
      .replace('{losingTeam}', losingTeam)
      .replace('{winningScore}', winningScore);
  } else if (scoreFor > scoreAgainst) {
    // Victoire - CORRECTION : utiliser scoreDiff au lieu de scoreFor - scoreAgainst
    if (scoreDiff >= 2) {
      selectedTemplates = VICTORY_TEMPLATES; // Victoire nette (2+ buts d'écart)
    } else {
      selectedTemplates = NARROW_VICTORY_TEMPLATES; // Victoire courte (1 but d'écart)
    }
  } else {
    // Défaite - CORRECTION : utiliser scoreDiff au lieu de scoreAgainst - scoreFor
    if (scoreDiff >= 3) {
      selectedTemplates = HEAVY_DEFEAT_TEMPLATES; // Défaite lourde (3+ buts d'écart)
    } else {
      selectedTemplates = DEFEAT_TEMPLATES; // Défaite normale
    }
  }
  
  const template = weightedRandom(selectedTemplates);
  
  return template
    .replace('{team}', team)
    .replace('{opponent}', opponent)
    .replace('{scoreFor}', scoreFor)
    .replace('{scoreAgainst}', scoreAgainst);
}

module.exports = {
  ENDING_TEMPLATES,
  VICTORY_TEMPLATES,
  NARROW_VICTORY_TEMPLATES,
  DRAW_TEMPLATES,
  DEFEAT_TEMPLATES,
  HEAVY_DEFEAT_TEMPLATES,
  CLEAN_SHEET_TEMPLATES,
  GOALLESS_DRAW_TEMPLATES,
  HIGH_SCORING_TEMPLATES,
  weightedRandom,
  buildEndingAnnouncement
};
