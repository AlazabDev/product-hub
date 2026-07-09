/**
 * Product data normalization utility.
 * Cleans/standardizes fields (unit, pricing, categories, codes, names)
 * BEFORE saving and returns a structured diff so the UI can show a
 * clear before/after report to the user.
 */

export type NormalizeDiffEntry = {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
  rule: string;
};

export type NormalizeResult<T> = {
  normalized: T;
  diff: NormalizeDiffEntry[];
};

const FIELD_LABELS: Record<string, string> = {
  name_ar: "الاسم بالعربي",
  name_en: "الاسم بالانجليزي",
  az_code: "رمز AZ",
  egs_code: "رمز EGS",
  item_type: "نوع البند",
  unit: "الوحدة",
  base_unit: "الوحدة الأساسية",
  gpc_family: "العائلة (GPC)",
  gpc_class: "التصنيف (GPC Class)",
  gpc_segment: "القطاع (GPC Segment)",
  gpc_brick_title: "GPC Brick",
  sector_ar: "القطاع",
  description_ar: "الوصف (عربي)",
  description_en: "الوصف (انجليزي)",
  selling_price: "سعر البيع",
  cost_price: "سعر التكلفة",
  currency: "العملة",
};

// Arabic normalization: strip tatweel, collapse spaces, unify digits
const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

function collapseSpaces(s: string): string {
  return s.replace(/[\t\r\n]+/g, " ").replace(/ {2,}/g, " ").trim();
}

function normalizeArabicText(s: string): string {
  return collapseSpaces(
    s
      .replace(/\u0640/g, "") // tatweel ـ
      .replace(/[\u200B-\u200F\uFEFF]/g, "") // zero-width / bidi marks
      .replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] ?? d),
  );
}

function toTitleCaseEn(s: string): string {
  return collapseSpaces(s)
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function normalizeCode(s: string): string {
  return collapseSpaces(s)
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/[^A-Z0-9\-_/]/g, "");
}

function normalizeUnit(s: string): string {
  const map: Record<string, string> = {
    pcs: "pcs", pc: "pcs", piece: "pcs", pieces: "pcs", قطعة: "pcs", قطع: "pcs", حبة: "pcs",
    kg: "kg", kilo: "kg", kilogram: "kg", كجم: "kg", كيلو: "kg", كيلوجرام: "kg",
    g: "g", gram: "g", جم: "g", جرام: "g",
    m: "m", meter: "m", متر: "m",
    cm: "cm", سم: "cm",
    mm: "mm", مم: "mm",
    l: "l", liter: "l", litre: "l", لتر: "l",
    ml: "ml", مل: "ml",
    box: "box", كرتون: "box", علبة: "box",
    pack: "pack", عبوة: "pack",
    set: "set", طقم: "set",
  };
  const key = collapseSpaces(s).toLowerCase().replace(/\./g, "");
  return map[key] ?? collapseSpaces(s).toLowerCase();
}

function normalizePrice(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const raw = String(v).replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] ?? d);
  const cleaned = raw.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function normalizeCurrency(s: string): string {
  const map: Record<string, string> = {
    egp: "EGP", "ج.م": "EGP", جنيه: "EGP",
    usd: "USD", "$": "USD", دولار: "USD",
    eur: "EUR", "€": "EUR", يورو: "EUR",
    sar: "SAR", ريال: "SAR",
    aed: "AED", درهم: "AED",
  };
  const key = collapseSpaces(s).toLowerCase();
  return map[key] ?? s.trim().toUpperCase();
}

function normalizeCategory(s: string): string {
  // Titlecase-ish for Latin, cleanup Arabic; strip trailing punctuation
  const cleaned = collapseSpaces(s).replace(/[.,;:]+$/g, "");
  if (/[\u0600-\u06FF]/.test(cleaned)) return normalizeArabicText(cleaned);
  return toTitleCaseEn(cleaned);
}

const RULES: Record<
  string,
  { fn: (v: unknown) => unknown; rule: string }
> = {
  name_ar: { fn: (v) => (typeof v === "string" ? normalizeArabicText(v) : v), rule: "تنظيف المسافات والتطويل والأرقام العربية" },
  name_en: { fn: (v) => (typeof v === "string" ? toTitleCaseEn(v) : v), rule: "تحويل إلى Title Case" },
  description_ar: { fn: (v) => (typeof v === "string" ? normalizeArabicText(v) : v), rule: "تنظيف المسافات والتطويل" },
  description_en: { fn: (v) => (typeof v === "string" ? collapseSpaces(v) : v), rule: "تنظيف المسافات الزائدة" },
  az_code: { fn: (v) => (typeof v === "string" ? normalizeCode(v) : v), rule: "أحرف كبيرة وشرطات موحّدة" },
  egs_code: { fn: (v) => (typeof v === "string" ? normalizeCode(v) : v), rule: "أحرف كبيرة وشرطات موحّدة" },
  unit: { fn: (v) => (typeof v === "string" ? normalizeUnit(v) : v), rule: "توحيد رمز الوحدة" },
  base_unit: { fn: (v) => (typeof v === "string" ? normalizeUnit(v) : v), rule: "توحيد رمز الوحدة" },
  selling_price: { fn: normalizePrice, rule: "تحويل رقمي وتقريب لخانتين عشريتين" },
  cost_price: { fn: normalizePrice, rule: "تحويل رقمي وتقريب لخانتين عشريتين" },
  currency: { fn: (v) => (typeof v === "string" ? normalizeCurrency(v) : v), rule: "رمز عملة ISO" },
  gpc_family: { fn: (v) => (typeof v === "string" ? normalizeCategory(v) : v), rule: "توحيد صياغة التصنيف" },
  gpc_class: { fn: (v) => (typeof v === "string" ? normalizeCategory(v) : v), rule: "توحيد صياغة التصنيف" },
  gpc_segment: { fn: (v) => (typeof v === "string" ? normalizeCategory(v) : v), rule: "توحيد صياغة التصنيف" },
  gpc_brick_title: { fn: (v) => (typeof v === "string" ? normalizeCategory(v) : v), rule: "توحيد صياغة التصنيف" },
  sector_ar: { fn: (v) => (typeof v === "string" ? normalizeArabicText(v) : v), rule: "تنظيف نص عربي" },
};

export function normalizeProduct<T extends Record<string, unknown>>(
  input: T,
): NormalizeResult<T> {
  const normalized = { ...input } as Record<string, unknown>;
  const diff: NormalizeDiffEntry[] = [];

  for (const [field, { fn, rule }] of Object.entries(RULES)) {
    if (!(field in input)) continue;
    const before = input[field];
    if (before === null || before === undefined || before === "") continue;
    const after = fn(before);
    // Deep-ish compare via JSON — values here are primitives
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      normalized[field] = after;
      diff.push({
        field,
        label: FIELD_LABELS[field] ?? field,
        before,
        after,
        rule,
      });
    } else {
      normalized[field] = after;
    }
  }

  return { normalized: normalized as T, diff };
}
