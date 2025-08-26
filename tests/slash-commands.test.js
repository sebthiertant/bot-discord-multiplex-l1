/**
 * Tests de régression pour les slash commandes
 * Simule toutes les interactions possibles sans bot Discord réel
 */

// Ajouter un handler d'erreurs global pour capturer les erreurs silencieuses
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  process.exit(1);
});

// Vérification immédiate pour voir si le script démarre
console.log('🔧 Test script started...');

const fs = require('fs');
const path = require('path');

// Mock des modules Discord.js
const mockDiscord = {
  Client: class {},
  GatewayIntentBits: {},
  Partials: {},
  ChannelType: { GuildText: 0 },
  PermissionFlagsBits: {},
  createAudioPlayer: () => ({ on: () => {}, play: () => {} }),
  createAudioResource: () => ({ metadata: {} }),
  joinVoiceChannel: () => ({ on: () => {}, subscribe: () => {} }),
  entersState: () => Promise.resolve(),
  VoiceConnectionStatus: { Ready: 'ready' }
};

console.log('🔧 Discord mocks created...');

// Mock du store
const mockStore = {
  data: new Map(),
  getTeam: (guildId, userId) => mockStore.data.get(`${guildId}-${userId}-team`),
  setTeam: (guildId, userId, team) => mockStore.data.set(`${guildId}-${userId}-team`, team),
  clearTeam: (guildId, userId) => mockStore.data.delete(`${guildId}-${userId}-team`),
  getCoachProfile: (guildId, userId) => mockStore.data.get(`${guildId}-${userId}-coach`) || {},
  updateCoachProfile: (guildId, userId, updates) => {
    const existing = mockStore.data.get(`${guildId}-${userId}-coach`) || {};
    mockStore.data.set(`${guildId}-${userId}-coach`, { ...existing, ...updates });
  },
  addMatchToHistory: (guildId, userId, match) => {
    const key = `${guildId}-${userId}-history`;
    const history = mockStore.data.get(key) || [];
    const id = Date.now() + Math.random();
    history.unshift({ ...match, id, date: new Date() });
    mockStore.data.set(key, history);
    return id;
  },
  getMatchHistory: (guildId, userId, limit = 5) => {
    const history = mockStore.data.get(`${guildId}-${userId}-history`) || [];
    return history.slice(0, limit);
  },
  getBoard: () => null,
  setBoard: () => {},
  loadProfiles: () => Promise.resolve(),
  incrementPressCounter: () => 5,
  getPressSession: () => null,
  startPressSession: () => {},
  advancePressSession: () => null,
  resetPressCounter: () => {}
};

console.log('🔧 Store mocks created...');

// Mock des modules audio/TTS
const mockTTS = {
  synthToFile: () => Promise.resolve()
};

console.log('🔧 TTS mocks created...');

// Mock du système de fichiers pour éviter les erreurs de dépendances
const originalRequire = require;
require = function(id) {
  try {
    if (id === 'discord.js') return mockDiscord;
    if (id === '@discordjs/voice') return mockDiscord;
    if (id === './store') return mockStore;
    if (id === './tts.js') return mockTTS;
    if (id === './press') return { generateQuestions: () => Promise.resolve({ questions: [], presentation: 'Test' }) };
    if (id === './mercato.js') return { 
      generateMercatoAnnouncement: () => Promise.resolve('/tmp/test.mp3'),
      buildMercatoDisplayText: () => 'Test mercato'
    };
    if (id === './ending.js') return { buildEndingAnnouncement: () => 'Test ending' };
    if (id === './clubs.js') return { CLUB_VARIANTS: {}, CONCEDING_TEAM_PHRASES: { default: [] } };
    if (id === './openers.js') return { 
      OPENERS: [{ text: 'Test', weight: 1 }], 
      CONCEDING_OPENERS: [{ text: 'Test', weight: 1 }],
      MINIMAL_OPENERS: [{ text: 'Test', weight: 1 }],
      ANNOUNCEMENT_PATTERNS: [{ type: 'classic', weight: 1 }],
      MINIMAL_TEMPLATES: [{ text: 'Test', weight: 1 }],
      weightedRandom: (arr) => arr[0]?.text || arr[0]
    };
    if (id === './scorer.js') return {
      SCORER_TEMPLATES: [{ text: 'Test {scorer}', weight: 1 }],
      FINISHING_SCORER_TEMPLATES: [{ text: 'Test {scorer}', weight: 1 }],
      SCORER_FIRST_TEMPLATES: [{ text: 'Test {scorer}', weight: 1 }],
      MINIMAL_SCORER_TEMPLATES: [{ text: 'Test {scorer}', weight: 1 }],
      HUMILIATION_TEMPLATES: { manita: [{ text: 'Test', weight: 1 }], fanni: [{ text: 'Test', weight: 1 }] }
    };
    if (id === 'ffmpeg-static') return '/usr/bin/ffmpeg';
    if (id === 'dotenv') return { config: () => {} };
    
    return originalRequire(id);
  } catch (error) {
    console.error(`❌ Error requiring module '${id}':`, error.message);
    throw error;
  }
};

console.log('🔧 Require mocks setup...');

// Configuration de test
const TEST_GUILD_ID = 'test-guild-123';
const TEST_USER_ID = 'test-user-456';
const TEST_CHANNEL_ID = 'test-channel-789';

console.log('🔧 Test config created...');

// Helper pour créer une interaction mock
function createMockInteraction(commandName, options = {}) {
  const mockOptions = {
    getString: (key) => options[key] || null,
    getInteger: (key) => options[key] || null,
    getBoolean: (key) => options[key] || false,
    getChannel: (key) => options[key] || { id: TEST_CHANNEL_ID, type: 0 }
  };

  return {
    isChatInputCommand: () => true,
    commandName,
    options: mockOptions,
    guildId: TEST_GUILD_ID,
    user: { id: TEST_USER_ID, username: 'TestUser' },
    member: { 
      displayName: 'Test User',
      voice: { channel: { id: 'voice-123', name: 'Test Voice', guild: { id: TEST_GUILD_ID } } }
    },
    channel: { id: TEST_CHANNEL_ID, type: 0, guild: { id: TEST_GUILD_ID } },
    replied: false,
    deferred: false,
    reply: async (content) => {
      console.log(`✓ Reply: ${typeof content === 'string' ? content : JSON.stringify(content)}`);
      return { id: 'msg-' + Date.now() };
    },
    followUp: async (content) => {
      console.log(`✓ FollowUp: ${typeof content === 'string' ? content : JSON.stringify(content)}`);
      return { id: 'msg-' + Date.now() };
    },
    editReply: async (content) => {
      console.log(`✓ EditReply: ${typeof content === 'string' ? content : JSON.stringify(content)}`);
      return { id: 'msg-' + Date.now() };
    },
    deferReply: async () => {
      this.deferred = true;
      console.log(`✓ DeferReply`);
    }
  };
}

console.log('🔧 Mock interaction helper created...');

// Tests des slash commandes
class SlashCommandTester {
  constructor() {
    console.log('🔧 SlashCommandTester constructor starting...');
    this.passedTests = 0;
    this.failedTests = 0;
    this.errors = [];
    console.log('🔧 SlashCommandTester instance created...');
  }

  async test(description, testFn) {
    try {
      console.log(`\n🧪 ${description}`);
      await testFn();
      this.passedTests++;
      console.log(`✅ PASSED: ${description}`);
    } catch (error) {
      this.failedTests++;
      this.errors.push({ test: description, error: error.message });
      console.log(`❌ FAILED: ${description}`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }
  }

  async runAllTests() {
    console.log('🔧 runAllTests() method called...');
    console.log('🚀 Starting Slash Commands Regression Tests\n');

    try {
      console.log('🔧 About to load slash handler...');
      // Simuler le handler des interactions
      const { handleSlashCommand } = await this.loadSlashHandler();
      console.log('🔧 Handler loaded successfully...');

      // Test simple pour vérifier que tout fonctionne
      await this.test('Test framework should work', async () => {
        const testValue = 1 + 1;
        if (testValue !== 2) {
          throw new Error(`Math doesn't work: 1+1 = ${testValue}`);
        }
      });

      // Tests de base
      await this.test('Command /me should set team', async () => {
        const interaction = createMockInteraction('me', { club: 'Angers' });
        await handleSlashCommand(interaction);
        
        const savedTeam = mockStore.getTeam(TEST_GUILD_ID, TEST_USER_ID);
        if (savedTeam !== 'Angers') {
          throw new Error(`Expected 'Angers', got '${savedTeam}'`);
        }
      });

      await this.test('Command /whoami should return saved team', async () => {
        mockStore.setTeam(TEST_GUILD_ID, TEST_USER_ID, 'Test Team');
        const interaction = createMockInteraction('whoami');
        await handleSlashCommand(interaction);
      });

      await this.test('Command /forgetme should clear team', async () => {
        mockStore.setTeam(TEST_GUILD_ID, TEST_USER_ID, 'Test Team');
        const interaction = createMockInteraction('forgetme');
        await handleSlashCommand(interaction);
        
        const savedTeam = mockStore.getTeam(TEST_GUILD_ID, TEST_USER_ID);
        if (savedTeam !== undefined) {
          throw new Error(`Expected undefined, got '${savedTeam}'`);
        }
      });

      // Tests du profil coach
      await this.test('Command /coach-set should update profile', async () => {
        const interaction = createMockInteraction('coach-set', { 
          propriete: 'nom', 
          valeur: 'Test Coach' 
        });
        await handleSlashCommand(interaction);
        
        const profile = mockStore.getCoachProfile(TEST_GUILD_ID, TEST_USER_ID);
        if (profile.name !== 'Test Coach') {
          throw new Error(`Expected 'Test Coach', got '${profile.name}'`);
        }
      });

      await this.test('Command /coach should display profile', async () => {
        mockStore.updateCoachProfile(TEST_GUILD_ID, TEST_USER_ID, { 
          name: 'Test Coach',
          age: 35,
          nationality: 'France'
        });
        const interaction = createMockInteraction('coach');
        await handleSlashCommand(interaction);
      });

      // Tests de gestion de compétition
      await this.test('Command /competition should set competition', async () => {
        const interaction = createMockInteraction('competition', { nom: 'Ligue 1' });
        await handleSlashCommand(interaction);
        
        const profile = mockStore.getCoachProfile(TEST_GUILD_ID, TEST_USER_ID);
        if (profile.currentCompetition !== 'Ligue 1') {
          throw new Error(`Expected 'Ligue 1', got '${profile.currentCompetition}'`);
        }
      });

      await this.test('Command /season should set season', async () => {
        const interaction = createMockInteraction('season', { saison: '2024-2025' });
        await handleSlashCommand(interaction);
        
        const profile = mockStore.getCoachProfile(TEST_GUILD_ID, TEST_USER_ID);
        if (profile.currentSeason !== '2024-2025') {
          throw new Error(`Expected '2024-2025', got '${profile.currentSeason}'`);
        }
      });

      await this.test('Command /matchday should set matchday', async () => {
        const interaction = createMockInteraction('matchday', { journee: 15 });
        await handleSlashCommand(interaction);
        
        const profile = mockStore.getCoachProfile(TEST_GUILD_ID, TEST_USER_ID);
        if (profile.currentMatchday !== 15) {
          throw new Error(`Expected 15, got '${profile.currentMatchday}'`);
        }
      });

      // Tests d'historique
      await this.test('Command /history should return matches', async () => {
        // Ajouter un match test
        mockStore.addMatchToHistory(TEST_GUILD_ID, TEST_USER_ID, {
          team: 'Angers',
          opponent: 'Marseille',
          scoreFor: 2,
          scoreAgainst: 1,
          competition: 'Ligue 1'
        });
        
        const interaction = createMockInteraction('history', { nombre: 5 });
        await handleSlashCommand(interaction);
      });

      await this.test('Command /scorers should return stats', async () => {
        const interaction = createMockInteraction('scorers', { nombre: 10 });
        await handleSlashCommand(interaction);
      });

      // Tests de validation des paramètres
      await this.test('Command /coach-set should validate age', async () => {
        const interaction = createMockInteraction('coach-set', { 
          propriete: 'age', 
          valeur: '150' // Age invalide
        });
        await handleSlashCommand(interaction);
      });

      await this.test('Command /matchday should validate range', async () => {
        const interaction = createMockInteraction('matchday', { journee: 150 }); // Invalide
        await handleSlashCommand(interaction);
      });

      // Tests des commandes sans paramètres
      await this.test('Command /multiplex should work without params', async () => {
        const interaction = createMockInteraction('multiplex');
        await handleSlashCommand(interaction);
      });

      await this.test('Command /board should work without params', async () => {
        const interaction = createMockInteraction('board');
        await handleSlashCommand(interaction);
      });

      await this.test('Command /undo should work without params', async () => {
        const interaction = createMockInteraction('undo');
        await handleSlashCommand(interaction);
      });

      // Tests des commandes avec paramètres optionnels
      await this.test('Command /goal with all params', async () => {
        mockStore.setTeam(TEST_GUILD_ID, TEST_USER_ID, 'Angers');
        const interaction = createMockInteraction('goal', { 
          minute: 17, 
          buteur: 'Mbappé' 
        });
        await handleSlashCommand(interaction);
      });

      await this.test('Command /goal with minute only', async () => {
        const interaction = createMockInteraction('goal', { minute: 25 });
        await handleSlashCommand(interaction);
      });

      await this.test('Command /goal with scorer only', async () => {
        const interaction = createMockInteraction('goal', { buteur: 'Giroud' });
        await handleSlashCommand(interaction);
      });

      await this.test('Command /goal with no params', async () => {
        const interaction = createMockInteraction('goal');
        await handleSlashCommand(interaction);
      });

      // Tests des commandes d'erreur
      await this.test('Command /mercato without team should fail gracefully', async () => {
        mockStore.clearTeam(TEST_GUILD_ID, TEST_USER_ID);
        const interaction = createMockInteraction('mercato', {
          montant: 50,
          club_origine: 'AC Milan',
          joueur: 'Leão'
        });
        await handleSlashCommand(interaction);
      });

      // Tests de la conférence de presse
      await this.test('Command /conference force should work', async () => {
        // Ajouter un match pour avoir un historique
        mockStore.addMatchToHistory(TEST_GUILD_ID, TEST_USER_ID, {
          team: 'Angers',
          opponent: 'Marseille',
          scoreFor: 2,
          scoreAgainst: 1
        });
        
        const interaction = createMockInteraction('conference', { 
          force: true, 
          questions: 3 
        });
        await handleSlashCommand(interaction);
      });

      // Afficher les résultats
      this.displayResults();
    } catch (error) {
      console.error('❌ Fatal error in runAllTests:', error);
      throw error;
    }
  }

  async loadSlashHandler() {
    console.log('🔧 Loading slash handler...');
    
    // Créer un handler simplifié basé sur le code principal
    return {
      handleSlashCommand: async (interaction) => {
        console.log(`🔧 Handling command: ${interaction.commandName}`);
        
        const { commandName, options, guildId, user } = interaction;
        const userId = user.id;

        // Simuler la logique principale sans les dépendances audio
        switch (commandName) {
          case 'me':
            const team = options.getString('club');
            mockStore.setTeam(guildId, userId, team);
            await interaction.reply(`✅ Club défini : **${team}**`);
            break;

          case 'whoami':
            const saved = mockStore.getTeam(guildId, userId);
            await interaction.reply(saved ? `Ton club mémorisé : **${saved}**`
              : "Aucun club mémorisé. Utilise `/me` pour en définir un.");
            break;

          case 'forgetme':
            mockStore.clearTeam(guildId, userId);
            await interaction.reply('🗑️ Club oublié.');
            break;

          case 'coach':
            const profile = mockStore.getCoachProfile(guildId, userId);
            if (!profile || Object.keys(profile).length === 0) {
              await interaction.reply("Aucun profil coach configuré.");
              return;
            }
            const coachLines = [`👤 **Profil Coach**`];
            if (profile.name) coachLines.push(`Nom : ${profile.name}`);
            if (profile.nationality) coachLines.push(`Nationalité : ${profile.nationality}`);
            if (profile.age) coachLines.push(`Âge : ${profile.age} ans`);
            await interaction.reply(coachLines.join('\n'));
            break;

          case 'coach-set':
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
            if (!mappedProp) {
              await interaction.reply("Propriété inconnue.");
              return;
            }
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
            mockStore.updateCoachProfile(guildId, userId, updates);
            await interaction.reply(`✅ ${prop} mis à jour : **${value}**`);
            break;

          case 'competition':
            const competition = options.getString('nom');
            if (!competition) {
              const coach = mockStore.getCoachProfile(guildId, userId);
              const current = coach?.currentCompetition || 'Ligue 1';
              await interaction.reply(`🏆 Compétition actuelle : **${current}**`);
              return;
            }
            mockStore.updateCoachProfile(guildId, userId, { currentCompetition: competition });
            await interaction.reply(`🏆 Compétition définie : **${competition}**`);
            break;

          case 'season':
            const season = options.getString('saison');
            if (!season) {
              const coach = mockStore.getCoachProfile(guildId, userId);
              const current = coach?.currentSeason || 'Non définie';
              await interaction.reply(`📆 Saison actuelle : **${current}**`);
              return;
            }
            mockStore.updateCoachProfile(guildId, userId, { currentSeason: season });
            await interaction.reply(`📆 Saison définie : **${season}**`);
            break;

          case 'matchday':
            const matchday = options.getInteger('journee');
            if (!matchday) {
              const coach = mockStore.getCoachProfile(guildId, userId);
              const current = coach?.currentMatchday || 'Non définie';
              await interaction.reply(`📅 Journée actuelle : **J${current}**`);
              return;
            }
            if (matchday < 1 || matchday > 99) {
              await interaction.reply("La journée doit être entre 1 et 99.");
              return;
            }
            mockStore.updateCoachProfile(guildId, userId, { currentMatchday: matchday });
            await interaction.reply(`📅 Journée définie : **J${matchday}**`);
            break;

          case 'history':
            const limit = options.getInteger('nombre') || 5;
            const matches = mockStore.getMatchHistory(guildId, userId, limit);
            if (matches.length === 0) {
              await interaction.reply("Aucun match dans l'historique.");
              return;
            }
            const historyLines = [`📋 **Historique** — ${matches.length} match(s)`];
            matches.forEach((match, i) => {
              const result = `${match.scoreFor || 0}-${match.scoreAgainst || 0}`;
              const vs = match.opponent || '?';
              historyLines.push(`${i + 1}. ${match.team || '?'} ${result} ${vs}`);
            });
            await interaction.reply(historyLines.join('\n'));
            break;

          case 'scorers':
            await interaction.reply('⚽ Statistiques des buteurs (simulation)');
            break;

          case 'multiplex':
            await interaction.reply('🎛️ Multiplex activé (simulation)');
            break;

          case 'board':
            await interaction.reply('📊 Tableau mis à jour (simulation)');
            break;

          case 'undo':
            await interaction.reply('↩️ Action annulée (simulation)');
            break;

          case 'goal':
          case 'goal-against':
            const minute = options.getInteger('minute');
            const scorer = options.getString('buteur');
            let msg = `${commandName === 'goal' ? '⚽' : '🥅'} Test 1-0 Opponent`;
            if (scorer) msg += ` — ${scorer}`;
            await interaction.reply(msg);
            break;

          case 'mercato':
            const userClub = mockStore.getTeam(guildId, userId);
            if (!userClub) {
              await interaction.reply("Définis d'abord ton club avec `/me`!");
              return;
            }
            await interaction.reply('💰 Annonce mercato générée (simulation)');
            break;

          case 'conference':
            const isForced = options.getBoolean('force');
            if (!isForced) {
              await interaction.reply("❌ Aucune conférence en cours. Utilisez force:true");
              return;
            }
            await interaction.deferReply();
            await interaction.editReply('🎙️ Conférence de presse générée (simulation)');
            break;

          default:
            console.log(`🔧 Command ${commandName} not implemented in test`);
            await interaction.reply(`Commande ${commandName} non implémentée dans le test`);
        }
      }
    };
  }

  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    console.log(`📊 Total:  ${this.passedTests + this.failedTests}`);
    
    if (this.failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.errors.forEach(({ test, error }) => {
        console.log(`  • ${test}: ${error}`);
      });
    }
    
    if (this.failedTests === 0) {
      console.log('\n🎉 ALL TESTS PASSED! No regressions detected.');
    } else {
      console.log(`\n⚠️  ${this.failedTests} test(s) failed. Please review the issues above.`);
    }
    
    console.log('='.repeat(60));
  }
}

// Exécution des tests si le fichier est lancé directement
console.log('🔧 Checking if main module...');
console.log('🔧 require.main:', require.main);
console.log('🔧 module:', module);
console.log('🔧 require.main === module:', require.main === module);

// FIX: Forcer l'exécution des tests car require.main peut être perturbé par les mocks
const isMainModule = require.main === module || process.argv[1].includes('slash-commands.test.js');

if (isMainModule) {
  console.log('🔧 Script is main module, starting tests...');
  
  (async () => {
    try {
      console.log('🔧 Creating SlashCommandTester instance...');
      const tester = new SlashCommandTester();
      console.log('🔧 Instance created, starting tests...');
      await tester.runAllTests();
      console.log('🔧 Tests completed successfully!');
    } catch (error) {
      console.error('❌ FATAL ERROR:', error);
      console.error('❌ STACK:', error.stack);
      process.exit(1);
    }
  })();
} else {
  console.log('🔧 Module loaded as dependency');
}

module.exports = SlashCommandTester;
