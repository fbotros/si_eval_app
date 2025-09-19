// Keyboard neighbors are loaded from ../keyboard-layout.js

// Check if keyboard layout is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (typeof keyboardNeighbors === 'undefined') {
        console.error('keyboardNeighbors not loaded! Check if keyboard-layout.js is loading correctly.');
    }
});

// Typing test prompts will be loaded from prompts.txt
let prompts = [];

// Base dictionary of common words
const baseDictionary = [
    'a', 'an', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against',
    'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'any', 'both', 'each', 'few', 'more', 'most', 'some', 'other', 'have',
    'has', 'had', 'do', 'does', 'did', 'but', 'if', 'or', 'because', 'until',
    'while', 'of', 'this', 'these', 'those', 'am', 'are', 'was', 'were',
    'nation', 'stability', 'rectangular', 'objects', 'sides', 'silly', 'questions',
    'learn', 'walk', 'run', 'important', 'news', 'always', 'seems', 'late',
    'quick', 'brown', 'fox', 'jumps', 'lazy', 'dog', 'steep', 'learning',
    'curve', 'riding', 'unicycle', 'discreet', 'meeting', 'raindrops', 'falling',
    'head', 'excellent', 'communicate', 'how', 'are', 'you', 'doing', 'today',
    'fine', 'thank', 'very', 'much', 'whats', 'with', 'lately', 'not',
    'just', 'hanging', 'out', 'hello', 'world', 'test', 'the', 'that',
    'can', 'we'
];

let dictionary = [...baseDictionary];
let dictionarySet = new Set(dictionary);
let trieDictionary = null;

// Fisher-Yates shuffle algorithm to randomize array
function shuffleArray(array) {
    const shuffled = [...array]; // Create a copy to avoid mutating the original
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Function to shuffle the current prompts array
function shufflePrompts() {
    prompts = shuffleArray(prompts);
}

// Function to load prompts from prompts.txt file
async function loadPrompts() {
    try {
        const response = await fetch('./conversational_easy.txt');
        if (!response.ok) {
            throw new Error(`Failed to load conversational_easy.txt: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        prompts = text
            .split('\n')
            .map(prompt => prompt.trim())
            .filter(prompt => prompt.length > 0);

        // Shuffle the prompts array to randomize order
        shufflePrompts();


        if (prompts.length === 0) {
            throw new Error('conversational_easy.txt file is empty or contains no valid prompts');
        }
    } catch (error) {
        console.error('Error loading conversational_easy.txt:', error.message);
        alert(`Error: Could not load prompts from conversational_easy.txt file.\n\n${error.message}\n\nPlease ensure the prompts.txt file exists and is accessible.`);
        throw error;
    }
}

// Combined function to initialize dictionary with base words, prompt words, and common words from file
async function initializeDictionary() {
    // Start with base dictionary
    dictionary = [...baseDictionary];
    dictionarySet = new Set(dictionary);

    // Add words from prompts
    prompts.forEach(prompt => {
        const words = extractWords(prompt);
        words.forEach(word => {
            if (!dictionarySet.has(word)) {
                dictionary.push(word);
                dictionarySet.add(word);
            }
        });
    });

    // Load common words from file
    try {
        const response = await fetch('./common_words.txt');
        if (!response.ok) {
            return;
        }
        const text = await response.text();
        const commonWords = text
            .split('\n')
            .map(word => word.trim().toLowerCase())
            .filter(word => word.length > 0 && !dictionarySet.has(word));

        // Add new words to dictionary
        commonWords.forEach(word => {
            dictionary.push(word);
            dictionarySet.add(word);
        });

    } catch (error) {
    }

    // Initialize TrieDictionary with all words
    trieDictionary = new TrieDictionary(0.4, dictionary);

}

let currentPromptIndex = 0;
let testActive = false;
let promptResults = [];
let startTime = 0;
let endTime = 0;
let promptTimingStarted = false;

// Autocorrect tracking variables
let keyPressCount = 0;
let correctedErrorCount = 0;
let previousInputValue = '';
let lastWordCorrected = false;
let suppressAutocorrect = false;

// Cache the last tooltip suggestion to avoid re-computation
let lastTooltipSuggestion = null;
let lastTooltipWord = null;

// Simple autocorrect suppression: if user backspaces, suppress until they type 2+ new chars
let charsTypedSinceLastBackspace = 0;

const sampleTextElement = document.getElementById('sample-text');
const currentPromptElement = document.getElementById('current-prompt');
const inputArea = document.getElementById('input-area');
const results = document.getElementById('results');
const wpmElement = document.getElementById('wpm');
const accuracyElement = document.getElementById('accuracy');
const leaderboardList = document.getElementById('leaderboard-list');
const restartButtonFinal = document.getElementById('restart-button-final');
const autocorrectTooltip = document.getElementById('autocorrect-tooltip');
const correctionText = document.getElementById('correction-text');

// Initialize the first prompt
function initializeTest() {
    currentPromptIndex = 0;
    promptResults = [];
    testActive = false;
    promptTimingStarted = false;
    updateCurrentPrompt();
    inputArea.value = '';
    inputArea.disabled = false;
    results.style.display = 'none';
    inputArea.focus();
}

function updateCurrentPrompt() {
    currentPromptElement.textContent = currentPromptIndex + 1;
    sampleTextElement.innerText = prompts[currentPromptIndex];
}

function startTest() {
    if (testActive) return;
    testActive = true;
    promptTimingStarted = false;
}

// Function to check if two characters are neighbors on the keyboard
function areNeighboringKeys(char1, char2) {
    const c1 = char1.toLowerCase();
    const c2 = char2.toLowerCase();

    if (c1 === c2) return false;

    // Check if keyboardNeighbors is available
    if (typeof keyboardNeighbors === 'undefined') {
        return false;
    }

    return keyboardNeighbors[c1] && keyboardNeighbors[c1].includes(c2);
}

// Calculate Levenshtein distance between two strings with keyboard-aware substitution costs
function levenshteinDistance(a, b, maxEditDist = 2) {
    if (a.length === 0) return b.length > maxEditDist ? maxEditDist + 1 : b.length;
    if (b.length === 0) return a.length > maxEditDist ? maxEditDist + 1 : a.length;

    // Early exit if length difference exceeds maxEditDist
    if (Math.abs(a.length - b.length) > maxEditDist) {
        return maxEditDist + 1;
    }

    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        let minInRow = Infinity;

        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                // Calculate substitution cost based on keyboard proximity
                const char1 = a.charAt(j - 1);
                const char2 = b.charAt(i - 1);
                const substitutionCost = areNeighboringKeys(char1, char2) ? 0.4 : 1.0;

                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + substitutionCost, // substitution with keyboard-aware cost
                    matrix[i][j - 1] + 1,                   // insertion
                    matrix[i - 1][j] + 1                    // deletion
                );
            }

            // Track minimum value in current row
            minInRow = Math.min(minInRow, matrix[i][j]);
        }

        // Early stopping: if all values in current row exceed maxEditDist, we can stop
        if (minInRow > maxEditDist) {
            return maxEditDist + 1;
        }
    }

    return matrix[b.length][a.length];
}

// Find the closest word in the dictionary (original logic for actual autocorrect)
function findClosestWord(word) {
    // If the word is already in the dictionary, return it (using Set for O(1) lookup)
    if (dictionarySet.has(word)) {
        return word;
    }

    // First check for two-word splits (higher priority than single-word corrections)
    const twoWordSplit = findTwoWordSplit(word);
    if (twoWordSplit) {
        return twoWordSplit;
    }

    let closestWord = null;
    let minDistance = Infinity;

    // Find words with edit distance of up to 2
    for (const dictWord of dictionary) {
        const distance = levenshteinDistance(word, dictWord);

        // Consider words with edit distance of 1 or 2
        if (distance <= 2 && distance < minDistance) {
            minDistance = distance;
            closestWord = dictWord;
        }
    }

    // Return the closest word if found, otherwise return the original word
    return closestWord || word;
}

// Separate function for tooltip preview using TrieDictionary (faster for real-time)
function findClosestWordForPreview(word) {
    // First check for two-word splits (higher priority than single-word corrections)
    const twoWordSplit = findTwoWordSplit(word);
    if (twoWordSplit) {
        return twoWordSplit;
    }

    // Fallback to single-word correction
    return trieDictionary.findClosestWord(word);
}

// Function to extract words from a string
function extractWords(text) {
    // Split by punctuation and spaces
    return text.toLowerCase()
        .split(/[\s.,!?;:"()]+/)
        .filter(word => word.length > 0);
}

// Two-word splitting system: detect concatenated words and split them
function findTwoWordSplit(word) {
    // Skip very short words or words already in dictionary
    if (word.length < 4 || dictionarySet.has(word.toLowerCase())) {
        return null;
    }

    const lowerWord = word.toLowerCase();

    // Try splitting at each position (leaving at least 2 chars for each part)
    for (let i = 2; i <= lowerWord.length - 2; i++) {
        const firstPart = lowerWord.substring(0, i);
        const secondPart = lowerWord.substring(i);

        // Check if both parts are valid dictionary words
        if (dictionarySet.has(firstPart) && dictionarySet.has(secondPart)) {
            // Preserve original capitalization pattern
            let result;
            if (word[0] === word[0].toUpperCase()) {
                // If original was capitalized, capitalize first word
                result = firstPart.charAt(0).toUpperCase() + firstPart.slice(1) + ' ' + secondPart;
            } else {
                result = firstPart + ' ' + secondPart;
            }
            return result;
        }
    }

    return null; // No valid split found
}

// Autocorrect tooltip functions
function getCurrentIncompleteWord() {
    const currentValue = inputArea.value;
    if (!currentValue) return '';

    // Split by spaces and get the last word (currently being typed)
    const words = currentValue.split(/\s+/);
    const lastWord = words[words.length - 1];

    // Remove any trailing punctuation for correction checking
    return lastWord.replace(/[.,!?;:"()]+$/, '');
}

function getCaretPosition() {
    const element = inputArea;
    const position = element.selectionStart;

    // Create mirror div to measure text position
    const div = document.createElement('div');
    const computed = getComputedStyle(element);

    // Copy essential styles that affect text layout
    const properties = [
        'width', 'height', 'overflowY', 'overflowX',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'fontSize', 'fontFamily', 'fontWeight', 'lineHeight',
        'letterSpacing', 'wordSpacing', 'textIndent', 'textAlign',
        'boxSizing', 'borderTopWidth', 'borderRightWidth',
        'borderBottomWidth', 'borderLeftWidth'
    ];

    properties.forEach(prop => {
        div.style[prop] = computed[prop];
    });

    // Position off-screen
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.top = '-9999px';
    div.style.left = '-9999px';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';

    document.body.appendChild(div);

    // Add text up to caret position
    const textBeforeCaret = element.value.substring(0, position);
    div.textContent = textBeforeCaret;

    // Add a span to mark where caret would be
    const span = document.createElement('span');
    span.textContent = '|';
    div.appendChild(span);

    // Get the span position
    const coordinates = {
        top: span.offsetTop,
        left: span.offsetLeft
    };

    document.body.removeChild(div);

    // Convert to viewport coordinates
    const elementRect = element.getBoundingClientRect();
    const x = elementRect.left + coordinates.left - element.scrollLeft;
    const y = elementRect.top + coordinates.top - element.scrollTop;

    return { x, y };
}

function showAutocorrectTooltip(originalWord, correctedWord) {
    if (originalWord === correctedWord) {
        hideAutocorrectTooltip();
        return;
    }

    // Cache the suggestion for use in actual autocorrect
    lastTooltipWord = originalWord.toLowerCase();
    lastTooltipSuggestion = correctedWord;

    // Set only the corrected word as tooltip content
    correctionText.textContent = correctedWord;

    // Position tooltip above and to the left of the caret
    // Use setTimeout to ensure DOM is updated after keystroke
    setTimeout(() => {
        const caretPos = getCaretPosition();
        autocorrectTooltip.style.position = 'fixed';
        autocorrectTooltip.style.visibility = 'hidden';
        autocorrectTooltip.style.display = 'block';

        // Get tooltip width to position it to the left of cursor
        const tooltipRect = autocorrectTooltip.getBoundingClientRect();
        autocorrectTooltip.style.left = (caretPos.x - tooltipRect.width + 10) + 'px';

        // Use line height to calculate vertical offset
        const computedStyle = window.getComputedStyle(inputArea);
        const lineHeight = parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2;
        autocorrectTooltip.style.top = (caretPos.y - lineHeight - 10) + 'px';
        autocorrectTooltip.style.zIndex = '10000';
        autocorrectTooltip.style.visibility = 'visible';
    }, 0);

    // Show tooltip with animation
    autocorrectTooltip.classList.add('show');
}

function hideAutocorrectTooltip() {
    autocorrectTooltip.classList.remove('show');
    // Clear cached suggestion when tooltip is hidden
    lastTooltipWord = null;
    lastTooltipSuggestion = null;
}

// Simple autocorrect suppression logic
function shouldSuppressAutocorrect() {
    return charsTypedSinceLastBackspace < 2;
}

// Generic function to trigger autocorrect (works for any terminating character)
function triggerAutocorrect(terminatingChar = ' ') {
    if (lastWordCorrected) return false;

    hideAutocorrectTooltip();

    // Check suppression using current counter
    const shouldSuppress = shouldSuppressAutocorrect();

    // Reset counter after word termination (new word starts)
    charsTypedSinceLastBackspace = 0;

    // Apply suppression logic
    if (suppressAutocorrect) {
        suppressAutocorrect = false;
        return false;
    } else if (!shouldSuppress) {
        // Get the current input value before the terminating character
        const currentText = inputArea.value;
        // Remove the terminating character from the end for autocorrect processing
        const textForCorrection = currentText.endsWith(terminatingChar)
            ? currentText.slice(0, -1)
            : currentText;

        return performAutocorrect(textForCorrection, terminatingChar);
    }

    return false;
}


// Autocorrect function
function performAutocorrect(currentText, appendChar) {
    try {
        const text = currentText;
        if (text.length > 0 && appendChar.length == 1) {

            let words = text.trim().split(/\s+/);

            // filter out empty strings
            words = words.filter(word => word.length > 0);
            if (words.length === 0) return false;

            const originalLastWord = words[words.length - 1];

            // if last char of last word ends in punctuation, return false
            if(/[\s.,.!?;:"()]/.test(originalLastWord.slice(-1))) return false;

            // Check if the original word is capitalized (first character only)
            const isCapitalized = originalLastWord.length > 0 &&
                                originalLastWord[0] >= 'A' && originalLastWord[0] <= 'Z';

            const lastWord = originalLastWord.toLowerCase();

            // Skip very short words (1-2 characters)
            if (lastWord.length > 2) {
                let correctedWord;

                // Use cached suggestion if available and matches current word
                if (lastTooltipWord === lastWord && lastTooltipSuggestion) {
                    correctedWord = lastTooltipSuggestion;
                } else {
                    // Fallback to computing the correction
                    correctedWord = findClosestWord(lastWord);
                }

                // If a correction was found and it's different from the original word
                if (correctedWord !== originalLastWord.toLowerCase() && correctedWord !== lastWord) {
                    // Capitalize the corrected word if the original word was capitalized
                    const finalCorrectedWord = isCapitalized ?
                        correctedWord.charAt(0).toUpperCase() + correctedWord.slice(1) :
                        correctedWord;

                    // Replace the last word with the corrected one
                    const lastIndex = text.lastIndexOf(originalLastWord);
                    if (lastIndex !== -1) {
                        const newText = text.substring(0, lastIndex) + finalCorrectedWord;

                        // Direct update approach for better cross-browser compatibility
                        inputArea.value = newText + appendChar;

                        // Try to move cursor to the end
                        try {
                            inputArea.selectionStart = inputArea.value.length;
                            inputArea.selectionEnd = inputArea.value.length;
                        } catch (e) {
                            // Some browsers might not support selection manipulation
                        }

                        // Clear cache after successful correction
                        lastTooltipWord = null;
                        lastTooltipSuggestion = null;

                        return true; // Correction was made
                    }
                }
            }
        }
        return false; // No correction was made
    } catch (error) {
        console.error("Autocorrect error:", error);
        return false; // Error occurred, don't attempt correction
    }
}

// Calculate results for the current prompt
function calculatePromptResult() {
    const typedText = inputArea.value.trim();
    const promptText = prompts[currentPromptIndex];
    const typedLength = typedText.length;
    const promptLength = promptText.length;

    // Use Levenshtein distance to calculate edit distance
    const editDistance = levenshteinDistance(typedText, promptText, 1000);

    // Calculate accuracy as 1 minus normalized edit distance
    const maxDistance = Math.max(typedLength, promptLength);
    const normalizedDistance = maxDistance > 0 ? editDistance / maxDistance : 0;
    const accuracy = Math.max(0, (1 - normalizedDistance) * 100);

    // Calculate time spent on this prompt in minutes
    const timeSpentMs = endTime - startTime;
    const minutes = timeSpentMs / 60000; // Convert ms to minutes

    // Calculate WPM (assuming average word is 5 characters)
    const characters = typedLength;
    const words = characters / 5;
    const wpm = minutes > 0 ? words / minutes : 0;

    return {
        promptText: promptText,
        typedText: typedText,
        wpm: wpm,
        accuracy: accuracy,
        timeSpentMs: timeSpentMs
    };
}

// Calculate average results across all completed prompts
function calculateAverageResults() {
    if (promptResults.length === 0) return;

    let totalWpm = 0;
    let totalAccuracy = 0;

    promptResults.forEach(result => {
        totalWpm += result.wpm;
        totalAccuracy += result.accuracy;
    });

    const avgWpm = totalWpm / promptResults.length;
    const avgAccuracy = totalAccuracy / promptResults.length;

    // Update results display
    wpmElement.textContent = Math.round(avgWpm);
    accuracyElement.textContent = Math.round(avgAccuracy) + '%';
}

// Generate leaderboard with random results and current user
function generateLeaderboard() {
    let currentWpm = 0;
    let currentAccuracy = 0;

    // If we have completed prompts, calculate current stats
    if (promptResults.length > 0) {
        let totalWpm = 0;
        let totalAccuracy = 0;

        promptResults.forEach(result => {
            totalWpm += result.wpm;
            totalAccuracy += result.accuracy;
        });

        currentWpm = Math.round(totalWpm / promptResults.length);
        currentAccuracy = Math.round(totalAccuracy / promptResults.length);
    }

    // Create leaderboard entries with random results
    const leaderboardData = [
        // { name: "Andrew Bosworth", wpm: 119, accuracy: 99, isCurrentUser: false },
        // { name: "Susan Li", wpm: 127, accuracy: 98, isCurrentUser: false },
        // { name: "Alex Himel", wpm: 117, accuracy: 97, isCurrentUser: false },
        { name: "Andrew Bosworth", wpm: 95, accuracy: 99, isCurrentUser: false },
        { name: "Susan Li", wpm: 101, accuracy: 98, isCurrentUser: false },
        { name: "Alex Himel", wpm: 93, accuracy: 97, isCurrentUser: false },
        { name: "You", wpm: currentWpm, accuracy: currentAccuracy, isCurrentUser: true }
    ];

    // Sort by wpm * accuracy (descending)
    leaderboardData.sort((a, b) => (b.wpm * b.accuracy / 100) - (a.wpm * a.accuracy / 100));

    // Clear existing leaderboard
    leaderboardList.innerHTML = '';

    // Create leaderboard rows
    leaderboardData.forEach((entry, index) => {
        const tableRow = document.createElement('tr');
        tableRow.className = entry.isCurrentUser ? 'current-user' : '';

        const score = Math.round(entry.wpm * entry.accuracy / 100);

        tableRow.innerHTML = `
            <td class="rank-cell">${index + 1}</td>
            <td class="name-cell">${entry.name}</td>
            <td class="wpm-cell">${entry.wpm}</td>
            <td class="accuracy-cell">${entry.accuracy}%</td>
            <td class="score-cell">${score}</td>
        `;

        leaderboardList.appendChild(tableRow);
    });
}

// Initialize leaderboard with default values
function initializeLeaderboard() {
    generateLeaderboard();
}

function endTest() {
    testActive = false;
    inputArea.disabled = true;
    calculateAverageResults();
    generateLeaderboard();
    results.style.display = 'block';
}

function restartTest() {
    shufflePrompts(); // Shuffle prompts each time the test is restarted
    hideAutocorrectTooltip(); // Hide tooltip on restart
    charsTypedSinceLastBackspace = 0; // Reset suppression counter
    initializeTest();
}

// Track input value changes for autocorrect
let previousInputLength = 0;

// Handle input events
inputArea.addEventListener('input', function() {
    if (!testActive) {
        startTest();
        previousInputLength = 0;
    }

    // Get the current input value and length
    const currentValue = inputArea.value;
    const currentLength = currentValue.length;

    // If input field is empty, restart the timer and hide tooltip
    if (currentLength === 0) {
        promptTimingStarted = false;
        startTime = 0;
        endTime = 0;
        hideAutocorrectTooltip();
        charsTypedSinceLastBackspace = 0; // Reset suppression counter
        return;
    }

    // Start timing for current prompt on first keystroke
    if (!promptTimingStarted) {
        startTime = Date.now();
        endTime = startTime; // Reset endTime to startTime for new prompt
        promptTimingStarted = true;
    }

    // Reset the correction flag if the user is typing a new character
    if (currentLength > previousInputLength) {
        lastWordCorrected = false;

        // Count characters typed, but handle space separately
        const charsAdded = currentLength - previousInputLength;
        const lastChar = currentValue.slice(-1);
        const isSpaceOrPunct = /[\s.,.!?;:"()]/.test(lastChar);

        // Only count non-space characters toward backspace penalty
        if (!isSpaceOrPunct) {
            charsTypedSinceLastBackspace += charsAdded;
        }

        keyPressCount += charsAdded;

        // Real-time autocorrect preview (only for non-space chars)
        if (!isSpaceOrPunct) {
            const incompleteWord = getCurrentIncompleteWord();

            if (incompleteWord.length > 2) {
                if (shouldSuppressAutocorrect()) {
                    hideAutocorrectTooltip();
                } else {
                    const suggestion = findClosestWordForPreview(incompleteWord.toLowerCase());
                    if (suggestion !== incompleteWord.toLowerCase()) {
                        showAutocorrectTooltip(incompleteWord, suggestion);
                    } else {
                        hideAutocorrectTooltip();
                    }
                }
            } else {
                hideAutocorrectTooltip();
            }
        }

        // Handle space/punctuation for autocorrect
        if (isSpaceOrPunct) {
            triggerAutocorrect(lastChar);
        }
    }
    // If length decreased, count as corrected error (backspace)
    else if (currentLength < previousInputLength) {
        correctedErrorCount += 1;

        // Reset counter on backspace (suppresses autocorrect until 2+ new chars typed)
        charsTypedSinceLastBackspace = 0;

        // Always hide tooltip after backspace
        hideAutocorrectTooltip();
    }

    // Update previous values for next comparison
    previousInputValue = inputArea.value;
    previousInputLength = previousInputValue.length;
});

// Handle Enter key to move to next prompt
inputArea.addEventListener('keydown', function(e) {
    if (!testActive) return;

    // Update end time for all keys except Enter (to track until last key entered)
    if (e.key !== 'Enter') {
        endTime = Date.now();
    }

    if (e.key === 'Enter') {
        e.preventDefault(); // Prevent default Enter behavior

        // Trigger autocorrect before processing the final text
        triggerAutocorrect('\n');

        const typedText = inputArea.value.trim();

        // Require at least some text to proceed
        if (typedText.length === 0) {
            return;
        }

        // Calculate results for the current prompt
        const promptResult = calculatePromptResult();
        promptResults.push(promptResult);

        // Move to the next prompt or end the test
        if (currentPromptIndex < 3) {  // Stop after 4 prompts (index 0-3)
            currentPromptIndex++;
            updateCurrentPrompt();
            inputArea.value = '';
            promptTimingStarted = false; // Reset timing flag for new prompt
            hideAutocorrectTooltip(); // Hide tooltip when moving to next prompt
            charsTypedSinceLastBackspace = 0; // Reset suppression counter for new prompt
        } else {
            // End the test after 4 prompts are completed
            hideAutocorrectTooltip(); // Hide tooltip when test ends
            charsTypedSinceLastBackspace = 0; // Reset suppression counter
            endTest();
        }
    }
});

// Restart button event listener
restartButtonFinal.addEventListener('click', restartTest);

// Configure input area to disable browser autocorrect
function configureInputArea() {
    // Disable browser's built-in features so our custom autocorrect works
    inputArea.setAttribute('spellcheck', 'false');
    inputArea.setAttribute('autocorrect', 'off');
    inputArea.setAttribute('autocomplete', 'off');
}

// Initialize the test on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Load prompts from prompts.txt first
    await loadPrompts();
    // Initialize dictionary with prompt words and common words from file
    await initializeDictionary();
    // Configure input area
    configureInputArea();
    initializeTest();
    // Initialize leaderboard
    initializeLeaderboard();
});
