// Лінивий словник має давати ті самі відповіді, що й повне розгортання nspell.
// Повний словник перевірено один раз (3 396 431 форма, 1,9 млн неслів); тут — кожна 15-та стаття, щоб тест був швидким.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nspell = require('nspell');
const { createSpell } = require('./lazy-spell.js');
const aff = fs.readFileSync('node_modules/dictionary-uk/index.aff', 'utf8');
const lines = fs.readFileSync('node_modules/dictionary-uk/index.dic', 'utf8').split('\n');
const dic = [lines[0], ...lines.slice(1).filter((_, index) => index % 15 === 0)].join('\n');
const full = nspell(aff, dic), lazy = createSpell(aff, dic);
const forms = Object.keys(full.data);

test('лінивий словник приймає всі форми nspell з тими самими прапорцями', () => {
  assert.ok(forms.length > 100000);
  for (const form of forms) assert.deepEqual(lazy.data[form], full.data[form], form);
});

test('лінивий словник не приймає слів, яких немає в nspell', () => {
  const letters = 'аеиіоуяюєїбвгґдзклмнпрстфхцчшщьй';
  for (let index = 0; index < forms.length; index += 3) {
    const form = forms[index];
    for (const word of [form + letters[index % letters.length], form.slice(0, -1), letters[index % 7] + form]) {
      assert.equal(Boolean(lazy.data[word]), Boolean(full.data[word]), word);
    }
  }
});

test('перевірка регістру й варіянти заміни збігаються з nspell', () => {
  for (const word of [forms[100], forms[5000].toUpperCase(), forms[9000][0].toUpperCase() + forms[9000].slice(1), 'помилкка']) {
    assert.equal(lazy.correct(word), full.correct(word), word);
  }
  for (const word of [forms[2000] + 'к', forms[7000].slice(1), 'словнк']) assert.deepEqual(lazy.suggest(word), full.suggest(word), word);
});
