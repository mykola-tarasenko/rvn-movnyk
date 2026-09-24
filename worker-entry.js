'use strict';
const nspell = require('nspell');
const { aff, dic } = require('rvn-dictionary');
const { create } = require('./proofreader.js');
let proofreader;
try {
  proofreader = create(nspell(aff, dic));
  self.postMessage({ type: 'ready' });
} catch (error) {
  self.postMessage({ type: 'init-error', error: error.message });
}
self.onmessage = event => {
  const { id, type, text, word, options, personal, shared } = event.data;
  try {
    if (!proofreader) throw new Error('Словник не завантажено.');
    const result = type === 'suggest' ? proofreader.suggestions(word, options) : proofreader.analyze(text, options, personal, shared);
    self.postMessage({ id, type, result });
  } catch (error) {
    self.postMessage({ id, type, error: error.message });
  }
};
