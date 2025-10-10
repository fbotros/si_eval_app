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

async function testAnaerobic() {
  console.log('Testing "anaerobic" and typo "anareobic" autocorrect behavior...\n');

  const dictionary = await loadDictionary();
  const engine = new AutocorrectEngine({
    baseWords: dictionary,
    keyboardNeighbors: {},
    maxEditDistance: 2,
    enableWordSplitting: true
  });

  // Test the typo "anareobic" (missing an 'a')
  const testWords = ['anareobic', 'Anareobic', 'anaerobic', 'Anaerobic'];

  for (const word of testWords) {
    const hasWord = engine.hasWord(word.toLowerCase());
    const correction = engine.findClosestWord(word);

    console.log(`Word: "${word}"`);
    console.log(`  In dictionary: ${hasWord}`);
    console.log(`  Correction: "${correction}"`);
    console.log(`  Was corrected: ${correction !== word}`);

    if (word.toLowerCase() === 'anareobic') {
      const split = engine.findTwoWordSplit(word.toLowerCase());
      console.log(`  Split result:`, split);
    }
    console.log();
  }

  console.log('\nChecking if "anaerobic" is in dictionary:');
  console.log('  Dictionary lookup:', dictionary.includes('anaerobic'));

  // Check for similar words
  console.log('\nChecking for aerobic-related words:');
  const aerobicWords = dictionary.filter(w => w.includes('aerobic'));
  console.log(`  Found ${aerobicWords.length} words containing "aerobic":`);
  aerobicWords.forEach(w => console.log(`    - ${w}`));

  // Check if "nae" is in the dictionary
  console.log('\nChecking if "nae" is in dictionary:');
  console.log('  hasWord("nae"):', engine.hasWord('nae'));
  console.log('  Dictionary includes "nae":', dictionary.includes('nae'));
}

testAnaerobic().catch(console.error);
