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
    console.log('\n=== Debug incremental DP distances ===\n');

    // Load frequency data
    await engine.loadFrequencyData('./word_frequencies.json');

    // Reset and run incremental correction
    engine.resetIncrementalState();
    const correction = engine.getIncrementalCorrection('amise');

    console.log(`Incremental correction: "${correction}"\n`);

    // Check the distances stored in incrementalState
    const candidates = [];
    for (const [node, data] of engine.incrementalState.candidates) {
        if (node.word && ['amiss', 'amuse', 'camise', 'anise', 'arise'].includes(node.word)) {
            const editDist = data.row[data.row.length - 1];
            const freq = engine.getWordFrequencyScore(node.word);
            candidates.push({ word: node.word, dist: editDist, freq: freq });
        }
    }

    candidates.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return a.freq - b.freq;
    });

    console.log('Candidates from incremental DP:');
    for (const c of candidates) {
        console.log(`  "${c.word}" - incremental dist: ${c.dist}, freq: ${c.freq}`);
    }

    console.log('\nCompare with levenshteinCost:');
    for (const c of candidates) {
        const trueCost = engine.levenshteinCost('amise', c.word);
        const match = (Math.abs(c.dist - trueCost) < 0.01) ? '✓' : `✗ (expected ${trueCost})`;
        console.log(`  "${c.word}" - ${match}`);
    }
}

test().catch(console.error);
