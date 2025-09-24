// Keyboard neighbors are loaded from ../keyboard-layout.js


// Typing test prompts will be loaded from prompts.txt
let prompts = [];

// Initialize AutocorrectEngine
let autocorrectEngine = null;

// Fisher-Yates shuffle algorithm to randomize array
function shuffleArray(array) {
    const shuffled = [...array]; // Create a copy to avoid mutating the original
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function shufflePrompts() {
    prompts = shuffleArray(prompts);
}

async function loadPrompts() {
    // Load all three prompt files
    const easyResponse = await fetch('./prompts.txt');
    const hardResponse = await fetch('./hard_prompts.txt');
    const extraHardResponse = await fetch('./extra_hard_prompts.txt');

    const easyText = await easyResponse.text();
    const hardText = await hardResponse.text();
    const extraHardText = await extraHardResponse.text();

    // Parse prompts from each file
    const easyPrompts = easyText.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    const hardPrompts = hardText.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    const extraHardPrompts = extraHardText.split('\n').map(p => p.trim()).filter(p => p.length > 0);

    // Shuffle each category using the existing shuffleArray function
    const shuffledEasy = shuffleArray(easyPrompts);
    const shuffledHard = shuffleArray(hardPrompts);
    const shuffledExtraHard = shuffleArray(extraHardPrompts);

    // Create ordered sequence: 2 easy, 2 hard, 2 extra hard
    prompts = [
        ...shuffledEasy.slice(0, 2),
        ...shuffledHard.slice(0, 2),
        ...shuffledExtraHard.slice(0, 2)
    ];
}

async function initializeAutocorrect() {
    // Load dictionary from text file - now includes comprehensive word list with verb forms
    const baseDictionary = await loadDictionary();

    // Initialize AutocorrectEngine with loaded dictionary and keyboard layout
    autocorrectEngine = new AutocorrectEngine({
        baseWords: baseDictionary,
        keyboardNeighbors: typeof keyboardNeighbors !== 'undefined' ? keyboardNeighbors : {},
        maxEditDistance: 2,
        adjacentKeyMultiplier: 0.9,        // Much less aggressive - almost same as regular substitution
        insertionCost: 0.5,                // Cheaper to make insertions more favorable
        deletionCost: 1.0,                 // Keep deletions expensive
        substitutionCost: 1.0,             // Keep substitutions at normal cost
        apostropheInsertionCost: 0.2,      // Very cheap to add missing apostrophes
        apostropheDeletionCost: 0.3        // Cheap to remove extra apostrophes
    });

    // Add words from prompts
    const allWords = [];
    prompts.forEach(prompt => {
        autocorrectEngine.extractWords(prompt).forEach(word => {
            allWords.push(word);
        });
    });

    // Load additional words from comprehensive_dictionary.txt
    try {
        const response = await fetch('./comprehensive_dictionary.txt');
        if (response.ok) {
            const text = await response.text();
            const dictionaryWords = text.split('\n')
                .map(word => word.trim().toLowerCase())
                .filter(word => word.length > 0);
            allWords.push(...dictionaryWords);
        }
    } catch (error) {
        console.log('Could not load comprehensive dictionary:', error);
    }

    // Add all words to the autocorrect engine
    if (allWords.length > 0) {
        autocorrectEngine.addWords(allWords);
    }
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

// Helper function to reset backspace counter
function resetBackspaceCounter(reason) {
    charsTypedSinceLastBackspace = 0;
}

const sampleTextElement = document.getElementById('sample-text');
const currentPromptElement = document.getElementById('current-prompt');
const inputArea = document.getElementById('input-area');
const results = document.getElementById('results');
const wpmElement = document.getElementById('wpm');
const accuracyElement = document.getElementById('accuracy');
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
    updateDifficultyIndicator();
}

function updateDifficultyIndicator() {
    const charsetIcons = document.getElementById('charset-icons');

    // Determine difficulty based on prompt index
    // Prompts 0-1: Easy (a-z)
    // Prompts 2-3: Hard (a-z, .?!)
    // Prompts 4-5: Extra Hard (a-z, .?!, 0-9)

    if (currentPromptIndex <= 1) {
        // Easy prompts
        charsetIcons.textContent = 'a-z';
    } else if (currentPromptIndex <= 3) {
        // Hard prompts
        charsetIcons.textContent = 'a-z, .?!';
    } else {
        // Extra hard prompts
        charsetIcons.textContent = 'a-z, .?!, 0-9';
    }
}

function startTest() {
    if (testActive) return;
    testActive = true;
    promptTimingStarted = false;
}


function getCurrentIncompleteWord() {
    const currentValue = inputArea.value;
    const cursorPos = inputArea.selectionStart;

    if (!currentValue || cursorPos === undefined) return '';

    // ONLY consider text before cursor - ignore everything after
    const textBeforeCursor = currentValue.substring(0, cursorPos);

    // Use textBeforeCursor.length as the position (end of text before cursor)
    const wordAtCursor = getWordAtPosition(textBeforeCursor, textBeforeCursor.length);

    return wordAtCursor.word;
}

// Get the word at a specific cursor position with boundaries
function getWordAtPosition(text, position) {
    if (!text || position < 0 || position > text.length) {
        return { word: '', start: position, end: position, beforeCursor: '', afterCursor: '' };
    }

    // Define word boundaries (letters, apostrophes, and hyphens are part of words)
    const wordChar = /[a-zA-Z'\-]/;

    // Find start of word (scan backwards from cursor)
    let start = position;
    while (start > 0 && wordChar.test(text[start - 1])) {
        start--;
    }

    // Find end of word (scan forwards from cursor)
    let end = position;
    while (end < text.length && wordChar.test(text[end])) {
        end++;
    }

    // Extract the word and surrounding context
    const word = text.substring(start, end);
    const beforeCursor = text.substring(0, position);
    const afterCursor = text.substring(position);

    return { word, start, end, beforeCursor, afterCursor };
}

// Check if cursor is at a word boundary (space, punctuation, start/end of text)
function isAtWordBoundary(text, position) {
    if (position <= 0 || position >= text.length) return true;

    const charBefore = text[position - 1];
    const charAfter = text[position];
    const wordChar = /[a-zA-Z'\-]/;

    // At boundary if either side is not a word character
    return !wordChar.test(charBefore) || !wordChar.test(charAfter);
}

// Check if we're editing within an existing word
function isEditingWithinWord(text, position) {
    const wordInfo = getWordAtPosition(text, position);
    return wordInfo.word.length > 0 && position > wordInfo.start && position < wordInfo.end;
}

// Cache for caret position calculations to reduce DOM operations
let caretPositionCache = {
    lastText: '',
    lastPosition: -1,
    lastResult: null,
    mirrorDiv: null
};

function getCaretPosition() {
    const element = inputArea;
    const position = element.selectionStart;
    const currentText = element.value.substring(0, position);

    // Use cached result if text and position haven't changed
    if (caretPositionCache.lastText === currentText &&
        caretPositionCache.lastPosition === position &&
        caretPositionCache.lastResult) {
        return caretPositionCache.lastResult;
    }

    // Reuse or create mirror div to reduce DOM creation overhead
    let div = caretPositionCache.mirrorDiv;
    if (!div) {
        div = document.createElement('div');
        caretPositionCache.mirrorDiv = div;

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
    }

    // Only append to DOM when needed
    if (!div.parentNode) {
        document.body.appendChild(div);
    }

    // Update content
    div.textContent = currentText;

    // Add a span to mark where caret would be
    let span = div.querySelector('span.caret-marker');
    if (!span) {
        span = document.createElement('span');
        span.className = 'caret-marker';
        span.textContent = '|';
        div.appendChild(span);
    }

    // Get the span position
    const coordinates = {
        top: span.offsetTop,
        left: span.offsetLeft
    };

    // Convert to viewport coordinates
    const elementRect = element.getBoundingClientRect();
    const x = elementRect.left + coordinates.left - element.scrollLeft;
    const y = elementRect.top + coordinates.top - element.scrollTop;

    const result = { x, y };

    // Cache the result
    caretPositionCache.lastText = currentText;
    caretPositionCache.lastPosition = position;
    caretPositionCache.lastResult = result;

    return result;
}

function showAutocorrectTooltip(originalWord, correctedWord) {
    if (originalWord === correctedWord) {
        hideAutocorrectTooltip();
        return;
    }

    // Cache the suggestion for use in actual autocorrect
    lastTooltipWord = originalWord.toLowerCase();
    lastTooltipSuggestion = correctedWord;

    // Set only the corrected word as tooltip content immediately
    correctionText.textContent = correctedWord;

    // Schedule positioning for next frame to avoid blocking current input
    requestAnimationFrame(() => {
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

        // Show tooltip with animation
        autocorrectTooltip.classList.add('show');
    });
}

function hideAutocorrectTooltip() {
    autocorrectTooltip.classList.remove('show');
    // Clear cached suggestion when tooltip is hidden
    lastTooltipWord = null;
    lastTooltipSuggestion = null;
}

// Simple autocorrect suppression logic
function shouldSuppressAutocorrect() {
    // Only suppress if we recently used backspace AND haven't typed enough since
    // Don't suppress based on cursor positioning or clicking
    return charsTypedSinceLastBackspace < 2;
}

// Debounced autocorrect preview to prevent blocking on every keystroke
let autocorrectPreviewTimer = null;
function scheduleAutocorrectPreview() {
    // Cancel any pending preview
    if (autocorrectPreviewTimer) {
        clearTimeout(autocorrectPreviewTimer);
    }

    // Schedule new preview with minimal delay to not block typing
    autocorrectPreviewTimer = setTimeout(() => {
        performAutocorrectPreview();
        autocorrectPreviewTimer = null;
    }, 16); // ~1 frame at 60fps for smooth typing
}

function performAutocorrectPreview() {
    const currentValue = inputArea.value;
    const cursorPos = inputArea.selectionStart;

    // ONLY consider text before cursor for word detection
    const textBeforeCursor = currentValue.substring(0, cursorPos);

    // Check if we're editing within an existing word using the correct position relative to textBeforeCursor
    const wordInfo = getWordAtPosition(textBeforeCursor, textBeforeCursor.length);
    const isWithinWord = wordInfo.word.length > 0 && textBeforeCursor.length > wordInfo.start && textBeforeCursor.length < wordInfo.end;

    // Don't show preview if editing within an existing word
    if (isWithinWord) {
        hideAutocorrectTooltip();
        return;
    }

    const incompleteWord = getCurrentIncompleteWord();

    if (incompleteWord.length > 2) {
        if (shouldSuppressAutocorrect()) {
            hideAutocorrectTooltip();
        } else {
            // Use requestIdleCallback if available for better performance
            if (window.requestIdleCallback) {
                requestIdleCallback(() => {
                    const suggestion = autocorrectEngine.findClosestWordForPreview(incompleteWord.toLowerCase());
                    if (suggestion !== incompleteWord.toLowerCase()) {
                        showAutocorrectTooltip(incompleteWord, suggestion);
                    } else {
                        hideAutocorrectTooltip();
                    }
                });
            } else {
                // Fallback for browsers without requestIdleCallback
                const suggestion = autocorrectEngine.findClosestWordForPreview(incompleteWord.toLowerCase());
                if (suggestion !== incompleteWord.toLowerCase()) {
                    showAutocorrectTooltip(incompleteWord, suggestion);
                } else {
                    hideAutocorrectTooltip();
                }
            }
        }
    } else {
        hideAutocorrectTooltip();
    }
}

// Generic function to trigger autocorrect (works for any terminating character)
function triggerAutocorrect(terminatingChar = ' ') {
    if (lastWordCorrected) return false;

    hideAutocorrectTooltip();

    // Check suppression using CURRENT counter value (before resetting)
    const shouldSuppress = shouldSuppressAutocorrect();

    // Reset counter after word termination (new word starts) - AFTER checking suppression
    resetBackspaceCounter('word termination');

    // Apply suppression logic
    if (suppressAutocorrect) {
        suppressAutocorrect = false;
        return false;
    } else if (!shouldSuppress) {
        // Get current cursor position and text
        const currentText = inputArea.value;
        const cursorPos = inputArea.selectionStart;

        // Don't autocorrect if we were editing within an existing word before the terminating char
        // We need to check the state BEFORE the terminating character was added
        const textBeforeTerminatingChar = currentText.substring(0, cursorPos - 1);
        const positionBeforeTerminatingChar = textBeforeTerminatingChar.length;

        // If we were in the middle of a word (not at the end), skip autocorrect
        if (textBeforeTerminatingChar.length > 0) {
            const wordInfo = getWordAtPosition(textBeforeTerminatingChar, positionBeforeTerminatingChar);
            const wasInMiddle = wordInfo.word.length > 0 && positionBeforeTerminatingChar > wordInfo.start && positionBeforeTerminatingChar < wordInfo.end;

            if (wasInMiddle) {
                return false; // We were in the middle of a word
            }
        }

        return performCursorAwareAutocorrect(terminatingChar);
    }

    return false;
}


// Cursor-aware autocorrect function - only considers text before cursor
function performCursorAwareAutocorrect(appendChar) {
    try {
        const currentText = inputArea.value;
        const cursorPos = inputArea.selectionStart;

        // Check if the terminating character was actually added to the text
        // For Enter key, no character is added, so don't subtract from cursor position
        let adjustedCursorPos = cursorPos;
        const actualLastChar = currentText.charAt(cursorPos - 1);

        // Only subtract 1 if the terminating character is actually in the text
        if (appendChar !== '\n' && actualLastChar === appendChar) {
            adjustedCursorPos = cursorPos - 1;
        }

        // ONLY work with text before the cursor - ignore everything after
        const textBeforeCursor = currentText.substring(0, adjustedCursorPos);
        const textAfterCursor = currentText.substring(cursorPos); // Everything after cursor

        // Get word that was just completed at the end of the "before cursor" text
        const wordInfo = getWordAtPosition(textBeforeCursor, textBeforeCursor.length);

        if (!wordInfo.word || wordInfo.word.length <= 2) {
            return false; // No word or too short to correct
        }

        // Extract word core - keep original capitalization for the autocorrect engine
        const wordPattern = /^([^a-zA-Z]*)([a-zA-Z']+)([^a-zA-Z]*)$/;
        const match = wordInfo.word.match(wordPattern);

        if (!match) return false; // No alphabetic content to correct

        const [, prefixPunct, wordCore, suffixPunct] = match;
        const lowerWord = wordCore.toLowerCase();

        let correctedWord;

        // Use cached suggestion if available and matches current word
        if (lastTooltipWord === lowerWord && lastTooltipSuggestion) {
            correctedWord = lastTooltipSuggestion;
        } else {
            // Pass the original word with capitalization to the autocorrect engine
            // The engine handles capitalization preservation internally
            correctedWord = autocorrectEngine.findClosestWord(wordCore);
        }

        // If a correction was found and it's different from the original
        if (correctedWord !== wordCore && correctedWord !== lowerWord) {
            // Reconstruct with original punctuation
            const finalCorrectedWord = prefixPunct + correctedWord + suffixPunct;

            // Rebuild text: [text before word] + [corrected word] + [terminating char] + [text after cursor]
            const beforeWord = textBeforeCursor.substring(0, wordInfo.start);
            const newText = beforeWord + finalCorrectedWord + appendChar + textAfterCursor;

            // Update text area with corrected word
            inputArea.value = newText;

            // Position cursor after the corrected word and terminating character
            const newCursorPos = beforeWord.length + finalCorrectedWord.length + 1;
            try {
                inputArea.selectionStart = newCursorPos;
                inputArea.selectionEnd = newCursorPos;
            } catch (e) {
                // Some browsers might not support selection manipulation
            }

            // Clear cache after successful correction
            lastTooltipWord = null;
            lastTooltipSuggestion = null;

            return true; // Correction was made
        }

        return false; // No correction was made
    } catch (error) {
        return false; // Error occurred, don't attempt correction
    }
}

// Legacy autocorrect function (kept for compatibility)
function performAutocorrect(currentText, appendChar) {
    // Redirect to cursor-aware version
    return performCursorAwareAutocorrect(appendChar);
}

// Standard Levenshtein distance for accuracy calculation (uniform costs of 1)
function standardLevenshteinDistance(a, b) {
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
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution (cost = 1)
                    matrix[i - 1][j] + 1,     // insertion (cost = 1)
                    matrix[i][j - 1] + 1      // deletion (cost = 1)
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// Calculate results for the current prompt
function calculatePromptResult() {
    const typedText = inputArea.value.trim();
    const promptText = prompts[currentPromptIndex];
    const typedLength = typedText.length;
    const promptLength = promptText.length;

    // Use STANDARD Levenshtein distance for accuracy calculation (not weighted)
    const editDistance = standardLevenshteinDistance(typedText, promptText);

    // Calculate accuracy as 1 minus normalized edit distance
    // Normalize by prompt length only (the "correct" reference text)
    const normalizedDistance = promptLength > 0 ? editDistance / promptLength : 0;
    const accuracy = Math.max(0, (1 - normalizedDistance) * 100);

    // Calculate time spent on this prompt in minutes
    const timeSpentMs = endTime - startTime;
    const minutes = timeSpentMs / 60000; // Convert ms to minutes

    // Calculate WPM (assuming average word is 5 characters)
    // Subtract 1 because WPM measures time between keystrokes, not total characters
    const characters = Math.max(0, typedLength - 1);
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

// Calculate weighted average results across all completed prompts
function calculateAverageResults() {
    if (promptResults.length === 0) return;

    let totalEffectiveChars = 0; // For WPM weighting (typedLength - 1)
    let totalTypedChars = 0;     // For accuracy weighting (typedLength)
    let weightedWpmSum = 0;
    let weightedAccuracySum = 0;

    promptResults.forEach(result => {
        const typedLength = result.typedText.length;
        const effectiveChars = Math.max(0, typedLength - 1);

        // Weight WPM by effective characters (typedLength - 1)
        totalEffectiveChars += effectiveChars;
        weightedWpmSum += result.wpm * effectiveChars;

        // Weight accuracy by typed characters (typedLength)
        totalTypedChars += typedLength;
        weightedAccuracySum += result.accuracy * typedLength;
    });

    const avgWpm = totalEffectiveChars > 0 ? weightedWpmSum / totalEffectiveChars : 0;
    const avgAccuracy = totalTypedChars > 0 ? weightedAccuracySum / totalTypedChars : 0;

    // Update results display
    wpmElement.textContent = Math.round(avgWpm);
    accuracyElement.textContent = Math.round(avgAccuracy) + '%';
}


function endTest() {
    testActive = false;
    inputArea.disabled = true;
    calculateAverageResults();
    results.style.display = 'block';
}

function restartTest() {
    shufflePrompts(); // Shuffle prompts each time the test is restarted
    hideAutocorrectTooltip(); // Hide tooltip on restart
    resetBackspaceCounter('restart test'); // Reset suppression counter
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
        resetBackspaceCounter('empty input'); // Reset suppression counter
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
        const cursorPos = inputArea.selectionStart;

        // Get the character that was actually just typed (at cursor position - 1)
        const actualTypedChar = currentValue.charAt(cursorPos - 1);
        const isSpaceOrPunct = /[\s.,.!?;:"()]/.test(actualTypedChar);


        // Only count non-space characters toward backspace penalty
        if (!isSpaceOrPunct) {
            charsTypedSinceLastBackspace += charsAdded;
        }

        keyPressCount += charsAdded;

        // Real-time autocorrect preview (only for non-space chars) - using async processing
        if (!isSpaceOrPunct) {
            // Schedule autocorrect preview to run after current event loop
            scheduleAutocorrectPreview();
        }

        // Handle space/punctuation for autocorrect
        if (isSpaceOrPunct) {
            triggerAutocorrect(actualTypedChar);
        }
    }
    // If length decreased, count as corrected error (backspace)
    else if (currentLength < previousInputLength) {
        correctedErrorCount += 1;

        // Reset counter on backspace (suppresses autocorrect until 2+ new chars typed)
        resetBackspaceCounter('backspace detected');

        // Always hide tooltip after backspace (non-blocking)
        hideAutocorrectTooltip();

        // Clear position cache since text has changed
        caretPositionCache.lastResult = null;
    }

    // Update previous values for next comparison
    previousInputValue = inputArea.value;
    previousInputLength = previousInputValue.length;

    // Invalidate caret position cache on any input change
    if (caretPositionCache.lastResult) {
        caretPositionCache.lastResult = null;
    }
});

// Handle cursor position changes (clicks, arrow keys, etc.)
inputArea.addEventListener('selectionchange', function() {
    // Hide tooltip when cursor moves to prevent confusion
    hideAutocorrectTooltip();

    // Invalidate caret position cache
    if (caretPositionCache.lastResult) {
        caretPositionCache.lastResult = null;
    }
});

// Handle clicks in the text area
inputArea.addEventListener('click', function() {
    // Hide tooltip when user clicks to position cursor
    hideAutocorrectTooltip();

    // Invalidate caret position cache
    if (caretPositionCache.lastResult) {
        caretPositionCache.lastResult = null;
    }
});

// Handle arrow key navigation (capture phase to run before other handlers)
inputArea.addEventListener('keydown', function(e) {
    // Hide tooltip when user navigates with arrow keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        hideAutocorrectTooltip();

        // Invalidate caret position cache
        if (caretPositionCache.lastResult) {
            caretPositionCache.lastResult = null;
        }
    }
}, true);

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
        if (currentPromptIndex < 5) {  // Stop after 6 prompts (index 0-5)
            currentPromptIndex++;
            updateCurrentPrompt();
            inputArea.value = '';
            promptTimingStarted = false; // Reset timing flag for new prompt
            hideAutocorrectTooltip(); // Hide tooltip when moving to next prompt
            resetBackspaceCounter('new prompt'); // Reset suppression counter for new prompt
        } else {
            // End the test after 6 prompts are completed
            hideAutocorrectTooltip(); // Hide tooltip when test ends
            resetBackspaceCounter('test end'); // Reset suppression counter
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
    // Load prompts from prompts.txt
    await loadPrompts();
    // Initialize dictionary with prompt words and common words from file
    await initializeAutocorrect();
    // Configure input area
    configureInputArea();
    initializeTest();
});
