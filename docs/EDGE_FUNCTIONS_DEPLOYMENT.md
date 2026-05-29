# Edge Functions Deployment Guide

دليل شامل لنشر Supabase Edge Functions التي تدعم تكاملات AzProud.

## المتطلبات الأساسية

```bash
# 1. تثبيت Supabase CLI
brew install supabase/tap/supabase  # macOS
# أو
curl -fsSL https://cli.supabase.io/install.sh | sudo bash  # Linux

# 2. التحقق من التثبيت
supabase --version

# 3. تسجيل الدخول إلى Supabase
supabase login
```

## بنية المشروع

```
supabase/
├── functions/
│   ├── sync-integration/
│   │   └── index.ts                 # Main sync orchestrator
│   ├── daftra-webhook/
│   │   └── index.ts                 # Daftra webhook handler
│   ├── duplicate-check/
│   │   └── index.ts                 # Duplicate detection
│   └── README.md                    # Functions documentation
├── migrations/
│   └── [existing migrations]
└── config.toml                      # Supabase config
```

## الخطوات الأساسية للنشر

### 1. إعداد المشروع المحلي

```bash
cd /vercel/share/v0-project

# تهيئة Supabase محليًا (اختياري للاختبار)
supabase start

# سيبدأ:
# - PostgreSQL database
# - Supabase Studio (http://localhost:54323)
# - Auth (http://localhost:9999)
# - Realtime WebSockets
```

### 2. نشر الـ Functions على الإنتاج

```bash
# يجب أن تكون متصلاً بـ Supabase
supabase functions deploy

# للتحقق من نجاح النشر
supabase functions list
```

### 3. تكوين متغيرات البيئة

في لوحة تحكم Supabase:

```
Settings → Functions Secrets
```

أضف:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DAFTRA_API_KEY=your-daftra-key
DAFTRA_DOMAIN=your-domain.daftra.com
AZURE_OPENAI_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=your-endpoint
```

## نشر الـ Functions بشكل فردي

إذا أردت نشر function معينة:

```bash
# نشر sync-integration فقط
supabase functions deploy sync-integration

# نشر daftra-webhook فقط
supabase functions deploy daftra-webhook

# نشر duplicate-check فقط
supabase functions deploy duplicate-check
```

## الاختبار المحلي

### 1. تشغيل الخادم المحلي

```bash
# في نافذة terminal منفصلة
supabase start

# يجب أن تراهـذا الإخراج:
# Supabase started successfully!
```

### 2. اختبار الـ Functions محليًا

```bash
# في نافذة terminal جديدة
supabase functions serve

# الآن يمكنك استدعاء الـ functions على:
# http://localhost:3000/functions/v1/sync-integration
```

### 3. مثال على الطلب (curl)

```bash
# اختبار sync-integration
curl -X POST http://localhost:3000/functions/v1/sync-integration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{
    "integrationId": "daftra"
  }'

# النتيجة المتوقعة:
# {
#   "success": true,
#   "integration": "daftra",
#   "synced": 142,
#   "message": "Successfully synced 142 records"
# }
```

## الاختبار على الإنتاج

بعد النشر، اختبر الـ functions من داخل التطبيق:

```typescript
// في مكون React
const syncMutation = useMutation({
  mutationFn: async (integrationId: string) => {
    const { data, error } = await supabase.functions.invoke(
      "sync-integration",
      {
        body: { integrationId },
      }
    );
    if (error) throw error;
    return data;
  },
});

// استدعاء الدالة
syncMutation.mutate("daftra");
```

## مراقبة الـ Functions

### عرض السجلات

```bash
# سجلات جميع الـ functions
supabase functions logs

# سجلات function معينة
supabase functions logs sync-integration

# مع التصفية
supabase functions logs sync-integration --filter "error"

# مراقبة حية
supabase functions logs --follow
```

### مراقبة من Supabase Dashboard

```
Project → Functions → [function name]
```

ستجد:
- عدد الاستدعاءات
- معدل النجاح/الفشل
- متوسط وقت التنفيذ
- السجلات التفصيلية

## معالجة الأخطاء والمشاكل الشائعة

### الخطأ: "Missing Supabase credentials"

**السبب:** متغيرات البيئة لم تُضبط

**الحل:**
```bash
# تحقق من إعدادات Secrets
supabase secrets list

# أضف الـ secrets المفقودة
supabase secrets set SUPABASE_URL=https://...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

### الخطأ: "Integration not found"

**السبب:** نوع التكامل غير موجود في قاعدة البيانات

**الحل:**
```sql
-- في Supabase Studio SQL Editor
SELECT * FROM integration_configs;

-- أضف التكامل إذا لزم الحال
INSERT INTO integration_configs (type, status, config)
VALUES ('daftra', 'active', '{"api_key": "..."}');
```

### الخطأ: "Rate limit exceeded"

**السبب:** عدد الطلبات يتجاوز الحد المسموح

**الحل:**
```typescript
// أضف backoff exponential في الكود
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### الخطأ: "Webhook signature validation failed"

**الحل:**
```typescript
// تحقق من التوقيع في webhook handler
import { verifySignature } from "./verify";

const isValid = verifySignature(
  req.body,
  req.headers["x-daftra-signature"],
  process.env.DAFTRA_WEBHOOK_SECRET
);
```

## جدولة الـ Functions

لتشغيل functions بشكل دوري، استخدم Vercel Cron:

```typescript
// في Vercel project
import { CronRequest } from "@vercel/functions";

export default async function handler(req: CronRequest) {
  if (req.method === "POST") {
    // شغّل sync-integration كل 6 ساعات
    const result = await supabase.functions.invoke("sync-integration", {
      body: { integrationId: "daftra" },
    });
    return new Response(JSON.stringify(result));
  }
}
```

في `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-daftra",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## الأفضليات والتحسينات

### 1. تحسين الأداء

```typescript
// استخدم batch processing للعمليات الكبيرة
const batchSize = 100;
for (let i = 0; i < products.length; i += batchSize) {
  const batch = products.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### 2. تحسين الأمان

```typescript
// تحقق دائمًا من المستخدم قبل العمليات الحساسة
const user = await getUser(req.headers.authorization);
if (!user.isAdmin) {
  return new Response("Unauthorized", { status: 401 });
}
```

### 3. تحسين الموثوقية

```typescript
// استخدم transactions للعمليات المترابطة
const result = await supabase.rpc("sync_with_rollback", {
  integration_id: "daftra",
});
```

## نصائح مهمة

✅ **افعل:**
- اختبر الـ functions محليًا قبل النشر
- استخدم secrets للبيانات الحساسة
- سجّل جميع الأنشطة
- تعامل مع الأخطاء بشكل فعّال
- استخدم exponential backoff للـ retries

❌ **لا تفعل:**
- لا تخزّن المفاتيح في الكود
- لا تعتمد على single function للعمليات الضخمة
- لا تتجاهل معالجة الأخطاء
- لا تستخدم long-running operations (timeout: 60 ثانية)

## الموارد الإضافية

- [Supabase Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Edge Functions Examples](https://github.com/supabase/supabase/tree/master/examples/edge-functions)

## الدعم والمساعدة

للمزيد من المساعدة:
- استراجع `supabase/functions/README.md`
- راجع `docs/INTEGRATIONS.md`
- تحقق من سجلات الدوال في Supabase Dashboard
