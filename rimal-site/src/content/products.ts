/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PRODUCTS — the only file you need to edit to add, change or remove a product.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  • Every text field has an Arabic (`ar`) and English (`en`) version.
 *  • Numbers and English words inside Arabic text are fine as they are; the site
 *    wraps them automatically so they read correctly right-to-left.
 *  • `status: 'live'` shows a buy button that opens `buyUrl` (Gumroad) in a new tab.
 *    `status: 'soon'` shows the card with a "Coming soon" label and no buy button.
 *  • Clips: drop screen recordings into /assets/clips (repo root), run `npm run clips`,
 *    then put the file name (without extension) in `clip`. See README.md.
 *
 *  Only use facts you can back up. No invented numbers, reviews or deadlines.
 */
import { GUMROAD_VAULT_URL } from '../config';

export type Lang = 'ar' | 'en';
export type Text = Record<Lang, string>;

export type Program = 'autocad' | 'revit' | 'sketchup' | '3dsmax' | 'ai';

export interface VaultSheet {
  /** Drawing-sheet code shown in the schedule, e.g. "A-01". */
  code: string;
  program: Program;
  /** Program name as written on screen (kept in English in both languages). */
  programName: string;
  /** The headline figure, e.g. "+3,000". Shown left-to-right in both languages. */
  figure: string;
  figureLabel: Text;
  summary: Text;
  /** Extra bullet points. */
  details: Text[];
  /** Photo for the program card: a file name in src/assets/photos (without .jpg). */
  image: string;
  /** Optional screen recording name in /public/clips (without extension). */
  clip?: string;
}

export interface Product {
  id: string;
  status: 'live' | 'soon';
  flagship?: boolean;
  name: Text;
  /** Short line under the name on product cards. */
  tagline: Text;
  /** Price in USD. Leave undefined for products without a confirmed price. */
  price?: number;
  buyUrl?: string;
  /** Program tags shown on the card. */
  programs: string[];
  /** Optional photo: a file name in src/assets/photos (without .jpg). */
  image?: string;
  /** Flagship only: the contents, shown as a drawing schedule. */
  sheets?: VaultSheet[];
}

export const products: Product[] = [
  {
    id: 'vault',
    status: 'live',
    flagship: true,
    name: { ar: 'حزمة المهندس المعماري الشاملة', en: 'Ultimate Architect Tools Vault' },
    tagline: {
      ar: 'بلوكات ذكية، مكتبة Revit، بلقنز SketchUp، سكربتات 3ds Max وبرومبتات AI في حزمة وحدة.',
      en: 'Smart blocks, a Revit library, SketchUp plugins, 3ds Max scripts and AI prompts in one vault.',
    },
    price: 25,
    buyUrl: GUMROAD_VAULT_URL,
    programs: ['AutoCAD', 'Revit', 'SketchUp', '3ds Max', 'AI'],
    sheets: [
      {
        code: 'A-01',
        program: 'autocad',
        programName: 'AutoCAD',
        figure: '+3,000',
        figureLabel: { ar: 'بلوك ديناميكي ذكي', en: 'smart dynamic blocks' },
        summary: {
          ar: 'غيّر المقاس، دوّر، وعدّل البلوك في ثواني.',
          en: 'Resize, rotate and edit them in seconds.',
        },
        details: [
          {
            ar: '+6,000 بلوك إضافي: أثاث، ديكور، عناصر معمارية وزخارف إسلامية.',
            en: '+6,000 extra blocks: furniture, decor, architectural elements and Islamic decor.',
          },
        ],
        image: 'card-autocad',
        clip: 'autocad',
      },
      {
        code: 'R-02',
        program: 'revit',
        programName: 'Revit',
        figure: '26GB',
        figureLabel: { ar: 'مكتبة فاميليز', en: 'family library' },
        summary: {
          ar: 'آلاف الفاميليز جاهزة تنزّلها في مشروعك.',
          en: 'Thousands of families, ready to load into your project.',
        },
        details: [
          { ar: 'داخلي، خارجي، أثاث، وإنشائي.', en: 'Interior, exterior, furniture and structural.' },
        ],
        image: 'card-revit',
        clip: 'revit',
      },
      {
        code: 'S-03',
        program: 'sketchup',
        programName: 'SketchUp',
        figure: '+1,000',
        figureLabel: { ar: 'بلوك ذكي', en: 'smart blocks' },
        summary: {
          ar: 'و +30 بلقن احترافي، منها Kitchen Generator.',
          en: 'Plus +30 professional plugins, including Kitchen Generator.',
        },
        details: [
          {
            ar: 'أداة مثل Kitchen Generator ممكن تنباع لحالها بـ $80+.',
            en: 'A tool like Kitchen Generator can sell alone for $80+.',
          },
        ],
        image: 'card-sketchup',
        clip: 'sketchup',
      },
      {
        code: 'M-04',
        program: '3dsmax',
        programName: '3ds Max',
        figure: 'Scripts',
        figureLabel: { ar: 'سكربتات وأدوات', en: 'scripts & tools' },
        summary: {
          ar: 'سكربتات وأدوات تختصر عليك الشغل المتكرر.',
          en: 'Scripts and tools that cut out repetitive work.',
        },
        details: [{ ar: 'منها أداة لتوليد المطابخ.', en: 'Including kitchen generation.' }],
        image: 'card-3dsmax',
        clip: '3dsmax',
      },
      {
        code: 'AI-05',
        program: 'ai',
        programName: 'AI',
        figure: '+5,000',
        figureLabel: { ar: 'برومبت جاهز', en: 'ready prompts' },
        summary: {
          ar: 'برومبتات جاهزة للأفكار، التصميم، والإظهار.',
          en: 'Ready prompts for ideas, design and visualization.',
        },
        details: [],
        image: 'card-ai',
        clip: 'ai',
      },
    ],
  },

  // ── PLACEHOLDERS ────────────────────────────────────────────────────────────
  // TODO: replace with the real products (name, tagline, price, Gumroad link),
  //       then switch `status` to 'live'. Delete any you don't plan to sell.
  {
    id: 'autocad-blocks',
    status: 'soon',
    name: { ar: 'بلوكات AutoCAD', en: 'AutoCAD Blocks' },
    tagline: { ar: 'تفاصيل المنتج قريباً.', en: 'Details coming soon.' },
    programs: ['AutoCAD'],
  },
  {
    id: 'revit-templates',
    status: 'soon',
    name: { ar: 'قوالب Revit', en: 'Revit Templates' },
    tagline: { ar: 'تفاصيل المنتج قريباً.', en: 'Details coming soon.' },
    programs: ['Revit'],
  },
  {
    id: 'ai-prompt-packs',
    status: 'soon',
    name: { ar: 'حزم برومبتات AI', en: 'AI Prompt Packs' },
    tagline: { ar: 'تفاصيل المنتج قريباً.', en: 'Details coming soon.' },
    programs: ['AI'],
  },
];

export const flagship = products.find((p) => p.flagship)!;
export const otherProducts = products.filter((p) => !p.flagship);
