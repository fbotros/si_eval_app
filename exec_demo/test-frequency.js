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
    console.log('\n=== Testing Frequency-Based Tiebreaking ===\n');

    // Load frequency data from NLTK-generated JSON
    await engine.loadFrequencyData('./word_frequencies.json');

    console.log('Frequency scores:');
    const testWords = ['the', 'of', 'and', 'carrot', 'carlot', 'typing', 'typic'];
    for (const word of testWords) {
        const score = engine.getWordFrequencyScore(word);
        console.log(`  "${word}": ${score}`);
    }

    console.log('\n--- Testing "carot" correction with frequency data ---\n');

    // Test carot -> should prefer carrot over carlot when they have same cost
    const carotCorrectionPart = engine.findBestCorrectionForPart('carot');
    console.log(`findBestCorrectionForPart("carot"): "${carotCorrectionPart}"`);

    engine.resetIncrementalState();
    const carotCorrectionIncr = engine.getIncrementalCorrection('carot');
    console.log(`getIncrementalCorrection("carot"): "${carotCorrectionIncr}"`);

    // Calculate costs
    console.log('\nCosts:');
    console.log(`  "carot" → "carrot": ${engine.levenshteinCost('carot', 'carrot')} (freq: ${engine.getWordFrequencyScore('carrot')})`);
    console.log(`  "carot" → "carlot": ${engine.levenshteinCost('carot', 'carlot')} (freq: ${engine.getWordFrequencyScore('carlot')})`);

    console.log('\n--- Testing "typin" correction with frequency data ---\n');

    const typinCorrectionPart = engine.findBestCorrectionForPart('typin');
    console.log(`findBestCorrectionForPart("typin"): "${typinCorrectionPart}"`);

    engine.resetIncrementalState();
    const typinCorrectionIncr = engine.getIncrementalCorrection('typin');
    console.log(`getIncrementalCorrection("typin"): "${typinCorrectionIncr}"`);

    // Calculate costs
    console.log('\nCosts:');
    console.log(`  "typin" → "typing": ${engine.levenshteinCost('typin', 'typing')} (freq: ${engine.getWordFrequencyScore('typing')})`);
    console.log(`  "typin" → "typic": ${engine.levenshteinCost('typin', 'typic')} (freq: ${engine.getWordFrequencyScore('typic')})`);
}

test().catch(console.error);
