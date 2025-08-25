// index.js
require('dotenv').config();

const store = require('./store');
(async () => {
  await store.loadProfiles().catch(console.error);
  await client.login(TOKEN);
})();

// FFmpeg embarqué
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

const { generateQuestions } = require('./press');
const { generateMercatoAnnouncement, buildMercatoDisplayText } = require('./mercato.js');
const { buildEndingAnnouncement } = require('./ending.js');

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  generateDependencyReport,
} = require('@discordjs/voice');

const { synthToFile } = require('./tts.js');

// --- TEXTE TTS IMPORTS (keep only these, remove duplicates) ---
const { CLUB_VARIANTS, CONCEDING_TEAM_PHRASES } = require('./clubs.js');
const { OPENERS, CONCEDING_OPENERS, MINIMAL_OPENERS, ANNOUNCEMENT_PATTERNS, MINIMAL_TEMPLATES, weightedRandom } = require('./openers.js');
const { SCORER_TEMPLATES, FINISHING_SCORER_TEMPLATES, SCORER_FIRST_TEMPLATES, MINIMAL_SCORER_TEMPLATES, HUMILIATION_TEMPLATES } = require('./scorer.js');

console.log(generateDependencyReport());

// --- CONFIG ---
const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '!';
const ASSETS_DIR = 'assets';
const JINGLE_PATH = path.join(ASSETS_DIR, 'but.mp3');
const UCL_ANTHEM_PATH = path.join(ASSETS_DIR, 'ucl_anthem.mp3'); // Hymne Ligue des Champions
const EUROPA_ANTHEM_PATH = path.join(ASSETS_DIR, 'europa_anthem.mp3'); // Hymne Europa League
const FINAL_WHISTLE_PATH = path.join(ASSETS_DIR, 'final_whistle.mp3'); // Sifflet final

// --- ÉTATS ---
// Audio par serveur
const stateByGuild = new Map(); // guildId -> { connection, player, voiceChannelId, stay, queue:[], playing, _lastResource }
function getAudioState(guildId) { return stateByGuild.get(guildId); }

// Suivi de journée par serveur
const md = new Map();

// --- HELPERS COMMUNS ---
function normalizeKey(s) {
  return s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '') || null;
}

function getGuildDay(guildId) {
  let g = md.get(guildId);
  if (!g) {
    g = { matches: new Map(), boardMsgId: null };
    md.set(guildId, g);
  }
  return g;
}

function resetMatch(m, { keepTeam = true, keepOpp = true } = {}) {
  m.for = m.against = 0;
  m.minute = 0; delete m.minuteLabel;
  m.hist = [];
  m.status = 'IDLE';
  m.scorersFor = []; m.scorersAgainst = [];
  if (!keepOpp) m.opp = null;
}


async function ensureBoardMessage(client, guildId, channel) {
  const payload = renderBoard(guildId, client);
  const sent = await channel.send(payload);

  let pinned = false;
  let pinError = null;

  try {
    const me = channel.guild.members.me;
    const perms = channel.permissionsFor(me);
    if (perms?.has('ManageMessages')) {
      await sent.pin();                 // tente d’épingler
      pinned = true;
    } else {
      pinError = "Permission manquante: Manage Messages";
    }
  } catch (e) {
    pinError = e?.message || String(e); // ex: quota d’épingles atteint
  }

  store.setBoard(guildId, channel.id, sent.id);
  return { sent, pinned, pinError };
}

async function updateBoardMsg(client, guildId) {
  const meta = store.getBoard(guildId);
  if (!meta) return; // pas de board configuré
  try {
    const ch = await client.channels.fetch(meta.channelId);
    const msg = await ch.messages.fetch(meta.msgId);
    await msg.edit(renderBoard(guildId, client));
  } catch {
    // message supprimé → on recrée au même endroit
    try {
      const ch = await client.channels.fetch(meta.channelId);
      await ensureBoardMessage(client, guildId, ch);
    } catch { }
  }
}

// Rotation non-répétitive
let _openerIdx = 0;
let _scorerIdx = 0;
const _clubIdx = new Map(); // clubKey -> idx

function nextOpener() {
  if (!OPENERS?.length) return "Hé !";
  return weightedRandom(OPENERS);
}

function nextScorerTpl() {
  if (!SCORER_TEMPLATES?.length) return "But de {scorer} !";
  return weightedRandom(SCORER_TEMPLATES);
}

function nextClubVariant(clubKey, arr) {
  if (!arr?.length) return null;
  return weightedRandom(arr);
}

// Nouvelle fonction pour les phrases d'équipe qui encaisse
function getConcedingTeamPhrase(team) {
  const phrases = CONCEDING_TEAM_PHRASES.default || [];
  if (!phrases.length) return `La défense de ${team} qui craque`;
  const phrase = weightedRandom(phrases);
  return phrase.replace('{team}', team);
}

// --- TEXTE TTS ---
function getMatch(guildId, userId) {
  const g = getGuildDay(guildId);

  // 1) Récupère ou crée l’état du match pour l’utilisateur
  let m = g.matches.get(userId);
  if (!m) {
    m = { team: null, opp: null, for: 0, against: 0, minute: 0, status: 'IDLE', hist: [], scorersFor: [], scorersAgainst: [] };
    g.matches.set(userId, m);
  }

  // 2) Restaurer le club mémorisé (SI m existe déjà !)
  try {
    const saved = store.getTeam(guildId, userId);
    if (!m.team && saved) m.team = saved;
  } catch (e) {
    console.warn('[STORE] lecture échouée:', e);
  }

  return m;
}

function fmtMinDisplay(labelOrNum) {
  return (labelOrNum || labelOrNum === 0) ? `${labelOrNum}’` : '';
}

function renderBoard(guildId, client) {
  const g = getGuildDay(guildId);
  const lines = [];
  for (const [uid, m] of g.matches.entries()) {
    const user = client.users.cache.get(uid);
    const tag = user ? user.username : uid;
    const head = m.team || "—";
    const opp = m.opp || "—";

    const badge =
      m.status === 'H2' ? '🟢' :
        m.status === 'LIVE' ? '🟢' :
          m.status === 'HT' ? '🟡' :
            m.status === 'FT' ? '🔴' : '⚪';

    const phase =
      m.status === 'H2' ? '2e MT' :
        m.status === 'LIVE' ? 'LIVE' :
          m.status === 'HT' ? 'MT' :
            m.status === 'FT' ? 'FIN' : '';

    const min = fmtMinDisplay(m.minuteLabel ?? m.minute);
    lines.push(`**${tag}** — ${head} ${m.for}-${m.against} ${opp} ${min} ${badge} ${phase}`.trim());
  }
  return { content: lines.join("\n") || "Aucun match.", allowedMentions: { parse: [] } };
}

function buildTtsSentence(clubRaw, scorerRaw) {
  const clubKey = normalizeKey(clubRaw);
  const variants = clubKey && CLUB_VARIANTS[clubKey] ? CLUB_VARIANTS[clubKey] : null;

  const parts = [];
  parts.push(nextOpener()); // ex: "Hé !", "Oh oui !", …

  if (variants) {
    parts.push(nextClubVariant(clubKey, variants)); // varie entre les phrases du club avec pondération
  } else {
    parts.push(clubRaw ? `But pour ${clubRaw} !` : "But !");
  }

  if (scorerRaw) {
    const tpl = nextScorerTpl(); // varie entre les phrases buteur avec pondération
    parts.push(tpl.replace('{scorer}', scorerRaw));
  }

  return parts.join(' ');
}


function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// TODO A deplacer
// et parler aussi de l'équipe qui encaisse
const PHRASES = {
  takeLead: ["prend l’avantage.", "passe devant.", "prend les commandes."],
  extendLeadBreak: ["fait le break.", "creuse l’écart.", "se met à l’abri."],
  extendLead: ["creuse l’écart.", "accentue son avance."],
  equalize: ["égalise.", "revient à hauteur."],
  reduceGap: ["réduit l’écart.", "se relance."],
  weStillLead: ["conserve l’avantage.", "reste devant."]
};

// TODO gérer les buts dans les dernières minutes
// et parler aussi de l'équipe qui encaisse
// refacto avec des switch cases ?
function buildGoalAnnouncement(team, opp, f, a, minute, scorer, cmd) {
  const isFor = cmd === '!g';

  // Score AVANT le but
  const prevF = isFor ? f - 1 : f;
  const prevA = isFor ? a : a - 1;

  // Vérifier les cas d'humiliation spéciaux AVANT de choisir un pattern normal
  const scoringTeam = isFor ? team : opp;
  const concedingTeam = isFor ? opp : team;
  const scoringTeamScore = isFor ? f : a;
  const concedingTeamScore = isFor ? a : f;

  // Cas spéciaux d'humiliation
  if (concedingTeamScore === 0 && scoringTeamScore === 5) {
    // MANITA (5-0)
    const opener = weightedRandom(OPENERS);
    const template = weightedRandom(HUMILIATION_TEMPLATES.manita);
    let base = `${opener} ${template}`;

    // Remplacer les placeholders
    base = base.replace('{team}', scoringTeam || 'l\'équipe qui marque');
    base = base.replace('{conceding_team}', concedingTeam || 'l\'équipe adverse');
    if (scorer) {
      base = base.replace('{scorer}', scorer);
    } else {
      // Enlever la partie scorer si pas de buteur
      base = base.split('!')[0] + ' !'; // Garde juste la première partie
    }

    console.log(`[DEBUG] Pattern sélectionné: MANITA, isFor: ${isFor}, scorer: ${scorer || 'none'}`);

    // Lignes info
    const scoreLine = (team && opp) ? `${team} ${f}, ${opp} ${a}.` : '';
    const minuteLine = minute ? `${minute}e minute.` : '';

    return [base, scoreLine, minuteLine]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (concedingTeamScore === 0 && scoringTeamScore === 10) {
    // FANNI (10-0)
    const opener = weightedRandom(OPENERS);
    const template = weightedRandom(HUMILIATION_TEMPLATES.fanni);
    let base = `${opener} ${template}`;

    // Remplacer les placeholders
    base = base.replace('{conceding_team}', concedingTeam || 'l\'équipe qui encaisse');
    if (scorer) {
      // Pour le fanni, on peut ajouter le buteur à la fin
      base += ` Et c'est ${scorer} qui porte le coup de grâce !`;
    }

    console.log(`[DEBUG] Pattern sélectionné: FANNI, isFor: ${isFor}, scorer: ${scorer || 'none'}`);

    // Lignes info
    const scoreLine = (team && opp) ? `${team} ${f}, ${opp} ${a}.` : '';
    const minuteLine = minute ? `${minute}e minute.` : '';

    return [base, scoreLine, minuteLine]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Si pas de cas spécial, continuer avec la logique normale
  // Sélectionner un pattern d'annonce de façon pondérée
  const patternObj = weightedRandom(ANNOUNCEMENT_PATTERNS);
  const pattern = patternObj.type;

  let base = '';

  switch (pattern) {
    case 'classic': {
      // Pattern classique : Opener + Club + Scorer
      base = buildTtsSentence(isFor ? team : opp, scorer);
      break;
    }

    case 'scorer_first': {
      // Pattern buteur en premier : Opener + Scorer + Club
      if (scorer && team && opp) {
        const opener = weightedRandom(OPENERS);
        const scorerTemplate = weightedRandom(SCORER_FIRST_TEMPLATES);
        const clubName = isFor ? team : opp;

        base = `${opener} ${scorerTemplate.replace('{scorer}', scorer)} pour ${clubName} !`;
      } else {
        // Fallback vers pattern classique si pas assez d'infos
        base = buildTtsSentence(isFor ? team : opp, scorer);
      }
      break;
    }

    case 'scorer_only': {
      // Pattern sans club : focus sur le buteur
      if (scorer) {
        const opener = weightedRandom(OPENERS);
        const scorerTemplate = weightedRandom(SCORER_TEMPLATES);

        base = `${opener} ${scorerTemplate.replace('{scorer}', scorer)}`;
      } else {
        // Fallback : juste l'opener + "But !"
        const opener = weightedRandom(OPENERS);
        base = `${opener} But !`;
      }
      break;
    }

    case 'conceding': {
      // Pattern défense qui craque
      if (team && opp) {
        // FIX: Toujours parler de l'équipe qui encaisse, peu importe qui marque
        const concedingTeam = isFor ? opp : team;
        const concedingPhrase = getConcedingTeamPhrase(concedingTeam);
        const concedingOpener = weightedRandom(CONCEDING_OPENERS);

        base = `${concedingOpener} ${concedingPhrase}.`;

        if (scorer) {
          // Utiliser le bon template selon le contexte du score
          const scoringTeamScore = isFor ? f : a;
          const concedingTeamScore = isFor ? a : f;

          // Si l'équipe qui marque prend 2+ buts d'avance, utiliser les finishing templates
          if (scoringTeamScore - concedingTeamScore >= 2) {
            const finishingTemplate = weightedRandom(FINISHING_SCORER_TEMPLATES);
            base += ` ${finishingTemplate.replace('{scorer}', scorer)}`;
          } else {
            // Sinon, utiliser les templates normaux
            const normalTemplate = weightedRandom(SCORER_TEMPLATES);
            base += ` ${normalTemplate.replace('{scorer}', scorer)}`;
          }
        }
      } else {
        // Fallback vers pattern classique
        base = buildTtsSentence(isFor ? team : opp, scorer);
      }
      break;
    }

    case 'minimal': {
      // Pattern minimaliste : très direct
      if (scorer) {
        const template = weightedRandom(MINIMAL_TEMPLATES);
        base = template.replace('{scorer}', scorer);
      } else {
        const opener = weightedRandom(MINIMAL_OPENERS);
        base = `${opener} But !`;
      }
      break;
    }

    default: {
      // Fallback sécurisé
      base = buildTtsSentence(isFor ? team : opp, scorer);
      break;
    }
  }

  // Debug pour vérifier les patterns utilisés
  console.log(`[DEBUG] Pattern sélectionné: ${pattern}, isFor: ${isFor}, scorer: ${scorer || 'none'}`);

  // Lignes info
  const scoreLine = (team && opp) ? `${team} ${f}, ${opp} ${a}.` : '';
  const minuteLine = minute ? `${minute}e minute.` : '';

  // Ligne statut en fonction de l'évolution du score
  let statusLine = '';
  if (team && opp) {
    if (isFor) {
      if (prevF < prevA && f === a) statusLine = `${team} ${pick(PHRASES.equalize)}`;
      else if (prevF === prevA && f > a) statusLine = `${team} ${pick(PHRASES.takeLead)}`;
      else if (prevF > prevA && f > a) {
        const newMargin = f - a;
        statusLine = `${team} ${pick(newMargin === 2 ? PHRASES.extendLeadBreak : PHRASES.extendLead)}`;
      } else if (prevF < prevA && f < a) statusLine = `${team} ${pick(PHRASES.reduceGap)}`;
      else statusLine = '';
    } else {
      if (prevF > prevA && a === f) statusLine = `${opp} ${pick(PHRASES.equalize)}`;
      else if (prevF === prevA && a > f) statusLine = `${opp} ${pick(PHRASES.takeLead)}`;
      else if (prevF < prevA && a > f) {
        const newMargin = a - f;
        statusLine = `${opp} ${pick(newMargin === 2 ? PHRASES.extendLeadBreak : PHRASES.extendLead)}`;
      } else if (prevF > prevA && a < f) statusLine = `${team} ${pick(PHRASES.weStillLead)}`;
      else statusLine = '';
    }
  }

  return [base, scoreLine, statusLine, minuteLine]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Supprime tous les messages du salon (épinglés inclus)
async function purgeChannel(channel) {
  const me = channel.guild.members.me;
  const perms = channel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.ManageMessages) || !perms?.has(PermissionFlagsBits.ReadMessageHistory)) {
    throw new Error("Permissions requises : Gérer les messages + Lire l'historique.");
  }

  // 1) Désépingler + supprimer les pins
  try {
    const pins = await channel.messages.fetchPinned();
    for (const [, msg] of pins) {
      try { await msg.unpin().catch(() => { }); } catch { }
      if (msg.deletable) { await msg.delete().catch(() => { }); }
    }
  } catch { }

  // 2) Purge normale (bulk < 14j, sinon un par un)
  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!batch || batch.size === 0) break;

    const younger = batch.filter(m => (Date.now() - m.createdTimestamp) < TWO_WEEKS);
    const older = batch.filter(m => !younger.has(m.id));

    if (younger.size) {
      await channel.bulkDelete(younger, true).catch(() => { });
    }
    for (const [, msg] of older) {
      if (msg.deletable) { await msg.delete().catch(() => { }); }
    }

    if (batch.size < 100) break;
  }
}

// --- AUDIO ---
async function ensureConnection(voiceChannel, stayFlag = false) {
  const guildId = voiceChannel.guild.id;
  let st = stateByGuild.get(guildId);

  if (st?.connection && st.voiceChannelId === voiceChannel.id) {
    st.stay = stayFlag || st.stay;
    return st;
  }
  if (st?.connection) safeDestroy(guildId);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  const player = createAudioPlayer();
  connection.subscribe(player);

  st = { connection, player, voiceChannelId: voiceChannel.id, stay: stayFlag, queue: [], playing: false, _lastResource: null };
  player.on(AudioPlayerStatus.Playing, () => console.log('[PLAYER] Playing'));
  player.on(AudioPlayerStatus.Buffering, () => console.log('[PLAYER] Buffering'));
  player.on(AudioPlayerStatus.Idle, () => {
    const last = st._lastResource;
    if (last?.metadata?.tempPath) fs.promises.unlink(last.metadata.tempPath).catch(() => { });
    if (st.queue.length > 0) {
      const next = st.queue.shift(); st._lastResource = next; player.play(next);
    } else {
      st.playing = false;
      if (!st.stay) { setTimeout(() => safeDestroy(guildId), 1200); }
    }
  });
  connection.on(VoiceConnectionStatus.Disconnected, () => console.log('[VOICE] Disconnected'));
  connection.on(VoiceConnectionStatus.Destroyed, () => console.log('[VOICE] Destroyed'));

  stateByGuild.set(guildId, st);
  console.log('[VOICE] Ready in', voiceChannel.name);
  return st;
}

function enqueue(guildId, resources) {
  const st = stateByGuild.get(guildId);
  if (!st) return;
  st.queue.push(...resources);
  if (!st.playing) {
    st.playing = true;
    const first = st.queue.shift();
    st._lastResource = first;
    st.player.play(first);
  }
}

function safeDestroy(guildId) {
  const st = stateByGuild.get(guildId);
  if (!st) return;
  try { st.connection.destroy(); } catch { }
  for (const r of st.queue) if (r?.metadata?.tempPath) { try { fs.unlinkSync(r.metadata.tempPath); } catch { } }
  stateByGuild.delete(guildId);
}

// Jingle+TTS
async function enqueueJingleAndTTS(guildId, text) {
  const j = createAudioResource(JINGLE_PATH);
  const ttsPath = path.join(ASSETS_DIR, `tts_${Date.now()}.mp3`);
  await synthToFile(text, ttsPath, "fr-FR-HenriNeural");
  const t = createAudioResource(ttsPath); t.metadata = { tempPath: ttsPath };
  enqueue(guildId, [j, t]);
}

// TTS seul (sans jingle) pour les annonces de fin de match
async function enqueueTTSOnly(guildId, text) {
  const ttsPath = path.join(ASSETS_DIR, `tts_${Date.now()}.mp3`);
  await synthToFile(text, ttsPath, "fr-FR-HenriNeural");
  const t = createAudioResource(ttsPath); t.metadata = { tempPath: ttsPath };
  enqueue(guildId, [t]);
}

// --- CLIENT ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// auto-leave si salon vide
client.on('voiceStateUpdate', (oldState, newState) => {
  const guildId = newState.guild?.id || oldState.guild?.id;
  const st = stateByGuild.get(guildId);
  if (!st || !st.stay || !st.voiceChannelId) return;
  const channel = newState.guild.channels.cache.get(st.voiceChannelId) || oldState.guild.channels.cache.get(st.voiceChannelId);
  if (!channel || channel.type !== 2) return;
  const nonBot = channel.members.filter(m => !m.user.bot);
  if (nonBot.size === 0) {
    console.log('[AUTO] Salon vide → déconnexion');
    safeDestroy(guildId);
  }
});

// --- COMMANDES TEXTE ---
client.on('messageCreate', async (msg) => {
  try {
    if (msg.author.bot || !msg.guildId) return;

    const content = msg.content?.trim() ?? '';
    if (!content.startsWith(PREFIX)) return;

    const [cmd, ...rest] = content.split(/\s+/);
    const guildId = msg.guildId;
    const userId = msg.author.id;
    const st = getAudioState(guildId);

    // ===== Hymnes UEFA =====
    if (cmd === '!ldc') {
      if (!st?.connection) {
        await msg.reply("Je ne suis pas connecté. Lance d'abord `!multiplex`.");
        return;
      }

      const success = await playAudioFile(guildId, UCL_ANTHEM_PATH);
      if (success) {
        await msg.react('🎵');
      } else {
        await msg.reply("❌ Fichier `ucl_anthem.mp3` introuvable dans le dossier assets.");
      }
      return;
    }

    if (cmd === '!eur') {
      if (!st?.connection) {
        await msg.reply("Je ne suis pas connecté. Lance d'abord `!multiplex`.");
        return;
      }

      const success = await playAudioFile(guildId, EUROPA_ANTHEM_PATH);
      if (success) {
        await msg.react('🎵');
      } else {
        await msg.reply("❌ Fichier `europa_anthem.mp3` introuvable dans le dossier assets.");
      }
      return;
    }

    // ====== Persistance profil ======
    if (cmd === '!whoami') {
      const saved = store.getTeam(guildId, msg.author.id);
      return void msg.reply(saved ? `Ton club mémorisé : **${saved}**`
        : "Aucun club mémorisé. Utilise `!me <club>`.");
    }

    if (cmd === '!forgetme') {
      store.clearTeam(guildId, msg.author.id);
      const m = getMatch(guildId, msg.author.id);
      m.team = null;
      return void msg.react('🗑️');
    }
    // ====== Persistance profil ======

    // ===== multiplex (join/leave toggle) =====
    if (cmd === '!multiplex') {
      const voiceChannel = msg.member?.voice?.channel;
      if (st?.connection && st.stay) {
        await msg.reply("🔌 Multiplex désactivé. Je me déconnecte.");
        safeDestroy(guildId);
        return;
      }
      if (!voiceChannel) {
        await msg.reply("Rejoins d’abord un salon vocal, puis refais `!multiplex`.");
        return;
      }
      await ensureConnection(voiceChannel, true);
      await msg.reply(`🎛️ Multiplex activé dans **${voiceChannel.name}**. J’y reste jusqu’à ce qu’il n’y ait plus personne ou jusqu’à \`!multiplex\`.`);
      return;
    }

    // ===== Suivi de journée =====
    const m = getMatch(guildId, msg.author.id);

    if (cmd === '!me') {
      const team = rest.join(' ').trim();
      if (!team) return void msg.reply("Utilise : `!me <ton club>`");
      m.team = team;
      store.setTeam(guildId, msg.author.id, team);
      await msg.reply(`✅ Club défini : **${m.team}**`);
      await updateBoardMsg(client, guildId);
      return;
    }

    if (cmd === '!vs') {
      const opp = rest.join(' ').trim();
      if (!opp) return void msg.reply("Utilise : `!vs <adversaire>`");

      const wasFT = m.status === 'FIN';
      const isNewOpp = !m.opp || m.opp.toLowerCase() !== opp.toLowerCase();

      if (wasFT || isNewOpp) {
        resetMatch(m, { keepTeam: true, keepOpp: true }); // on garde le club et on va fixer l’opp juste après
      }

      m.opp = opp;
      await msg.reply(`🤝 Adversaire : **${m.opp}**${(wasFT || isNewOpp) ? " — score remis à 0." : ""}`);
      await updateBoardMsg(client, guildId);
      return;
    }


    if (cmd === '!st' || cmd === '!ko') {            // <- accepte !st (nouveau) et !ko (alias)
      if (m.status === 'FT') {
        resetMatch(m, { keepTeam: true, keepOpp: true });
      }
      m.status = 'LIVE';
      if (m.minute == null) m.minute = 0;

      // message adapté
      const aliasNote = (cmd === '!ko') ? " (alias `!ko` encore supporté)" : "";
      await msg.reply(`🟢 Début du match !${aliasNote}`);

      await updateBoardMsg(client, guildId);
      return;
    }

    if (cmd === '!mt') {
      m.status = 'MT';
      m.minute = 45;
      m.minuteLabel = '45';
      await msg.reply('🟡 Mi-temps.');
      await updateBoardMsg(client, guildId);
      return;
    }

    // 🟢 Début de la seconde période → minute min 46
    if (cmd === '!2nd') {
      m.status = 'H2';
      if ((m.minute ?? 0) < 46) {
        m.minute = 46;
        m.minuteLabel = '46';
      }
      await msg.reply('🟢 Début de la seconde période (46’).');
      await updateBoardMsg(client, guildId);
      return;
    }

    if (cmd === '!fin') {
      const st = getAudioState(guildId);

      m.status = 'FIN';
      m.minute = 90;
      m.minuteLabel = '90';

      // Générer et jouer l'annonce de fin de match (SANS jingle)
      if (st?.connection && m.team && m.opp) {
        // 1. Jouer le coup de sifflet final
        const whistleRes = createAudioResource(FINAL_WHISTLE_PATH);
        // 2. Générer le TTS de l'annonce de fin
        const endingText = buildEndingAnnouncement(m.team, m.opp, m.for, m.against);
        const ttsPath = path.join(ASSETS_DIR, `tts_${Date.now()}.mp3`);
        await synthToFile(endingText, ttsPath, "fr-FR-HenriNeural");
        const ttsRes = createAudioResource(ttsPath); ttsRes.metadata = { tempPath: ttsPath };
        // 3. Enqueue whistle then TTS
        enqueue(guildId, [whistleRes, ttsRes]);
      }

      // Sauvegarder automatiquement le match dans l'historique
      if (m.team && m.opp) {
        const coach = store.getCoachProfile(guildId, userId);
        const competition = coach?.currentCompetition || 'Ligue 1';

        // Auto-incrémentation pour la journée de Ligue 1
        let matchday = null;
        if (competition === 'Ligue 1') {
          // FIX: Utiliser le compteur du profil coach au lieu de calculer depuis l'historique
          const currentMatchday = coach?.currentMatchday || 1;
          matchday = currentMatchday;
          // Mettre à jour le profil coach avec la nouvelle journée (incrémentation pour le prochain match)
          store.updateCoachProfile(guildId, userId, { currentMatchday: currentMatchday + 1 });
        } else {
          // Pour les autres compétitions, utiliser la journée définie manuellement
          matchday = coach?.currentMatchday || null;
        }

        const matchData = {
          team: m.team,
          opponent: m.opp,
          scoreFor: m.for,
          scoreAgainst: m.against,
          competition: competition,
          matchday: matchday,
          scorersFor: m.scorersFor || [],
          scorersAgainst: m.scorersAgainst || []
        };

        store.addMatchToHistory(guildId, userId, matchData);

        const pressCounter = store.incrementPressCounter(guildId, userId);
        const autoInfo = competition === 'Ligue 1' && matchday ? ` (J${matchday} auto-assignée)` : '';

        let replyMessage = `🔴 Fin du match. (Ajouté automatiquement à l'historique${autoInfo})`;

        // Déclenchement automatique de la conférence de presse
        if (pressCounter >= 10) {
          try {
            // Générer la conférence de presse
            const recentMatches = store.getMatchHistory(guildId, userId, 5);
            const lastMatch = recentMatches[0];

            const ctx = {
              coach: coach?.name || msg.member?.displayName || msg.author.username,
              team: lastMatch.team || 'votre équipe',
              opp: lastMatch.opponent || 'l\'adversaire',
              for: lastMatch.scoreFor || 0,
              against: lastMatch.scoreAgainst || 0,
              scorersFor: lastMatch.scorersFor || [],
              scorersAgainst: lastMatch.scorersAgainst || [],
              phase: lastMatch.competition || 'Ligue 1',
              matchday: lastMatch.matchday,
              nationality: coach?.nationality,
              age: coach?.age,
              currentSeason: coach?.currentSeason,
              recentMatches: recentMatches.slice(1).map(match => ({
                opponent: match.opponent,
                result: `${match.scoreFor}-${match.scoreAgainst}`,
                competition: match.competition,
                matchday: match.matchday,
                scorersFor: match.scorersFor || [],
                scorersAgainst: match.scorersAgainst || [],
                date: match.date
              }))
            };

            const pressResult = await generateQuestions(ctx, 3);
            const journalist = pressResult.journalist || { name: "Journaliste", media: "Média Sport" };
            const questions = pressResult.questions || [];

            // Démarrer la session de conférence de presse
            store.startPressSession(guildId, userId, questions, journalist);
            store.resetPressCounter(guildId, userId);

            replyMessage += `\n\n🎙️ **CONFÉRENCE DE PRESSE DÉCLENCHÉE !**\n${pressResult.presentation}\n\n💡 Tapez \`!conf\` pour commencer la conférence de presse.`;
            replyMessage += `\n\n❌ Tapez \`!no\` pour annuler la conférence de presse.`;

            // NOUVEAU : Lire la présentation en audio si connecté
            const st = getAudioState(guildId);
            if (st?.connection) {
              await playPressAudio(guildId, pressResult.presentation, journalist, 'presentation');
            }

          } catch (error) {
            console.error('[PRESS AUTO] Erreur génération:', error);
            replyMessage += `\n\n🎙️ Conférence de presse déclenchée mais erreur de génération. Utilisez \`!conf --force\`.`;
          }
        }

        await msg.reply(replyMessage);
      } else {
        const audioInfo = st?.connection ? ' + annonce vocale' : '';
        await msg.reply(`🔴 Fin du match.${audioInfo}`);
      }

      await updateBoardMsg(client, guildId);
      return;
    }

    if (cmd === '!min') {
      const n = parseInt(rest[0], 10);
      if (Number.isNaN(n)) return void msg.reply("Utilise : `!min <minute>`");
      m.minute = Math.max(0, n);
      await msg.reply(`⏱️ Minute réglée sur **${m.minute}’**`);
      await updateBoardMsg(client, guildId);
      return;
    }

    if (cmd === '!undo') {
      const last = m.hist.pop();
      if (!last) return void msg.reply("Rien à annuler.");
      Object.assign(m, last.prev);
      await msg.reply('↩️ Dernière action annulée.');
      await updateBoardMsg(client, guildId);
      return;
    }

    if (cmd === '!g' || cmd === '!gc') {
      const st = getAudioState(guildId);
      if (!st?.connection) {
        await msg.reply("Je ne suis pas connecté. Lance d'abord `!multiplex`.");
        return;
      }
      // !g [minute] [buteur…]
      let minute = null, scorer = null;
      if (rest.length && /^\d+$/.test(rest[0])) minute = parseInt(rest.shift(), 10);
      if (minute != null) m.minute = Math.max(0, minute);
      if (rest.length) scorer = rest.join(' ');

      m.hist.push({ prev: { ...m } });

      // Mise à jour score et tracking des buteurs pour conférence de presse
      if (cmd === '!g') {
        m.for++;
        if (scorer) m.scorersFor.push(`${scorer}${m.minute ? ` (${m.minute}')` : ''}`);
      } else {
        m.against++;
        if (scorer) m.scorersAgainst.push(`${scorer}${m.minute ? ` (${m.minute}')` : ''}`);
      }

      const text = buildGoalAnnouncement(m.team, m.opp, m.for, m.against, m.minute, scorer, cmd);
      await enqueueJingleAndTTS(guildId, text);

      await msg.reply(
        `${cmd === '!g' ? '⚽' : '🥅'} ${m.team || '—'} ${m.for}-${m.against} ${m.opp || '—'} ${m.minute ? `${m.minute}'` : ''}`
          .replace(/\s+/g, ' ').trim()
      );
      await updateBoardMsg(client, guildId);
      return;
    }

    if (cmd === '!boardset') {
      const target =
        msg.mentions.channels.first() ||
        msg.guild.channels.cache.get(rest[0]) ||
        msg.channel;

      if (!target || target.type !== ChannelType.GuildText) {
        return void msg.channel.send("Indique un salon texte valide : `!boardset #multiplex-board`");
      }

      // 🔥 Purge AVANT toute réponse
      try {
        await purgeChannel(target);
      } catch (e) {
        return void msg.channel.send(`Impossible de nettoyer ${target}: ${e?.message || e}`);
      }

      const existing = store.getBoard(guildId);
      const { sent, pinned, pinError } = await ensureBoardMessage(client, guildId, target);

      if (existing && (existing.channelId !== target.id || existing.msgId !== sent.id)) {
        try {
          const oldCh = await client.channels.fetch(existing.channelId);
          const oldMsg = await oldCh.messages.fetch(existing.msgId);
          await oldMsg.delete();
        } catch { }
      }

      await msg.channel.send(
        pinned
          ? `📌 Tableau initialisé dans ${target} et **épinglé** (canal nettoyé).`
          : `📌 Tableau initialisé dans ${target}, **non épinglé**. Détail: ${pinError || 'inconnu'}`
      );
      return;
    }

     // ===== NOUVELLE COMMANDE MERCATO =====
    if (cmd === '!mercato') {
      if (!st?.connection) {
        await msg.reply("Je ne suis pas connecté. Lance d'abord `!multiplex`.");
        return;
      }

      if (rest.length < 3) {
        await msg.reply("Utilise : `!mercato <montant_millions> <club_origine> <joueur>`\nExemple : `!mercato 180 \"Paris Saint-Germain\" \"Kylian Mbappé\"`");
        return;
      }

      // Récupérer le club de l'utilisateur
      const m = getMatch(guildId, userId);
      const userClub = m.team || store.getTeam(guildId, userId);

      if (!userClub) {
        await msg.reply("Définis d'abord ton club avec `!me <club>` avant d'annoncer un transfert !");
        return;
      }

      // NOUVEAU ORDRE : montant, club origine, puis joueur
      const [amountStr, fromClub, ...playerNameParts] = rest;
      const amount = parseInt(amountStr, 10);
      const playerName = playerNameParts.join(' ');

      if (isNaN(amount) || amount < 0) {
        await msg.reply("Le montant doit être un nombre en millions d'euros (ex: 50 pour 50M€).");
        return;
      }

      if (!fromClub.trim()) {
        await msg.reply("Précise le club d'origine du joueur.");
        return;
      }

      if (!playerName.trim()) {
        await msg.reply("Précise le nom du joueur.");
        return;
      }

      try {
        // Récupérer le nom du coach depuis le store
        const coach = store.getCoachProfile(guildId, userId);
        const coachName = coach?.name || msg.member?.displayName || msg.author.username;

        // Générer l'annonce audio avec le nom du coach
        const audioPath = await generateMercatoAnnouncement(
          playerName.replace(/['"]/g, ''), // Enlever les guillemets
          amount,
          fromClub.replace(/['"]/g, ''), // Enlever les guillemets du club aussi
          userClub,
          coachName // Passer le nom du coach pour l'audio aussi
        );

        // Jouer l'audio
        const resource = createAudioResource(audioPath);
        resource.metadata = { tempPath: audioPath };
        enqueue(guildId, [resource]);

        // Afficher le texte stylisé une fois tout prêt
        const displayText = buildMercatoDisplayText(
          playerName.replace(/['"]/g, ''),
          amount,
          fromClub.replace(/['"]/g, ''),
          userClub,
          coachName // Passer le nom du coach pour l'affichage aussi
        );

        await msg.channel.send(displayText);

      } catch (error) {
        console.error('[MERCATO] Erreur:', error);
        await msg.reply("❌ Erreur lors de la génération de l'annonce mercato.");
      }
      return;
    }

    if (cmd === '!conf') {
      // Vérifier si --force est utilisé et extraire l'ID journaliste
      const isForced = rest.includes('--force');
      const filteredRest = rest.filter(arg => arg !== '--force');
      let journalistId = null;
      let n = undefined;

      // FIX: Parsing des arguments amélioré
      if (filteredRest.length > 0) {
        const firstArg = parseInt(filteredRest[0], 10);
        if (!isNaN(firstArg)) {
          if (isForced && filteredRest.length > 1) {
            // Mode debug : !conf --force [questions] [journalistId]
            n = firstArg;
            const secondArg = parseInt(filteredRest[1], 10);
            if (!isNaN(secondArg)) {
              journalistId = secondArg;
            }
          } else if (isForced) {
            // Mode debug : !conf --force [journalistId ou questions]
            // Si l'argument est >= 1 et <= 5, c'est probablement le nombre de questions
            // Si l'argument est > 5, c'est probablement un ID journaliste
            if (firstArg >= 1 && firstArg <= 5) {
              n = firstArg; // Nombre de questions
            } else {
              journalistId = firstArg; // ID journaliste
            }
          } else {
            // Mode normal : !conf [questions]
            n = firstArg;
          }
        }
      }

      // Vérifier s'il y a une session active
      const activeSession = store.getPressSession(guildId, userId);

      if (activeSession) {
        // Continuer la session active
        const currentQ = activeSession.questions[activeSession.currentIndex];
        const isLastQuestion = activeSession.currentIndex === activeSession.questions.length - 1;

        let questionText = currentQ;
        if (isLastQuestion) {
          questionText += questionText.endsWith('.') ? ' Merci.' : '. Merci.';
        }

        const matchInfo = `Q${activeSession.currentIndex + 1}/${activeSession.questions.length}`;
        await msg.channel.send(`🎙️ **${matchInfo}** — ${questionText}`);

        // Lire la question au vocal si connecté
        const st = getAudioState(guildId);
        if (st?.connection) {
          await playPressAudio(guildId, questionText, activeSession.journalist, 'question');
        }

        // Avancer ou terminer la session
        const nextSession = store.advancePressSession(guildId, userId);
        if (!nextSession) {
          await msg.channel.send("📝 **Fin de la conférence de presse.** Merci !");
        } else {
          await msg.channel.send(`💡 Tapez \`!conf\` pour la question suivante (${nextSession.currentIndex + 1}/${nextSession.questions.length}).`);
        }

        return;
      }

      // Si pas de session active et pas de --force, refuser
      if (!isForced) {
        return void msg.reply("❌ Aucune conférence de presse en cours. Les conférences se déclenchent automatiquement après plusieurs matchs ou utilisez `!conf --force` pour en forcer une.");
      }

      // Logique pour démarrer une nouvelle conférence (SEULEMENT si forcée)
      const coach = store.getCoachProfile(guildId, userId);
      const recentMatches = store.getMatchHistory(guildId, userId, 5);

      if (recentMatches.length === 0) {
        return void msg.reply("Aucun match dans l'historique. Termine un match avec `!fin` pour générer une conférence de presse.");
      }

      // Le dernier match (le plus récent) devient le contexte principal
      const lastMatch = recentMatches[0];

      const ctx = {
        coach: coach?.name || msg.member?.displayName || msg.author.username,
        team: lastMatch.team || 'votre équipe',
        opp: lastMatch.opponent || 'l\'adversaire',
        for: lastMatch.scoreFor || 0,
        against: lastMatch.scoreAgainst || 0,
        scorersFor: lastMatch.scorersFor || [],
        scorersAgainst: lastMatch.scorersAgainst || [],
        phase: lastMatch.competition || 'Ligue 1',
        matchday: lastMatch.matchday,
        nationality: coach?.nationality,
        age: coach?.age,
        currentSeason: coach?.currentSeason,
        recentMatches: recentMatches.slice(1).map(match => ({
          opponent: match.opponent,
          result: `${match.scoreFor}-${match.scoreAgainst}`,
          competition: match.competition,
          matchday: match.matchday,
          scorersFor: match.scorersFor || [],
          scorersAgainst: match.scorersAgainst || [],
          date: match.date
        }))
      };

      const pressResult = await generateQuestions(ctx, n || 3, journalistId); // FIX: 3 par défaut
      const presentation = pressResult.presentation || `Bonjour coach ${ctx.coach}, journaliste.`;
      const qs = pressResult.questions || [];
      const journalist = pressResult.journalist || { name: "Journaliste", media: "Média Sport" };

      // Mode classique avec --force : afficher toutes les questions d'un coup
      const lines = qs.map((q, i) => `**Q${i + 1}.** ${q}`).join('\n');
      const matchInfo = `${ctx.team} ${ctx.for}-${ctx.against} ${ctx.opp}${ctx.matchday ? ` (J${ctx.matchday})` : ''}`;
      
      const debugInfo = journalistId ? ` — Debug: ${journalist.name} (ID: ${journalist.id})` : '';
      const fullMessage = `🎙️ **Conférence de presse (forcée)** — ${matchInfo}${debugInfo}\n\n${presentation}\n\n${lines}`;
      await msg.channel.send({ content: fullMessage });

      // FIX: Supprimer la duplication - utiliser SEULEMENT playPressAudio
      const st = getAudioState(guildId);
      if (st?.connection) {
        // Présentation
        await playPressAudio(guildId, presentation, journalist, 'presentation');

        // Questions une par une
        for (const q of qs) {
          await playPressAudio(guildId, q, journalist, 'question');
        }
      }

      return;
    }

    if (cmd === '!journalistes' || cmd === '!journalists') {
      const { getAllJournalists } = require('./press');
      const allJournalists = getAllJournalists();
      
      if (allJournalists.length === 0) {
        return void msg.reply("Aucun journaliste disponible.");
      }

      const lines = ["📰 **Liste des journalistes disponibles :**"];
      allJournalists.forEach(j => {
        lines.push(`**ID ${j.id}** — ${j.name} (${j.media})`);
      });
      
      lines.push('');
      lines.push('💡 Utilise `!conf --force [journalistId]` pour forcer un journaliste spécifique');
      lines.push('💡 Exemple : `!conf --force 2` pour Daniel Riolo');

      // Diviser en plusieurs messages si trop long
      const maxLength = 2000;
      let currentMessage = '';
      
      for (const line of lines) {
        if ((currentMessage + line + '\n').length > maxLength) {
          await msg.reply(currentMessage);
          currentMessage = line + '\n';
        } else {
          currentMessage += line + '\n';
        }
      }
      
      if (currentMessage.trim()) {
        await msg.reply(currentMessage);
      }
      
      return;
    }


    // ===== Suivi de journée =====

    // ===== But simple =====
    if (cmd.startsWith('!but')) {
      if (!st?.connection) {
        await msg.reply("Je ne suis pas connecté. Lance d’abord `!multiplex`.");
        return;
      }
      const restStr = cmd.slice('!but'.length);
      let club = null, scorer = null;
      if (restStr.startsWith('-')) {
        const parts = restStr.slice(1).split('-');
        club = parts[0] || null;
        if (parts.length > 1) scorer = parts.slice(1).join(' ');
      }
      const text = buildTtsSentence(club, scorer);
      await enqueueJingleAndTTS(guildId, text);
      await msg.react('🎙️');
      return;
    }

    // ====== NOUVELLES COMMANDES COACH PROFILE ======

    if (cmd === '!no') {
      // Vérifier s'il y a une session de conférence de presse active
      const activeSession = store.getPressSession(guildId, userId);
      
      if (!activeSession) {
        return void msg.reply("❌ Aucune conférence de presse en cours à annuler.");
      }
      
      store.cancelPressSession(guildId, userId);
      await msg.reply("✅ Conférence de presse annulée.");
      return;
    }

    if (cmd === '!coach') {
      const profile = store.getCoachProfile(guildId, userId);
      if (!profile || Object.keys(profile).length === 0) {
        return void msg.reply("Aucun profil coach configuré. Utilise `!coach-set nom <nom>` pour commencer.");
      }

      const lines = [];
      lines.push(`👤 **Profil Coach** — ${msg.author.username}`);
      if (profile.name) lines.push(`Nom : ${profile.name}`);
      if (profile.nationality) lines.push(`Nationalité : ${profile.nationality}`);
      if (profile.age) lines.push(`Âge : ${profile.age} ans`);
      if (profile.currentCompetition) lines.push(`Compétition actuelle : ${profile.currentCompetition}`);
      if (profile.currentSeason) lines.push(`Saison : ${profile.currentSeason}`);
      if (profile.currentMatchday) lines.push(`Journée actuelle : J${profile.currentMatchday}`);

      await msg.reply(lines.join('\n'));
      return;
    }

    if (cmd === '!coach-set') {
      if (rest.length < 2) {
        return void msg.reply("Utilise : `!coach-set <propriété> <valeur>`\nPropriétés : nom, nationalité, age, compétition, saison, journée");
      }

      const [prop, ...valueParts] = rest;
      const value = valueParts.join(' ');

      const validProps = {
        'nom': 'name',
        'name': 'name',
        'nationalité': 'nationality',
        'nationality': 'nationality',
        'age': 'age',
        'âge': 'age',
        'compétition': 'currentCompetition',
        'competition': 'currentCompetition',
        'saison': 'currentSeason',
        'season': 'currentSeason',
        'journée': 'currentMatchday',
        'journee': 'currentMatchday',
        'matchday': 'currentMatchday',
        'j': 'currentMatchday'
      };

      const mappedProp = validProps[prop.toLowerCase()];
      if (!mappedProp) {
        return void msg.reply("Propriété inconnue. Utilise : nom, nationalité, age, compétition, saison, journée");
      }

      const updates = {};
      if (mappedProp === 'age') {
        const age = parseInt(value, 10);
        if (isNaN(age) || age < 16 || age > 99) {
          return void msg.reply("L'âge doit être un nombre entre 16 et 99.");
        }
        updates[mappedProp] = age;
      } else if (mappedProp === 'currentMatchday') {
        const matchday = parseInt(value, 10);
        if (isNaN(matchday) || matchday < 1 || matchday > 99) {
          return void msg.reply("La journée doit être un nombre entre 1 et 99.");
        }
        updates[mappedProp] = matchday;
      } else {
        updates[mappedProp] = value;
      }

      store.updateCoachProfile(guildId, userId, updates);
      await msg.reply(`✅ ${prop} mis à jour : **${value}**`);
      return;
    }

    // ====== NOUVELLES COMMANDES COMPÉTITION/JOURNÉE ======

    if (cmd === '!comp') {
      if (rest.length === 0) {
        // Afficher la compétition actuelle avec info sur l'auto-incrémentation
        const coach = store.getCoachProfile(guildId, userId);
        const current = coach?.currentCompetition || 'Ligue 1';

        if (current === 'Ligue 1') {
          // FIX: Afficher le compteur actuel au lieu de calculer
          const nextMatchday = coach?.currentMatchday || 1;
          return void msg.reply(`🏆 Compétition actuelle : **${current}** (J${nextMatchday} auto-calculée)\n💡 Les journées s'incrémentent automatiquement en Ligue 1`);
        } else {
          const matchday = coach?.currentMatchday ? ` (J${coach.currentMatchday})` : '';
          return void msg.reply(`🏆 Compétition actuelle : **${current}**${matchday}`);
        }
      }

      const competition = rest.join(' ').trim();
      store.updateCoachProfile(guildId, userId, { currentCompetition: competition });

      // Message informatif sur l'auto-incrémentation
      const autoInfo = competition === 'Ligue 1' ? '\n💡 Les journées s\'incrémentent automatiquement en Ligue 1' : '';
      await msg.reply(`🏆 Compétition définie : **${competition}**${autoInfo}`);
      return;
    }

    if (cmd === '!journee' || cmd === '!j') {
      if (rest.length === 0) {
        // Afficher la journée actuelle avec info auto-incrémentation
        const coach = store.getCoachProfile(guildId, userId);
        const competition = coach?.currentCompetition || 'Ligue 1';

        if (competition === 'Ligue 1') {
          // FIX: Afficher le compteur actuel au lieu de calculer
          const nextMatchday = coach?.currentMatchday || 1;
          return void msg.reply(`📅 Prochaine journée Ligue 1 : **J${nextMatchday}** (auto-calculée)\n💡 Les journées s'incrémentent automatiquement en Ligue 1`);
        } else {
          const current = coach?.currentMatchday || 'Non définie';
          const comp = coach?.currentCompetition ? ` (${coach.currentCompetition})` : '';
          return void msg.reply(`📅 Journée actuelle : **J${current}**${comp}`);
        }
      }

      const matchday = parseInt(rest[0], 10);
      if (isNaN(matchday) || matchday < 1 || matchday > 99) {
        return void msg.reply("La journée doit être un nombre entre 1 et 99.");
      }

      store.updateCoachProfile(guildId, userId, { currentMatchday: matchday });
      await msg.reply(`📅 Journée définie : **J${matchday}**`);
      return;
    }

    if (cmd === '!nextj') {
      // Avancer à la journée suivante
      const coach = store.getCoachProfile(guildId, userId);
      const current = coach?.currentMatchday || 0;
      const next = current + 1;

      if (next > 99) {
        return void msg.reply("Journée maximum atteinte (99).");
      }

      store.updateCoachProfile(guildId, userId, { currentMatchday: next });
      await msg.reply(`📅 Passage à la journée suivante : **J${next}**`);
      return;
    }

    if (cmd === '!season') {
      if (rest.length === 0) {
        // Afficher la saison actuelle
        const coach = store.getCoachProfile(guildId, userId);
        const current = coach?.currentSeason || 'Non définie';
        return void msg.reply(`📆 Saison actuelle : **${current}**`);
      }

      const season = rest.join(' ').trim();
      store.updateCoachProfile(guildId, userId, { currentSeason: season });
      await msg.reply(`📆 Saison définie : **${season}**`);
      return;
    }

    // ====== NOUVELLES COMMANDES GESTION COMPTEUR JOURNÉE ======

    if (cmd === '!matchday-reset') {
      store.updateCoachProfile(guildId, userId, { currentMatchday: 1 });
      await msg.reply(`📅 Compteur de journée remis à zéro : **J1**`);
      return;
    }

    if (cmd === '!matchday-set') {
      if (rest.length === 0) {
        return void msg.reply("Utilise : `!matchday-set <journée>`\nExemple : `!matchday-set 15`");
      }

      const matchday = parseInt(rest[0], 10);
      if (isNaN(matchday) || matchday < 1 || matchday > 99) {
        return void msg.reply("La journée doit être un nombre entre 1 et 99.");
      }

      store.updateCoachProfile(guildId, userId, { currentMatchday: matchday });
      await msg.reply(`📅 Compteur de journée défini : **J${matchday}**`);
      return;
    }

    // ====== COMMANDE SETUP RAPIDE ======

    if (cmd === '!setup') {
      if (rest.length < 2) {
        return void msg.reply("Utilise : `!setup <compétition> <journée> [saison]`\nExemple : `!setup \"Ligue 1\" 15 \"2024-2025\"`");
      }

      const [competition, matchdayStr, ...seasonParts] = rest;
      const matchday = parseInt(matchdayStr, 10);

      if (isNaN(matchday) || matchday < 1 || matchday > 99) {
        return void msg.reply("La journée doit être un nombre entre 1 et 99.");
      }

      const updates = {
        currentCompetition: competition,
        currentMatchday: matchday
      };

      if (seasonParts.length > 0) {
        updates.currentSeason = seasonParts.join(' ');
      }

      store.updateCoachProfile(guildId, userId, updates);

      const seasonText = updates.currentSeason ? ` (${updates.currentSeason})` : '';
      await msg.reply(`⚙️ Configuration mise à jour :\n🏆 Compétition : **${competition}**\n📅 Journée : **J${matchday}**${seasonText}`);
      return;
    }

    if (cmd === '!match-add') {
      // !match-add opponent score_for score_against [competition] [matchday]
      if (rest.length < 3) {
        return void msg.reply("Utilise : `!match-add <adversaire> <score_pour> <score_contre> [compétition] [journée]`");
      }

      const [opponent, scoreForStr, scoreAgainstStr, competition, matchday] = rest;
      const scoreFor = parseInt(scoreForStr, 10);
      const scoreAgainst = parseInt(scoreAgainstStr, 10);

      if (isNaN(scoreFor) || isNaN(scoreAgainst)) {
        return void msg.reply("Les scores doivent être des nombres valides.");
      }

      const m = getMatch(guildId, userId);
      const coach = store.getCoachProfile(guildId, userId);
      const finalCompetition = competition || coach?.currentCompetition || 'Ligue 1';

      // NOUVEAU : Auto-incrémentation pour Ligue 1 si pas de journée spécifiée
      let finalMatchday = null;
      if (matchday) {
        finalMatchday = parseInt(matchday, 10);
      } else if (finalCompetition === 'Ligue 1') {
        // FIX: Utiliser le compteur du profil coach au lieu de getNextMatchday()
        const coach = store.getCoachProfile(guildId, userId);
        const currentMatchday = coach?.currentMatchday || 1;
        finalMatchday = currentMatchday;
        // Mettre à jour le profil coach avec la nouvelle journée
        store.updateCoachProfile(guildId, userId, { currentMatchday: currentMatchday + 1 });
      } else {
        finalMatchday = coach?.currentMatchday || null;
      }

      const matchData = {
        team: m.team,
        opponent,
        scoreFor,
        scoreAgainst,
        competition: finalCompetition,
        matchday: finalMatchday,
        scorersFor: [],
        scorersAgainst: []
      };

      const matchId = store.addMatchToHistory(guildId, userId, matchData);
      const autoInfo = finalCompetition === 'Ligue 1' && finalMatchday && !matchday ? ` (J${finalMatchday} auto-assignée)` : '';
      await msg.reply(`✅ Match ajouté à l'historique (ID: ${matchId})${autoInfo}`);
      return;
    }

    if (cmd === '!history') {
      const limit = rest[0] ? Math.min(parseInt(rest[0], 10) || 5, 20) : 5;
      const matches = store.getMatchHistory(guildId, userId, limit);

      if (matches.length === 0) {
        return void msg.reply("Aucun match dans l'historique. Les matchs terminés avec `!fin` y sont automatiquement ajoutés.");
      }

      const lines = [`📋 **Historique** — ${matches.length} dernier(s) match(s)`];
      matches.forEach((match, i) => {
        const result = `${match.scoreFor || 0}-${match.scoreAgainst || 0}`;
        const vs = match.opponent || '?';
        const comp = match.competition ? ` (${match.competition})` : '';
        const day = match.matchday ? ` J${match.matchday}` : '';

        lines.push(`${i + 1}. ${match.team || '?'} ${result} ${vs}${comp}${day}`);
      });

      await msg.reply(lines.join('\n'));
      return;
    }

    if (cmd === '!history-ids') {
      const limit = rest[0] ? Math.min(parseInt(rest[0], 10) || 10, 20) : 10;
      const matches = store.getMatchHistory(guildId, userId, limit);

      if (matches.length === 0) {
        return void msg.reply("Aucun match dans l'historique.");
      }

      const lines = [`📋 **Historique avec IDs** — ${matches.length} match(s)`];
      matches.forEach((match, i) => {
        const result = `${match.scoreFor || 0}-${match.scoreAgainst || 0}`;
        const vs = match.opponent || '?';
        const comp = match.competition ? ` (${match.competition})` : '';
        const day = match.matchday ? ` J${match.matchday}` : '';

        lines.push(`**ID ${match.id}** — ${match.team || '?'} ${result} ${vs}${comp}${day}`);
      });

      lines.push('');
      lines.push('💡 Utilise `!match-edit <ID> <propriété> <valeur>` pour éditer');
      lines.push('💡 Propriétés : opponent, scoreFor, scoreAgainst, competition, matchday');

      await msg.reply(lines.join('\n'));
      return;
    }

    if (cmd === '!match-edit') {
      // !match-edit ID property value
      if (rest.length < 3) {
        return void msg.reply("Utilise : `!match-edit <ID> <propriété> <valeur>`");
      }

      const [matchIdStr, property, ...valueParts] = rest;
      const matchId = parseInt(matchIdStr, 10);
      const value = valueParts.join(' ');

      if (isNaN(matchId)) {
        return void msg.reply("L'ID doit être un nombre. Utilise `!history-ids` pour voir les IDs.");
      }

      const validProps = {
        'opponent': 'opponent',
        'adversaire': 'opponent',
        'scoreFor': 'scoreFor',
        'scorefor': 'scoreFor',
        'score_pour': 'scoreFor',
        'scoreAgainst': 'scoreAgainst',
        'scoreagainst': 'scoreAgainst',
        'score_contre': 'scoreAgainst',
        'competition': 'competition',
        'compétition': 'competition',
        'comp': 'competition',
        'matchday': 'matchday',
        'journée': 'matchday',
        'journee': 'matchday',
        'j': 'matchday'
      };

      const mappedProp = validProps[property.toLowerCase()];
      if (!mappedProp) {
        return void msg.reply("Propriété inconnue. Propriétés disponibles : opponent, scoreFor, scoreAgainst, competition, matchday");
      }

      const updates = {};

      if (mappedProp === 'scoreFor' || mappedProp === 'scoreAgainst') {
        const score = parseInt(value, 10);
        if (isNaN(score) || score < 0) {
          return void msg.reply("Le score doit être un nombre positif ou nul.");
        }
        updates[mappedProp] = score;
      } else if (mappedProp === 'matchday') {
        if (value.toLowerCase() === 'null' || value === '') {
          updates[mappedProp] = null;
        } else {
          const matchday = parseInt(value, 10);
          if (isNaN(matchday) || matchday < 1 || matchday > 99) {
            return void msg.reply("La journée doit être un nombre entre 1 et 99, ou 'null' pour supprimer.");
          }
          updates[mappedProp] = matchday;
        }
      } else {
        updates[mappedProp] = value;
      }

      const success = store.updateMatchInHistory(guildId, userId, matchId, updates);

      if (success) {
        await msg.reply(`✅ Match ID ${matchId} mis à jour : **${property}** → **${value}**`);
      } else {
        await msg.reply(`❌ Match ID ${matchId} introuvable. Utilise \`!history-ids\` pour voir les IDs disponibles.`);
      }
      return;
    }

    if (cmd === '!match-delete') {
      if (rest.length === 0) {
        return void msg.reply("Utilise : `!match-delete <ID>`\nUtilise `!history-ids` pour voir les IDs disponibles.");
      }

      const matchIdStr = rest[0];
      const matchId = parseInt(matchIdStr, 10);

      if (isNaN(matchId)) {
        return void msg.reply("L'ID doit être un nombre. Utilise `!history-ids` pour voir les IDs.");
      }

      const success = store.deleteMatchFromHistory(guildId, userId, matchId);

      if (success) {
        await msg.reply(`✅ Match ID ${matchId} supprimé de l'historique.`);
      } else {
        await msg.reply(`❌ Match ID ${matchId} introuvable. Utilise \`!history-ids\` pour voir les IDs disponibles.`);
      }
      return;
    }

    if (cmd === '!scorers') {
      const limit = rest[0] ? Math.min(parseInt(rest[0], 10) || 10, 20) : 10;
      const matches = store.getMatchHistory(guildId, userId, 100); // Récupérer plus de matchs pour les stats

      if (matches.length === 0) {
        return void msg.reply("Aucun match dans l'historique pour calculer les statistiques des buteurs.");
      }

      // Agrégation des buteurs
      const scorerStats = {};

      matches.forEach(match => {
        if (Array.isArray(match.scorersFor)) {
          match.scorersFor.forEach(scorer => {
            // Extraire le nom du buteur (enlever la minute)
            const scorerName = String(scorer).split(' (')[0].trim();
            if (scorerName) {
              if (!scorerStats[scorerName]) {
                scorerStats[scorerName] = { goals: 0, matches: new Set() };
              }
              scorerStats[scorerName].goals++;
              scorerStats[scorerName].matches.add(match.id);
            }
          });
        }
      });

      if (Object.keys(scorerStats).length === 0) {
        return void msg.reply("Aucun buteur trouvé dans l'historique.");
      }

      // Trier par nombre de buts décroissant
      const sortedScorers = Object.entries(scorerStats)
        .map(([name, stats]) => ({
          name,
          goals: stats.goals,
          matches: stats.matches.size
        }))
        .sort((a, b) => b.goals - a.goals)
        .slice(0, limit);

      const lines = [`⚽ **Top ${Math.min(limit, sortedScorers.length)} des buteurs** — ${matches.length} match(s) analysés`];

      sortedScorers.forEach((scorer, i) => {
        const rank = i + 1;
        const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const goalText = scorer.goals > 1 ? 'buts' : 'but';
        const matchText = scorer.matches > 1 ? 'matchs' : 'match';

        lines.push(`${emoji} **${scorer.name}** — ${scorer.goals} ${goalText} (${scorer.matches} ${matchText})`);
      });
    }
  }
  catch (e) {
    console.error("Erreur lors du traitement de la commande :", e);
    await msg.reply("Une erreur est survenue lors du traitement de la commande.");
  }
});

async function updateBoardMessage(interaction) {
  const g = getGuildDay(interaction.guildId);
  if (!g.boardMsgId) return;
  try {
    const msg = await interaction.channel.messages.fetch(g.boardMsgId);
    await msg.edit(renderBoard(interaction.guildId, interaction.client));
  } catch { }
}

// Fonction pour jouer un fichier audio simple
async function playAudioFile(guildId, filePath) {
  const st = getAudioState(guildId);
  if (!st?.connection) return false;

  try {
    const resource = createAudioResource(filePath);

    enqueue(guildId, [resource]);
    return true;
  } catch (error) {
    console.error(`[AUDIO] Erreur lecture ${filePath}:`, error);
    return false;
  }
}

// Nouvelle fonction pour gérer l'audio des conférences de presse de manière cohérente
async function playPressAudio(guildId, text, journalist, type = 'question') {
  const ttsPath = path.join(ASSETS_DIR, `press_${type}_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
  
  // Utiliser la voix du journaliste de manière cohérente
  const journalistVoice = journalist?.voice?.name || "fr-FR-HenriNeural";
  
  // IMPORTANT : Créer un objet voiceParams complet et cohérent
  const voiceParams = journalist?.voice ? {
    rate: journalist.voice.rate || 0,
    pitch: journalist.voice.pitch || 0,
    degree: journalist.voice.degree || 1.7,
    style: journalist.voice.style || "calm"
  } : null;
  
  try {
    await synthToFile(text, ttsPath, journalistVoice, voiceParams);
    const res = createAudioResource(ttsPath);
    res.metadata = { tempPath: ttsPath };
    enqueue(guildId, [res]);
    console.log(`[PRESS AUDIO] Joué avec voix ${journalistVoice} (${type})`);
  } catch (ttsError) {
    console.error(`[TTS] Erreur avec voix ${journalistVoice}:`, ttsError.message);
    // Fallback vers voix par défaut avec paramètres par défaut
    try {
      await synthToFile(text, ttsPath, "fr-FR-HenriNeural", null);
      const res = createAudioResource(ttsPath);
      res.metadata = { tempPath: ttsPath };
      enqueue(guildId, [res]);
      console.log(`[PRESS AUDIO] Fallback réussi pour ${type}`);
    } catch (fallbackError) {
      console.error('[TTS] Échec même avec voix par défaut:', fallbackError.message);
    }
  }
}