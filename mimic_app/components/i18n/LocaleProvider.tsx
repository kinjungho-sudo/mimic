'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type AppLocale,
  DEFAULT_LOCALE,
  ENGLISH_UI_TRANSLATIONS,
  LOCALE_STORAGE_KEY,
  normalizeUiText,
  translateUiText,
} from '@/lib/i18n/ui-translations';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (korean: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const TRANSLATABLE_ATTRIBUTES = ['alt', 'aria-label', 'placeholder', 'title'];

function shouldIgnore(element: Element | null): boolean {
  return Boolean(element?.closest(
    '[data-i18n-ignore], [translate="no"], [contenteditable="true"], .bn-editor, script, style',
  ));
}

function translateTextNode(node: Text, locale: AppLocale) {
  if (shouldIgnore(node.parentElement)) return;
  const saved = originalText.get(node);
  const renderedSaved = saved ? translateUiText(saved, locale) : null;
  if (
    /[가-힣]/.test(node.data)
    && (!saved || (node.data !== saved && node.data !== renderedSaved))
  ) {
    originalText.set(node, node.data);
  }
  const original = originalText.get(node);
  if (original) {
    const translated = translateUiText(original, locale);
    if (node.data !== translated) node.data = translated;
  }
}

function translateAttributes(element: Element, locale: AppLocale) {
  if (shouldIgnore(element)) return;
  let originals = originalAttributes.get(element);

  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    if (!originals && /[가-힣]/.test(current)) {
      originals = new Map();
      originalAttributes.set(element, originals);
    }
    if (originals && !originals.has(attribute) && /[가-힣]/.test(current)) {
      originals.set(attribute, current);
    }
    const source = originals?.get(attribute);
    if (source) {
      const translated = translateUiText(source, locale);
      if (current !== translated) element.setAttribute(attribute, translated);
    }
  }
}

function translateTree(root: Node, locale: AppLocale) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

  if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root as Element, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text, locale);
    else translateAttributes(current as Element, locale);
    current = walker.nextNode();
  }
}

function preferredLocale(): AppLocale {
  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved === 'ko' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(preferredLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    translateTree(document.body, locale);
    translateTree(document.head, locale);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => translateTree(node, locale));
        if (mutation.type === 'characterData') translateTree(mutation.target, locale);
        if (mutation.type === 'attributes') translateTree(mutation.target, locale);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
    });
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [locale]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
  }, []);
  const t = useCallback((korean: string) => translateUiText(korean, locale), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
      <div
        data-i18n-ignore
        className="parro-language-switcher"
        role="group"
        aria-label={locale === 'ko' ? '언어 선택' : 'Choose language'}
      >
        <button
          type="button"
          aria-pressed={locale === 'ko'}
          onClick={() => setLocale('ko')}
        >
          한국어
        </button>
        <span aria-hidden="true">/</span>
        <button
          type="button"
          aria-pressed={locale === 'en'}
          onClick={() => setLocale('en')}
        >
          English
        </button>
      </div>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
}

export function isKnownUiTranslation(value: string): boolean {
  return Boolean(ENGLISH_UI_TRANSLATIONS[normalizeUiText(value)]);
}
