import { site } from './site';

export type Lang = 'en' | 'ar';
type Text = Record<Lang, string>;

export interface Product {
  id: string;
  /** Which drawing the product's specimen shows. */
  art: 'revit' | 'autocad' | 'max';
  /** Purchase link. Leave empty to fall back to the Linktree page. */
  link: string;
  name: Text;
  short: Text;
  description: Text;
  software: string;
  contents: Text;
  /** Leave undefined when unknown; the page then points to the product page. */
  size?: Text;
}

// To add a product, copy one entry, give it a new `id`, and fill in both
// languages. Paste the product's own checkout link into `link`.
export const products: Product[] = [
  {
    id: 'revit',
    art: 'revit',
    link: '',
    name: { en: 'Revit Families Library', ar: 'مكتبة عائلات Revit' },
    short: {
      en: '26 GB of ready-made Revit families',
      ar: '26 جيجابايت من عائلات Revit الجاهزة',
    },
    description: {
      en: 'A large library of ready-made Revit families, so you can place elements in your model instead of building each one from scratch.',
      ar: 'مكتبة كبيرة من عائلات Revit الجاهزة، لتضيف العناصر إلى نموذجك مباشرةً بدلًا من بناء كل عنصر من الصفر.',
    },
    software: 'Revit',
    contents: { en: 'Families library', ar: 'مكتبة عائلات' },
    size: { en: '26 GB', ar: '26 جيجابايت' },
  },
  {
    id: 'autocad',
    art: 'autocad',
    link: '',
    name: { en: 'AutoCAD Blocks', ar: 'بلوكات AutoCAD' },
    short: {
      en: 'Ready-to-use blocks for your drawings',
      ar: 'بلوكات جاهزة لرسوماتك',
    },
    description: {
      en: 'A collection of ready-to-use AutoCAD blocks to drop into your plans and layouts, so your drawings come together faster.',
      ar: 'مجموعة من بلوكات AutoCAD الجاهزة للاستخدام، تضيفها إلى المساقط واللوحات لتُنجز رسوماتك بشكل أسرع.',
    },
    software: 'AutoCAD',
    contents: { en: 'Blocks library', ar: 'مكتبة بلوكات' },
  },
  {
    id: 'max',
    art: 'max',
    link: '',
    name: { en: '3ds Max Scripts Toolbox', ar: 'مجموعة سكربتات 3ds Max' },
    short: {
      en: 'Scripts that take repetitive work out of 3ds Max',
      ar: 'سكربتات تختصر العمل المتكرر في 3ds Max',
    },
    description: {
      en: 'A toolbox of 3ds Max scripts for the repetitive parts of modelling and scene setup.',
      ar: 'مجموعة من سكربتات 3ds Max للمهام المتكررة في النمذجة وتجهيز المشاهد.',
    },
    software: '3ds Max',
    contents: { en: 'Scripts toolbox', ar: 'مجموعة سكربتات' },
  },
];

export const hasOwnLink = (p: Product) => p.link.trim() !== '';
export const buyLink = (p: Product) => (hasOwnLink(p) ? p.link : site.linktree);
