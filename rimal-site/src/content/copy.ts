/**
 * Page copy in Arabic and English. Product facts live in products.ts.
 * Keep the Arabic simple and Gulf-friendly.
 */
import type { Lang } from './products';

const copy = {
  ar: {
    meta: {
      title: 'حزمة المهندس المعماري الشاملة بـ $25 | RIMAL Interiors',
      description:
        '+3,000 بلوك AutoCAD ذكي، مكتبة Revit بحجم 26GB، +1,000 بلوك و+30 بلقن SketchUp، سكربتات 3ds Max و+5,000 برومبت AI. كلها في حزمة وحدة بـ $25.',
      ogImage: '/og-ar.jpg',
      ogAlt: 'RIMAL Interiors: حزمة المهندس المعماري الشاملة بـ $25',
    },
    skip: 'تخطَّ إلى المحتوى',
    nav: { programs: 'البرامج', vault: 'الحزمة', details: 'التفاصيل', faq: 'الأسئلة', about: 'عنّي' },
    menu: 'القائمة',
    langSwitch: { label: 'English', short: 'EN', href: '/en/', hreflang: 'en' },
    buyShort: 'اشترِ الحزمة',
    newTab: '(يفتح في تبويب جديد)',

    hero: {
      eyebrow: 'RIMAL / الحزمة 01',
      title: 'صمّم أكثر. ارسم أقل.',
      lede: 'حزمة المهندس المعماري الشاملة: بلوكات ذكية، مكتبة Revit كاملة، بلقنز SketchUp، سكربتات 3ds Max وبرومبتات AI. كلها في مكان واحد.',
      cta: 'اشترِ الحزمة',
      secondary: 'وش داخلها؟',
      priceNote: 'دفعة وحدة للحزمة كاملة', // TODO: confirm — "paid once, not per program"
      scroll: 'انزل تحت',
    },

    features: [
      { fig: '+3,000', label: 'بلوك AutoCAD ذكي', icon: 'block' },
      { fig: '26GB', label: 'مكتبة Revit', icon: 'library' },
      { fig: '+30', label: 'بلقن SketchUp', icon: 'plug' },
      { fig: '+5,000', label: 'برومبت AI جاهز', icon: 'spark' },
    ],

    programs: {
      kicker: 'داخل الحزمة',
      title: 'حزمة وحدة. خمس برامج.',
      all: 'كل التفاصيل',
    },

    spotlight: {
      kicker: 'الحزمة الكاملة',
      specs: [
        { k: 'البرامج', v: '5' },
        { k: 'مكتبة Revit', v: '26GB' },
        { k: 'الدفع', v: 'مرة وحدة' }, // TODO: confirm — "paid once"
      ],
      scheduleTitle: 'وش في كل ملف',
      proofLead: 'أول ريل عن الحزمة على إنستغرام',
      views: 'مشاهدة',
      shares: 'مشاركة',
    },

    details: {
      title: 'كل التفاصيل جاهزة.',
      lede: '+6,000 بلوك AutoCAD إضافي، مقسّمة على أربع فئات.',
      tiles: [
        { key: 'furniture', label: 'أثاث' },
        { key: 'decor', label: 'ديكور' },
        { key: 'architectural', label: 'عناصر معمارية' },
        { key: 'islamic', label: 'زخارف إسلامية' },
      ],
    },

    value: {
      kicker: 'الحسبة',
      title: 'أداة وحدة ممكن تكلّفك أكثر من الحزمة كلها.',
      toolLine: 'أداة مثل Kitchen Generator لحالها',
      vaultLine: 'الحزمة كاملة، خمس برامج',
      note: 'Kitchen Generator واحد من +30 بلقن SketchUp داخل الحزمة.',
    },

    steps: {
      kicker: 'طريقة الشراء',
      title: 'ثلاث خطوات وتبدأ.',
      items: [
        { t: 'اضغط «اشترِ الحزمة»', d: 'تنفتح لك صفحة الحزمة على Gumroad في تبويب جديد.' },
        { t: 'ادفع على Gumroad', d: 'الدفع كله على Gumroad. هذا الموقع ما يطلب ولا يحفظ أي بيانات بطاقة.' },
        { t: 'نزّل ملفاتك', d: 'توصلك روابط التحميل من Gumroad بعد الدفع.' }, // TODO: confirm delivery method
      ],
    },

    more: {
      kicker: 'المتجر',
      title: 'أدوات ثانية جاية.',
      lede: 'تابعني على إنستغرام عشان تعرف أول ما تنزل.',
      soon: 'قريباً',
      follow: 'تابع @rimalinterior',
    },

    about: {
      kicker: 'عنّي',
      title: 'أنا أحمد نزار.',
      body: [
        'طالب عمارة داخلية ومصمم شغّال في الإمارات والخليج.',
        'أسست RIMAL Interiors عشان أجمع للمعماريين ومصممي الداخلي أدوات رقمية توفّر وقتهم، بسعر يناسب الطالب والمكتب.',
      ],
      ig: 'كلّمني على إنستغرام',
    },

    faq: {
      kicker: 'أسئلة',
      title: 'قبل لا تشتري',
      items: [
        {
          q: 'الـ $25 لكل برنامج ولا للحزمة كاملة؟',
          // TODO: confirm — "paid once, not per program"
          a: 'للحزمة كاملة. تدفع $25 مرة وحدة وتاخذ ملفات البرامج الخمسة: AutoCAD و Revit و SketchUp و 3ds Max و AI.',
        },
        {
          q: 'كيف أستلم الملفات؟',
          // TODO: confirm delivery method
          a: 'الشراء والتسليم كله عن طريق Gumroad. بعد الدفع توصلك روابط التحميل من Gumroad.',
        },
        {
          q: 'حجم الملفات كبير؟',
          a: 'مكتبة Revit لحالها 26GB. تأكد إن عندك مساحة كافية وإنترنت ثابت قبل التحميل.',
        },
        {
          q: 'تشتغل مع نسخة البرنامج اللي عندي؟',
          // TODO: confirm supported software versions and add them here
          a: 'إذا عندك نسخة قديمة أو مو متأكد، راسلني على إنستغرام قبل لا تشتري وأتأكد لك.',
        },
        {
          q: 'الدفع آمن؟',
          a: 'الدفع كله يصير على Gumroad، منصة معروفة لبيع المنتجات الرقمية. هذا الموقع ما فيه أي صفحة دفع وما يحفظ بيانات بطاقتك.',
        },
        {
          q: 'عندي سؤال ثاني.',
          a: 'راسلني على إنستغرام @rimalinterior وأرد عليك.',
        },
      ],
    },

    final: {
      kicker: 'RIMAL Interiors',
      title: 'كل أدواتك في حزمة وحدة.',
      lede: 'AutoCAD و Revit و SketchUp و 3ds Max و AI.',
    },

    sticky: 'الحزمة الشاملة',

    footer: {
      tagline: 'أدوات رقمية للمعماريين ومصممي الداخلي.',
      shop: 'المتجر',
      vault: 'حزمة المهندس المعماري الشاملة',
      soon: 'منتجات قريباً',
      contact: 'تواصل',
      checkout: 'الدفع عبر Gumroad',
      made: 'Made by Ahmed Nazar',
      rights: 'جميع الحقوق محفوظة',
      imagery: 'الصور توضيحية.', // generated mood imagery — see README
    },
  },

  en: {
    meta: {
      title: 'Ultimate Architect Tools Vault for $25 | RIMAL Interiors',
      description:
        '+3,000 smart AutoCAD blocks, a 26GB Revit library, +1,000 SketchUp blocks and +30 plugins, 3ds Max scripts and +5,000 AI prompts. One vault, $25.',
      ogImage: '/og-en.jpg',
      ogAlt: 'RIMAL Interiors: Ultimate Architect Tools Vault for $25',
    },
    skip: 'Skip to content',
    nav: { programs: 'Programs', vault: 'The Vault', details: 'Details', faq: 'FAQ', about: 'About' },
    menu: 'Menu',
    langSwitch: { label: 'العربية', short: 'ع', href: '/', hreflang: 'ar' },
    buyShort: 'Get the Vault',
    newTab: '(opens in a new tab)',

    hero: {
      eyebrow: 'RIMAL / Vault 01',
      title: 'Design more. Draw less.',
      lede: 'The Ultimate Architect Tools Vault: smart blocks, a full Revit library, SketchUp plugins, 3ds Max scripts and AI prompts. All in one place.',
      cta: 'Get the Vault',
      secondary: "What's inside",
      priceNote: 'One payment for the whole vault', // TODO: confirm — "paid once, not per program"
      scroll: 'Scroll down',
    },

    features: [
      { fig: '+3,000', label: 'Smart AutoCAD blocks', icon: 'block' },
      { fig: '26GB', label: 'Revit library', icon: 'library' },
      { fig: '+30', label: 'SketchUp plugins', icon: 'plug' },
      { fig: '+5,000', label: 'Ready AI prompts', icon: 'spark' },
    ],

    programs: {
      kicker: 'Inside the Vault',
      title: 'One vault. Five programs.',
      all: 'Full contents',
    },

    spotlight: {
      kicker: 'The complete vault',
      specs: [
        { k: 'Programs', v: '5' },
        { k: 'Revit library', v: '26GB' },
        { k: 'Payment', v: 'Once' }, // TODO: confirm — "paid once"
      ],
      scheduleTitle: "What's in each folder",
      proofLead: 'The first Vault reel on Instagram',
      views: 'views',
      shares: 'shares',
    },

    details: {
      title: 'Every detail, ready.',
      lede: '+6,000 extra AutoCAD blocks across four categories.',
      tiles: [
        { key: 'furniture', label: 'Furniture' },
        { key: 'decor', label: 'Decor' },
        { key: 'architectural', label: 'Architectural elements' },
        { key: 'islamic', label: 'Islamic decor' },
      ],
    },

    value: {
      kicker: 'The math',
      title: 'One tool can cost more than the whole Vault.',
      toolLine: 'A tool like Kitchen Generator, alone',
      vaultLine: 'The whole Vault, five programs',
      note: 'Kitchen Generator is one of the +30 SketchUp plugins in the Vault.',
    },

    steps: {
      kicker: 'How to buy',
      title: 'Three steps and you’re in.',
      items: [
        { t: 'Tap “Get the Vault”', d: 'The Vault’s Gumroad page opens in a new tab.' },
        { t: 'Pay on Gumroad', d: 'Checkout happens on Gumroad. This site never asks for or stores card details.' },
        { t: 'Download your files', d: 'Gumroad gives you the download links after payment.' }, // TODO: confirm delivery method
      ],
    },

    more: {
      kicker: 'Store',
      title: 'More tools on the way.',
      lede: 'Follow on Instagram to hear first when they drop.',
      soon: 'Coming soon',
      follow: 'Follow @rimalinterior',
    },

    about: {
      kicker: 'About',
      title: 'I’m Ahmed Nazar.',
      body: [
        'An interior architecture student and working designer in the UAE and the Gulf.',
        'I started RIMAL Interiors to put together digital tools that save architects and interior designers time, at a price that works for students and studios alike.',
      ],
      ig: 'Message me on Instagram',
    },

    faq: {
      kicker: 'FAQ',
      title: 'Before you buy',
      items: [
        {
          q: 'Is the $25 per program or for everything?',
          a: 'For everything. You pay $25 once and get the files for all five: AutoCAD, Revit, SketchUp, 3ds Max and AI.', // TODO: confirm
        },
        {
          q: 'How do I get the files?',
          a: 'Purchase and delivery both happen on Gumroad. After payment, Gumroad gives you the download links.', // TODO: confirm
        },
        {
          q: 'Are the files large?',
          a: 'The Revit library alone is 26GB. Make sure you have the space and a stable connection before downloading.',
        },
        {
          q: 'Will it work with my software version?',
          a: 'If you’re on an older version or not sure, message me on Instagram before buying and I’ll check for you.', // TODO: confirm versions
        },
        {
          q: 'Is payment secure?',
          a: 'Payment happens entirely on Gumroad, a well-known platform for digital products. This site has no checkout of its own and never stores card details.',
        },
        {
          q: 'I have another question.',
          a: 'Message me on Instagram at @rimalinterior and I’ll get back to you.',
        },
      ],
    },

    final: {
      kicker: 'RIMAL Interiors',
      title: 'Every tool you need, in one vault.',
      lede: 'AutoCAD, Revit, SketchUp, 3ds Max and AI.',
    },

    sticky: 'The full Vault',

    footer: {
      tagline: 'Digital tools for architects and interior designers.',
      shop: 'Shop',
      vault: 'Ultimate Architect Tools Vault',
      soon: 'Coming soon',
      contact: 'Contact',
      checkout: 'Checkout via Gumroad',
      made: 'Made by Ahmed Nazar',
      rights: 'All rights reserved',
      imagery: 'Imagery is illustrative.',
    },
  },
} as const;

export type Copy = (typeof copy)['ar'];
export const getCopy = (lang: Lang) => copy[lang] as unknown as Copy;
