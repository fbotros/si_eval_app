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
    const accuracyElement = document.getElementById('accuracy');
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
        userAgent: navigator.userAgent,
        dictionarySize: dictionary.length
    });

    // Start test when user starts typing
    inputArea.addEventListener('input', function(e) {
        if (!testActive) {
            startTest();
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
                performAutocorrect(lastChar);
            }
        }

        // Update the previous value
        previousInputValue = currentValue;
    });


    // Handle Enter key to move to next prompt
    inputArea.addEventListener('keydown', function(e) {
        if (!testActive) return;

        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default Enter behavior

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
            debugLog("Autocorrect triggered", { text, appendChar });
            if (text.length > 0) {
                debugLog("Text length", text.length);
                // Get the last word - more robust splitting
                let words = text.trim().split(/[\s.,!?;:"'()]/);
                debugLog("Words", words);
                // filter out empty strings
                words = words.filter(word => word.length > 0);
                if (words.length === 0) return false;

                const lastWord = words[words.length - 1].toLowerCase();

                // Skip very short words (1-2 characters)
                if (lastWord.length > 2) {
                    // Find the closest word in the dictionary
                    const correctedWord = findClosestWord(lastWord);
                    debugLog("Closest word", correctedWord);

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

        debugLog("Test reset");
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


        // Calculate time spent on this prompt in minutes
        const endTime = Date.now();
        const timeSpentMs = endTime - startTime;
        const minutes = timeSpentMs / 60000; // Convert ms to minutes

        // Calculate WPM
        const words = typedLength / 5; // Assume average word is 5 characters
        const wpm = minutes > 0 ? Math.floor(words / minutes) : 0;

        return {
            promptIndex: currentPromptIndex,
            originalPromptIndex: getCurrentPromptOriginalIndex(),
            promptText: promptText,
            typedText: typedText,
            wpm: wpm,
            accuracy: accuracy,
            editDistance: editDistance,
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
        let totalAccuracy = 0;
        let totalChars = 0;

        promptResults.forEach(result => {
            totalWpm += result.wpm;
            totalAccuracy += result.accuracy;
            totalChars += result.totalChars;
        });

        const avgWpm = Math.floor(totalWpm / promptResults.length);
        const avgAccuracy = Math.floor(totalAccuracy / promptResults.length);

        // Update results display
        wpmElement.textContent = avgWpm;
        accuracyElement.textContent = `${avgAccuracy}%`;
        document.getElementById('prompts-completed').textContent = promptResults.length;
        document.getElementById('total-prompts-results').textContent = prompts.length;

        // Create results object with both individual prompt results and averages
        const resultsData = {
            date: new Date().toISOString(),
            averageWpm: avgWpm,
            averageAccuracy: avgAccuracy,
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
