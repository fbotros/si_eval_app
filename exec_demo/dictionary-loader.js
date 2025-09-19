/**
 * Dictionary Loader - Dynamically loads dictionary from text file
 * Replaces the static shared-dictionary.js approach
 */

let sharedDictionary = [];
let dictionaryLoaded = false;
let dictionaryLoadPromise = null;

/**
 * Load dictionary from text file
 * Returns a promise that resolves with the loaded dictionary array
 */
async function loadDictionary() {
    if (dictionaryLoaded) {
        return sharedDictionary;
    }

    // If already loading, return the existing promise
    if (dictionaryLoadPromise) {
        return dictionaryLoadPromise;
    }

    dictionaryLoadPromise = (async () => {
        try {
            console.log('Loading dictionary from comprehensive_dictionary.txt...');
            const response = await fetch('./comprehensive_dictionary.txt');

            if (!response.ok) {
                throw new Error(`Failed to load dictionary: ${response.status} ${response.statusText}`);
            }

            const text = await response.text();

            // Split by lines and filter out empty lines
            sharedDictionary = text
                .split('\n')
                .map(word => word.trim().toLowerCase())
                .filter(word => word.length > 0);

            dictionaryLoaded = true;
            console.log(`Dictionary loaded successfully: ${sharedDictionary.length} words`);

            return sharedDictionary;

        } catch (error) {
            console.error('Failed to load dictionary:', error);

            // Fallback to a minimal dictionary
            sharedDictionary = [
                'the', 'and', 'to', 'a', 'of', 'in', 'is', 'you', 'that', 'it',
                'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they',
                'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had',
                'by', 'word', 'but', 'not', 'what', 'all', 'were', 'we', 'when',
                'your', 'can', 'said', 'there', 'each', 'which', 'she', 'do',
                'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out',
                'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would',
                'make', 'like', 'into', 'him', 'time', 'has', 'two', 'more',
                'very', 'after', 'words', 'long', 'than', 'first', 'been',
                'call', 'who', 'its', 'now', 'find', 'could', 'made', 'may',
                'down', 'side', 'did', 'get', 'come', 'way', 'use', 'man',
                'new', 'write', 'our', 'me', 'right', 'see', 'him', 'two',
                'how', 'its', 'our', 'out', 'day', 'had', 'his', 'her',
                'old', 'see', 'now', 'way', 'who', 'boy', 'did', 'its',
                'let', 'put', 'end', 'why', 'try', 'kind', 'hand', 'picture',
                'again', 'change', 'off', 'play', 'spell', 'air', 'away',
                'animal', 'house', 'point', 'page', 'letter', 'mother',
                'answer', 'found', 'study', 'still', 'learn', 'should',
                'america', 'world', 'high', 'every', 'near', 'add', 'food',
                'between', 'own', 'below', 'country', 'plant', 'last',
                'school', 'father', 'keep', 'tree', 'never', 'start',
                'city', 'earth', 'eye', 'light', 'thought', 'head', 'under',
                'story', 'saw', 'left', 'dont', 'few', 'while', 'along',
                'might', 'close', 'something', 'seem', 'next', 'hard',
                'open', 'example', 'begin', 'life', 'always', 'those',
                'both', 'paper', 'together', 'got', 'group', 'often',
                'run', 'important', 'until', 'children', 'side', 'feet',
                'car', 'mile', 'night', 'walk', 'white', 'sea', 'began',
                'grow', 'took', 'river', 'four', 'carry', 'state', 'once',
                'book', 'hear', 'stop', 'without', 'second', 'later',
                'miss', 'idea', 'enough', 'eat', 'face', 'watch', 'far',
                'indian', 'really', 'almost', 'let', 'above', 'girl',
                'sometimes', 'mountain', 'cut', 'young', 'talk', 'soon',
                'list', 'song', 'being', 'leave', 'family', 'its',

                // Add common typing test words
                'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
                'jumped', 'walking', 'running', 'typing', 'test', 'practice'
            ];

            dictionaryLoaded = true;
            console.log(`Using fallback dictionary: ${sharedDictionary.length} words`);

            return sharedDictionary;
        }
    })();

    return dictionaryLoadPromise;
}

/**
 * Get dictionary (loads if not already loaded)
 * Returns a promise that resolves with the dictionary array
 */
async function getDictionary() {
    return await loadDictionary();
}

/**
 * Check if dictionary is already loaded
 */
function isDictionaryLoaded() {
    return dictionaryLoaded;
}

/**
 * Get dictionary synchronously (only if already loaded)
 * Returns empty array if not loaded yet
 */
function getDictionarySync() {
    return dictionaryLoaded ? sharedDictionary : [];
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadDictionary,
        getDictionary,
        isDictionaryLoaded,
        getDictionarySync,
        get sharedDictionary() { return sharedDictionary; }
    };
} else if (typeof window !== 'undefined') {
    window.loadDictionary = loadDictionary;
    window.getDictionary = getDictionary;
    window.isDictionaryLoaded = isDictionaryLoaded;
    window.getDictionarySync = getDictionarySync;

    // For backward compatibility
    window.sharedDictionary = sharedDictionary;
}
