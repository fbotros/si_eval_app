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
    console.log('\n=== Why isn\'t "amuse" being found for "amise"? ===\n');

    // Load frequency data
    await engine.loadFrequencyData('./word_frequencies.json');

    // Get all candidates from trie
    const candidates = engine.trieDictionary.search('amise', 2);
    console.log(`Total candidates: ${candidates.length}\n`);

    // Check if amuse is in candidates
    const amuseCandidate = candidates.find(c => c.word === 'amuse');
    const amissCandidate = candidates.find(c => c.word === 'amiss');

    console.log('Checking specific candidates:');
    console.log(`  "amuse" in candidates: ${!!amuseCandidate}`);
    console.log(`  "amiss" in candidates: ${!!amissCandidate}`);
    console.log('');

    // Calculate distances
    console.log('Edit distances:');
    console.log(`  "amise" → "amuse": ${engine.levenshteinCost('amise', 'amuse')}`);
    console.log(`  "amise" → "amiss": ${engine.levenshteinCost('amise', 'amiss')}`);
    console.log('');

    // Check frequency scores
    console.log('Frequency scores:');
    console.log(`  "amuse": ${engine.getWordFrequencyScore('amuse')}`);
    console.log(`  "amiss": ${engine.getWordFrequencyScore('amiss')}`);
    console.log('');

    // Show top candidates sorted by distance and frequency
    const scored = candidates.map(c => ({
        word: c.word,
        dist: engine.levenshteinCost('amise', c.word),
        freq: engine.getWordFrequencyScore(c.word)
    })).filter(c => c.dist <= 2);

    scored.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return a.freq - b.freq;
    });

    console.log('Top 10 candidates by (distance, frequency):');
    for (let i = 0; i < Math.min(10, scored.length); i++) {
        const c = scored[i];
        console.log(`  ${i+1}. "${c.word}" - distance: ${c.dist}, frequency: ${c.freq}`);
    }
}

test().catch(console.error);
