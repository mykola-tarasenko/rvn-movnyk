const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = require('./engine.js');
const { create } = require('./proofreader.js');
const spell = require('./lazy-spell.js').createSpell(
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

test('похідні слова РВН проходять перевірку написання, власні назви отримують лише підказку', () => {
  const result = analyze('Плянування, матеріялізм, мітологія, етерний, аґентство, европейці й клясний.', { euphony: false });
  assert.deepEqual(result.issues.filter(i => i.type === 'spelling').map(i => i.from), []);
  assert.equal(analyze('Запланували міфологічний марафон.', { euphony: false }).text, 'Заплянували мітологічний маратон.');
  const names = analyze('Звіт Держаудитслужби.', { euphony: false });
  assert.equal(names.text, 'Звіт Держаудитслужби.');
  assert.ok(names.issues.some(i => i.type === 'rvn' && i.replacements.includes('Державдитслужби')));
});

test('злиті слова з «кляса» і «заля» не вважаються помилками написання', () => {
  const result = analyze('Учні спецкласу прийшли до кінозали й півкласу.', { euphony: false });
  assert.equal(result.text, 'Учні спецкляси прийшли до кінозалі й півкляси.');
  assert.deepEqual(result.issues.filter(i => i.type === 'spelling').map(i => i.from), []);
  assert.deepEqual(analyze('Кінозаля, спортзалю, майстеркляса.', { euphony: false }).issues.filter(i => i.type === 'spelling').map(i => i.from), []);
});

test('підказки правопису РВН мають власну категорію й точні межі', () => {
  const result = analyze('Ми зайшли у великий зал. Нова планка.', { euphony: false });
  assert.deepEqual(result.issues.filter(i => i.type === 'rvn').map(i => [i.from, i.replacements]), [['великий зал', ['велику залю']], ['планка', ['плянка']]]);
  for (const issue of result.issues) assert.equal(result.text.slice(issue.start, issue.end), issue.from);
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

const numberHints = text => analyze(text, { euphony: false }).issues.filter(item => item.type === 'number').map(item => item.from + '→' + item.replacements.join('/'));

test('тисяча й мільйон узгоджуються з числом, а іменник після них — у родовому множини', () => {
  for (const [text, expected] of [['1 тисяч гривень', 'тисяч→тисяча'], ['5 тисячі гривень', 'тисячі→тисяч'], ['2 тисяч гривень', 'тисяч→тисячі'],
    ['два тисячі гривень', 'два→дві'], ['2 тисячі гривні', 'гривні→гривень'], ['1 млн гривня', 'гривня→гривень'], ['10 тис. гривні', 'гривні→гривень']])
    assert.ok(numberHints(text).includes(expected), text);
  for (const text of ['2 тисячі гривень.', '5 тисяч гривень.', '1 тисяча гривень.', 'дві тисячі гривень.', 'п’ять тисяч гривень.', '3 млн гривень.', '10 тис. гривень.', '1,5 тисячі гривень.', 'тисяча гривень.'])
    assert.deepEqual(numberHints(text), [], text);
});

test('числівники з будь-яким іменником словника', () => {
  for (const [text, expected] of [['5 будинок', 'будинок→будинків'], ['3 будинків', 'будинків→будинки'], ['1 будинки', 'будинки→будинок'], ['5 країна', 'країна→країн'],
    ['3 країн', 'країн→країни'], ['1,5 літрів', 'літрів→літра'], ['4 статей', 'статей→статті'], ['7 стаття', 'стаття→статей'], ['5 подарунок', 'подарунок→подарунків'],
    ['дві будинки', 'дві→два'], ['одна будинок', 'одна→один']])
    assert.ok(numberHints(text).includes(expected), text);
  // Порядкові вживання з цифрою, непрямі відмінки, збірні числівники й знахідний відмінок істот не позначаємо.
  for (const text of ['Учні 5 класу.', 'Посів 2 місце.', '3 курс.', '2 поверх.', '5 нових будинків.', 'Надіслали 5 документам.', 'двоє дітей.', 'п’ятеро студентів.',
    '2 двері.', '5 років тому.', '2 дні.', '3 ночі.', '1 книгу прочитав.', 'Запросили 1 студента.', '3 питання.', '4 вікна.', '2,5 години.'])
    assert.deepEqual(numberHints(text), [], text);
  assert.deepEqual(analyze('Нова стаття вийшла.', { euphony: false }).issues.filter(item => item.type === 'grammar'), []);
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
  assert.equal(analyze('Програма( деталі нижче) і [ ще ].', { euphony: false }).text, 'Програма (деталі нижче) і [ще ].');
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

const hints = (text, type) => analyze(text, { euphony: false, ending: false }).issues.filter(i => i.type === type);
const commaBefore = (text, fragment) => hints(text, 'punctuation').some(i => i.replacements.includes(', ') && text.slice(i.end).startsWith(fragment));

test('кома перед підрядним після будь-якої форми дієслова знання та перед «який» після іменника', () => {
  for (const [text, fragment] of [['Я бачив як він іде.', 'як'], ['Вона бачила як діти грають.', 'як'], ['Ми не знали де шукати.', 'де'],
    ['Я зрозумів чому так сталося.', 'чому'], ['Він розповів хто приходив.', 'хто'], ['Книга яку я читаю цікава.', 'яку'],
    ['Місто в якому я живу велике.', 'в якому'], ['Людина якій я довіряю.', 'якій']]) assert.ok(commaBefore(text, fragment), text);
});

test('«брати участь» у будь-якій формі дієслова', () => {
  for (const [text, expected] of [['Він приймав участь у конкурсі.', 'брав участь'], ['Вони прийняли участь у форумі.', 'взяли участь'],
    ['Приймаючи участь у заході, ми вчилися.', 'Беручи участь'], ['Вона прийме участь.', 'візьме участь'], ['Ми будемо приймати участь.', 'брати участь']])
    assert.ok(hints(text, 'grammar').some(i => i.replacements.includes(expected)), text);
  assert.ok(hints('Директор являється членом ради.', 'grammar').some(i => i.replacements.includes('є')));
  assert.ok(hints('Слідуючий захід буде завтра.', 'grammar').some(i => i.replacements.includes('Наступний')));
});

test('звертання з будь-яким іменем або словом-звертанням', () => {
  for (const [text, from, replacement] of [['Тарасе зроби це.', 'Тарасе', 'Тарасе,'], ['Олено Петрівно перевірте звіт.', 'Олено Петрівно', 'Олено Петрівно,'],
    ['Карино надішли текст.', 'Карино', 'Карино,'], ['Пане Іване скажіть щось.', 'Пане Іване', 'Пане Іване,'], ['Колеги ви знаєте правила.', 'Колеги', 'Колеги,'],
    ['Мамо подивись.', 'Мамо', 'Мамо,'], ['Дякую Маріє за допомогу.', ' Маріє', ', Маріє,'], ['Привіт Олено!', ' Олено', ', Олено'], ['Щиро дякую друзі.', ' друзі', ', друзі']])
    assert.ok(hints(text, 'punctuation').some(i => i.from === from && i.replacements.includes(replacement)), text);
});

test('узгодження займенника з будь-яким дієсловом і прикметника з іменником', () => {
  for (const [text, expected] of [['Ми працює разом.', 'працюємо'], ['Вони пише листи.', 'пишуть'], ['Я читає книгу.', 'читаю'], ['Вона працював тут.', 'працювала'],
    ['Ми писав звіт.', 'писали'], ['Ви займається спортом.', 'займаєтеся'], ['Нова план готовий.', 'Новий'], ['Важливий подія відбулася.', 'Важлива'],
    ['Новий рішення ухвалили.', 'Нове'], ['Синій машина стоїть.', 'Синя'], ['Нова місто росте.', 'Нове']])
    assert.ok(hints(text, 'grammar').some(i => i.replacements.includes(expected)), text);
});

test('вставні слова всередині речення й дієприслівникові звороти', () => {
  for (const [text, replacement] of [['Ми на жаль не встигли.', ', на жаль, '], ['Він мабуть запізниться.', ', мабуть, '], ['Ви наприклад можете написати.', ', наприклад, '],
    ['Він сказав, що на жаль не зможе.', ', на жаль, ']])
    assert.ok(hints(text, 'punctuation').some(i => i.replacements.includes(replacement)), text);
  for (const [text, fragment] of [['Читаючи книгу він заснув.', 'він'], ['Прийшовши додому мама відпочила.', 'мама'], ['Прочитавши лист заплакала.', 'заплакала'],
    ['Він пішов не попрощавшись з нами.', 'не попрощавшись'], ['Ми пішли незважаючи на дощ.', 'незважаючи'], ['Незважаючи на дощ ми пішли.', 'ми']])
    assert.ok(commaBefore(text, fragment), text);
});

test('узгодження підмета-іменника з дієсловом і керування', () => {
  for (const [text, expected] of [['Дівчина прийшов вчасно.', 'прийшла'], ['Діти грає у дворі.', 'грають'], ['Команда вирішили змінити план.', 'вирішила'],
    ['Учні прийшов на урок.', 'прийшли'], ['Люди не знає правди.', 'знають'], ['Дякую вас за допомогу.', 'вам'], ['Вибачаюсь за запізнення.', 'Перепрошую']])
    assert.ok(hints(text, 'grammar').some(i => i.replacements.includes(expected)), text);
});

test('правильний текст не отримує граматичних і пунктуаційних підказок', () => {
  const correct = ['Я бачив, як він іде.', 'Він і вона працюють разом.', 'Мама і я працюємо.', 'Ми є командою.', 'Ти знала відповідь.', 'Я працювала там.',
    'Вони брали участь у конкурсі.', 'Ми приймали гостей.', 'Тепер перевір текст.', 'Текст перевір уважно.', 'Марії передай привіт.', 'Дякую Марії за допомогу.',
    'Дякую друзям за підтримку.', 'Маленьке кошеня спить.', 'Мале дитя плаче.', 'Новий голова ради.', 'Нова колега прийшла.', 'Сучасна молодь читає.',
    'Нове ім\'я.', 'Нові рішення ухвалили.', 'Новий гість прийшов.', 'Книга, яку я читаю, цікава.', 'Не знаю, який обрати.', 'Друзі прийшли вчасно.',
    'Колеги підтримали ідею.', 'Пані Олена прийшла.', 'Він являється щоночі уві сні.', 'Олена перевірила звіт.',
    'Ми, на жаль, не встигли.', 'Це можливо.', 'Ваша порада дуже до речі.', 'Він, як звичайно, запізнився.', 'Він звичайно приходить о дев’ятій.', 'Можливо, він прийде.',
    'Крім того, що він сказав, нічого.', 'Читаючи книгу, він заснув.', 'Він працював сидячи.', 'Він ішов не поспішаючи.', 'Захід провели волонтери.',
    'Проєкт підтримала громада.', 'Книгу читала мама.', 'Мама і тато прийшли.', 'Учні прийшли на урок.', 'Від учасниці надійшов лист.', 'Ми це знаємо напевно.',
    'Минулого тижня громадська організація провела зустріч із волонтерами у Харкові. Учасники обговорили плани на наступний рік і домовилися про нову інформаційну кампанію. Директорка організації наголосила, що головне завдання — підтримати ветеранів та їхні родини.',
    'Ми вдячні всім, хто долучився до підготовки заходу. Окрема подяка партнерам, які надали приміщення та обладнання. Наступна зустріч відбудеться в жовтні. Ви можете зареєструватися на сайті або написати нам у соцмережах. Якщо маєте запитання, телефонуйте за вказаним номером.',
    'Олена Петрівна, наша координаторка, розповіла про результати опитування. Вона зазначила, що більшість учасників задоволені форматом. Велика зала, яку ми орендували, вміщує двісті людей. Дякуємо партнерам за довіру. Друзі, приєднуйтеся до нас! Шановні колеги, просимо надсилати пропозиції до кінця місяця.'];
  for (const text of correct) {
    const found = analyze(text, { euphony: false, ending: false }).issues.filter(i => i.type === 'grammar' || i.type === 'punctuation');
    assert.deepEqual(found.map(i => i.from + ' → ' + i.replacements.join('/')), [], text);
  }
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

test('приклад на сторінці показує кожну групу правил', () => {
  const app = fs.readFileSync('app.js', 'utf8');
  const sample = require('node:vm').runInNewContext(app.match(/const SAMPLE = (\[[\s\S]*?\]\.join\('\\n\\n'\))/)[1]);
  const result = analyze(sample);
  for (const type of ['rvn', 'case', 'spelling', 'punctuation', 'grammar', 'number']) assert.ok(result.issues.some(i => i.type === type), type);
  for (const fragment of ['Иншого спеціяльного аґента', 'авдиторії на маратон', 'мітологія та етерний', 'европейські', 'плянування нової плятформи',
    'відповідальности', 'без пам’яти', 'Завдяки можливості', 'у Львові, а зі школи', 'у школу й у кімнату', 'Мама й Олена', '9 кляси прийшли до залі',
    'Телеґрам-канал та Інстаґрам: https://instagram.com/rvn_example', 'заходу — лекція', 'обговорення (деталі', '«Мова та пам’ять», початок', '18:00 🙂 Чекаємо всіх…'])
    assert.ok(result.text.includes(fragment), fragment);
  for (const issue of result.issues) assert.equal(result.text.slice(issue.start, issue.end), issue.from);
});
