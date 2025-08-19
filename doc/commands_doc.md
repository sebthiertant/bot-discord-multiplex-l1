# Guide d’utilisation – Bot Multiplex L1

> À épingler dans Discord et à mettre dans le README.

---

## Règles de base

- Connecte le bot au vocal avec `!multiplex` (re-tape pour le faire partir).
- Le jingle + TTS ne jouent que si le bot est connecté au vocal.
- Ton club est mémorisé par serveur (plus besoin de le retaper à chaque session).

---

## Initialisation générale

### Définir / voir ton club

- `!me <club>`  
  Mémorise ton club (ex. `!me Angers`)
- `!whoami`  
  Affiche ton club mémorisé
- `!forgetme`  
  Oublie ton club mémorisé

---

## Connexion audio

- `!multiplex`  
  Le bot rejoint TON salon vocal et y reste (quitte si salon vide).  
  Re-tape pour le déconnecter.

---

## Panneau de boutons (recommandé)

- `!panel`  
  Affiche un panneau personnel (Goal+, Goal-, +1’, +5’, Undo, HT, FT)  
  Les clics n’agissent que pour l’utilisateur qui a généré le panneau.

---

## Tableau de la journée

- `!board`  
  Crée/actualise le tableau des matches (score, minute, statut)

---

## Avant-match

### Renseigner l’affiche

- `!me <club>`  
  Ton club (si pas déjà mémorisé)
- `!vs <adversaire>`  
  L’adversaire du jour (ex. `!vs Le Havre`)
- `!st`  
  Coup d’envoi (Start - statut LIVE, minute 0)
- `!min <n>`  
  Fixe la minute de départ si besoin (ex. `!min 5`)

---

## Pendant le match

### Buts (texte)

- `!g [minute] [buteur…]`  
  But POUR toi (incrémente ton score, jingle + TTS)
- `!gc [minute] [buteur…]`  
  But CONTRE (incrémente l’adversaire)
- `!min <n>`  
  Règle la minute courante
- `!mt`  
  Mi-temps
- `!undo`  
  Annule ta dernière action (score/minute/statut)

**Exemples :**
```
!g 17 Mbappé
!g 52
!gc 89
```

---

### Buts (panneau) – ultra rapide

- Clique sur Goal+ / Goal-, ajuste la minute avec +1’ / +5’, Undo, HT, FT.
- 👉 Le tableau `!board` se met à jour automatiquement via le panneau.
- Après une commande texte, si le tableau ne s’actualise pas, relance `!board`.

---

### Annonce libre (sans suivi du score)

- `!but-<club>-<buteur>`  
  Joue uniquement jingle + TTS (n’affecte pas le tableau)

---

## Après match

- `!fin`  
  Fin du match (statut 🔴)
- `!board`  
  Snapshot/rafraîchissement du tableau
- `!multiplex`  
  (optionnel) déconnecte le bot du vocal

---

## Astuce

Au prochain match, tu gardes ton club mémorisé : fais juste `!vs <adversaire>` puis `!ko