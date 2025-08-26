// store.js — persistance simple en JSON: guildId -> userId -> { team }
const fs = require('fs');
const path = require('path');

const DATA_DIR = 'data';
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

let profiles = { guilds: {} };

// NOUVEAU : État des conférences de presse en cours
const activePressSessions = new Map(); // guildId-userId -> { questions: [], currentIndex: 0, journalist: {} }

// Initialisation
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureProfile(guildId, userId) {
  if (!profiles.guilds[guildId]) {
    profiles.guilds[guildId] = {};
  }
  if (!profiles.guilds[guildId][userId]) {
    profiles.guilds[guildId][userId] = {};
  }
}

// Chargement/Sauvegarde
async function loadProfiles() {
  ensureDataDir();
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const data = fs.readFileSync(PROFILES_FILE, 'utf8');
      profiles = JSON.parse(data);
      console.log('[STORE] Profils chargés');
    } else {
      console.log('[STORE] Aucun fichier de profils existant, initialisation');
    }
  } catch (error) {
    console.error('[STORE] Erreur chargement profils:', error);
    profiles = { guilds: {} };
  }
}

function saveProfiles() {
  try {
    ensureDataDir();
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error('[STORE] Erreur sauvegarde profils:', error);
  }
}

// Gestion des équipes
function getTeam(guildId, userId) {
  ensureProfile(guildId, userId);
  return profiles.guilds[guildId][userId].team;
}

function setTeam(guildId, userId, team) {
  ensureProfile(guildId, userId);
  profiles.guilds[guildId][userId].team = team;
  saveProfiles();
}

function clearTeam(guildId, userId) {
  ensureProfile(guildId, userId);
  delete profiles.guilds[guildId][userId].team;
  saveProfiles();
}

// Gestion du tableau (board)
function getBoard(guildId) {
  return profiles.guilds[guildId]?._board;
}

function setBoard(guildId, channelId, msgId) {
  if (!profiles.guilds[guildId]) {
    profiles.guilds[guildId] = {};
  }
  profiles.guilds[guildId]._board = { channelId, msgId };
  saveProfiles();
}

// Gestion du profil coach
function getCoachProfile(guildId, userId) {
  ensureProfile(guildId, userId);
  return profiles.guilds[guildId][userId].coach || {};
}

function updateCoachProfile(guildId, userId, updates) {
  ensureProfile(guildId, userId);
  if (!profiles.guilds[guildId][userId].coach) {
    profiles.guilds[guildId][userId].coach = {};
  }
  Object.assign(profiles.guilds[guildId][userId].coach, updates);
  saveProfiles();
}

// Gestion de l'historique des matchs
function addMatchToHistory(guildId, userId, matchData) {
  ensureProfile(guildId, userId);
  if (!profiles.guilds[guildId][userId].matchHistory) {
    profiles.guilds[guildId][userId].matchHistory = [];
  }
  
  const match = {
    id: Date.now(),
    date: new Date().toISOString(),
    ...matchData
  };
  
  // Ajouter au début (plus récent en premier)
  profiles.guilds[guildId][userId].matchHistory.unshift(match);
  
  // Limiter à 100 matchs
  if (profiles.guilds[guildId][userId].matchHistory.length > 100) {
    profiles.guilds[guildId][userId].matchHistory = profiles.guilds[guildId][userId].matchHistory.slice(0, 100);
  }
  
  saveProfiles();
  return match.id;
}

function getMatchHistory(guildId, userId, limit = 10) {
  ensureProfile(guildId, userId);
  const history = profiles.guilds[guildId][userId].matchHistory || [];
  return history.slice(0, limit);
}

function updateMatchInHistory(guildId, userId, matchId, updates) {
  ensureProfile(guildId, userId);
  const history = profiles.guilds[guildId][userId].matchHistory || [];
  const matchIndex = history.findIndex(match => match.id === matchId);
  
  if (matchIndex === -1) {
    return false;
  }
  
  Object.assign(history[matchIndex], updates);
  saveProfiles();
  return true;
}

function deleteMatchFromHistory(guildId, userId, matchId) {
  ensureProfile(guildId, userId);
  const history = profiles.guilds[guildId][userId].matchHistory || [];
  const matchIndex = history.findIndex(match => match.id === matchId);
  
  if (matchIndex === -1) {
    return false;
  }
  
  history.splice(matchIndex, 1);
  saveProfiles();
  return true;
}

// Auto-incrémentation des journées
function getNextMatchday(guildId, userId) {
  const coach = getCoachProfile(guildId, userId);
  const history = getMatchHistory(guildId, userId, 100);
  
  if (!history.length) {
    return 1; // Premier match = J1
  }
  
  // Trouver la dernière journée en Ligue 1
  const ligue1Matches = history.filter(match => match.competition === 'Ligue 1');
  if (!ligue1Matches.length) {
    return coach.currentMatchday || 1;
  }
  
  const lastMatchday = Math.max(...ligue1Matches.map(match => match.matchday || 0));
  return lastMatchday + 1;
}

function incrementPressCounter(guildId, userId) {
  ensureProfile(guildId, userId);
  const profile = profiles.guilds[guildId][userId];
  
  if (!profile.coach) profile.coach = {};
  if (typeof profile.coach.pressCounter !== 'number') {
    profile.coach.pressCounter = 0;
  }
  
  // Incrémentation aléatoire de 2 à 4 avec chances égales
  const increment = Math.floor(Math.random() * 3) + 2;
  profile.coach.pressCounter = Math.min(10, profile.coach.pressCounter + increment);
  
  console.log(`[PRESS] Compteur incrémenté de +${increment} pour ${userId} → ${profile.coach.pressCounter}/10`);
  
  saveProfiles();
  return profile.coach.pressCounter;
}

function resetPressCounter(guildId, userId) {
  ensureProfile(guildId, userId);
  const profile = profiles.guilds[guildId][userId];
  
  if (!profile.coach) profile.coach = {};
  profile.coach.pressCounter = 0;
  
  saveProfiles();
}

function cancelPressSession(guildId, userId) {
  const key = `${guildId}-${userId}`;
  activePressSessions.delete(key);
}

function getPressCounter(guildId, userId) {
  ensureProfile(guildId, userId);
  const profile = profiles.guilds[guildId][userId];
  
  if (!profile.coach) return 0;
  return profile.coach.pressCounter || 0;
}

// NOUVEAU : Gestion des sessions de conférence de presse
function startPressSession(guildId, userId, questions, journalist) {
  const key = `${guildId}-${userId}`;
  activePressSessions.set(key, {
    questions,
    currentIndex: 0,
    journalist
  });
}

function getPressSession(guildId, userId) {
  const key = `${guildId}-${userId}`;
  return activePressSessions.get(key);
}

function advancePressSession(guildId, userId) {
  const key = `${guildId}-${userId}`;
  const session = activePressSessions.get(key);
  if (!session) return null;
  
  session.currentIndex++;
  if (session.currentIndex >= session.questions.length) {
    // Fin de la conférence
    activePressSessions.delete(key);
    return null;
  }
  
  return session;
}

function clearPressSession(guildId, userId) {
  const key = `${guildId}-${userId}`;
  activePressSessions.delete(key);
}

function resetGuildData(guildId) {
  if (profiles.guilds[guildId]) {
    delete profiles.guilds[guildId];
    saveProfiles();
    console.log(`[STORE] Données du serveur ${guildId} supprimées`);
  }
}

module.exports = {
  loadProfiles,
  saveProfiles,
  getTeam,
  setTeam,
  clearTeam,
  getBoard,
  setBoard,
  getCoachProfile,
  updateCoachProfile,
  addMatchToHistory,
  getMatchHistory,
  updateMatchInHistory,
  deleteMatchFromHistory,
  getNextMatchday,
  incrementPressCounter,
  resetPressCounter,
  cancelPressSession,
  getPressCounter,
  startPressSession,
  getPressSession,
  advancePressSession,
  clearPressSession,
  resetGuildData
};