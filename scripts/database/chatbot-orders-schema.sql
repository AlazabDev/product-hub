-- =====================================================
-- Alazab PAOP - Chatbot Orders & Manufacturing Schema
-- نظام طلبات الشات بوت وأوامر التصنيع
-- =====================================================

-- جدول طلبات العروض من الشات بوت
CREATE TABLE IF NOT EXISTS quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- معلومات الطلب
    request_id VARCHAR(50) UNIQUE NOT NULL, -- معرف فريد من الشات بوت
    chatbot_session_id VARCHAR(100), -- معرف جلسة الشات بوت
    customer_id VARCHAR(100), -- معرف العميل من الشات بوت
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    
    -- تفاصيل التصميم
    design_file_url TEXT, -- رابط ملف التصميم
    design_file_type VARCHAR(50), -- نوع الملف (json, 3d, image)
    design_data JSONB, -- بيانات التصميم المفصلة
    design_preview_url TEXT, -- صورة معاينة التصميم
    
    -- الابعاد والمواصفات
    dimensions JSONB, -- {width, height, depth, unit}
    materials JSONB, -- [{material_code, material_name, quantity, unit}]
    components JSONB, -- [{component_code, name, quantity, specifications}]
    finishes JSONB, -- التشطيبات {color, texture, coating}
    accessories JSONB, -- الاكسسوارات [{type, code, quantity}]
    
    -- التسعير
    pricing_breakdown JSONB, -- تفاصيل التسعير
    materials_cost DECIMAL(12, 2), -- تكلفة الخامات
    labor_cost DECIMAL(12, 2), -- تكلفة العمالة
    overhead_cost DECIMAL(12, 2), -- تكاليف غير مباشرة
    profit_margin DECIMAL(5, 2), -- هامش الربح %
    total_cost DECIMAL(12, 2), -- التكلفة الاجمالية
    selling_price DECIMAL(12, 2), -- سعر البيع
    currency VARCHAR(10) DEFAULT 'SAR',
    
    -- الحالة
    status VARCHAR(50) DEFAULT 'pending', -- pending, quoted, accepted, rejected, expired
    quoted_at TIMESTAMP WITH TIME ZONE,
    quote_valid_until TIMESTAMP WITH TIME ZONE,
    customer_response VARCHAR(50), -- accepted, rejected, negotiating
    customer_response_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- الملاحظات
    customer_notes TEXT, -- ملاحظات العميل
    internal_notes TEXT, -- ملاحظات داخلية
    special_requirements TEXT, -- متطلبات خاصة
    
    -- التتبع
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    processed_by UUID REFERENCES auth.users(id)
);

-- جدول أوامر التصنيع
CREATE TABLE IF NOT EXISTS manufacturing_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- الربط
    quote_request_id UUID REFERENCES quote_requests(id),
    order_number VARCHAR(50) UNIQUE NOT NULL, -- رقم الامر MO-2024-XXXX
    
    -- معلومات العميل
    customer_id VARCHAR(100),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    delivery_address TEXT,
    
    -- تفاصيل الطلب
    design_data JSONB,
    specifications JSONB,
    quantity INTEGER DEFAULT 1,
    
    -- التواريخ
    estimated_start_date DATE,
    estimated_completion_date DATE,
    actual_start_date DATE,
    actual_completion_date DATE,
    delivery_date DATE,
    
    -- التسعير
    unit_price DECIMAL(12, 2),
    total_price DECIMAL(12, 2),
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    final_price DECIMAL(12, 2),
    currency VARCHAR(10) DEFAULT 'SAR',
    
    -- الدفع
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, partial, paid
    amount_paid DECIMAL(12, 2) DEFAULT 0,
    payment_method VARCHAR(50),
    
    -- الحالة
    status VARCHAR(50) DEFAULT 'pending', 
    -- pending, materials_requested, in_production, quality_check, ready, delivered, cancelled
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- الملاحظات
    production_notes TEXT,
    quality_notes TEXT,
    delivery_notes TEXT,
    
    -- التتبع
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- جدول أوامر صرف الخامات
CREATE TABLE IF NOT EXISTS material_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- الربط
    manufacturing_order_id UUID REFERENCES manufacturing_orders(id),
    requisition_number VARCHAR(50) UNIQUE NOT NULL, -- MR-2024-XXXX
    
    -- الحالة
    status VARCHAR(50) DEFAULT 'pending',
    -- pending, approved, partial_issued, issued, cancelled
    
    -- التواريخ
    requested_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_date TIMESTAMP WITH TIME ZONE,
    issued_date TIMESTAMP WITH TIME ZONE,
    
    -- المسؤولين
    requested_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    issued_by UUID REFERENCES auth.users(id),
    
    -- الملاحظات
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول تفاصيل صرف الخامات
CREATE TABLE IF NOT EXISTS material_requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    requisition_id UUID REFERENCES material_requisitions(id) ON DELETE CASCADE,
    
    -- المنتج/الخامة
    product_id UUID REFERENCES products(id),
    product_code VARCHAR(100),
    product_name VARCHAR(255),
    
    -- الكميات
    requested_quantity DECIMAL(12, 3),
    approved_quantity DECIMAL(12, 3),
    issued_quantity DECIMAL(12, 3) DEFAULT 0,
    unit VARCHAR(20),
    
    -- التكلفة
    unit_cost DECIMAL(12, 2),
    total_cost DECIMAL(12, 2),
    
    -- المورد
    supplier_id UUID REFERENCES suppliers(id),
    supplier_name VARCHAR(255),
    
    -- الحالة
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, issued, cancelled
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول قواعد التسعير
CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- نوع القاعدة
    rule_type VARCHAR(50) NOT NULL, 
    -- material_markup, labor_rate, overhead_percent, volume_discount, complexity_factor
    
    -- الشروط
    conditions JSONB, -- {min_quantity, max_quantity, material_type, complexity_level}
    
    -- القيم
    value_type VARCHAR(20) NOT NULL, -- fixed, percent, formula
    value DECIMAL(12, 4),
    formula TEXT, -- صيغة حسابية مخصصة
    
    -- الاولوية
    priority INTEGER DEFAULT 0,
    
    -- الحالة
    is_active BOOLEAN DEFAULT TRUE,
    valid_from DATE,
    valid_to DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- جدول سجل تواصل الشات بوت
CREATE TABLE IF NOT EXISTS chatbot_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    quote_request_id UUID REFERENCES quote_requests(id),
    manufacturing_order_id UUID REFERENCES manufacturing_orders(id),
    
    -- نوع التفاعل
    interaction_type VARCHAR(50) NOT NULL, 
    -- quote_request, quote_sent, customer_accepted, customer_rejected, 
    -- order_confirmed, status_update, delivery_notification
    
    -- الاتجاه
    direction VARCHAR(20) NOT NULL, -- inbound, outbound
    
    -- البيانات
    payload JSONB, -- البيانات المرسلة/المستلمة
    response_payload JSONB, -- الرد
    
    -- الحالة
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, failed
    error_message TEXT,
    
    -- التوقيت
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer ON quote_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_request_id ON quote_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_status ON manufacturing_orders(status);
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_quote ON manufacturing_orders(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_order ON material_requisitions(manufacturing_order_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_quote ON chatbot_interactions(quote_request_id);

-- Functions
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    year_part VARCHAR(4);
    sequence_num INTEGER;
    new_number VARCHAR(50);
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 9) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM manufacturing_orders
    WHERE order_number LIKE 'MO-' || year_part || '-%';
    new_number := 'MO-' || year_part || '-' || LPAD(sequence_num::TEXT, 5, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_requisition_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    year_part VARCHAR(4);
    sequence_num INTEGER;
    new_number VARCHAR(50);
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(requisition_number FROM 9) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM material_requisitions
    WHERE requisition_number LIKE 'MR-' || year_part || '-%';
    new_number := 'MR-' || year_part || '-' || LPAD(sequence_num::TEXT, 5, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE OR REPLACE FUNCTION update_quote_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_quote_requests_updated
    BEFORE UPDATE ON quote_requests
    FOR EACH ROW EXECUTE FUNCTION update_quote_timestamp();

CREATE TRIGGER trigger_manufacturing_orders_updated
    BEFORE UPDATE ON manufacturing_orders
    FOR EACH ROW EXECUTE FUNCTION update_quote_timestamp();

-- Insert default pricing rules
INSERT INTO pricing_rules (name, description, rule_type, conditions, value_type, value, priority, is_active) VALUES
('هامش ربح الخامات', 'نسبة الربح على تكلفة الخامات', 'material_markup', '{}', 'percent', 25.00, 1, true),
('معدل العمالة بالساعة', 'تكلفة ساعة العمل', 'labor_rate', '{}', 'fixed', 50.00, 1, true),
('نسبة التكاليف غير المباشرة', 'مصاريف ادارية وتشغيلية', 'overhead_percent', '{}', 'percent', 15.00, 1, true),
('خصم الكمية - 5 وحدات', 'خصم للطلبات اكبر من 5 وحدات', 'volume_discount', '{"min_quantity": 5}', 'percent', 5.00, 2, true),
('خصم الكمية - 10 وحدات', 'خصم للطلبات اكبر من 10 وحدات', 'volume_discount', '{"min_quantity": 10}', 'percent', 10.00, 3, true),
('معامل التعقيد - بسيط', 'للتصاميم البسيطة', 'complexity_factor', '{"complexity_level": "simple"}', 'fixed', 1.00, 1, true),
('معامل التعقيد - متوسط', 'للتصاميم المتوسطة', 'complexity_factor', '{"complexity_level": "medium"}', 'fixed', 1.25, 1, true),
('معامل التعقيد - معقد', 'للتصاميم المعقدة', 'complexity_factor', '{"complexity_level": "complex"}', 'fixed', 1.50, 1, true)
ON CONFLICT DO NOTHING;
