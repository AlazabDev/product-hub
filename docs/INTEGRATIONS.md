# AzProud Integrations Guide

Complete guide for integrating AzProud with external systems. AzProud is the central hub for product data and communicates with multiple business systems.

---

## Overview

AzProud is not an isolated system. It's the **central command center** that communicates with all enterprise systems. This document explains how to connect AzProud with each system, what data is exchanged, and how to handle errors.

### Integration Architecture

```
┌─────────────────┐
│    AzProud      │ ← Central Product Hub
│   (Database)    │
└────────┬────────┘
         │
    ┌────┼────┬─────────┬──────────┐
    │    │    │         │          │
    v    v    v         v          v
  Daftra Bot  ERPNext  Storage  Azure
  (Accounting) Gateway         OpenAI
```

### Supported Integrations

| System | Priority | Status | Sync Direction | Data Type |
|--------|----------|--------|----------------|-----------|
| **Daftra** | High | Ready | Bidirectional | Products, Pricing, Invoices |
| **Bot Gateway** | High | Ready | Unidirectional → | Product Catalog, Availability |
| **ERPNext** | Medium | Planned | Bidirectional | Inventory, Manufacturing Orders |
| **Supabase** | High | Active | Bidirectional | All Data (Database) |
| **Azure OpenAI** | High | Active | Unidirectional → | Product Analysis |

---

## Daftra Integration

**Purpose:** Sync product catalog, pricing, and create invoices from orders.

### 1. Authentication Setup

```bash
# Get Daftra API credentials
# 1. Log in to Daftra Dashboard
# 2. Settings → API Keys
# 3. Generate new API key
# 4. Copy: API_ID and API_KEY

# Store in AzProud
DAFTRA_API_ID=your-api-id
DAFTRA_API_KEY=your-api-key
DAFTRA_DOMAIN=your-domain.daftra.com
```

### 2. Configuration

Create integration record in AzProud:

```javascript
// POST /api/integrations
{
  "type": "daftra",
  "status": "active",
  "config": {
    "api_id": "DAFTRA_API_ID",
    "api_key": "DAFTRA_API_KEY",
    "domain": "DAFTRA_DOMAIN",
    "sync_frequency": "every 6 hours",
    "sync_on_save": true
  }
}
```

### 3. Data Sync - Products

**Direction:** AzProud → Daftra (One-way)

**Sync Frequency:** Every 6 hours + on-save

**Synced Fields:**

| AzProud | → | Daftra |
|---------|---|--------|
| name_ar | → | Item Name (AR) |
| name_en | → | Item Name (EN) |
| az_code | → | SKU |
| gpc_family | → | Category |
| description_ar | → | Description |
| status | → | Status (if approved) |

**Sync Logic:**

```javascript
// Check if product exists in Daftra
GET /api/items?sku=${product.az_code}

if (exists) {
  // Update existing
  PATCH /api/items/${daftra_id} { ...updates }
} else {
  // Create new
  POST /api/items { ...new_product }
}
```

**Example Request:**

```bash
curl -X POST https://your-domain.daftra.com/api/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DAFTRA_TOKEN" \
  -d '{
    "name": "منتج تجريبي",
    "sku": "AZ-001",
    "category_id": 123,
    "description": "وصف المنتج",
    "unit": "piece",
    "quantity": 100,
    "cost": 50,
    "selling_price": 75
  }'
```

### 4. Data Sync - Pricing

**Direction:** AzProud → Daftra

**Synced Fields:**

| AzProud | → | Daftra |
|---------|---|--------|
| pricing_rules | → | Item Price List |
| supplier_id | → | Vendor |
| price | → | Unit Price |

**Sync Logic:**

```javascript
// When pricing rule updated
PATCH /api/items/${daftra_id}/prices {
  "supplier_id": supplier.daftra_id,
  "unit_price": rule.price,
  "min_quantity": rule.min_quantity
}
```

### 5. Invoice Creation from Requests

**Direction:** AzProud → Daftra

When a product request is approved and converted:

```javascript
// Create invoice in Daftra
POST /api/invoices {
  "customer_id": request.customer_id,
  "items": [
    {
      "item_id": product.daftra_id,
      "quantity": request.quantity,
      "unit_price": product.current_price
    }
  ],
  "notes": "From AzProud Request ID: " + request.id
}
```

### 6. Error Handling

**Connection Error:**
```javascript
if (daftra_error) {
  // Log error
  log_to_audit_logs("Daftra sync failed", error);
  
  // Queue for retry
  queue_retry(product_id, "daftra_sync", Date.now() + 3600000);
  
  // Notify admin
  send_notification("Daftra integration issue", error);
  
  // Continue with local operation
  return { success: true, warning: "Daftra sync pending" };
}
```

**Data Mismatch:**
```javascript
// If data conflicts between systems
if (local_version > daftra_version) {
  // Send to Daftra
  sync_to_daftra(product);
} else {
  // Notify admin of discrepancy
  flag_for_manual_review(product);
}
```

### 7. Testing

```bash
# Test connection
curl -X GET https://your-domain.daftra.com/api/settings \
  -H "Authorization: Bearer DAFTRA_TOKEN"

# Test product sync
bun run test:daftra-sync

# Monitor sync queue
SELECT * FROM integration_logs 
WHERE integration_type = 'daftra' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Bot Gateway Integration

**Purpose:** Provide product catalog and real-time data to chatbots (Rasa, UberFix, AzaBot).

### 1. API Endpoint Setup

AzProud exposes a dedicated API for bots:

```
GET /api/bot-gateway/products
GET /api/bot-gateway/search
GET /api/bot-gateway/product/:id
GET /api/bot-gateway/availability
```

### 2. Authentication

Bots authenticate using API keys (from `api_consumers` table):

```javascript
// Bot Gateway request header
Authorization: Bearer BOT_API_KEY_HERE
X-Bot-ID: bot-name
X-Request-ID: unique-request-id
```

### 3. Product Listing Endpoint

**Endpoint:** `GET /api/bot-gateway/products`

**Query Parameters:**

```bash
?status=approved
&limit=100
&offset=0
&format=json  # json, xml
```

**Response:**

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "code": "AZ-001",
      "name_ar": "منتج تجريبي",
      "name_en": "Test Product",
      "description": "Product description",
      "category": "Electronics",
      "price": 100.00,
      "currency": "SAR",
      "availability": "in_stock",
      "quantity_available": 50,
      "image_url": "https://storage.azproud.com/...",
      "specifications": {
        "color": "Black",
        "size": "Large"
      }
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 100,
    "offset": 0
  }
}
```

### 4. Search Endpoint

**Endpoint:** `GET /api/bot-gateway/search`

**Query Parameters:**

```bash
?q=laptop          # Search term (Arabic/English)
&type=product      # Filter by type
&limit=20
```

**Response:**

```json
{
  "status": "success",
  "query": "laptop",
  "results": [
    { "id": "...", "name_en": "Dell Laptop", "score": 0.98 },
    { "id": "...", "name_en": "HP Laptop", "score": 0.95 }
  ],
  "execution_time_ms": 45
}
```

### 5. Product Details Endpoint

**Endpoint:** `GET /api/bot-gateway/product/:id`

**Response:**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "name_ar": "منتج",
    "name_en": "Product",
    "category": "Electronics",
    "price": 100.00,
    "suppliers": [
      {
        "name": "Supplier A",
        "tier": "first_tier",
        "price": 95.00,
        "stock": 50
      }
    ],
    "specs": {},
    "image": "url",
    "related_products": [
      { "id": "...", "name": "..." }
    ]
  }
}
```

### 6. Real-Time Availability

**Endpoint:** `GET /api/bot-gateway/availability`

```bash
?product_id=uuid
&supplier_id=uuid
```

**Response:**

```json
{
  "status": "success",
  "product": "AZ-001",
  "availability": {
    "in_stock": true,
    "quantity": 50,
    "last_updated": "2026-05-22T10:30:00Z"
  },
  "next_restock": "2026-05-30T00:00:00Z"
}
```

### 7. Rate Limiting

Bot requests are rate-limited to prevent abuse:

```
Rate Limit: 1000 requests per minute per API key
Burst Limit: 50 requests per second
```

**Rate Limit Headers:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1653217920
```

### 8. Caching Strategy

Products cached for 5 minutes to reduce database load:

```javascript
// Cache invalidated when:
// - Product created/updated
// - Status changed
// - Price updated
// - Stock changed
```

### 9. Error Handling

```json
{
  "status": "error",
  "error_code": "PRODUCT_NOT_FOUND",
  "message": "Product with ID not found",
  "request_id": "req-uuid",
  "timestamp": "2026-05-22T10:30:00Z"
}
```

### 10. Bot Integration Examples

**Rasa NLU Intent:**

```yaml
- intent: search_product
  examples: |
    - Find [product_name]
    - Show me [product_name]
    - Do you have [product_name]
```

**Rasa Action:**

```python
async def run(self, dispatcher, tracker, domain):
    product_name = tracker.get_slot("product_name")
    
    # Query AzProud API
    response = requests.get(
        f"https://azproud.alazab.com/api/bot-gateway/search",
        params={"q": product_name},
        headers={"Authorization": f"Bearer {BOT_API_KEY}"}
    )
    
    products = response.json()["results"]
    
    if products:
        message = f"Found {len(products)} products matching '{product_name}'"
        dispatcher.utter_message(text=message)
    else:
        dispatcher.utter_message(text="No products found")
```

**UberFix Bot:**

```javascript
// In UberFix bot flow
const getProduct = async (productName) => {
  const response = await fetch(
    `https://azproud.alazab.com/api/bot-gateway/search?q=${productName}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.AZPROUD_BOT_KEY}`
      }
    }
  );
  
  return response.json();
};
```

---

## ERPNext Integration

**Status:** Planned for Phase 2

**Scope:** Inventory sync, Manufacturing orders, Supply chain

**Data Flow:**

```
AzProud ←→ ERPNext
  Products ←→ Items
  Suppliers ←→ Vendors
  Stock Levels ↔ Inventory
  Pricing ←→ Item Prices
```

**Implementation Plan:**

1. Q3 2026: Authentication setup
2. Q3 2026: Product/Inventory sync
3. Q4 2026: Manufacturing orders
4. Q4 2026: Supply chain optimization

---

## Testing Integrations

### Integration Test Suite

```bash
# Test all integrations
bun run test:integrations

# Test specific integration
bun run test:integration:daftra
bun run test:integration:bot-gateway
```

### Manual Testing

```bash
# Test Daftra sync
# 1. Create product in AzProud
# 2. Wait 1 minute
# 3. Check Daftra for new item
# 4. Update price in AzProud
# 5. Verify price updated in Daftra

# Test Bot Gateway
# 1. Query bot API: /api/bot-gateway/products
# 2. Verify pagination works
# 3. Test search: /api/bot-gateway/search?q=test
# 4. Test availability endpoint
```

### Monitoring

```sql
-- Check integration health
SELECT 
  integration_type,
  status,
  last_sync,
  error_count,
  last_error
FROM integrations
ORDER BY last_sync DESC;

-- View integration logs
SELECT * FROM integration_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Daftra Connection Issues

**Problem:** "Connection Refused"

**Solution:**
1. Verify API credentials are correct
2. Check Daftra server is online: `https://your-domain.daftra.com/api/settings`
3. Check firewall allows outbound HTTPS

**Problem:** "Items not syncing"

**Solution:**
1. Check sync status: `SELECT * FROM integrations WHERE type='daftra'`
2. Review error logs: `SELECT * FROM integration_logs WHERE integration_type='daftra' AND status='error'`
3. Manually trigger sync: `POST /api/integrations/daftra/sync`

### Bot Gateway Issues

**Problem:** "API Key Invalid"

**Solution:**
1. Verify API key in `api_consumers` table
2. Check key hasn't expired
3. Generate new key if needed

**Problem:** "Slow Search Response"

**Solution:**
1. Check database indexes on products table
2. Review search query performance: `EXPLAIN ANALYZE SELECT ...`
3. Increase cache TTL if acceptable

---

## Monitoring Dashboard

**Available at:** `/admin/integrations`

Shows:
- Integration health status
- Sync success/failure rates
- Data reconciliation status
- Error logs and alerts
- Performance metrics

---

**Last Updated:** May 2026  
**Next Review:** Q3 2026
