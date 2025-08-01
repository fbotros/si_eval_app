document.addEventListener('DOMContentLoaded', function() {
    // Array of prompts for the typing test
    const originalPrompts = [
        "Stability of the nation.",
        "Rectangular objects have four sides.",
        "Why do you ask silly questions?",
        "Learn to walk before you run.",
        "Important news always seems to be late.",
        "The quick brown fox jumps over the lazy dog.",
        "A steep learning curve in riding a unicycle.",
        "Be discreet about your meeting.",
        "Raindrops keep falling on my head.",
        "An excellent way to communicate."
    ];

    // Create a copy of the prompts that we'll shuffle
    let prompts = [...originalPrompts];

    const sampleTextElement = document.getElementById('sample-text');
    const currentPromptElement = document.getElementById('current-prompt');
    const totalPromptsElement = document.getElementById('total-prompts');

    let currentPromptIndex = 0;
    let promptResults = [];

    // Fisher-Yates shuffle algorithm
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
        return array;
    }

    // Function to shuffle prompts
    function shufflePrompts() {
        // Create a fresh copy with index tracking
        prompts = originalPrompts.map((text, index) => ({
            text: text,
            originalIndex: index
        }));
        shuffleArray(prompts);
    }

    // Initialize with shuffled prompts
    shufflePrompts();
    totalPromptsElement.textContent = prompts.length;
    updateCurrentPrompt();

    function updateCurrentPrompt() {
        currentPromptElement.textContent = currentPromptIndex + 1;
        sampleTextElement.innerText = prompts[currentPromptIndex].text;
    }

    // Get the current prompt text
    function getCurrentPromptText() {
        return prompts[currentPromptIndex].text;
    }

    // Get the current prompt's original index
    function getCurrentPromptOriginalIndex() {
        return prompts[currentPromptIndex].originalIndex;
    }
    const inputArea = document.getElementById('input-area');
    const timer = document.getElementById('timer');
    const startButton = document.getElementById('start-button');
    const results = document.getElementById('results');
    const wpmElement = document.getElementById('wpm');
    const cpmElement = document.getElementById('cpm');
    const accuracyElement = document.getElementById('accuracy');
    const correctCharsElement = document.getElementById('correct-chars');
    const incorrectCharsElement = document.getElementById('incorrect-chars');
    const autocorrectIndicator = document.getElementById('autocorrect-indicator');

    let timeLeft = 30;
    let timerInterval;
    let testActive = false;
    let lastTypedWord = '';
    let lastSuggestion = '';
    let startTime = 0; // Track when the current prompt started

    // Function to start the test
    function startTest() {
        if (testActive) return;

        // Start the test
        testActive = true;
        results.style.display = 'none';
        promptResults = []; // Clear previous results
        startTime = Date.now(); // Record start time

        // Start the timer
        timeLeft = 30;
        updateTimerDisplay();
        timerInterval = setInterval(function() {
            timeLeft--;
            updateTimerDisplay();

            if (timeLeft <= 0) {
                endTest();
            }
        }, 1000);
    }

    // Base dictionary of common words - make it a global window property for debugging
    window.typingTestDictionary = [
        // Common English words
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
        'head', 'excellent', 'communicate',

        // Programming related words
        'function', 'variable', 'code', 'program', 'class', 'object', 'method',
        'array', 'string', 'number', 'boolean', 'null', 'undefined', 'syntax',
        'error', 'debug', 'compile', 'runtime', 'framework', 'library', 'api',
        'interface', 'module', 'component', 'server', 'client', 'database', 'data',
        'file', 'system', 'network', 'web', 'app', 'application', 'development'
    ];

    // Use the window property as our dictionary
    let dictionary = window.typingTestDictionary;

    // Add some test misspellings for debugging
    const testMisspellings = {
        'natoin': 'nation',
        'rectanglar': 'rectangular',
        'questons': 'questions',
        'lern': 'learn',
        'importent': 'important',
        'alwyas': 'always',
        'quck': 'quick',
        'bown': 'brown',
        'lazzy': 'lazy',
        'comunicate': 'communicate'
    };

    // Function to extract words from a string
    function extractWords(text) {
        // Remove punctuation and split by spaces
        return text.toLowerCase()
            .replace(/[.,!?;:"'()]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    // Function to add all words from prompts to the dictionary
    function addPromptWordsToDictionary() {
        // Extract all words from all prompts
        originalPrompts.forEach(prompt => {
            const words = extractWords(prompt);
            words.forEach(word => {
                // Add word to dictionary if it's not already there
                if (!dictionary.includes(word)) {
                    dictionary.push(word);
                }
            });
        });

        // Log the dictionary contents for debugging
        debugLog("Dictionary initialized", {
            size: dictionary.length,
            sample: dictionary.slice(0, 10).join(', ') + '...'
        });

        // Make the dictionary accessible for debugging
        window.getDictionary = function() {
            return dictionary;
        };

        // Add a function to test the autocorrect
        window.testAutocorrect = function(word) {
            const corrected = findClosestWord(word);
            console.log(`Testing autocorrect: "${word}" → "${corrected}"`);
            return corrected;
        };
    }

    // Add prompt words to dictionary on page load
    addPromptWordsToDictionary();

    // Calculate Levenshtein distance between two strings
    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

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
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    // Find the closest word in the dictionary
    function findClosestWord(word) {
        // First check our test misspellings for debugging
        if (testMisspellings[word]) {
            debugLog("Test misspelling found", { word, correction: testMisspellings[word] });
            return testMisspellings[word];
        }

        // If the word is already in the dictionary, return it
        if (dictionary.includes(word)) {
            debugLog("Word found in dictionary", word);
            return word;
        }

        let closestWord = null;
        let minDistance = Infinity;
        let matchedWords = [];

        // Find words with edit distance of up to 2
        for (const dictWord of dictionary) {
            debugLog("Checking word", { dictWord })
            const distance = levenshteinDistance(word, dictWord);

            // Track all close matches for debugging
            if (distance <= 2) {
                matchedWords.push({ word: dictWord, distance });
            }

            // Consider words with edit distance of 1 or 2
            if (distance <= 2 && distance < minDistance) {
                minDistance = distance;
                closestWord = dictWord;
            }
        }
        debugLog("Num of words checked", { total: dictionary.length, matched: matchedWords.length });

        // Log all potential matches for debugging
        if (matchedWords.length > 0) {
            debugLog("Potential matches", {
                word,
                matches: matchedWords.slice(0, 5), // Show up to 5 matches
                totalMatches: matchedWords.length,
                selected: closestWord
            });
        } else {
            debugLog("No matches found", { word, dictionarySize: dictionary.length });
        }

        // Return the closest word if found, otherwise return the original word
        return closestWord || word;
    }

    // Function to position the autocorrect indicator
    function positionAutocorrectIndicator() {
        if (!testActive) return;

        const text = inputArea.value;
        const cursorPosition = inputArea.selectionStart;

        // Find the start of the current word
        let wordStart = cursorPosition;
        while (wordStart > 0 && !/[\s.,!?;:"'()]/.test(text.charAt(wordStart - 1))) {
            wordStart--;
        }

        // Extract the current word
        const currentWord = text.substring(wordStart, cursorPosition).toLowerCase();

        // Skip very short words (1-2 characters)
        if (currentWord.length <= 2) {
            hideAutocorrectIndicator();
            lastTypedWord = currentWord;
            return;
        }

        // Check if the word has changed
        if (currentWord === lastTypedWord) {
            return;
        }

        lastTypedWord = currentWord;

        // Find the closest word in the dictionary
        const correctedWord = findClosestWord(currentWord);

        // If a correction was found and it's different from the original word
        if (correctedWord !== currentWord) {
            // Show the autocorrect indicator with the suggested word
            showAutocorrectIndicator(correctedWord, wordStart);
            lastSuggestion = correctedWord;
        } else {
            hideAutocorrectIndicator();
        }
    }

    // Function to show the autocorrect indicator
    function showAutocorrectIndicator(suggestion, wordStart) {
        // Get the current word being typed
        const currentWord = inputArea.value.substring(wordStart, inputArea.selectionStart);

        // Set the indicator text
        document.getElementById('autocorrect-current-word').textContent = currentWord + ' →';
        document.getElementById('autocorrect-suggestion').textContent = suggestion;

        // Show the indicator - using display property instead of opacity
        autocorrectIndicator.style.display = 'flex';
    }

    // Function to hide the autocorrect indicator
    function hideAutocorrectIndicator() {
        autocorrectIndicator.style.display = 'none';
    }

    // Track the previous input value to detect changes
    let previousInputValue = '';
    let lastWordCorrected = false;

    // Debug function to log to console and to the page - useful for debugging on mobile devices
    function debugLog(message, data) {
        console.log(`[DEBUG] ${message}`, data);

        // Also show debug info on the page for mobile devices
        const debugElement = document.getElementById('debug-info');
        if (debugElement) {
            const timestamp = new Date().toISOString().substr(11, 8); // HH:MM:SS
            let debugText = `${timestamp} - ${message}: `;

            if (typeof data === 'object') {
                try {
                    debugText += JSON.stringify(data).substring(0, 100); // Limit length
                } catch (e) {
                    debugText += "[Object]";
                }
            } else {
                debugText += data;
            }

            // Keep only the last 5 debug messages
            const currentText = debugElement.innerHTML;
            const lines = currentText.split('<br>');
            if (lines.length > 4) {
                lines.shift(); // Remove oldest line
            }
            lines.push(debugText);

            debugElement.innerHTML = lines.join('<br>');
        }
    }

    // Initialize the app with a message to show it's working
    debugLog("App initialized", {
        mobile: isMobileOrVRBrowser(),
        userAgent: navigator.userAgent,
        dictionarySize: dictionary.length
    });

    // Track input changes with a timer for mobile devices
    let inputCheckInterval;

    // Start test when user starts typing
    inputArea.addEventListener('input', function(e) {
        if (!testActive) {
            startTest();

            // For mobile devices, set up an interval to check for changes
            if (isMobileOrVRBrowser() && !inputCheckInterval) {
                inputCheckInterval = setInterval(checkForInputChanges, 200);
                debugLog("Mobile input check interval started", {});
            }
        }

        // Get the current input value
        const currentValue = inputArea.value;

        // Debug
        debugLog("Input event", {
            current: currentValue.slice(-10), // Show just the last 10 chars for brevity
            previous: previousInputValue ? previousInputValue.slice(-10) : '',
            length: currentValue.length,
            prevLength: previousInputValue ? previousInputValue.length : 0
        });

        // If there's no previous value, just update and return
        if (!previousInputValue) {
            previousInputValue = currentValue;
            return;
        }

        // Reset the correction flag if the user is typing a new character
        if (currentValue.length > previousInputValue.length) {
            lastWordCorrected = false;
        }

        // Check if a space or punctuation was added
        if (currentValue.length > previousInputValue.length && !lastWordCorrected) {
            const lastChar = currentValue.slice(-1);

            if (/[\s.,!?;:"'()]/.test(lastChar)) {
                debugLog("Punctuation detected", lastChar);

                // Extract the current text and add any new words to the dictionary
                const currentText = currentValue.slice(0, -1); // Exclude the last character (space/punctuation)
                addUserInputToDictionary(currentText);

                // Try to perform autocorrect
                performMobileAutocorrect(currentValue, lastChar);
            }
        }

        // Update the previous value
        previousInputValue = currentValue;
    });

    // Function to check for input changes on mobile devices
    function checkForInputChanges() {
        if (!testActive) return;

        const currentValue = inputArea.value;

        // If the value hasn't changed, do nothing
        if (currentValue === previousInputValue) return;

        debugLog("Interval check", {
            current: currentValue.slice(-10),
            previous: previousInputValue ? previousInputValue.slice(-10) : '',
            changed: currentValue !== previousInputValue
        });

        // If the value has changed and ends with punctuation, try autocorrect
        if (currentValue.length > 0) {
            const lastChar = currentValue.slice(-1);

            if (/[\s.,!?;:"'()]/.test(lastChar) && !lastWordCorrected) {
                debugLog("Punctuation detected in interval", lastChar);

                // Try to perform autocorrect
                performMobileAutocorrect(currentValue, lastChar);
            }
        }

        // Update the previous value
        previousInputValue = currentValue;
    }

    // Specialized autocorrect function for mobile devices
    function performMobileAutocorrect(currentValue, lastChar) {
        try {
            // Split the text by spaces and punctuation
            const allText = currentValue.slice(0, -1); // Text without the last punctuation
            const words = allText.split(/[\s.,!?;:"'()]+/);

            if (words.length > 0) {
                const lastWord = words[words.length - 1].toLowerCase();
                debugLog("Last word", lastWord);

                // Skip very short words (1-2 characters)
                if (lastWord.length > 2) {
                    // Find the closest word in the dictionary
                    const correctedWord = findClosestWord(lastWord);
                    debugLog("Correction check", { original: lastWord, corrected: correctedWord });

                    // If a correction was found and it's different from the original word
                    if (correctedWord !== lastWord) {
                        debugLog("Correction found", { from: lastWord, to: correctedWord });

                        // ULTRA-SIMPLIFIED REPLACEMENT STRATEGY FOR MOBILE
                        // Just replace the last word in the simplest way possible
                        try {
                            // Simple approach: split by spaces and replace the last word
                            const textParts = allText.split(/\s+/);
                            if (textParts.length > 0) {
                                // Replace the last part that contains our word
                                let replaced = false;

                                for (let i = textParts.length - 1; i >= 0; i--) {
                                    // Clean the part from punctuation for comparison
                                    const cleanPart = textParts[i].replace(/[.,!?;:"'()]/g, '').toLowerCase();

                                    if (cleanPart === lastWord) {
                                        // Replace just the word part, keeping any punctuation
                                        const punctBefore = textParts[i].match(/^[.,!?;:"'()]+/) || [''];
                                        const punctAfter = textParts[i].match(/[.,!?;:"'()]+$/) || [''];

                                        textParts[i] = punctBefore[0] + correctedWord + punctAfter[0];
                                        replaced = true;
                                        break;
                                    }
                                }

                                if (replaced) {
                                    // Join everything back together
                                    const correctedText = textParts.join(' ') + lastChar;

                                    debugLog("Simple correction applied", {
                                        before: currentValue,
                                        after: correctedText
                                    });

                                    // Update the input value
                                    inputArea.value = correctedText;
                                    lastWordCorrected = true;

                                    // Hide the indicator after correction
                                    hideAutocorrectIndicator();
                                } else {
                                    // If we couldn't find the exact word, try a more aggressive approach
                                    // Just replace the last part regardless
                                    if (textParts.length > 0) {
                                        const lastPart = textParts[textParts.length - 1];
                                        // Keep any leading/trailing punctuation
                                        const punctBefore = lastPart.match(/^[.,!?;:"'()]+/) || [''];
                                        const punctAfter = lastPart.match(/[.,!?;:"'()]+$/) || [''];

                                        textParts[textParts.length - 1] = punctBefore[0] + correctedWord + punctAfter[0];

                                        const correctedText = textParts.join(' ') + lastChar;

                                        debugLog("Aggressive correction applied", {
                                            before: currentValue,
                                            after: correctedText
                                        });

                                        // Update the input value
                                        inputArea.value = correctedText;
                                        lastWordCorrected = true;

                                        // Hide the indicator after correction
                                        hideAutocorrectIndicator();
                                    }
                                }
                            }
                        } catch (error) {
                            console.error("Error in simple replacement:", error);
                            debugLog("Error in simple replacement", error.toString());

                            // FALLBACK: Just append the corrected word
                            // This is a last resort if all other methods fail
                            const words = allText.split(/\s+/);
                            words[words.length - 1] = correctedWord;
                            inputArea.value = words.join(' ') + lastChar;
                            lastWordCorrected = true;
                            hideAutocorrectIndicator();
                            debugLog("Fallback correction applied", { result: inputArea.value });
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Autocorrect error in mobile handler:", error);
            debugLog("Error in mobile autocorrect", error.toString());
        }
    }

    // Function to add words from user input to dictionary
    function addUserInputToDictionary(text) {
        const words = extractWords(text);
        let newWordsAdded = 0;

        words.forEach(word => {
            // Only add words with length > 2 that aren't already in the dictionary
            if (word.length > 2 && !dictionary.includes(word)) {
                dictionary.push(word);
                newWordsAdded++;
            }
        });

        if (newWordsAdded > 0) {
            console.log(`Added ${newWordsAdded} new words from user input to dictionary. Dictionary now has ${dictionary.length} words`);
        }
    }

    // Handle Enter key to move to next prompt
    inputArea.addEventListener('keydown', function(e) {
        if (!testActive) return;

        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default Enter behavior

            // Add words from user input to dictionary
            addUserInputToDictionary(inputArea.value);

            // Calculate results for the current prompt
            const promptResult = calculatePromptResult();
            promptResults.push(promptResult);

            // Move to the next prompt or end the test
            if (currentPromptIndex < prompts.length - 1) {
                currentPromptIndex++;
                updateCurrentPrompt();
                inputArea.value = '';
                startTime = Date.now(); // Reset start time for the new prompt
            } else {
                // End the test if all prompts are completed
                endTest();
            }
        }
    });

    // Function to perform autocorrect - improved for cross-browser compatibility
    function performAutocorrect(appendChar) {
        try {
            const text = inputArea.value;
            if (text.length > 0) {
                // Get the last word - more robust splitting
                const words = text.trim().split(/[\s.,!?;:"'()]/);
                if (words.length === 0) return false;

                const lastWord = words[words.length - 1].toLowerCase();

                // Skip very short words (1-2 characters)
                if (lastWord.length > 2) {
                    // Find the closest word in the dictionary
                    const correctedWord = findClosestWord(lastWord);

                    // If a correction was found and it's different from the original word
                    if (correctedWord !== lastWord) {
                        // Replace the last word with the corrected one
                        const lastIndex = text.lastIndexOf(lastWord);
                        if (lastIndex !== -1) {
                            const newText = text.substring(0, lastIndex) + correctedWord;

                            // Direct update approach for better cross-browser compatibility
                            inputArea.value = newText + appendChar;

                            // Try to move cursor to the end - wrapped in try/catch for browser compatibility
                            try {
                                inputArea.selectionStart = inputArea.value.length;
                                inputArea.selectionEnd = inputArea.value.length;
                            } catch (e) {
                                // Some browsers might not support selection manipulation
                                console.log("Selection adjustment not supported");
                            }

                            // Hide the indicator after correction
                            hideAutocorrectIndicator();

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

    // Keep the keydown event for desktop browsers only
    // We'll disable this for mobile/VR browsers to avoid conflicts
    if (!isMobileOrVRBrowser()) {
        inputArea.addEventListener('keydown', function(e) {
            if (!testActive) return;

            // Check for space or punctuation
            const punctuation = [' ', '.', ',', '!', '?', ';', ':', '"', "'", '(', ')'];
            const key = e.key || String.fromCharCode(e.keyCode || e.which);

            if (punctuation.includes(key)) {
                // Perform autocorrect and append the pressed character
                try {
                    if (performAutocorrect(key)) {
                        e.preventDefault(); // Prevent default if correction was made
                        // Update the previous value to match the new corrected value
                        // This prevents the input handler from double-correcting
                        previousInputValue = inputArea.value;
                    }
                } catch (error) {
                    console.error("Error in autocorrect keydown handler:", error);
                }
            }
        });
    }

    // Function to detect mobile or VR browsers
    function isMobileOrVRBrowser() {
        // Check for Oculus browser
        const isOculus = /OculusBrowser/i.test(navigator.userAgent);

        // Check for mobile devices
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Check for VR headsets
        const isVR = /VR|XR|Oculus|HTC_VIVE|SamsungGear|Windows Mixed Reality|HoloLens/i.test(navigator.userAgent);

        // Also check for touch support as a fallback
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        return isOculus || isMobile || isVR || hasTouch;
    }

    // Clean up when the test ends
    function cleanupMobileHandlers() {
        if (inputCheckInterval) {
            clearInterval(inputCheckInterval);
            inputCheckInterval = null;
            debugLog("Mobile input check interval stopped", {});
        }
    }

    // Reset button functionality
    startButton.addEventListener('click', function() {
        resetTest();
    });

    function updateTimerDisplay() {
        timer.textContent = `Time: ${timeLeft}s`;
    }

    function endTest() {
        clearInterval(timerInterval);
        testActive = false;

        // Clean up mobile handlers
        cleanupMobileHandlers();

        // Disable the input area so users can't type anymore
        inputArea.disabled = true;

        // Change button text
        startButton.textContent = 'Start New Test';

        // Hide the autocorrect indicator
        hideAutocorrectIndicator();

        // Calculate results for the current prompt if not already done
        if (inputArea.value.trim().length > 0) {
            const promptResult = calculatePromptResult();
            promptResults.push(promptResult);
        }

        // Calculate and display average results
        calculateAverageResults();

        // Display results
        results.style.display = 'block';

        debugLog("Test ended", { promptsCompleted: promptResults.length });
    }

    function resetTest() {
        clearInterval(timerInterval);
        testActive = false;

        // Clean up mobile handlers
        cleanupMobileHandlers();

        timeLeft = 30;
        updateTimerDisplay();
        inputArea.value = '';
        inputArea.disabled = false;
        startButton.textContent = 'Reset Test';
        results.style.display = 'none';
        hideAutocorrectIndicator();

        // Update dictionary with any new prompt words
        addPromptWordsToDictionary();

        // Shuffle prompts for a new test
        shufflePrompts();

        // Reset prompt index and update display
        currentPromptIndex = 0;
        updateCurrentPrompt();
        promptResults = [];

        // Reset tracking variables
        previousInputValue = '';
        lastWordCorrected = false;

        debugLog("Test reset", { mobile: isMobileOrVRBrowser() });
    }

    // Function to add a new prompt to the test
    function addNewPrompt(promptText) {
        // Add the new prompt to the original prompts array
        originalPrompts.push(promptText);

        // Update the dictionary with words from the new prompt
        const words = extractWords(promptText);
        words.forEach(word => {
            if (!dictionary.includes(word)) {
                dictionary.push(word);
            }
        });

        // Update the total prompts count
        totalPromptsElement.textContent = originalPrompts.length;

        console.log("Added new prompt and updated dictionary. Dictionary now has", dictionary.length, "words");

        // Reshuffle prompts to include the new one
        shufflePrompts();
    }

    // Calculate results for the current prompt
    function calculatePromptResult() {
        const typedText = inputArea.value;
        const promptText = getCurrentPromptText();
        const typedLength = typedText.length;
        const promptLength = promptText.length;

        // Use Levenshtein distance to calculate edit distance
        const editDistance = levenshteinDistance(typedText, promptText);

        // Calculate accuracy as 1 minus normalized edit distance
        const maxDistance = Math.max(typedLength, promptLength);
        const normalizedDistance = maxDistance > 0 ? editDistance / maxDistance : 0;
        const accuracy = Math.floor((1 - normalizedDistance) * 100);

        // Calculate correct and incorrect characters
        let correctChars = 0;
        let incorrectChars = 0;

        for (let i = 0; i < typedLength; i++) {
            if (i < promptLength && typedText[i] === promptText[i]) {
                correctChars++;
            } else {
                incorrectChars++;
            }
        }

        // Calculate time spent on this prompt in minutes
        const endTime = Date.now();
        const timeSpentMs = endTime - startTime;
        const minutes = timeSpentMs / 60000; // Convert ms to minutes

        // Calculate WPM and CPM
        const words = typedLength / 5; // Assume average word is 5 characters
        const wpm = minutes > 0 ? Math.floor(words / minutes) : 0;
        const cpm = minutes > 0 ? Math.floor(typedLength / minutes) : 0;

        return {
            promptIndex: currentPromptIndex,
            originalPromptIndex: getCurrentPromptOriginalIndex(),
            promptText: promptText,
            typedText: typedText,
            wpm: wpm,
            cpm: cpm,
            accuracy: accuracy,
            editDistance: editDistance,
            correctChars: correctChars,
            incorrectChars: incorrectChars,
            totalChars: typedLength,
            timeSpentMs: timeSpentMs
        };
    }

    // Calculate average results across all completed prompts
    function calculateAverageResults() {
        if (promptResults.length === 0) {
            return;
        }

        // Calculate averages
        let totalWpm = 0;
        let totalCpm = 0;
        let totalAccuracy = 0;
        let totalCorrectChars = 0;
        let totalIncorrectChars = 0;
        let totalChars = 0;

        promptResults.forEach(result => {
            totalWpm += result.wpm;
            totalCpm += result.cpm;
            totalAccuracy += result.accuracy;
            totalCorrectChars += result.correctChars;
            totalIncorrectChars += result.incorrectChars;
            totalChars += result.totalChars;
        });

        const avgWpm = Math.floor(totalWpm / promptResults.length);
        const avgCpm = Math.floor(totalCpm / promptResults.length);
        const avgAccuracy = Math.floor(totalAccuracy / promptResults.length);

        // Update results display
        wpmElement.textContent = avgWpm;
        cpmElement.textContent = avgCpm;
        accuracyElement.textContent = `${avgAccuracy}%`;
        correctCharsElement.textContent = totalCorrectChars;
        incorrectCharsElement.textContent = totalIncorrectChars;
        document.getElementById('prompts-completed').textContent = promptResults.length;
        document.getElementById('total-prompts-results').textContent = prompts.length;

        // Create results object with both individual prompt results and averages
        const resultsData = {
            date: new Date().toISOString(),
            averageWpm: avgWpm,
            averageCpm: avgCpm,
            averageAccuracy: avgAccuracy,
            totalCorrectChars: totalCorrectChars,
            totalIncorrectChars: totalIncorrectChars,
            totalChars: totalChars,
            promptsCompleted: promptResults.length,
            totalPrompts: prompts.length,
            promptOrder: prompts.map(p => p.originalIndex), // Include the order of prompts in this test
            promptResults: promptResults
        };

        // Download results as JSON
        // downloadResultsAsJson(resultsData);
    }

    function downloadResultsAsJson(data) {
        // Create a JSON string from the data
        const jsonString = JSON.stringify(data, null, 2);

        // Create a Blob with the JSON data
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Create a URL for the Blob
        const url = URL.createObjectURL(blob);

        // Create a temporary link element
        const link = document.createElement('a');
        link.href = url;

        // Set the filename with date
        const date = new Date();
        const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        link.download = `typing-test-results-${formattedDate}.json`;

        // Append the link to the body
        document.body.appendChild(link);

        // Trigger the download
        link.click();

        // Clean up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
});
