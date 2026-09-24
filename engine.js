/* Правила укладено за путівником ГО «РВН». Не застосовуємо глобальних замін літер. */
(function (root) {
  'use strict';

  const shared = typeof module !== 'undefined' && module.exports ? require('./shared-exceptions.js') : root.RVNSharedExceptions;

  const WORDS = /[\p{L}\p{M}]+(?:['’ʼ][\p{L}\p{M}]+)*/gu;
  const HARD_NOUN = ['', 'а', 'у', 'ові', 'еві', 'ом', 'і', 'е', 'и', 'ів', 'ам', 'ами', 'ах'];
  const FEM_A = ['а', 'и', 'і', 'у', 'ою', 'о', 'ам', 'ами', 'ах'];
  const FEM_IA = ['ія', 'ії', 'ію', 'ією', 'ій', 'іям', 'іями', 'іях'];
  const ADJECTIVE = ['ий', 'ого', 'ому', 'им', 'ім', 'а', 'ої', 'ій', 'ою', 'у', 'е', 'і', 'их', 'ими'];
  const MEDIA_COMPOUND = /^(?:прост|контент|грамотн|платформ|проєкт|ресурс|центр|компані|текст|освіт|комунікац|ринк|сфер|дослідж|відділ|пол|продукт|виробниц|експерт|партнер|план)/u;
  const entries = new Map();

  function add(from, to, group, label) {
    const key = from.toLocaleLowerCase('uk');
    if (key !== to.toLocaleLowerCase('uk')) entries.set(key, { to, group, label });
  }
  function stem(from, to, endings, group, label) {
    for (const ending of endings) add(from + ending, to + ending, group, label);
  }
  function pair(from, to, group, label) { add(from, to, group, label); }
  function derivedLoan(lower) {
    if (lower.startsWith('меморіал')) return 'меморіял' + lower.slice('меморіал'.length);
    if (lower.startsWith('ініціатив')) return 'ініціятив' + lower.slice('ініціатив'.length);
    if (lower.startsWith('медіа') && MEDIA_COMPOUND.test(lower.slice('медіа'.length))) return 'медія' + lower.slice('медіа'.length);
    return null;
  }

  stem('інш', 'инш', ADJECTIVE, 'initial', 'Початкове и');
  stem('інакш', 'инакш', ADJECTIVE, 'initial', 'Початкове и');
  stem('іноземн', 'иноземн', ADJECTIVE, 'initial', 'Початкове и');
  for (const [from, to] of [['іноді', 'иноді'], ['інколи', 'инколи'], ['ірод', 'ирод']]) pair(from, to, 'initial', 'Початкове и');

  for (const [from, to] of [
    ['марафон', 'маратон'], ['аудит', 'авдит'], ['матеріал', 'матеріял'], ['тріумф', 'тріюмф'],
    ['радіус', 'радіюс'], ['консиліум', 'консиліюм'], ['медіум', 'медіюм'], ['агент', 'аґент'],
    ['агроном', 'аґроном'], ['диригент', 'дириґент'], ['лінгвіст', 'лінґвіст'],
    ['аероплан', 'аероплян'], ['баланс', 'балянс'], ['план', 'плян'],
    ['міф', 'міт'], ['ефір', 'етер'], ['логарифм', 'логаритм'], ['пафос', 'патос'],
    ['шаблон', 'шабльон'], ['ломбард', 'льомбард'], ['колорит', 'кольорит'], ['діалект', 'діялект']
  ]) stem(from, to, HARD_NOUN, 'loans', 'Запозичення');

  for (const [from, to] of [
    ['аудитор', 'авдитор'], ['аудієнц', 'авдієнц'], ['агітац', 'аґітац'],
    ['міграц', 'міґрац'], ['лаборатор', 'ляборатор'], ['декламац', 'деклямац'],
    ['плантац', 'плянтац'], ['платформ', 'плятформ'], ['європ', 'европ'],
    ['орфограф', 'ортограф'], ['орфоеп', 'ортоеп']
  ]) {
    const endings = from === 'європ' || from === 'платформ' ? FEM_A : FEM_IA;
    stem(from, to, endings, 'loans', 'Запозичення');
  }
  for (const [from, to] of [
    ['ламп', 'лямп'], ['платин', 'плятин'], ['кафедр', 'катедр'],
    ['анафем', 'анатем'], ['фаун', 'фавн'], ['блокад', 'бльокад'], ['гварді', 'ґварді'], ['гірлянд', 'ґірлянд']
  ]) {
    if (from === 'гварді') stem(from, to, ['я', 'ї', 'ю', 'єю', 'й', 'ям', 'ями', 'ях'], 'loans', 'Запозичення');
    else stem(from, to, FEM_A, 'loans', 'Запозичення');
  }
  for (const [from, to] of [
    ['бацила', 'бациля'], ['бацили', 'бацилі'], ['бацилу', 'бацилю'], ['бацилою', 'бацилею'],
    ['клас', 'кляса'], ['класу', 'кляси'], ['класі', 'клясі'], ['класом', 'клясою'], ['класи', 'кляси'], ['класів', 'кляс'],
    ['зал', 'заля'], ['залу', 'залі'], ['залом', 'залею'], ['зали', 'залі']
  ]) pair(from, to, 'loans', 'Запозичення');
  stem('гаранті', 'ґаранті', ['я', 'ї', 'ю', 'єю', 'й', 'ям', 'ями', 'ях'], 'loans', 'Запозичення');
  for (const [from, to] of [
    ['матеріальн', 'матеріяльн'], ['спеціальн', 'спеціяльн'], ['мініатюрн', 'мініятюрн'],
    ['нейтральн', 'невтральн'], ['елегантн', 'елеґантн'], ['європейськ', 'европейськ']
  ]) stem(from, to, ADJECTIVE, 'loans', 'Запозичення');
  stem('меморіал', 'меморіял', HARD_NOUN, 'loans', 'Іа → ія в запозиченні');
  stem('меморіальн', 'меморіяльн', ADJECTIVE, 'loans', 'Іа → ія в похідному слові');
  stem('меморіалізаці', 'меморіялізаці', ['я', 'ї', 'ю', 'єю', 'й', 'ям', 'ями', 'ях'], 'loans', 'Іа → ія в похідному слові');
  stem('ініціатив', 'ініціятив', FEM_A, 'loans', 'Іа → ія в запозиченні');
  stem('ініціативн', 'ініціятивн', ADJECTIVE, 'loans', 'Іа → ія в похідному слові');
  stem('ініціативност', 'ініціятивност', ['і', 'ю', 'ей', 'ям', 'ями', 'ях'], 'loans', 'Іа → ія в похідному слові');
  pair('ініціативність', 'ініціятивність', 'loans', 'Іа → ія в похідному слові');
  pair('медіа', 'медія', 'loans', 'Іа → ія в запозиченні');
  stem('медіальн', 'медіяльн', ADJECTIVE, 'loans', 'Іа → ія в похідному слові');
  for (const suffix of ['простір', 'контент', 'грамотність', 'платформа', 'проєкт', 'ресурс', 'центр', 'компанія', 'текст'])
    pair('медіа' + suffix, 'медія' + suffix, 'loans', 'Іа → ія в медійних складних словах');
  stem('інстаграм', 'інстаґрам', HARD_NOUN, 'loans', 'G → ґ у назві соцмережі');
  stem('телеграм', 'телеґрам', ['', 'у', 'ові', 'ом', 'і'], 'loans', 'G → ґ у назві соцмережі');
  pair('instagram', 'інстаґрам', 'loans', 'Передавання назви Instagram');
  pair('telegram', 'телеґрам', 'loans', 'Передавання назви Telegram');
  pair('тг', 'тґ', 'loans', 'Скорочення «тґ-канал»');
  for (const [from, to] of [
    ['соціалізм', 'соціялізм'], ['нейтралітет', 'невтралітет'], ['тріумвірат', 'тріюмвірат'],
    ['паліатив', 'паліятив'], ['клавіш', 'клявіш']
  ]) stem(from, to, HARD_NOUN, 'loans', 'Запозичення');
  for (const [from, to] of [
    ['інтелігенц', 'інтеліґенц']
  ]) stem(from, to, FEM_IA, 'loans', 'Запозичення');
  pair('Євфрат', 'Евфрат', 'loans', 'Запозичення');

  const GENITIVE = new Map([
    ['радості', 'радости'], ['вісті', 'вісти'], ['смерті', 'смерти'], ['чверті', 'чверти'],
    ['осені', 'осени'], ['солі', 'соли'], ['крові', 'крови'], ['любові', 'любови'], ['русі', 'руси'],
    ['імені', 'імени'], ['честі', 'чести'], ['совісті', 'совісти'],
    ['повісті', 'повісти'], ['користі', 'користи'], ['ненависті', 'ненависти'],
    ['шерсті', 'шерсти'], ['кісті', 'кісти'], ['кості', 'кости'], ['масті', 'масти'],
    ['пасті', 'пасти'], ['скатерті', 'скатерти']
  ]);
  for (const [from, to] of shared.genitive) GENITIVE.set(from, to);
  const GENITIVE_GOVERNORS = new Set(('до без від для з із зі після серед проти уподовж упродовж впродовж протягом біля коло навколо довкола поблизу крім окрім замість заради задля внаслідок унаслідок посеред щодо стосовно немає нема бракує забракло достатньо досить мало багато потребує потребують потребуємо потребував потребувала потребувати вимагає вимагають вимагати досяг досягла досягти досягнути уникати уникає уникнути позбутися позбувся позбулася дотримуватися дотримується дотримуються стосується стосуються').split(' '));
  const GENITIVE_HEADS = new Set(('рівень рівня рівнем почуття брак браку вияв вияву символ символом стан стану день дня питання показник показника ознака ознаки джерело втрата втрати збереження захист захисту досягнення розвиток розвитку обмеження позбавлення наявність відсутність доказ докази прояв прояву').split(' '));
  for (const form of ['відсутності', 'відсутности', 'наявності', 'наявности', 'нестача', 'нестачі', 'нестачу', 'почуттям', 'почуттів', 'відчуття', 'відчуттям', 'вияви', 'виявів', 'станом']) GENITIVE_HEADS.add(form);
  const OBLIQUE_GOVERNORS = new Set(('в у на при по завдяки всупереч наперекір радіти радіє раділи радіємо допомогли допомагає допомагати допомогти присвятили присвятити присвячений присвячена вірити віримо служити завдячувати').split(' '));
  const MODIFIERS = new Set(('її його їх дуже надто такої такої-то моєї твоєї своєї нашої вашої цієї тієї жодної будь-якої всієї усякої').split(' '));
  const ADJ_GENITIVE = /(?:ої|ьої|ого|ього)$/u;
  const VOWEL = /[аеєиіїоуюя]$/u;
  const FIRST_VOWEL = /^[аеєиіїоуюя]/u;

  function caseLike(original, replacement) {
    if (original.includes('’')) replacement = replacement.replace(/['ʼ]/g, '’');
    else if (original.includes('ʼ')) replacement = replacement.replace(/['’]/g, 'ʼ');
    if (original.length > 1 && original === original.toLocaleUpperCase('uk')) return replacement.toLocaleUpperCase('uk');
    if (original[0] === original[0].toLocaleUpperCase('uk')) return replacement[0].toLocaleUpperCase('uk') + replacement.slice(1);
    return replacement;
  }
  function protectedRanges(text) {
    const pattern = /```[\s\S]*?(?:```|$)|`[^`\n]*`|\(!?\[[^\]\n]*\]\((?:\\.|[^\\)\n])*\)\)|!?\[[^\]\n]*\]\((?:\\.|[^\\)\n])*\)|(?:https?:\/\/|www\.)[^\s<>]+|[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}|<[^>\n]+>|\b[A-Za-z]:[\\/][^\s]+/gu;
    return [...text.matchAll(pattern)].map(match => {
      let end = match.index + match[0].length;
      if (/^(?:https?:\/\/|www\.)/u.test(match[0])) {
        // A bare URL may sit inside prose parentheses. Keep balanced parentheses
        // in the address, but leave an unmatched closing one for punctuation.
        let depth = 0;
        for (let i = 0; i < match[0].length; i++) {
          if (match[0][i] === '(') depth++;
          else if (match[0][i] === ')') {
            if (depth === 0) { end = match.index + i; break; }
            depth--;
          }
        }
        while (end > match.index && /[.,;!?]/u.test(text[end - 1])) end--;
      }
      return { start: match.index, end };
    });
  }
  function tokenize(text) {
    const ranges = protectedRanges(text);
    return [...text.matchAll(WORDS)].map(match => ({ value: match[0], lower: match[0].toLocaleLowerCase('uk').replace(/[’ʼ]/g, "'"), start: match.index, end: match.index + match[0].length, protected: ranges.some(r => match.index < r.end && match.index + match[0].length > r.start) }));
  }
  function genitiveForm(lower, overrides = []) {
    const override = overrides.find(item => item.from.toLocaleLowerCase('uk') === lower);
    return GENITIVE.get(lower) || override?.to || (/^[а-яіїєґ]+ості$/u.test(lower) ? lower.slice(0, -1) + 'и' : null);
  }
  function genitiveContext(words, index, text, depth = 0) {
    let adjective = false;
    for (let j = index - 1; j >= Math.max(0, index - 7); j--) {
      const prev = words[j], gap = text.slice(prev.end, words[j + 1].start);
      if (prev.protected || /[.!?;:\n—–]/u.test(gap)) break;
      if (OBLIQUE_GOVERNORS.has(prev.lower)) return { kind: 'other', reason: `«${prev.value}» вказує на давальний або місцевий відмінок.` };
      if (GENITIVE_GOVERNORS.has(prev.lower)) return { kind: 'genitive', reason: `Родовий відмінок після «${prev.value}».` };
      if (GENITIVE_HEADS.has(prev.lower)) return { kind: 'genitive', reason: `Залежне слово після «${prev.value}» відповідає на питання «чого?».` };
      if (['було', 'буде', 'вистачає', 'вистачило', 'має', 'мають', 'мав', 'мала'].includes(prev.lower) && words[j - 1]?.lower === 'не') return { kind: 'genitive', reason: `Родовий відмінок при запереченні «не ${prev.value}».` };
      if (prev.lower === 'за' && ['відсутності', 'наявності', 'можливості', 'необхідності'].includes(words[index].lower)) return { kind: 'genitive', reason: 'Родовий у сполуці «за наявности / відсутности / можливости / необхідности».' };
      if (MODIFIERS.has(prev.lower)) continue;
      if (/ій$/u.test(prev.lower)) return { kind: 'other', reason: 'Означення на -ій підказує давальний або місцевий відмінок.' };
      if (ADJ_GENITIVE.test(prev.lower) && (!/ого$/u.test(prev.lower) || words[index].lower === 'імені')) { adjective = true; continue; }
      if (depth < 3 && (['і', 'й', 'та', 'ні'].includes(prev.lower) || /,/u.test(gap))) {
        const n = ['і', 'й', 'та', 'ні'].includes(prev.lower) ? j - 1 : j;
        if (n >= 0) {
          const inherited = genitiveContext(words, n, text, depth + 1);
          if (inherited.kind === 'genitive') return { kind: 'genitive', reason: 'Родовий відмінок в однорідному переліку зі спільним керуванням.' };
        }
      }
      if (prev.lower === 'ні') continue;
      break;
    }
    if (adjective) return { kind: 'genitive', reason: 'Узгоджене означення на -ої / -ьої підказує родовий відмінок.' };
    return { kind: 'ambiguous', reason: 'Ця форма може бути родовим, давальним, місцевим відмінком або множиною. Якщо тут «кого? чого?», потрібне -и.' };
  }
  function euphony(word, words, index, text) {
    const lower = word.lower;
    if (!['у', 'в', 'і', 'й', 'з'].includes(lower)) return null;
    const next = words[index + 1];
    if (!next || next.protected || !/^[а-яіїєґ]/u.test(next.lower) || /[^\s«»„“”"']/u.test(text.slice(word.end, next.start))) return null;
    const prev = words[index - 1];
    const before = prev && !/[,.!?;:\n—–]/u.test(text.slice(prev.end, word.start)) ? prev.lower : '';
    if (lower === 'з') return /^(?:[сзшжщ][бвгґджзклмнпрстфхцчшщ]|мною|льв)/u.test(next.lower) ? 'зі' : null;
    if (lower === 'у' || lower === 'в') {
      if (/^(?:в|ф|св|хв|тв|льв)/u.test(next.lower)) return 'у';
      if (FIRST_VOWEL.test(next.lower)) return 'в';
      return before && VOWEL.test(before) ? 'в' : 'у';
    }
    // Повторювані сполучники та частки зберігаємо.
    if (words.slice(Math.max(0, index - 5), index).some(w => ['і', 'й'].includes(w.lower)) || words.slice(index + 1, index + 5).some(w => ['і', 'й'].includes(w.lower))) return null;
    if (/^[йяюєї]/u.test(next.lower)) return 'і';
    return before && VOWEL.test(before) ? 'й' : 'і';
  }
  function socialPlatformContext(words, index, text) {
    const word = words[index];
    if (['телеграм', 'telegram'].includes(word.lower) && words[index - 1]?.lower !== 'багато') return true;
    const nearby = words.slice(Math.max(0, index - 5), index + 6)
      .filter(item => !/[.!?;\n]/u.test(text.slice(Math.min(item.end, word.end), Math.max(item.start, word.start))));
    return nearby.some(item => /^(?:соцмереж|месенджер|канал|чат|бот|допис|сториз|підпис|директ|інстаґрам|інстаграм)/u.test(item.lower))
      || (word.value[0] === word.value[0].toLocaleUpperCase('uk') && word.value[0] !== word.value[0].toLocaleLowerCase('uk'));
  }
  function edit(text, options = {}) {
    const enabled = { initial: true, loans: true, ending: true, euphony: true, ...options };
    const words = tokenize(text);
    const changes = [];
    let output = '', cursor = 0;
    words.forEach((word, index) => {
      output += text.slice(cursor, word.start);
      let replacement = word.value, label = '';
      if (word.protected) { output += word.value; cursor = word.end; return; }
      const rule = entries.get(word.lower);
      const isTelegram = word.lower.startsWith('телеграм') || word.lower === 'telegram';
      const isTgChannel = word.lower === 'тг' && text.slice(word.end, words[index + 1]?.start) === '-' && words[index + 1]?.lower.startsWith('канал');
      if (rule && enabled[rule.group] && (!isTelegram || socialPlatformContext(words, index, text)) && (word.lower !== 'тг' || isTgChannel)) {
        replacement = caseLike(word.value, rule.to); label = rule.label;
      }
      if (replacement === word.value && enabled.loans && derivedLoan(word.lower)) {
        replacement = caseLike(word.value, derivedLoan(word.lower)); label = 'Запозичення та спільнокореневі слова';
      }
      const overrides = enabled.genitiveOverrides || [];
      const genitive = enabled.ending && genitiveForm(replacement.toLocaleLowerCase('uk').replace(/[’ʼ]/g, "'"), overrides);
      if (genitive) {
        const context = genitiveContext(words, index, text);
        if (context.kind === 'genitive') { replacement = caseLike(word.value, genitive); label = label ? label + '; ' + context.reason : context.reason; }
      }
      if (replacement === word.value && enabled.euphony) { const candidate = euphony(word, words, index, text); if (candidate) { replacement = caseLike(word.value, candidate); label = 'Милозвучність'; } }
      if (replacement !== word.value) changes.push({ from: word.value, to: replacement, rule: label, start: output.length, end: output.length + replacement.length });
      output += replacement; cursor = word.end;
    });
    return { text: output + text.slice(cursor), changes };
  }

  const accepted = new Set([...entries.values()].map(entry => entry.to.toLocaleLowerCase('uk')));
  for (const word of shared.words) accepted.add(word.toLocaleLowerCase('uk'));
  const abbreviations = new Set(shared.abbreviations.map(word => word.toLocaleLowerCase('uk')));
  const api = { edit, tokenize, protectedRanges, genitiveForm, genitiveContext, caseLike,
    accepted: word => {
      const lower = word.toLocaleLowerCase('uk');
      return accepted.has(lower) || /^меморіял[а-яіїєґ]*$/u.test(lower) || /^ініціятив[а-яіїєґ]*$/u.test(lower)
        || (lower.startsWith('медія') && MEDIA_COMPOUND.test(lower.slice('медія'.length)));
    },
    acceptedAbbreviation: word => abbreviations.has(word.toLocaleLowerCase('uk')),
    rvnWords: () => [...accepted],
    isRvnGenitive: (word, overrides = []) => [...GENITIVE.values()].includes(word) || overrides.some(item => item.to.toLocaleLowerCase('uk') === word) || /ости$/u.test(word)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RVNEditor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
