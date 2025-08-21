# Guide d'utilisation – Bot Multiplex L1

> À épingler dans Discord et à mettre dans le README.

---

## Règles de base

- Connecte le bot au vocal avec `!multiplex` (re-tape pour le faire partir).
- Le jingle + TTS ne jouent que si le bot est connecté au vocal.
- Ton club est mémorisé par serveur (plus besoin de le retaper à chaque session).
- L'historique de tes matchs est automatiquement sauvegardé.

---

## Initialisation générale

### Définir / voir ton club

- `!me <club>`  
  Mémorise ton club (ex. `!me Angers`)
- `!whoami`  
  Affiche ton club mémorisé
- `!forgetme`  
  Oublie ton club mémorisé

### Profil Coach

- `!coach`  
  Affiche ton profil coach complet
- `!coach-set nom <nom>`  
  Définit ton nom d'entraîneur
- `!coach-set nationalité <pays>`  
  Définit ta nationalité
- `!coach-set age <âge>`  
  Définit ton âge (16-99)
- `!coach-set compétition <compétition>`  
  Définit la compétition actuelle
- `!coach-set saison <saison>`  
  Définit la saison actuelle
- `!coach-set journée <numéro>`  
  Définit la journée actuelle

### Gestion Compétition/Saison (raccourcis)

- `!comp [compétition]`  
  Affiche ou définit la compétition actuelle
- `!journee [numéro]` ou `!j [numéro]`  
  Affiche la prochaine journée (auto-calculée en Ligue 1)
- `!nextj`  
  Passe à la journée suivante manuellement
- `!season [saison]`  
  Affiche ou définit la saison actuelle
- `!setup <compétition> <journée> [saison]`  
  Configuration rapide

**Exemples :**
```
!coach-set nom "Didier Deschamps"
!coach-set nationalité France
!coach-set age 55
!comp "Ligue 1"
!season "2024-2025"
!setup "Ligue 1" 15 "2024-2025"
```

---

## Connexion audio

- `!multiplex`  
  Le bot rejoint TON salon vocal et y reste (quitte si salon vide).  
  Re-tape pour le déconnecter.

---

## Hymnes UEFA

- `!ldc`  
  Joue l'hymne de la Ligue des Champions
- `!eur`  
  Joue l'hymne de l'Europa League

---

## Tableau de la journée

### Configuration initiale (une seule fois par serveur)

- `!boardset #multiplex-board`  
  Nettoie le salon, crée et épingle le tableau

### Actualisation

- `!board`  
  Met à jour le tableau épinglé (automatique après chaque action)

---

## Avant-match

### Renseigner l'affiche

- `!me <club>`  
  Ton club (si pas déjà mémorisé)
- `!vs <adversaire>`  
  L'adversaire du jour (ex. `!vs Le Havre`)
- `!st`  
  Coup d'envoi (Start - statut LIVE, minute 0)
- `!min <n>`  
  Fixe la minute de départ si besoin (ex. `!min 5`)

---

## Pendant le match

### Buts (texte)

- `!g [minute] [buteur…]`  
  But POUR toi (incrémente ton score, jingle + TTS)
- `!gc [minute] [buteur…]`  
  But CONTRE (incrémente l'adversaire)
- `!min <n>`  
  règle la minute
- `!mt`  
  mi-temps (passe à 45')
- `!2nd`  
  début de la seconde période (passe à 46')
- `!fin`  
  fin du match (passe à 90') + sauvegarde automatique
- `!undo`  
  Annule ta dernière action (score/minute/statut)

**Exemples :**
```
!g 17 Mbappé
!g 52
!gc 89
```

---

### Annonce libre (sans suivi du score)

- `!but-<club>-<buteur>`  
  Joue uniquement jingle + TTS (n'affecte pas le tableau)

---

## Historique et Statistiques

### Consulter l'historique

- `!history [nombre]`  
  Affiche l'historique des matchs (défaut: 5, max: 20)
- `!history-ids [nombre]`  
  Affiche l'historique avec les IDs pour édition

### Statistiques

- `!scorers [nombre]`  
  Top des buteurs dans l'historique (défaut: 10, max: 20)

### Gestion manuelle de l'historique

- `!match-add <adversaire> <score_pour> <score_contre> [compétition] [journée]`  
  Ajoute un match manuellement
- `!match-edit <ID> <propriété> <valeur>`  
  Édite un match existant
- `!match-delete <ID>`  
  Supprime un match de l'historique

**Exemples :**
```
!history 10
!scorers 5
!match-add "Le Havre" 2 1 "Ligue 1" 15
!match-edit 1755804723993 scoreFor 3
!match-delete 1755804723993
```

**Propriétés éditables :**
- `opponent` ou `adversaire` : nom de l'adversaire
- `scoreFor` ou `score_pour` : ton score
- `scoreAgainst` ou `score_contre` : score adverse
- `competition` ou `compétition` : nom de la compétition
- `matchday` ou `journée` : numéro de journée (ou `null` pour supprimer)

---

## Conférences de presse

- `!conf [nombre_questions]`  
  Génère des questions contextuelles basées sur ton dernier match et ton historique

**Exemples :**
```
!conf          # 2 questions par défaut
!conf 5        # 5 questions
```

Les questions sont lues automatiquement au vocal si le bot est connecté.

---

## Auto-incrémentation Ligue 1

### Fonctionnement automatique

- En **Ligue 1** : les journées s'incrémentent automatiquement à chaque `!fin`
- **Autres compétitions** : gestion manuelle avec `!j <numéro>`

### Exemple d'utilisation

```
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
```

---

## Après match

- `!fin`  
  Fin du match (statut 🔴) + sauvegarde automatique
- `!conf`  
  Conférence de presse contextuelle
- `!history`  
  Vérifier que le match a bien été sauvé
- `!scorers`  
  Voir les statistiques de buteurs
- `!multiplex`  
  (optionnel) déconnecte le bot du vocal

---

## Workflow complet type

```
# Configuration initiale (une seule fois)
!me Angers
!coach-set nom "Mon Nom"
!coach-set nationalité France
!comp "Ligue 1"
!season "2024-2025"

# Avant chaque match
!vs Marseille
!st

# Pendant le match
!g 17 Mbappé
!gc 52 Payet
!g 89 Giroud
!fin

# Après le match
!conf 3
!scorers
!history

# Match suivant (club déjà mémorisé)
!vs Lyon
!st
# etc...
```

---

## Astuces

- Ton club reste mémorisé entre les sessions
- L'historique permet des conférences de presse plus riches
- Les journées Ligue 1 s'incrémentent automatiquement
- Utilise `!board` pour voir tous les matchs en cours sur le serveur
- Les statistiques de buteurs se calculent sur tout l'historique