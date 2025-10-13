const AutocorrectEngine = require('./AutocorrectEngine');
const TrieDictionary = require('./TrieDictionary');
const fs = require('fs');

global.TrieDictionary = TrieDictionary;

const words = fs.readFileSync('./hybrid_dictionary.txt', 'utf8')
    .split('\n')
    .filter(w => w.length > 0);

const keyboardLayout = require('./keyboard-layout.js');

const engine = new AutocorrectEngine({
    baseWords: words,
    maxEditDistance: 2,
    keyboardNeighbors: keyboardLayout
});

async function test() {
    await engine.loadFrequencyData('./word_frequencies.json');

    console.log('\n=== Why is "amide" winning for "amise"? ===\n');

    console.log('Edit costs:');
    console.log(`  amise → amuse (i→u): ${engine.levenshteinCost('amise', 'amuse')}`);
    console.log(`  amise → amiss (e→s): ${engine.levenshteinCost('amise', 'amiss')}`);
    console.log(`  amise → amide (s→d): ${engine.levenshteinCost('amise', 'amide')}`);
    console.log('');

    console.log('Neighbor checks:');
    console.log(`  i and u neighbors? ${engine.areNeighboringKeys('i', 'u')}`);
    console.log(`  e and s neighbors? ${engine.areNeighboringKeys('e', 's')}`);
    console.log(`  s and d neighbors? ${engine.areNeighboringKeys('s', 'd')}`);
    console.log('');

    console.log('Frequency scores:');
    console.log(`  amuse: ${engine.getWordFrequencyScore('amuse')}`);
    console.log(`  amiss: ${engine.getWordFrequencyScore('amiss')}`);
    console.log(`  amide: ${engine.getWordFrequencyScore('amide')}`);
    console.log('');

    const correction = engine.findBestCorrectionForPart('amise');
    console.log(`Actual correction: "${correction}"`);
    console.log(`Expected: "amuse" (cost 0.9, freq ~25k)`);
}

test().catch(console.error);
