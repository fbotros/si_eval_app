document.addEventListener('DOMContentLoaded', async function () {
    function getURLParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    let surfaceDifference = -1;

    // Array of prompts for the typing test - loaded from prompts.txt
    let originalPrompts = [];

    // Counters for tracking during a prompt
    let keyPressCount = 0;
    let correctedErrorCount = 0;

    // Autocorrect modes enum
    const AUTOCORRECT_MODE = {
        OFF: 'OFF',       // Turn off autocorrect completely
        SYSTEM: 'SYSTEM', // Use OS/browser autocorrect
        CUSTOM: 'CUSTOM'  // Use our custom autocorrect implementation
    };

    // Number of prompts to use per test (default: 5)
    let maxPromptsPerTest = 5;

    // Configuration for dataset-specific settings
    const datasetConfig = {
        'practice': {
            file: 'prompts/practice.txt',
            autocorrect: AUTOCORRECT_MODE.CUSTOM
        },
        'natural-language': {
            file: 'prompts/nat_lang_no_punc.txt',
            autocorrect: AUTOCORRECT_MODE.CUSTOM
        },
        'natural-language-punct': {
            file: 'prompts/nat_lang_with_cap_punc.txt',
            autocorrect: AUTOCORRECT_MODE.CUSTOM
        },
        'emails': {
            file: 'prompts/emails.txt',
            autocorrect: AUTOCORRECT_MODE.OFF
        },
        'passwords': {
            file: 'prompts/passwords.txt',
            autocorrect: AUTOCORRECT_MODE.OFF
        },
        'metal-keys': {
            file: 'prompts/metal_keys.txt',
            autocorrect: AUTOCORRECT_MODE.OFF
        }
    };

    // Function to get the selected dataset filename
    function getSelectedDatasetFile() {
        const selectedDataset = document.querySelector('input[name="dataset"]:checked');
        if (!selectedDataset) {
            return datasetConfig['practice'].file; // Default fallback
        }

        const config = datasetConfig[selectedDataset.value];
        return config ? config.file : datasetConfig['practice'].file; // Default fallback
    }

    // Track user-selected autocorrect mode (initialize with CUSTOM as default)
    let userSelectedAutocorrectMode = AUTOCORRECT_MODE.CUSTOM;

    // Track QA Mode state (initialize with false as default - off)
    let qaMode = false;

    // Function to get the autocorrect mode for the current dataset
    function getAutocorrectMode() {
        // Always use the user-selected mode
        return userSelectedAutocorrectMode;
    }

    // Function to update the autocorrect radio buttons to match the given mode
    function updateAutocorrectRadioButtons(mode) {
        // Find the radio button that corresponds to the mode
        let radioId;
        switch (mode) {
            case AUTOCORRECT_MODE.OFF:
                radioId = 'autocorrect-off';
                break;
            case AUTOCORRECT_MODE.SYSTEM:
                radioId = 'autocorrect-system';
                break;
            case AUTOCORRECT_MODE.CUSTOM:
            default:
                radioId = 'autocorrect-custom';
                break;
        }

        // Set the corresponding radio button as checked
        document.getElementById(radioId).checked = true;
    }

    // Function to enable/disable autocorrect radio buttons
    function setAutocorrectRadioButtonsEnabled(enabled) {
        const autocorrectRadios = document.querySelectorAll('input[name="autocorrect-mode"]');
        autocorrectRadios.forEach(radio => {
            radio.disabled = !enabled;
        });
    }

    // Function to check if custom autocorrect is enabled for the current dataset
    function isCustomAutocorrectEnabled() {
        return getAutocorrectMode() === AUTOCORRECT_MODE.CUSTOM;
    }

    // Helper function to get dataset configuration
    function getDatasetConfig(datasetName) {
        return datasetConfig[datasetName] || { file: 'prompts/practice.txt', autocorrect: true }; // Default config
    }

    // Function to load prompts from the selected dataset file
    async function loadPromptsFromFile() {
        try {
            const filename = getSelectedDatasetFile();
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            // Split by lines and filter out empty lines
            originalPrompts = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            return originalPrompts;
        } catch (error) {
            console.error('Error loading prompts from file:', error);
            // throw dialog box with error message
            alert(`Error loading prompts from file: ${error.message}`);
            return [];
        }
    }

    // Function to initialize prompts for testing (shuffle, limit, and update UI)
    function initializePromptsForTest() {
        // Create a fresh copy with index tracking
        prompts = originalPrompts.map((text, index) => ({
            text: text,
            originalIndex: index
        }));
        shuffleArray(prompts);

        // Limit to MAX_PROMPTS_PER_TEST prompts
        prompts = prompts.slice(0, maxPromptsPerTest);

        // Update UI
        totalPromptsElement.textContent = prompts.length;
        currentPromptIndex = 0;
        updateCurrentPrompt();
    }

    // Function to reload prompts when dataset changes
    async function reloadPromptsForNewDataset() {
        // Reset test state
        testActive = false;
        inputArea.value = '';
        inputArea.disabled = false;
        startButton.textContent = 'Reset Test';
        results.style.display = 'none';

        // Load new prompts
        await loadPromptsFromFile();

        // Update dictionary with new prompt words
        addPromptWordsToDictionary();

        // Initialize prompts for testing
        initializePromptsForTest();
        promptResults = [];

        // Reset tracking variables
        previousInputValue = '';
        lastWordCorrected = false;
        promptTimingStarted = false;

        // Focus the input area after reload
        inputArea.focus();
    }

    // Create a copy of the prompts that we'll shuffle
    let prompts = [];

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

    function updateCurrentPrompt() {
        currentPromptElement.textContent = currentPromptIndex + 1;
        sampleTextElement.innerText = prompts[currentPromptIndex].text;

        // Update QA Mode display if enabled
        updateQAModeDisplay();
    }

    // Get the current prompt text
    function getCurrentPromptText() {
        return prompts[currentPromptIndex].text;
    }

    // Get the current prompt's original index
    function getCurrentPromptOriginalIndex() {
        return prompts[currentPromptIndex].originalIndex;
    }

    // Function to update QA Mode display
    function updateQAModeDisplay() {
        const sampleTextElement = document.getElementById('sample-text');
        const sampleTextHighlighted = document.getElementById('sample-text-highlighted');

        if (qaMode) {
            // Hide normal sample text, show highlighted version
            sampleTextElement.style.display = 'none';
            sampleTextHighlighted.style.display = 'block';

            // Initialize with the current prompt
            updateQAHighlighting('');
        } else {
            // Show normal sample text, hide highlighted version
            sampleTextElement.style.display = 'block';
            sampleTextHighlighted.style.display = 'none';
        }
    }

    // Function to update QA Mode highlighting based on typed text
    function updateQAHighlighting(typedText) {
        if (!qaMode) return;

        const sampleTextHighlighted = document.getElementById('sample-text-highlighted');
        const promptText = getCurrentPromptText();

        let highlightedHtml = '';

        for (let i = 0; i < promptText.length; i++) {
            const promptChar = promptText[i];
            let className = 'char-untyped';

            if (i < typedText.length) {
                const typedChar = typedText[i];
                if (typedChar === promptChar) {
                    className = 'char-correct';
                } else {
                    className = 'char-incorrect';
                }
            }

            // Handle special characters for HTML
            let displayChar = promptChar;
            if (promptChar === ' ') {
                displayChar = '&nbsp;';
            } else if (promptChar === '<') {
                displayChar = '&lt;';
            } else if (promptChar === '>') {
                displayChar = '&gt;';
            } else if (promptChar === '&') {
                displayChar = '&amp;';
            }

            highlightedHtml += `<span class="${className}">${displayChar}</span>`;
        }

        sampleTextHighlighted.innerHTML = highlightedHtml;
    }

    const inputArea = document.getElementById('input-area');
    const startButton = document.getElementById('start-button');
    const results = document.getElementById('results');
    const wpmElement = document.getElementById('wpm');
    const accuracyElement = document.getElementById('accuracy');

    let testActive = false;
    let lastTypedWord = '';
    let lastSuggestion = '';
    let startTime = 0; // Track when the current prompt started
    let promptTimingStarted = false; // Track if timing has started for current prompt

    // Function to start the test
    function startTest() {
        if (testActive) return;

        // Start the test
        testActive = true;
        results.style.display = 'none';
        promptResults = []; // Clear previous results
        promptTimingStarted = false; // Reset timing flag

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
    ];

    // Use the window property as our dictionary
    let dictionary = window.typingTestDictionary;
    // Performance optimization: Convert dictionary to Set for faster lookups
    let dictionarySet = new Set(dictionary);

    // Function to extract words from a string
    function extractWords(text) {
        // Split by punctuation and spaces
        return text.toLowerCase()
            .split(/[\s.,!?;:"()]+/)
            .filter(word => word.length > 0);
    }

    // Function to add all words from prompts to the dictionary
    function addPromptWordsToDictionary() {
        // Reset dictionary to base dictionary
        dictionary = [...window.typingTestDictionary];
        dictionarySet = new Set(dictionary);

        // Extract all words from all prompts
        originalPrompts.forEach(prompt => {
            const words = extractWords(prompt);
            words.forEach(word => {
                // Add word to dictionary if it's not already there
                if (!dictionarySet.has(word)) {
                    dictionary.push(word);
                    dictionarySet.add(word);
                }
            });
        });

        // Make the dictionary accessible for debugging
        window.getDictionary = function () {
            return dictionary;
        };

        // Add a function to test the autocorrect
        window.testAutocorrect = function (word) {
            const corrected = findClosestWord(word);
            return corrected;
        };
    }

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
        // If the word is already in the dictionary, return it (using Set for O(1) lookup)
        if (dictionarySet.has(word)) {
            return word;
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

    // Track the previous input value to detect changes
    let previousInputValue = '';
    let lastWordCorrected = false;

    // Load prompts from file and initialize the app
    await loadPromptsFromFile();

    // Add prompt words to dictionary after loading prompts
    addPromptWordsToDictionary();

    // Initialize prompts for testing
    initializePromptsForTest();

    // Initialize prompt count input with default value
    document.getElementById('prompt-count').value = maxPromptsPerTest;

    // Add event listeners for prompt count controls
    const promptCountInput = document.getElementById('prompt-count');
    const decreasePromptsButton = document.getElementById('decrease-prompts');
    const increasePromptsButton = document.getElementById('increase-prompts');

    // Function to update the prompt count
    function updatePromptCount(newCount) {
        // Ensure the count is within valid range (1-20)
        newCount = Math.max(1, Math.min(100, newCount));

        // Update the input value
        promptCountInput.value = newCount;

        // Update the maxPromptsPerTest variable
        maxPromptsPerTest = newCount;

        // Reset the test to apply the new prompt count
        resetTest();
    }

    // Function to handle decrease button action
    function decreasePromptCount() {
        updatePromptCount(parseInt(promptCountInput.value) - 1);
    }

    // Function to handle increase button action
    function increasePromptCount() {
        updatePromptCount(parseInt(promptCountInput.value) + 1);
    }

    // Event listeners for the decrease button (both click and touch)
    decreasePromptsButton.addEventListener('click', decreasePromptCount);
    decreasePromptsButton.addEventListener('touchstart', function (e) {
        e.preventDefault(); // Prevent default touch behavior
        decreasePromptCount();
    }, { passive: true });

    // Event listeners for the increase button (both click and touch)
    increasePromptsButton.addEventListener('click', increasePromptCount);
    increasePromptsButton.addEventListener('touchstart', function (e) {
        e.preventDefault(); // Prevent default touch behavior
        increasePromptCount();
    }, { passive: true });

    // Event listener for direct input changes
    promptCountInput.addEventListener('change', function () {
        updatePromptCount(parseInt(this.value));
    });

    // Add event listeners for dataset radio buttons
    const datasetRadios = document.querySelectorAll('input[name="dataset"]');
    datasetRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.checked) {
                // Only change autocorrect settings if QA Mode is not enabled
                if (!qaMode) {
                    // Get the dataset's default autocorrect mode
                    const datasetValue = this.value;
                    const config = datasetConfig[datasetValue];
                    const datasetAutocorrectMode = config ? config.autocorrect : AUTOCORRECT_MODE.CUSTOM;

                    // Update the user-selected mode to match the dataset's default
                    userSelectedAutocorrectMode = datasetAutocorrectMode;

                    // Update the radio buttons to reflect the dataset's default mode
                    updateAutocorrectRadioButtons(datasetAutocorrectMode);
                }

                // Update input area configuration when dataset changes
                configureInputArea();
                reloadPromptsForNewDataset();
            }
        });
    });

    let inputType = 'physical-keyboard';
    // Function to enable/disable autocorrect radio buttons
    function setInputTypeRadioButtonsEnabled(enabled) {
        const inputTypeRadios = document.querySelectorAll('input[name="input-type"]');
        inputTypeRadios.forEach(radio => {
            radio.disabled = !enabled;
        });
    }

    // Add event listeners for dataset radio buttons
    const inputTypeRadios = document.querySelectorAll('input[name="input-type"]');
    inputTypeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.checked) {
                inputType = this.value;
            }
        });
    });

    // Add event listeners for autocorrect mode radio buttons
    const autocorrectRadios = document.querySelectorAll('input[name="autocorrect-mode"]');
    autocorrectRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.checked) {
                // Set the user-selected autocorrect mode based on the radio value
                switch (this.value) {
                    case 'off':
                        userSelectedAutocorrectMode = AUTOCORRECT_MODE.OFF;
                        break;
                    case 'system':
                        userSelectedAutocorrectMode = AUTOCORRECT_MODE.SYSTEM;
                        break;
                    case 'custom':
                    default:
                        userSelectedAutocorrectMode = AUTOCORRECT_MODE.CUSTOM;
                        break;
                }

                // Update input area configuration when autocorrect mode changes
                configureInputArea();

                // Reset the test when autocorrect mode changes
                resetTest();

                // If switching to custom mode, ensure dictionary is updated with prompt words
                if (userSelectedAutocorrectMode === AUTOCORRECT_MODE.CUSTOM) {
                    addPromptWordsToDictionary();
                }
            }
        });
    });

    function qaModeChanged(enabled) {
        if (enabled) {
            // If QA Mode is enabled, set autocorrect to off and disable autocorrect selection
            userSelectedAutocorrectMode = AUTOCORRECT_MODE.OFF;
            updateAutocorrectRadioButtons(AUTOCORRECT_MODE.OFF);
            setAutocorrectRadioButtonsEnabled(false);
            configureInputArea();
        } else {
            // If QA Mode is disabled, re-enable autocorrect selection
            setAutocorrectRadioButtonsEnabled(true);
        }

        // Update QA Mode display immediately
        updateQAModeDisplay();

        // Reset the test when QA Mode changes
        resetTest();
    }

    // Add event listeners for QA Mode radio buttons
    const qaModeRadios = document.querySelectorAll('input[name="qa-mode"]');
    qaModeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.checked) {
                qaMode = this.value === 'on';
                qaModeChanged(qaMode);
            }
        });
    });

    function checkSettingPresetInUrlParameter() {
        let value = getURLParameter('setting_preset')
        if (value == null) {
            return;
        }

        value = value.toLowerCase();
        if (value === 'qa') {
            document.getElementById("qa-mode-on").checked = true;
            qaMode = true;
            qaModeChanged(qaMode);
        }
        else if (value === 'uxr_pc') {
            inputType = "physical-keyboard";
            document.getElementById("physical-keyboard").checked = true;
            setInputTypeRadioButtonsEnabled(false);
            updatePromptCount(100);

            document.addEventListener('promptFinishedEvent', function (e) {
                submitPromptResultToGoogleForm(e.detail.message);
            });
        }
        else if (value === 'uxr_webview') {
            inputType = "skb";
            document.getElementById("skb").checked = true;
            setInputTypeRadioButtonsEnabled(false);
            updatePromptCount(100);

            // register listener for data passed to WebView from Unity
            window.addEventListener('vuplexmessage', event => {
                const surfaces = JSON.parse(event.value);
                console.log("received surfaces: " + surfaces.handBasedSurface + ", " + surfaces.fiducialBasedSurface);
                if (surfaces.handBasedSurface && surfaces.fiducialBasedSurface) {
                    surfaceDifference = surfaces.handBasedSurface - surfaces.fiducialBasedSurface;
                }
            });

            document.addEventListener('promptFinishedEvent', function (e) {
                if (surfaceDifference != -1) {
                    let result = e.detail.message;
                    result['surfaceDifference'] = surfaceDifference;
                    submitPromptResultToGoogleForm(result);
                }
                else {
                    submitPromptResultToGoogleForm(e.detail.message);
                }
            });
        }
    }

    checkSettingPresetInUrlParameter();

    // Optimized input event handler
    // Configure input area based on autocorrect mode
    function configureInputArea() {
        const mode = getAutocorrectMode();

        // Configure spellcheck attribute based on autocorrect mode
        if (mode === AUTOCORRECT_MODE.SYSTEM) {
            inputArea.setAttribute('spellcheck', 'true');
            inputArea.setAttribute('autocorrect', 'on');
            inputArea.setAttribute('autocomplete', 'on');
        } else {
            // For both OFF and CUSTOM modes, disable browser's built-in features
            inputArea.setAttribute('spellcheck', 'false');
            inputArea.setAttribute('autocorrect', 'off');
            inputArea.setAttribute('autocomplete', 'off');
        }
    }

    // Configure input area on page load
    configureInputArea();

    // Track input value changes for cross-browser compatibility
    let previousInputLength = 0;

    // Handle all input events in a single handler for better cross-browser compatibility
    inputArea.addEventListener('input', function () {
        if (!testActive) {
            startTest();
            previousInputLength = 0;
        }

        // Start timing for current prompt on first keystroke
        if (!promptTimingStarted) {
            startTime = Date.now();
            promptTimingStarted = true;
        }

        // Get the current input value and length
        const currentValue = inputArea.value;
        const currentLength = currentValue.length;

        // Reset the correction flag if the user is typing a new character
        if (currentLength > previousInputLength) {
            lastWordCorrected = false;

            // Count the difference as key presses (not backspace)
            const charsAdded = currentLength - previousInputLength;
            keyPressCount += charsAdded;

            // Check if a space or punctuation was added for autocorrect
            const lastChar = currentValue.slice(-1);
            if (/[\s.,.!?;:"()]/.test(lastChar) && isCustomAutocorrectEnabled() && !lastWordCorrected) {
                performAutocorrect(lastChar);
            }
        }
        // If length decreased, count as corrected error (backspace)
        else if (currentLength < previousInputLength) {
            // Count as one corrected error regardless of how many characters were deleted
            correctedErrorCount += 1;
        }

        // Update previous values for next comparison
        previousInputValue = currentValue;
        previousInputLength = currentLength;

        // Update QA Mode highlighting if enabled
        if (qaMode) {
            updateQAHighlighting(currentValue);
        }
    });

    // Handle key presses for Enter key
    inputArea.addEventListener('keydown', function (e) {
        if (!testActive) return;

        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default Enter behavior

            const typedText = inputArea.value;
            const promptText = getCurrentPromptText();

            // Check QA Mode - if enabled, require 100% match
            if (qaMode) {
                if (typedText !== promptText) {
                    // Show error message for QA Mode mismatch
                    const qaErrorElement = document.getElementById('qa-error-message');
                    qaErrorElement.style.display = 'block';
                    return; // Don't proceed to next prompt
                }
            }

            // Check if typed text is less than 80% of target prompt length
            const minRequiredLength = Math.ceil(promptText.length * 0.8);
            if (typedText.length < minRequiredLength) {
                // Show error message for insufficient length
                const lengthErrorElement = document.getElementById('length-error-message');
                lengthErrorElement.style.display = 'block';
                // Hide QA error message if it was showing
                const qaErrorElement = document.getElementById('qa-error-message');
                qaErrorElement.style.display = 'none';
                return; // Don't proceed to next prompt
            }

            // Hide error messages if we get here (validation passed)
            const qaErrorElement = document.getElementById('qa-error-message');
            const lengthErrorElement = document.getElementById('length-error-message');
            qaErrorElement.style.display = 'none';
            lengthErrorElement.style.display = 'none';

            // Calculate results for the current prompt
            const promptResult = calculatePromptResult();
            promptResults.push(promptResult);

            // Move to the next prompt or end the test
            if (currentPromptIndex < prompts.length - 1) {
                currentPromptIndex++;
                updateCurrentPrompt();
                inputArea.value = '';
                promptTimingStarted = false; // Reset timing flag for new prompt
                previousInputValue = ''; // Reset input value for new prompt
                previousInputLength = 0; // Reset input length for new prompt

                // Reset counters for new prompt
                keyPressCount = 0;
                correctedErrorCount = 0;
            } else {
                // End the test if all prompts are completed
                endTest();
            }
        }
    });

    // Optimized autocorrect function
    function performAutocorrect(appendChar) {
        try {
            const text = inputArea.value;
            if (text.length > 0) {
                // Get the last word - more robust splitting
                let words = text.trim().split(/[\s.,.!?;:"'()]/);
                // filter out empty strings
                words = words.filter(word => word.length > 0);
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
    startButton.addEventListener('click', function () {
        resetTest();
    });

    function endTest() {
        testActive = false;

        // Disable the input area so users can't type anymore
        inputArea.disabled = true;

        // Change button text
        startButton.textContent = 'Start New Test';

        // Calculate and display average results
        calculateAverageResults();

        // Display results
        results.style.display = 'block';
    }

    function resetTest() {
        testActive = false;

        inputArea.value = '';
        inputArea.disabled = false;
        startButton.textContent = 'Reset Test';
        results.style.display = 'none';

        // Update dictionary with any new prompt words
        addPromptWordsToDictionary();

        // Initialize prompts for testing
        initializePromptsForTest();
        promptResults = [];

        // Reset tracking variables
        previousInputValue = '';
        lastWordCorrected = false;
        promptTimingStarted = false;

        // Reset counters
        keyPressCount = 0;
        correctedErrorCount = 0;

        // Focus the input area after reset
        inputArea.focus();
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
        const accuracy = (1 - normalizedDistance) * 100;

        // Calculate time spent on this prompt in minutes
        const endTime = Date.now();
        const timeSpentMs = endTime - startTime;
        const minutes = timeSpentMs / 60000; // Convert ms to minutes

        // Calculate error metrics
        const correct = keyPressCount - correctedErrorCount;
        const incorrect_fixed = correctedErrorCount;
        const incorrect_not_fixed = editDistance;
        const denominator = correct + incorrect_fixed + incorrect_not_fixed;
        const ter = denominator > 0 ? (incorrect_fixed + incorrect_not_fixed) / denominator : 0;
        const uer = denominator > 0 ? incorrect_not_fixed / denominator : 0;
        const cer = denominator > 0 ? incorrect_fixed / denominator : 0;

        // Calculate WPM
        const words = (typedLength-1) / 5; // Assume average word is 5 characters
        const wpm = minutes > 0 ? words / minutes : 0;
        const awpm = wpm * (1 - uer); // Adjusted WPM based on uncorrected errors

        const promptResult = {
            promptIndex: currentPromptIndex,
            originalPromptIndex: getCurrentPromptOriginalIndex(),
            promptText: promptText,
            typedText: typedText,
            wpm: wpm,
            awpm: awpm,
            accuracy: accuracy,
            editDistance: editDistance,
            totalChars: typedLength,
            timeSpentMs: timeSpentMs,
            keyPresses: keyPressCount,
            correctedErrors: correctedErrorCount,
            uncorrectedErrors: editDistance,
            ter: ter,
            uer: uer,
            cer: cer
        };

        const promptFinishedEvent = new CustomEvent('promptFinishedEvent', {
            detail: { message: promptResult },
        });
        document.dispatchEvent(promptFinishedEvent);

        return promptResult;
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
        let totalUncorrectedErrors = 0;
        let totalCorrectedErrors = 0;
        let totalKeyPresses = 0;

        promptResults.forEach(result => {
            totalWpm += result.wpm;
            totalAccuracy += result.accuracy;
            totalChars += result.totalChars;
            totalUncorrectedErrors += result.uncorrectedErrors;
            totalCorrectedErrors += result.correctedErrors;
            totalKeyPresses += result.keyPresses;
        });

        const avgWpm = totalWpm / promptResults.length;
        const avgAccuracy = totalAccuracy / promptResults.length;

        // Calculate additional metrics
        const avgAwpm = avgWpm * (avgAccuracy / 100); // Adjusted WPM based on accuracy

        // Calculate error rates
        const totalTypedChars = totalKeyPresses;
        const uerValue = totalTypedChars > 0 ? (totalUncorrectedErrors / totalTypedChars) * 100 : 0;
        const cerValue = totalTypedChars > 0 ? (totalCorrectedErrors / totalTypedChars) * 100 : 0;
        const terValue = totalTypedChars > 0 ? ((totalUncorrectedErrors + totalCorrectedErrors) / totalTypedChars) * 100 : 0;

        // Format error rates to 2 decimal places
        const uer = uerValue.toFixed(2);
        const cer = cerValue.toFixed(2);
        const ter = terValue.toFixed(2);

        // Update results display
        wpmElement.textContent = avgWpm.toFixed(1);
        document.getElementById('awpm').textContent = avgAwpm.toFixed(1);
        accuracyElement.textContent = `${avgAccuracy.toFixed(1)}%`;
        document.getElementById('uer').textContent = `${uer}%`;
        document.getElementById('cer').textContent = `${cer}%`;
        document.getElementById('ter').textContent = `${ter}%`;

        // Create results object with both individual prompt results and averages
        const resultsData = {
            date: new Date().toISOString(),
            averageWpm: avgWpm,
            averageAwpm: avgAwpm,
            averageAccuracy: avgAccuracy,
            uer: parseFloat(uer),
            cer: parseFloat(cer),
            ter: parseFloat(ter),
            totalChars: totalChars,
            totalKeyPresses: totalKeyPresses,
            totalCorrectedErrors: totalCorrectedErrors,
            totalUncorrectedErrors: totalUncorrectedErrors,
            promptsCompleted: promptResults.length,
            totalPrompts: prompts.length,
            promptOrder: prompts.map(p => p.originalIndex), // Include the order of prompts in this test
            promptResults: promptResults,
            inputType: inputType,
            userId: document.getElementById('user-id').value,
        };

        /*
        const testFinishedEvent = new CustomEvent('testFinishedEvent', {
            detail: { message: resultsData },
        });
        document.dispatchEvent(testFinishedEvent);
        */
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

    function submitPromptResultToGoogleForm(data) {
        const form = document.getElementById('resultForm');
        if (!form.dataset.submitHandlerAdded) {
            form.addEventListener('submit', (e) => {
                e.preventDefault(); // Prevent redirection to new page
                const formData = new FormData(form);
                fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    mode: 'no-cors' // Google Forms requires no-cors mode
                })
                    .then(() => {
                        console.log('Form submitted successfully');
                    })
                    .catch((error) => {
                        console.error('Error submitting form:', error);
                    });
            });
            form.dataset.submitHandlerAdded = 'true';
        }

        // Populate the form fields
        document.getElementById('result_user_id').value = document.getElementById('user-id').value;
        document.getElementById('result_corpus').value = document.querySelector('input[name="dataset"]:checked').value;
        document.getElementById('result_input_type').value = inputType;
        document.getElementById('result_auto_correct').value = getAutocorrectMode();
        document.getElementById('result_expected_prompt').value = data.promptText;
        document.getElementById('result_typed_prompt').value = data.typedText;
        document.getElementById('result_wpm').value = data.wpm;
        document.getElementById('result_awpm').value = data.awpm;
        document.getElementById('result_accuracy').value = data.accuracy;
        document.getElementById('result_time_spent_ms').value = data.timeSpentMs;
        document.getElementById('result_uer').value = data.uer;
        document.getElementById('result_cer').value = data.cer;
        document.getElementById('result_ter').value = data.ter;
        document.getElementById('result_total_chars').value = data.totalChars;
        document.getElementById('result_total_key_presses').value = data.keyPresses;
        document.getElementById('result_total_corrected_errors').value = data.correctedErrors;
        document.getElementById('result_total_uncorrected_errors').value = data.uncorrectedErrors;
        document.getElementById('result_surface_difference').value = data.surfaceDifference;
        document.getElementById('result_platform').value = getURLParameter('platform');

        console.log("Submitting prompt result to Google Form: " + JSON.stringify(data));

        // Dispatch a synthetic submit event
        form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
});
