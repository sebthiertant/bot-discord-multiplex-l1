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
  
  // Debug: Afficher les commandes déployées
  client.application.commands.fetch().then(commands => {
    console.log(`📋 ${commands.size} slash commandes chargées:`);
    commands.forEach(cmd => console.log(`  /${cmd.name}`));
  }).catch(console.error);
});

// === GESTION DES INTERACTIONS SLASH ===
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName, options, guildId, user } = interaction;
    const userId = user.id;
    const st = getAudioState(guildId);

    // === Commandes de base ===
    if (commandName === 'me') {
      const team = options.getString('club');
      const m = getMatch(guildId, userId);
      m.team = team;
      store.setTeam(guildId, userId, team);
      await interaction.reply(`✅ Club défini : **${team}**`);
      await updateBoardMsg(client, guildId);
      return;
    }

    if (commandName === 'whoami') {
      const saved = store.getTeam(guildId, userId);
      await interaction.reply(saved ? `Ton club mémorisé : **${saved}**`
        : "Aucun club mémorisé. Utilise `/me` pour en définir un.");
      return;
    }

    if (commandName === 'forgetme') {
      store.clearTeam(guildId, userId);
      const m = getMatch(guildId, userId);
      m.team = null;
      await interaction.reply('🗑️ Club oublié.');
      return;
    }

    if (commandName === 'multiplex') {
      const voiceChannel = interaction.member?.voice?.channel;
      if (st?.connection && st.stay) {
        await interaction.reply("🔌 Multiplex désactivé. Je me déconnecte.");
        safeDestroy(guildId);
        return;
      }
      if (!voiceChannel) {
        await interaction.reply("Rejoins d'abord un salon vocal, puis refais `/multiplex`.");
        return;
      }
      await ensureConnection(voiceChannel, true);
      await interaction.reply(`🎛️ Multiplex activé dans **${voiceChannel.name}**. J'y reste jusqu'à ce qu'il n'y ait plus personne ou jusqu'à \`/multiplex\`.`);
      return;
    }

    // === Gestion de match ===
    if (commandName === 'vs') {
      const opp = options.getString('adversaire');
      const m = getMatch(guildId, userId);
      
      const wasFT = m.status === 'FIN';
      const isNewOpp = !m.opp || m.opp.toLowerCase() !== opp.toLowerCase();

      if (wasFT || isNewOpp) {
        resetMatch(m, { keepTeam: true, keepOpp: true });
      }

      m.opp = opp;
      await interaction.reply(`🤝 Adversaire : **${opp}**${(wasFT || isNewOpp) ? " — score remis à 0." : ""}`);
      await updateBoardMsg(client, guildId);
      return;
    }

    if (commandName === 'start') {
      const m = getMatch(guildId, userId);
      if (m.status === 'FT') {
        resetMatch(m, { keepTeam: true, keepOpp: true });
      }
      m.status = 'LIVE';
      if (m.minute == null) m.minute = 0;
      await interaction.reply('🟢 Début du match !');
      await updateBoardMsg(client, guildId);
      return;
    }

    if (commandName === 'goal' || commandName === 'goal-against') {
      if (!st?.connection) {
        await interaction.reply("Je ne suis pas connecté. Lance d'abord `/multiplex`.");
        return;
      }

      const m = getMatch(guildId, userId);
      const minute = options.getInteger('minute');
      const scorer = options.getString('buteur');
      const cmd = commandName === 'goal' ? '!g' : '!gc';

      if (minute != null) m.minute = Math.max(0, minute);
      m.hist.push({ prev: { ...m } });

      if (commandName === 'goal') {
        m.for++;
        if (scorer) m.scorersFor.push(`${scorer}${m.minute ? ` (${m.minute}')` : ''}`);
      } else {
        m.against++;
        if (scorer) m.scorersAgainst.push(`${scorer}${m.minute ? ` (${m.minute}')` : ''}`);
      }

      const text = buildGoalAnnouncement(m.team, m.opp, m.for, m.against, m.minute, scorer, cmd);
      await enqueueJingleAndTTS(guildId, text);

      // FIX: Ajouter le buteur dans le message si fourni
      let replyMessage = `${commandName === 'goal' ? '⚽' : '🥅'} ${m.team || '—'} ${m.for}-${m.against} ${m.opp || '—'}`;
      
      if (m.minute) {
        replyMessage += ` ${m.minute}'`;
      }
      
      if (scorer) {
        replyMessage += ` — ${scorer}`;
      }

      await interaction.reply(replyMessage.replace(/\s+/g, ' ').trim());
      await updateBoardMsg(client, guildId);
      return;
    }

    if (commandName === 'minute') {
      const m = getMatch(guildId, userId);
      const minute = options.getInteger('minute');
      m.minute = Math.max(0, minute);
      await interaction.reply(`⏱️ Minute réglée sur **${minute}'**`);
      await updateBoardMsg(client, guildId);
      return;
    }

    if (commandName === 'halftime') {
      const m = getMatch(guildId, userId);
      m.status = 'MT';
      m.minute = 45;
      m.minuteLabel = '45';
      await interaction.reply('🟡 Mi-temps.');
      await updateBoardMsg(client, guildId);
      return;
    }

    if (commandName === 'second-half') {
      const m = getMatch(guildId, userId);
      m.status = 'H2';
      if ((m.minute ?? 0) < 46) {
        m.minute = 46;
        m.minuteLabel = '46';
      }
      await interaction.reply('🟢 Début de la seconde période (46\').');
      await updateBoardMsg(client, guildId);
      return;
    }

    if (commandName === 'end') {
      const m = getMatch(guildId, userId);
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

      // Sauvegarde automatique IDENTIQUE à !fin
      if (m.team && m.opp) {
        const coach = store.getCoachProfile(guildId, userId);
        const competition = coach?.currentCompetition || 'Ligue 1';
        
        let matchday = null;
        if (competition === 'Ligue 1') {
          const currentMatchday = coach?.currentMatchday || 1;
          matchday = currentMatchday;
          store.updateCoachProfile(guildId, userId, { currentMatchday: currentMatchday + 1 });
        } else {
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

        // FIX: Ajouter la logique de conférence de presse automatique IDENTIQUE à !fin
        const pressCounter = store.incrementPressCounter(guildId, userId);
        const autoInfo = competition === 'Ligue 1' && matchday ? ` (J${matchday} auto-assignée)` : '';

        let replyMessage = `🔴 Fin du match. (Ajouté automatiquement à l'historique${autoInfo})`;

        // FIX: DEFER LA RÉPONSE AVANT LE DÉCLENCHEMENT DE LA CONFÉRENCE
        if (pressCounter >= 10) {
          // Répondre IMMÉDIATEMENT avant la génération longue
          await interaction.reply(replyMessage + `\n\n🎙️ **Génération de la conférence de presse en cours...**`);

          try {
            // Générer la conférence de presse
            const recentMatches = store.getMatchHistory(guildId, userId, 5);
            const lastMatch = recentMatches[0];

            const ctx = {
              coach: coach?.name || interaction.member?.displayName || user.username,
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

            const finalMessage = `🎙️ **CONFÉRENCE DE PRESSE DÉCLENCHÉE !**\n${pressResult.presentation}\n\n💡 Tapez \`/conference\` pour commencer la conférence de presse.\n\n❌ Tapez \`!no\` pour annuler la conférence de presse.`;

            // Envoyer le message final avec followUp
            await interaction.followUp(finalMessage);

            // NOUVEAU : Lire la présentation en audio si connecté
            const st = getAudioState(guildId);
            if (st?.connection) {
              await playPressAudio(guildId, pressResult.presentation, journalist, 'presentation');
            }

          } catch (error) {
            console.error('[PRESS AUTO] Erreur génération:', error);
            await interaction.followUp(`🎙️ Conférence de presse déclenchée mais erreur de génération. Utilisez \`/conference force:true\`.`);
          }
        } else {
          // Pas de conférence → réponse normale
          await interaction.reply(replyMessage);
        }
      } else {
        const audioInfo = st?.connection ? ' + annonce vocale' : '';
        await interaction.reply(`🔴 Fin du match.${audioInfo}`);
      }

      await updateBoardMsg(client, guildId);
      return;
    }

    if (commandName === 'undo') {
      const m = getMatch(guildId, userId);
      const last = m.hist.pop();
      if (!last) {
        await interaction.reply("Rien à annuler.");
        return;
      }
      Object.assign(m, last.prev);
      await interaction.reply('↩️ Dernière action annulée.');
      await updateBoardMsg(client, guildId);
      return;
    }

    // === Profil Coach ===
    if (commandName === 'coach') {
      const profile = store.getCoachProfile(guildId, userId);
      if (!profile || Object.keys(profile).length === 0) {
        await interaction.reply("Aucun profil coach configuré. Utilise `/coach-set` pour commencer.");
        return;
      }

      const lines = [`👤 **Profil Coach** — ${user.username}`];
      if (profile.name) lines.push(`Nom : ${profile.name}`);
      if (profile.nationality) lines.push(`Nationalité : ${profile.nationality}`);
      if (profile.age) lines.push(`Âge : ${profile.age} ans`);
      if (profile.currentCompetition) lines.push(`Compétition : ${profile.currentCompetition}`);
      if (profile.currentSeason) lines.push(`Saison : ${profile.currentSeason}`);
      if (profile.currentMatchday) lines.push(`Journée : J${profile.currentMatchday}`);

      await interaction.reply(lines.join('\n'));
      return;
    }

    if (commandName === 'coach-set') {
      const prop = options.getString('propriete');
      const value = options.getString('valeur');

      const validProps = {
        'nom': 'name',
        'nationalité': 'nationality',
        'age': 'age',
        'compétition': 'currentCompetition',
        'saison': 'currentSeason',
        'journée': 'currentMatchday'
      };

      const mappedProp = validProps[prop];
      const updates = {};

      if (mappedProp === 'age') {
        const age = parseInt(value, 10);
        if (isNaN(age) || age < 16 || age > 99) {
          await interaction.reply("L'âge doit être un nombre entre 16 et 99.");
          return;
        }
        updates[mappedProp] = age;
      } else if (mappedProp === 'currentMatchday') {
        const matchday = parseInt(value, 10);
        if (isNaN(matchday) || matchday < 1 || matchday > 99) {
          await interaction.reply("La journée doit être un nombre entre 1 et 99.");
          return;
        }
        updates[mappedProp] = matchday;
      } else {
        updates[mappedProp] = value;
      }

      store.updateCoachProfile(guildId, userId, updates);
      await interaction.reply(`✅ ${prop} mis à jour : **${value}**`);
      return;
    }

    // === Gestion Compétition ===
    if (commandName === 'competition') {
      const competition = options.getString('nom');
      
      if (!competition) {
        const coach = store.getCoachProfile(guildId, userId);
        const current = coach?.currentCompetition || 'Ligue 1';
        
        if (current === 'Ligue 1') {
          const nextMatchday = coach?.currentMatchday || 1;
          await interaction.reply(`🏆 Compétition actuelle : **${current}** (J${nextMatchday} auto-calculée)\n💡 Les journées s'incrémentent automatiquement en Ligue 1`);
        } else {
          const matchday = coach?.currentMatchday ? ` (J${coach.currentMatchday})` : '';
          await interaction.reply(`🏆 Compétition actuelle : **${current}**${matchday}`);
        }
        return;
      }

      store.updateCoachProfile(guildId, userId, { currentCompetition: competition });
      const autoInfo = competition === 'Ligue 1' ? '\n💡 Les journées s\'incrémentent automatiquement en Ligue 1' : '';
      await interaction.reply(`🏆 Compétition définie : **${competition}**${autoInfo}`);
      return;
    }

    if (commandName === 'season') {
      const season = options.getString('saison');
      
      if (!season) {
        const coach = store.getCoachProfile(guildId, userId);
        const current = coach?.currentSeason || 'Non définie';
        await interaction.reply(`📆 Saison actuelle : **${current}**`);
        return;
      }

      store.updateCoachProfile(guildId, userId, { currentSeason: season });
      await interaction.reply(`📆 Saison définie : **${season}**`);
      return;
    }

    if (commandName === 'matchday') {
      const matchday = options.getInteger('journee');
      
      if (!matchday) {
        const coach = store.getCoachProfile(guildId, userId);
        const competition = coach?.currentCompetition || 'Ligue 1';
        
        if (competition === 'Ligue 1') {
          const nextMatchday = coach?.currentMatchday || 1;
          await interaction.reply(`📅 Prochaine journée Ligue 1 : **J${nextMatchday}** (auto-calculée)`);
        } else {
          const current = coach?.currentMatchday || 'Non définie';
          await interaction.reply(`📅 Journée actuelle : **J${current}**`);
        }
        return;
      }

      store.updateCoachProfile(guildId, userId, { currentMatchday: matchday });
      await interaction.reply(`📅 Journée définie : **J${matchday}**`);
      return;
    }

    // === Audio ===
    if (commandName === 'champions-league') {
      if (!st?.connection) {
        await interaction.reply("Je ne suis pas connecté. Lance d'abord `/multiplex`.");
        return;
      }

      const success = await playAudioFile(guildId, UCL_ANTHEM_PATH);
      if (success) {
        await interaction.reply('🎵 Hymne de la Ligue des Champions en cours...');
      } else {
        await interaction.reply("❌ Fichier `ucl_anthem.mp3` introuvable dans le dossier assets.");
      }
      return;
    }

    if (commandName === 'europa-league') {
      if (!st?.connection) {
        await interaction.reply("Je ne suis pas connecté. Lance d'abord `/multiplex`.");
        return;
      }

      const success = await playAudioFile(guildId, EUROPA_ANTHEM_PATH);
      if (success) {
        await interaction.reply('🎵 Hymne de l\'Europa League en cours...');
      } else {
        await interaction.reply("❌ Fichier `europa_anthem.mp3` introuvable dans le dossier assets.");
      }
      return;
    }

    // === Historique ===
    if (commandName === 'history') {
      const limit = options.getInteger('nombre') || 5;
      const matches = store.getMatchHistory(guildId, userId, limit);

      if (matches.length === 0) {
        await interaction.reply("Aucun match dans l'historique. Les matchs terminés avec `/end` y sont automatiquement ajoutés.");
        return;
      }

      const lines = [`📋 **Historique** — ${matches.length} dernier(s) match(s)`];
      matches.forEach((match, i) => {
        const result = `${match.scoreFor || 0}-${match.scoreAgainst || 0}`;
        const vs = match.opponent || '?';
        const comp = match.competition ? ` (${match.competition})` : '';
        const day = match.matchday ? ` J${match.matchday}` : '';
        lines.push(`${i + 1}. ${match.team || '?'} ${result} ${vs}${comp}${day}`);
      });

      await interaction.reply(lines.join('\n'));
      return;
    }

    if (commandName === 'scorers') {
      const limit = options.getInteger('nombre') || 10;
      const matches = store.getMatchHistory(guildId, userId, 100);

      if (matches.length === 0) {
        await interaction.reply("Aucun match dans l'historique pour calculer les statistiques.");
        return;
      }

      const scorerStats = {};
      matches.forEach(match => {
        if (Array.isArray(match.scorersFor)) {
          match.scorersFor.forEach(scorer => {
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
        await interaction.reply("Aucun buteur trouvé dans l'historique.");
        return;
      }

      const sortedScorers = Object.entries(scorerStats)
        .map(([name, stats]) => ({ name, goals: stats.goals, matches: stats.matches.size }))
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

      await interaction.reply(lines.join('\n'));
      return;
    }

    // === Tableau ===
    if (commandName === 'board') {
      await updateBoardMsg(client, guildId);
      await interaction.reply('📊 Tableau mis à jour.');
      return;
    }

    if (commandName === 'board-setup') {
      const target = options.getChannel('salon') || interaction.channel;

      if (!target || target.type !== ChannelType.GuildText) {
        await interaction.reply("Indique un salon texte valide.");
        return;
      }

      try {
        await purgeChannel(target);
        const { sent, pinned, pinError } = await ensureBoardMessage(client, guildId, target);
        
        await interaction.reply(
          pinned
            ? `📌 Tableau initialisé dans ${target} et **épinglé** (canal nettoyé).`
            : `📌 Tableau initialisé dans ${target}, **non épinglé**. Détail: ${pinError || 'inconnu'}`
        );
      } catch (e) {
        await interaction.reply(`Impossible de configurer le tableau : ${e?.message || e}`);
      }
      return;
    }

    // === Mercato ===
    if (commandName === 'mercato') {
      if (!st?.connection) {
        await interaction.reply("Je ne suis pas connecté. Lance d'abord `/multiplex`.");
        return;
      }

      const amount = options.getInteger('montant');
      const fromClub = options.getString('club_origine');
      const playerName = options.getString('joueur');

      const m = getMatch(guildId, userId);
      const userClub = m.team || store.getTeam(guildId, userId);

      if (!userClub) {
        await interaction.reply("Définis d'abord ton club avec `/me` avant d'annoncer un transfert !");
        return;
      }

      try {
        const coach = store.getCoachProfile(guildId, userId);
        const coachName = coach?.name || interaction.member?.displayName || user.username;

        const audioPath = await generateMercatoAnnouncement(playerName, amount, fromClub, userClub, coachName);
        const resource = createAudioResource(audioPath);
        resource.metadata = { tempPath: audioPath };
        enqueue(guildId, [resource]);

        const displayText = buildMercatoDisplayText(playerName, amount, fromClub, userClub, coachName);
        await interaction.reply(displayText);

      } catch (error) {
        console.error('[MERCATO] Erreur:', error);
        await interaction.reply("❌ Erreur lors de la génération de l'annonce mercato.");
      }
      return;
    }

    // === Conférence de presse ===
    if (commandName === 'conference') {
      const isForced = options.getBoolean('force') || false;
      const n = options.getInteger('questions');

      const activeSession = store.getPressSession(guildId, userId);

      if (activeSession && !isForced) {
        const currentQ = activeSession.questions[activeSession.currentIndex];
        const isLastQuestion = activeSession.currentIndex === activeSession.questions.length - 1;
        
        let questionText = currentQ;
        if (isLastQuestion) {
          questionText += questionText.endsWith('.') ? ' Merci.' : '. Merci.';
        }

        const matchInfo = `Q${activeSession.currentIndex + 1}/${activeSession.questions.length}`;
        await interaction.reply(`🎙️ **${matchInfo}** — ${questionText}`);

        if (st?.connection) {
          await playPressAudio(guildId, questionText, activeSession.journalist, 'question');
        }

        const nextSession = store.advancePressSession(guildId, userId);
        if (!nextSession) {
          await interaction.followUp("📝 **Fin de la conférence de presse.** Merci !");
        } else {
          await interaction.followUp(`💡 Tapez \`/conference\` pour la question suivante (${nextSession.currentIndex + 1}/${nextSession.questions.length}).`);
        }
        return;
      }

      if (!isForced) {
        await interaction.reply("❌ Aucune conférence de presse en cours. Utilisez l'option `force` pour en démarrer une.");
        return;
      }

      // FIX: Répondre immédiatement pour éviter le timeout
      await interaction.deferReply();

      try {
        // Mode forcé - logique identique à !conf --force
        const coach = store.getCoachProfile(guildId, userId);
        const recentMatches = store.getMatchHistory(guildId, userId, 5);

        if (recentMatches.length === 0) {
          await interaction.editReply("Aucun match dans l'historique. Termine un match pour générer une conférence.");
          return;
        }

        const lastMatch = recentMatches[0];
        const ctx = {
          coach: coach?.name || interaction.member?.displayName || user.username,
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

        const pressResult = await generateQuestions(ctx, n || 3);
        const qs = pressResult.questions || [];
        const journalist = pressResult.journalist || { name: "Journaliste", media: "Média Sport" };

        const lines = qs.map((q, i) => `**Q${i + 1}.** ${q}`).join('\n');
        const matchInfo = `${ctx.team} ${ctx.for}-${ctx.against} ${ctx.opp}${ctx.matchday ? ` (J${ctx.matchday})` : ''}`;
        const fullMessage = `🎙️ **Conférence de presse (forcée)** — ${matchInfo}\n\n${pressResult.presentation}\n\n${lines}`;
        
        await interaction.editReply({ content: fullMessage });

        // Audio en arrière-plan (pas d'attente)
        if (st?.connection) {
          // Lancer l'audio sans attendre pour éviter de bloquer la réponse
          setImmediate(async () => {
            try {
              await playPressAudio(guildId, pressResult.presentation, journalist, 'presentation');
              for (const q of qs) {
                await playPressAudio(guildId, q, journalist, 'question');
              }
            } catch (audioError) {
              console.error('[PRESS AUDIO] Erreur lors de la lecture audio:', audioError);
            }
          });
        }

      } catch (error) {
        console.error('[CONFERENCE] Erreur génération:', error);
        await interaction.editReply("❌ Erreur lors de la génération de la conférence de presse.");
      }
      return;
    }

  } catch (error) {
    console.error('Erreur slash commande:', error);
    
    // FIX: Vérifier si l'interaction a déjà été répondue avant d'essayer de répondre
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true });
      } else if (interaction.deferred) {
        await interaction.editReply({ content: 'Une erreur est survenue.' });
      } else {
        // L'interaction a déjà été répondue, utiliser followUp
        await interaction.followUp({ content: 'Une erreur est survenue.', ephemeral: true });
      }
    } catch (replyError) {
      console.error('Erreur lors de la réponse d\'erreur:', replyError);
    }
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

      // Sauvegarde automatique IDENTIQUE à !fin
      if (m.team && m.opp) {
        const coach = store.getCoachProfile(guildId, userId);
        const competition = coach?.currentCompetition || 'Ligue 1';
        
        let matchday = null;
        if (competition === 'Ligue 1') {
          const currentMatchday = coach?.currentMatchday || 1;
          matchday = currentMatchday;
          store.updateCoachProfile(guildId, userId, { currentMatchday: currentMatchday + 1 });
        } else {
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

        // FIX: Ajouter la logique de conférence de presse automatique IDENTIQUE à !fin
        const pressCounter = store.incrementPressCounter(guildId, userId);
        const autoInfo = competition === 'Ligue 1' && matchday ? ` (J${matchday} auto-assignée)` : '';

        let replyMessage = `🔴 Fin du match. (Ajouté automatiquement à l'historique${autoInfo})`;

        // FIX: DEFER LA RÉPONSE AVANT LE DÉCLENCHEMENT DE LA CONFÉRENCE
        if (pressCounter >= 10) {
          // Répondre IMMÉDIATEMENT avant la génération longue
          await interaction.reply(replyMessage + `\n\n🎙️ **Génération de la conférence de presse en cours...**`);

          try {
            // Générer la conférence de presse
            const recentMatches = store.getMatchHistory(guildId, userId, 5);
            const lastMatch = recentMatches[0];

            const ctx = {
              coach: coach?.name || interaction.member?.displayName || user.username,
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

            const finalMessage = `🎙️ **CONFÉRENCE DE PRESSE DÉCLENCHÉE !**\n${pressResult.presentation}\n\n💡 Tapez \`/conference\` pour commencer la conférence de presse.\n\n❌ Tapez \`!no\` pour annuler la conférence de presse.`;

            // Envoyer le message final avec followUp
            await interaction.followUp(finalMessage);

            // NOUVEAU : Lire la présentation en audio si connecté
            const st = getAudioState(guildId);
            if (st?.connection) {
              await playPressAudio(guildId, pressResult.presentation, journalist, 'presentation');
            }

          } catch (error) {
            console.error('[PRESS AUTO] Erreur génération:', error);
            await interaction.followUp(`🎙️ Conférence de presse déclenchée mais erreur de génération. Utilisez \`/conference force:true\`.`);
          }
        } else {
          // Pas de conférence → réponse normale
          await interaction.reply(replyMessage);
        }
      } else {
        const audioInfo = st?.connection ? ' + annonce vocale' : '';
        await interaction.reply(`🔴 Fin du match.${audioInfo}`);
      }

      await updateBoardMsg(client, guildId);
      return;
    }

    if (commandName === 'undo') {
      const m = getMatch(guildId, userId);
      const last = m.hist.pop();
      if (!last) {
        await interaction.reply("Rien à annuler.");
        return;
      }
      Object.assign(m, last.prev);
      await interaction.reply('↩️ Dernière action annulée.');
      await updateBoardMsg(client, guildId);
      return;
    }

    // === Profil Coach ===
    if (commandName === 'coach') {
      const profile = store.getCoachProfile(guildId, userId);
      if (!profile || Object.keys(profile).length === 0) {
        await interaction.reply("Aucun profil coach configuré. Utilise `/coach-set` pour commencer.");
        return;
      }

      const lines = [`👤 **Profil Coach** — ${user.username}`];
      if (profile.name) lines.push(`Nom : ${profile.name}`);
      if (profile.nationality) lines.push(`Nationalité : ${profile.nationality}`);
      if (profile.age) lines.push(`Âge : ${profile.age} ans`);
      if (profile.currentCompetition) lines.push(`Compétition : ${profile.currentCompetition}`);
      if (profile.currentSeason) lines.push(`Saison : ${profile.currentSeason}`);
      if (profile.currentMatchday) lines.push(`Journée : J${profile.currentMatchday}`);

      await interaction.reply(lines.join('\n'));
      return;
    }

    if (commandName === 'coach-set') {
      const prop = options.getString('propriete');
      const value = options.getString('valeur');

      const validProps = {
        'nom': 'name',
        'nationalité': 'nationality',
        'age': 'age',
        'compétition': 'currentCompetition',
        'saison': 'currentSeason',
        'journée': 'currentMatchday'
      };

      const mappedProp = validProps[prop];
      const updates = {};

      if (mappedProp === 'age') {
        const age = parseInt(value, 10);
        if (isNaN(age) || age < 16 || age > 99) {
          await interaction.reply("L'âge doit être un nombre entre 16 et 99.");
          return;
        }
        updates[mappedProp] = age;
      } else if (mappedProp === 'currentMatchday') {
        const matchday = parseInt(value, 10);
        if (isNaN(matchday) || matchday < 1 || matchday > 99) {
          await interaction.reply("La journée doit être un nombre entre 1 et 99.");
          return;
        }
        updates[mappedProp] = matchday;
      } else {
        updates[mappedProp] = value;
      }

      store.updateCoachProfile(guildId, userId, updates);
      await interaction.reply(`✅ ${prop} mis à jour : **${value}**`);
      return;
    }

    // === Gestion Compétition ===
    if (commandName === 'competition') {
      const competition = options.getString('nom');
      
      if (!competition) {
        const coach = store.getCoachProfile(guildId, userId);
        const current = coach?.currentCompetition || 'Ligue 1';
        
        if (current === 'Ligue 1') {
          const nextMatchday = coach?.currentMatchday || 1;
          await interaction.reply(`🏆 Compétition actuelle : **${current}** (J${nextMatchday} auto-calculée)\n💡 Les journées s'incrémentent automatiquement en Ligue 1`);
        } else {
          const matchday = coach?.currentMatchday ? ` (J${coach.currentMatchday})` : '';
          await interaction.reply(`🏆 Compétition actuelle : **${current}**${matchday}`);
        }
        return;
      }

      store.updateCoachProfile(guildId, userId, { currentCompetition: competition });
      const autoInfo = competition === 'Ligue 1' ? '\n💡 Les journées s\'incrémentent automatiquement en Ligue 1' : '';
      await interaction.reply(`🏆 Compétition définie : **${competition}**${autoInfo}`);
      return;
    }

    if (commandName === 'season') {
      const season = options.getString('saison');
      
      if (!season) {
        const coach = store.getCoachProfile(guildId, userId);
        const current = coach?.currentSeason || 'Non définie';
        await interaction.reply(`📆 Saison actuelle : **${current}**`);
        return;
      }

      store.updateCoachProfile(guildId, userId, { currentSeason: season });
      await interaction.reply(`📆 Saison définie : **${season}**`);
      return;
    }

    if (commandName === 'matchday') {
      const matchday = options.getInteger('journee');
      
      if (!matchday) {
        const coach = store.getCoachProfile(guildId, userId);
        const competition = coach?.currentCompetition || 'Ligue 1';
        
        if (competition === 'Ligue 1') {
          const nextMatchday = coach?.currentMatchday || 1;
          await interaction.reply(`📅 Prochaine journée Ligue 1 : **J${nextMatchday}** (auto-calculée)`);
        } else {
          const current = coach?.currentMatchday || 'Non définie';
          await interaction.reply(`📅 Journée actuelle : **J${current}**`);
        }
        return;
      }

      store.updateCoachProfile(guildId, userId, { currentMatchday: matchday });
      await interaction.reply(`📅 Journée définie : **J${matchday}**`);
      return;
    }

    // === Audio ===
    if (commandName === 'champions-league') {
      if (!st?.connection) {
        await interaction.reply("Je ne suis pas connecté. Lance d'abord `/multiplex`.");
        return;
      }

      const success = await playAudioFile(guildId, UCL_ANTHEM_PATH);
      if (success) {
        await interaction.reply('🎵 Hymne de la Ligue des Champions en cours...');
      } else {
        await interaction.reply("❌ Fichier `ucl_anthem.mp3` introuvable dans le dossier assets.");
      }
      return;
    }

    if (commandName === 'europa-league') {
      if (!st?.connection) {
        await interaction.reply("Je ne suis pas connecté. Lance d'abord `/multiplex`.");
        return;
      }

      const success = await playAudioFile(guildId, EUROPA_ANTHEM_PATH);
      if (success) {
        await interaction.reply('🎵 Hymne de l\'Europa League en cours...');
      } else {
        await interaction.reply("❌ Fichier `europa_anthem.mp3` introuvable dans le dossier assets.");
      }
      return;
    }

    // === Historique ===
    if (commandName === 'history') {
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

      await msg.reply(lines.join('\n'));
      return;
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