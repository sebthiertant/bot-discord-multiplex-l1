# Tests de Régression - Slash Commandes

## Objectif

Ce système de tests vérifie que toutes les slash commandes fonctionnent correctement et détecte les régressions lors des modifications du code.

## Utilisation

### Lancer tous les tests
```bash
npm test
```

### Mode watch (relance automatique)
```bash
npm run test:watch
```

### Lancer manuellement
```bash
node tests/slash-commands.test.js
```

## Fonctionnalités testées

### ✅ Commandes de base
- `/me` - Définir le club
- `/whoami` - Afficher le club mémorisé
- `/forgetme` - Oublier le club

### ✅ Profil Coach
- `/coach` - Afficher le profil
- `/coach-set` - Modifier le profil (avec validation)

### ✅ Gestion Compétition
- `/competition` - Compétition actuelle
- `/season` - Saison actuelle
- `/matchday` - Journée actuelle

### ✅ Historique
- `/history` - Afficher l'historique
- `/scorers` - Statistiques des buteurs

### ✅ Actions de match
- `/goal` - But pour l'équipe (avec/sans paramètres)
- `/goal-against` - But contre l'équipe
- `/undo` - Annuler action

### ✅ Autres commandes
- `/multiplex` - Connexion vocal
- `/board` - Tableau de bord
- `/mercato` - Annonces mercato
- `/conference` - Conférences de presse

### ✅ Validation des paramètres
- Âges invalides (coach-set)
- Journées hors limites (matchday)
- Paramètres manquants

## Architecture des tests

### Mocks
- **Discord.js** : Simulation complète des interactions
- **Store** : Stockage en mémoire pour les tests
- **Audio/TTS** : Simulation sans fichiers réels
- **Modules externes** : Évite les dépendances lourdes

### Structure
```
tests/
├── slash-commands.test.js  # Tests principaux
├── README.md              # Cette documentation
└── fixtures/              # Données de test (futur)
```

## Ajouter de nouveaux tests

```javascript
await this.test('Description du test', async () => {
  const interaction = createMockInteraction('command-name', { 
    param1: 'value1',
    param2: 42 
  });
  
  await handleSlashCommand(interaction);
  
  // Vérifications
  const result = mockStore.getSomething();
  if (result !== expected) {
    throw new Error(`Expected ${expected}, got ${result}`);
  }
});
```

## Sortie exemple

```
🚀 Starting Slash Commands Regression Tests

🧪 Command /me should set team
✓ Reply: ✅ Club défini : **Angers**
✅ PASSED: Command /me should set team

🧪 Command /whoami should return saved team
✓ Reply: Ton club mémorisé : **Test Team**
✅ PASSED: Command /whoami should return saved team

[...]

📊 TEST RESULTS SUMMARY
============================================================
✅ Passed: 25
❌ Failed: 0
📊 Total:  25

🎉 ALL TESTS PASSED! No regressions detected.
============================================================
```

## Intégration CI/CD

Pour automatiser les tests :

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

## Avantages

1. **Détection précoce** : Trouve les bugs avant déploiement
2. **Refactoring sûr** : Permet de modifier le code en confiance
3. **Documentation** : Les tests servent d'exemples d'utilisation
4. **Rapidité** : Exécution en secondes sans dépendances Discord
5. **Couverture complète** : Toutes les slash commandes testées
