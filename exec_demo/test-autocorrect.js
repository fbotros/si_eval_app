#!/usr/bin/env node

// CLI unit tests for AutocorrectEngine
const AutocorrectEngine = require('./AutocorrectEngine.js');

// Mock keyboard neighbors for testing
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
    'm': ['n', 'j', 'k']
};

class AutocorrectTester {
    constructor() {
        this.tests = [];
        this.results = [];
        this.setupEngine();
    }

    setupEngine() {
        // Test dictionary without 'ten' to match original test expectations
        const testWords = [
            'hello', 'world', 'test', 'the', 'quick', 'brown', 'fox',
            'jumps', 'over', 'lazy', 'dog', 'good', 'great', 'fantastic',
            'can', 'we', 'should', 'would', 'could', 'example', 'simple',
            'typing', 'keyboard', 'autocorrect', 'spell', 'check',
            "don't", "can't", "won't", "it's", "i'm", "you're",
            'a', 'an', 'i', 'to', 'of', 'and', 'or', 'but', 'if'
        ];

        this.engine = new AutocorrectEngine({
            baseWords: testWords,
            keyboardNeighbors: keyboardNeighbors,
            maxEditDistance: 2,
            adjacentKeyMultiplier: 0.4
        });

        console.log('Engine Statistics:');
        const stats = this.engine.getStats();
        console.log(`  Dictionary Size: ${stats.dictionarySize}`);
        console.log(`  Max Edit Distance: ${stats.maxEditDistance}`);
        console.log(`  Has TrieDictionary: ${stats.hasTrieDictionary}`);
        console.log(`  Keyboard Neighbors: ${stats.keyboardNeighborsCount} keys`);
        console.log('');
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    runTests() {
        console.log('Running AutocorrectEngine CLI tests...\n');

        this.results = [];
        this.tests.forEach(test => {
            try {
                const result = test.testFn(this.engine);
                this.results.push({
                    name: test.name,
                    passed: result.passed,
                    details: result.details || '',
                    expected: result.expected,
                    actual: result.actual
                });
            } catch (error) {
                this.results.push({
                    name: test.name,
                    passed: false,
                    details: `Error: ${error.message}`,
                    expected: 'No error',
                    actual: error.message
                });
            }
        });

        this.displayResults();
    }

    displayResults() {
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;

        // Group tests by category
        const categories = {
            'Basic Corrections': [],
            'Keyboard Proximity': [],
            'Two-Word Splitting': [],
            'Edge Cases': [],
            'Performance': []
        };

        this.results.forEach(result => {
            let category = 'Basic Corrections';
            if (result.name.includes('keyboard') || result.name.includes('neighbor')) {
                category = 'Keyboard Proximity';
            } else if (result.name.includes('split') || result.name.includes('two')) {
                category = 'Two-Word Splitting';
            } else if (result.name.includes('edge') || result.name.includes('empty')) {
                category = 'Edge Cases';
            } else if (result.name.includes('performance') || result.name.includes('cache')) {
                category = 'Performance';
            }
            categories[category].push(result);
        });

        Object.entries(categories).forEach(([category, tests]) => {
            if (tests.length === 0) return;

            console.log(`\n=== ${category} ===`);

            tests.forEach(result => {
                const icon = result.passed ? '✓' : '✗';
                const color = result.passed ? '\x1b[32m' : '\x1b[31m';
                const reset = '\x1b[0m';

                console.log(`${color}${icon} ${result.name}${reset}`);
                if (result.details) {
                    console.log(`  ${result.details}`);
                }
                if (!result.passed) {
                    console.log(`  Expected: ${result.expected}`);
                    console.log(`  Actual: ${result.actual}`);
                }
            });
        });

        console.log(`\n=== Test Summary ===`);
        console.log(`${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);

        if (passed === total) {
            console.log('\x1b[32m🎉 All tests passed!\x1b[0m');
        } else {
            console.log('\x1b[33m⚠️  Some tests failed\x1b[0m');
        }

        process.exit(passed === total ? 0 : 1);
    }

    // Test helper methods
    assertEqual(actual, expected, message = '') {
        const passed = actual === expected;
        return {
            passed,
            details: message,
            expected: expected,
            actual: actual
        };
    }

    assertTrue(condition, message = '') {
        return {
            passed: !!condition,
            details: message,
            expected: 'true',
            actual: String(!!condition)
        };
    }
}

// Initialize tester
const tester = new AutocorrectTester();

// Add tests
tester.addTest('Engine setup verification', (engine) => {
    const stats = engine.getStats();
    return tester.assertTrue(stats.dictionarySize > 0, `Engine initialized with ${stats.dictionarySize} words`);
});

tester.addTest('Basic word correction', (engine) => {
    const result = engine.findClosestWord('helo');
    return tester.assertEqual(result, 'hello', 'Should correct "helo" to "hello"');
});

tester.addTest('Word already correct', (engine) => {
    const result = engine.findClosestWord('hello');
    return tester.assertEqual(result, 'hello', 'Should return "hello" unchanged');
});

tester.addTest('No correction needed', (engine) => {
    const result = engine.findClosestWord('world');
    return tester.assertEqual(result, 'world', 'Should return "world" unchanged');
});

tester.addTest('Multiple character corrections (without ten)', (engine) => {
    const result = engine.findClosestWord('teh');
    return tester.assertEqual(result, 'the', 'Should correct "teh" to "the" when "ten" not in dictionary');
});

tester.addTest('Keyboard neighbor correction', (engine) => {
    // Test if keyboard neighbors get lower edit distance
    const distance1 = engine.levenshteinDistance('heklo', 'hello'); // k -> l (neighbors)
    const distance2 = engine.levenshteinDistance('hexlo', 'hello'); // x -> l (not neighbors)
    return tester.assertTrue(distance1 < distance2, `k->l distance: ${distance1}, x->l distance: ${distance2}`);
});

tester.addTest('Two-word splitting: basic', (engine) => {
    const result = engine.findTwoWordSplit('canwe');
    return tester.assertEqual(result, 'can we', 'Should split "canwe" to "can we"');
});

tester.addTest('Two-word splitting: capitalized', (engine) => {
    const result = engine.findTwoWordSplit('Canwe');
    return tester.assertEqual(result, 'Can we', 'Should split "Canwe" to "Can we" with proper capitalization');
});

tester.addTest('Two-word splitting: no valid split', (engine) => {
    const result = engine.findTwoWordSplit('xyz123');
    return tester.assertEqual(result, null, 'Should return null for non-splittable words');
});

tester.addTest('Edge case: empty string', (engine) => {
    const result = engine.findClosestWord('');
    return tester.assertEqual(result, '', 'Should handle empty string gracefully');
});

tester.addTest('Edge case: single character', (engine) => {
    const result = engine.findClosestWord('a');
    return tester.assertEqual(result, 'a', 'Should handle single character words');
});

tester.addTest('Contractions support', (engine) => {
    const result = engine.findClosestWord("dont");
    return tester.assertEqual(result, "don't", 'Should correct "dont" to "don\'t"');
});

tester.addTest('Levenshtein distance calculation', (engine) => {
    const distance = engine.levenshteinDistance('kitten', 'sitting');
    return tester.assertTrue(distance > 0 && distance < 10, 'Should calculate reasonable edit distance');
});

tester.addTest('Dictionary word checking', (engine) => {
    const hasHello = engine.hasWord('hello');
    const hasXyz = engine.hasWord('xyz123');
    return tester.assertTrue(hasHello && !hasXyz, 'Dictionary should contain expected words');
});

tester.addTest('Cache functionality', (engine) => {
    engine.clearCache();
    const initialCacheSize = engine.getStats().cacheSize;
    engine.findBestCorrectionForPart('helo');
    const afterCacheSize = engine.getStats().cacheSize;
    return tester.assertTrue(afterCacheSize > initialCacheSize, 'Cache should store correction results');
});

tester.addTest('Process text functionality', (engine) => {
    const result = engine.processText('hello wrold');
    return tester.assertTrue(result.corrected, 'Should detect and offer corrections for text');
});

// Test with broader dictionary including 'ten'
tester.addTest('Keyboard-aware correction prefers "ten" over "the"', (engine) => {
    // Create engine with both 'the' and 'ten' in dictionary
    const engineWithTen = new AutocorrectEngine({
        baseWords: ['the', 'ten', 'test', 'hello', 'world'],
        keyboardNeighbors: keyboardNeighbors,
        maxEditDistance: 2,
        adjacentKeyMultiplier: 0.4
    });

    const result = engineWithTen.findClosestWord('teh');
    const distanceToThe = engineWithTen.levenshteinDistance('teh', 'the');
    const distanceToTen = engineWithTen.levenshteinDistance('teh', 'ten');

    return tester.assertEqual(result, 'ten', `Should prefer "ten" (distance: ${distanceToTen}) over "the" (distance: ${distanceToThe})`);
});

// Run all tests
tester.runTests();