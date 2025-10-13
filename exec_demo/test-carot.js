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
const keyboardNeighbors = {
    'q': ['1', '2', 'w', 'a', 's'],
    'w': ['q', '1', '2', '3', 'e', 'a', 's', 'd'],
    'e': ['w', '2', '3', '4', 'r', 's', 'd', 'f'],
    'r': ['e', '3', '4', '5', 't', 'd', 'f', 'g'],
    't': ['r', '4', '5', '6', 'y', 'f', 'g', 'h'],
    'y': ['t', '5', '6', '7', 'u', 'g', 'h', 'j'],
    'u': ['y', '6', '7', '8', 'i', 'h', 'j', 'k'],
    'i': ['u', '7', '8', '9', 'o', 'j', 'k', 'l'],
    'o': ['i', '8', '9', '0', 'p', 'k', 'l'],
    'p': ['o', '9', '0', '-', '[', 'l'],
    'a': ['q', 'w', 's', 'z', 'x'],
    's': ['q', 'w', 'e', 'a', 'd', 'z', 'x', 'c'],
    'd': ['w', 'e', 'r', 's', 'f', 'x', 'c', 'v'],
    'f': ['e', 'r', 't', 'd', 'g', 'c', 'v', 'b'],
    'g': ['r', 't', 'y', 'f', 'h', 'v', 'b', 'n'],
    'h': ['t', 'y', 'u', 'g', 'j', 'b', 'n', 'm'],
    'j': ['y', 'u', 'i', 'h', 'k', 'n', 'm'],
    'k': ['u', 'i', 'o', 'j', 'l', 'm'],
    'l': ['i', 'o', 'p', 'k'],
    'z': ['a', 's', 'x'],
    'x': ['z', 'a', 's', 'd', 'c'],
    'c': ['x', 's', 'd', 'f', 'v'],
    'v': ['c', 'd', 'f', 'g', 'b'],
    'b': ['v', 'f', 'g', 'h', 'n'],
    'n': ['b', 'g', 'h', 'j', 'm'],
    'm': ['n', 'h', 'j', 'k'],
    '1': ['2', 'q', 'w'],
    '2': ['1', '3', 'q', 'w', 'e'],
    '3': ['2', '4', 'w', 'e', 'r'],
    '4': ['3', '5', 'e', 'r', 't'],
    '5': ['4', '6', 'r', 't', 'y'],
    '6': ['5', '7', 't', 'y', 'u'],
    '7': ['6', '8', 'y', 'u', 'i'],
    '8': ['7', '9', 'u', 'i', 'o'],
    '9': ['8', '0', 'i', 'o', 'p'],
    '0': ['9', '-', 'o', 'p']
};

// Create engine with keyboard neighbors
const engine = new AutocorrectEngine({
    baseWords: words,
    maxEditDistance: 2,
    keyboardNeighbors: keyboardNeighbors
});

console.log('\n=== Testing "carot" correction ===\n');

const testWord = 'carot';
console.log(`Input: "${testWord}"\n`);

// Check if R and G are neighbors
console.log('Checking if R and G are neighbors:');
console.log(`  keyboardNeighbors['r'].includes('g'): ${keyboardNeighbors['r'].includes('g')}`);
console.log(`  engine.areNeighboringKeys('r', 'g'): ${engine.areNeighboringKeys('r', 'g')}`);
console.log('');

// Test with findBestCorrectionForPart
const correction1 = engine.findBestCorrectionForPart(testWord);
console.log(`findBestCorrectionForPart: "${correction1}"`);

// Calculate costs manually for candidate words
const candidates = ['carrot', 'cagot', 'cabot', 'carol'];
console.log('\nCosts for candidates:');
for (const candidate of candidates) {
    const cost = engine.levenshteinCost(testWord, candidate);
    const freq = engine.getWordFrequencyScore(candidate);
    const inDict = engine.hasWord(candidate);
    console.log(`  "${testWord}" → "${candidate}": cost=${cost}, freq=${freq}, inDict=${inDict}`);
}

// Test with incremental correction
console.log('\nIncremental correction:');
engine.resetIncrementalState();
const correction2 = engine.getIncrementalCorrection(testWord);
console.log(`getIncrementalCorrection: "${correction2}"`);

// Check both words are in dictionary
console.log(`\n"carrot" in dictionary: ${engine.hasWord('carrot')}`);
console.log(`"cagot" in dictionary: ${engine.hasWord('cagot')}`);
