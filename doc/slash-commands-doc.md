# Guide des Slash Commandes – Bot Multiplex L1

> Documentation dédiée aux slash commandes (`/`) avec auto-complétion et validation intégrée.

---

## 🌟 Avantages des Slash Commandes

- **Auto-complétion** : Discord propose automatiquement les paramètres
- **Validation** : Vérification des types (entier, texte, etc.) avant envoi
- **Interface moderne** : Plus claire et intuitive
- **Aide intégrée** : Description des paramètres directement dans Discord
- **Sécurité** : Impossible d'envoyer une commande mal formée

---

## 📋 Commandes de Base

### Gestion du Club

#### `/me`
Définit et mémorise ton club pour ce serveur.
- **Paramètre :** `club` (texte, obligatoire)
- **Exemple :** `/me club:Angers`

#### `/whoami`
Affiche ton club actuellement mémorisé.
- **Aucun paramètre**

#### `/forgetme`
Supprime ton club mémorisé.
- **Aucun paramètre**

---

## 🎙️ Audio et Connexion

### `/multiplex`
Active/désactive la connexion vocal du bot.
- **Aucun paramètre**
- **Usage :** Rejoins un salon vocal puis tape `/multiplex`
- **Comportement :** Toggle ON/OFF - re-tape pour déconnecter

### `/champions-league`
Joue l'hymne de la Ligue des Champions.
- **Aucun paramètre**
- **Prérequis :** Bot connecté au vocal avec `/multiplex`

### `/europa-league`
Joue l'hymne de l'Europa League.
- **Aucun paramètre**
- **Prérequis :** Bot connecté au vocal avec `/multiplex`

---

## ⚽ Gestion de Match

### Configuration du Match

#### `/vs`
Définit l'adversaire pour le match.
- **Paramètre :** `adversaire` (texte, obligatoire)
- **Exemple :** `/vs adversaire:Marseille`

#### `/start`
Lance le match (statut LIVE, minute 0).
- **Aucun paramètre**

### Gestion du Temps

#### `/minute`
Règle la minute actuelle du match.
- **Paramètre :** `minute` (entier, obligatoire)
- **Exemple :** `/minute minute:17`

#### `/halftime`
Passe en mi-temps (minute 45).
- **Aucun paramètre**

#### `/second-half`
Début de la seconde période (minute 46).
- **Aucun paramètre**

#### `/end`
Termine le match (minute 90) et sauvegarde automatiquement.
- **Aucun paramètre**

### Buts et Actions

#### `/goal`
Enregistre un but pour ton équipe.
- **Paramètres :**
  - `minute` (entier, optionnel) : Minute du but
  - `buteur` (texte, optionnel) : Nom du buteur
- **Exemples :**
  ```
  /goal minute:17 buteur:Mbappé
  /goal minute:52
  /goal buteur:Giroud
  /goal
  ```

#### `/goal-against`
Enregistre un but contre ton équipe.
- **Paramètres :** Identiques à `/goal`
- **Exemple :** `/goal-against minute:89 buteur:Payet`

#### `/undo`
Annule la dernière action effectuée.
- **Aucun paramètre**

---

## 👤 Profil Coach

### `/coach`
Affiche ton profil coach complet.
- **Aucun paramètre**

### `/coach-set`
Modifie une propriété de ton profil coach.
- **Paramètres :**
  - `propriete` (choix obligatoire) : `nom`, `nationalité`, `age`, `compétition`, `saison`, `journée`
  - `valeur` (texte, obligatoire) : Nouvelle valeur
- **Exemples :**
  ```
  /coach-set propriete:nom valeur:"Didier Deschamps"
  /coach-set propriete:nationalité valeur:France
  /coach-set propriete:age valeur:55
  /coach-set propriete:compétition valeur:"Ligue 1"
  /coach-set propriete:saison valeur:"2024-2025"
  /coach-set propriete:journée valeur:15
  ```

---

## 🏆 Gestion Compétition

### `/competition`
Affiche ou définit la compétition actuelle.
- **Paramètre :** `nom` (texte, optionnel)
- **Exemples :**
  ```
  /competition                    # Affiche la compétition actuelle
  /competition nom:"Ligue 1"      # Définit la compétition
  /competition nom:"Ligue des Champions"
  ```

### `/season`
Affiche ou définit la saison actuelle.
- **Paramètre :** `saison` (texte, optionnel)
- **Exemples :**
  ```
  /season                         # Affiche la saison actuelle
  /season saison:"2024-2025"      # Définit la saison
  ```

### `/matchday`
Affiche ou définit la journée actuelle.
- **Paramètre :** `journee` (entier 1-99, optionnel)
- **Exemples :**
  ```
  /matchday                       # Affiche la journée actuelle
  /matchday journee:15            # Définit la journée à J15
  ```

---

## 📊 Historique et Statistiques

### `/history`
Affiche l'historique de tes matchs.
- **Paramètre :** `nombre` (entier 1-20, optionnel, défaut: 5)
- **Exemples :**
  ```
  /history                        # 5 derniers matchs
  /history nombre:10              # 10 derniers matchs
  ```

### `/scorers`
Affiche le classement de tes buteurs.
- **Paramètre :** `nombre` (entier 1-20, optionnel, défaut: 10)
- **Exemples :**
  ```
  /scorers                        # Top 10 des buteurs
  /scorers nombre:5               # Top 5 des buteurs
  ```

---

## 🎙️ Conférences de Presse

### `/conference`
Gère les conférences de presse automatiques ou forcées.
- **Paramètres :**
  - `force` (booléen, optionnel) : Force une nouvelle conférence
  - `questions` (entier 1-5, optionnel) : Nombre de questions (défaut: 3)
- **Exemples :**
  ```
  /conference                           # Continue la session en cours
  /conference force:true                # Force 3 questions
  /conference force:true questions:5    # Force 5 questions
  /conference questions:2               # Continue avec contexte
  ```

---

## 💰 Annonces Mercato

### `/mercato`
Génère une annonce de transfert style Fabrizio Romano.
- **Paramètres :**
  - `montant` (entier ≥0, obligatoire) : Montant en millions d'euros
  - `club_origine` (texte, obligatoire) : Club vendeur
  - `joueur` (texte, obligatoire) : Nom du joueur
- **Prérequis :** 
  - Club défini avec `/me`
  - Bot connecté au vocal
- **Exemples :**
  ```
  /mercato montant:180 club_origine:"Paris Saint-Germain" joueur:"Kylian Mbappé"
  /mercato montant:25 club_origine:"Slavia Prague" joueur:"David Jäkel"
  /mercato montant:0 club_origine:"Inter Miami" joueur:"Lionel Messi"
  ```

---

## 📋 Tableau de Bord

### `/board`
Met à jour le tableau épinglé.
- **Aucun paramètre**

### `/board-setup`
Configure le tableau dans un salon.
- **Paramètre :** `salon` (canal, optionnel) : Salon cible (défaut: salon actuel)
- **Exemple :** `/board-setup salon:#multiplex-board`
- **Action :** Nettoie le salon, crée et épingle le tableau

---

## 🔧 Auto-complétion et Validation

### Types de Paramètres

| Type | Description | Validation |
|------|-------------|------------|
| **Texte** | Chaîne de caractères | Toute entrée textuelle |
| **Entier** | Nombre entier | Validation automatique |
| **Booléen** | Vrai/Faux | Cases à cocher |
| **Choix** | Liste prédéfinie | Menu déroulant |
| **Canal** | Salon Discord | Sélecteur de salon |

### Exemples d'Auto-complétion

```
/coach-set propriete:
  ├── nom
  ├── nationalité  
  ├── age
  ├── compétition
  ├── saison
  └── journée

/goal minute:17 buteur:
  └── [Tape le nom du buteur]

/mercato montant:50 club_origine:
  └── [Tape le nom du club]
```

---

## 🚀 Workflow Complet avec Slash Commandes

### Configuration Initiale
```
/me club:Angers
/coach-set propriete:nom valeur:"Mon Nom"
/coach-set propriete:nationalité valeur:France
/competition nom:"Ligue 1"
/season saison:"2024-2025"
/multiplex
```

### Match Complet
```
/vs adversaire:Marseille
/start
/goal minute:17 buteur:Mbappé
/goal-against minute:52 buteur:Payet
/halftime
/second-half
/goal minute:89 buteur:Giroud
/end
```

### Post-Match
```
/conference force:true questions:3
/scorers nombre:5
/history nombre:10
```

### Mercato
```
/mercato montant:75 club_origine:"AC Milan" joueur:"Rafael Leão"
```

---

## 💡 Conseils d'Utilisation

### Interface Discord
- **Auto-complétion** : Utilise `Tab` pour compléter automatiquement
- **Paramètres optionnels** : Apparaissent en gris dans l'interface
- **Validation** : Discord refuse les commandes mal formées
- **Aperçu** : Vois le résultat avant d'envoyer

### Efficacité
- **Ordre des paramètres** : Peu importe l'ordre, Discord les organise
- **Paramètres partiels** : Seuls les obligatoires sont requis
- **Réutilisation** : Discord mémorise tes dernières valeurs

### Compatibilité
- **Slash + Texte** : Les deux systèmes coexistent
- **Fonctionnalités identiques** : Mêmes résultats qu'avec `!`
- **Migration** : Passe progressivement aux slash commandes

---

## ❓ Dépannage

### Commandes Non Disponibles
- Vérifier que le bot a les permissions nécessaires
- Attendre le chargement complet du bot
- Réessayer après quelques secondes

### Paramètres Non Reconnus
- Utiliser l'auto-complétion Discord
- Vérifier les types requis (entier vs texte)
- Respecter les limites (1-99 pour journées, etc.)

### Audio Non Fonctionnel
- S'assurer d'être connecté avec `/multiplex`
- Vérifier les permissions vocales du bot
- Rejoindre un salon vocal avant `/multiplex`

---
