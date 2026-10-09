/* nspell без попереднього розгортання словоформ. nspell під час завантаження утворює всі 3,4 млн форм
   (~10 с); тут словник лише читається, а форму розпізнаємо під час перевірки: відкидаємо суфікс із .aff
   і шукаємо основу з відповідним прапорцем. Результати correct() і suggest() ті самі, що в nspell. */
'use strict';
const nspell = require('nspell');

const NO_RULES = [];

function createSpell(aff, dic) {
  const spell = nspell(aff);
  const flags = spell.flags;
  const codesOf = value => !value ? NO_RULES : flags.FLAG === 'long' ? value.match(/..?/gu) : value.split(flags.FLAG === 'num' ? ',' : '');
  if (spell.compoundRules.length) throw new Error('Складені слова (COMPOUNDRULE) не підтримано.');

  // Суфікси за рядком, який вони додають: «ами» → [{ flag, strip, entry }].
  const suffixes = new Map();
  let longest = 0;
  for (const [flag, rule] of Object.entries(spell.rules)) {
    if (rule.type !== 'SFX') throw new Error('Префікси (PFX) не підтримано.');
    for (const entry of rule.entries) {
      if (entry.continuation.length) throw new Error('Вкладені афікси не підтримано.');
      const strip = entry.remove ? entry.remove.source.slice(0, -1) : '';
      if (!suffixes.has(entry.add)) suffixes.set(entry.add, []);
      suffixes.get(entry.add).push({ flag, strip, entry });
      longest = Math.max(longest, entry.add.length);
    }
  }

  // Основи словника з прапорцями (повторені рядки об’єднуємо, як nspell).
  const stems = new Map();
  const text = typeof dic === 'string' ? dic : dic.toString('utf8');
  for (const raw of text.slice(text.indexOf('\n') + 1).split('\n')) {
    if (raw.charCodeAt(0) === 9) continue;
    const line = raw.replace(/\\\//g, '\u0000');
    const hash = line.indexOf('#'), slash = line.indexOf('/');
    let word = line, codes = '';
    // Як у nspell: після «#» прапорці закінчуються на пробілі, без «#» — до кінця рядка.
    if (slash > -1 && (hash < 0 || slash < hash)) { word = line.slice(0, slash); codes = hash > -1 ? line.slice(slash + 1).split(/\s/u)[0] : line.slice(slash + 1); }
    else if (hash > -1) word = line.slice(0, hash);
    word = word.trim().replace(/\u0000/g, '/');
    if (!word) continue;
    const parsed = codesOf(codes.trim());
    stems.set(word, stems.has(word) ? stems.get(word).concat(parsed) : parsed.concat());
  }
  const needAffix = flags.NEEDAFFIX;

  function produces(base, { flag, entry }, word) {
    const codes = stems.get(base);
    if (!codes || !codes.includes(flag) || (entry.match && !entry.match.test(base))) return false;
    return (entry.remove ? base.replace(entry.remove, '') : base) + entry.add === word;
  }
  function lookup(word) {
    if (typeof word !== 'string') return undefined;
    const own = stems.get(word);
    if (own && !(needAffix && own.includes(needAffix))) return own;
    for (let size = Math.min(longest, word.length); size >= 0; size--) {
      const candidates = suffixes.get(word.slice(word.length - size));
      if (!candidates) continue;
      const stem = word.slice(0, word.length - size);
      // Основа зі знятою частиною (strip) або, якщо умова її не гарантує, без неї — як у nspell.
      for (const suffix of candidates) if (produces(stem + suffix.strip, suffix, word) || (suffix.strip && produces(stem, suffix, word))) return NO_RULES;
    }
    return undefined;
  }
  spell.data = new Proxy(Object.create(null), {
    get: (_, word) => lookup(word),
    has: (_, word) => lookup(word) !== undefined
  });
  return spell;
}

module.exports = { createSpell };
