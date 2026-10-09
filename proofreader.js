/* Context rules are review suggestions; dictionary misses are not declared errors. */
(function (root) {
  'use strict';
  const engine = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.RVNEditor;
  const numerals = typeof module !== 'undefined' && module.exports ? require('./numeral-agreement.js') : root.RVNNumeralAgreement;
  const grammarRules = typeof module !== 'undefined' && module.exports ? require('./grammar-rules.js') : root.RVNGrammarRules;
  const UK = /[а-яіїєґ]/iu;
  const norm = word => word.normalize('NFC').replace(/[’ʼ`]/g, "'").replace(/\u0301/g, '');
  const DEFAULTS = { initial: true, loans: true, ending: true, euphony: true, typography: true, spelling: true, punctuation: true, grammar: true, numerals: true };
  const SMILE = String.raw`(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*|[:;]-?[)(DPp])`;

  function create(spell) {
    const suggestionCache = new Map();
    const rules = grammarRules.create(spell);
    // Похідне слово РВН (плянування, матеріялізм) приймаємо, якщо словник знає його стандартне написання.
    const correct = word => spell.correct(word)
      || engine.standardForms(word.toLocaleLowerCase('uk')).some(form => spell.correct(form) || spell.correct(engine.caseLike(word, form)));
    function accepted(word, personal, sharedGenitive = []) {
      const w = norm(word), lower = w.toLocaleLowerCase('uk');
      if (personal.has(lower) || engine.accepted(lower) || ['РВН', 'ГО'].includes(word)) return true;
      if (correct(w)) return true;
      if (engine.isRvnGenitive(lower, sharedGenitive)) {
        const modern = lower.slice(0, -1) + 'і';
        if (correct(modern)) return true;
      }
      return false;
    }

    function typography(text) {
      const changes = [];
      function replace(pattern, replaceWith, rule) {
        const ranges = engine.protectedRanges(text);
        const priorChangeCount = changes.length;
        const edits = [];
        let shift = 0;
        text = text.replace(pattern, (...args) => {
          const value = args[0], start = args[args.length - 2];
          if (ranges.some(r => start < r.end && start + value.length > r.start)) return value;
          const to = typeof replaceWith === 'function' ? replaceWith(...args) : replaceWith;
          if (to !== value) {
            const outputStart = start + shift;
            changes.push({ from: value, to, rule, start: outputStart, end: outputStart + to.length });
            edits.push({ start, end: start + value.length, to });
            shift += to.length - value.length;
          }
          return to;
        });
        if (edits.length) {
          for (const change of changes.slice(0, priorChangeCount)) {
            const map = (position, isEnd) => {
              let delta = 0;
              for (const edit of edits) {
                if (position < edit.start) break;
                if (position >= edit.end) { delta += edit.to.length - (edit.end - edit.start); continue; }
                if (position === edit.start) return edit.start + delta;
                return edit.start + delta + (isEnd ? edit.to.length : 0);
              }
              return position + delta;
            };
            change.start = map(change.start, false);
            change.end = map(change.end, true);
          }
        }
      }
      replace(/([а-яіїєґ])['ʼ`’]([а-яіїєґ])/giu, (_, a, b) => a + '’' + b, 'Уніфіковано апостроф.');
      replace(/(\S)[ \t]{2,}(?=\S)/gu, (_, a) => a + ' ', 'Зайві пробіли між словами.');
      replace(/[ \t]+([,;!?])/gu, (_, mark) => mark, 'Пробіл перед розділовим знаком.');
      replace(/,{2,}/gu, ',', 'Повторена кома.');
      replace(/([,;:!?])(?=[А-Яа-яІіЇїЄєҐґ])/gu, (_, mark) => mark + ' ', 'Пропущений пробіл після розділового знака.');
      replace(/\.\.\./gu, '…', 'Уніфіковано три крапки.');
      replace(/"([^"\n]+)"/gu, (_, inside) => '«' + inside + '»', 'Українські парні лапки.');
      replace(/([А-Яа-яІіЇїЄєҐґ»]) - (?=[А-Яа-яІіЇїЄєҐґ«])/gu, (_, before) => before + ' — ', 'Тире між частинами вислову.');
      replace(/([\p{L}\p{M}\p{N}])(?=[([{])/gu, (_, before) => before + ' ', 'Пробіл перед відкривною дужкою.');
      replace(/([([{])[ \t]+/gu, (_, bracket) => bracket, 'Після відкривної дужки пробіл не ставимо.');
      replace(new RegExp(`([\\p{L}\\p{M}\\p{N}])(${SMILE})`, 'gu'), (_, before, smile) => before + ' ' + smile, 'Пробіл між словом і смайликом.');
      replace(new RegExp(`(${SMILE})([\\p{L}\\p{N}])`, 'gu'), (_, smile, after) => smile + ' ' + after, 'Пробіл між смайликом і словом.');
      return { text, changes };
    }

    function analyze(input, options = {}, personalWords = [], sharedData = {}) {
      const settings = { ...DEFAULTS, ...options };
      const formatted = settings.typography ? typography(input) : { text: input, changes: [] };
      const sharedGenitive = Array.isArray(sharedData.genitive) ? sharedData.genitive : [];
      const sharedAbbreviations = new Set((Array.isArray(sharedData.abbreviations) ? sharedData.abbreviations : []).map(value => norm(value).toLocaleLowerCase('uk')));
      const edited = engine.edit(formatted.text, { ...settings, genitiveOverrides: sharedGenitive, known: word => spell.correct(word) });
      // Map earlier typography edits through later word-level replacements so their
      // coordinates refer to the final text shown in the result pane.
      let precedingDelta = 0;
      const laterEdits = edited.changes.map(change => {
        const start = change.start - precedingDelta;
        const end = start + change.from.length;
        precedingDelta += change.to.length - change.from.length;
        return { start, end, to: change.to };
      });
      for (const change of formatted.changes) {
        let delta = 0;
        for (const edit of laterEdits) {
          if (change.start >= edit.end) { delta += edit.to.length - (edit.end - edit.start); continue; }
          if (change.end <= edit.start) break;
          change.start = edit.start + delta;
          change.end = edit.start + delta + edit.to.length;
          delta = null;
          break;
        }
        if (delta !== null) { change.start += delta; change.end += delta; }
      }
      const text = edited.text;
      const words = engine.tokenize(text);
      const ranges = engine.protectedRanges(text);
      const personal = new Set(personalWords.map(w => norm(w).toLocaleLowerCase('uk')));
      const personalRanges = [...text.matchAll(/[\p{L}\p{M}]+(?:['’ʼ-][\p{L}\p{M}]+)*/gu)]
        .filter(m => personal.has(norm(m[0]).toLocaleLowerCase('uk')))
        .map(m => ({ start: m.index, end: m.index + m[0].length }));
      const issues = [];
      function issue(start, end, type, message, replacements = [], extra = {}) {
        if (ranges.some(r => start < r.end && Math.max(end, start + 1) > r.start)) return;
        const from = text.slice(start, end);
        const choices = [...new Set(replacements)].filter(value => value !== from);
        if (issues.some(i => i.start === start && i.end === end && i.type === type && i.message === message)) return;
        issues.push({ start, end, from, type, message, replacements: choices, ...extra });
      }
      function matches(pattern, handle) { for (const match of text.matchAll(pattern)) handle(match); }
      const contiguous = (left, right) => /^[ \t]+$/u.test(text.slice(left.end, right.start));

      for (const item of edited.reviews) issue(item.start, item.end, 'rvn', item.message, item.replacements);
      words.forEach((word, index) => {
        if (word.protected || !UK.test(word.value)) return;
        if (settings.ending && engine.genitiveForm(word.lower, sharedGenitive)) {
          const context = engine.genitiveContext(words, index, text);
          if (context.kind === 'ambiguous') issue(word.start, word.end, 'case', context.reason, [engine.caseLike(word.value, engine.genitiveForm(word.lower, sharedGenitive))]);
        }
        const personalWord = personalRanges.some(r => word.start >= r.start && word.end <= r.end);
        if (settings.spelling && !personalWord && /[a-z]/iu.test(word.value)) {
          const alphabet = { a: 'а', c: 'с', e: 'е', i: 'і', o: 'о', p: 'р', x: 'х', y: 'у', A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х' };
          const repaired = [...word.value].map(c => alphabet[c] || c).join('');
          issue(word.start, word.end, 'spelling', 'У слові змішані латинські та кириличні літери.', accepted(repaired, personal, sharedGenitive) ? [repaired] : [], { word: word.value });
        } else if (settings.spelling && !personalWord && !accepted(word.value, personal, sharedGenitive) && !(text[word.end] === '.' && (engine.acceptedAbbreviation(word.value + '.') || sharedAbbreviations.has(norm(word.value + '.').toLocaleLowerCase('uk'))))) {
          issue(word.start, word.end, 'spelling', 'Слово не знайдено в українському словнику та винятках РВН. Перевірте написання; власну назву можна додати до особистого словника.', [], { word: word.value });
        }
        const prev = words[index - 1];
        if (settings.grammar && prev && !prev.protected && prev.lower === word.lower && contiguous(prev, word)) {
          issue(prev.start, word.end, 'grammar', 'Можливий випадковий повтор слова. Якщо це навмисне підсилення, залиште його.', [prev.value]);
        }
      });

      if (settings.punctuation) {
        // A comma is suggested, never silently inserted at a conjectured clause boundary.
        matches(/(^|[.!?]\s+)(На жаль|На щастя|Без сумніву|Безперечно|По-перше|По-друге|Отже|Будь ласка)([ \t]+)(?=[А-Яа-яІіЇїЄєҐґ])/gimu, m => {
          const start = m.index + m[1].length;
          issue(start, start + m[2].length, 'punctuation', 'Ймовірний вставний вислів: відокремте його комою, якщо він не є членом речення.', [m[2] + ',']);
        });
        // Звертання без наказового способу після нього: «Шановні колеги прошу…», «Друже маємо…».
        matches(/(^|[.!?]\s+)((?:Шановні|Дорогі|Любі)\s+(?:колеги|друзі|учасники|учасниці|партнери|волонтери|читачі|підписники)|Друже|Командо)([ \t]+)(?=[А-Яа-яІіЇїЄєҐґ])/gimu, m => {
          const start = m.index + m[1].length;
          issue(start, start + m[2].length, 'punctuation', 'Ймовірне звертання: відокремте його комами.', [m[2] + ',']);
        });
        // Будь-яке ім'я чи звертання перед наказовим способом або після привітання: «Тарасе, зроби», «Дякую, Олено».
        rules.addresses({ text, words, issue, joined: contiguous });
        const subordinators = new Set(['що', 'щоб', 'якщо', 'коли', 'хоча', 'оскільки', 'бо', 'якби', 'доки']);
        const contrasts = new Set(['але', 'проте', 'однак']);
        words.forEach((word, index) => {
          if (word.protected || index === 0 || index === words.length - 1) return;
          const previous = words[index - 1];
          if (!contiguous(previous, word) || previous.protected) return;
          const clause = text.slice(Math.max(0, word.start - 180), word.start).split(/[.!?;\n]/u).at(-1);
          if (!/[а-яіїєґ]/iu.test(clause)) return;
          // Підрядне речення після дієслова знання («бачив, як»), відносне після іменника («місто, в якому»).
          const clauseStart = rules.clauseStart(words, index, contiguous);
          if (subordinators.has(word.lower) || contrasts.has(word.lower) || clauseStart > -1) {
            if (['і', 'й', 'та', 'або', 'ні', 'не', 'лише', 'тільки', 'саме', 'будь'].includes(previous.lower)) return;
            let boundary = clauseStart > -1 ? words[clauseStart].start : word.start;
            // Keep compound conjunctions together: comma before the whole group.
            const compound = clause.match(/(?:тому|через те|для того|попри те|незважаючи на те|після того|перед тим)\s+$/iu);
            if (compound && ['що', 'щоб', 'як'].includes(word.lower)) boundary = word.start - compound[0].length;
            let position = boundary;
            while (position > 0 && /[ \t]/u.test(text[position - 1])) position--;
            if (position === 0 || /[,;:.!?—–\n]/u.test(text[position - 1])) return;
            issue(position, boundary, 'punctuation', 'Можлива межа частин речення. Перевірте, чи потрібна кома перед сполучником.', [', ']);
          }
        });
        matches(/(^|[.!?]\s+)([а-яіїєґ][а-яіїєґ’']*)/gu, m => {
          if (m[1] && /(?:\b|[\s(])(?:р|с|ст|ім|вул|м|тис|п|т|ін)\.\s+$/iu.test(text.slice(Math.max(0, m.index - 10), m.index + m[1].length))) return;
          const start = m.index + m[1].length;
          issue(start, start + m[2].length, 'punctuation', 'Можливий початок речення: перевірте велику літеру.', [m[2][0].toLocaleUpperCase('uk') + m[2].slice(1)]);
        });
        const stack = [], pairs = { ')': '(', ']': '[', '}': '{', '»': '«' };
        for (let i = 0; i < text.length; i++) {
          const protectedRange = ranges.find(r => i >= r.start && i < r.end);
          if (protectedRange) { i = protectedRange.end - 1; continue; }
          const c = text[i];
          if ('([{«'.includes(c)) stack.push({ c, i });
          else if (pairs[c]) {
            if (stack.at(-1)?.c === pairs[c]) stack.pop();
            else issue(i, i + 1, 'punctuation', 'Закривальна дужка або лапка не має відповідного відкривального знака.');
          }
        }
        for (const item of stack) issue(item.i, item.i + 1, 'punctuation', 'Відкривальна дужка або лапка не має відповідного закривального знака.');
      }

      if (settings.numerals) numerals.check(text, ranges, (start, end, reason, replacements) =>
        issue(start, end, 'number', reason, replacements.map(value => engine.caseLike(text.slice(start, end), value))), spell);

      if (settings.grammar) {
        const phrases = [
          [/згідно (?:до |з )?(наказу|статуту|рішення|договору)/giu, m => 'згідно з ' + ({ наказу: 'наказом', статуту: 'статутом', рішення: 'рішенням', договору: 'договором' }[m[1].toLowerCase()]), '«Згідно з» вимагає орудного відмінка.'],
          [/відповідно (?:з|із) (наказом|статутом|рішенням|договором)/giu, m => 'відповідно до ' + ({ наказом: 'наказу', статутом: 'статуту', рішенням: 'рішення', договором: 'договору' }[m[1].toLowerCase()]), '«Відповідно до» вимагає родового відмінка.'],
          [/на протязі (року|місяця|тижня|дня|години)/giu, m => 'протягом ' + m[1], 'Для проміжку часу вживають «протягом» або «упродовж».'],
          [/будьласка/giu, () => 'будь ласка', '«Будь ласка» пишемо окремо.'],
          [/нажаль/giu, () => 'на жаль', '«На жаль» пишемо окремо.']
        ];
        for (const [pattern, replace, reason] of phrases) matches(pattern, m => {
          if (m.index > 0 && /\p{L}/u.test(text[m.index - 1]) || /\p{L}/u.test(text[m.index + m[0].length] || '')) return;
          issue(m.index, m.index + m[0].length, 'grammar', reason, [engine.caseLike(m[0], replace(m))]);
        });
        // Узгодження займенника з дієсловом і прикметника з іменником, кальки в усіх формах (за словником).
        rules.grammar({ text, words, issue, joined: contiguous });
      }
      issues.sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
      return { text, changes: [...formatted.changes, ...edited.changes], issues: issues.map((item, i) => ({ ...item, id: i })), dictionaryReady: true };
    }

    function suggestions(word, options = {}) {
      const key = norm(word);
      if (!suggestionCache.has(key)) {
        suggestionCache.set(key, spell.suggest(key).slice(0, 12));
        if (suggestionCache.size > 500) suggestionCache.delete(suggestionCache.keys().next().value);
      }
      return [...new Set(suggestionCache.get(key).map(w => engine.edit(w, { ...options, ending: false, euphony: false }).text))].filter(w => w !== word).slice(0, 6);
    }
    return { analyze, suggestions };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RVNProofreader = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
