# Documentation Administrateur - Bot Multiplex L1

## Probabilités des catégories d'annonces 

Classic : ~22%
Scorer first : ~31%
Scorer only : ~22%
Conceding : ~22%
Minimal : ~4%

## Système de conférences de presse

### Déclenchement automatique
- Compteur : 10 matchs terminés avec `!fin`
- Reset automatique après déclenchement
- Questions générées par OpenAI avec contexte du match et historique

### Modes de fonctionnement
- **Session interactive** : Questions une par une avec `!conf`
- **Mode forcé** : Toutes les questions d'un coup avec `!conf --force`
- **Nombre par défaut** : 2 questions (configurable via `PRESS_NUM_DEFAULT`)

### Audio automatique
- Présentation lue automatiquement lors du déclenchement
- Questions lues si bot connecté au vocal

## Gestion des journées

### Auto-incrémentation Ligue 1
- Compétition "Ligue 1" : incrémentation automatique à chaque `!fin`
- Autres compétitions : gestion manuelle avec `!j` ou `!coach-set journée`

### Nouvelles commandes de reset
- `!matchday-reset` : Remet le compteur à J1
- `!matchday-set <valeur>` : Définit une valeur spécifique (1-99)

## Variables d'environnement importantes

```env
PRESS_NUM_DEFAULT=2          # Nombre de questions par défaut
PRESS_MODEL=gpt-4o          # Modèle OpenAI utilisé
AZURE_VOICE=fr-FR-HenriNeural # Voix pour TTS français
```

## Stockage des données

### Structure profiles.json
```json
{
  "guilds": {
    "guildId": {
      "userId": {
        "team": "string",
        "coach": {
          "name": "string",
          "nationality": "string", 
          "age": number,
          "currentCompetition": "string",
          "currentSeason": "string",
          "currentMatchday": number
        },
        "matchHistory": [...],
        "pressCounter": number
      }
    }
  },
  "boards": {
    "guildId": {
      "channelId": "string",
      "msgId": "string"
    }
  }
}
```

### Limite des données
- Historique : 100 matchs max par utilisateur
- Épingles Discord : 50 max par salon
- Sessions de conférence : temporaires (non persistées)

## Journalistes disponibles

Fichier `journalist.json` contient 23 journalistes avec personas uniques :
- Pierre Ménès, Daniel Riolo, Vincent Duluc
- Omar Da Fonseca, Romain Molina, Walid Acherchour
- Et bien d'autres avec styles distincts

## Debugging

### Logs importants
```
[PRESS DEBUG] Contexte reçu: ...
[DEBUG] Pattern sélectionné: ...
[STORE] Profils chargés
[VOICE] Ready in <channel>
```

### Commandes de test
```
!history-ids    # Voir les IDs pour debug
!coach          # Vérifier le profil
!comp           # Vérifier la compétition
!j              # Vérifier la journée suivante
```