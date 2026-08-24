(function initParroI18n(root) {
  'use strict';

  function message(key, fallback = '', substitutions) {
    const translated = chrome.i18n.getMessage(key, substitutions);
    return translated || fallback || key;
  }

  function localizeDocument(scope = document) {
    const language = chrome.i18n.getUILanguage() || 'ko';
    document.documentElement.lang = language.split('-')[0].toLowerCase();

    scope.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = message(element.dataset.i18n, element.textContent.trim());
    });
    scope.querySelectorAll('[data-i18n-html]').forEach((element) => {
      element.innerHTML = message(element.dataset.i18nHtml, element.innerHTML.trim());
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((element) => {
      element.title = message(element.dataset.i18nTitle, element.title);
    });
    scope.querySelectorAll('[data-i18n-alt]').forEach((element) => {
      element.alt = message(element.dataset.i18nAlt, element.alt);
    });
  }

  root.ParroI18n = Object.freeze({
    getUILanguage: () => chrome.i18n.getUILanguage() || 'ko',
    localizeDocument,
    t: message,
  });
})(globalThis);
