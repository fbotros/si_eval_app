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
  console.log('Testing autocorrect determinism...\n');

  const dictionary = await loadDictionary();
  const engine = new AutocorrectEngine({
    baseWords: dictionary,
    keyboardNeighbors: {},
    maxEditDistance: 2,
    enableWordSplitting: true
  });

  // Test cases that previously had issues
  const testCases = [
    'anareobic',  // Should -> anaerobic
    'anarobi',    // Should -> anaerobic
    'anar',       // Intermediate stage
    'readd',      // Should not correct (it's readded, readding, etc exist)
    'iss',        // Should correct to "is"
    'iam',        // Should correct to "i am"
  ];

  console.log('=== Testing each word for consistent results ===\n');

  for (const word of testCases) {
    // Reset incremental state for each test
    engine.resetIncrementalState();

    // Test multiple times to ensure consistency
    const results = [];
    for (let i = 0; i < 3; i++) {
      engine.resetIncrementalState();
      const result = engine.findClosestWord(word);
      results.push(result);
    }

    const allSame = results.every(r => r === results[0]);
    const status = allSame ? '✅' : '❌';

    console.log(`${status} "${word}" -> "${results[0]}" (consistent: ${allSame})`);
    if (!allSame) {
      console.log(`   Multiple results: ${results.join(', ')}`);
    }
  }

  // Test incremental typing simulation
  console.log('\n=== Testing incremental typing simulation ===\n');

  const typingSequence = ['a', 'an', 'ana', 'anar', 'anare', 'anareo', 'anareob', 'anarebi', 'anareobic'];

  engine.resetIncrementalState();

  console.log('Simulating character-by-character typing:');
  for (const stage of typingSequence) {
    const correction = engine.findClosestWord(stage);
    console.log(`  "${stage}" -> "${correction}"`);
  }

  // Final check: does hitting space give the same result?
  engine.resetIncrementalState();
  const finalCorrection = engine.findClosestWord('anareobic');
  console.log(`\nFinal result (fresh state): "${finalCorrection}"`);

  console.log('\n=== Performance Check ===\n');
  const perfTest = engine.measurePerformanceForWord('anareobic');
  console.log(`Word: "${perfTest.word}"`);
  console.log(`Brute force would check: ${perfTest.bruteForceCalculations} words`);
  console.log(`Trie optimized checks: ${perfTest.trieCalculations} words`);
  console.log(`Speedup: ${perfTest.improvement.toFixed(1)}x faster`);
}

test().catch(console.error);
