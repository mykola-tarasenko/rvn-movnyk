'use strict';
const $ = selector => document.querySelector(selector);
const source = $('#source'), resultCard = $('#result-card'), result = $('#result');
const summary = $('#summary'), changeLog = $('#change-log'), status = $('#dictionary-status');
const editButton = $('#edit-btn'), toast = $('#toast'), reviewList = $('#review-list');
let worker, ready = false, databaseReady = false, databaseMode = false, shared = { genitive: [] }, processing = false, sequence = 0, revision = 0, current = null, journal = [], history = [], ignored = new Set(), visibleCount = 40;
const pending = new Map();
let personal = [];

function plural(n, one, few, many) { const x = n % 100; return x > 10 && x < 15 ? many : n % 10 === 1 ? one : n % 10 > 1 && n % 10 < 5 ? few : many; }
function options() { return Object.fromEntries([...document.querySelectorAll('[data-rule]')].map(input => [input.dataset.rule, input.checked])); }
function showToast(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 4000); }
function updateCount() { $('#input-count').textContent = `${source.value.length} ${plural(source.value.length, 'символ', 'символи', 'символів')}`; }
function setBusy(busy) { processing = busy; editButton.disabled = !ready || !databaseReady || busy; editButton.textContent = busy ? 'Перевіряємо…' : '✦ Перевірити й виправити'; $('#result-card').setAttribute('aria-busy', String(busy)); document.querySelectorAll('#review-list button').forEach(button => { button.disabled = busy; }); }
function request(type, payload) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, options: options(), personal, shared, ...payload });
  });
}
function workerFailure(message) {
  ready = false; setBusy(false);
  status.textContent = 'Словник недоступний. Перевірка не виконана. ' + message;
  status.classList.add('error'); $('#retry-worker').hidden = false;
  for (const task of pending.values()) task.reject(new Error(message));
  pending.clear();
}
function startWorker() {
  worker?.terminate(); ready = false; setBusy(false); $('#retry-worker').hidden = true;
  status.classList.remove('error'); status.textContent = 'Завантажуємо український словник… Перше відкриття може тривати 10–20 секунд.';
  try {
    if (!window.RVN_WORKER_SOURCE) throw new Error('Не знайдено proofreading-worker.js. Перевірте файли проєкту.');
    const url = URL.createObjectURL(new Blob([window.RVN_WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(url); URL.revokeObjectURL(url);
    worker.onmessage = event => {
      const message = event.data;
      if (message.type === 'ready') {
        ready = true; setBusy(false);
        status.textContent = databaseMode
          ? 'Словник готовий · 334 979 статей і словоформи · текст перевіряється на цьому комп’ютері · винятки в SQLite'
          : 'Словник готовий · 334 979 статей і словоформи · текст та особистий словник залишаються у цьому браузері';
      } else if (message.type === 'init-error') workerFailure(message.error);
      else {
        const task = pending.get(message.id);
        if (!task) return;
        pending.delete(message.id);
        message.error ? task.reject(new Error(message.error)) : task.resolve(message.result);
      }
    };
    worker.onerror = () => workerFailure('Перезавантажте словник кнопкою нижче.');
  } catch (error) { workerFailure(error.message); }
}
function issueKey(item) { return [item.type, item.from, item.message, current.text.slice(Math.max(0, item.start - 20), item.start), current.text.slice(item.end, item.end + 20)].join('|'); }
function activeIssues() { return current ? current.issues.filter(item => !ignored.has(issueKey(item))) : []; }
const names = { spelling: 'Написання', punctuation: 'Пунктуація', grammar: 'Граматика', case: 'Відмінок', number: 'Числівники' };
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function action(label, callback, className = 'outline compact') { const button = element('button', className, label); button.type = 'button'; button.addEventListener('click', callback); return button; }

function renderResult() {
  result.replaceChildren(); changeLog.replaceChildren();
  if (!current) return;
  const issues = activeIssues();
  const annotations = [
    ...issues.map(item => ({ start: item.start, end: item.end, item, kind: 'issue' })),
    ...journal.map((item, index) => ({ start: item.start, end: item.end, item, kind: 'change', index }))
      .filter(entry => Number.isInteger(entry.start) && Number.isInteger(entry.end) && entry.start >= 0 && entry.end > entry.start && entry.end <= current.text.length)
  ].sort((a, b) => a.start - b.start || (a.kind === 'change' ? -1 : 1));
  let cursor = 0;
  for (const annotation of annotations) {
    const { item } = annotation;
    if (item.start < cursor) continue;
    result.append(document.createTextNode(current.text.slice(cursor, item.start)));
    const mark = element('mark', annotation.kind === 'issue' ? 'issue-mark ' + item.type : 'auto-mark', current.text.slice(item.start, item.end));
    mark.tabIndex = 0;
    if (annotation.kind === 'issue') {
      mark.title = names[item.type] + ': ' + item.message;
      mark.setAttribute('aria-label', mark.title);
      const reveal = () => { $('#issue-filter').value = 'all'; visibleCount = Math.max(visibleCount, issues.indexOf(item) + 1); renderReview(); document.getElementById('issue-' + item.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      mark.addEventListener('click', reveal);
    } else {
      mark.id = 'auto-change-' + annotation.index;
      mark.title = item.rule || 'Автоматичне виправлення';
      mark.addEventListener('click', () => document.getElementById('change-log-' + annotation.index)?.focus());
    }
    mark.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); mark.click(); } });
    result.append(mark); cursor = item.end;
  }
  result.append(document.createTextNode(current.text.slice(cursor)));
  if (!current.text) result.textContent = 'Введіть текст для перевірки.';
  for (const [index, change] of journal.entries()) {
    const before = Number.isInteger(change.start) ? current.text.slice(0, change.start) : '';
    const line = (before.match(/\n/g) || []).length + 1;
    const column = [...before.slice(before.lastIndexOf('\n') + 1)].length + 1;
    const item = action(`Рядок ${line}, стовпець ${column}: ${change.from} → ${change.to}`, () => document.getElementById('auto-change-' + index)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 'change-entry');
    item.id = 'change-log-' + index; item.title = change.rule || 'Автоматичне виправлення';
    changeLog.append(item);
  }
  summary.textContent = `${journal.length} ${plural(journal.length, 'зміну', 'зміни', 'змін')} застосовано · ${issues.length} ${plural(issues.length, 'підказка', 'підказки', 'підказок')} до перегляду`;
  $('#undo-btn').disabled = history.length === 0;
  $('#copy-btn').disabled = !current.text;
  $('#replace-btn').disabled = !current.text;
  renderReview();
}
function renderReview() {
  reviewList.replaceChildren();
  const all = activeIssues(); const filter = $('#issue-filter').value;
  const filtered = all.filter(item => filter === 'all' || item.type === filter);
  $('#review-count').textContent = `${all.length} до перегляду`;
  $('#review-empty').hidden = filtered.length > 0;
  $('#review-empty').textContent = all.length ? 'У цій категорії підказок немає.' : 'Додаткових підказок за доступними правилами не знайдено. Це не гарантує відсутности всіх помилок.';
  for (const item of filtered.slice(0, visibleCount)) {
    const card = element('article', 'review-item'); card.id = 'issue-' + item.id;
    card.append(element('span', 'review-badge ' + item.type, names[item.type]));
    const excerpt = element('p', 'review-excerpt');
    excerpt.append(current.text.slice(Math.max(0, item.start - 35), item.start), element('strong', '', item.from || 'місце вставлення'), current.text.slice(item.end, item.end + 35));
    card.append(excerpt, element('p', 'review-reason', item.message));
    const controls = element('div', 'review-actions');
    for (const replacement of item.replacements) controls.append(action('Замінити на «' + replacement + '»', () => acceptIssue(item, replacement)));
    if (item.type === 'spelling' && !item.loaded) {
      const suggest = action('Показати варіянти', async () => {
        const epoch = revision; suggest.disabled = true; suggest.textContent = 'Шукаємо…';
        try {
          const replacements = await request('suggest', { word: item.word });
          if (epoch !== revision) return;
          item.replacements = [...new Set([...item.replacements, ...replacements])]; item.loaded = true; renderReview();
        } catch (error) { showToast(error.message); suggest.disabled = false; suggest.textContent = 'Показати варіянти'; }
      });
      controls.append(suggest);
    }
    if (item.type === 'spelling') controls.append(action('Додати до словника', () => addPersonal(item.word)));
    if (!item.replacements.length && (item.loaded || item.type !== 'spelling')) controls.append(element('span', 'manual-note', 'Виправте вручну у вихідному тексті або залиште без змін.'));
    controls.append(action('Залишити', () => { ignored.add(issueKey(item)); renderResult(); }, 'clear'));
    card.append(controls); reviewList.append(card);
  }
  $('#more-issues').hidden = filtered.length <= visibleCount;
  $('#more-issues').textContent = `Показати ще (${Math.max(0, filtered.length - visibleCount)})`;
}
async function analyzeText(text, reset = false) {
  const epoch = ++revision; setBusy(true);
  try {
    const edited = await request('analyze', { text });
    if (epoch !== revision) return false;
    if (reset) { journal = []; ignored.clear(); history = []; visibleCount = 40; }
    current = edited; journal.push(...edited.changes);
    renderResult(); resultCard.hidden = false; return true;
  } catch (error) { if (epoch === revision) showToast('Перевірку не завершено: ' + error.message); return false; }
  finally { if (epoch === revision) setBusy(false); }
}
async function acceptIssue(item, replacement) {
  if (processing || !current || current.text.slice(item.start, item.end) !== item.from) return;
  const snapshot = { current, journal: journal.map(change => ({ ...change })), ignored: new Set(ignored) };
  const previousJournalCount = journal.length;
  const changed = current.text.slice(0, item.start) + replacement + current.text.slice(item.end);
  // Save a snapshot only when the recheck succeeds; stale offsets are never reused.
  const success = await analyzeText(changed);
  if (success) {
    const delta = replacement.length - (item.end - item.start);
    for (let index = 0; index < previousJournalCount; index++) {
      if (journal[index].start >= item.end) { journal[index].start += delta; journal[index].end += delta; }
    }
    history.push(snapshot); if (history.length > 50) history.shift();
    journal.push({ from: item.from, to: replacement, rule: item.message, start: item.start, end: item.start + replacement.length }); renderResult();
  }
}
async function databaseRequest(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Помилка бази (${response.status}).`);
  return data;
}
async function addPersonal(word) {
  const words = [...new Set((word || '').split(/[\n,;]+/u).map(value => value.trim()).filter(Boolean))];
  if (!words.length || words.length > 500 || words.some(value => !/^[\p{L}\p{M}]+(?:['’ʼ-][\p{L}\p{M}]+)*$/u.test(value))) {
    showToast('Введіть слова без пробілів у назві; розділяйте їх комами або новими рядками (до 500 за раз).'); return false;
  }
  if (databaseMode) {
    try {
      const data = await databaseRequest('/api/exceptions', { method: 'POST', body: JSON.stringify({ words }) });
      personal = data.words; renderPersonal();
      showToast(data.added ? `До бази додано слів: ${data.added}.` : 'Ці винятки вже є в базі.');
    } catch (error) { showToast('Не вдалося зберегти виняток: ' + error.message); return false; }
  } else {
    const previous = new Set(personal.map(value => value.toLocaleLowerCase('uk')));
    personal = [...new Set([...personal, ...words])];
    try { localStorage.setItem('rvn-personal-words-v1', JSON.stringify(personal)); }
    catch { showToast('Слова враховано до кінця цього сеансу, але браузер не дозволив зберегти їх.'); }
    renderPersonal();
    const added = words.filter(value => !previous.has(value.toLocaleLowerCase('uk'))).length;
    if (added) showToast(`До особистого словника додано слів: ${added}.`);
    else showToast('Ці слова вже є в особистому словнику.');
  }
  if (current) await analyzeText(current.text);
  return true;
}
function renderPersonal() {
  const list = $('#personal-list'); list.replaceChildren(); $('#personal-count').textContent = personal.length;
  for (const word of personal) list.append(action(word + ' ×', async () => {
    if (databaseMode) {
      try {
        const data = await databaseRequest('/api/exceptions/' + encodeURIComponent(word), { method: 'DELETE' });
        personal = data.words;
      } catch (error) { showToast('Не вдалося видалити виняток: ' + error.message); return; }
    } else {
      personal = personal.filter(value => value !== word);
      try { localStorage.setItem('rvn-personal-words-v1', JSON.stringify(personal)); }
      catch { showToast('Слово вилучено до кінця цього сеансу; браузер не дозволив зберегти зміни.'); }
    }
    renderPersonal();
    if (current) await analyzeText(current.text);
  }, 'word-chip'));
}
async function connectDatabase() {
  databaseReady = false; ready = false; setBusy(false);
  $('#retry-db').hidden = true;
  status.classList.remove('error');
  if (location.protocol === 'file:') {
    databaseMode = false; shared = { genitive: [], abbreviations: [] };
    try {
      const saved = JSON.parse(localStorage.getItem('rvn-personal-words-v1') || '[]');
      personal = Array.isArray(saved) ? saved.filter(word => typeof word === 'string' && word.length < 100) : [];
    } catch { personal = []; }
    $('#exceptions-title').textContent = 'Особистий словник';
    $('#exceptions-description').textContent = 'Винятки зберігаються лише у сховищі цього браузера. Щоб ділитися ними між браузерами, запустіть необов’язкову SQLite-версію сервера.';
    status.textContent = 'Працюємо локально: з’єднання із сервером не потрібне.';
    renderPersonal(); databaseReady = true; startWorker(); return;
  }
  status.textContent = 'Під’єднуємо базу винятків…';
  try {
    const data = await databaseRequest('/api/exceptions');
    databaseMode = true; personal = data.words; shared = { genitive: data.genitive, abbreviations: data.abbreviations };
    $('#exceptions-title').textContent = 'Додані слова до бази';
    $('#exceptions-description').textContent = 'Додані тут слова зберігаються у файлі SQLite на сервері редактора, тож доступні кожному, хто ним користується. Можна додати одне слово або вставити список, розділений комами чи новими рядками.';
    renderPersonal(); databaseReady = true; startWorker();
  } catch {
    databaseMode = false;
    try {
      const saved = JSON.parse(localStorage.getItem('rvn-personal-words-v1') || '[]');
      personal = Array.isArray(saved) ? saved.filter(word => typeof word === 'string' && word.length < 100) : [];
    } catch { personal = []; }
    $('#exceptions-title').textContent = 'Особистий словник';
    $('#exceptions-description').textContent = 'Винятки зберігаються лише у сховищі цього браузера.';
    renderPersonal(); databaseReady = true;
    status.textContent = 'SQLite не під’єднано; користуємося особистим словником у браузері.';
    status.classList.remove('error'); $('#retry-db').hidden = true;
    startWorker();
  }
}
function invalidate() {
  revision++; resultCard.hidden = true; current = null; journal = []; history = []; ignored.clear(); setBusy(false);
}
source.addEventListener('input', () => { updateCount(); invalidate(); });
document.querySelectorAll('[data-rule]').forEach(input => input.addEventListener('change', () => {
  if (input.dataset.rule === 'euphony') $('#euphony').checked = input.checked;
  invalidate();
}));
$('#euphony').addEventListener('change', event => { $('[data-rule="euphony"]').checked = event.target.checked; invalidate(); });
editButton.addEventListener('click', async () => { if (await analyzeText(source.value, true)) resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('#clear-btn').addEventListener('click', () => { source.value = ''; updateCount(); invalidate(); source.focus(); });
$('#sample-btn').addEventListener('click', () => {
  source.value = 'Іншого спеціального агента запросили до аудиторії. Рівень відповідальності й почуття власної гідності зростають. Без щирої любові й радості не було можливості працювати. На жаль команда знає що в текcті є помилкка. Новий книга лежить поруч. Ми працює згідно наказу. Вона була у Львові ,а з школи повернулася пізно.';
  updateCount(); invalidate(); source.focus();
});
$('#undo-btn').addEventListener('click', () => { const old = history.pop(); if (!old) return; revision++; current = old.current; journal = old.journal; ignored = old.ignored; setBusy(false); renderResult(); });
$('#copy-btn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(current.text); showToast('Результат скопійовано'); }
  catch { const range = document.createRange(); range.selectNodeContents(result); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); showToast('Текст виділено. Натисніть Ctrl+C, щоб скопіювати.'); }
});
$('#replace-btn').addEventListener('click', () => { source.value = current.text; updateCount(); invalidate(); source.focus(); showToast('Виправлений текст перенесено до редактора'); });
$('#issue-filter').addEventListener('change', () => { visibleCount = 40; renderReview(); });
$('#more-issues').addEventListener('click', () => { visibleCount += 40; renderReview(); });
$('#personal-form').addEventListener('submit', async event => { event.preventDefault(); if (await addPersonal($('#personal-word').value)) $('#personal-word').value = ''; });
$('#retry-worker').addEventListener('click', startWorker);
$('#retry-db').addEventListener('click', connectDatabase);
updateCount(); connectDatabase();
