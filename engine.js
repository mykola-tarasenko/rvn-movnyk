/* Правила укладено за путівником ГО «РВН». Не застосовуємо глобальних замін літер. */
(function (root) {
  'use strict';

  const shared = typeof module !== 'undefined' && module.exports ? require('./shared-exceptions.js') : root.RVNSharedExceptions;

  const WORDS = /[\p{L}\p{M}]+(?:['’ʼ][\p{L}\p{M}]+)*/gu;
  const HARD_NOUN = ['', 'а', 'у', 'ові', 'еві', 'ом', 'і', 'е', 'и', 'ів', 'ам', 'ами', 'ах'];
  const MEDIA_COMPOUND = /^(?:прост|контент|грамотн|платформ|проєкт|ресурс|центр|компані|текст|освіт|комунікац|ринк|сфер|дослідж|відділ|пол|продукт|виробниц|експерт|партнер|план)/u;
  const entries = new Map();
  const ROOTS = [];

  function add(from, to, group, label) {
    const key = from.toLocaleLowerCase('uk');
    if (key !== to.toLocaleLowerCase('uk')) entries.set(key, { to, group, label });
  }
  function stem(from, to, endings, group, label) {
    for (const ending of endings) add(from + ending, to + ending, group, label);
  }
  function pair(from, to, group, label) { add(from, to, group, label); }
  // Корінь РВН діє в кожному слові, яке його містить: у відмінках, похідних і складних словах
  // (плян, плянування, заплянувати, генплян). skip — слова, де ці літери не є коренем
  // (планета, вагітна, кефір); review — похідні, яких путівник не визначає: лише підказка.
  // Повний перелік змін за словником: node scripts/audit-roots.cjs.
  function addRoot(from, to, group, label, rule = {}) { ROOTS.push({ from, to, group, label, start: false, skip: null, review: null, ...rule }); }
  function derivedLoan(lower) {
    if (lower.startsWith('медіа') && MEDIA_COMPOUND.test(lower.slice('медіа'.length))) return 'медія' + lower.slice('медіа'.length);
    return null;
  }

  for (const [from, to, rule] of [['інш', 'инш', { skip: /^іншин/u }], ['інак', 'инак', { skip: /^інакт/u }], ['інозем', 'инозем'], ['ірод', 'ирод']])
    addRoot(from, to, 'initial', 'Початкове и', { start: true, ...rule });
  for (const [from, to] of [['іноді', 'иноді'], ['інколи', 'инколи']]) pair(from, to, 'initial', 'Початкове и');

  for (const [from, to, rule] of [
    // Після т у суфіксі пишемо и (правило дев'ятки): міфічний → мітичний.
    ['марафон', 'маратон'], ['міф', 'міт', { skip: /міфік|міфер|таміф|деміфіз/u, then: [/міті/gu, 'міти'] }], ['ефір', 'етер', { skip: /[кзш]ефір|олефір|нефірм/u }],
    ['логарифм', 'логаритм'], ['пафос', 'патос'], ['кафедр', 'катедр'], ['анафем', 'анатем'],
    ['орфограф', 'ортограф', { skip: /морфограф/u }], ['орфоеп', 'ортоеп'],
    ['аудит', 'авдит', { skip: /саудит/u }], ['аудієнц', 'авдієнц'], ['фаун', 'фавн', { skip: /фаунд/u }], ['європ', 'европ', { skip: /європ(?!е[йєїо]|ій|(?:а|и|і|у|ою|о)$)/u }], ['нейтрал', 'невтрал'],
    ['матеріал', 'матеріял'], ['тріум', 'тріюм', { skip: /атріум/u }], ['радіус', 'радіюс'], ['консиліум', 'консиліюм'],
    ['медіум', 'медіюм', { review: /ремедіум/u }], ['медіал', 'медіял'], ['діалект', 'діялект'], ['спеціал', 'спеціял'], ['соціал', 'соціял'],
    ['мініатюр', 'мініятюр'], ['паліатив', 'паліятив'], ['меморіал', 'меморіял'], ['ініціатив', 'ініціятив'],
    ['агент', 'аґент'], ['агенц', 'аґенц'], ['агроном', 'аґроном'], ['диригент', 'дириґент'], ['лінгвіст', 'лінґвіст'],
    ['агіт', 'аґіт', { skip: /вагіт|пагіт|фагіт|сагіт|ютагіт/u }], ['мігр', 'міґр', { skip: /мігрен/u, review: /мігрів/u }],
    ['гвард', 'ґвард', { skip: /гвардіол|гвардьол/u }], ['гірлянд', 'ґірлянд'], ['гарант', 'ґарант'], ['елегант', 'елеґант'], ['інтеліген', 'інтеліґен'],
    ['плантац', 'плянтац', { skip: /трансплант|імплант|експлант|реплант/u }], ['плантатор', 'плянтатор'],
    ['план', 'плян', {
      skip: /планет|планкт|плант|планш|планид|планин|планиц|планул|планд|апланат|есплан|експлан|каплан|спланх/u,
      review: /планк|планоч|планер|планар|планім|планісф|планіг|планотрон|планальн/u
    }],
    ['баланс', 'балянс'], ['шаблон', 'шабльон'], ['ломбард', 'льомбард', { review: /ломбардія|ломбардськ/u }], ['колорит', 'кольорит'],
    ['блокад', 'бльокад'], ['платформ', 'плятформ'], ['платин', 'плятин', { skip: /заплатин|неплатин/u }],
    ['ламп', 'лямп', { skip: /арламп|євламп|галамп|екламп|лампед|лампр/u, review: /лампад|лампас/u }],
    ['лаборатор', 'ляборатор'], ['лаборант', 'ляборант', { skip: /колабор/u }], ['деклам', 'деклям'], ['клавіш', 'клявіш'],
    // Іменник «клас» змінює рід (кляса), тому його відмінки обробляє SHIFTED, а не корінь.
    ['клас', 'кляс', { skip: /класт|теклас|ніклас|клас(?:|а|у|ом|і|е|и|ів|ам|ами|ах)$/u }]
  ]) addRoot(from, to, 'loans', 'Запозичення', rule);
  for (const [from, to] of [['бацила', 'бациля'], ['бацили', 'бацилі'], ['бацилу', 'бацилю'], ['бацилою', 'бацилею']]) pair(from, to, 'loans', 'Запозичення');
  pair('медіа', 'медія', 'loans', 'Іа → ія в запозиченні');
  stem('інстаграм', 'інстаґрам', HARD_NOUN, 'loans', 'G → ґ у назві соцмережі');
  stem('телеграм', 'телеґрам', ['', 'у', 'ові', 'ом', 'і'], 'loans', 'G → ґ у назві соцмережі');
  pair('instagram', 'інстаґрам', 'loans', 'Передавання назви Instagram');
  pair('telegram', 'телеґрам', 'loans', 'Передавання назви Telegram');
  pair('тг', 'тґ', 'loans', 'Скорочення «тґ-канал»');
  stem('європ', 'европ', ['а', 'и', 'і', 'у', 'ою', 'о'], 'loans', 'Запозичення');
  pair('Євфрат', 'Евфрат', 'loans', 'Запозичення');

  // За РВН «клас» і «зал» — жіночого роду (кляса, заля). Кожна форма має прочитання [відмінок, форма РВН, рід
  // стандартної форми: m — чоловічий, f — «зала», p — множина]. Неоднозначні форми та сполуки з означенням
  // чоловічого роду не змінюємо автоматично, а пропонуємо на перевірку.
  const SHIFTED = new Map([
    ['клас', [['nom', 'кляса'], ['acc', 'клясу']]], ['класу', [['gen', 'кляси']]], ['класові', [['dat', 'клясі'], ['adj', 'клясові', 'p']]],
    ['класом', [['ins', 'клясою']]], ['класі', [['loc', 'клясі']]], ['класи', [['pl', 'кляси', 'p']]], ['класів', [['pl', 'кляс', 'p']]],
    ['класам', [['pl', 'клясам', 'p']]], ['класами', [['pl', 'клясами', 'p']]], ['класах', [['pl', 'клясах', 'p']]],
    ['зал', [['nom', 'заля'], ['acc', 'залю']]], ['залу', [['gen', 'залі'], ['acc', 'залю', 'f']]], ['залові', [['dat', 'залі']]],
    ['залом', [['ins', 'залею']]], ['зали', [['pl', 'залі', 'p']]], ['зала', [['nom', 'заля', 'f']]], ['залою', [['ins', 'залею', 'f']]],
    ['залам', [['pl', 'залям', 'p']]], ['залами', [['pl', 'залями', 'p']]], ['залах', [['pl', 'залях', 'p']]]
  ]);
  const CASE_NAMES = { nom: 'називний', acc: 'знахідний', gen: 'родовий', dat: 'давальний', ins: 'орудний', loc: 'місцевий', pl: 'множина', adj: 'прикметник' };
  const ACCUSATIVE_GOVERNORS = new Set('у в на за через про крізь під понад поза'.split(' '));
  const DATIVE_GOVERNORS = new Set('завдяки всупереч наперекір назустріч'.split(' '));
  const FEMININE = {
    nom: [['ій', 'я'], ['ий', 'а']], acc: [['ій', 'ю'], ['ий', 'у']], gen: [['ього', 'ьої'], ['ого', 'ої']],
    dat: [['ьому', 'ій'], ['ому', 'ій']], ins: [['їм', null], ['ім', 'ьою'], ['им', 'ою']], loc: [['ьому', 'ій'], ['ому', 'ій'], ['ім', 'ій']]
  };
  const PRONOUNS = new Map(Object.entries({
    цей: ['ця', 'цю'], той: ['та', 'ту'], мій: ['моя', 'мою'], твій: ['твоя', 'твою'], свій: ['своя', 'свою'], наш: ['наша', 'нашу'],
    ваш: ['ваша', 'вашу'], весь: ['вся', 'всю'], увесь: ['уся', 'усю'], один: ['одна', 'одну'], кожен: ['кожна', 'кожну']
  }));
  const OBLIQUE_PRONOUNS = new Map(Object.entries({
    цього: 'цієї', того: 'тієї', мого: 'моєї', твого: 'твоєї', свого: 'своєї', всього: 'всієї', усього: 'усієї', одного: 'однієї',
    цьому: 'цій', моєму: 'моїй', твоєму: 'твоїй', своєму: 'своїй', всьому: 'всій', усьому: 'усій', одному: 'одній',
    цим: 'цією', тим: 'тією', одним: 'однією', моїм: 'моєю', твоїм: 'твоєю', своїм: 'своєю'
  }));
  const NOT_MODIFIERS = new Set('тому чому кому ньому ним нім їм всім усім якому якім'.split(' '));
  const TRANSPARENT = new Set(['його', 'її', 'їх']);
  const COUNTED = new Map([['два', 'дві'], ['обидва', 'обидві'], ['півтора', 'півтори']]);

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
    const upper = char => char === char.toLocaleUpperCase('uk') && char !== char.toLocaleLowerCase('uk');
    // Змішаний регістр (ЄвроПравда) переносимо посимвольно, якщо довжина не змінилася.
    if (original.length === replacement.length && [...original.slice(1)].some(upper)) return [...replacement].map((char, i) => upper(original[i]) ? char.toLocaleUpperCase('uk') : char).join('');
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
  // out — уже виправлені попередні слова: «у школу й у кімнату», а не «й в кімнату».
  function euphony(word, words, index, text, out = []) {
    const lower = word.lower;
    if (!['у', 'в', 'і', 'й', 'з'].includes(lower)) return null;
    const next = words[index + 1];
    const plain = (left, right) => !right.protected && /^[а-яіїєґ]/u.test(right.lower) && !/[^\s«»„“”"']/u.test(text.slice(left.end, right.start));
    if (!next || !plain(word, next)) return null;
    const prev = words[index - 1];
    const before = prev && !/[,.!?;:\n—–]/u.test(text.slice(prev.end, word.start)) ? (out[index - 1] ?? prev.value).toLocaleLowerCase('uk') : '';
    if (lower === 'з') return /^(?:[сзшжщ][бвгґджзклмнпрстфхцчшщ]|мною|льв)/u.test(next.lower) ? 'зі' : null;
    if (lower === 'у' || lower === 'в') {
      if (/^(?:в|ф|св|хв|тв|льв)/u.test(next.lower)) return 'у';
      if (FIRST_VOWEL.test(next.lower)) return 'в';
      return before && VOWEL.test(before) ? 'в' : 'у';
    }
    // Повторювані сполучники та частки зберігаємо.
    if (words.slice(Math.max(0, index - 5), index).some(w => ['і', 'й'].includes(w.lower)) || words.slice(index + 1, index + 5).some(w => ['і', 'й'].includes(w.lower))) return null;
    if (/^[йяюєї]/u.test(next.lower)) return 'і';
    // Перед «в» + голосний прийменник лишається «в», тож сполучник — «і»: «мама і в Одесі».
    const after = words[index + 2];
    if (['в', 'у'].includes(next.lower) && after && plain(next, after) && FIRST_VOWEL.test(after.lower)) return 'і';
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
  function rootStatus(rule, lower) {
    if (rule.start ? !lower.startsWith(rule.from) : !lower.includes(rule.from)) return null;
    return rule.skip?.test(lower) ? 'skip' : rule.review?.test(lower) ? 'review' : 'auto';
  }
  // Форма РВН для слова без точного запису: «медіа»-складні слова й корені з ROOTS.
  function rootForm(lower, enabled = {}) {
    let form = (enabled.loans !== false && derivedLoan(lower)) || lower, review = false;
    const labels = form === lower ? [] : ['Іа → ія в медійних складних словах'];
    for (const rule of ROOTS) {
      const status = enabled[rule.group] !== false && form.includes(rule.from) && rootStatus(rule, lower);
      if (!status || status === 'skip') continue;
      form = rule.start ? rule.to + form.slice(rule.from.length) : form.replaceAll(rule.from, rule.to);
      if (rule.then) form = form.replace(...rule.then);
      review ||= status === 'review';
      labels.push(`${rule.label}: ${rule.from} → ${rule.to}`);
    }
    return form === lower ? null : { to: form, review, label: labels.join('; ') };
  }
  // Стандартне написання, з якого правила РВН утворюють це слово (для перевірки словником).
  function standardForms(lower) {
    let form = lower.startsWith('медія') ? 'медіа' + lower.slice('медія'.length) : lower;
    for (const rule of ROOTS) {
      if (rule.start) { if (form.startsWith(rule.to)) form = rule.from + form.slice(rule.to.length); continue; }
      if (rule.then) form = form.replaceAll(rule.then[1], rule.to + 'і');
      form = form.replaceAll(rule.to, rule.from);
    }
    return form !== lower && rootForm(form)?.to === lower ? [form] : [];
  }
  function feminine(lower, grammaticalCase) {
    if (PRONOUNS.has(lower)) return { nom: PRONOUNS.get(lower)[0], acc: PRONOUNS.get(lower)[1] }[grammaticalCase] || null;
    if (OBLIQUE_PRONOUNS.has(lower)) return OBLIQUE_PRONOUNS.get(lower);
    const ending = (FEMININE[grammaticalCase] || []).find(([from]) => lower.endsWith(from));
    return ending && ending[1] ? lower.slice(0, -ending[0].length) + ending[1] : null;
  }
  const masculineModifier = lower => PRONOUNS.has(lower) || OBLIQUE_PRONOUNS.has(lower)
    || (lower.length > 3 && !NOT_MODIFIERS.has(lower) && /(?:ий|ій|ого|ього|ому|ьому|им|ім)$/u.test(lower));
  function shiftedNoun(words, index, text, out) {
    const word = words[index];
    const modifiers = [];
    let governor = null, j = index - 1;
    for (; j >= 0 && index - j <= 5; j--) {
      if (words[j].protected || !/^[\s\d]*$/u.test(text.slice(words[j].end, words[j + 1].start))) break;
      const lower = words[j].lower;
      if (TRANSPARENT.has(lower)) continue;
      if (!masculineModifier(lower)) { governor = lower; break; }
      modifiers.unshift(j);
    }
    let readings = SHIFTED.get(word.lower);
    if (modifiers.length) readings = readings.filter(([, , gender = 'm']) => gender === 'm');
    const governed = ACCUSATIVE_GOVERNORS.has(governor) ? 'acc' : DATIVE_GOVERNORS.has(governor) ? 'dat'
      : GENITIVE_GOVERNORS.has(governor) || genitiveContext(words, index, text).kind === 'genitive' ? 'gen' : null;
    if (governed && readings.some(([grammaticalCase]) => grammaticalCase === governed)) readings = readings.filter(([grammaticalCase]) => grammaticalCase === governed);
    const counted = readings.every(([, , gender]) => gender === 'p') && words[index - 1] && COUNTED.has(words[index - 1].lower)
      && /^\s+$/u.test(text.slice(words[index - 1].end, word.start)) ? index - 1 : null;
    const agree = counted !== null ? [counted] : readings.some(([, , gender = 'm']) => gender === 'm') ? modifiers : [];
    if (new Set(readings.map(([, form]) => form)).size === 1 && !agree.length) return { to: readings[0][1] };
    const base = word.lower.startsWith('клас') ? ['клас', 'кляса'] : ['зал', 'заля'];
    const phrase = ([grammaticalCase, form]) => {
      if (!agree.length) return caseLike(word.value, form);
      let result = '';
      for (let k = agree[0]; k < index; k++) {
        const value = out[k], lower = value.toLocaleLowerCase('uk');
        const changed = !agree.includes(k) ? value : COUNTED.get(lower) || feminine(lower, grammaticalCase);
        if (!changed) return null;
        result += caseLike(value, changed) + text.slice(words[k].end, words[k + 1].start);
      }
      return result + caseLike(word.value, form);
    };
    let replacements = readings.map(phrase);
    const whole = agree.length > 0 && replacements.every(Boolean);
    if (!whole) replacements = readings.map(([, form]) => caseLike(word.value, form));
    const message = `За РВН «${base[0]}» — жіночого роду («${base[1]}»). `
      + (agree.length ? (whole ? 'Разом з іменником змінюємо й узгоджене слово.' : 'Після заміни узгодьте означення вручну.') + ' '
        : '')
      + (readings.length > 1 ? 'Оберіть форму за відмінком: ' + readings.map(([grammaticalCase, form]) => `«${form}» — ${CASE_NAMES[grammaticalCase]}`).join(', ') + '.' : '');
    return { review: { first: whole ? agree[0] : index, replacements: [...new Set(replacements)], message: message.trim() } };
  }
  function edit(text, options = {}) {
    const enabled = { initial: true, loans: true, ending: true, euphony: true, ...options };
    // known перевіряє стандартне слово за словником: власні назви та друкарські помилки не змінюємо.
    const known = options.known ? word => options.known(word) || (/ости$/u.test(word) && options.known(word.slice(0, -1) + 'і')) : () => true;
    const words = tokenize(text);
    const changes = [], reviews = [], out = [], starts = [];
    let output = '', cursor = 0;
    words.forEach((word, index) => {
      output += text.slice(cursor, word.start);
      starts[index] = output.length;
      let replacement = word.value, label = '';
      if (word.protected) { out[index] = word.value; output += word.value; cursor = word.end; return; }
      const rule = entries.get(word.lower);
      const isTelegram = word.lower.startsWith('телеграм') || word.lower === 'telegram';
      const isTgChannel = word.lower === 'тг' && text.slice(word.end, words[index + 1]?.start) === '-' && words[index + 1]?.lower.startsWith('канал');
      if (rule) {
        if (enabled[rule.group] && (!isTelegram || socialPlatformContext(words, index, text)) && (word.lower !== 'тг' || isTgChannel)) {
          replacement = caseLike(word.value, rule.to); label = rule.label;
        }
      } else if (SHIFTED.has(word.lower)) {
        const shifted = enabled.loans && shiftedNoun(words, index, text, out);
        if (shifted?.to) { replacement = caseLike(word.value, shifted.to); label = 'Запозичення: жіночий рід за РВН'; }
        else if (shifted?.review) {
          const start = starts[shifted.review.first];
          reviews.push({ start, end: output.length + word.value.length, from: output.slice(start) + word.value, replacements: shifted.review.replacements, message: shifted.review.message });
        }
      } else {
        const derived = rootForm(word.lower, enabled);
        // Слово, яке словник знає лише з великої літери, — власна назва: тільки підказка.
        const common = derived && known(word.lower), name = derived && !common && known(word.value.replace(/[’ʼ]/g, "'"));
        if (common || name) {
          if (common && !derived.review) { replacement = caseLike(word.value, derived.to); label = derived.label; }
          else reviews.push({ start: output.length, end: output.length + word.value.length, from: word.value, replacements: [caseLike(word.value, derived.to)],
            message: `Можливе похідне від кореня РВН (${derived.label.replace(/^[^:]+: /u, '')}). Путівник не визначає цього слова однозначно, тож вирішіть самі.` });
        }
      }
      const overrides = enabled.genitiveOverrides || [];
      const genitive = enabled.ending && genitiveForm(replacement.toLocaleLowerCase('uk').replace(/[’ʼ]/g, "'"), overrides);
      if (genitive) {
        const context = genitiveContext(words, index, text);
        if (context.kind === 'genitive') { replacement = caseLike(word.value, genitive); label = label ? label + '; ' + context.reason : context.reason; }
      }
      if (replacement === word.value && enabled.euphony) { const candidate = euphony(word, words, index, text, out); if (candidate) { replacement = caseLike(word.value, candidate); label = 'Милозвучність'; } }
      if (replacement !== word.value) changes.push({ from: word.value, to: replacement, rule: label, start: output.length, end: output.length + replacement.length });
      out[index] = replacement; output += replacement; cursor = word.end;
    });
    return { text: output + text.slice(cursor), changes, reviews };
  }

  const accepted = new Set([...entries.values()].map(entry => entry.to.toLocaleLowerCase('uk')));
  for (const readings of SHIFTED.values()) for (const [, form] of readings) accepted.add(form);
  for (const word of shared.words) accepted.add(word.toLocaleLowerCase('uk'));
  const abbreviations = new Set(shared.abbreviations.map(word => word.toLocaleLowerCase('uk')));
  const api = { edit, tokenize, protectedRanges, genitiveForm, genitiveContext, caseLike, rootForm, standardForms,
    roots: () => ROOTS.map(rule => ({ ...rule, status: lower => rootStatus(rule, lower) })),
    accepted: word => {
      const lower = word.toLocaleLowerCase('uk');
      return accepted.has(lower) || (lower.startsWith('медія') && MEDIA_COMPOUND.test(lower.slice('медія'.length)));
    },
    acceptedAbbreviation: word => abbreviations.has(word.toLocaleLowerCase('uk')),
    rvnWords: () => [...accepted],
    isRvnGenitive: (word, overrides = []) => [...GENITIVE.values()].includes(word) || overrides.some(item => item.to.toLocaleLowerCase('uk') === word) || /ости$/u.test(word)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RVNEditor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
