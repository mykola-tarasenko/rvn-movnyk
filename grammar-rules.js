/* Граматичні правила на основі словника. Основу слова («працює» → «працювати») і всі її форми дає
   lazy-spell.js, а граматичну форму дієслова визначаємо за закінченням. Усі правила лише пропонують зміни. */
(function (root) {
  'use strict';
  const engine = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.RVNEditor;

  // Закінчення → форма дієслова (-ся/-сь відкидаємо): 1s…3p — теперішній або простий майбутній час,
  // f1s…f3p — складений майбутній, pm/pf/pn/pl — минулий час, i… — наказовий спосіб.
  const VERB_ENDINGS = Object.entries({
    тимуть: 'f3p', тимете: 'f2p', тимемо: 'f1p', тимем: 'f1p', тимеш: 'f2s', тиметь: 'f3s', тиме: 'f3s', тиму: 'f1s',
    вши: 'gp', чи: 'ga', ймо: 'i1p', імо: 'i1p', ьмо: 'i1p', йте: 'i2p', іть: 'i2p', ьте: 'i2p', ти: 'inf',
    ли: 'pl', ла: 'pf', ло: 'pn', в: 'pm',
    ємо: '1p', емо: '1p', имо: '1p', їмо: '1p', єте: '2p', ете: '2p', ите: '2p', їте: '2p',
    ють: '3p', уть: '3p', ять: '3p', ать: '3p', єш: '2s', еш: '2s', иш: '2s', їш: '2s',
    єть: '3s', еть: '3s', ить: '3s', їть: '3s', є: '3s', е: '3s', ю: '1s', у: '1s', й: 'i2s', и: 'i2s', ь: 'i2s'
  }).sort((a, b) => b[0].length - a[0].length);
  const TENSES = [['1s', '2s', '3s', '1p', '2p', '3p'], ['f1s', 'f2s', 'f3s', 'f1p', 'f2p', 'f3p'], ['pm', 'pf', 'pn', 'pl']];
  // Займенник → допустимі форми в кожному часі (той самий порядок, що й TENSES).
  const PERSONS = {
    я: [['1s'], ['f1s'], ['pm', 'pf']], ти: [['2s'], ['f2s'], ['pm', 'pf']], він: [['3s'], ['f3s'], ['pm']], вона: [['3s'], ['f3s'], ['pf']],
    воно: [['3s'], ['f3s'], ['pn']], ми: [['1p'], ['f1p'], ['pl']], ви: [['2p'], ['f2p'], ['pl']], вони: [['3p'], ['f3p'], ['pl']]
  };
  // Дієслова сприймання й знання: після них підрядне речення з «як», «де», «хто»… відокремлюємо комою.
  const COGNITION = new Set(('бачити побачити знати дізнатися дізнаватися розуміти зрозуміти помітити помічати пояснити пояснювати чути почути ' +
    'відчувати відчути дивитися подивитися спостерігати пам\'ятати запам\'ятати уявити уявляти розповісти розповідати показати показувати ' +
    'вчити навчити навчитися згадати згадувати питати запитати спитати розказати дивуватися здивуватися вирішити вирішувати ' +
    'з\'ясувати з\'ясовувати перевірити перевіряти обговорити обговорювати цікавитися').split(' '));
  const QUESTION_WORDS = new Set('як де куди звідки чому навіщо скільки наскільки хто кого кому ким чий чия чиє чиї який яка яке які якого якої якому якій яку яким якою яких якими'.split(' '));
  const RELATIVE = new Set('який яка яке які якого якої якому якій яку яким якою яких якими котрий котра котре котрі котрого котрої котрому котрій котру котрим котрою котрих котрими'.split(' '));
  const PREPOSITIONS = new Set('в у на з із зі до від для про за під над при без після через між серед перед по крізь біля коло щодо завдяки'.split(' '));
  // Звертання: загальні назви осіб і слова, що їх супроводжують.
  const ADDRESS_LEMMAS = new Set(('друг друзі подруга колега пан пані панство команда брат сестра мама мати тато батько син донька дитина ' +
    'учасник учасниця волонтер волонтерка читач читачка підписник підписниця побратим посестра товариш товаришка громада ' +
    'студент студентка учень учениця вчитель вчителька пан-отець добродій добродійка').split(' '));
  const ADDRESS_TITLES = new Set('пане пані панове шановний шановна шановні дорогий дорога дорогі любий люба любі'.split(' '));
  const MASCULINE_VOCATIVE_U = new Set('тату сину синку діду батьку'.split(' '));
  const GREETINGS = /(?:^|[\s,.!?…])((?:щиро\s+)?(?:привіт|вітаю|дякую|дякуємо|спасибі|бувай|бувайте|прощавай|добраніч|добрий\s+(?:день|вечір|ранок)|доброго\s+(?:дня|ранку|вечора)|до\s+(?:зустрічі|побачення)))(?=\s)/giu;
  // Іменники спільного роду та чоловічого роду на -а/-я, -о: рід за закінченням не визначаємо.
  const COMMON_GENDER = new Set('голова суддя староста колега сирота слуга бідолаха нероба листоноша воєвода задира базіка вбивця убивця п\'яниця гуляка тато дідо'.split(' '));
  const NOT_ADJECTIVES = new Set('мій твій свій чий'.split(' '));
  // Подвоєний приголосний + я зазвичай означає середній рід (рішення, життя), але не в цих словах.
  const FEMININE_DOUBLED = new Set(['стаття', 'рілля']);

  function create(spell) {
    const available = typeof spell.bases === 'function' && typeof spell.forms === 'function';
    const cache = new Map();
    // Написання РВН (плян, спеціяльний, радости) зводимо до стандартного, якого шукаємо у словнику.
    const standard = word => {
      const lower = word.toLocaleLowerCase('uk');
      const forms = engine.standardForms(lower);
      if (/ости$/u.test(lower)) forms.push(lower.slice(0, -1) + 'і', ...engine.standardForms(lower.slice(0, -1) + 'і'));
      return forms.map(form => word === lower ? form : engine.caseLike(word, form));
    };
    const bases = word => {
      if (!available) return [];
      if (!cache.has(word)) {
        let found = spell.bases(word);
        for (const form of found.length ? [] : standard(word)) if (!found.length) found = spell.bases(form);
        cache.set(word, found);
        if (cache.size > 5000) cache.delete(cache.keys().next().value);
      }
      return cache.get(word);
    };
    // Підказку для слова в написанні РВН теж подаємо в написанні РВН: «плянує» → «плянуємо».
    const likeWritten = (written, form) => spell.bases(written).length ? form : engine.rootForm(form)?.to || form;
    const isVerbLemma = lemma => /(?:ти|тися|тись)$/u.test(lemma);
    const isAdjectiveLemma = lemma => lemma.length > 3 && /(?:ий|ій|їй)$/u.test(lemma) && !NOT_ADJECTIVES.has(lemma);
    const allOf = (word, test) => { const found = bases(word); return found.length && found.every(test) ? found : null; };
    const verbLemmas = word => allOf(word, isVerbLemma);
    function slot(form, lemma) {
      const plain = form.replace(/(?:ся|сь)$/u, '');
      // Після приголосного -те/-мо — лише наказовий спосіб: «перевірте», «перевірмо».
      if (/[бвгґджзклмнпрстфхцчшщ](?:те|мо)$/u.test(plain)) return plain.endsWith('те') ? 'i2p' : 'i1p';
      const hit = VERB_ENDINGS.find(([ending]) => plain.endsWith(ending));
      const result = hit ? hit[1] : /[бвгґджзклмнпрстфхцчшщ]$/u.test(plain) ? 'i2s' : null;
      // «надішли» — наказовий спосіб, а не минулий час: у словнику є пара «надішліть».
      if (result === 'pl' && lemma && spell.forms(lemma).includes(form.replace(/и((?:ся|сь)?)$/u, 'іть$1'))) return 'i2s';
      return result;
    }
    const commonPrefix = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };
    // Форма основи в потрібній граматичній формі, найближча до написаного слова (вигравають / виграють).
    function formFor(lemma, wanted, like) {
      const reflexive = /(?:ся|сь)$/u.test(like);
      return spell.forms(lemma).filter(form => slot(form, lemma) === wanted && /(?:ся|сь)$/u.test(form) === reflexive)
        .sort((a, b) => commonPrefix(b, like) - commonPrefix(a, like))[0] || null;
    }
    // Іменник у початковій формі: рід за закінченням; сумнівні закінчення (-ь, -сть, шиплячі) пропускаємо.
    function nounGender(word) {
      const candidates = [word, ...standard(word)].flatMap(form => [form.toLocaleLowerCase('uk'), form]);
      const lemma = candidates.find(form => spell.inflected(form));
      const lower = lemma ? lemma.toLocaleLowerCase('uk') : '';
      if (!lemma || isVerbLemma(lower) || isAdjectiveLemma(lower) || COMMON_GENDER.has(lower) || /ько$/u.test(lower)) return null;
      if (/([бвгґджзклмнпрстфхцчшщ])\1я$/u.test(lower)) return FEMININE_DOUBLED.has(lower) ? 'f' : 'n';
      if (/'я$/u.test(lower)) return null;
      // Середній рід на -а/-я з нарощенням: кошеня — кошеняти, ім'я — імені.
      if (/[ая]$/u.test(lower)) return spell.forms(lemma).some(form => form === lemma + 'ти' || form === lemma.slice(0, -1) + 'ені') ? 'n' : 'f';
      if (/[оеє]$/u.test(lower)) return 'n';
      if (/(?:ть|[ьчжшщв])$/u.test(lower)) return null;
      if (/[бгґдзклмнпрстфхцй]$/u.test(lower)) return 'm';
      return null;
    }
    function adjectiveForms(lemma) {
      const soft = !/ий$/u.test(lemma), stem = lemma.slice(0, -2);
      return { m: lemma, f: stem + (soft ? 'я' : 'а'), n: stem + (soft ? 'є' : 'е') };
    }
    const isCapitalized = value => value[0] !== value[0].toLocaleLowerCase('uk') && value.slice(1) === value.slice(1).toLocaleLowerCase('uk');
    // Ім'я у звертанні: власна назва зі словника в кличному чи називному відмінку («Маріє», «Марія», але не
    // «Марії» — «Дякую Марії за допомогу») або невідоме слово з великої літери без закінчень непрямих відмінків.
    function isName(word) {
      if (!isCapitalized(word.value)) return false;
      const found = bases(word.value).filter(isCapitalized);
      if (found.length) return found.includes(word.value) || /(?:е|о|ю|є)$/u.test(word.lower);
      return !bases(word.value).length && !bases(word.lower).length && !/(?:і|ї|у|ові|еві|ом|ем|ою|ею|ам|ах|ами)$/u.test(word.lower);
    }
    function isAddressNoun(word) {
      if (!bases(word.lower).some(lemma => ADDRESS_LEMMAS.has(lemma))) return false;
      if (/у$/u.test(word.lower)) return MASCULINE_VOCATIVE_U.has(word.lower);
      return /(?:е|о|ю|є|і|и)$/u.test(word.lower) && !/(?:ові|еві)$/u.test(word.lower);
    }
    const addressWord = word => !word.protected && (isName(word) || isAddressNoun(word));
    // Наказовий спосіб або 2-га особа після звертання: «Маріє, перевір», «Друзі, ви знаєте».
    const callsListener = word => ['ти', 'ви'].includes(word.lower)
      || (verbLemmas(word.lower) && ['i2s', 'i1p', 'i2p', '2s', '2p', 'f2s', 'f2p'].includes(slot(word.lower, verbLemmas(word.lower)[0])));
    const nounLike = word => { const found = bases(word.lower); return found.length > 0 && found.every(lemma => spell.inflected(lemma) && !isVerbLemma(lemma) && !isAdjectiveLemma(lemma)); };

    // Прямі форми іменника для узгодження з числівником: lemma — називний однини, few — називний множини (2–4),
    // many — родовий множини (5+), genSing — родовий однини (дроби). Неоднозначні основи пропускаємо.
    function nounParadigm(value) {
      const found = bases(value.toLocaleLowerCase('uk').replace(/[’ʼ]/gu, "'"));
      const lemma = found[0];
      if (found.length !== 1 || !spell.inflected(lemma) || isVerbLemma(lemma) || isAdjectiveLemma(lemma)) return null;
      const forms = spell.forms(lemma), gender = nounGender(lemma);
      // Орудний і давальний (будинками, дневі, ніччю) — не прямі форми, тож відкидаємо їх одразу.
      const pick = test => forms.filter(form => test(form) && !/(?:ами|ями|ові|еві|єві|ою|ею|єю|([бвгґджзклмнпрстфхцчшщ])\1ю)$/u.test(form));
      // Родовий множини з нульовим закінченням (книг, міст, гривень, подій), але не -ам/-ах/-ом (книгам, містом).
      // Якщо є форма на -и (зошити, книги), то форма на -і — місцевий чи давальний (зошиті, книзі).
      const plural = list => list.some(form => /и$/u.test(form)) ? list.filter(form => !/[ії]$/u.test(form)) : list;
      const zero = () => pick(form => /(?:ей|ів|їв|[бвгґджзклмнпрстфхцчшщьй])$/u.test(form) && !/(?:ам|ям|ах|ях|ом|ем|єм|ами|ями)$/u.test(form));
      let few, many, genSing;
      if (/[бвгґджзклмнпрстфхцчшщй]$/u.test(lemma)) {
        // Без певного роду (ніч, подорож) родовий однини може бути й на -і.
        few = plural(pick(form => /[иії]$/u.test(form)));
        many = pick(form => /(?:ів|їв|ей)$/u.test(form));
        genSing = pick(form => (gender ? /[аяую]$/u : /[аяуюиі]$/u).test(form));
      } else if (/ь$/u.test(lemma)) {
        few = pick(form => /[іи]$/u.test(form));
        many = pick(form => /(?:ів|їв|ей)$/u.test(form));
        genSing = pick(form => /[аяіи]$/u.test(form));
      } else if (gender === 'f') {
        few = genSing = plural(pick(form => /[иії]$/u.test(form)));
        many = zero();
      } else if (gender === 'n' && (!/я$/u.test(lemma) || /([бвгґджзклмнпрстфхцчшщ])\1я$/u.test(lemma))) {
        few = genSing = /я$/u.test(lemma) ? [lemma] : pick(form => /[ая]$/u.test(form));
        many = zero();
      } else return null;
      // Для одиниць міри родовий однини на -а звичніший: «1,5 літра», «2,5 метра».
      genSing = [...genSing].sort((a, b) => /[ая]$/u.test(b) - /[ая]$/u.test(a));
      return many.length && few.length ? { lemma, gender, few, many, genSing } : null;
    }

    return {
      available,
      nounParadigm: word => available ? nounParadigm(word) : null,
      adjective: word => available && bases(word.toLocaleLowerCase('uk').replace(/[’ʼ]/gu, "'")).some(isAdjectiveLemma),
      // Початок підрядного речення, перед яким потрібна кома, або -1.
      clauseStart(words, index, joined) {
        if (!available) return -1;
        const word = words[index], previous = words[index - 1];
        if (QUESTION_WORDS.has(word.lower) && bases(previous.lower).some(lemma => COGNITION.has(lemma))) return index;
        if (!RELATIVE.has(word.lower)) return -1;
        if (PREPOSITIONS.has(previous.lower)) return index > 1 && joined(words[index - 2], previous) && nounLike(words[index - 2]) ? index - 1 : -1;
        return nounLike(previous) ? index : -1;
      },
      addresses({ text, words, issue, joined }) {
        if (!available) return;
        const message = 'Ймовірне звертання: відокремте його комами.';
        // Звертання з 1–3 слів: [шановна] Олено [Петрівно]; «Пане» саме теж є звертанням.
        const addressAt = start => {
          const titled = ADDRESS_TITLES.has(words[start]?.lower) && words[start + 1] && joined(words[start], words[start + 1]) && addressWord(words[start + 1]);
          let end = titled ? start + 1 : start;
          if (!words[end] || !addressWord(words[end])) return -1;
          if (words[end + 1] && joined(words[end], words[end + 1]) && isName(words[end + 1]) && isName(words[end])) end++;
          return end;
        };
        words.forEach((word, index) => {
          const sentenceStart = index === 0 || /[.!?…\n]/u.test(text.slice(words[index - 1].end, word.start));
          if (!sentenceStart) return;
          const end = addressAt(index);
          const next = words[end + 1];
          if (end < 0 || !next || !joined(words[end], next) || !callsListener(next)) return;
          issue(word.start, words[end].end, 'punctuation', message, [text.slice(word.start, words[end].end) + ',']);
        });
        for (const match of text.matchAll(GREETINGS)) {
          const greetingEnd = match.index + match[0].length;
          const first = words.findIndex(word => word.start > greetingEnd);
          if (first < 0 || !/^[ \t]+$/u.test(text.slice(greetingEnd, words[first].start))) continue;
          const end = addressAt(first);
          if (end < 0) continue;
          const after = text.slice(words[end].end).match(/^[ \t]*(\S?)/u)[1];
          const address = text.slice(words[first].start, words[end].end);
          const continues = /\p{L}/u.test(after);
          issue(greetingEnd, words[end].end, 'punctuation', message, [', ' + address + (continues ? ',' : '')]);
        }
      },
      grammar({ text, words, issue, joined }) {
        if (!available) return;
        words.forEach((word, index) => {
          if (word.protected) return;
          const next = words[index + 1];
          // Займенник-підмет і дієслово: «Ми працює» → «працюємо», «Вона працював» → «працювала».
          const persons = PERSONS[word.lower];
          const previous = words[index - 1];
          const coordinated = previous && ['і', 'й', 'та', 'або', 'чи'].includes(previous.lower) && joined(previous, word);
          if (persons && !coordinated && next && joined(word, next)) {
            const verb = next.lower === 'не' && words[index + 2] && joined(next, words[index + 2]) ? words[index + 2] : next;
            // «є» вживаємо з усіма особами: «ми є», «ви є».
            const lemmas = !verb.protected && verb.lower !== 'є' && verbLemmas(verb.lower);
            const current = lemmas && slot(verb.lower, lemmas[0]);
            const tense = TENSES.findIndex(list => list.includes(current));
            if (tense > -1 && !persons[tense].includes(current)) {
              const options = [...new Set(persons[tense].map(wanted => formFor(lemmas[0], wanted, verb.lower)).filter(Boolean).map(form => likeWritten(verb.lower, form)))];
              if (options.length) issue(verb.start, verb.end, 'grammar', `Форма дієслова має узгоджуватися із займенником «${word.value}».`, options.map(option => engine.caseLike(verb.value, option)));
            }
          }
          // Прикметник у називному відмінку однини та іменник у початковій формі.
          if (next && joined(word, next) && !next.protected) {
            // Прикметник може збігатися з формою дієслова (синій — синіти), тож досить однієї основи-прикметника.
            const adjectives = bases(word.lower).filter(isAdjectiveLemma);
            const gender = adjectives.length > 0 && nounGender(next.value);
            if (gender) {
              // Порівнюємо в стандартному написанні, а пропонуємо форму РВН: «спеціяльна плятформа».
              const written = spell.bases(word.lower).length ? word.lower : standard(word.lower)[0] || word.lower;
              const forms = adjectiveForms(adjectives[0]);
              const current = Object.keys(forms).find(key => forms[key] === written);
              const wanted = current && current !== gender && spell.forms(adjectives[0]).includes(forms[gender]) && forms[gender];
              if (wanted) issue(word.start, word.end, 'grammar', `Перевірте узгодження означення з іменником «${next.value}» у роді та числі.`,
                [engine.caseLike(word.value, likeWritten(word.lower, wanted))]);
            }
          }
          // Кальки в будь-якій формі: «приймав участь» → «брав участь», «являється» → «є».
          if (next && next.lower === 'участь' && joined(word, next)) {
            const lemma = bases(word.lower).find(item => item === 'приймати' || item === 'прийняти');
            const target = lemma && formFor(lemma === 'приймати' ? 'брати' : 'взяти', slot(word.lower, lemma), word.lower);
            if (target) issue(word.start, next.end, 'grammar', 'Усталена сполука — «брати участь».', [engine.caseLike(word.value, target) + text.slice(word.end, next.start) + next.value]);
          }
          // Лише перед орудним відмінком («являється членом»): «являється уві сні» — це «з'являється».
          if (bases(word.lower).includes('являтися') && ['3s', '3p'].includes(slot(word.lower, 'являтися')) && next && joined(word, next)
            && /(?:ом|ем|єм|ою|ею|єю|ами|ями|им|ім)$/u.test(next.lower))
            issue(word.start, word.end, 'grammar', 'Калька: у значенні «бути» пишемо «є».', [engine.caseLike(word.value, 'є')]);
        });
        for (const match of text.matchAll(/(?<!\p{L})(слідуюч)(\p{L}*)/giu))
          issue(match.index, match.index + match[0].length, 'grammar', 'Калька: пишемо «наступний».', [engine.caseLike(match[0], 'наступн' + match[2].toLocaleLowerCase('uk'))]);
      }
    };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RVNGrammarRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
