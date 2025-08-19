# Bot Discord Multiplex L1 – Jingle + Annonces + Suivi de journée

Bot pour parties **Football Manager en réseau** :
- Joue un **jingle “but”** + annonce **TTS Azure**.
- **Reste dans le salon** en mode `!multiplex`.
- Nouveau : **Suivi de journée** ultra-léger (scores, minute, adversaire) + **panneau de boutons**.

## Installation

1. **Node.js 18+** (ok avec v22)  
2. Dépendances :
   ```bash
   npm i
3. (Le projet inclut déjà @discordjs/voice, @discordjs/opus, ffmpeg-static, dotenv, microsoft-cognitiveservices-speech-sdk.)
4. Place ton jingle dans assets/but.mp3 (crée le dossier si besoin).


### Persistance du club (par joueur, par serveur)

- `!me <club>` : définit **et mémorise** ton club pour ce serveur.
- Au prochain démarrage du bot, ton club est **restauré automatiquement**.
- `!whoami` : affiche le club mémorisé.
- `!forgetme` : supprime le club mémorisé.

Les données sont stockées dans `data/profiles.json`.
