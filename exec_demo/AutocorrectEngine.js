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

        // Cache for expensive operations
        this.correctionCache = new Map();
        this.maxCacheSize = 1000;

        // Common typo correction overrides - these get checked first for instant corrections
        this.correctionOverrides = options.correctionOverrides || {
            'teh': 'the',
            'tehm': 'them',
            'tehn': 'then',
            'adn': 'and',
            'nad': 'and',
            'cna': 'can',
            'nac': 'can',
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
            'wont': 'won\'t',
            'cant': 'can\'t',
            'didnt': 'didn\'t',
            'hasnt': 'hasn\'t',
            'isnt': 'isn\'t',
            'werent': 'weren\'t',
            'wouldnt': 'wouldn\'t',
            'shouldnt': 'shouldn\'t'
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
        if (typeof TrieDictionary !== 'undefined') {
            this.trieDictionary = new TrieDictionary(this.adjacentKeyMultiplier, this.dictionary);
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

        if (this.dictionarySet.has(part)) return part;

        // For very short words, be more conservative about corrections
        if (part.length < 2) return null;

        // Check cache first
        if (this.correctionCache.has(part)) {
            return this.correctionCache.get(part);
        }

        let result = null;
        let bestMatch = null;
        let bestDistance = Infinity;

        // REQUIRE TrieDictionary for performance - fail hard if not available
        if (!this.trieDictionary) {
            throw new Error('TrieDictionary is required for performance. Cannot proceed with brute force approach.');
        }

        // Get candidates from trie - this should return a small set (50-200 words)
        // instead of checking all 9,919 words
        const candidates = this.trieDictionary.search(part, this.maxEditDistance);


        let bestFrequencyScore = Infinity;

        // Now only run expensive Levenshtein on the small candidate set
        for (const candidate of candidates) {
            const candidateWord = candidate.word;
            const cost = this.levenshteinCost(part, candidateWord);
            const frequencyScore = this.getWordFrequencyScore(candidateWord);

            // Prefer lower cost first, then lower frequency score (more common words) as tiebreaker
            if (cost <= this.maxEditDistance &&
                (cost < bestDistance || (cost === bestDistance && frequencyScore < bestFrequencyScore))) {
                bestDistance = cost;
                bestFrequencyScore = frequencyScore;
                bestMatch = candidateWord;
            }
        }
        result = bestMatch;

        // Cache the result (limit cache size to prevent memory issues)
        if (this.correctionCache.size > this.maxCacheSize) {
            this.correctionCache.clear();
        }
        this.correctionCache.set(part, result);

        return result;
    }

    /**
     * Calculate distance for two-word split
     */
    getTwoWordSplitDistance(word) {
        const lowerWord = word.toLowerCase();
        let bestDistance = Infinity;

        for (let i = 2; i <= lowerWord.length - 2; i++) {
            const firstPart = lowerWord.substring(0, i);
            const secondPart = lowerWord.substring(i);

            if (this.dictionarySet.has(firstPart) && this.dictionarySet.has(secondPart)) {
                return 1;
            }

            const firstCorrected = this.findBestCorrectionForPart(firstPart);
            const secondCorrected = this.findBestCorrectionForPart(secondPart);

            if (firstCorrected && secondCorrected) {
                const totalDistance = this.levenshteinCost(firstPart, firstCorrected) +
                                    this.levenshteinCost(secondPart, secondCorrected) + 1;
                if (totalDistance < bestDistance) bestDistance = totalDistance;
            }
        }

        return bestDistance;
    }

    /**
     * Check if a two-word split would use any override corrections
     */
    splitUsesOverrideCorrection(word) {
        const lowerWord = word.toLowerCase();

        for (let i = 2; i <= lowerWord.length - 2; i++) {
            const firstPart = lowerWord.substring(0, i);
            const secondPart = lowerWord.substring(i);

            // Check if either part would use an override correction
            if (this.correctionOverrides[firstPart] || this.correctionOverrides[secondPart]) {
                return true;
            }
        }

        return false;
    }

    /**
     * Find two-word split for concatenated words
     */
    findTwoWordSplit(word) {
        if (word.length < 4 || this.dictionarySet.has(word.toLowerCase())) return null;

        const lowerWord = word.toLowerCase();
        const isCapitalized = word[0] === word[0].toUpperCase();
        let bestSplit = null;
        let bestScore = Infinity;
        let bestCommonScore = Infinity;

        for (let i = 2; i <= lowerWord.length - 2; i++) {
            const firstPart = lowerWord.substring(0, i);
            const secondPart = lowerWord.substring(i);

            if (this.dictionarySet.has(firstPart) && this.dictionarySet.has(secondPart)) {
                // Perfect match - calculate commonality score for tie-breaking
                const commonScore = this.getWordFrequencyScore(firstPart) + this.getWordFrequencyScore(secondPart);

                if (bestScore > 1 || (bestScore === 1 && commonScore < bestCommonScore)) {
                    bestScore = 1;
                    bestCommonScore = commonScore;
                    const twoWordResult = firstPart + ' ' + secondPart;
                    bestSplit = this.preserveCapitalization(word, twoWordResult);
                }
            }

            const firstCorrected = this.findBestCorrectionForPart(firstPart);
            const secondCorrected = this.findBestCorrectionForPart(secondPart);

            if (firstCorrected && secondCorrected) {
                const totalDistance = this.levenshteinDistance(firstPart, firstCorrected) +
                                    this.levenshteinDistance(secondPart, secondCorrected);

                if (totalDistance <= this.maxEditDistance) {
                    // Calculate commonality score for the corrected words
                    const commonScore = this.getWordFrequencyScore(firstCorrected) + this.getWordFrequencyScore(secondCorrected);

                    // Prefer lower distance first, then lower commonality score as tiebreaker
                    if (totalDistance < bestScore ||
                        (totalDistance === bestScore && commonScore < bestCommonScore)) {
                        bestScore = totalDistance;
                        bestCommonScore = commonScore;
                        const twoWordResult = firstCorrected + ' ' + secondCorrected;
                        bestSplit = this.preserveCapitalization(word, twoWordResult);
                    }
                }
            }
        }

        return bestSplit;
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
     * Find closest word correction (used for actual autocorrect)
     */
    findClosestWord(word) {
        const lowerWord = word.toLowerCase();

        // Check for exact override matches first (highest priority)
        if (this.correctionOverrides[lowerWord]) {
            return this.preserveCapitalization(word, this.correctionOverrides[lowerWord]);
        }

        if (this.dictionarySet.has(lowerWord)) {
            return word;
        }

        // Always use our own best correction logic for more reliable results
        const singleWordCorrection = this.findBestCorrectionForPart(lowerWord);

        if (!singleWordCorrection || singleWordCorrection === word.toLowerCase()) {
            // Try two-word split if single word correction failed
            const twoWordSplit = this.findTwoWordSplit(word);
            if (twoWordSplit) {
                const twoWordDistance = this.getTwoWordSplitDistance(word);
                if (twoWordDistance <= this.maxEditDistance) {
                    return twoWordSplit;
                }
            }
            return word; // No good correction found
        }

        // Check if two-word split is better than single word correction
        const singleWordDistance = this.levenshteinDistance(word.toLowerCase(), singleWordCorrection);
        const twoWordSplit = this.findTwoWordSplit(word);

        if (twoWordSplit) {
            const twoWordDistance = this.getTwoWordSplitDistance(word);

            // Check if the two-word split uses any override corrections
            const usesOverrideCorrection = this.splitUsesOverrideCorrection(word);

            // Check if both words in the split are very common (top 150 words)
            const splitWords = twoWordSplit.toLowerCase().split(' ');
            const bothWordsVeryCommon = splitWords.length === 2 &&
                this.getWordFrequencyScore(splitWords[0]) <= 150 &&
                this.getWordFrequencyScore(splitWords[1]) <= 150;

            if (twoWordDistance <= this.maxEditDistance &&
                (twoWordDistance < singleWordDistance ||
                 (twoWordDistance === singleWordDistance && usesOverrideCorrection) ||
                 (bothWordsVeryCommon && twoWordDistance <= singleWordDistance + 1))) {
                return twoWordSplit;
            }
        }

        // Preserve original capitalization in the single word correction
        return this.preserveCapitalization(word, singleWordCorrection);
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
     * Check if a word is in the dictionary
     */
    hasWord(word) {
        return this.dictionarySet.has(word.toLowerCase());
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
