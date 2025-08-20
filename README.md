# Multiplex L1 – Bot Discord "jingle + annonces" pour Football Manager

Bot Discord pour vos parties FM en réseau :

Joue le jingle "but" puis une annonce vocale (Azure Speech).

Suis un match par joueur (score, minute, statut, adversaire).

Affiche un tableau récap unique, épinglé dans un salon dédié.

Mémorise le club de chaque joueur (par serveur).

## **✨ Fonctionnalités**

- Audio : jingle MP3 + TTS Azure (voix FR, ton "excited", paramètres ajustables).
- Multiplex : le bot rejoint un salon vocal et y reste tant qu'il y a des humains.
- Hymnes UEFA : `!ldc` (Ligue des Champions) et `!eur` (Europa League).
- Suivi léger (sans intégration FM) :
  - score, minute, buteur, adversaire, statuts (LIVE, MT, 2e MT, FIN).
  - annonces vocales variées (openers, variantes par club, modèles buteur).
- Tableau récap : un seul message épinglé dans #multiplex-board, mis à jour automatiquement.
- Persistance : clubs et config du tableau stockés dans data/profiles.json.

## **🧱 Prérequis**

- Node.js 18+ (OK avec Node 22).
- Un serveur Discord où vous pouvez inviter un bot.
- Un compte Microsoft Azure et une ressource Speech (clé + région).
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

# Azure Speech
AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SPEECH_REGION=westeurope

# (Facultatif) réglages voix
AZURE_VOICE=fr-FR-HenriNeural
AZURE_STYLE=excited       # excited | cheerful
AZURE_DEG=1.7             # intensité émotionnelle (0.01–2)
AZURE_RATE=2              # vitesse parole en %
AZURE_PITCH=-1.2          # hauteur en demi-tons (négatif = plus grave)
```

## **🗂️ Structure (fichiers principaux)**

- `index.js` : logique du bot (commandes, audio, suivi, tableau).
- `tts.js` : Azure Speech (SSML homogène, fallback).
- `clubs.js / openers.js / scorer.js` : variantes de texte pour les annonces.
- `store.js` : persistance JSON (data/profiles.json).
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

Ce bot utilise clé + région (pas besoin d’Azure AD/OAuth).

## **🤖 Création du bot Discord (token)**

- Ouvrez le Discord Developer Portal → New Application.
- Bot → Add Bot → Reset Token → copiez le TOKEN dans `.env` (`DISCORD_TOKEN`).
- Privileged Gateway Intents : activez Message Content Intent.
- OAuth2 → URL Generator :
  - Scopes : bot
  - Bot Permissions : Send Messages, Read Message History, Manage Messages (épingler/éditer le tableau), Connect, Speak
- Ouvrez l’URL générée et invitez le bot sur votre serveur.

## **▶️ Lancer**

```bash
npm start
```

Vous devriez voir :

```
[STORE] Profils chargés
✅ Connecté en tant que ...
```

## **🎮 Commandes (texte)**

Initialisation générale
- `!multiplex` → rejoint TON salon vocal et y reste (retape pour quitter)
- `!me <club>` → définit ET mémorise ton club (par serveur)
- `!whoami` → affiche ton club mémorisé
- `!forgetme` → oublie ton club mémorisé

Hymnes UEFA
- `!ldc` → joue l'hymne de la Ligue des Champions
- `!eur` → joue l'hymne de l'Europa League

Avant-match
- `!vs <adversaire>` → définit l’adversaire
- `!st` → début du match (LIVE, minute 0 si non définie)   [alias temporaire: !ko]
- `!min <n>` → fixe la minute (ex: !min 12)

Pendant le match
- `!g  [minute] [buteur…]` → but POUR toi (jingle + TTS varié)
- `!gc [minute] [buteur…]` → but CONTRE
- `!min <n>` → règle la minute
- `!mt` → mi-temps (statut HT, minute 45)
- `!2nd` → début seconde période (statut H2, minute min 46)
- `!fin` → fin de match (statut FT, minute 90)         [alias: !ft]
- `!undo` → annule ta dernière action (score/minute/statut)

Exemples

```
!me Angers
!vs Marseille
!st
!g 17 Guessand
!mt → !2nd → !fin
```

Annonce libre (hors suivi)
- `!but-<club>-<buteur>` → joue le jingle + annonce TTS (n’affecte PAS le tableau)

## **Tableau récap (board)**

- `!boardset #multiplex-board` → NETTOIE le salon, poste le tableau, l’EPINGLE, l’associe au serveur
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
  - la localisation du tableau (channelId, msgId).

## **🗣️ Voix & variations**

- Variantes par club : `clubs.js` (ex. SCO d’Angers prononcé “Sko”).
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

- Le tableau n’est pas épinglé  
  → Donnez au bot Manage Messages sur le salon, vérifiez qu’il reste < 50 épingles.

- “Invalid Form Body / MESSAGE_REFERENCE_UNKNOWN_MESSAGE” après `!boardset`  
  → Évitez `msg.reply()` juste après la purge du salon. Le code utilise `channel.send()`.

- Pas de son / jingle  
  → Le bot doit être connecté (`!multiplex`). FFmpeg est inclus (`ffmpeg-static`) et `@discordjs/opus` installé.

- Le bot quitte le vocal  
  → Il se déconnecte quand le salon est vide d’humains ou si vous retapez `!multiplex`.

- Minute “bizarre”  
  → Le parseur accepte `18`, `18'`, `18e`, `90+2`, etc. (affichage `90+2’`, voix “À la 90+2e minute.”).

## **📜 Licences & voix**

Le TTS utilise une voix Azure générique.

Ne clonez pas la voix d’une personne réelle sans son consentement.

Jingle : utilisez un son libre de droits ou votre propre audio.

## **🧪 Lancer des tests rapides**

```
!multiplex (dans un salon vocal)

!ldc (teste l'hymne LdC)

!eur (teste l'hymne Europa)

!me Angers

!vs Marseille

!st

!g 17 Guessand

!mt → !2nd → !fin

!boardset #multiplex-board (une seule fois)

!board (devrait dire "mis à jour" et éditer le message épinglé).
```

## **📦 Déploiement (optionnel)**

PM2 : `pm2 start npm --name multiplex-bot -- start`

Persistance : assurez-vous que le dossier `data/` est écrit (volumes si Docker).