// Utilitaire pour détecter les doublons entre templates

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[{}\-!.,]/g, ' ') // Enlever ponctuation et placeholders
    .split(/\s+/)
    .filter(word => word.length > 3) // Mots significatifs seulement
    .filter(word => !['qui', 'pour', 'dans', 'avec', 'mais', 'sont', 'fait', 'tout', 'cette', 'mais', 'très', 'bien'].includes(word)); // Stop words
}

function findDuplicates(templateGroups) {
  const wordMap = new Map(); // mot -> [group, template]
  const duplicates = [];

  for (const [groupName, templates] of Object.entries(templateGroups)) {
    if (!templates) continue;
    
    const templateList = Array.isArray(templates) ? templates : templates.default || [];
    
    templateList.forEach((template, index) => {
      const text = template.text || template;
      const keywords = extractKeywords(text);
      
      keywords.forEach(word => {
        if (wordMap.has(word)) {
          duplicates.push({
            word,
            existing: wordMap.get(word),
            current: { group: groupName, template: text, index }
          });
        } else {
          wordMap.set(word, { group: groupName, template: text, index });
        }
      });
    });
  }

  return duplicates;
}

// Test avec vos templates
function checkAllTemplates() {
  const { OPENERS, CONCEDING_OPENERS } = require('./openers.js');
  const { CONCEDING_TEAM_PHRASES } = require('./clubs.js');
  const { SCORER_TEMPLATES } = require('./scorer.js');

  const templateGroups = {
    'OPENERS': OPENERS,
    'CONCEDING_OPENERS': CONCEDING_OPENERS,
    'CONCEDING_TEAM_PHRASES': CONCEDING_TEAM_PHRASES,
    'SCORER_TEMPLATES': SCORER_TEMPLATES
  };

  const duplicates = findDuplicates(templateGroups);
  
  if (duplicates.length > 0) {
    console.log('🔍 Doublons détectés :');
    duplicates.forEach(dup => {
      console.log(`⚠️  Mot "${dup.word}"`);
      console.log(`   📍 ${dup.existing.group}: "${dup.existing.template}"`);
      console.log(`   📍 ${dup.current.group}: "${dup.current.template}"`);
      console.log('');
    });
  } else {
    console.log('✅ Aucun doublon détecté !');
  }
  
  return duplicates;
}

module.exports = { findDuplicates, checkAllTemplates };
