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
            
            // Smart path detection - determine likely path based on current location
            const currentPath = window.location.pathname;
            let possiblePaths;
            
            if (currentPath.includes('/typing_test/') || currentPath.includes('/document_editor/')) {
                // We're in a subdirectory, try parent directory first
                possiblePaths = [
                    '../comprehensive_dictionary.txt',     // Most likely for subdirectories
                    './comprehensive_dictionary.txt'       // Fallback
                ];
            } else {
                // We're likely in the main exec_demo directory
                possiblePaths = [
                    './comprehensive_dictionary.txt',      // Most likely for main directory
                    '../comprehensive_dictionary.txt'      // Fallback
                ];
            }
            
            let response;
            let lastError;
            
            for (const path of possiblePaths) {
                try {
                    // Only log the attempt if it's the first path (most likely to succeed)
                    if (path === possiblePaths[0]) {
                        console.log(`Loading dictionary from: ${path}`);
                    }
                    
                    response = await fetch(path);
                    if (response.ok) {
                        console.log(`✅ Dictionary loaded from: ${path}`);
                        break;
                    } else {
                        lastError = `${response.status} ${response.statusText}`;
                        // Only log the failure if this was our best guess
                        if (path === possiblePaths[0]) {
                            console.log(`Trying alternative path...`);
                        }
                    }
                } catch (error) {
                    lastError = error.message;
                    // Only log the failure if this was our best guess  
                    if (path === possiblePaths[0]) {
                        console.log(`Trying alternative path...`);
                    }
                }
            }

            if (!response || !response.ok) {
                throw new Error(`Failed to load dictionary from all paths. Last error: ${response ? response.status + ' ' + response.statusText : 'No response'}`);
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
            console.error('Critical Error: Failed to load dictionary:', error);
            
            // FAIL HARD - no fallback dictionary since TrieDictionary requires proper dictionary
            throw new Error(`Dictionary loading failed and no fallback is allowed for performance. Error: ${error.message}`);
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
