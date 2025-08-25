# 🎮 Guide de Configuration Joueur – Bot Multiplex L1

> **Guide obligatoire pour les nouveaux joueurs**

---

## 🚨 ÉTAPES OBLIGATOIRES (à faire une seule fois)

### 1. **Définir votre club** ⚽
```
!me <nom_de_votre_club>
```
**Exemples :**
```
!me angers
!me paris
!me lehavre
!me real-madrid
```
> ✅ **Obligatoire** - Sans club défini, vous ne pouvez pas jouer de matchs

### 2. **Vérifier votre configuration**
```
!whoami
```
> Affiche votre club mémorisé

### 3. **Configurer votre profil coach** (recommandé)
```
!coach-set nom "<votre_nom>"
!coach-set nationalité <pays>
!coach-set age <âge>
```
**Exemples :**
```
!coach-set nom "Didier Deschamps"
!coach-set nationalité France
!coach-set age 55
```

---

## 🎯 CONFIGURATION RAPIDE (recommandée)

### Option A : Configuration Ligue 1 (auto-gestion des journées)
```
!me <votre_club>
!coach-set nom "<votre_nom>"
!comp "Ligue 1"
!season "2024-2025"
```

### Option B : Configuration complète manuelle
```
!setup "Ligue 1" 1 "2024-2025"
!coach-set nom "<votre_nom>"
!coach-set nationalité <pays>
!coach-set age <âge>
```

---

## 📋 VALIDATION DE VOTRE SETUP

### Vérifiez votre configuration
```
!coach
!whoami
!comp
```

### Résultat attendu :
```
👤 Profil Coach — VotreNom
Nom : Votre Nom
Nationalité : France
Âge : XX ans
Compétition actuelle : Ligue 1
Saison : 2024-2025
Journée actuelle : J1

Ton club mémorisé : **Votre Club**

🏆 Compétition actuelle : Ligue 1 (J1 auto-calculée)
💡 Les journées s'incrémentent automatiquement en Ligue 1
```

---

## 🎮 PREMIER MATCH (test de fonctionnement)

### 1. Connecter le bot au vocal
```
!multiplex
```
> Rejoignez d'abord un salon vocal, puis tapez cette commande

### 2. Lancer un match test
```
!vs "Équipe Test"
!st
!g 17 Messi
!fin
```

### 3. Vérifier l'historique
```
!history
```

---

## ⚙️ COMMANDES DE MAINTENANCE

### Réinitialiser si nécessaire
```
!forgetme                    # Oublie votre club
!matchday-reset             # Remet le compteur à J1
```

### Corriger des erreurs
```
!coach-set nom "Nouveau Nom"
!comp "Nouvelle Compétition"
!matchday-set 10            # Fixer une journée spécifique
```

---

## 🆘 DÉPANNAGE RAPIDE

### "Je ne peux pas jouer de match"
1. Vérifiez : `!whoami` → doit afficher votre club
2. Si vide : `!me <votre_club>`

### "Les journées ne s'incrémentent pas"
1. Vérifiez : `!comp` → doit afficher "Ligue 1"
2. Si différent : `!comp "Ligue 1"`

### "Le bot ne parle pas"
1. `!multiplex` pour connecter le bot au vocal
2. Rejoignez d'abord un salon vocal

### "Mes stats de buteurs sont vides"
1. Vérifiez : `!history` → doit contenir des matchs
2. Utilisez `!g 17 Joueur` avec le nom du buteur

---

## 📖 COMMANDES ESSENTIELLES À RETENIR

| Commande | Description | Fréquence |
|----------|-------------|-----------|
| `!me <club>` | Définir votre club | **1 fois** |
| `!multiplex` | Connecter/déconnecter le bot | Début/fin de session |
| `!vs <adversaire>` | Définir l'adversaire | Chaque match |
| `!st` | Démarrer le match | Chaque match |
| `!g [minute] [buteur]` | But pour vous | Pendant le match |
| `!fin` | Terminer le match | Chaque match |
| `!history` | Voir vos derniers matchs | Vérification |

---

## ✅ CHECKLIST NOUVEAU JOUEUR

- [ ] Club défini avec `!me`
- [ ] Profil coach configuré avec `!coach-set nom`
- [ ] Compétition définie (Ligue 1 recommandée)
- [ ] Test de connexion vocal avec `!multiplex`
- [ ] Premier match test réalisé
- [ ] Historique vérifié avec `!history`

---

> 🎯 **Une fois cette configuration terminée, vous êtes prêt à jouer !**
> 
> Pour les commandes avancées, consultez le [Guide Complet](../README.md)
