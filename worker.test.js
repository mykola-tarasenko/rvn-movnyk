// Integration checks for the shipped artifact; no browser or network is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const page = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const browserGlobals = { window: {} };
vm.runInNewContext(fs.readFileSync('proofreading-worker.js', 'utf8'), browserGlobals);
const messages = [];
const self = { postMessage: message => messages.push(message) };
vm.runInNewContext(browserGlobals.window.RVN_WORKER_SOURCE, { self });
const send = data => { self.onmessage({ data }); return messages.at(-1); };

test('готовий модуль запускається без мережі та повідомляє готовність', () => {
  assert.equal(messages[0].type, 'ready');
  assert.equal(typeof self.onmessage, 'function');
});

test('готовий модуль перевіряє текст, словник і варіянти заміни', () => {
  const checked = send({ id: 1, type: 'analyze', text: 'Без шерсті та любові. На жаль це помилкка.', personal: [] });
  assert.equal(checked.id, 1);
  assert.equal(checked.error, undefined);
  assert.equal(checked.result.text, 'Без шерсти та любови. На жаль це помилкка.');
  assert.ok(checked.result.issues.some(i => i.type === 'punctuation'));
  assert.ok(checked.result.issues.some(i => i.from === 'помилкка'));
  const choices = send({ id: 2, type: 'suggest', word: 'помилкка' });
  assert.ok(choices.result.includes('помилка'));
});

test('готовий модуль приймає параметри і персональні винятки', () => {
  const checked = send({ id: 3, type: 'analyze', text: 'РВН-Лабікс без любові.', options: { ending: false }, personal: ['РВН-Лабікс'] });
  assert.equal(checked.result.text, 'РВН-Лабікс без любові.');
  assert.equal(checked.result.issues.length, 0);
});

test('автономний модуль показує числівники й не застосовує вилучене правило про монархів', () => {
  const checked = send({ id: 4, type: 'analyze', text: '22 документів. Імператриця Росії Катерина.', personal: [] });
  assert.ok(checked.result.issues.some(item => item.type === 'number' && item.from === 'документів' && item.replacements.includes('документи')));
  assert.equal(checked.result.issues.filter(item => item.message.includes('російського монарха')).length, 0);
});

test('елементи сторінки відповідають обробникам, скрипти мають коректний синтаксис', () => {
  const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'Унікальні ідентифікатори');
  for (const match of app.matchAll(/\$\('#([\w-]+)'\)/g)) assert.ok(ids.includes(match[1]), match[1]);
  for (const match of page.matchAll(/<script src="([^"]+)"/g)) assert.ok(fs.existsSync(match[1]), match[1]);
  assert.equal([...page.matchAll(/\bdata-rule="/g)].length, 9);
  assert.doesNotThrow(() => new vm.Script(app));
});
