// store.js — persistance simple en JSON: guildId -> userId -> { team }
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PROFILES_PATH = path.join(DATA_DIR, 'profiles.json');

let memory = { guilds: {} };
let saveTimer = null;

async function loadProfiles() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.promises.readFile(PROFILES_PATH, 'utf8');
    memory = JSON.parse(raw || '{"guilds":{}}');
    if (!memory.guilds) memory.guilds = {};
    console.log('[STORE] Profils chargés');
  } catch (e) {
    if (e.code === 'ENOENT') {
      memory = { guilds: {} };
      await saveNow();
      console.log('[STORE] Nouveau store initialisé');
    } else {
      console.error('[STORE] Erreur de lecture:', e);
    }
  }
}

function getTeam(guildId, userId) {
  return memory.guilds?.[guildId]?.[userId]?.team || null;
}

function setTeam(guildId, userId, team) {
  if (!memory.guilds[guildId]) memory.guilds[guildId] = {};
  if (!memory.guilds[guildId][userId]) memory.guilds[guildId][userId] = {};
  memory.guilds[guildId][userId].team = team;
  scheduleSave();
}

function clearTeam(guildId, userId) {
  if (memory.guilds?.[guildId]?.[userId]) {
    delete memory.guilds[guildId][userId].team;
    if (Object.keys(memory.guilds[guildId][userId]).length === 0) {
      delete memory.guilds[guildId][userId];
    }
    scheduleSave();
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 500); // Sauvegarde après 500ms d'inactivité
}

async function saveNow() {
  const tmp = PROFILES_PATH + '.tmp';
  const json = JSON.stringify(memory, null, 2);
  await fs.promises.writeFile(tmp, json, 'utf8');
  await fs.promises.rename(tmp, PROFILES_PATH); // Atomique pour éviter la corruption
}

function ensureGuild(gid){ if(!memory.guilds[gid]) memory.guilds[gid]={}; }
function ensureUser(gid, uid) {
  ensureGuild(gid);
  if (!memory.guilds[gid][uid]) memory.guilds[gid][uid] = {};
}

// === FONCTIONS BOARD (TABLEAU) ===

function getBoard(guildId){
  return memory.guilds?.[guildId]?._board || null; // { channelId, msgId }
}

function setBoard(guildId, channelId, msgId){
  ensureGuild(guildId);
  memory.guilds[guildId]._board = { channelId, msgId };
  scheduleSave();
}

function clearBoard(guildId){
  if (memory.guilds?.[guildId]?._board){
    delete memory.guilds[guildId]._board;
    scheduleSave();
  }
}

// === NOUVELLES FONCTIONS COACH PROFILE ===

function getCoachProfile(guildId, userId) {
  return memory.guilds?.[guildId]?.[userId]?.coach || null;
}

function setCoachProfile(guildId, userId, profile) {
  ensureUser(guildId, userId);
  if (!memory.guilds[guildId][userId].coach) {
    memory.guilds[guildId][userId].coach = {};
  }
  Object.assign(memory.guilds[guildId][userId].coach, profile);
  scheduleSave();
}

function updateCoachProfile(guildId, userId, updates) {
  ensureUser(guildId, userId);
  if (!memory.guilds[guildId][userId].coach) {
    memory.guilds[guildId][userId].coach = {};
  }
  Object.assign(memory.guilds[guildId][userId].coach, updates);
  scheduleSave();
}

// === NOUVELLES FONCTIONS HISTORIQUE MATCHS ===

function getMatchHistory(guildId, userId, limit = 10) {
  const matches = memory.guilds?.[guildId]?.[userId]?.matchHistory || [];
  return matches.slice(-limit).reverse(); // Les plus récents en premier
}

function addMatchToHistory(guildId, userId, matchData) {
  ensureUser(guildId, userId);
  if (!memory.guilds[guildId][userId].matchHistory) {
    memory.guilds[guildId][userId].matchHistory = [];
  }
  
  const match = {
    id: Date.now(),
    date: new Date().toISOString(),
    ...matchData
  };
  
  memory.guilds[guildId][userId].matchHistory.push(match);
  
  // Limite à 100 matchs max pour éviter la surcharge
  if (memory.guilds[guildId][userId].matchHistory.length > 100) {
    memory.guilds[guildId][userId].matchHistory = 
      memory.guilds[guildId][userId].matchHistory.slice(-100);
  }
  
  scheduleSave(); // ← SAUVEGARDE AUTOMATIQUE
  return match.id;
}

function updateMatchInHistory(guildId, userId, matchId, updates) {
  const matches = memory.guilds?.[guildId]?.[userId]?.matchHistory;
  if (!matches) return false;
  
  const match = matches.find(m => m.id === matchId);
  if (!match) return false;
  
  Object.assign(match, updates);
  scheduleSave();
  return true;
}

function deleteMatchFromHistory(guildId, userId, matchId) {
  const matches = memory.guilds?.[guildId]?.[userId]?.matchHistory;
  if (!matches) return false;
  
  const index = matches.findIndex(m => m.id === matchId);
  if (index === -1) return false;
  
  matches.splice(index, 1);
  scheduleSave();
  return true;
}

function getLastMatch(guildId, userId) {
  const matches = memory.guilds?.[guildId]?.[userId]?.matchHistory || [];
  return matches[matches.length - 1] || null;
}

// === NOUVELLES FONCTIONS COMPÉTITIONS ===

function getCompetitions(guildId, userId) {
  return memory.guilds?.[guildId]?.[userId]?.competitions || {};
}

function setCompetition(guildId, userId, competitionName, data) {
  ensureUser(guildId, userId);
  if (!memory.guilds[guildId][userId].competitions) {
    memory.guilds[guildId][userId].competitions = {};
  }
  memory.guilds[guildId][userId].competitions[competitionName] = data;
  scheduleSave();
}

function getCurrentCompetition(guildId, userId) {
  const coach = getCoachProfile(guildId, userId);
  return coach?.currentCompetition || null;
}

function getNextMatchday(guildId, userId) {
  const coach = getCoachProfile(guildId, userId);
  const currentCompetition = coach?.currentCompetition || 'Ligue 1';
  
  // Auto-incrémentation uniquement pour la Ligue 1
  if (currentCompetition === 'Ligue 1') {
    const matches = getMatchHistory(guildId, userId, 50); // Chercher dans plus d'historique
    
    // Trouver la journée la plus récente en Ligue 1
    const ligue1Matches = matches.filter(m => m.competition === 'Ligue 1' && m.matchday);
    
    if (ligue1Matches.length > 0) {
      const lastMatchday = Math.max(...ligue1Matches.map(m => m.matchday));
      return Math.min(lastMatchday + 1, 38); // Maximum 38 journées en Ligue 1
    }
    
    // Si aucun match avec journée trouvé, commencer à J1
    return 1;
  }
  
  // Pour les autres compétitions, utiliser la journée définie manuellement
  return coach?.currentMatchday || null;
}

module.exports = { 
  loadProfiles, getTeam, setTeam, clearTeam, getBoard, setBoard, clearBoard,
  // Nouvelles exports
  getCoachProfile, setCoachProfile, updateCoachProfile,
  getMatchHistory, addMatchToHistory, updateMatchInHistory, getLastMatch,
  getCompetitions, setCompetition, getCurrentCompetition,
  deleteMatchFromHistory, getNextMatchday
};