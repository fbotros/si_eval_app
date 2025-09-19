// JavaScript implementation of TrieDictionary based on the C++ version from nimble
// This provides efficient autocorrection with trie-based search and keyboard-aware edit distance

class TrieNode {
    constructor() {
        this.children = new Map();
        this.word = '';
    }
}

class TrieDictionary {
    constructor(adjacentKeyMultiplier = 0.4, words = []) {
        this.adjacentKeyMultiplier = adjacentKeyMultiplier;
        this.root = new TrieNode();
        this.adjacentKeysSet = new Set();

        // Initialize adjacent keys set from keyboard layout
        this.initializeAdjacentKeys();

        // Insert all words if provided
        for (const word of words) {
            this.insert(word);
        }
    }

    initializeAdjacentKeys() {
        // Use the global keyboardNeighbors from keyboard-layout.js
        if (typeof keyboardNeighbors !== 'undefined') {
            for (const [char, neighbors] of Object.entries(keyboardNeighbors)) {
                for (const neighbor of neighbors) {
                    this.adjacentKeysSet.add(char + neighbor);
                }
            }
        }
    }

    insert(word) {
        const lowercaseWord = word.toLowerCase();
        let node = this.root;

        for (const char of lowercaseWord) {
            if (!node.children.has(char)) {
                node.children.set(char, new TrieNode());
            }
            node = node.children.get(char);
        }

        node.word = lowercaseWord;
    }

    contains(word) {
        const lowercaseWord = word.toLowerCase();
        let node = this.root;

        for (const char of lowercaseWord) {
            if (!node.children.has(char)) {
                return false;
            }
            node = node.children.get(char);
        }

        return node.word === lowercaseWord;
    }

    search(word, maxEditDist = 2) {
        const results = [];
        const lowercaseWord = word.toLowerCase();
        const sz = lowercaseWord.length;

        // Initialize first row of edit distance matrix
        const currentRow = new Array(sz + 1);
        for (let i = 0; i <= sz; i++) {
            currentRow[i] = i;
        }

        // Start search from root's children
        for (const [char, node] of this.root.children) {
            this.searchImpl(node, char, currentRow, lowercaseWord, maxEditDist, results);
        }

        return results;
    }

    searchImpl(node, char, lastRow, word, maxEditDist, results) {
        const sz = lastRow.length;

        if (sz === 0) {
            return;
        }

        const currentRow = new Array(sz);
        currentRow[0] = lastRow[0] + 1;

        // Calculate the min cost of insertion, deletion, match or substitution
        for (let i = 1; i < sz; i++) {
            const insertCondition = 1.0 + currentRow[i - 1];
            const deleteCondition = 1.0 + lastRow[i];
            let replaceCondition = lastRow[i - 1];

            if (word[i - 1] !== char) {
                replaceCondition = 1.0 + lastRow[i - 1];

                // Check if characters are adjacent keys for reduced edit distance
                const adjacentKey = word[i - 1] + char;
                if (this.adjacentKeysSet.has(adjacentKey)) {
                    replaceCondition = this.adjacentKeyMultiplier + lastRow[i - 1];
                }
            }

            currentRow[i] = Math.min(insertCondition, deleteCondition, replaceCondition);
        }

        // If we found a complete word within edit distance, add to results
        if (currentRow[sz - 1] <= maxEditDist && node.word.length > 0) {
            results.push({
                word: node.word,
                editDistance: currentRow[sz - 1]
            });
        }

        // Continue search if any value in current row is within maxEditDist
        // More efficient than Math.min(...currentRow) for large arrays
        let minInRow = currentRow[0];
        for (let i = 1; i < currentRow.length; i++) {
            if (currentRow[i] < minInRow) {
                minInRow = currentRow[i];
            }
        }

        if (minInRow <= maxEditDist) {
            for (const [nextChar, childNode] of node.children) {
                this.searchImpl(childNode, nextChar, currentRow, word, maxEditDist, results);
            }
        }
    }

    // Find the closest word with minimum edit distance
    findClosestWord(word) {
        // If the word is already in the dictionary, return it
        if (this.contains(word)) {
            return word;
        }

        const candidates = this.search(word, 2);

        if (candidates.length === 0) {
            return word; // No correction found
        }

        // Find best match without full sort (more efficient for single result)
        let bestCandidate = candidates[0];
        for (let i = 1; i < candidates.length; i++) {
            const candidate = candidates[i];
            if (candidate.editDistance < bestCandidate.editDistance ||
                (candidate.editDistance === bestCandidate.editDistance &&
                 candidate.word.length < bestCandidate.word.length)) {
                bestCandidate = candidate;
            }
        }

        return bestCandidate.word;
    }

    // Get word candidates with their edit distances (similar to C++ version)
    getWordCandidates(word, maxEditDist = 2) {
        const candidates = this.search(word, maxEditDist);

        // Sort by edit distance for consistent results
        candidates.sort((a, b) => a.editDistance - b.editDistance);

        // Return in format compatible with existing code [word, distance]
        return candidates.map(candidate => [candidate.word, candidate.editDistance]);
    }
}
