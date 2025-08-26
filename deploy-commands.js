require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  // === Commandes de base ===
  new SlashCommandBuilder()
    .setName('me')
    .setDescription('Définir ton club')
    .addStringOption(option =>
      option.setName('club')
        .setDescription('Le nom de ton club')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('whoami')
    .setDescription('Voir ton club mémorisé'),

  new SlashCommandBuilder()
    .setName('forgetme')
    .setDescription('Oublier ton club mémorisé'),

  new SlashCommandBuilder()
    .setName('multiplex')
    .setDescription('Connecter/déconnecter le bot au vocal'),

  // === Gestion de match ===
  new SlashCommandBuilder()
    .setName('vs')
    .setDescription('Définir l\'adversaire')
    .addStringOption(option =>
      option.setName('adversaire')
        .setDescription('Le nom de l\'adversaire')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Commencer le match (coup d\'envoi)'),

  new SlashCommandBuilder()
    .setName('goal')
    .setDescription('But POUR ton équipe')
    .addIntegerOption(option =>
      option.setName('minute')
        .setDescription('Minute du but')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('buteur')
        .setDescription('Nom du buteur')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('goal-against')
    .setDescription('But CONTRE ton équipe')
    .addIntegerOption(option =>
      option.setName('minute')
        .setDescription('Minute du but')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('buteur')
        .setDescription('Nom du buteur')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('minute')
    .setDescription('Régler la minute du match')
    .addIntegerOption(option =>
      option.setName('minute')
        .setDescription('Minute actuelle')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('halftime')
    .setDescription('Mi-temps (45\')'),

  new SlashCommandBuilder()
    .setName('second-half')
    .setDescription('Début de la seconde période (46\')'),

  new SlashCommandBuilder()
    .setName('end')
    .setDescription('Fin du match (90\') + sauvegarde'),

  new SlashCommandBuilder()
    .setName('undo')
    .setDescription('Annuler la dernière action'),

  // === Profil Coach ===
  new SlashCommandBuilder()
    .setName('coach')
    .setDescription('Voir ton profil coach'),

  new SlashCommandBuilder()
    .setName('coach-set')
    .setDescription('Modifier ton profil coach')
    .addStringOption(option =>
      option.setName('propriete')
        .setDescription('Propriété à modifier')
        .setRequired(true)
        .addChoices(
          { name: 'Nom', value: 'nom' },
          { name: 'Nationalité', value: 'nationalité' },
          { name: 'Âge', value: 'age' },
          { name: 'Compétition', value: 'compétition' },
          { name: 'Saison', value: 'saison' },
          { name: 'Journée', value: 'journée' }
        ))
    .addStringOption(option =>
      option.setName('valeur')
        .setDescription('Nouvelle valeur')
        .setRequired(true)),

  // === Gestion Compétition ===
  new SlashCommandBuilder()
    .setName('competition')
    .setDescription('Voir ou définir la compétition actuelle')
    .addStringOption(option =>
      option.setName('nom')
        .setDescription('Nom de la compétition')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('season')
    .setDescription('Voir ou définir la saison actuelle')
    .addStringOption(option =>
      option.setName('saison')
        .setDescription('Saison (ex: 2024-2025)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('matchday')
    .setDescription('Voir ou définir la journée actuelle')
    .addIntegerOption(option =>
      option.setName('journee')
        .setDescription('Numéro de journée (1-99)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(99)),

  // === Audio ===
  new SlashCommandBuilder()
    .setName('champions-league')
    .setDescription('Jouer l\'hymne de la Ligue des Champions'),

  new SlashCommandBuilder()
    .setName('europa-league')
    .setDescription('Jouer l\'hymne de l\'Europa League'),

  // === Historique ===
  new SlashCommandBuilder()
    .setName('history')
    .setDescription('Voir l\'historique des matchs')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de matchs à afficher (max 20)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)),

  new SlashCommandBuilder()
    .setName('scorers')
    .setDescription('Top des buteurs')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de buteurs à afficher (max 20)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)),

  // === Tableau ===
  new SlashCommandBuilder()
    .setName('board')
    .setDescription('Mettre à jour le tableau'),

  new SlashCommandBuilder()
    .setName('board-setup')
    .setDescription('Configurer le tableau dans un salon')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Salon où créer le tableau')
        .setRequired(false)),

  // === Mercato ===
  new SlashCommandBuilder()
    .setName('mercato')
    .setDescription('Annoncer un transfert (style Fabrizio Romano)')
    .addIntegerOption(option =>
      option.setName('montant')
        .setDescription('Montant en millions d\'euros')
        .setRequired(true)
        .setMinValue(0))
    .addStringOption(option =>
      option.setName('club_origine')
        .setDescription('Club d\'origine du joueur')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('joueur')
        .setDescription('Nom du joueur')
        .setRequired(true)),

  // === Conférence de presse ===
  new SlashCommandBuilder()
    .setName('conference')
    .setDescription('Conférence de presse')
    .addBooleanOption(option =>
      option.setName('force')
        .setDescription('Forcer une nouvelle conférence')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('questions')
        .setDescription('Nombre de questions (mode forcé)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5)),

].map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🚀 Déploiement de ${commands.length} slash commandes...`);
    console.log(`📋 Client ID: ${process.env.CLIENT_ID}`);
    
    // Vérifier que les variables d'environnement sont présentes
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('❌ DISCORD_TOKEN manquant dans .env');
    }
    if (!process.env.CLIENT_ID) {
      throw new Error('❌ CLIENT_ID manquant dans .env');
    }

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ ${data.length} slash commandes déployées avec succès globalement.`);
    console.log('💡 Les commandes peuvent prendre jusqu\'à 1 heure pour apparaître partout.');
    console.log('💡 Pour un déploiement immédiat sur un serveur de test, utilisez guild commands.');
    
  } catch (error) {
    console.error('❌ Erreur lors du déploiement:');
    if (error.code === 50001) {
      console.error('🔒 Erreur: Accès manquant. Vérifiez que le bot a la permission "applications.commands"');
    } else if (error.code === 10002) {
      console.error('🤖 Erreur: Application inconnue. Vérifiez votre CLIENT_ID');
    } else {
      console.error(error);
    }
  }
})();
