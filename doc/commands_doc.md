# Guide d'utilisation – Bot Multiplex L1

> À épingler dans Discord et à mettre dans le README.

---

## 🆕 Slash Commandes

Le bot supporte maintenant les **slash commandes** (`/`) en plus des commandes texte (`!`). 
Les slash commandes offrent une meilleure expérience avec :
- Auto-complétion et aide intégrée
- Validation des paramètres
- Interface plus moderne

**Exemples :**
- `/me Angers` au lieu de `!me Angers`
- `/goal minute:17 buteur:Mbappé` au lieu de `!g 17 Mbappé`
- `/champions-league` au lieu de `!ldc`

---

## Règles de base

- Connecte le bot au vocal avec `/multiplex` (re-tape pour le faire partir).
- Le jingle + TTS ne jouent que si le bot est connecté au vocal.
- Ton club est mémorisé par serveur (plus besoin de le retaper à chaque session).
- L'historique de tes matchs est automatiquement sauvegardé.

---

## Initialisation générale

### Définir / voir ton club

- `/me <club>` ou `!me <club>`  
  Mémorise ton club (ex. `/me Angers`)
- `/whoami` ou `!whoami`  
  Affiche ton club mémorisé
- `/forgetme` ou `!forgetme`  
  Oublie ton club mémorisé 

### Profil Coach

- `/coach` ou `!coach`  
  Affiche ton profil coach complet
- `/coach-set` ou `!coach-set nom <nom>`  
  Définit ton nom d'entraîneur
- `/coach-set propriete:nationalité valeur:<pays>` ou `!coach-set nationalité <pays>`  
  Définit ta nationalité
- `/coach-set propriete:age valeur:<âge>` ou `!coach-set age <âge>`  
  Définit ton âge (16-99)
- `/coach-set propriete:compétition valeur:<compétition>` ou `!coach-set compétition <compétition>`  
  Définit la compétition actuelle
- `/coach-set propriete:saison valeur:<saison>` ou `!coach-set saison <saison>`  
  Définit la saison actuelle
- `/coach-set propriete:journée valeur:<numéro>` ou `!coach-set journée <numéro>`  
  Définit la journée actuelle

### Gestion Compétition/Saison (raccourcis)

- `/competition [nom]` ou `!comp [compétition]`  
  Affiche ou définit la compétition actuelle
- `/matchday [journee]` ou `!journee [numéro]` ou `!j [numéro]`  
  Affiche la prochaine journée (auto-calculée en Ligue 1)
- `!nextj`  
  Passe à la journée suivante manuellement
- `/season [saison]` ou `!season [saison]`  
  Affiche ou définit la saison actuelle
- `!setup <compétition> <journée> [saison]`  
  Configuration rapide
- `!matchday-reset`  
  Remet le compteur de journée à J1
- `!matchday-set <valeur>`  
  Définit une valeur spécifique pour le compteur (1-99)

**Exemples :**
```
/coach-set propriete:nom valeur:"Didier Deschamps"
/coach-set propriete:nationalité valeur:France
/coach-set propriete:age valeur:55
/competition nom:"Ligue 1"
/season saison:"2024-2025"
!setup "Ligue 1" 15 "2024-2025"
!matchday-reset
!matchday-set 22
```

---

## Connexion audio

- `/multiplex` ou `!multiplex`  
  Le bot rejoint TON salon vocal et y reste (quitte si salon vide).  
  Re-tape pour le déconnecter.

---

## Hymnes UEFA

- `/champions-league` ou `!ldc`  
  Joue l'hymne de la Ligue des Champions
- `/europa-league` ou `!eur`  
  Joue l'hymne de l'Europa League

---

## Tableau de la journée

### Configuration initiale (une seule fois par serveur)

- `/board-setup [salon]` ou `!boardset #multiplex-board`  
  Nettoie le salon, crée et épingle le tableau

### Actualisation

- `/board` ou `!board`  
  Met à jour le tableau épinglé (automatique après chaque action)

---

## Avant-match

### Renseigner l'affiche

- `/me <club>` ou `!me <club>`  
  Ton club (si pas déjà mémorisé)
- `/vs <adversaire>` ou `!vs <adversaire>`  
  L'adversaire du jour (ex. `/vs Le Havre`)
- `/start` ou `!st`  
  Coup d'envoi (Start - statut LIVE, minute 0)
- `/minute <n>` ou `!min <n>`  
  Fixe la minute de départ si besoin (ex. `/minute 5`)

---

## Pendant le match

### Buts

- `/goal [minute] [buteur]` ou `!g [minute] [buteur…]`  
  But POUR toi (incrémente ton score, jingle + TTS)
- `/goal-against [minute] [buteur]` ou `!gc [minute] [buteur…]`  
  But CONTRE (incrémente l'adversaire)
- `/minute <n>` ou `!min <n>`  
  règle la minute
- `/halftime` ou `!mt`  
  mi-temps (passe à 45')
- `/second-half` ou `!2nd`  
  début de la seconde période (passe à 46')
- `/end` ou `!fin`  
  fin du match (passe à 90') + sauvegarde automatique
- `/undo` ou `!undo`  
  Annule ta dernière action (score/minute/statut)

**Exemples :**
```
/goal minute:17 buteur:Mbappé
/goal minute:52
/goal-against minute:89
```

---

### Annonce libre (sans suivi du score)

- `!but-<club>-<buteur>`  
  Joue uniquement jingle + TTS (n'affecte pas le tableau)

---

## Historique et Statistiques

### Consulter l'historique

- `/history [nombre]` ou `!history [nombre]`  
  Affiche l'historique des matchs (défaut: 5, max: 20)
- `!history-ids [nombre]`  
  Affiche l'historique avec les IDs pour édition

### Statistiques

- `/scorers [nombre]` ou `!scorers [nombre]`  
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
/history nombre:10
/scorers nombre:5
!match-add "Le Havre" 2 1 "Ligue 1" 15
!match-edit 1755804723993 scoreFor 3
!match-delete 1755804723993
```

---

## Conférences de presse

- `/conference [force] [questions]` ou `!conf [nombre_questions]`  
  Génère des questions contextuelles basées sur ton dernier match et ton historique
- `!no` 
  Annule le déclenchement de la conférence de presse. 
- `/conference force:true [questions]` ou `!conf --force [nombre_questions]`  
  Force une nouvelle conférence de presse même sans session active

**Exemples :**
```
/conference              # Continue la session en cours
/conference force:true   # Force 3 questions par défaut
/conference force:true questions:5  # Force 5 questions
```

---

## Annonces Mercato

### Style Fabrizio Romano

- `/mercato <montant> <club_origine> <joueur>` ou `!mercato <montant_millions> <club_origine> <joueur>`  
  Annonce de transfert vers ton club avec style Fabrizio Romano

**Exemples :**
```
/mercato montant:180 club_origine:"Paris Saint-Germain" joueur:"Kylian Mbappé"
/mercato montant:18 club_origine:"Slavia Prague" joueur:Jäkel
/mercato montant:0 club_origine:"Paris Saint-Germain" joueur:"Lionel Messi"  # Transfert libre
```

**Prérequis :** Avoir défini ton club avec `/me <club>` et être connecté au vocal

---

## Auto-incrémentation Ligue 1

### Fonctionnement automatique

- En **Ligue 1** : les journées s'incrémentent automatiquement à chaque `/end`
- **Autres compétitions** : gestion manuelle avec `/matchday <numéro>`

### Exemple d'utilisation

```
/me Angers
/competition nom:"Ligue 1"      # Active l'auto-incrémentation

# Premier match → sera automatiquement J1
/vs Marseille
/start
/goal minute:17 buteur:Guessand
/end                            # → Sauvé en J1, prochaine journée = J2

# Deuxième match → sera automatiquement J2
/vs Toulouse  
/end                            # → Sauvé en J2, prochaine journée = J3
```

---

## Workflow complet type

```
# Configuration initiale (une seule fois)
me Angers
coach-set propriete:nom valeur:"Mon Nom"
coach-set propriete:nationalité valeur:France
competition nom:"Ligue 1"
season saison:"2024-2025"

# Avant chaque match
vs Marseille
start

# Pendant le match
goal minute:17 buteur:Mbappé
goal-against minute:52 buteur:Payet
goal minute:89 buteur:Giroud
end

# Après le match
conference force:true questions:3
scorers
history

# Match suivant (club déjà mémorisé)
vs Lyon
start
# etc...
```

---

## 💡 Conseils d'utilisation

- **Slash commandes** : Plus rapides et intuitives avec auto-complétion
- **Commandes texte** : Toujours disponibles pour compatibilité et cas spéciaux
- **Audio** : Nécessite `/multiplex` actif pour entendre jingles et annonces
- **Historique** : Sauvegarde automatique à chaque `/end`

---