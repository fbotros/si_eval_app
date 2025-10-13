const AutocorrectEngine = require('./AutocorrectEngine');
const TrieDictionary = require('./TrieDictionary');
const fs = require('fs');

// Make TrieDictionary globally available
global.TrieDictionary = TrieDictionary;

// Load dictionary
const dictionaryPath = './hybrid_dictionary.txt';
const words = fs.readFileSync(dictionaryPath, 'utf8')
    .split('\n')
    .filter(word => word.length > 0);

// Load keyboard neighbors
const keyboardLayout = require('./keyboard-layout.js');

// Create engine
const engine = new AutocorrectEngine({
    baseWords: words,
    maxEditDistance: 2,
    keyboardNeighbors: keyboardLayout
});

async function test() {
    console.log('\n=== Testing "amise" correction ===\n');

    // Load frequency data
    await engine.loadFrequencyData('./word_frequencies.json');

    // Check if i and u are neighbors
    console.log('Are i and u neighbors?');
    console.log(`  keyboardNeighbors['i'].includes('u'): ${keyboardLayout['i'].includes('u')}`);
    console.log(`  keyboardNeighbors['u'].includes('i'): ${keyboardLayout['u'].includes('i')}`);
    console.log(`  engine.areNeighboringKeys('i', 'u'): ${engine.areNeighboringKeys('i', 'u')}`);
    console.log('');

    // Check what words are in dictionary
    console.log('Dictionary checks:');
    console.log(`  "amuse" in dictionary: ${engine.hasWord('amuse')}`);
    console.log(`  "amise" in dictionary: ${engine.hasWord('amise')}`);
    console.log(`  "a" in dictionary: ${engine.hasWord('a')}`);
    console.log(`  "mise" in dictionary: ${engine.hasWord('mise')}`);
    console.log('');

    // Check frequency scores
    console.log('Frequency scores:');
    console.log(`  "amuse": ${engine.getWordFrequencyScore('amuse')}`);
    console.log(`  "a": ${engine.getWordFrequencyScore('a')}`);
    console.log(`  "mise": ${engine.getWordFrequencyScore('mise')}`);
    console.log('');

    // Calculate costs
    console.log('Edit costs:');
    const costToAmuse = engine.levenshteinCost('amise', 'amuse');
    console.log(`  "amise" → "amuse": ${costToAmuse} (neighbor substitution)`);
    console.log(`  Word split cost: ${engine.wordSplitCost} (for inserting space)`);
    console.log('');

    // Test single-word correction
    console.log('Single-word correction:');
    const singleCorrection = engine.findBestCorrectionForPart('amise');
    console.log(`  findBestCorrectionForPart("amise"): "${singleCorrection}"`);
    console.log('');

    // Test word splitting
    console.log('Word splitting:');
    const split = engine.findTwoWordSplit('amise');
    if (split) {
        console.log(`  Split found: "${split.firstWord}" + "${split.secondWord}"`);
        console.log(`  Frequency score for "a": ${engine.getWordFrequencyScore('a')}`);
        console.log(`  Frequency score for "mise": ${engine.getWordFrequencyScore('mise')}`);
        console.log(`  Combined score: ${engine.getWordFrequencyScore('a') + engine.getWordFrequencyScore('mise')}`);
    } else {
        console.log(`  No split found`);
    }
    console.log('');

    // Test full correction (which chooses between single-word and split)
    console.log('Full correction (single-word vs split):');
    const fullCorrection = engine.findClosestWord('amise');
    console.log(`  findClosestWord("amise"): "${fullCorrection}"`);
    console.log('');

    // Show the logic
    console.log('Analysis:');
    console.log(`  Option 1: Single-word "amuse" (cost ${costToAmuse})`);
    console.log(`  Option 2: Split "a mise" (cost ${engine.wordSplitCost})`);
    console.log(`  Winner: ${fullCorrection === 'a mise' ? 'SPLIT' : 'SINGLE-WORD'}`);
}

test().catch(console.error);
