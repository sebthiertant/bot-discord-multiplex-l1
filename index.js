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
  ChannelType,            // ✅ AJOUT
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

console.log(generateDependencyReport());

// --- CONFIG ---
const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '!';
const ASSETS_DIR = 'assets';
const JINGLE_PATH = path.join(ASSETS_DIR, 'but.mp3'); // place ton jingle ici

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
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pretty(k) { return (k || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

function getGuildDay(guildId) {
  let g = md.get(guildId);
  if (!g) {
    g = { matches: new Map(), boardMsgId: null };
    md.set(guildId, g);
  }
  return g;
}

function resetMatch(m, { keepTeam = true, keepOpp = true } = {}) {
  m.for = 0;
  m.against = 0;
  m.minute = 0;
  delete m.minuteLabel;
  m.hist = [];
  m.status = 'IDLE';
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
  const val = OPENERS[_openerIdx % OPENERS.length];
  _openerIdx = (_openerIdx + 1) % OPENERS.length;
  return val;
}
function nextScorerTpl() {
  if (!SCORER_TEMPLATES?.length) return "But de {scorer} !";
  const val = SCORER_TEMPLATES[_scorerIdx % SCORER_TEMPLATES.length];
  _scorerIdx = (_scorerIdx + 1) % SCORER_TEMPLATES.length;
  return val;
}
function nextClubVariant(clubKey, arr) {
  if (!arr?.length) return null;
  const prev = _clubIdx.get(clubKey) || 0;
  const val = arr[prev % arr.length];
  _clubIdx.set(clubKey, (prev + 1) % arr.length);
  return val;
}

function getMatch(guildId, userId) {
  const g = getGuildDay(guildId);

  // 1) Récupère ou crée l’état du match pour l’utilisateur
  let m = g.matches.get(userId);
  if (!m) {
    m = { team: null, opp: null, for: 0, against: 0, minute: 0, status: 'IDLE', hist: [] };
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

function fmtMin(n) { return n ? `${n}’` : ``; }

function renderBoard(guildId, client) {
  const g = getGuildDay(guildId);
  const lines = [];
  for (const [uid, m] of g.matches.entries()) {
    const user = client.users.cache.get(uid);
    const tag = user ? user.username : uid;
    const head = m.team || "—";
    const opp = m.opp || "—";
    const badge = m.status === 'LIVE' ? '🟢' : m.status === 'MT' ? '🟡' : m.status === 'FIN' ? '🔴' : '⚪';
    lines.push(`**${tag}** — ${head} ${m.for}-${m.against} ${opp} ${fmtMin(m.minute)} ${badge}`);
  }
  return { content: lines.join("\n") || "Aucun match.", allowedMentions: { parse: [] } };
}

// --- TEXTE TTS ---
const { CLUB_VARIANTS } = require('./clubs.js');
const { OPENERS } = require('./openers.js');
const { SCORER_TEMPLATES } = require('./scorer.js');

function buildTtsSentence(clubRaw, scorerRaw) {
  const clubKey = normalizeKey(clubRaw);
  const variants = clubKey && CLUB_VARIANTS[clubKey] ? CLUB_VARIANTS[clubKey] : null;

  const parts = [];
  parts.push(nextOpener()); // ex: "Hé !", "Oh oui !", …

  if (variants) {
    parts.push(nextClubVariant(clubKey, variants)); // varie entre les phrases du club
  } else {
    parts.push(clubRaw ? `But pour ${clubRaw} !` : "But !");
  }

  if (scorerRaw) {
    const tpl = nextScorerTpl(); // varie entre les phrases buteur
    parts.push(tpl.replace('{scorer}', scorerRaw));
  }

  return parts.join(' ');
}


function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// TODO A deplacer
const PHRASES = {
  takeLead: ["prend l’avantage.", "passe devant.", "prend les commandes."],
  extendLeadBreak: ["fait le break.", "creuse l’écart.", "se met à l’abri."],
  extendLead: ["creuse l’écart.", "accentue son avance."],
  equalize: ["égalise.", "revient à hauteur."],
  reduceGap: ["réduit l’écart.", "se relance."],
  weStillLead: ["conserve l’avantage.", "reste devant."]
};

function buildGoalAnnouncement(team, opp, f, a, minute, scorer, cmd) {
  const isFor = cmd === '!g';

  // Score AVANT le but
  const prevF = isFor ? f - 1 : f;
  const prevA = isFor ? a : a - 1;

  // Phrase d’ouverture + club & buteur (tes fichiers textes)
  const base = buildTtsSentence(isFor ? team : opp, scorer);

  // Lignes info
  const scoreLine = (team && opp) ? `${team} ${f}, ${opp} ${a}.` : '';
  const minuteLine = minute ? `${minute}e minute.` : '';

  // Ligne statut en fonction de l’évolution du score
  let statusLine = '';
  if (team && opp) {
    if (isFor) {
      if (prevF < prevA && f === a) statusLine = `${team} ${pick(PHRASES.equalize)}`;
      else if (prevF === prevA && f > a) statusLine = `${team} ${pick(PHRASES.takeLead)}`;
      else if (prevF > prevA && f > a) {
        const newMargin = f - a;
        statusLine = `${team} ${pick(newMargin === 2 ? PHRASES.extendLeadBreak : PHRASES.extendLead)}`;
      } else if (prevF < prevA && f < a) statusLine = `${team} ${pick(PHRASES.reduceGap)}`;
      else statusLine = ''; // cas limites
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
    const st = getAudioState(guildId); // ✅ FIX: définir st ici

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
      await msg.reply('🟡 Mi-temps.');
      await updateBoardMsg(client, guildId);
      return;
    }

    if (cmd === '!fin') {
      m.status = 'FIN';
      await msg.reply('🔴 Fin du match.');
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
        await msg.reply("Je ne suis pas connecté. Lance d’abord `!multiplex`.");
        return;
      }
      // !g [minute] [buteur…]
      let minute = null, scorer = null;
      if (rest.length && /^\d+$/.test(rest[0])) minute = parseInt(rest.shift(), 10);
      if (minute != null) m.minute = Math.max(0, minute);
      if (rest.length) scorer = rest.join(' ');

      m.hist.push({ prev: { ...m } });
      if (cmd === '!g') m.for++; else m.against++;

      const text = buildGoalAnnouncement(m.team, m.opp, m.for, m.against, m.minute, scorer, cmd);
      await enqueueJingleAndTTS(guildId, text);

      await msg.reply(
        `${cmd === '!g' ? '⚽' : '🥅'} ${m.team || '—'} ${m.for}-${m.against} ${m.opp || '—'} ${m.minute ? `${m.minute}’` : ''}`
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



    if (cmd === '!board') {
      const meta = store.getBoard(guildId);
      if (!meta) {
        return void msg.reply("Aucun tableau configuré. Lance `!boardset #multiplex-board` d’abord.");
      }
      await updateBoardMsg(client, guildId);
      const ch = await client.channels.fetch(meta.channelId).catch(() => null);
      return void msg.reply(`📋 Tableau mis à jour dans ${ch ? ch.toString() : '<inconnu>'}.`);
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
  } catch (e) {
    console.error('messageCreate error:', e);
    try { await msg.reply("Oups, une erreur est survenue."); } catch { }
  }
});

// --- PANNEAU: interactions boutons ---
client.on('interactionCreate', async (i) => {
  if (!i.isButton()) return;
  const [kind, targetUserId] = i.customId.split(':'); // ex: goal_for:123, minp1:123, undo:123
  if (targetUserId !== i.user.id) {
    return i.reply({ content: "Ce panneau ne t’est pas assigné. Utilise `!panel` pour le tien 😉", ephemeral: true });
  }
  const guildId = i.guildId;
  const m = getMatch(guildId, i.user.id);
  const st = getAudioState(guildId);

  switch (kind) {
    case 'goal_for':
    case 'goal_against': {
      if (!st?.connection) { return i.reply({ content: "Je ne suis pas connecté. Lance `!multiplex`.", ephemeral: true }); }
      // save
      m.hist.push({ prev: { ...m } });
      if (kind === 'goal_for') m.for++; else m.against++;
      const text = buildGoalText(m.team, m.opp, m.for, m.against, m.minute, null);
      await enqueueJingleAndTTS(guildId, text);
      await updateBoardMessage(i);
      return i.deferUpdate();
    }
    case 'minp1': m.minute = Math.max(0, (m.minute || 0) + 1); await updateBoardMessage(i); return i.deferUpdate();
    case 'minp5': m.minute = Math.max(0, (m.minute || 0) + 5); await updateBoardMessage(i); return i.deferUpdate();
    case 'undo': {
      const last = m.hist.pop();
      if (last) { Object.assign(m, last.prev); await updateBoardMessage(i); return i.deferUpdate(); }
      return i.reply({ content: "Rien à annuler.", ephemeral: true });
    }
    case 'mt': m.status = 'MT'; await updateBoardMessage(i); return i.deferUpdate();
    case 'fin': m.status = 'FIN'; await updateBoardMessage(i); return i.deferUpdate();
    default: return i.deferUpdate();
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

function makePanelRows(userId) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`goal_for:${userId}`).setStyle(ButtonStyle.Success).setLabel('Goal + ⚽'),
    new ButtonBuilder().setCustomId(`goal_against:${userId}`).setStyle(ButtonStyle.Danger).setLabel('Goal - 🥅'),
    new ButtonBuilder().setCustomId(`undo:${userId}`).setStyle(ButtonStyle.Secondary).setLabel('Undo ↩️'),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`minp1:${userId}`).setStyle(ButtonStyle.Primary).setLabel('+1’ ⏱️'),
    new ButtonBuilder().setCustomId(`minp5:${userId}`).setStyle(ButtonStyle.Primary).setLabel('+5’ ⏱️'),
    new ButtonBuilder().setCustomId(`mt:${userId}`).setStyle(ButtonStyle.Secondary).setLabel('MT 🟡'),
    new ButtonBuilder().setCustomId(`ft:${userId}`).setStyle(ButtonStyle.Secondary).setLabel('FIN 🔴'),
  );
  return [row1, row2];
}