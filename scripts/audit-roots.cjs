// Аудит коренів РВН за повним словником: які слова змінюються, які лише пропонуються, які пропущено.
// Запуск: node scripts/audit-roots.cjs [корінь ...] [--all]. Без --all автоматичні зміни показано лише кількістю.
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../engine.js');
const project = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const only = args.filter(arg => !arg.startsWith('--')).map(arg => arg.toLocaleLowerCase('uk'));
const dic = fs.readFileSync(path.join(project, 'vendor', 'dictionary-uk-index.dic'), 'utf8');
const lemmas = [...new Set(dic.split('\n').slice(1).map(line => line.split('/')[0].trim().toLocaleLowerCase('uk').replace(/[’ʼ]/g, "'")).filter(Boolean))];

let total = 0;
for (const rule of engine.roots()) {
  if (only.length && !only.includes(rule.from)) continue;
  const groups = { auto: [], review: [], skip: [] };
  for (const lemma of lemmas) {
    const status = rule.status(lemma);
    if (status) groups[status].push(status === 'skip' ? lemma : lemma + ' → ' + engine.rootForm(lemma).to);
  }
  total += groups.auto.length;
  console.log(`\n${rule.from} → ${rule.to} (${rule.label}): змінюється ${groups.auto.length}, на перевірку ${groups.review.length}, пропущено ${groups.skip.length}`);
  if (showAll && groups.auto.length) console.log('  змінюється: ' + groups.auto.join('; '));
  if (groups.review.length) console.log('  на перевірку: ' + groups.review.join('; '));
  if (groups.skip.length) console.log('  пропущено: ' + groups.skip.join(', '));
}
console.log(`\nСловникових статей: ${lemmas.length}; автоматичних змін за коренями: ${total}.`);
