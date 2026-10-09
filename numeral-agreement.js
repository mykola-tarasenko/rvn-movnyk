/* Контекстні підказки для кількісних числівників; жодних автоматичних замін. */
(function (root) {
  'use strict';

  const TOKEN = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[,.]\d+)?|\d+(?:[,.]\d+)?|[\p{L}\p{M}]+(?:['’ʼ][\p{L}\p{M}]+)*/gu;
  const numberWords = new Set((
    'нуль один одна одне два дві три чотири п’ять шість сім вісім дев’ять десять ' +
    'одинадцять дванадцять тринадцять чотирнадцять п’ятнадцять шістнадцять сімнадцять вісімнадцять дев’ятнадцять ' +
    'двадцять тридцять сорок п’ятдесят шістдесят сімдесят вісімдесят дев’яносто ' +
    'сто двісті триста чотириста п’ятсот шістсот сімсот вісімсот дев’ятсот ' +
    'тисяча тисячі тисяч мільйон мільйони мільйонів мільярд мільярди мільярдів трильйон трильйони трильйонів ' +
    'півтора півтори півтораста обидва обидві двоє троє четверо п’ятеро кілька декілька'
  ).split(' '));
  const prepositions = new Set('до від для без після перед поміж між серед із зі з понад біля коло навколо поблизу завдяки'.split(' '));
  // Лічильні іменники: з числом узгоджуються самі («2 тисячі», «5 тисяч»), а наступний іменник — завжди в родовому множини.
  const SCALES = new Map();
  for (const [one, few, many, genSing, gender] of [['тисяча', 'тисячі', 'тисяч', 'тисячі', 'f'], ['мільйон', 'мільйони', 'мільйонів', 'мільйона', 'm'],
    ['мільярд', 'мільярди', 'мільярдів', 'мільярда', 'm'], ['трильйон', 'трильйони', 'трильйонів', 'трильйона', 'm']])
    for (const form of [one, few, many]) SCALES.set(form, { one, few, many, fraction: genSing, gender });
  const SCALE_ABBREVIATIONS = new Set(['тис', 'млн', 'млрд', 'трлн']);
  // З цифрою ці іменники зазвичай порядкові: «5 клас», «3 курс», «посів 2 місце».
  const ORDINAL = new Set('клас кляса курс поверх корпус пункт розділ том етап тур сезон раунд рівень ряд місце номер семестр блок сектор'.split(' '));
  const months = new Set('січня лютого березня квітня травня червня липня серпня вересня жовтня листопада грудня'.split(' '));
  const formIndex = new Map();
  function noun(one, few, many, gender, genSing, animate = false) {
    const entry = { one, few, many, gender, genSing, animate };
    for (const form of new Set([one, few, many, genSing])) {
      if (!formIndex.has(form)) formIndex.set(form, []);
      formIndex.get(form).push(entry);
    }
  }
  for (const forms of [
    ['документ', 'документи', 'документів', 'm', 'документа'],
    ['текст', 'тексти', 'текстів', 'm', 'тексту'],
    ['лист', 'листи', 'листів', 'm', 'листа'],
    ['звіт', 'звіти', 'звітів', 'm', 'звіту'],
    ['проєкт', 'проєкти', 'проєктів', 'm', 'проєкту'],
    ['захід', 'заходи', 'заходів', 'm', 'заходу'],
    ['плян', 'пляни', 'плянів', 'm', 'пляну'],
    ['план', 'плани', 'планів', 'm', 'плану'],
    ['меморіял', 'меморіяли', 'меморіялів', 'm', 'меморіялу'],
    ['донат', 'донати', 'донатів', 'm', 'донату'],
    ['день', 'дні', 'днів', 'm', 'дня'],
    ['рік', 'роки', 'років', 'm', 'року'],
    ['раз', 'рази', 'разів', 'm', 'разу'],
    ['тиждень', 'тижні', 'тижнів', 'm', 'тижня'],
    ['місяць', 'місяці', 'місяців', 'm', 'місяця'],
    ['метр', 'метри', 'метрів', 'm', 'метра'],
    ['кілометр', 'кілометри', 'кілометрів', 'm', 'кілометра'],
    ['відсоток', 'відсотки', 'відсотків', 'm', 'відсотка'],
    ['студент', 'студенти', 'студентів', 'm', 'студента', true],
    ['учасник', 'учасники', 'учасників', 'm', 'учасника', true],
    ['працівник', 'працівники', 'працівників', 'm', 'працівника', true],
    ['волонтер', 'волонтери', 'волонтерів', 'm', 'волонтера', true],
    ['учень', 'учні', 'учнів', 'm', 'учня', true],
    ['друг', 'друзі', 'друзів', 'm', 'друга', true],
    ['герой', 'герої', 'героїв', 'm', 'героя', true],
    ['член', 'члени', 'членів', 'm', 'члена', true],
    ['книга', 'книги', 'книг', 'f', 'книги'],
    ['особа', 'особи', 'осіб', 'f', 'особи', true],
    ['людина', 'людини', 'людей', 'f', 'людини', true],
    ['дитина', 'дитини', 'дітей', 'f', 'дитини', true],
    ['жінка', 'жінки', 'жінок', 'f', 'жінки', true],
    ['дівчина', 'дівчини', 'дівчат', 'f', 'дівчини', true],
    ['команда', 'команди', 'команд', 'f', 'команди'],
    ['організація', 'організації', 'організацій', 'f', 'організації'],
    ['ініціятива', 'ініціятиви', 'ініціятив', 'f', 'ініціятиви'],
    ['зустріч', 'зустрічі', 'зустрічей', 'f', 'зустрічі'],
    ['лекція', 'лекції', 'лекцій', 'f', 'лекції'],
    ['подія', 'події', 'подій', 'f', 'події'],
    ['заява', 'заяви', 'заяв', 'f', 'заяви'],
    ['година', 'години', 'годин', 'f', 'години'],
    ['хвилина', 'хвилини', 'хвилин', 'f', 'хвилини'],
    ['гривня', 'гривні', 'гривень', 'f', 'гривні'],
    ['стаття', 'статті', 'статей', 'f', 'статті'],
    ['місто', 'міста', 'міст', 'n', 'міста'],
    ['село', 'села', 'сіл', 'n', 'села'],
    ['слово', 'слова', 'слів', 'n', 'слова'],
    ['вікно', 'вікна', 'вікон', 'n', 'вікна'],
    ['яблуко', 'яблука', 'яблук', 'n', 'яблука'],
    ['питання', 'питання', 'питань', 'n', 'питання'],
    ['завдання', 'завдання', 'завдань', 'n', 'завдання'],
    ['рішення', 'рішення', 'рішень', 'n', 'рішення'],
    ['запрошення', 'запрошення', 'запрошень', 'n', 'запрошення'],
    ['місце', 'місця', 'місць', 'n', 'місця']
  ]) noun(...forms);

  function category(token) {
    if (/^\d/u.test(token.value)) {
      const value = token.value.replace(/[ \u00a0\u202f]/gu, '');
      if (/[,.]/u.test(value)) return 'fraction';
      const lastTwo = Number(value.slice(-2));
      const last = Number(value.slice(-1));
      return lastTwo >= 11 && lastTwo <= 14 ? 'many' : last === 1 ? 'one' : last >= 2 && last <= 4 ? 'few' : 'many';
    }
    if (['півтора', 'півтори'].includes(token.lower)) return 'fraction';
    if (['один', 'одна', 'одне'].includes(token.lower)) return 'one';
    if (['два', 'дві', 'три', 'чотири', 'обидва', 'обидві'].includes(token.lower)) return 'few';
    return 'many';
  }
  function expectedNumeral(lower, gender) {
    if (['один', 'одна', 'одне'].includes(lower)) return { m: 'один', f: 'одна', n: 'одне' }[gender];
    if (['два', 'дві'].includes(lower)) return gender === 'f' ? 'дві' : 'два';
    if (['обидва', 'обидві'].includes(lower)) return gender === 'f' ? 'обидві' : 'обидва';
    if (['півтора', 'півтори'].includes(lower)) return gender === 'f' ? 'півтори' : 'півтора';
    return null;
  }
  function inferredForm(lower, type, spell) {
    if (!spell || !['few', 'many'].includes(type)) return null;
    if (type === 'few' && /ів$/u.test(lower)) {
      const stem = lower.slice(0, -2);
      const suffix = /[жчшщц]$/u.test(stem) ? 'і' : 'и';
      const form = stem + suffix;
      return spell.correct(form) ? form : null;
    }
    if (type === 'many' && /[иі]$/u.test(lower)) {
      const stem = lower.slice(0, -1);
      const candidates = [stem + 'ів', stem + 'ей', stem + 'й', stem].filter(form => form !== lower && spell.correct(form));
      if (candidates.length === 1) return candidates[0];
      if (candidates.includes(stem + 'ів') && /[нртвкгцчшщж]$/u.test(stem)) return stem + 'ів';
    }
    return null;
  }
  const commonPrefix = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };
  const closest = (options, written) => [...options].sort((a, b) => commonPrefix(b, written) - commonPrefix(a, written))[0];
  const REASONS = {
    fraction: 'Після дробового числівника або «півтора/півтори» іменник ставимо в родовому однини.',
    one: 'Після числівника, що закінчується на 1 (крім 11), уживаємо форму однини.',
    few: 'Після 2–4 (крім 12–14) уживаємо лічильну форму множини.',
    many: 'Для цієї кількости іменник уживаємо в родовому відмінку множини (як у «5 документів», «11 документів», «20 документів»).'
  };
  // rules — словникові правила (grammar-rules.js): форми іменників поза переліком вище.
  function check(text, ranges, report, spell, rules) {
    const tokens = [...text.matchAll(TOKEN)].map(match => ({
      value: match[0], lower: match[0].toLocaleLowerCase('uk').replace(/['ʼ]/gu, '’'),
      start: match.index, end: match.index + match[0].length
    }));
    const protectedToken = token => ranges.some(range => token.start < range.end && token.end > range.start);
    const onlySpaces = (left, right) => /^[ \t\u00a0\u202f]+$/u.test(text.slice(left.end, right.start));
    const dictionary = word => rules?.available ? rules.nounParadigm(word.value) : null;
    const known = word => formIndex.has(word.lower) || Boolean(dictionary(word));
    for (let i = 0; i < tokens.length; i++) {
      const first = tokens[i];
      const digit = /^\d/u.test(first.value);
      if ((!digit && !numberWords.has(first.lower)) || protectedToken(first)) continue;
      if (digit && (text[first.start - 1] === '№' || /[-\p{L}]/u.test(text[first.end] || '') || text[first.end] === '.')) continue;
      let end = i;
      if (!digit) {
        while (end + 1 < tokens.length && numberWords.has(tokens[end + 1].lower) && onlySpaces(tokens[end], tokens[end + 1]) && !protectedToken(tokens[end + 1])) end++;
      } else if (tokens[end + 1] && onlySpaces(first, tokens[end + 1]) && (SCALES.has(tokens[end + 1].lower) || SCALE_ABBREVIATIONS.has(tokens[end + 1].lower))) end++;
      const last = tokens[end];
      if (i > 0 && prepositions.has(tokens[i - 1].lower) && onlySpaces(tokens[i - 1], first)) { i = end; continue; }
      let type = category(last);
      const scale = SCALES.get(last.lower), abbreviation = SCALE_ABBREVIATIONS.has(last.lower);
      if (scale && end > i) {
        // «2 тисячі», «п’ять тисяч», «1,5 тисячі»; «два тисячі» → «дві».
        const count = tokens[end - 1], countType = category(count);
        const wanted = scale[countType];
        if (wanted !== last.lower) report(last.start, last.end, `Після «${count.value}» уживаємо форму «${wanted}».`, [wanted]);
        const numeral = expectedNumeral(count.lower, scale.gender);
        if (numeral && numeral !== count.lower) report(count.start, count.end, `Узгодьте форму числівника з іменником «${scale.one}» за родом.`, [numeral]);
      }
      if (scale || abbreviation) type = 'many';
      let nounIndex = end + 1;
      const gap = nounIndex < tokens.length ? text.slice(last.end, tokens[nounIndex].start) : '';
      if (nounIndex >= tokens.length || !(onlySpaces(last, tokens[nounIndex]) || (abbreviation && /^\.[ \t\u00a0\u202f]+$/u.test(gap)))) { i = end; continue; }
      // Одне означення між числівником і іменником: «5 нових документів».
      const between = tokens[nounIndex], after = tokens[nounIndex + 1];
      if (!known(between) && after && onlySpaces(between, after) && (formIndex.has(after.lower) || (rules?.adjective(between.value) && dictionary(after)) || inferredForm(after.lower, type, spell))) nounIndex++;
      const target = tokens[nounIndex];
      if (!target || protectedToken(target)) { i = end; continue; }
      if (months.has(target.lower) || (/^\d{4}$/u.test(first.value) && Number(first.value) >= 1000 && Number(first.value) <= 2100 && ['рік', 'року', 'році'].includes(target.lower))) { i = end; continue; }
      const candidates = formIndex.get(target.lower);
      const paradigm = !candidates && dictionary(target);
      const lemma = candidates?.[0]?.one || paradigm?.lemma;
      if (digit && !scale && !abbreviation && ORDINAL.has(lemma)) { i = end; continue; }
      const expectedKey = type === 'fraction' ? 'genSing' : type;
      let correctForm = null, gender = null, base = null;
      if (candidates) {
        const matching = candidates.filter(entry => entry[expectedKey] === target.lower);
        const entry = matching[0] || (candidates.length === 1 ? candidates[0] : null);
        correctForm = entry ? entry[expectedKey] : inferredForm(target.lower, type, spell);
        // Знахідний відмінок назв істот збігається з родовим: «запросили 1 студента».
        if (entry && type === 'one' && entry.animate && target.lower === entry.genSing) correctForm = target.lower;
        gender = entry?.gender; base = entry?.one;
      } else if (paradigm) {
        // Словникові форми; непрямі відмінки («5 документам») не перевіряємо.
        const written = target.lower.replace(/’/gu, "'");
        const direct = new Set([paradigm.lemma, ...paradigm.few, ...paradigm.many, ...paradigm.genSing]);
        if (direct.has(written)) {
          const accepted = type === 'one' ? [paradigm.lemma, ...(paradigm.gender === 'm' ? paradigm.genSing : [])]
            : type === 'fraction' ? paradigm.genSing : paradigm[type];
          // Для однини пропонуємо називний (будинок), а не родовий, що допустимий лише як знахідний істот.
          correctForm = !accepted.length || accepted.includes(written) ? target.lower : type === 'one' ? paradigm.lemma : closest(accepted, written);
        }
        gender = paradigm.gender; base = paradigm.lemma;
      } else correctForm = inferredForm(target.lower, type, spell);
      if (!correctForm) { i = end; continue; }
      if (target.lower !== correctForm.replace(/'/gu, '’')) report(target.start, target.end, REASONS[type], [correctForm]);
      const numeral = gender && !scale && expectedNumeral(last.lower, gender);
      if (numeral && numeral !== last.lower) report(last.start, last.end, `Узгодьте форму числівника з іменником «${base}» за родом.`, [numeral]);
      i = end;
    }
  }
  const api = { check };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RVNNumeralAgreement = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
