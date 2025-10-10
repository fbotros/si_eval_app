/**
 * AutocorrectEngine - A comprehensive autocorrect library
 * Provides spell checking, word splitting, and correction suggestions
 */
class AutocorrectEngine {
    constructor(options = {}) {
        this.adjacentKeyMultiplier = options.adjacentKeyMultiplier || 0.9;
        this.insertionCost = options.insertionCost || 0.5; // Cheaper than deletion/substitution
        this.deletionCost = options.deletionCost || 1.0;
        this.substitutionCost = options.substitutionCost || 1.0;

        // Character-specific costs for common punctuation
        this.apostropheInsertionCost = options.apostropheInsertionCost || 0.2; // Very cheap to add apostrophes
        this.apostropheDeletionCost = options.apostropheDeletionCost || 0.3;   // Cheap to remove apostrophes
        this.maxEditDistance = options.maxEditDistance || 2;
        this.keyboardNeighbors = options.keyboardNeighbors || {};

        // Initialize dictionaries
        this.dictionary = [];
        this.dictionarySet = new Set();
        this.trieDictionary = null;

        // LRU Cache for expensive operations - stores most recently used corrections
        this.correctionCache = new Map();
        this.maxCacheSize = 1000;

        // Incremental autocorrect state
        this.incrementalState = null;

        // Common typo correction overrides - these get checked first for instant corrections
        this.correctionOverrides = options.correctionOverrides || {
            'teh': 'the',
            'tehm': 'them',
            'tehn': 'then',
            'adn': 'and',
            'nad': 'and',
            'cna': 'can',
            'nac': 'can',
            'se': 'we',
            'ot': 'it',
            'ut': 'it',
            'taht': 'that',
            'thta': 'that',
            'htat': 'that',
            'waht': 'what',
            'whta': 'what',
            'hwat': 'what',
            'yuo': 'you',
            'yuor': 'your',
            'youa': 'you a',
            'doenst': 'doesn\'t',
            'doesnt': 'doesn\'t',
            'diesnt': 'doesn\'t',
            'doent': 'doesn\'t',
            'wont': 'won\'t',
            'cant': 'can\'t',
            'didnt': 'didn\'t',
            'hasnt': 'hasn\'t',
            'isnt': 'isn\'t',
            'werent': 'weren\'t',
            'wouldnt': 'wouldn\'t',
            'shouldnt': 'shouldn\'t',
            'dont': 'don\'t'
        };

        // Word frequency list (most common words first) - shared across all methods
        this.commonWords = [
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
            'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
            'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
            'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only',
            'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want',
            'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'each', 'which', 'their',
            'time', 'will', 'about', 'if', 'up', 'out', 'many', 'then', 'them', 'would', 'so', 'what', 'her', 'make', 'like', 'him', 'into', 'over',
            'think', 'thanks', 'thank', 'really', 'great', 'good', 'right', 'still', 'should', 'after', 'being', 'now', 'made', 'before', 'here', 'through',
            'when', 'where', 'much', 'go', 'me', 'back', 'with', 'well', 'were', 'been', 'have', 'had', 'has', 'his', 'that', 'but', 'not', 'what', 'all',
            'any', 'can', 'our', 'out', 'day', 'get', 'use', 'man', 'new', 'now', 'way', 'may', 'say', 'each', 'which', 'she', 'how', 'its', 'our', 'out',
            'up', 'time', 'there', 'year', 'work', 'down', 'come', 'did', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'number', 'oil', 'part',
            'people', 'right', 'she', 'some', 'take', 'than', 'that', 'the', 'them', 'well', 'were'
        ];

        // Add base words if provided
        if (options.baseWords) {
            this.addWords(options.baseWords);
        }

        // Initialize TrieDictionary if available
        this.initializeTrieDictionary();
    }

    /**
     * Check if the length difference between input and correction is acceptable
     * Max difference: 1 char for strings <= 10, or ceil(10%) for longer strings
     */
    isLengthDifferenceAcceptable(inputWord, correctionWord) {
        const inputLength = inputWord.length;
        const correctionLength = correctionWord.length;
        const lengthDiff = Math.abs(inputLength - correctionLength);

        if (inputLength <= 10) {
            return lengthDiff <= 1;
        }

        const maxDiff = Math.ceil(inputLength * 0.1);
        return lengthDiff <= maxDiff;
    }

    /**
     * Get word frequency score - lower score means more common word
     */
    getWordFrequencyScore(word) {
        const index = this.commonWords.indexOf(word.toLowerCase());
        return index === -1 ? 1000 : index; // Lower index = more common = lower penalty
    }

    /**
     * Extract words from text using punctuation and space delimiters
     */
    extractWords(text) {
        return text.toLowerCase().split(/[\s.,!?;:"()]+/).filter(word => word.length > 0);
    }

    /**
     * Initialize TrieDictionary with current words
     */
    initializeTrieDictionary() {
        if (typeof TrieDictionary !== 'undefined' && this.dictionary.length > 0) {
            console.log(`🚀 Initializing Quest 3-optimized TrieDictionary with ${this.dictionary.length} words...`);
            // Set keyboardNeighbors globally for TrieDictionary to access
            if (typeof window !== 'undefined') {
                window.keyboardNeighbors = this.keyboardNeighbors;
            } else if (typeof global !== 'undefined') {
                global.keyboardNeighbors = this.keyboardNeighbors;
            }
            this.trieDictionary = new TrieDictionary(this.adjacentKeyMultiplier, this.dictionary);
            console.log(`✅ TrieDictionary initialized - using hybrid dictionary for wicked fast lookups`);
        } else if (typeof TrieDictionary === 'undefined') {
            console.warn('⚠️ TrieDictionary class not found - falling back to brute force search');
        }
    }

    /**
     * Add words to the dictionary
     */
    addWords(words) {
        words.forEach(word => {
            const lowerWord = word.toLowerCase();
            if (!this.dictionarySet.has(lowerWord)) {
                this.dictionary.push(lowerWord);
                this.dictionarySet.add(lowerWord);
            }
        });

        // Reinitialize TrieDictionary with new words
        this.initializeTrieDictionary();
    }

    /**
     * Check if two characters are neighbors on the keyboard
     */
    areNeighboringKeys(char1, char2) {
        const c1 = char1.toLowerCase();
        const c2 = char2.toLowerCase();
        return c1 !== c2 && this.keyboardNeighbors[c1]?.includes(c2) || false;
    }


    /**
     * Calculate Damerau-Levenshtein cost with keyboard-aware substitution costs
     * Supports transpositions which makes "teh" -> "the" cost = 1
     * NOTE: This is a weighted cost function, not standard edit distance
     */
    levenshteinCost(a, b, maxEditCost = null) {
        const maxCost = maxEditCost || this.maxEditDistance;

        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

        // Initialize first row and column
        for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b[i - 1] === a[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1]; // no operation needed
                } else {
                    const substitutionCost = this.areNeighboringKeys(a[j - 1], b[i - 1]) ?
                        this.adjacentKeyMultiplier : this.substitutionCost;

                    // Character-specific insertion/deletion costs
                    const charToInsert = b[i - 1];
                    const charToDelete = a[j - 1];

                    const insertionCost = (charToInsert === "'") ?
                        this.apostropheInsertionCost : this.insertionCost;
                    const deletionCost = (charToDelete === "'") ?
                        this.apostropheDeletionCost : this.deletionCost;

                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + substitutionCost, // substitution
                        matrix[i - 1][j] + insertionCost,        // insertion (character-specific) - Fixed
                        matrix[i][j - 1] + deletionCost          // deletion (character-specific) - Fixed
                    );

                    // Check for transposition (Damerau-Levenshtein)
                    if (i > 1 && j > 1 &&
                        b[i - 1] === a[j - 2] &&
                        b[i - 2] === a[j - 1]) {
                        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
                    }
                }
            }
        }

        return matrix[b.length][a.length];
    }


    /**
     * Find best correction for a word part using cached lookups and trie optimization
     * Made public for testing purposes
     */
    findBestCorrectionForPart(part) {
        // Check for exact override matches first (highest priority)
        if (this.correctionOverrides[part]) {
            return this.correctionOverrides[part];
        }

        if (this.hasWord(part)) return part;

        // For very short words, be more conservative about corrections
        if (part.length < 2) return null;

        // Check cache first
        if (this.correctionCache.has(part)) {
            return this.correctionCache.get(part);
        }

        let result = null;
        let bestMatch = null;
        let bestDistance = Infinity;

        // Fall back to brute force if TrieDictionary is not available
        let candidates;
        if (this.trieDictionary) {
            // Get candidates from trie - this should return a small set (50-200 words)
            candidates = this.trieDictionary.search(part, this.maxEditDistance);
            console.log(`🔍 TrieDictionary found ${candidates.length} candidates for "${part}"`);
            if (part.includes('fantastic')) {
                console.log('📝 Top candidates:', candidates.slice(0, 5));
            }
        } else {
            // Brute force fallback - check all dictionary words
            candidates = this.dictionary.map(word => ({ word: word }));
        }


        let bestFrequencyScore = Infinity;
        let rejectedByLength = 0;

        // Now only run expensive Levenshtein on the small candidate set
        for (const candidate of candidates) {
            const candidateWord = candidate.word;

            // Check length difference constraint first (cheap check)
            if (!this.isLengthDifferenceAcceptable(part, candidateWord)) {
                rejectedByLength++;
                if (part.includes('fantastic') && candidateWord === 'fantastic') {
                    console.log(`❌ Length check FAILED: "${part}" (${part.length}) → "${candidateWord}" (${candidateWord.length})`);
                }
                continue;
            }

            const cost = this.levenshteinCost(part, candidateWord);
            const frequencyScore = this.getWordFrequencyScore(candidateWord);

            if (part.includes('fantastic') && candidateWord === 'fantastic') {
                console.log(`✅ Length check OK: "${part}" → "${candidateWord}", cost=${cost}, maxDist=${this.maxEditDistance}`);
            }

            // Prefer lower cost first, then lower frequency score (more common words) as tiebreaker
            if (cost <= this.maxEditDistance &&
                (cost < bestDistance || (cost === bestDistance && frequencyScore < bestFrequencyScore))) {
                bestDistance = cost;
                bestFrequencyScore = frequencyScore;
                bestMatch = candidateWord;
            }
        }
        result = bestMatch;

        if (part.includes('fantastic')) {
            console.log(`🎯 Final result for "${part}": "${result}" (rejected ${rejectedByLength} by length)`);
        }

        // Cache the result using LRU eviction (Least Recently Used)
        // When cache is full, delete the oldest entry (first item in Map)
        if (this.correctionCache.size >= this.maxCacheSize) {
            // Delete first (oldest) entry in the Map
            const firstKey = this.correctionCache.keys().next().value;
            this.correctionCache.delete(firstKey);
        }
        this.correctionCache.set(part, result);

        return result;
    }


    /**
     * Preserve original capitalization in the corrected word
     */
    preserveCapitalization(originalWord, correctedWord) {
        if (!originalWord || !correctedWord) return correctedWord;

        // If original is all uppercase, make correction all uppercase
        if (originalWord === originalWord.toUpperCase()) {
            return correctedWord.toUpperCase();
        }

        // If original starts with capital, capitalize first letter of correction
        if (originalWord[0] === originalWord[0].toUpperCase()) {
            return correctedWord.charAt(0).toUpperCase() + correctedWord.slice(1);
        }

        // Otherwise, keep correction lowercase
        return correctedWord;
    }

    /**
     * Reset incremental state (call on space, click, or new word)
     */
    resetIncrementalState() {
        this.incrementalState = null;
    }

    /**
     * Incremental autocorrect - maintains active candidate set between keystrokes
     * Returns the best candidate or null if no good correction exists
     */
    getIncrementalCorrection(word) {
        const lowerWord = word.toLowerCase();

        // Check for exact override matches first (highest priority)
        if (this.correctionOverrides[lowerWord]) {
            return this.correctionOverrides[lowerWord];
        }

        // If word is in dictionary, no correction needed
        if (this.hasWord(lowerWord)) {
            return null;
        }

        if (!this.trieDictionary) return null;

        // Check if we can do incremental update (one character added)
        const canIncrement = this.incrementalState &&
                            lowerWord.startsWith(this.incrementalState.word) &&
                            lowerWord.length === this.incrementalState.word.length + 1;

        if (!canIncrement) {
            // Start fresh - initialize from root
            this.incrementalState = {
                word: lowerWord,
                candidates: new Map() // Map of trieNode -> {row, depth}
            };

            // Initialize first row of DP matrix
            const sz = lowerWord.length;
            const initialRow = new Float32Array(sz + 1);
            for (let i = 0; i <= sz; i++) {
                initialRow[i] = i;
            }

            // Explore from root
            for (const [char, node] of this.trieDictionary.root.children) {
                this.expandNode(node, char, initialRow, lowerWord, 1);
            }
        } else {
            // Incremental update - extend existing candidates
            const newChar = lowerWord[lowerWord.length - 1];
            const newCandidates = new Map();

            // Extend each active candidate
            for (const [node, data] of this.incrementalState.candidates) {
                // Try to follow existing children
                for (const [char, childNode] of node.children) {
                    const newRow = this.computeNextRow(data.row, lowerWord, char);
                    const minInRow = Math.min(...newRow);

                    // Only keep if within edit distance threshold
                    if (minInRow <= this.maxEditDistance) {
                        newCandidates.set(childNode, {
                            row: newRow,
                            depth: data.depth + 1
                        });
                    }
                }
            }

            this.incrementalState.word = lowerWord;
            this.incrementalState.candidates = newCandidates;
        }

        // Find best candidate from active set
        let bestCandidate = null;
        let bestDistance = this.maxEditDistance;
        let bestFrequency = Infinity;

        for (const [node, data] of this.incrementalState.candidates) {
            if (node.word && node.word.length > 0) {
                const editDist = data.row[data.row.length - 1];
                if (editDist <= bestDistance) {
                    const freq = this.getWordFrequencyScore(node.word);
                    if (editDist < bestDistance ||
                        (editDist === bestDistance && freq < bestFrequency)) {
                        bestDistance = editDist;
                        bestFrequency = freq;
                        bestCandidate = node.word;
                    }
                }
            }
        }

        return bestCandidate;
    }

    /**
     * Expand a trie node and compute its DP row
     */
    expandNode(node, char, lastRow, word, depth) {
        const sz = word.length;
        const currentRow = new Float32Array(sz + 1);
        currentRow[0] = lastRow[0] + 1;

        let minInRow = currentRow[0];

        for (let i = 1; i <= sz; i++) {
            const insertCost = 1.0 + currentRow[i - 1];
            const deleteCost = 1.0 + lastRow[i];
            let replaceCost = lastRow[i - 1];

            if (word[i - 1] !== char) {
                replaceCost = 1.0 + lastRow[i - 1];

                // Check for adjacent keys
                const adjacentKey = word[i - 1] + char;
                if (this.trieDictionary.adjacentKeysSet.has(adjacentKey)) {
                    replaceCost = this.adjacentKeyMultiplier + lastRow[i - 1];
                }
            }

            currentRow[i] = Math.min(insertCost, deleteCost, replaceCost);
            minInRow = Math.min(minInRow, currentRow[i]);
        }

        // Only keep if within threshold
        if (minInRow <= this.maxEditDistance) {
            this.incrementalState.candidates.set(node, {
                row: currentRow,
                depth: depth
            });

            // Recursively expand children
            for (const [nextChar, childNode] of node.children) {
                this.expandNode(childNode, nextChar, currentRow, word, depth + 1);
            }
        }
    }

    /**
     * Compute next DP row when adding one character to the input
     */
    computeNextRow(lastRow, word, char) {
        const sz = word.length;
        const newRow = new Float32Array(sz + 1);
        newRow[0] = lastRow[0] + 1;

        for (let i = 1; i <= sz; i++) {
            const insertCost = 1.0 + newRow[i - 1];
            const deleteCost = 1.0 + lastRow[i];
            let replaceCost = lastRow[i - 1];

            if (word[i - 1] !== char) {
                replaceCost = 1.0 + lastRow[i - 1];

                // Check for adjacent keys
                const adjacentKey = word[i - 1] + char;
                if (this.trieDictionary.adjacentKeysSet.has(adjacentKey)) {
                    replaceCost = this.adjacentKeyMultiplier + lastRow[i - 1];
                }
            }

            newRow[i] = Math.min(insertCost, deleteCost, replaceCost);
        }

        return newRow;
    }

    /**
     * Check if a word should skip autocorrect
     * Returns true for numbers, symbols, all-caps words, etc.
     */
    shouldSkipAutocorrect(word) {
        if (!word || word.length === 0) return true;

        // Skip if contains numbers
        if (/\d/.test(word)) {
            return true;
        }

        // Skip if contains special symbols (except apostrophes which are valid in words)
        if (/[^a-zA-Z']/.test(word)) {
            return true;
        }

        // Skip if all caps (2+ letters) - likely an acronym
        if (word.length >= 2 && word === word.toUpperCase()) {
            return true;
        }

        return false;
    }

    /**
     * Find closest word correction (used for actual autocorrect)
     * Uses incremental state if available, otherwise returns original word
     */
    findClosestWord(word) {
        // Skip autocorrect for special cases
        if (this.shouldSkipAutocorrect(word)) {
            return word;
        }

        const lowerWord = word.toLowerCase();

        // Check for exact override matches first (highest priority)
        if (this.correctionOverrides[lowerWord]) {
            return this.preserveCapitalization(word, this.correctionOverrides[lowerWord]);
        }

        if (this.hasWord(lowerWord)) {
            return word;
        }

        // Use incremental correction (built up during typing)
        if (this.trieDictionary) {
            const correction = this.getIncrementalCorrection(lowerWord);
            if (correction && correction !== lowerWord) {
                return this.preserveCapitalization(word, correction);
            }
        }

        // No correction found - return original word
        // NOTE: We don't fall back to expensive full search here because:
        // 1. If incremental state was maintained during typing, we already have the best answer
        // 2. If not, a full search would block the UI for long/mistyped words
        // 3. The incremental approach is the primary path now
        return word;
    }

    /**
     * Find closest word for preview (optimized for real-time use)
     */
    findClosestWordForPreview(word) {
        const lowerWord = word.toLowerCase();

        // Check for exact override matches first (highest priority)
        if (this.correctionOverrides[lowerWord]) {
            return this.correctionOverrides[lowerWord].toLowerCase(); // Return lowercase for preview
        }

        // Use the same logic as findClosestWord for consistency
        return this.findClosestWord(word).toLowerCase();
    }

    /**
     * Process text for autocorrection
     * Returns object with { corrected: boolean, originalText: string, correctedText: string }
     */
    processText(text, options = {}) {
        const preservePunctuation = options.preservePunctuation !== false;
        const words = this.extractWords(text);

        if (words.length === 0) {
            return { corrected: false, originalText: text, correctedText: text };
        }

        // For now, just process the last word (maintaining current behavior)
        const lastWord = words[words.length - 1];
        const correction = this.findClosestWord(lastWord);

        if (correction !== lastWord) {
            // Simple replacement for now - can be enhanced for full text processing
            const correctedText = text.replace(new RegExp(lastWord + '$'), correction);
            return {
                corrected: true,
                originalText: text,
                correctedText: correctedText,
                originalWord: lastWord,
                correctedWord: correction
            };
        }

        return { corrected: false, originalText: text, correctedText: text };
    }

    /**
     * Get singular form of a potential plural word
     */
    getSingularForm(word) {
        const lowerWord = word.toLowerCase();

        // Try -ies -> -y (berries -> berry)
        if (lowerWord.endsWith('ies') && lowerWord.length > 4) {
            const singular = lowerWord.slice(0, -3) + 'y';
            if (this.dictionarySet.has(singular)) {
                return singular;
            }
        }

        // Try -es -> -e (boxes -> box, but not roses -> ros)
        if (lowerWord.endsWith('es') && lowerWord.length > 3) {
            const singular = lowerWord.slice(0, -2);
            if (this.dictionarySet.has(singular)) {
                return singular;
            }
            // Also try removing just -s (roses -> rose)
            const singularS = lowerWord.slice(0, -1);
            if (this.dictionarySet.has(singularS)) {
                return singularS;
            }
        }

        // Try -s -> nothing (cats -> cat)
        if (lowerWord.endsWith('s') && lowerWord.length > 2) {
            const singular = lowerWord.slice(0, -1);
            if (this.dictionarySet.has(singular)) {
                return singular;
            }
        }

        return null;
    }

    /**
     * Check if a word is in the dictionary (including plural and possessive forms)
     */
    hasWord(word) {
        const lowerWord = word.toLowerCase();

        // Check exact match first
        if (this.dictionarySet.has(lowerWord)) {
            return true;
        }

        // Check if it's a possessive form (word's or words')
        if (lowerWord.includes("'")) {
            // Handle possessives: mark's -> mark, james's -> james, dogs' -> dogs
            const withoutApostrophe = lowerWord.replace(/'s$/, '').replace(/'$/, '');

            if (this.dictionarySet.has(withoutApostrophe)) {
                return true; // Base word exists
            }

            // Check if it's a possessive plural (dogs' -> dog)
            const singularOfPossessive = this.getSingularForm(withoutApostrophe);
            if (singularOfPossessive) {
                return true;
            }
        }

        // Check if it's a valid plural form
        const singularForm = this.getSingularForm(lowerWord);
        return singularForm !== null;
    }

    /**
     * Get statistics about the autocorrect engine
     */
    getStats() {
        return {
            dictionarySize: this.dictionary.length,
            cacheSize: this.correctionCache.size,
            maxEditDistance: this.maxEditDistance,
            hasTrieDictionary: !!this.trieDictionary,
            keyboardNeighborsCount: Object.keys(this.keyboardNeighbors).length
        };
    }

    /**
     * Performance measurement: Count how many Levenshtein calculations would be needed
     * with and without TrieDictionary optimization
     */
    measurePerformanceForWord(word) {
        const lowerWord = word.toLowerCase();

        // Without optimization: would check entire dictionary
        const bruteForceCount = this.dictionary.length;

        // With optimization: only check trie candidates
        let trieCount = 0;
        if (this.trieDictionary) {
            const candidates = this.trieDictionary.search(lowerWord, this.maxEditDistance);
            trieCount = candidates.length;
        }

        return {
            word: word,
            bruteForceCalculations: bruteForceCount,
            trieCalculations: trieCount,
            improvement: bruteForceCount > 0 ? (bruteForceCount / Math.max(trieCount, 1)) : 1
        };
    }

    /**
     * Clear correction cache
     */
    clearCache() {
        this.correctionCache.clear();
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutocorrectEngine;
} else if (typeof window !== 'undefined') {
    window.AutocorrectEngine = AutocorrectEngine;
}
