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
    console.log('\n=== Why is "camise" being chosen for "amise"? ===\n');

    // Load frequency data
    await engine.loadFrequencyData('./word_frequencies.json');

    // Check if camise is in dictionary
    console.log(`"camise" in dictionary: ${engine.hasWord('camise')}`);

    // Calculate costs
    const costToAmiss = engine.levenshteinCost('amise', 'amiss');
    const costToAmuse = engine.levenshteinCost('amise', 'amuse');
    const costToCamise = engine.levenshteinCost('amise', 'camise');
    const costToAnise = engine.levenshteinCost('amise', 'anise');

    console.log('\nEdit costs:');
    console.log(`  "amise" → "amiss": ${costToAmiss} (e→s substitution, not neighbors)`);
    console.log(`  "amise" → "amuse": ${costToAmuse} (i→u substitution, neighbors)`);
    console.log(`  "amise" → "camise": ${costToCamise} (insert 'c' at start)`);
    console.log(`  "amise" → "anise": ${costToAnise} (m→n substitution, not neighbors)`);

    // Check frequency scores
    console.log('\nFrequency scores:');
    console.log(`  "amiss": ${engine.getWordFrequencyScore('amiss')}`);
    console.log(`  "amuse": ${engine.getWordFrequencyScore('amuse')}`);
    console.log(`  "camise": ${engine.getWordFrequencyScore('camise')}`);
    console.log(`  "anise": ${engine.getWordFrequencyScore('anise')}`);

    // Get all candidates and sort
    const candidates = engine.trieDictionary.search('amise', 2);
    const scored = candidates.map(c => ({
        word: c.word,
        dist: engine.levenshteinCost('amise', c.word),
        freq: engine.getWordFrequencyScore(c.word)
    })).filter(c => c.dist <= 2);

    scored.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        if (a.freq !== b.freq) return a.freq - b.freq;
        return a.word.localeCompare(b.word);
    });

    console.log('\nTop 15 candidates sorted by (distance, frequency, alphabetical):');
    for (let i = 0; i < Math.min(15, scored.length); i++) {
        const c = scored[i];
        const marker = (c.word === 'camise') ? ' ← CHOSEN' : '';
        console.log(`  ${i+1}. "${c.word}" - distance: ${c.dist}, frequency: ${c.freq}${marker}`);
    }

    // Test what the engine actually returns
    console.log('\nActual engine results:');
    const correctionPart = engine.findBestCorrectionForPart('amise');
    console.log(`  findBestCorrectionForPart("amise"): "${correctionPart}"`);

    engine.resetIncrementalState();
    const correctionIncr = engine.getIncrementalCorrection('amise');
    console.log(`  getIncrementalCorrection("amise"): "${correctionIncr}"`);

    const correctionFull = engine.findClosestWord('amise');
    console.log(`  findClosestWord("amise"): "${correctionFull}"`);
}

test().catch(console.error);
