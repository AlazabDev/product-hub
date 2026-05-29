/**
 * Alazab PAOP - Training Data Generator for Azure OpenAI Fine-tuning
 *
 * This script generates JSONL training data from Supabase database
 * to create a custom AI model specialized in products and services.
 *
 * Usage: npx tsx scripts/azure-openai/02-generate-training-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Output directory
const outputDir = path.join(__dirname, "training-data");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

interface TrainingMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface TrainingExample {
  messages: TrainingMessage[];
}

// System prompt for all training examples
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, "system-prompt.md"), "utf-8");

/**
 * Generate training examples for product queries
 */
async function generateProductExamples(): Promise<TrainingExample[]> {
  console.log("Generating product training examples...");

  const { data: products, error } = await supabase
    .from("products")
    .select(
      `
      *,
      suppliers:default_supplier_id(name, supplier_tier),
      prices!prices_product_id_fkey(
        purchase_price, selling_price, retail_price, currency
      )
    `,
    )
    .limit(500);

  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }

  const examples: TrainingExample[] = [];

  for (const product of products || []) {
    // Example 1: Product search by name
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `ما هي تفاصيل ${product.name_ar}؟` },
        {
          role: "assistant",
          content: formatProductDetails(product),
        },
      ],
    });

    // Example 2: Product search by code
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `اعطني معلومات البند ${product.az_code}` },
        {
          role: "assistant",
          content: formatProductDetails(product),
        },
      ],
    });

    // Example 3: Price inquiry
    if (product.prices?.[0]) {
      examples.push({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `كم سعر ${product.name_ar}؟` },
          {
            role: "assistant",
            content: formatPriceResponse(product),
          },
        ],
      });
    }

    // Example 4: GPC classification
    if (product.gpc_segment) {
      examples.push({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `ما هو تصنيف ${product.name_ar}؟` },
          {
            role: "assistant",
            content: formatClassificationResponse(product),
          },
        ],
      });
    }
  }

  return examples;
}

/**
 * Generate training examples for supplier queries
 */
async function generateSupplierExamples(): Promise<TrainingExample[]> {
  console.log("Generating supplier training examples...");

  const { data: suppliers, error } = await supabase.from("suppliers").select("*").limit(100);

  if (error) {
    console.error("Error fetching suppliers:", error);
    return [];
  }

  const examples: TrainingExample[] = [];
  const tierLabels: Record<string, string> = {
    first_tier: "الدرجة الاولى",
    second_tier: "الدرجة الثانية",
    backup: "احتياطي",
    local: "محلي",
    imported: "مستورد",
    internal_workshop: "ورشة داخلية",
    factory: "مصنع",
    marketplace: "سوق الكتروني",
  };

  for (const supplier of suppliers || []) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `من هو المورد ${supplier.name}؟` },
        {
          role: "assistant",
          content: `**${supplier.name}**

- **التصنيف**: ${tierLabels[supplier.supplier_tier || ""] || "غير محدد"}
- **النوع**: ${supplier.supplier_type || "غير محدد"}
- **التقييم**: ${supplier.rating ? `${supplier.rating}/5` : "غير مقيّم"}
- **الحالة**: ${supplier.status === "active" ? "نشط" : "غير نشط"}

**معلومات التواصل:**
- جهة الاتصال: ${supplier.contact_name || "غير محدد"}
- الهاتف: ${supplier.phone || "غير متوفر"}
- البريد: ${supplier.email || "غير متوفر"}
- الموقع: ${supplier.website || "غير متوفر"}

**شروط التعامل:**
- شروط الدفع: ${supplier.payment_terms || "غير محددة"}
- مدة التوصيل: ${supplier.delivery_time || "غير محددة"}
- مناطق التغطية: ${supplier.coverage_areas?.join("، ") || "غير محددة"}

${supplier.notes ? `**ملاحظات**: ${supplier.notes}` : ""}`,
        },
      ],
    });
  }

  return examples;
}

/**
 * Generate general knowledge examples
 */
function generateGeneralExamples(): TrainingExample[] {
  console.log("Generating general knowledge examples...");

  return [
    // System overview
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "ما هو نظام Alazab PAOP؟" },
        {
          role: "assistant",
          content: `**Alazab PAOP** هو نظام متكامل لادارة كتالوج المنتجات والخدمات (Product Asset Operations Platform).

**الوظائف الرئيسية:**
1. **ادارة المنتجات**: تسجيل وتصنيف جميع انواع البنود (منتجات، خدمات، مواد، ادوات، قطع غيار)
2. **ادارة الاسعار**: تتبع الاسعار متعددة المستويات مع حفظ التاريخ
3. **ادارة الموردين**: تنظيم الموردين حسب الدرجة والتخصص
4. **الاصول الرقمية**: ادارة الصور والمستندات الفنية
5. **تكامل API**: توفير بيانات للانظمة الخارجية

**مميزات النظام:**
- تصنيف GPC/GS1 العالمي
- سجل تدقيق شامل لجميع التغييرات
- كشف التكرار الذكي
- تصدير البيانات المعتمدة فقط
- دعم كامل للغة العربية`,
        },
      ],
    },
    // Item types
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "ما هي انواع البنود في النظام؟" },
        {
          role: "assistant",
          content: `يدعم النظام 11 نوعا من البنود:

| النوع | الوصف |
|-------|-------|
| **product** | منتج جاهز للبيع |
| **service** | خدمة مقدمة |
| **work_item** | بند عمل (تركيب، صيانة) |
| **material** | مادة خام |
| **tool** | اداة او معدة |
| **spare_part** | قطعة غيار |
| **finish_item** | مادة تشطيب |
| **custom_unit** | وحدة مخصصة |
| **supplier_item** | بند مورد خارجي |
| **package** | حزمة منتجات |
| **bundle** | تجميعة متكاملة |

كل نوع له خصائص مشتركة (الاسم، الكود، التصنيف) وخصائص خاصة حسب طبيعته.`,
        },
      ],
    },
    // Status workflow
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "ما هي دورة حياة البند؟" },
        {
          role: "assistant",
          content: `تمر البنود بعدة حالات في دورة حياتها:

**1. draft (مسودة)**
البند تم انشاؤه ولم يكتمل بعد

**2. needs_review (يحتاج مراجعة)**
البند جاهز للمراجعة من المسؤول

**3. content_incomplete (محتوى ناقص)**
ينقص البند بعض البيانات الاساسية

**4. pricing_incomplete (تسعير ناقص)**
البند بدون اسعار معتمدة

**5. supplier_pending (بانتظار المورد)**
ينتظر تأكيد من المورد

**6. duplicate_suspected (مشتبه بالتكرار)**
قد يكون مكررا مع بند اخر

**7. approved (معتمد)**
البند جاهز للاستخدام والتصدير

**8. rejected (مرفوض)**
تم رفض البند لسبب ما

**9. exported (مصدّر)**
تم تصدير البند لنظام خارجي

**10. archived (مؤرشف)**
تم ارشفته (لا يُحذف نهائيا)`,
        },
      ],
    },
    // How to add product
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "كيف اضيف منتج جديد؟" },
        {
          role: "assistant",
          content: `لاضافة منتج جديد، اتبع الخطوات التالية:

**الخطوة 1: الدخول لصفحة المنتجات**
- من القائمة الجانبية، اختر "المنتجات"
- اضغط على زر "اضافة بند جديد"

**الخطوة 2: البيانات الاساسية**
- **الاسم العربي**: مطلوب
- **نوع البند**: اختر من القائمة (product, service, etc.)
- **الكود**: يتم توليده تلقائيا او ادخاله يدويا

**الخطوة 3: التصنيف**
- اختر القطاع (GPC Segment)
- اختر العائلة (GPC Family)
- اختر الفئة (GPC Class)
- (اختياري) ادخل كود GS1 Brick

**الخطوة 4: التفاصيل**
- الوصف العربي والانجليزي
- المحتوى التقني والتسويقي
- ملاحظات التركيب والصيانة

**الخطوة 5: التسعير والمورد**
- اختر المورد الافتراضي
- ادخل الاسعار المطلوبة

**الخطوة 6: الصور والمستندات**
- ارفق الصورة الرئيسية
- اضف صور المعرض والمستندات الفنية

**الخطوة 7: الحفظ**
- اضغط "حفظ كمسودة" للمراجعة لاحقا
- او "ارسال للاعتماد" اذا اكتملت البيانات`,
        },
      ],
    },
    // Pricing levels
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "ما هي مستويات التسعير؟" },
        {
          role: "assistant",
          content: `يدعم النظام مستويات متعددة من الاسعار:

**اسعار الشراء:**
- **purchase_price**: سعر الشراء من المورد

**اسعار البيع:**
- **selling_price**: سعر البيع الاساسي
- **retail_price**: سعر التجزئة للمستهلك
- **wholesale_price**: سعر الجملة للموزعين
- **project_price**: سعر المشاريع
- **client_price**: سعر خاص للعميل
- **reference_price**: السعر المرجعي

**التكاليف الاضافية:**
- **transport_cost**: تكلفة النقل
- **installation_cost**: تكلفة التركيب
- **maintenance_cost**: تكلفة الصيانة
- **operation_cost**: تكلفة التشغيل

**هامش الربح:**
- **margin_percent**: نسبة هامش الربح المحسوبة تلقائيا

كل سجل تسعير مرتبط بمورد محدد وله فترة صلاحية (valid_from, valid_to).`,
        },
      ],
    },
  ];
}

// Helper functions for formatting responses
function formatProductDetails(product: any): string {
  const statusLabels: Record<string, string> = {
    draft: "مسودة",
    needs_review: "يحتاج مراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
    archived: "مؤرشف",
  };

  const typeLabels: Record<string, string> = {
    product: "منتج",
    service: "خدمة",
    work_item: "بند عمل",
    material: "مادة",
    tool: "اداة",
    spare_part: "قطعة غيار",
    finish_item: "مادة تشطيب",
  };

  return `**${product.name_ar}** (${product.az_code})

**المعلومات الاساسية:**
- النوع: ${typeLabels[product.item_type] || product.item_type}
- الحالة: ${statusLabels[product.status] || product.status}
- مستوى الثقة: ${product.confidence_level || "غير محدد"}

${product.description_ar ? `**الوصف:**\n${product.description_ar}` : ""}

**التصنيف GPC:**
- القطاع: ${product.gpc_segment || "غير محدد"}
- العائلة: ${product.gpc_family || "غير محدد"}
- الفئة: ${product.gpc_class || "غير محدد"}

${product.suppliers ? `**المورد الافتراضي:** ${product.suppliers.name}` : ""}

${product.technical_content ? `**المحتوى التقني:**\n${product.technical_content}` : ""}`;
}

function formatPriceResponse(product: any): string {
  const price = product.prices?.[0];
  if (!price) return `لا تتوفر معلومات تسعير للبند ${product.name_ar}`;

  return `**تسعير ${product.name_ar}** (${product.az_code})

| نوع السعر | القيمة |
|-----------|--------|
| سعر الشراء | ${price.purchase_price ? `${price.purchase_price} ${price.currency || "SAR"}` : "غير محدد"} |
| سعر البيع | ${price.selling_price ? `${price.selling_price} ${price.currency || "SAR"}` : "غير محدد"} |
| سعر التجزئة | ${price.retail_price ? `${price.retail_price} ${price.currency || "SAR"}` : "غير محدد"} |

${product.suppliers ? `**المورد:** ${product.suppliers.name}` : ""}`;
}

function formatClassificationResponse(product: any): string {
  return `**تصنيف ${product.name_ar}** وفق معيار GPC/GS1:

- **القطاع (Segment):** ${product.gpc_segment || "غير محدد"}
- **العائلة (Family):** ${product.gpc_family || "غير محدد"}
- **الفئة (Class):** ${product.gpc_class || "غير محدد"}
- **الطوب (Brick):** ${product.gpc_brick_title || "غير محدد"}
${product.gs1_gpc_brick ? `- **كود GS1 Brick:** ${product.gs1_gpc_brick}` : ""}

هذا التصنيف يتبع المعيار العالمي GS1 GPC لتصنيف المنتجات.`;
}

/**
 * Write examples to JSONL file
 */
function writeToJsonl(examples: TrainingExample[], filename: string): void {
  const filepath = path.join(outputDir, filename);
  const content = examples.map((ex) => JSON.stringify(ex)).join("\n");
  fs.writeFileSync(filepath, content, "utf-8");
  console.log(`Written ${examples.length} examples to ${filename}`);
}

/**
 * Main function
 */
async function main() {
  console.log("========================================");
  console.log("  Alazab PAOP - Training Data Generator");
  console.log("========================================\n");

  try {
    // Generate all examples
    const productExamples = await generateProductExamples();
    const supplierExamples = await generateSupplierExamples();
    const generalExamples = generateGeneralExamples();

    // Combine all examples
    const allExamples = [...productExamples, ...supplierExamples, ...generalExamples];

    // Shuffle examples
    const shuffled = allExamples.sort(() => Math.random() - 0.5);

    // Split into training and validation (90/10)
    const splitIndex = Math.floor(shuffled.length * 0.9);
    const trainingData = shuffled.slice(0, splitIndex);
    const validationData = shuffled.slice(splitIndex);

    // Write to files
    writeToJsonl(trainingData, "training.jsonl");
    writeToJsonl(validationData, "validation.jsonl");

    console.log("\n========================================");
    console.log("  Generation Complete!");
    console.log("========================================");
    console.log(`Total examples: ${allExamples.length}`);
    console.log(`Training: ${trainingData.length}`);
    console.log(`Validation: ${validationData.length}`);
    console.log(`\nOutput directory: ${outputDir}`);
    console.log("\nNext step: Run 03-upload-training-data.ps1");
  } catch (error) {
    console.error("Error generating training data:", error);
    process.exit(1);
  }
}

main();
