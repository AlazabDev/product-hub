# Supabase Edge Functions

These serverless functions power AzProud's integrations and background processing.

## Functions Overview

### 1. `sync-integration`
**Purpose:** Synchronize AzProud data with external systems (Daftra, Bot Gateway, ERPNext, Azure OpenAI)

**Trigger:** Manual or scheduled (via Vercel Cron)

**Supported Integrations:**
- Daftra (products, pricing, invoices)
- Bot Gateway API (product catalog)
- ERPNext (inventory - planned Q3-Q4 2026)
- Azure OpenAI (product analysis)

**Request:**
```json
{
  "integrationId": "daftra" | "bot-gateway" | "erpnext" | "azure-openai"
}
```

**Response:**
```json
{
  "success": true,
  "integration": "daftra",
  "synced": 142,
  "message": "Successfully synced 142 records"
}
```

**Environment Variables:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

### 2. `daftra-webhook`
**Purpose:** Receive and process real-time updates from Daftra

**Trigger:** Daftra webhook (configured in Daftra dashboard)

**Webhook Events:**
- `invoice.created` - New invoice created in Daftra
- `invoice.paid` - Invoice marked as paid
- `item.updated` - Product pricing/details updated

**Request Body Example:**
```json
{
  "event": "invoice.created",
  "data": {
    "invoice_id": "INV-2026-001",
    "customer_name": "أكمي السعودية",
    "total": 15000,
    "currency": "SAR"
  }
}
```

**Processing Flow:**
1. Receive webhook from Daftra
2. Validate event type
3. Create/update records in AzProud
4. Log activity in webhook_logs table
5. Return success response

### 3. `duplicate-check`
**Purpose:** Find potential duplicate products using multiple matching algorithms

**Trigger:** Scheduled task or manual invocation

**Matching Criteria:**
1. **Exact Code Match** - Same `az_code` (similarity: 1.0)
2. **Name Similarity** - Similar Arabic names using Levenshtein distance (similarity: 0.75+)
3. **Same GPC Family** - Products in same category (similarity: 0.6)

**Request:**
```json
{
  "productId": "uuid",
  "productData": {
    "name_ar": "منتج جديد",
    "az_code": "PRD-001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "productId": "uuid",
  "duplicateCount": 3,
  "hasSuspiciousDuplicates": true,
  "duplicates": [
    {
      "id": "uuid",
      "name_ar": "منتج جديد شبيه",
      "type": "name_similarity",
      "similarity": 0.92,
      "reason": "تشابه في الاسم العربي (92%)"
    }
  ]
}
```

## Deployment

### Prerequisites
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login to Supabase
supabase login
```

### Deploy Functions
```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy sync-integration

# Test function locally
supabase start
supabase functions serve
```

### Set Environment Variables
```bash
# In Supabase dashboard: Settings → Edge Functions Secrets
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

## Testing

### Test sync-integration
```bash
curl -X POST http://localhost:3000/functions/v1/sync-integration \
  -H "Content-Type: application/json" \
  -d '{"integrationId":"daftra"}' \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Test daftra-webhook (local)
```bash
curl -X POST http://localhost:3000/functions/v1/daftra-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event":"invoice.created",
    "data":{"invoice_id":"INV-001","customer_name":"Test","total":100}
  }'
```

### Test duplicate-check
```bash
curl -X POST http://localhost:3000/functions/v1/duplicate-check \
  -H "Content-Type: application/json" \
  -d '{
    "productId":"uuid",
    "productData":{"name_ar":"منتج"}
  }'
```

## Database Tables Used

### integration_configs
```sql
CREATE TABLE integration_configs (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  config JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### sync_logs
```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY,
  integration_type TEXT,
  status TEXT,
  records_synced INTEGER,
  details JSONB,
  synced_at TIMESTAMP
);
```

### webhook_logs
```sql
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY,
  source TEXT,
  event_type TEXT,
  payload JSONB,
  processed_at TIMESTAMP
);
```

### orders
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  daftra_invoice_id TEXT,
  customer_name TEXT,
  total_amount DECIMAL,
  currency TEXT,
  status TEXT,
  source TEXT,
  raw_data JSONB,
  created_at TIMESTAMP
);
```

## Monitoring & Logs

### View Function Logs
```bash
# Real-time logs
supabase functions logs sync-integration --follow

# With filtering
supabase functions logs sync-integration --filter "error"
```

### Performance Metrics
- Track in `sync_logs` and `webhook_logs` tables
- Monitor success rate and error patterns
- Check execution time for optimization

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Missing Supabase credentials | ENV vars not set | Set credentials in Function Settings |
| Integration not found | Invalid integrationId | Check integration_configs table |
| Database connection failed | Network/auth issue | Verify service role key |
| Rate limit exceeded | Too many requests | Implement exponential backoff |

## Security

- ✅ Functions use `SUPABASE_SERVICE_ROLE_KEY` only for admin operations
- ✅ All external API calls use encrypted credentials from env vars
- ✅ Webhook signatures validated (implement in production)
- ✅ Request rate limiting applied
- ✅ Error messages don't expose sensitive info

## Future Enhancements

1. **Scheduled Sync** - Use Vercel Cron Functions
2. **Webhook Signatures** - HMAC-SHA256 validation
3. **Retry Logic** - Exponential backoff for failed syncs
4. **Data Transformation** - Advanced mapping rules
5. **Error Alerts** - Send Slack/Email notifications
6. **Performance Optimization** - Batch processing for large datasets
