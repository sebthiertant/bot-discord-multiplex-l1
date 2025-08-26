require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// REMPLACEZ CETTE LIGNE AVEC L'ID DE VOTRE SERVEUR DE TEST
const GUILD_ID = 'VOTRE_GUILD_ID_ICI'; // Ex: '123456789012345678'

const commands = [
  // Copier les mêmes commandes que deploy-commands.js
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

  // Ajoutez d'autres commandes ici si nécessaire pour les tests...

].map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🚀 Déploiement de ${commands.length} slash commandes sur le serveur ${GUILD_ID}...`);
    
    if (GUILD_ID === 'VOTRE_GUILD_ID_ICI') {
      console.log('⚠️  Modifiez GUILD_ID dans ce fichier avec l\'ID de votre serveur de test');
      return;
    }

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands },
    );

    console.log(`✅ ${data.length} slash commandes déployées immédiatement sur le serveur.`);
    
  } catch (error) {
    console.error('❌ Erreur lors du déploiement guild:', error);
  }
})();
