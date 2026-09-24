const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = require('./engine.js');
const { create } = require('./proofreader.js');
const spell = require('nspell')(
  fs.readFileSync('node_modules/dictionary-uk/index.aff', 'utf8'),
  fs.readFileSync('node_modules/dictionary-uk/index.dic', 'utf8')
);
const proofreader = create(spell);
const analyze = (text, options) => proofreader.analyze(text, options);

test('родовий у різних конструкціях, включно з означеннями й переліками', () => {
  const pairs = [
    ['Почуття власної гідності.', 'Почуття власної гідности.'],
    ['Рівень відповідальності.', 'Рівень відповідальности.'],
    ['День незалежності.', 'День незалежности.'],
    ['Без її великої любові й радості.', 'Без її великої любови й радости.'],
    ['Не було жодної можливості.', 'Не було жодної можливости.'],
    ['Потребує справедливості.', 'Потребує справедливости.'],
    ['Заради честі та совісті.', 'Заради чести та совісти.'],
    ['За відсутності можливості.', 'За відсутности можливости.'],
    ['Для повного імені.', 'Для повного імени.'],
    ['Без шерсті та кості.', 'Без шерсти та кости.']
  ];
  for (const [from, to] of pairs) assert.equal(engine.edit(from).text, to, from);
});

test('давальний, місцевий, паузи й неоднозначні форми', () => {
  for (const text of ['Завдяки можливості.', 'У власній гідності.', 'Всупереч необхідності.', 'Раділи можливості.', 'У її любові.']) {
    const result = analyze(text, { euphony: false });
    assert.equal(result.text, text);
    assert.equal(result.issues.filter(i => i.type === 'case').length, 0, text);
  }
  const ambiguous = analyze('Її любові.');
  assert.equal(ambiguous.text, 'Її любові.');
  assert.ok(ambiguous.issues.some(i => i.type === 'case' && i.replacements.includes('любови')));
  assert.equal(engine.edit('Без радості. Любові вистачає.').text, 'Без радости. Любові вистачає.');
});

test('український словник знаходить друкарську помилку і приймає форми РВН', () => {
  const result = analyze('Це помилкка. Иншого аґента цікавлять матеріяли та почуття гідности.');
  assert.deepEqual(result.issues.filter(i => i.type === 'spelling').map(i => i.from), ['помилкка']);
  assert.ok(proofreader.suggestions('помилкка').includes('помилка'));
  const personal = proofreader.analyze('Тестоназва.', {}, ['Тестоназва']);
  assert.equal(personal.issues.filter(i => i.type === 'spelling').length, 0);
  const custom = proofreader.analyze('РВН-Лабікс. РВНLab.', {}, ['РВН-Лабікс', 'РВНLab']);
  assert.equal(custom.issues.filter(i => i.type === 'spelling').length, 0);
});

test('спільні винятки доступні всім без особистого словника', () => {
  const result = analyze('Без пам\'яті немає донату. Приуроченого заходу ім. Шевченка.', { euphony: false });
  assert.equal(result.text, 'Без пам’яти немає донату. Приуроченого заходу ім. Шевченка.');
  assert.deepEqual(result.issues.filter(i => i.type === 'spelling').map(i => i.from), []);
  assert.equal(analyze('Завдяки пам\'яті.', { euphony: false }).text, 'Завдяки пам’яті.');
  assert.equal(analyze('Донати приурочені до заходу.', { euphony: false }).issues.filter(i => i.type === 'spelling').length, 0);
});

test('нові слова РВН не отримують хибних помилок словника', () => {
  const result = analyze('Коцюбіїв. Давним-давно сториз у директі. Без багатоголосности й одеськости. Меморіяльний проєкт і медіяпростір.', { euphony: false });
  assert.deepEqual(result.issues.filter(item => item.type === 'spelling').map(item => item.from), []);
});

test('імена монархів не отримують колишніх редакційних підказок', () => {
  const result = analyze('Імператор Росії Олександр і імператриця Росії Катерина.', { euphony: false });
  assert.equal(result.issues.filter(item => item.message.includes('російського монарха')).length, 0);
});

test('цифри й числівники словами узгоджуються з іменниками', () => {
  const cases = [
    ['1 документи', 'документи', 'документ'],
    ['2 документа', 'документа', 'документи'],
    ['5 документи', 'документи', 'документів'],
    ['11 документи', 'документи', 'документів'],
    ['нуль документи', 'документи', 'документів'],
    ['21 документів', 'документів', 'документ'],
    ['22 документів', 'документів', 'документи'],
    ['112 документи', 'документи', 'документів'],
    ['101 документів', 'документів', 'документ'],
    ['1 234 документів', 'документів', 'документи'],
    ['двадцять одна книг', 'книг', 'книга'],
    ['двадцять три книга', 'книга', 'книги'],
    ['сто одинадцять книги', 'книги', 'книг'],
    ['дванадцять книги', 'книги', 'книг'],
    ['дві тисячі двадцять одна книг', 'книг', 'книга'],
    ['три подій', 'подій', 'події'],
    ['п’ять події', 'події', 'подій'],
    ['2 зошитів', 'зошитів', 'зошити'],
    ['5 зошити', 'зошити', 'зошитів'],
    ['півтора години', 'півтора', 'півтори'],
    ['1,5 років', 'років', 'року']
  ];
  for (const [text, from, to] of cases) {
    const result = analyze(text, { euphony: false });
    assert.ok(result.issues.some(item => item.type === 'number' && item.from === from && item.replacements.includes(to)), text);
  }
  assert.ok(analyze('Два книги', { euphony: false }).issues.some(item => item.type === 'number' && item.from === 'Два' && item.replacements.includes('Дві')));
  assert.ok(analyze('2 документа', { grammar: false }).issues.some(item => item.type === 'number' && item.replacements.includes('документи')));
});

test('правильні кількості, дати й відмінкові конструкції не породжують підказок', () => {
  const correct = [
    '1 документ. 2 документи. 5 документів. 11 документів. 21 документ. 22 документи.',
    'одна книга, дві книги, п’ять книг, двадцять одна книга.',
    'півтори години, півтора року, 1,5 року.',
    '19 вересня 2024 року.',
    'До 2 студентів звернулися. Із трьома документами прийшли.',
    '2-й день. Пункт 3. 4:30.'
  ];
  for (const text of correct) assert.equal(analyze(text, { euphony: false }).issues.filter(item => item.type === 'number').length, 0, text);
  assert.equal(analyze('2 документа', { numerals: false }).issues.filter(item => item.type === 'number').length, 0);
});

test('змішані абетки мають конкретну пропозицію', () => {
  const result = analyze('Цей текcт готовий.');
  assert.ok(result.issues.some(i => i.type === 'spelling' && i.from === 'текcт' && i.replacements.includes('текст')));
});

test('оформлення не змінює посилання, пошту, код і десяткові числа', () => {
  const protectedText = 'https://example.com/інший?q=матеріал user@example.com `інший  матеріал`\n```\nспеціальний  текст ,слово\n```';
  const result = analyze('Текст ,слово. "пам\'ять"  є. 3,14.\n' + protectedText);
  assert.ok(result.text.startsWith('Текст, слово. «пам’ять» є. 3,14.'));
  assert.ok(result.text.endsWith(protectedText));
  for (const issue of result.issues) assert.equal(result.text.slice(issue.start, issue.end), issue.from);
});

test('дужки навколо звичайних і Markdown-посилань залишаються видимими для перевірки', () => {
  const url = 'https://www.instagram.com/odesi_600?stkn=MWJ1Mjk5OXZja2dqcQ==';
  const firstUrl = 'https://www.instagram.com/karrrynnaa?stkn=MWd6Y3I0OGFuMjlmZw%3D%3D&utm_source=qr';
  const cases = [
    `Дякуємо ГО «Одесі 600» (${url}) за запрошення.`,
    `Карина Серт (${firstUrl})провела лекцію.`,
    `Дякуємо ГО «Одесі 600» ([${url}](${url})) за запрошення.`,
    'Дивіться (https://example.org/wiki/Назва_(місто)) за посиланням.'
  ];
  for (const source of cases) {
    const result = analyze(source, { euphony: false });
    assert.equal(result.issues.filter(item => item.message.includes('не має відповідного')).length, 0, source);
  }
  const missing = analyze(`Дякуємо (${url} за запрошення.`, { euphony: false });
  assert.ok(missing.issues.some(item => item.message.includes('не має відповідного закривального знака.')));
});

test('пробіли навколо смайликів, включно зі складеними емодзі й текстовими', () => {
  const source = 'Привіт🙂друже. Дякую❤️всім! Слово👍🏽слово. Тут:)добре. `код🙂слово` https://example.com/слово🙂';
  const expected = 'Привіт 🙂 друже. Дякую ❤️ всім! Слово 👍🏽 слово. Тут :) добре. `код🙂слово` https://example.com/слово🙂';
  const first = analyze(source, { euphony: false });
  assert.equal(first.text, expected);
  assert.equal(analyze(first.text, { euphony: false }).text, expected);
  assert.equal(analyze('Слово🙂слово', { typography: false }).text, 'Слово🙂слово');
});

test('коми при звертанні, вставному вислові та підрядній частині — лише пропозиції', () => {
  const result = analyze('Маріє перевір текст. На жаль команда знає що текст готовий.', { euphony: false });
  const hints = result.issues.filter(i => i.type === 'punctuation');
  assert.ok(hints.some(i => i.from === 'Маріє' && i.replacements.includes('Маріє,')));
  assert.ok(hints.some(i => i.from === 'На жаль' && i.replacements.includes('На жаль,')));
  assert.ok(hints.some(i => result.text.slice(i.end).startsWith('що') && i.replacements.includes(', ')));
  assert.equal(result.text, 'Маріє перевір текст. На жаль команда знає що текст готовий.');
  assert.equal(analyze('Маріє, перевір текст. На жаль, команда знає, що текст готовий.').issues.filter(i => i.type === 'punctuation').length, 0);
});

test('підказки керування, узгодження і повторів', () => {
  const result = analyze('Новий книга. Ми працює згідно наказу. Цей цей текст готовий.');
  const choices = result.issues.filter(i => i.type === 'grammar').flatMap(i => i.replacements);
  for (const value of ['Нова', 'працюємо', 'згідно з наказом', 'Цей']) assert.ok(choices.includes(value), value);
  assert.equal(analyze('Нова книга. Ми працюємо згідно з наказом.').issues.filter(i => i.type === 'grammar').length, 0);
});

test('перевірки можна незалежно вимкнути; автоматичні зміни ідемпотентні', () => {
  const input = 'іншого  агента ,слово помилкка без любові';
  const disabled = Object.fromEntries(['initial', 'loans', 'ending', 'euphony', 'typography', 'spelling', 'punctuation', 'grammar', 'numerals'].map(k => [k, false]));
  const skipped = analyze(input, disabled);
  assert.equal(skipped.text, input); assert.equal(skipped.issues.length, 0); assert.equal(skipped.changes.length, 0);
  const first = analyze(input), second = analyze(first.text);
  assert.equal(second.text, first.text); assert.equal(second.changes.length, 0);
});

test('милозвучність враховує наступне слово, з/зі та повторювані сполучники', () => {
  assert.equal(engine.edit('Була в Львові. Йшов у Одесу. І мама і тато. З школи.').text, 'Була у Львові. Йшов в Одесу. І мама і тато. Зі школи.');
});

test('після застосування підказки зміщення решти належать новому тексту', () => {
  const initial = analyze('На жаль команда знає що є помилкка.');
  const hint = initial.issues.find(i => i.from === 'На жаль');
  const changed = initial.text.slice(0, hint.start) + hint.replacements[0] + initial.text.slice(hint.end);
  const rechecked = analyze(changed);
  for (const issue of rechecked.issues) assert.equal(rechecked.text.slice(issue.start, issue.end), issue.from);
  assert.ok(rechecked.issues.some(i => i.from === 'помилкка'));
});
