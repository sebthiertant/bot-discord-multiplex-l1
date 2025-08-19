// index.js (CommonJS)
require('dotenv').config();

// ✅ FFmpeg embarqué
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
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

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '!';
const ASSETS_DIR = 'assets';
const JINGLE_PATH = path.join(ASSETS_DIR, 'but.mp3'); // ou but_trimmed.mp3

// État par serveur (guild)
const stateByGuild = new Map();
/*
state = {
  connection, player, voiceChannelId, stay: boolean,
  queue: AudioResource[], playing: boolean
}
*/

// ———————————————————————————————————
// Variations club & helpers
// ———————————————————————————————————
const { CLUB_VARIANTS } = require('./clubs.js');
const { OPENERS } = require('./openers.js');
const { SCORER_TEMPLATES } = require('./scorer.js');
// ———————————————————————————————————
// Variations club & helpers
// ———————————————————————————————————

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function normalizeKey(s) {
  return s
    ?.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // supprime accents
    .replace(/[^a-z0-9]+/g, '') || null;               // supprime non-alphanum
}

function buildTtsSentence(clubRaw, scorerRaw) {
  const clubKey = normalizeKey(clubRaw);
  const variants = clubKey && CLUB_VARIANTS[clubKey] ? CLUB_VARIANTS[clubKey] : null;

  let parts = [];
  parts.push(rand(OPENERS));

  if (variants) {
    parts.push(rand(variants));
  } else if (clubRaw) {
    // fallback si club inconnu → annonce générique avec club original
    parts.push(`But pour ${clubRaw} !`);
  } else {
    parts.push("But !");
  }

  const scorer = scorerRaw?.trim();
  if (scorer) {
    const templ = rand(SCORER_TEMPLATES);
    parts.push(templ.replace('{scorer}', scorer));
  }

  return parts.join(' ');
}

// ———————————————————————————————————
// Bot
// ———————————————————————————————————
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

client.on('voiceStateUpdate', async (oldState, newState) => {
  // auto-leave si plus aucun humain dans le salon où on garde la connexion
  const guildId = newState.guild.id || oldState.guild.id;
  const st = stateByGuild.get(guildId);
  if (!st || !st.stay || !st.voiceChannelId) return;

  const channel = newState.guild.channels.cache.get(st.voiceChannelId)
    || oldState.guild.channels.cache.get(st.voiceChannelId);
  if (!channel || channel.type !== 2) return; // GUILD_VOICE

  const nonBotMembers = channel.members.filter(m => !m.user.bot);
  if (nonBotMembers.size === 0) {
    console.log('[AUTO] Salon vide, on se déconnecte');
    safeDestroy(guildId);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guildId) return;
  if (!message.content.startsWith(PREFIX)) return;

  const content = message.content.trim();
  const [cmdRaw] = content.split(/\s+/);
  const cmd = cmdRaw.slice(PREFIX.length).toLowerCase();

  if (cmd === 'multiplex') {
    await handleMultiplex(message);
    return;
  }

  if (cmd.startsWith('but')) {
    await handleBut(message, cmdRaw);
    return;
  }
});

// ———————————————————————————————————
// Commandes
// ———————————————————————————————————
async function handleMultiplex(message) {
  const guildId = message.guildId;
  const member = message.member;
  const voiceChannel = member?.voice?.channel;

  let st = stateByGuild.get(guildId);

  if (st?.connection && st.stay) {
    // toggle OFF
    await message.reply("🔌 Multiplex désactivé. Je me déconnecte.");
    safeDestroy(guildId);
    return;
  }

  if (!voiceChannel) {
    await message.reply("Rejoins d'abord un salon vocal, puis refais `!multiplex`.");
    return;
  }

  // join & stay
  st = await ensureConnection(voiceChannel, true);
  await message.reply(`🎛️ Multiplex activé dans **${voiceChannel.name}**. J'y reste jusqu'à ce qu'il n'y ait plus personne ou jusqu'à \`!multiplex\`.`);
}

async function handleBut(message, cmdRaw) {
  const guildId = message.guildId;
  const st = stateByGuild.get(guildId);

  if (!st?.connection) {
    await message.reply("Je ne suis pas connecté. Lance d'abord `!multiplex` dans un salon vocal.");
    return;
  }

  // Parse !but[-club][-buteur...]
  const rest = cmdRaw.slice('!but'.length); // ex: "-angers-diony"
  let club = null, scorer = null;
  if (rest.startsWith('-')) {
    const parts = rest.slice(1).split('-'); // ["angers","diony"]
    club = parts[0] || null;
    if (parts.length > 1) {
      scorer = parts.slice(1).join(' ').trim();
    }
  }

  // 1) jingle
  const jingleRes = createAudioResource(JINGLE_PATH);
  // 2) TTS
  const text = buildTtsSentence(club, scorer);
  const ttsPath = path.join(ASSETS_DIR, `tts_${Date.now()}.mp3`);
  try {
    await synthToFile(text, ttsPath, "fr-FR-HenriNeural", "excited");
  } catch (e) {
    console.error('[TTS] erreur synthèse:', e);
    await message.reply("Impossible de générer la voix pour l'instant.");
    return;
  }
  const ttsRes = createAudioResource(ttsPath);
  ttsRes.metadata = { tempPath: ttsPath };

  // push dans la file du serveur
  enqueue(guildId, [jingleRes, ttsRes]);
  await message.react('🎙️');
}

// ———————————————————————————————————
// Audio & Connexion
// ———————————————————————————————————
async function ensureConnection(voiceChannel, stayFlag = false) {
  const guildId = voiceChannel.guild.id;
  let st = stateByGuild.get(guildId);
  if (st?.connection && st.voiceChannelId === voiceChannel.id) {
    st.stay = stayFlag || st.stay;
    return st;
  }

  // détruit l'ancienne si elle existe
  if (st?.connection) safeDestroy(guildId);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  console.log('[VOICE] Ready in', voiceChannel.name);

  const player = createAudioPlayer();
  connection.subscribe(player);

  const newState = {
    connection,
    player,
    voiceChannelId: voiceChannel.id,
    stay: stayFlag,
    queue: [],
    playing: false,
  };

  // player events
  player.on(AudioPlayerStatus.Playing, () => console.log('[PLAYER] Playing'));
  player.on(AudioPlayerStatus.Buffering, () => console.log('[PLAYER] Buffering'));
  player.on(AudioPlayerStatus.Idle, async () => {
    // supprime éventuel fichier TTS terminé
    const last = newState._lastResource;
    if (last?.metadata?.tempPath) {
      fs.promises.unlink(last.metadata.tempPath).catch(() => {});
    }

    // joue la suite de la file
    if (newState.queue.length > 0) {
      const next = newState.queue.shift();
      newState._lastResource = next;
      player.play(next);
    } else {
      newState.playing = false;
      if (!newState.stay) {
        // si on n'est pas en mode garde, on quitte
        setTimeout(() => safeDestroy(guildId), 1200);
      }
    }
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => console.log('[VOICE] Disconnected'));
  connection.on(VoiceConnectionStatus.Destroyed, () => console.log('[VOICE] Destroyed'));

  stateByGuild.set(guildId, newState);
  return newState;
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
  try { st.connection.destroy(); } catch {}
  // nettoie fichiers TTS restants dans la queue
  for (const r of st.queue) {
    if (r?.metadata?.tempPath) {
      try { fs.unlinkSync(r.metadata.tempPath); } catch {}
    }
  }
  stateByGuild.delete(guildId);
}
// ———————————————————————————————————

client.login(TOKEN);
// ———————————————————————————————————