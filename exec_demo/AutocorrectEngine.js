/**
 * AutocorrectEngine - A comprehensive autocorrect library
 * Provides spell checking, word splitting, and correction suggestions
 */
class AutocorrectEngine {
    constructor(options = {}) {
        this.adjacentKeyMultiplier = options.adjacentKeyMultiplier || 0.4;
        this.maxEditDistance = options.maxEditDistance || 2;
        this.keyboardNeighbors = options.keyboardNeighbors || {};

        // Initialize dictionaries
        this.dictionary = [];
        this.dictionarySet = new Set();
        this.trieDictionary = null;

        // Cache for expensive operations
        this.correctionCache = new Map();
        this.maxCacheSize = 1000;

        // Add base words if provided
        if (options.baseWords) {
            this.addWords(options.baseWords);
        }

        // Initialize TrieDictionary if available
        this.initializeTrieDictionary();
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
     * Calculate Damerau-Levenshtein distance with keyboard-aware substitution costs
     * Supports transpositions which makes "teh" -> "the" distance = 1
     */
    levenshteinDistance(a, b, maxEditDist = null) {
        const maxDist = maxEditDist || this.maxEditDistance;

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
                    const substitutionCost = this.areNeighboringKeys(a[j - 1], b[i - 1]) ? 0.4 : 1.0;

                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + substitutionCost, // substitution
                        matrix[i][j - 1] + 1,                   // insertion
                        matrix[i - 1][j] + 1                    // deletion
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
     * Extract words from text using punctuation and space delimiters
     */
    extractWords(text) {
        return text.toLowerCase().split(/[\s.,!?;:"()]+/).filter(word => word.length > 0);
    }

    /**
     * Find best correction for a word part using cached lookups
     * Made public for testing purposes
     */
    findBestCorrectionForPart(part) {
        if (this.dictionarySet.has(part)) return part;

        // For very short words, be more conservative about corrections
        if (part.length < 2) return null;

        // Check cache first
        if (this.correctionCache.has(part)) {
            return this.correctionCache.get(part);
        }

        let result = null;

        // Always use our own reliable dictionary iteration for accurate results
        // The TrieDictionary may not use the same distance calculation
        let bestMatch = null;
        let bestDistance = Infinity;

        for (const dictWord of this.dictionary) {
            const distance = this.levenshteinDistance(part, dictWord);
            if (distance <= this.maxEditDistance && distance < bestDistance) {
                bestDistance = distance;
                bestMatch = dictWord;
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
                const totalDistance = this.levenshteinDistance(firstPart, firstCorrected) +
                                    this.levenshteinDistance(secondPart, secondCorrected) + 1;
                if (totalDistance < bestDistance) bestDistance = totalDistance;
            }
        }

        return bestDistance;
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

        for (let i = 2; i <= lowerWord.length - 2; i++) {
            const firstPart = lowerWord.substring(0, i);
            const secondPart = lowerWord.substring(i);

            if (this.dictionarySet.has(firstPart) && this.dictionarySet.has(secondPart)) {
                const result = isCapitalized ?
                    firstPart.charAt(0).toUpperCase() + firstPart.slice(1) + ' ' + secondPart :
                    firstPart + ' ' + secondPart;
                return result;
            }

            const firstCorrected = this.findBestCorrectionForPart(firstPart);
            const secondCorrected = this.findBestCorrectionForPart(secondPart);

            if (firstCorrected && secondCorrected) {
                const totalDistance = this.levenshteinDistance(firstPart, firstCorrected) +
                                    this.levenshteinDistance(secondPart, secondCorrected);

                if (totalDistance <= this.maxEditDistance && totalDistance < bestScore) {
                    bestScore = totalDistance;
                    bestSplit = isCapitalized ?
                        firstCorrected.charAt(0).toUpperCase() + firstCorrected.slice(1) + ' ' + secondCorrected :
                        firstCorrected + ' ' + secondCorrected;
                }
            }
        }

        return bestSplit;
    }

    /**
     * Find closest word correction (used for actual autocorrect)
     */
    findClosestWord(word) {
        if (this.dictionarySet.has(word.toLowerCase())) return word;

        // Always use our own best correction logic for more reliable results
        const singleWordCorrection = this.findBestCorrectionForPart(word.toLowerCase());

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
            if (twoWordDistance <= this.maxEditDistance && twoWordDistance < singleWordDistance) {
                return twoWordSplit;
            }
        }

        return singleWordCorrection;
    }

    /**
     * Find closest word for preview (optimized for real-time use)
     */
    findClosestWordForPreview(word) {
        // Use the same logic as findClosestWord for consistency
        return this.findClosestWord(word);
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