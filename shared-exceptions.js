/* Затверджені для всіх користувачів винятки РВН. Особистий словник браузера сюди не входить. */
(function (root) {
  'use strict';
  const nounForms = ['', 'у', 'ові', 'ом', 'і', 'е', 'и', 'ів', 'ам', 'ами', 'ах'].map(ending => 'донат' + ending);
  const adjectiveForms = ['ий', 'ого', 'ому', 'им', 'ім', 'а', 'ої', 'ій', 'ою', 'у', 'е', 'і', 'их', 'ими'].map(ending => 'приурочен' + ending);
  const adjectiveEndings = ['ий', 'ого', 'ому', 'им', 'ім', 'а', 'ої', 'ій', 'ою', 'у', 'е', 'і', 'их', 'ими'];
  const abstractForms = stem => [stem + 'ість', stem + 'істю', ...['ости', 'ості', 'остей', 'остям', 'остями', 'остях'].map(ending => stem + ending)];
  const mediaForms = ['я', 'ї', 'ю', 'єю', 'й', 'ям', 'ями', 'ях'].map(ending => 'меді' + ending);
  const directForms = ['', 'у', 'ові', 'ом', 'і', 'е'].map(ending => 'директ' + ending);
  const api = {
    genitive: [['пам\'яті', 'пам\'яти']],
    words: [
      ...nounForms, ...adjectiveForms, 'пам\'ять', 'пам\'яти',
      ...mediaForms, ...directForms,
      ...abstractForms('багатоголосн'), ...abstractForms('одеськ'),
      ...adjectiveEndings.map(ending => 'багатоголосн' + ending),
      ...adjectiveEndings.map(ending => 'одеськ' + ending),
      'давним-давно', 'давним', 'Коцюбіїв', 'сториз', 'тґ'
    ],
    abbreviations: ['ім.']
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RVNSharedExceptions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
