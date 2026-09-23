import { products, hasOwnLink, type Lang } from '../data/products';

// Every piece of interface text, in both languages. Keys are shared, so the
// language switch can swap the page in place without a reload.
const ui = {
  en: {
    'meta.title': 'Rimal Interiors — Revit, AutoCAD & 3ds Max tools',
    'meta.description':
      'Ready-made Revit families, AutoCAD blocks and 3ds Max scripts from Rimal Interiors, an interior design studio in Sharjah, UAE.',
    brand: 'Rimal Interiors',
    'skip': 'Skip to content',
    'nav.label': 'Main',
    'nav.library': 'Library',
    'nav.how': 'How to buy',
    'nav.contact': 'Contact',
    'lang.label': 'Change language',
    'lang.other': 'العربية',
    'hero.title': 'Ready-made tools for Revit, AutoCAD and 3ds Max',
    'hero.lede':
      'A library from Rimal Interiors, an interior design studio in Sharjah. See what each tool contains, then buy it straight from its product page.',
    'hero.cta': 'Browse the library',
    'hero.secondary': 'Watch our tutorials on Instagram',
    'board.label': 'Sample board: choose a tool to see its details',
    'board.hint': 'Tap a sample to open it',
    'library.title': 'The library',
    'library.lede': 'Three tools, each described in full before you buy.',
    'spec.software': 'Software',
    'spec.contents': 'Contents',
    'spec.size': 'Size',
    'spec.details': 'Details',
    'spec.onPage': 'On the product page',
    'art.note': 'Illustration',
    'cta.buy': 'Buy now',
    'cta.buyVia': 'Buy via Linktree',
    'cta.ask': 'Ask a question',
    'cta.newTab': '(opens in a new tab)',
    'studio.title': 'A studio you can talk to',
    'studio.body':
      'Rimal Interiors is an interior design studio based in Sharjah, UAE. We post tutorials for Revit, AutoCAD, 3ds Max and SketchUp on Instagram. If you are not sure which tool fits your work, message us before you buy.',
    'studio.followers': '3,500+ followers on Instagram',
    'studio.views': '137,000+ views on a single AutoCAD post',
    'studio.link': 'See our Instagram',
    'how.title': 'How buying works',
    'how.1.title': 'Pick a tool',
    'how.1.body': 'Read what each library contains above.',
    'how.2.title': 'Open its product page',
    'how.2.body': 'Every “Buy now” button takes you to that tool’s own page.',
    'how.3.title': 'Complete your order there',
    'how.3.body': 'Payment and download details are shown on that page.',
    'close.title': 'Not sure which one you need?',
    'close.body': 'Tell us what you are working on and we will point you to the right tool.',
    'close.cta': 'Message us on Instagram',
    'close.whatsapp': 'Message us on WhatsApp',
    'close.linktree': 'All our links on Linktree',
    'footer.place': 'Sharjah, United Arab Emirates',
    'footer.rights': 'All rights reserved.',
  },
  ar: {
    'meta.title': 'رمال للتصميم الداخلي — أدوات Revit وAutoCAD و3ds Max',
    'meta.description':
      'عائلات Revit جاهزة وبلوكات AutoCAD وسكربتات 3ds Max من رمال للتصميم الداخلي، استوديو تصميم داخلي في الشارقة، الإمارات.',
    brand: 'رمال للتصميم الداخلي',
    'skip': 'انتقل إلى المحتوى',
    'nav.label': 'القائمة الرئيسية',
    'nav.library': 'المكتبة',
    'nav.how': 'طريقة الشراء',
    'nav.contact': 'تواصل معنا',
    'lang.label': 'تغيير اللغة',
    'lang.other': 'English',
    'hero.title': 'أدوات جاهزة لبرامج Revit وAutoCAD و3ds Max',
    'hero.lede':
      'مكتبة من رمال للتصميم الداخلي، استوديو تصميم داخلي في الشارقة. اطّلع على محتوى كل أداة، ثم اشترِها مباشرةً من صفحة المنتج.',
    'hero.cta': 'تصفّح المكتبة',
    'hero.secondary': 'شاهد دروسنا على إنستغرام',
    'board.label': 'لوحة العينات: اختر أداة لعرض تفاصيلها',
    'board.hint': 'اضغط على أي عينة لفتحها',
    'library.title': 'المكتبة',
    'library.lede': 'ثلاث أدوات، لكلٍّ منها وصف كامل قبل الشراء.',
    'spec.software': 'البرنامج',
    'spec.contents': 'المحتوى',
    'spec.size': 'الحجم',
    'spec.details': 'التفاصيل',
    'spec.onPage': 'في صفحة المنتج',
    'art.note': 'رسم توضيحي',
    'cta.buy': 'اشترِ الآن',
    'cta.buyVia': 'اشترِ عبر Linktree',
    'cta.ask': 'اطرح سؤالًا',
    'cta.newTab': '(يُفتح في علامة تبويب جديدة)',
    'studio.title': 'استوديو يمكنك التواصل معه',
    'studio.body':
      'رمال للتصميم الداخلي استوديو تصميم داخلي مقرّه الشارقة في الإمارات. ننشر دروسًا في Revit وAutoCAD و3ds Max وSketchUp على إنستغرام. وإن لم تكن متأكدًا من الأداة المناسبة لعملك، راسلنا قبل الشراء.',
    'studio.followers': 'أكثر من 3,500 متابع على إنستغرام',
    'studio.views': 'أكثر من 137,000 مشاهدة لمنشور واحد عن AutoCAD',
    'studio.link': 'زر حسابنا على إنستغرام',
    'how.title': 'طريقة الشراء',
    'how.1.title': 'اختر الأداة',
    'how.1.body': 'اطّلع على محتوى كل مكتبة في الأعلى.',
    'how.2.title': 'افتح صفحة المنتج',
    'how.2.body': 'كل زر «اشترِ الآن» ينقلك إلى صفحة الأداة الخاصة بها.',
    'how.3.title': 'أكمل طلبك هناك',
    'how.3.body': 'تفاصيل الدفع والتحميل موضّحة في تلك الصفحة.',
    'close.title': 'لست متأكدًا أيّها تحتاج؟',
    'close.body': 'أخبرنا بما تعمل عليه، وسنرشدك إلى الأداة المناسبة.',
    'close.cta': 'راسلنا على إنستغرام',
    'close.whatsapp': 'راسلنا على واتساب',
    'close.linktree': 'جميع روابطنا على Linktree',
    'footer.place': 'الشارقة، الإمارات العربية المتحدة',
    'footer.rights': 'جميع الحقوق محفوظة.',
  },
} satisfies Record<Lang, Record<string, string>>;

export type Key = keyof (typeof ui)['en'];

function productStrings(lang: Lang) {
  const out: Record<string, string> = {};
  for (const p of products) {
    out[`p.${p.id}.name`] = p.name[lang];
    out[`p.${p.id}.short`] = p.short[lang];
    out[`p.${p.id}.description`] = p.description[lang];
    out[`p.${p.id}.contents`] = p.contents[lang];
    out[`p.${p.id}.size`] = p.size ? p.size[lang] : ui[lang]['spec.onPage'];
    out[`p.${p.id}.buy`] = hasOwnLink(p) ? ui[lang]['cta.buy'] : ui[lang]['cta.buyVia'];
  }
  return out;
}

export const dictionary: Record<Lang, Record<string, string>> = {
  en: { ...ui.en, ...productStrings('en') },
  ar: { ...ui.ar, ...productStrings('ar') },
};

export const translator = (lang: Lang) => (key: string) => {
  const value = dictionary[lang][key];
  if (value === undefined) throw new Error(`Missing ${lang} string: ${key}`);
  return value;
};

export const pathFor = (lang: Lang) => (lang === 'ar' ? '/ar/' : '/');
