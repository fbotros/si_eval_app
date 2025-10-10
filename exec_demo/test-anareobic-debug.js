const fs = require('fs');
const path = require('path');
const AutocorrectEngine = require('./AutocorrectEngine');
const TrieDictionary = require('./TrieDictionary');

global.TrieDictionary = TrieDictionary;

async function loadDictionary() {
  const dictPath = path.join(__dirname, 'hybrid_dictionary.txt');
  const content = fs.readFileSync(dictPath, 'utf-8');
  return content.split('\n')
    .map(word => word.trim().toLowerCase())
    .filter(word => word.length > 0);
}

async function test() {
  console.log('Testing "anareobic" with DEBUG logging...\n');

  const dictionary = await loadDictionary();
  const engine = new AutocorrectEngine({
    baseWords: dictionary,
    keyboardNeighbors: {},
    maxEditDistance: 2,
    enableWordSplitting: true
  });

  // Test with debug enabled
  const result = engine.findClosestWord('anareobic', { debug: true });

  console.log(`\n=== FINAL RESULT ===`);
  console.log(`"anareobic" -> "${result}"`);
}

test().catch(console.error);
