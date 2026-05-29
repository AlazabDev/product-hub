/**
 * Alazab PAOP - Pricing Engine
 * محرك التسعير الذكي للوحدات الخشبية المخصصة
 * 
 * يقوم بـ:
 * 1. تحليل مكونات التصميم
 * 2. حساب تكلفة الخامات
 * 3. حساب تكلفة العمالة
 * 4. اضافة التكاليف غير المباشرة
 * 5. تطبيق هامش الربح
 * 6. تطبيق الخصومات
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// =====================================================
// Types
// =====================================================

export interface DesignData {
  // الابعاد الرئيسية
  dimensions: {
    width: number;      // العرض بالسنتيمتر
    height: number;     // الارتفاع بالسنتيمتر
    depth: number;      // العمق بالسنتيمتر
    unit?: string;      // وحدة القياس (cm, mm, m)
  };
  
  // المكونات الاساسية
  components: DesignComponent[];
  
  // الخامات المطلوبة
  materials?: MaterialSpec[];
  
  // التشطيبات
  finishes?: {
    color?: string;
    texture?: string;
    coating?: string;      // طلاء، لميع، مطفي
    coating_type?: string; // PU, melamine, lacquer
  };
  
  // الاكسسوارات
  accessories?: AccessorySpec[];
  
  // مستوى التعقيد
  complexity?: "simple" | "medium" | "complex";
  
  // متطلبات اضافية
  special_requirements?: string[];
}

export interface DesignComponent {
  type: string;           // door, drawer, shelf, panel, frame
  name: string;
  quantity: number;
  dimensions?: {
    width: number;
    height: number;
    thickness?: number;
  };
  material_code?: string;
  material_type?: string;
  finish?: string;
}

export interface MaterialSpec {
  material_code: string;
  material_name: string;
  material_type: string;  // wood, mdf, plywood, melamine, hardware
  quantity: number;
  unit: string;           // m2, piece, meter, kg
  unit_cost?: number;
}

export interface AccessorySpec {
  type: string;           // handle, hinge, rail, lock
  code?: string;
  name: string;
  quantity: number;
  unit_cost?: number;
}

export interface PricingResult {
  // تفاصيل الخامات
  materials_breakdown: MaterialCost[];
  materials_cost: number;
  
  // تكلفة العمالة
  labor_hours: number;
  labor_rate: number;
  labor_cost: number;
  
  // التكاليف غير المباشرة
  overhead_percent: number;
  overhead_cost: number;
  
  // الاجمالي قبل الربح
  total_cost: number;
  
  // هامش الربح
  profit_margin: number;
  profit_amount: number;
  
  // سعر البيع النهائي
  selling_price: number;
  
  // تفاصيل التسعير
  breakdown: PricingBreakdown;
}

export interface MaterialCost {
  material_code: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  product_id?: string;
  supplier_id?: string;
  supplier_name?: string;
}

export interface PricingBreakdown {
  dimensions_factor: number;
  complexity_factor: number;
  materials: {
    panels: number;
    hardware: number;
    accessories: number;
    finishes: number;
  };
  labor: {
    cutting: number;
    assembly: number;
    finishing: number;
    installation: number;
  };
  applied_rules: string[];
  discounts: {
    volume: number;
    special: number;
  };
}

// =====================================================
// Material & Labor Configuration
// =====================================================
// Live prices come from DB (products + prices). The constants below are
// DEV-ONLY fallbacks; in production a missing material throws.
//
// Material price loader: queries `products` joined with their default `prices`
// row, indexed by az_code / product_code. Cached for the lifetime of the
// server process.

interface MaterialEntry {
  price: number;
  unit: string;
  name_ar: string;
  product_id?: string;
  supplier_id?: string;
}

const DEFAULT_MATERIAL_PRICES: Record<string, MaterialEntry> = {
  "MDF-18": { price: 180, unit: "m2", name_ar: "MDF 18mm" },
  "MDF-16": { price: 160, unit: "m2", name_ar: "MDF 16mm" },
  "MDF-12": { price: 140, unit: "m2", name_ar: "MDF 12mm" },
  "PLY-18": { price: 220, unit: "m2", name_ar: "خشب رقائقي 18mm" },
  "PLY-12": { price: 180, unit: "m2", name_ar: "خشب رقائقي 12mm" },
  "MEL-18": { price: 250, unit: "m2", name_ar: "ميلامين 18mm" },
  "MEL-16": { price: 230, unit: "m2", name_ar: "ميلامين 16mm" },
  "SOLID-OAK": { price: 450, unit: "m2", name_ar: "خشب بلوط صلب" },
  "SOLID-BEECH": { price: 380, unit: "m2", name_ar: "خشب زان صلب" },
  "HINGE-SOFT": { price: 25, unit: "piece", name_ar: "مفصلة سوفت كلوز" },
  "HINGE-STD": { price: 12, unit: "piece", name_ar: "مفصلة عادية" },
  "HANDLE-MOD": { price: 35, unit: "piece", name_ar: "يد حديثة" },
  "HANDLE-CLS": { price: 25, unit: "piece", name_ar: "يد كلاسيك" },
  "DRAWER-RAIL": { price: 85, unit: "set", name_ar: "سكة درج سوفت كلوز" },
  "SHELF-SUPPORT": { price: 5, unit: "piece", name_ar: "حامل رف" },
  "LOCK-STD": { price: 45, unit: "piece", name_ar: "قفل عادي" },
  "PAINT-PU": { price: 120, unit: "m2", name_ar: "دهان PU" },
  "PAINT-LAC": { price: 150, unit: "m2", name_ar: "دهان لاكيه" },
  "VENEER": { price: 180, unit: "m2", name_ar: "قشرة خشب" },
  "EDGE-PVC": { price: 8, unit: "meter", name_ar: "حافة PVC" },
  "EDGE-ABS": { price: 12, unit: "meter", name_ar: "حافة ABS" },
};

const DEFAULT_LABOR_RATES = {
  cutting: 40,
  assembly: 50,
  finishing: 45,
  installation: 60,
};

let MATERIAL_CACHE: Record<string, MaterialEntry> | null = null;
let LABOR_CACHE: typeof DEFAULT_LABOR_RATES | null = null;

function isProd() {
  return process.env.NODE_ENV === "production";
}

async function fetchMaterialPrices(): Promise<Record<string, MaterialEntry>> {
  if (MATERIAL_CACHE) return MATERIAL_CACHE;
  try {
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, az_code, product_code, name_ar, default_supplier_id, default_price_id")
      .eq("status", "approved");

    const ids = (products ?? []).map((p) => p.default_price_id).filter(Boolean) as string[];
    const priceMap = new Map<string, { selling_price: number | null }>();
    if (ids.length > 0) {
      const { data: prices } = await supabaseAdmin
        .from("prices")
        .select("id, selling_price")
        .in("id", ids);
      for (const p of prices ?? []) priceMap.set(p.id, { selling_price: p.selling_price });
    }

    const built: Record<string, MaterialEntry> = {};
    for (const p of products ?? []) {
      const key = p.product_code ?? p.az_code;
      const priceRow = p.default_price_id ? priceMap.get(p.default_price_id) : null;
      const price = Number(priceRow?.selling_price ?? 0);
      if (!key || !price) continue;
      built[key] = {
        price,
        unit: "piece",
        name_ar: p.name_ar ?? key,
        product_id: p.id,
        supplier_id: p.default_supplier_id ?? undefined,
      };
    }

    MATERIAL_CACHE = isProd() ? built : { ...DEFAULT_MATERIAL_PRICES, ...built };
    return MATERIAL_CACHE;
  } catch (err) {
    if (isProd()) throw new Error(`material_price_load_failed: ${String(err)}`);
    console.warn("[pricing-engine] DB material lookup failed; using DEV fallback.", err);
    MATERIAL_CACHE = { ...DEFAULT_MATERIAL_PRICES };
    return MATERIAL_CACHE;
  }
}

async function fetchLaborRules(): Promise<typeof DEFAULT_LABOR_RATES> {
  if (LABOR_CACHE) return LABOR_CACHE;
  try {
    const { data } = await supabaseAdmin
      .from("pricing_rules")
      .select("rule_type, value, conditions")
      .eq("is_active", true)
      .eq("rule_type", "labor_rate");
    const rates = { ...DEFAULT_LABOR_RATES };
    let dbHit = false;
    for (const r of data ?? []) {
      const phase = (r.conditions as { phase?: string } | null)?.phase;
      if (phase && phase in rates) {
        rates[phase as keyof typeof rates] = Number(r.value);
        dbHit = true;
      }
    }
    if (!dbHit && isProd()) throw new Error("pricing_rules_missing: labor_rate");
    if (!dbHit) console.warn("[pricing-engine] No labor_rate rules; using DEV defaults.");
    LABOR_CACHE = rates;
    return LABOR_CACHE;
  } catch (err) {
    if (isProd()) throw err;
    console.warn("[pricing-engine] DB labor lookup failed; using DEV fallback.", err);
    LABOR_CACHE = { ...DEFAULT_LABOR_RATES };
    return LABOR_CACHE;
  }
}

function requireMaterial(code: string, prices: Record<string, MaterialEntry>): MaterialEntry | null {
  const m = prices[code];
  if (m) return m;
  if (isProd()) throw new Error(`material_price_missing: ${code}`);
  console.warn(`[pricing-engine] Missing material '${code}' — skipping in DEV.`);
  return null;
}



// =====================================================
// Pricing Engine
// =====================================================

export async function calculateQuotePrice(
  design: DesignData,
  quantity: number = 1
): Promise<PricingResult> {
  
  // جلب قواعد التسعير من قاعدة البيانات
  const rules = await fetchPricingRules();
  
  // 1. حساب مساحة الوحدة
  const surfaceArea = calculateSurfaceArea(design.dimensions);
  
  // 2. تحديد معامل التعقيد
  const complexityFactor = getComplexityFactor(design.complexity || "medium", rules);
  
  // 3. حساب تكلفة الخامات
  const materialsCost = await calculateMaterialsCost(design, surfaceArea);
  
  // 4. حساب تكلفة العمالة
  const laborCost = calculateLaborCost(design, surfaceArea, complexityFactor);
  
  // 5. التكاليف غير المباشرة
  const overheadPercent = getOverheadPercent(rules);
  const subtotal = materialsCost.total + laborCost.total;
  const overheadCost = subtotal * (overheadPercent / 100);
  
  // 6. التكلفة الاجمالية
  const totalCost = subtotal + overheadCost;
  
  // 7. هامش الربح
  const profitMargin = getProfitMargin(rules);
  const profitAmount = totalCost * (profitMargin / 100);
  
  // 8. سعر البيع للوحدة الواحدة
  let unitSellingPrice = totalCost + profitAmount;
  
  // 9. خصم الكمية
  const volumeDiscount = getVolumeDiscount(quantity, rules);
  const totalBeforeDiscount = unitSellingPrice * quantity;
  const discountAmount = totalBeforeDiscount * (volumeDiscount / 100);
  const finalPrice = totalBeforeDiscount - discountAmount;
  
  // 10. تجميع النتيجة
  const result: PricingResult = {
    materials_breakdown: materialsCost.breakdown,
    materials_cost: materialsCost.total,
    
    labor_hours: laborCost.hours,
    labor_rate: laborCost.avgRate,
    labor_cost: laborCost.total,
    
    overhead_percent: overheadPercent,
    overhead_cost: overheadCost,
    
    total_cost: totalCost,
    
    profit_margin: profitMargin,
    profit_amount: profitAmount,
    
    selling_price: Math.round(finalPrice / quantity), // سعر الوحدة بعد الخصم
    
    breakdown: {
      dimensions_factor: surfaceArea,
      complexity_factor: complexityFactor,
      materials: {
        panels: materialsCost.categories.panels,
        hardware: materialsCost.categories.hardware,
        accessories: materialsCost.categories.accessories,
        finishes: materialsCost.categories.finishes,
      },
      labor: laborCost.breakdown,
      applied_rules: rules.map(r => r.name),
      discounts: {
        volume: volumeDiscount,
        special: 0,
      },
    },
  };
  
  return result;
}

// =====================================================
// Helper Functions
// =====================================================

async function fetchPricingRules() {
  try {
    const { data } = await supabaseAdmin
      .from("pricing_rules")
      .select("*")
      .eq("is_active", true)
      .or("valid_to.is.null,valid_to.gte." + new Date().toISOString().split("T")[0])
      .order("priority", { ascending: true });
    return data || [];
  } catch {
    return getDefaultRules();
  }
}

function getDefaultRules() {
  return [
    { name: "material_markup", rule_type: "material_markup", value: 25 },
    { name: "labor_rate", rule_type: "labor_rate", value: 50 },
    { name: "overhead", rule_type: "overhead_percent", value: 15 },
    { name: "profit", rule_type: "material_markup", value: 25 },
  ];
}

function calculateSurfaceArea(dimensions: DesignData["dimensions"]): number {
  const { width, height, depth, unit } = dimensions;
  
  // تحويل للمتر المربع
  let factor = 1;
  if (unit === "mm") factor = 0.001;
  else if (unit === "cm") factor = 0.01;
  
  const w = width * factor;
  const h = height * factor;
  const d = depth * factor;
  
  // حساب المساحة الكلية (الواجهة + الجوانب + القاع + السقف)
  const frontBack = 2 * w * h;
  const sides = 2 * d * h;
  const topBottom = 2 * w * d;
  
  return frontBack + sides + topBottom;
}

function getComplexityFactor(complexity: string, rules: any[]): number {
  const rule = rules.find(
    r => r.rule_type === "complexity_factor" && 
    r.conditions?.complexity_level === complexity
  );
  return rule?.value || (complexity === "simple" ? 1.0 : complexity === "medium" ? 1.25 : 1.5);
}

function getOverheadPercent(rules: any[]): number {
  const rule = rules.find(r => r.rule_type === "overhead_percent");
  return rule?.value || 15;
}

function getProfitMargin(rules: any[]): number {
  const rule = rules.find(r => r.rule_type === "material_markup");
  return rule?.value || 25;
}

function getVolumeDiscount(quantity: number, rules: any[]): number {
  const discountRules = rules
    .filter(r => r.rule_type === "volume_discount")
    .sort((a, b) => (b.conditions?.min_quantity || 0) - (a.conditions?.min_quantity || 0));
  
  for (const rule of discountRules) {
    if (quantity >= (rule.conditions?.min_quantity || 0)) {
      return rule.value || 0;
    }
  }
  return 0;
}

async function calculateMaterialsCost(design: DesignData, surfaceArea: number) {
  const breakdown: MaterialCost[] = [];
  let total = 0;
  const categories = { panels: 0, hardware: 0, accessories: 0, finishes: 0 };
  const prices = await fetchMaterialPrices();

  // حساب الالواح الرئيسية
  if (design.components) {
    for (const comp of design.components) {
      const materialCode = comp.material_code || getMaterialCodeForComponent(comp);
      const material = requireMaterial(materialCode, prices);
      if (material) {
        let quantity = comp.quantity;
        if (comp.dimensions && material.unit === "m2") {
          quantity = (comp.dimensions.width * comp.dimensions.height / 10000) * comp.quantity;
        }
        const cost = quantity * material.price;
        breakdown.push({
          material_code: materialCode,
          material_name: material.name_ar,
          quantity,
          unit: material.unit,
          unit_cost: material.price,
          total_cost: cost,
          product_id: material.product_id,
          supplier_id: material.supplier_id,
        });
        total += cost;
        categories.panels += cost;
      }
    }
  }

  // حساب الاكسسوارات
  if (design.accessories) {
    for (const acc of design.accessories) {
      const code = acc.code || getAccessoryCode(acc.type);
      const material = requireMaterial(code, prices);
      if (material) {
        const cost = acc.quantity * (acc.unit_cost || material.price);
        breakdown.push({
          material_code: code,
          material_name: material.name_ar,
          quantity: acc.quantity,
          unit: material.unit,
          unit_cost: acc.unit_cost || material.price,
          total_cost: cost,
          product_id: material.product_id,
          supplier_id: material.supplier_id,
        });
        total += cost;
        categories.accessories += cost;
      }
    }
  }

  // حساب التشطيبات
  if (design.finishes?.coating_type) {
    const coatingCode = getCoatingCode(design.finishes.coating_type);
    const coating = requireMaterial(coatingCode, prices);
    if (coating) {
      const cost = surfaceArea * coating.price;
      breakdown.push({
        material_code: coatingCode,
        material_name: coating.name_ar,
        quantity: surfaceArea,
        unit: coating.unit,
        unit_cost: coating.price,
        total_cost: cost,
        product_id: coating.product_id,
        supplier_id: coating.supplier_id,
      });
      total += cost;
      categories.finishes += cost;
    }
  }

  // حساب الحواف
  const edgeLength = calculateEdgeLength(design);
  if (edgeLength > 0) {
    const edgeCode = "EDGE-PVC";
    const edge = requireMaterial(edgeCode, prices);
    if (edge) {
      const cost = edgeLength * edge.price;
      breakdown.push({
        material_code: edgeCode,
        material_name: edge.name_ar,
        quantity: edgeLength,
        unit: edge.unit,
        unit_cost: edge.price,
        total_cost: cost,
        product_id: edge.product_id,
        supplier_id: edge.supplier_id,
      });
      total += cost;
      categories.finishes += cost;
    }
  }

  return { breakdown, total, categories };
}

async function calculateLaborCost(design: DesignData, surfaceArea: number, complexityFactor: number) {
  const rates = await fetchLaborRules();
  const breakdown = {
    cutting: 0,
    assembly: 0,
    finishing: 0,
    installation: 0,
  };
  const baseHours = surfaceArea * 2;
  breakdown.cutting = baseHours * 0.25 * rates.cutting;
  breakdown.assembly = baseHours * 0.35 * complexityFactor * rates.assembly;
  breakdown.finishing = baseHours * 0.25 * rates.finishing;
  breakdown.installation = baseHours * 0.15 * rates.installation;

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const hours = baseHours * complexityFactor;
  const avgRate = total / hours;
  return { breakdown, total, hours, avgRate };
}

function getMaterialCodeForComponent(comp: DesignComponent): string {
  const type = comp.type.toLowerCase();
  if (type.includes("door") || type.includes("باب")) return "MEL-18";
  if (type.includes("drawer") || type.includes("درج")) return "MEL-16";
  if (type.includes("shelf") || type.includes("رف")) return "MEL-18";
  if (type.includes("panel") || type.includes("لوح")) return "MDF-18";
  if (type.includes("back") || type.includes("ظهر")) return "MDF-12";
  return "MDF-18";
}

function getAccessoryCode(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("hinge") || t.includes("مفصل")) return "HINGE-SOFT";
  if (t.includes("handle") || t.includes("يد")) return "HANDLE-MOD";
  if (t.includes("rail") || t.includes("سكة")) return "DRAWER-RAIL";
  if (t.includes("lock") || t.includes("قفل")) return "LOCK-STD";
  return "SHELF-SUPPORT";
}

function getCoatingCode(coatingType: string): string {
  const t = coatingType.toLowerCase();
  if (t.includes("pu")) return "PAINT-PU";
  if (t.includes("lac")) return "PAINT-LAC";
  if (t.includes("veneer") || t.includes("قشرة")) return "VENEER";
  return "PAINT-PU";
}

function calculateEdgeLength(design: DesignData): number {
  if (!design.components) return 0;
  
  let totalEdge = 0;
  for (const comp of design.components) {
    if (comp.dimensions) {
      // محيط المكون * عدد الوحدات
      const perimeter = 2 * (comp.dimensions.width + comp.dimensions.height) / 100; // بالمتر
      totalEdge += perimeter * comp.quantity;
    }
  }
  return totalEdge;
}

// =====================================================
// Export additional utilities
// =====================================================

export async function getMaterialPrices() {
  return MATERIAL_PRICES;
}

export async function updateMaterialPrice(code: string, price: number) {
  if (MATERIAL_PRICES[code]) {
    MATERIAL_PRICES[code].price = price;
    return true;
  }
  return false;
}
