# Multiplex L1 – Bot Discord "jingle + annonces" pour Football Manager

Bot Discord pour vos parties FM en réseau :

Joue le jingle "but" puis une annonce vocale (Azure Speech).

Suis un match par joueur (score, minute, statut, adversaire).

Affiche un tableau récap unique, épinglé dans un salon dédié.

Mémorise le club de chaque joueur + profil coach + historique des matchs (par serveur).

## **✨ Fonctionnalités**

- **🆕 Slash Commandes** : Interface moderne avec auto-complétion (`/me`, `/goal`, `/multiplex`, etc.)
- Audio : jingle MP3 + TTS Azure (voix FR, ton "excited", paramètres ajustables).
- Multiplex : le bot rejoint un salon vocal et y reste tant qu'il y a des humains.
- Hymnes UEFA : `/champions-league` (Ligue des Champions) et `/europa-league` (Europa League).
- **🆕 Annonces mercato** : Style Fabrizio Romano avec `/mercato`.
- Suivi léger (sans intégration FM) :
  - score, minute, buteur, adversaire, statuts (LIVE, MT, 2e MT, FIN).
  - annonces vocales variées (openers, variantes par club, modèles buteur).
- Tableau récap : un seul message épinglé dans #multiplex-board, mis à jour automatiquement.
- Persistance : clubs, profil coach, historique matchs stockés dans data/profiles.json.
- Conférences de presse IA contextuelle avec historique.
- **Compétition par défaut : Ligue 1** (si aucune compétition n'est définie).
- **🆕 Auto-incrémentation des journées en Ligue 1** : Plus besoin de gérer manuellement !
- **🆕 Statistiques des buteurs** : Top des meilleurs buteurs dans l'historique.

## **🧱 Prérequis**

- Node.js 18+ (OK avec Node 22).
- Un serveur Discord où vous pouvez inviter un bot.
- Un compte Microsoft Azure et une ressource Speech (clé + région).
- Un compte OpenAI (pour les conférences de presse).
- FFmpeg : déjà inclus via ffmpeg-static.

## **🚀 Installation**

```bash
git clone <ce dépôt>
cd bot_discord_l1_multiplex
npm install
```

Placez le jingle dans `assets/but.mp3` (créez le dossier si besoin).

## **🔐 Configuration**

Créez un fichier `.env` à la racine :

```
# Discord
DISCORD_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLIENT_ID=1234567890123456789

# Azure Speech
AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SPEECH_REGION=westeurope

# OpenAI (pour conférences de presse)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
PRESS_MODEL=gpt-4o
PRESS_NUM_DEFAULT=2

# (Facultatif) réglages voix
AZURE_VOICE=fr-FR-HenriNeural
AZURE_STYLE=excited       # excited | cheerful
AZURE_DEG=1.7             # intensité émotionnelle (0.01–2)
AZURE_RATE=2              # vitesse parole en %
AZURE_PITCH=-0.3          # hauteur en demi-tons (négatif = plus grave)
```

## **🗂️ Structure (fichiers principaux)**

- `index.js` : logique du bot (commandes, audio, suivi, tableau).
- `tts.js` : Azure Speech (SSML homogène, fallback).
- `clubs.js / openers.js / scorer.js` : variantes de texte pour les annonces.
- `store.js` : persistance JSON (data/profiles.json).
- `press.js` : génération conférences de presse OpenAI.
- `assets/but.mp3` : jingle du multiplex.
- `assets/ucl_anthem.mp3` : hymne Ligue des Champions (à ajouter).
- `assets/europa_anthem.mp3` : hymne Europa League (à ajouter).

## **☁️ Mise en place Azure Speech (rapide)**

1. Créez un compte sur portal.azure.com.
2. Create resource → AI Services → Speech.
3. Choisissez un Resource Group, une Region (ex. westeurope).
4. Une fois créée : Keys and Endpoint → récupérez Key 1 et Location/Region.
5. Mettez-les dans `.env` (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`).

(Facultatif) Ajustez `AZURE_VOICE`, `AZURE_STYLE`, `AZURE_DEG`, `AZURE_RATE`, `AZURE_PITCH`.

Ce bot utilise clé + région (pas besoin d'Azure AD/OAuth).

## **🤖 Création du bot Discord + Slash Commandes**

### 1. Création de l'application Discord

- Ouvrez le [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
- Donnez un nom à votre application (ex: "Multiplex L1 Bot").
- Récupérez l'**Application ID** dans l'onglet **General Information** → mettez-le dans `.env` (`CLIENT_ID`).

### 2. Configuration du Bot

- Onglet **Bot** → **Add Bot** (si pas déjà fait).
- **Reset Token** → copiez le **TOKEN** dans `.env` (`DISCORD_TOKEN`).
- **Privileged Gateway Intents** : activez **Message Content Intent**.

### 3. Permissions pour les Slash Commandes

- Onglet **OAuth2** → **URL Generator** :
  - **Scopes** : ✅ `bot` + ✅ `applications.commands`
  - **Bot Permissions** : 
    - ✅ Send Messages
    - ✅ Read Message History
    - ✅ Manage Messages (épingler/éditer le tableau)
    - ✅ Connect (rejoindre salons vocaux)
    - ✅ Speak (jouer audio)
    - ✅ Use Slash Commands

### 4. Invitation du bot

- Copiez l'URL générée et ouvrez-la dans votre navigateur.
- Sélectionnez votre serveur et autorisez les permissions.
- Le bot apparaît maintenant dans votre serveur !

### 5. Déploiement des Slash Commandes

**Important :** Les slash commandes doivent être déployées avant utilisation.

Créez un fichier `deploy-commands.js` à la racine :

```javascript
// deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
  // Commandes de base
  { name: 'me', description: 'Définit ton club', options: [{ name: 'club', description: 'Nom de ton club', type: 3, required: true }] },
  { name: 'whoami', description: 'Affiche ton club mémorisé' },
  { name: 'forgetme', description: 'Oublie ton club mémorisé' },
  { name: 'multiplex', description: 'Active/désactive la connexion vocal' },
  
  // Gestion de match
  { name: 'vs', description: 'Définit l\'adversaire', options: [{ name: 'adversaire', description: 'Nom de l\'adversaire', type: 3, required: true }] },
  { name: 'start', description: 'Lance le match' },
  { name: 'goal', description: 'But pour ton équipe', options: [
    { name: 'minute', description: 'Minute du but', type: 4, required: false },
    { name: 'buteur', description: 'Nom du buteur', type: 3, required: false }
  ]},
  { name: 'goal-against', description: 'But contre ton équipe', options: [
    { name: 'minute', description: 'Minute du but', type: 4, required: false },
    { name: 'buteur', description: 'Nom du buteur', type: 3, required: false }
  ]},
  { name: 'minute', description: 'Règle la minute actuelle', options: [{ name: 'minute', description: 'Minute', type: 4, required: true }] },
  { name: 'halftime', description: 'Mi-temps' },
  { name: 'second-half', description: 'Seconde période' },
  { name: 'end', description: 'Fin du match' },
  { name: 'undo', description: 'Annule la dernière action' },
  
  // Profil Coach
  { name: 'coach', description: 'Affiche ton profil coach' },
  { name: 'coach-set', description: 'Modifie ton profil coach', options: [
    { name: 'propriete', description: 'Propriété à modifier', type: 3, required: true, choices: [
      { name: 'nom', value: 'nom' },
      { name: 'nationalité', value: 'nationalité' },
      { name: 'age', value: 'age' },
      { name: 'compétition', value: 'compétition' },
      { name: 'saison', value: 'saison' },
      { name: 'journée', value: 'journée' }
    ]},
    { name: 'valeur', description: 'Nouvelle valeur', type: 3, required: true }
  ]},
  
  // Compétition
  { name: 'competition', description: 'Affiche/définit la compétition', options: [{ name: 'nom', description: 'Nom de la compétition', type: 3, required: false }] },
  { name: 'season', description: 'Affiche/définit la saison', options: [{ name: 'saison', description: 'Nom de la saison', type: 3, required: false }] },
  { name: 'matchday', description: 'Affiche/définit la journée', options: [{ name: 'journee', description: 'Numéro de journée (1-99)', type: 4, required: false, min_value: 1, max_value: 99 }] },
  
  // Audio
  { name: 'champions-league', description: 'Joue l\'hymne de la Ligue des Champions' },
  { name: 'europa-league', description: 'Joue l\'hymne de l\'Europa League' },
  
  // Historique
  { name: 'history', description: 'Affiche l\'historique des matchs', options: [{ name: 'nombre', description: 'Nombre de matchs (1-20)', type: 4, required: false, min_value: 1, max_value: 20 }] },
  { name: 'scorers', description: 'Top des buteurs', options: [{ name: 'nombre', description: 'Nombre de buteurs (1-20)', type: 4, required: false, min_value: 1, max_value: 20 }] },
  
  // Tableau
  { name: 'board', description: 'Met à jour le tableau' },
  { name: 'board-setup', description: 'Configure le tableau', options: [{ name: 'salon', description: 'Salon pour le tableau', type: 7, required: false }] },
  
  // Mercato
  { name: 'mercato', description: 'Annonce de transfert', options: [
    { name: 'montant', description: 'Montant en millions d\'euros', type: 4, required: true, min_value: 0 },
    { name: 'club_origine', description: 'Club vendeur', type: 3, required: true },
    { name: 'joueur', description: 'Nom du joueur', type: 3, required: true }
  ]},
  
  // Conférence de presse
  { name: 'conference', description: 'Conférence de presse', options: [
    { name: 'force', description: 'Force une nouvelle conférence', type: 5, required: false },
    { name: 'questions', description: 'Nombre de questions (1-5)', type: 4, required: false, min_value: 1, max_value: 5 }
  ]}
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🚀 Déploiement des slash commandes...');
    
    // Déploiement global (visible sur tous les serveurs)
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    
    console.log(`✅ ${commands.length} slash commandes déployées avec succès !`);
  } catch (error) {
    console.error('❌ Erreur lors du déploiement:', error);
  }
})();
```

Puis lancez le déploiement :

```bash
node deploy-commands.js
```

Vous devriez voir :
```
🚀 Déploiement des slash commandes...
✅ 27 slash commandes déployées avec succès !
```

**Note :** Les slash commandes peuvent prendre jusqu'à 1 heure pour apparaître sur tous les serveurs. Pour un déploiement immédiat en développement, utilisez le déploiement par guilde (serveur spécifique) :

```javascript
// Pour déploiement immédiat (développement)
await rest.put(
  Routes.applicationGuildCommands(process.env.CLIENT_ID, 'VOTRE_GUILD_ID'),
  { body: commands }
);
```

### 6. Vérification

Une fois le bot invité et les commandes déployées :

1. Tapez `/` dans un salon de votre serveur
2. Vous devriez voir apparaître les commandes du bot avec l'icône de votre application
3. L'auto-complétion fonctionne pour les paramètres

## **▶️ Lancer**

```bash
npm start
```

Vous devriez voir :

```
[STORE] Profils chargés
✅ Connecté en tant que ...
📋 27 slash commandes chargées:
  /me
  /goal
  /multiplex
  ...
```

## **🎮 Commandes (texte)**

### Initialisation générale
- `!multiplex` → rejoint TON salon vocal et y reste (retape pour quitter)
- `!me <club>` → définit ET mémorise ton club (par serveur)
- `!whoami` → affiche ton club mémorisé
- `!forgetme` → oublie ton club mémorisé

### Profil Coach
- `!coach` → affiche ton profil coach complet
- `!coach-set nom <nom>` → définit ton nom d'entraîneur
- `!coach-set nationalité <pays>` → définit ta nationalité
- `!coach-set age <âge>` → définit ton âge (16-99)
- `!coach-set compétition <compétition>` → définit la compétition actuelle
- `!coach-set saison <saison>` → définit la saison actuelle
- `!coach-set journée <numéro>` → définit la journée actuelle

### Gestion Compétition/Saison (raccourcis)
- `!comp [compétition]` → affiche ou définit la compétition actuelle
- `!journee [numéro]` ou `!j [numéro]` → affiche la prochaine journée (auto-calculée en Ligue 1)
- `!nextj` → passe à la journée suivante manuellement (autres compétitions)
- `!season [saison]` → affiche ou définit la saison actuelle
- `!setup <compétition> <journée> [saison]` → configuration rapide
- `!matchday-reset` → remet le compteur de journée à J1
- `!matchday-set <valeur>` → définit une valeur spécifique pour le compteur

### 🆕 Auto-incrémentation Ligue 1
```
# Plus besoin de gérer les journées manuellement !
!me Angers
!comp "Ligue 1"      # Active l'auto-incrémentation

# Premier match → sera automatiquement J1
!vs Marseille
!st
!g 17 Guessand
!fin                 # → Sauvé en J1, prochaine journée = J2

# Deuxième match → sera automatiquement J2
!vs Toulouse  
!fin                 # → Sauvé en J2, prochaine journée = J3

# L'historique s'affiche correctement :
!history
# 1. angers 2-1 toulouse (Ligue 1) J2
# 2. angers 1-0 marseille (Ligue 1) J1
```

### Exemples de configuration
```
# Configuration Ligue 1 (recommandée)
!me Angers
!comp "Ligue 1"      # Les journées s'incrémentent automatiquement

# Reset du compteur si nécessaire
!matchday-reset      # Remet à J1
!matchday-set 10     # Fixe à J10

# Configuration autre compétition
!me Angers
!comp "Coupe de France"
!j 1                 # Journée manuelle pour les autres compétitions
```

### Hymnes UEFA
- `!ldc` → joue l'hymne de la Ligue des Champions
- `!eur` → joue l'hymne de l'Europa League

### Avant-match
- `!vs <adversaire>` → définit l'adversaire
- `!st` → début du match (LIVE, minute 0 si non définie)   [alias temporaire: !ko]
- `!min <n>` → fixe la minute (ex: !min 12)

### Pendant le match
- `!g  [minute] [buteur…]` → but POUR toi (jingle + TTS varié)
- `!gc [minute] [buteur…]` → but CONTRE
- `!min <n>` → règle la minute
- `!mt` → mi-temps (statut HT, minute 45)
- `!2nd` → début seconde période (statut H2, minute min 46)
- `!fin` → fin de match (statut FT, minute 90) + sauvegarde automatique historique
- `!undo` → annule ta dernière action (score/minute/statut)

### Historique et Statistiques
- `!history [nombre]` → affiche l'historique des matchs (défaut: 5, max: 20)
- `!history-ids [nombre]` → affiche l'historique avec les IDs pour édition (défaut: 10, max: 20)
- `!scorers [nombre]` → affiche le top des buteurs dans l'historique (défaut: 10, max: 20)
- `!match-add <adversaire> <score_pour> <score_contre> [compétition] [journée]` → ajoute un match manuellement
- `!match-edit <ID> <propriété> <valeur>` → édite un match existant
- `!match-delete <ID>` → supprime un match de l'historique

### Édition de l'historique (exemples)
```
# Voir les IDs
!history-ids

# Corriger une compétition
!match-edit 1755804723993 competition "Ligue 1"

# Changer un score
!match-edit 1755804723993 scoreFor 3

# Changer l'adversaire
!match-edit 1755804723993 opponent "Le Havre"

# Définir une journée
!match-edit 1755804723993 matchday 15

# Supprimer une journée
!match-edit 1755804723993 matchday null

# Supprimer un match
!match-delete 1755804723993
```

### Conférences de presse
- `!conf [nombre_questions]` → génère des questions de conférence de presse contextuelles (2 par défaut)
- `!conf --force [nombre_questions]` → force une nouvelle conférence même sans session active

**Fonctionnement des conférences :**
- **Automatiques** : Se déclenchent après 10 matchs terminés
- **Interactives** : Questions posées une par une, tapez `!conf` pour la suivante
- **Forcées** : Avec `--force`, affiche toutes les questions d'un coup

### Annonces Mercato (Style Fabrizio Romano)
- `!mercato <montant_millions> <club_origine> <joueur>` → annonce de transfert vers ton club

**Exemples :**
```
!mercato 180 "Paris Saint-Germain" "Kylian Mbappé"
!mercato 150 "Manchester City" "Erling Haaland"
!mercato 80 Juventus "Paulo Dybala"
!mercato 0 "Paris Saint-Germain" "Lionel Messi"  # Transfert libre
```

L'annonce sera lue avec une voix masculine à l'accent italien en anglais, avec des pauses dramatiques sur "HERE WE GO".

### Exemples complets

```
# Configuration initiale SIMPLE
!me Angers
# La compétition par défaut "Ligue 1" active l'auto-incrémentation

# Premier match de la saison
!vs Marseille
!st
!g 17 Guessand
!fin                 # → Automatiquement sauvé en J1

# Deuxième match
!vs Toulouse  
!st
!g 23 Emegha
!fin                 # → Automatiquement sauvé en J2

# Pas besoin de !nextj ou !j <numéro> !
!conf               # Session interactive (2 questions)
!conf --force 3     # Mode forcé (3 questions d'un coup)
!scorers            # Top 10 des buteurs

# Gestion du compteur si nécessaire
!matchday-reset     # Remet à J1
!matchday-set 15    # Fixe à J15
```

## **Tableau récap (board)**

- `!boardset #multiplex-board` → NETTOIE le salon, poste le tableau, l'EPINGLE, l'associe au serveur
- `!board` → met à jour le tableau épinglé (pas de nouveau message)

Après `!boardset`, le tableau est mis à jour automatiquement à chaque `!g`, `!gc`, `!min`, `!mt`, `!2nd`, `!fin`, `!vs`, `!st`, `!reset`.

## **📋 Tableau : recommandations**

- Créez un salon `#multiplex-board` en lecture seule pour `@everyone`.
- Donnez au bot dans ce salon : View Channel, Send Messages, Read Message History, Manage Messages.
- Lancez `!boardset #multiplex-board` (purge le salon, poste et épingle le message).

Épingle : Discord limite à 50 épingles par salon.

## **💾 Persistance**

- Stockage local dans `data/profiles.json`.
- Mémorise par serveur :
  - le club des joueurs → restauré automatiquement au redémarrage,
  - le profil coach complet (nom, nationalité, âge, compétition, saison, journée),
  - l'historique des matchs (100 matchs max par utilisateur),
  - la localisation du tableau (channelId, msgId).

## **🗣️ Voix & variations**

- Variantes par club : `clubs.js` (ex. SCO d'Angers prononcé "Sko").
- Ouvertures : `openers.js` (exclamations).
- Templates buteur : `scorer.js`.

Le TTS assemble une phrase variée (rotation sans répétition immédiate), puis ajoute score/minute/statut.

## **🧩 Personnalisation**

Timbre/énergie (via `.env`) :

- `AZURE_STYLE` : excited/cheerful
- `AZURE_DEG` : 1.2–2.0
- `AZURE_RATE` : 0–5 (%)
- `AZURE_PITCH` : -2.0 à +1.0 (demi-tons)

Phrases : éditez `clubs.js`, `openers.js`, `scorer.js`.

Salon du tableau : `!boardset #multiplex-board`.

## **🐛 Dépannage (FAQ)**

- Le tableau n'est pas épinglé  
  → Donnez au bot Manage Messages sur le salon, vérifiez qu'il reste < 50 épingles.

- "Invalid Form Body / MESSAGE_REFERENCE_UNKNOWN_MESSAGE" après `!boardset`  
  → Évitez `msg.reply()` juste après la purge du salon. Le code utilise `channel.send()`.

- Pas de son / jingle  
  → Le bot doit être connecté (`!multiplex`). FFmpeg est inclus (`ffmpeg-static`) et `@discordjs/opus` installé.

- Le bot quitte le vocal  
  → Il se déconnecte quand le salon est vide d'humains ou si vous retapez `!multiplex`.

- Minute "bizarre"  
  → Le parseur accepte `18`, `18'`, `18e`, `90+2`, etc. (affichage `90+2'`, voix "À la 90+2e minute.").

## **📜 Licences & voix**

Le TTS utilise une voix Azure générique.

Ne clonez pas la voix d'une personne réelle sans son consentement.

Jingle : utilisez un son libre de droits ou votre propre audio.

## **🧪 Lancer des tests rapides**

```
!multiplex (dans un salon vocal)

!ldc (teste l'hymne LdC)

!eur (teste l'hymne Europa)

!me Angers

# Pas besoin de !comp, "Ligue 1" par défaut

!j 15

!vs Marseille

!st

!g 17 Guessand

!mt → !2nd → !fin

!conf 2 (ou !conf --force 2 pour mode direct)

!history

!scorers

!matchday-reset (remet le compteur à J1)

!boardset #multiplex-board (une seule fois)

!board (devrait dire "mis à jour" et éditer le message épinglé).
```

## **📦 Déploiement (optionnel)**

PM2 : `pm2 start npm --name multiplex-bot -- start`

Persistance : assurez-vous que le dossier `data/` est écrit (volumes si Docker).