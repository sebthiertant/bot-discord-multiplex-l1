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
  saveTimer = setTimeout(saveNow, 500);
}

async function saveNow() {
  const tmp = PROFILES_PATH + '.tmp';
  const json = JSON.stringify(memory, null, 2);
  await fs.promises.writeFile(tmp, json, 'utf8');
  await fs.promises.rename(tmp, PROFILES_PATH);
}

module.exports = { loadProfiles, getTeam, setTeam, clearTeam };
