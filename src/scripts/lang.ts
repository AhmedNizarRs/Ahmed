type Lang = 'en' | 'ar';
type Dictionary = Record<Lang, Record<string, string>>;

const pathFor = (lang: Lang) => (lang === 'ar' ? '/ar/' : '/');

function remember(lang: Lang) {
  try {
    localStorage.setItem('rimal-lang', lang);
  } catch {
    /* storage unavailable: the choice just isn't remembered */
  }
}

// Swaps every translated string on the page in place, flips the reading
// direction, and moves the address to the matching language URL. Without
// JavaScript the switch is a plain link to the other language's page.
function apply(lang: Lang, dict: Dictionary) {
  const strings = dict[lang];
  const other: Lang = lang === 'en' ? 'ar' : 'en';
  const root = document.documentElement;

  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = strings['meta.title'];
  document.querySelector('meta[name="description"]')?.setAttribute('content', strings['meta.description']);

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const value = strings[el.dataset.i18n!];
    if (value !== undefined) el.textContent = value;
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr!.split(';')) {
      const [attr, key] = pair.split(':');
      const value = strings[key];
      if (value !== undefined) el.setAttribute(attr, value);
    }
  });

  document.querySelectorAll<HTMLAnchorElement>('[data-lang-switch]').forEach((a) => {
    a.href = pathFor(other);
    a.hreflang = other;
    a.lang = other;
  });

  history.replaceState(history.state, '', pathFor(lang) + location.hash);
}

export function initLanguageSwitch() {
  const source = document.getElementById('i18n');
  if (!source?.textContent) return;
  const dict = JSON.parse(source.textContent) as Dictionary;

  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-lang-switch]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();

    const next: Lang = document.documentElement.lang === 'ar' ? 'en' : 'ar';
    remember(next);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduce) {
      document.startViewTransition(() => apply(next, dict));
    } else {
      apply(next, dict);
    }
    // Keep keyboard focus on the switch that was used.
    link.focus({ preventScroll: true });
  });

  // Picking a sample on the board highlights its library entry, even when
  // the same sample is picked twice in a row.
  document.querySelectorAll<HTMLAnchorElement>('[data-pick]').forEach((a) => {
    a.addEventListener('click', () => {
      const entry = document.getElementById(`p-${a.dataset.pick}`);
      if (!entry) return;
      entry.classList.remove('picked');
      void entry.offsetWidth;
      entry.classList.add('picked');
    });
  });
}
