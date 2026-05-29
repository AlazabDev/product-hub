# Pre-Production Checklist - AzProud

**Critical verification document before deploying to production environment**

**Document Purpose:** Ensure system stability, security, performance, and data integrity before launch.

**Last Verification:** _____  
**Verified By:** _____  
**Sign-off Date:** _____  

---

## 1. Data Integrity & Quality Checks

### 1.1 Database Structure Validation

**Objective:** Verify all tables have proper primary/foreign keys and constraints.

| Check | Status | Method | Result | Notes |
|-------|--------|--------|--------|-------|
| Primary keys exist on all tables | [ ] | `SELECT * FROM information_schema.table_constraints WHERE constraint_type='PRIMARY KEY'` | | |
| Foreign key relationships valid | [ ] | Check RLS policies and constraint definitions | | |
| No orphaned records | [ ] | `SELECT * FROM products WHERE supplier_id NOT IN (SELECT id FROM suppliers)` | | |
| All columns have appropriate types | [ ] | Review schema in Supabase Dashboard | | |
| Default values set correctly | [ ] | `\d products` in psql | | |
| Constraints enforced | [ ] | Test unique violations | | |

**Pass/Fail:** ___

### 1.2 Data Duplication Check

**Objective:** Ensure no duplicate products or suppliers exist.

```sql
-- Check for duplicate products
SELECT name_ar, name_en, COUNT(*) as count 
FROM products 
GROUP BY name_ar, name_en 
HAVING COUNT(*) > 1;

-- Check for duplicate suppliers
SELECT name_ar, COUNT(*) as count 
FROM suppliers 
GROUP BY name_ar 
HAVING COUNT(*) > 1;

-- Check for duplicate codes
SELECT az_code, COUNT(*) as count 
FROM products 
GROUP BY az_code 
HAVING COUNT(*) > 1;
```

**Expected Result:** All counts = 0

**Actual Result:** _____

**Action if Failed:** Remove duplicates using merge script

**Pass/Fail:** ___

### 1.3 Data Completeness

**Objective:** Verify critical fields are populated.

| Table | Critical Fields | Coverage % | Pass? |
|-------|-----------------|-----------|-------|
| products | name_ar, name_en, az_code, item_type, status | ≥ 95% | [ ] |
| suppliers | name_ar, name_en, supplier_code, tier | ≥ 98% | [ ] |
| product_requests | product_name_ar, status, created_by | ≥ 100% | [ ] |
| pricing_rules | product_id, supplier_id, price | ≥ 90% | [ ] |

**Overall Pass/Fail:** ___

### 1.4 Asset Integrity

**Objective:** Verify all images and documents are accessible.

```bash
# Check for broken links
for url in $(psql -c "SELECT url FROM assets;"); do
  curl -I "$url" | grep "200\|301\|302" || echo "BROKEN: $url"
done

# Check file sizes
SELECT 
  file_path, 
  size_bytes,
  CASE 
    WHEN size_bytes > 5242880 THEN 'TOO_LARGE'
    WHEN size_bytes < 1024 THEN 'TOO_SMALL'
    ELSE 'OK'
  END as status
FROM assets;
```

**Broken Links Found:** _____

**Oversized Files:** _____

**Pass/Fail:** ___

### 1.5 Backup Verification

**Objective:** Confirm automated backups are working.

| Backup Type | Last Backup | Size | Accessible | Pass? |
|-------------|------------|------|------------|-------|
| Daily DB Backup | | | [ ] | [ ] |
| Weekly Full Backup | | | [ ] | [ ] |
| Test Restore | | | [ ] | [ ] |

**Procedure to Test Restore:**
```bash
# Download latest backup
supabase db pull

# Test data integrity
bun run test:data-integrity
```

**Pass/Fail:** ___

---

## 2. AI & Intelligence System Checks

### 2.1 AI Model Performance

**Objective:** Verify Azure OpenAI integration accuracy.

```bash
# Test 100 random products for classification accuracy
bun run test:ai-classification --samples 100

# Expected: ≥ 85% accuracy
```

**Sample Size:** 100  
**Correct Classifications:** _____/100  
**Accuracy:** _____%  
**Threshold:** ≥ 85%  

**Pass/Fail:** ___

### 2.2 AI Response Time

**Objective:** Ensure AI responses within SLA.

```bash
# Benchmark AI response times
bun run bench:ai-response --iterations 50

# Expected: 90th percentile < 5 seconds, 99th percentile < 10 seconds
```

**Median Response Time:** _____ ms  
**95th Percentile:** _____ ms  
**99th Percentile:** _____ ms  
**Max Response Time:** _____ ms  

**Pass/Fail:** ___

### 2.3 AI Quota Management

**Objective:** Verify monthly quota limits won't be exceeded.

```bash
# Check current usage
az cognitiveservices account deployment usage list \
  --resource-group rg-azproud \
  --name azure-openai-azproud

# Estimate monthly usage
# Average requests per user: _____
# Expected users: _____
# Monthly estimate: _____ calls
# Available quota: _____ calls
```

**Current Monthly Usage:** _____ calls  
**Estimated Peak Usage:** _____ calls  
**Available Quota:** _____ calls  
**Headroom:** ____% remaining  

**Pass/Fail:** ___

### 2.4 Error Handling

**Objective:** Verify graceful fallback when AI unavailable.

**Test Procedure:**
1. Disable Azure OpenAI API key temporarily
2. Attempt to create product with AI assistance
3. Verify error message shown to user
4. Re-enable API key

**Result:** [ ] User sees helpful error message  
**Result:** [ ] System continues to function without AI  

**Pass/Fail:** ___

---

## 3. Security Validation

### 3.1 API Key Management

**Objective:** Ensure no sensitive keys in codebase.

```bash
# Scan codebase for hardcoded keys
grep -r "SUPABASE_KEY\|AZURE_OPENAI\|API_KEY" src/ --include="*.ts" --include="*.tsx" || echo "No keys found"

# Check .env files not in git
git ls-files | grep ".env" || echo ".env files properly ignored"

# Verify environment variables only in .env files
git log --all -S "supabase.co" -- src/ || echo "No DB URLs in code"
```

**Hardcoded Keys Found:** _____  
**Action if Found:** Remove immediately, rotate keys  

**Pass/Fail:** ___

### 3.2 Authentication & Authorization

**Objective:** Verify user access control.

```bash
# Test unauthenticated access
curl https://azproud.alazab.com/dashboard 
# Expected: 302 redirect to /login

# Test invalid token
curl -H "Authorization: Bearer invalid-token" \
  https://azproud.alazab.com/api/products
# Expected: 401 Unauthorized

# Test cross-user data access
# User A: Create product P1
# User B: Attempt to view/edit P1
# Expected: 403 Forbidden
```

**Unauthenticated Access Blocked:** [ ]  
**Invalid Token Rejected:** [ ]  
**Cross-user Access Denied:** [ ]  

**Pass/Fail:** ___

### 3.3 CORS & Domain Security

**Objective:** Verify only authorized domains can access API.

```bash
# Test CORS from different origins
curl -H "Origin: https://malicious.com" \
  -H "Access-Control-Request-Method: POST" \
  https://azproud.alazab.com/api/products \
  -v | grep "Access-Control"
# Expected: No CORS header or explicit denial

# Test from authorized domain
curl -H "Origin: https://azproud.alazab.com" \
  -H "Access-Control-Request-Method: GET" \
  https://azproud.alazab.com/api/products
# Expected: Access-Control-Allow-Origin header present
```

**Unauthorized Domains Blocked:** [ ]  
**Authorized Domain Allowed:** [ ]  

**Pass/Fail:** ___

### 3.4 Rate Limiting

**Objective:** Verify rate limits prevent abuse.

```bash
# Send 120 requests in 60 seconds (exceeds 100/min limit)
for i in {1..120}; do
  curl https://azproud.alazab.com/api/products \
    -H "Authorization: Bearer TOKEN" &
done
wait

# Expected: Requests 101-120 return 429 Too Many Requests
```

**Rate Limiting Enforced:** [ ]  
**429 Status Returned:** [ ]  
**Rate Limit Headers Present:** [ ]  

**Pass/Fail:** ___

### 3.5 SQL Injection Prevention

**Objective:** Verify parameterized queries used.

```bash
# Test SQL injection attempt
curl -X POST https://azproud.alazab.com/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name_ar": "'; DROP TABLE products; --",
    "name_en": "Injection Test"
  }'

# Expected: Input validation error, NOT database error
```

**Injection Attempt Blocked:** [ ]  
**Validation Error Shown:** [ ]  
**No SQL Error Exposed:** [ ]  

**Pass/Fail:** ___

### 3.6 HTTPS & SSL/TLS

**Objective:** Verify secure connections only.

```bash
# Check SSL/TLS configuration
openssl s_client -connect azproud.alazab.com:443

# Test SSL grade
# https://www.ssllabs.com/ssltest/analyze.html?d=azproud.alazab.com

# Verify HSTS header
curl -I https://azproud.alazab.com | grep "Strict-Transport-Security"
# Expected: max-age=31536000
```

**SSL Certificate Valid:** [ ]  
**TLS 1.2+:** [ ]  
**HSTS Enabled:** [ ]  
**Grade A or higher:** [ ]  

**Pass/Fail:** ___

---

## 4. Performance & Scalability

### 4.1 Page Load Times

**Objective:** Verify pages load within SLAs.

```bash
# Run Lighthouse audit
npm run lighthouse

# Expected results:
# Dashboard: First Contentful Paint < 2s
# Product List: First Contentful Paint < 1.5s
# Search Results: < 500ms response
```

| Page | Target | Actual | Pass? |
|------|--------|--------|-------|
| Dashboard | < 2s | _____ | [ ] |
| Products List | < 1.5s | _____ | [ ] |
| Search Results | < 500ms | _____ | [ ] |
| Product Details | < 1.5s | _____ | [ ] |

**Overall Pass/Fail:** ___

### 4.2 Database Performance

**Objective:** Verify database queries are optimized.

```sql
-- Check for slow queries
SELECT query, calls, mean_exec_time 
FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC;

-- Analyze major queries
EXPLAIN ANALYZE 
SELECT * FROM products 
WHERE status = 'approved' 
LIMIT 100;
-- Expected: < 100ms
```

**Slow Queries:** _____  
**Total Queries > 100ms:** _____  
**Product List Query Time:** _____ ms  

**Action if Slow:** Add indexes to filter columns  

**Pass/Fail:** ___

### 4.3 Concurrent User Load Testing

**Objective:** Verify system handles peak load.

```bash
# Load test with 50 concurrent users, 30 second duration
k6 run tests/load-test.js \
  --vus 50 \
  --duration 30s

# Expected:
# Response time 95th percentile: < 500ms
# Error rate: < 1%
# Throughput: > 100 requests/sec
```

**Concurrent Users:** 50  
**Duration:** 30s  
**Total Requests:** _____  
**Successful:** _____  
**Failed:** _____  
**Error Rate:** _____%  
**p95 Response Time:** _____ ms  
**Throughput:** _____ req/sec  

**Pass/Fail:** ___

### 4.4 Database Connection Pooling

**Objective:** Verify connection pool settings optimized.

```sql
-- Check current connections
SELECT count(*) as total_connections
FROM pg_stat_activity;

-- Check pool settings
SHOW max_connections;
-- Expected: At least 20 for application, rest reserved

-- Verify no connection leaks
SELECT datname, usename, count(*) 
FROM pg_stat_activity 
GROUP BY datname, usename;
-- Expected: No single application has > 10 idle connections
```

**Max Connections Configured:** _____  
**Idle Connections:** _____  
**Active Connections:** _____  

**Pass/Fail:** ___

### 4.5 Image Optimization

**Objective:** Verify images compressed and served efficiently.

```bash
# Check image sizes
du -sh public/images/
# Expected: < 100MB total

# Check individual image sizes
for img in public/images/*.{jpg,png,webp}; do
  size=$(stat -c%s "$img")
  if [ $size -gt 500000 ]; then  # > 500KB
    echo "LARGE: $img - $size bytes"
  fi
done

# Check WebP format used
file public/images/* | grep -i webp || echo "No WebP found - consider conversion"
```

**Total Image Size:** _____  
**Images > 500KB:** _____  
**WebP Format:** [ ]  
**CDN Caching:** [ ]  

**Pass/Fail:** ___

---

## 5. Integration Testing

### 5.1 Data Import/Export

**Objective:** Verify data can be safely imported/exported.

```bash
# Test bulk import
# 1. Prepare 100 test products in CSV
# 2. Upload via Products → Bulk Import
# 3. Verify all imported correctly
# 4. Check audit log entries created

# Test export
# 1. Export all products to CSV
# 2. Verify format correct
# 3. Count matches database
```

**Import Success:** [ ]  
**Records Imported:** _____  
**Data Integrity:** [ ]  
**Export Completeness:** [ ]  

**Pass/Fail:** ___

### 5.2 Email Verification System

**Objective:** Verify email sends and authentication works.

```bash
# Test email verification flow
# 1. Sign up new account: test@example.com
# 2. Check mailbox for verification email
# 3. Click verification link
# 4. Verify account activated
```

**Email Received:** [ ]  
**Link Works:** [ ]  
**Account Activated:** [ ]  
**Time to Receive:** _____ seconds  

**Pass/Fail:** ___

### 5.3 Third-Party Service Health

**Objective:** Verify all dependencies accessible and responsive.

| Service | Status | Response Time | Pass? |
|---------|--------|---------------|-------|
| Supabase | [ ] | _____ ms | [ ] |
| Azure OpenAI | [ ] | _____ ms | [ ] |
| Vercel CDN | [ ] | _____ ms | [ ] |

**Check Commands:**
```bash
# Supabase health
curl https://your-project.supabase.co/health

# Azure OpenAI
az cognitiveservices account show --resource-group rg-azproud

# Vercel
curl https://vercel.com/_status
```

**Pass/Fail:** ___

---

## 6. Documentation Completeness

### 6.1 User Documentation

| Document | Complete | Reviewed | Tested | Pass? |
|----------|----------|----------|--------|-------|
| User Guide | [ ] | [ ] | [ ] | [ ] |
| Feature Walkthrough | [ ] | [ ] | [ ] | [ ] |
| FAQ | [ ] | [ ] | [ ] | [ ] |
| Video Tutorials | [ ] | [ ] | [ ] | [ ] |

**Pass/Fail:** ___

### 6.2 API Documentation

- [ ] All endpoints documented
- [ ] Request/response examples provided
- [ ] Error codes explained
- [ ] Authentication explained
- [ ] Rate limiting documented

**Pass/Fail:** ___

### 6.3 Admin/Ops Documentation

- [ ] Deployment runbook complete
- [ ] Monitoring setup documented
- [ ] Backup/restore procedures documented
- [ ] Incident response plan created
- [ ] Contact list updated

**Pass/Fail:** ___

---

## 7. Team Readiness

### 7.1 Support Team

- [ ] Trained on all features
- [ ] Access to production environment
- [ ] Incident response procedure
- [ ] Escalation contacts identified
- [ ] Knowledge base prepared

**Training Completion:** _____%  

**Pass/Fail:** ___

### 7.2 Operations Team

- [ ] Deployment procedure reviewed
- [ ] Monitoring tools configured
- [ ] Backup procedures tested
- [ ] Incident response plan reviewed
- [ ] On-call schedule established

**Pass/Fail:** ___

### 7.3 Product/Business

- [ ] Launch date confirmed
- [ ] Marketing materials prepared
- [ ] Customer communication ready
- [ ] Success metrics defined
- [ ] KPIs established

**Pass/Fail:** ___

---

## 8. Final Sign-Off

### 8.1 Approval Checklist

- [ ] All data integrity checks passed
- [ ] All security checks passed
- [ ] All performance tests passed
- [ ] All documentation complete
- [ ] All teams trained and ready
- [ ] No critical bugs pending
- [ ] Backup and restore verified
- [ ] Incident response plan ready

### 8.2 Risk Assessment

**Identified Risks:** _____

**Mitigation Plans:** _____

**Residual Risk Level:** [ ] Low [ ] Medium [ ] High

### 8.3 Go/No-Go Decision

**Final Status:**

[ ] **GO - Approved for production**

[ ] **NO-GO - Address issues and recheck**

**Sign-Off:**

Product Owner: _________________ Date: _______

Technical Lead: ________________ Date: _______

Operations Lead: _______________ Date: _______

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-22  
**Next Review Date:** Before each major release
