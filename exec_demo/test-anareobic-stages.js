const fs = require('fs');
const path = require('path');
const AutocorrectEngine = require('./AutocorrectEngine');
const TrieDictionary = require('./TrieDictionary');

global.TrieDictionary = TrieDictionary;

async function loadDictionary() {
  const dictPath = path.join(__dirname, 'hybrid_dictionary.txt');
  const content = fs.readFileSync(dictPath, 'utf-8');
  return content.split('\n')
    .map(word => word.trim().toLowerCase())
    .filter(word => word.length > 0);
}

async function test() {
  console.log('Testing each stage of typing "anareobic"...\n');

  const dictionary = await loadDictionary();
  const engine = new AutocorrectEngine({
    baseWords: dictionary,
    keyboardNeighbors: {},
    maxEditDistance: 2,
    enableWordSplitting: true
  });

  const stages = [
    'a', 'an', 'ana', 'anar', 'anare', 'anareo', 'anareob', 'anareob', 'anareobic'
  ];

  console.log('Testing findClosestWord() at each stage:\n');
  for (const stage of stages) {
    const correction = engine.findClosestWord(stage);
    const split = engine.findTwoWordSplit(stage);
    console.log(`"${stage}" -> "${correction}" | Split: ${split ? `"${split.firstWord} ${split.secondWord}"` : 'null'}`);
  }

  console.log('\n\nTesting findClosestWordForPreview() at each stage:\n');
  for (const stage of stages) {
    const preview = engine.findClosestWordForPreview(stage);
    console.log(`"${stage}" -> "${preview}"`);
  }
}

test().catch(console.error);
