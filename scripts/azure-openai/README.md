# Alazab PAOP - Azure OpenAI Custom Model Setup

## نظرة عامة
هذا الدليل يشرح كيفية انشاء نموذج AI مخصص لمنصة Alazab PAOP يكون متخصصا في:
- المنتجات والخدمات ومواد البناء
- الموردين والاسعار
- التصنيفات GPC/GS1
- العمليات التشغيلية

## المتطلبات الاساسية
1. Azure Subscription نشط
2. Azure CLI مثبت
3. PowerShell 7+
4. صلاحيات Contributor على Azure

## هيكل الملفات
```
scripts/azure-openai/
├── README.md                    # هذا الملف
├── 01-setup-resources.ps1       # انشاء الموارد على Azure
├── 02-generate-training-data.ts # توليد بيانات التدريب من Supabase
├── 03-upload-training-data.ps1  # رفع بيانات التدريب
├── 04-create-fine-tune.ps1      # انشاء نموذج Fine-tuned
├── 05-deploy-model.ps1          # نشر النموذج
├── system-prompt.md             # System Prompt للنموذج
└── training-examples/           # امثلة بيانات التدريب
    ├── products.jsonl
    ├── prices.jsonl
    └── suppliers.jsonl
```

## خطوات الانشاء

### الخطوة 1: اعداد الموارد
```powershell
./01-setup-resources.ps1 -SubscriptionId "YOUR_SUB_ID" -ResourceGroup "alazab-ai-rg" -Location "swedencentral"
```

### الخطوة 2: توليد بيانات التدريب
```bash
npx tsx 02-generate-training-data.ts
```

### الخطوة 3: رفع البيانات وانشاء Fine-tune
```powershell
./03-upload-training-data.ps1
./04-create-fine-tune.ps1
```

### الخطوة 4: نشر النموذج
```powershell
./05-deploy-model.ps1 -ModelName "alazab-paop-assistant"
```

## Environment Variables المطلوبة
```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=alazab-paop-assistant
AZURE_OPENAI_API_VERSION=2024-02-01
```

## الاستخدام في التطبيق
بعد النشر، يمكن استخدام النموذج عبر:
```typescript
import { AzureOpenAI } from "openai";

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
});
```
