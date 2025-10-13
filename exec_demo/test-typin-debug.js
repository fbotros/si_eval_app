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

// Create engine with default settings
const engine = new AutocorrectEngine({
    baseWords: words,
    maxEditDistance: 2
});

console.log('\n=== Debug incremental correction for "typin" ===\n');

// Simulate typing "t" -> "ty" -> "typ" -> "typi" -> "typin"
const sequence = ['t', 'ty', 'typ', 'typi', 'typin'];

for (const partial of sequence) {
    console.log(`\n--- Typing: "${partial}" ---`);
    const correction = engine.getIncrementalCorrection(partial);
    console.log(`Incremental correction: "${correction}"`);

    if (engine.incrementalState) {
        console.log(`Active candidates: ${engine.incrementalState.candidates.size}`);

        // Show top 5 candidates
        const candidateWords = [];
        for (const [node, data] of engine.incrementalState.candidates) {
            if (node.word) {
                const editDist = data.row[data.row.length - 1];
                candidateWords.push({ word: node.word, dist: editDist });
            }
        }
        candidateWords.sort((a, b) => a.dist - b.dist);
        console.log('Top candidates:', candidateWords.slice(0, 10));
    }
}
