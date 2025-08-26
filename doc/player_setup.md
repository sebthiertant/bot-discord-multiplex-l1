# 🎮 Guide de configuration rapide (version Slash Commands)

jouer avec le bot en utilisant les slash commands (`/`) — interface recommandée.

---

## ✅ Étapes rapides (faire une seule fois)

1. Définir ton club
   - /me club:<nom_du_club>
   - Exemple : `/me club:Angers`

2. Vérifier
   - /whoami — affiche le club mémorisé.

3. (Recommandé) Configurer le profil coach
   - `/coach-set propriete:nom valeur:"Ton Nom"`
   - `/coach-set propriete:nationalité valeur:France`
   - `/coach-set propriete:age valeur:35`

4. Si tu veux l'auto-incrémentation Ligue 1 :
   - `/competition nom:"Ligue 1"`
   - `/season saison:"2024-2025"` (optionnel)

---

## ▶️ Premier match (flow minimal)

1. Connecter le bot au vocal
   - Rejoins un salon vocal, puis : `/multiplex`

2. Préparer le match
   - `/vs adversaire:<NomAdversaire>`
   - `/start` — coup d'envoi (statut LIVE, minute 0)

3. Pendant le match
   - But POUR : `/goal minute:<n> buteur:<nom>`  
     Exemples :
     - `/goal minute:17 buteur:Mbappé`
     - `/goal buteur:Giroud`
     - `/goal minute:52` (sans buteur)
   - But CONTRE : `/goal-against minute:<n> buteur:<nom>`
   - Mettre la minute manuellement : `/minute minute:<n>`
   - Mi-temps : `/halftime` (45')
   - Début 2ᵉ période : `/second-half` (46')

4. Fin de match
   - `/end` — sauvegarde automatique de l'historique et possibilité de déclencher conférence de presse

---

## 📋 Commandes utiles post-match

- `/history [nombre]` — affiche tes derniers matchs (défaut: 5, max: 20)  
  Exemple : `/history nombre:10`
- `/scorers [nombre]` — top buteurs (défaut: 10)
- `/conference [force] [questions]` — conférence de presse (interactive ou forcée)
- `/mercato montant:<M> club_origine:<Club> joueur:<Nom>` — annonce mercato (style Fabrizio)
- `/board-setup [salon]` — configurer le tableau épinglé (prépare & épingle)
- `/board` — mettre à jour le tableau

---

## 🧾 Checklist pour un joueur prêt

- [ ] /me club:<club>
- [ ] /coach-set propriete:nom valeur:"Ton Nom"
- [ ] /competition nom:"Ligue 1" (si souhaité)
- [ ] Rejoindre un salon vocal + `/multiplex`
- [ ] Lancer `/start` avant le match

---

## 🆘 Dépannage rapide

- Le bot ne rejoint pas le vocal :
  - Vérifier permissions du bot (Connect / Speak).
  - Rejoindre un salon vocal avant de lancer `/multiplex`.

- Pas de son / pas de jingle :
  - S'assurer que le bot est dans le salon vocal.
  - Vérifier que `assets/but.mp3` existe.

- Les journées ne s'incrémentent pas :
  - Vérifier `/competition` : l'auto-incrément se déclenche uniquement si la compétition est "Ligue 1".
  - Utiliser `/matchday` pour régler manuellement.

- Conférence de presse non générée :
  - Vérifier que la variable d'environnement OPENAI_API_KEY est présente sur l'instance exécutant le bot.

---