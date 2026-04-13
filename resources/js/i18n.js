/**
 * Prunex Internationalization (i18n) Engine
 * Handles language switching between German (default) and English.
 * 
 * Usage:
 *   1. Add data-i18n="key" to any element to translate its textContent
 *   2. Add data-i18n-html="key" to translate innerHTML (for content with links/spans)
 *   3. Add data-i18n-placeholder="key" for input placeholders
 *   4. Add data-i18n-label="key" for aria-labels
 *   5. Use window.i18n.t('key') in JS for programmatic translations
 *
 * The engine loads after componentsLoaded event, so shared components are translated too.
 */
(function () {
  'use strict';

  const DEFAULT_LANG = 'de';
  const STORAGE_KEY = 'prunex_lang';
  let translations = {};
  let currentLang = DEFAULT_LANG;

  function getSavedLang() {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    } catch (e) {
      return DEFAULT_LANG;
    }
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) { /* silent */ }
  }

  function getBasePath() {
    var path = window.location.pathname;
    if (path.includes('/pages/blog/')) return '../../';
    if (path.includes('/pages/')) return '../';
    return '';
  }

  async function loadTranslations(lang) {
    var basePath = getBasePath();
    var url = basePath + 'resources/i18n/' + lang + '.json';
    try {
      var response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load ' + url);
      return await response.json();
    } catch (error) {
      console.error('i18n load error:', error);
      return {};
    }
  }

  function t(key) {
    if (!key) return '';
    var parts = key.split('.');
    var value = translations;
    for (var i = 0; i < parts.length; i++) {
      if (value && typeof value === 'object' && parts[i] in value) {
        value = value[parts[i]];
      } else {
        return key; // fallback to key
      }
    }
    return typeof value === 'string' ? value : key;
  }

  function applyTranslations() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val !== key) el.textContent = val;
    });

    // HTML content (for elements with embedded tags)
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      var val = t(key);
      if (val !== key) el.innerHTML = val;
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var val = t(key);
      if (val !== key) el.placeholder = val;
    });

    // Aria-labels
    document.querySelectorAll('[data-i18n-label]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-label');
      var val = t(key);
      if (val !== key) el.setAttribute('aria-label', val);
    });

    // Update html lang attribute
    document.documentElement.lang = currentLang;

    // Update switcher button state
    updateSwitcherUI();
  }

  function updateSwitcherUI() {
    var btns = document.querySelectorAll('.lang-btn');
    btns.forEach(function (btn) {
      var lang = btn.getAttribute('data-lang');
      btn.classList.toggle('active', lang === currentLang);
    });
  }

  async function switchLanguage(lang) {
    if (lang === currentLang && Object.keys(translations).length > 0) return;
    currentLang = lang;
    saveLang(lang);
    translations = await loadTranslations(lang);
    applyTranslations();
    // Dispatch event for dynamic components (assessment, demo chat)
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: lang } }));
  }

  function initSwitcher() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.lang-btn');
      if (!btn) return;
      var lang = btn.getAttribute('data-lang');
      if (lang) switchLanguage(lang);
    });
  }

  async function init() {
    currentLang = getSavedLang();
    translations = await loadTranslations(currentLang);
    applyTranslations();
    initSwitcher();
    // Dispatch initial load event so dynamic components can initialize
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));
  }

  // Wait for components to be loaded first
  document.addEventListener('componentsLoaded', function () {
    init();
  });

  // Expose API for JS files
  window.i18n = {
    t: function (key) { return t(key); },
    switchLanguage: switchLanguage,
    getCurrentLang: function () { return currentLang; },
    onReady: function (callback) {
      if (Object.keys(translations).length > 0) {
        callback();
      } else {
        document.addEventListener('languageChanged', function handler() {
          document.removeEventListener('languageChanged', handler);
          callback();
        });
      }
    }
  };
})();
