-- =============================================================================
-- EstateX Pro — Seed / Sample Data
-- PostgreSQL 17
--
-- Prerequisite: run schema.sql first
--   psql -U postgres -d estatex_pro -f seed.sql
--
-- Default admin login (CHANGE IN PRODUCTION):
--   Email:    admin@estatex.pro
--   Password: Admin@123
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Lookup: Payment Methods (Module 5)
-- -----------------------------------------------------------------------------
INSERT INTO payment_methods (method_name, is_active)
VALUES
  ('Cash', TRUE),
  ('Bank Transfer', TRUE),
  ('Bank Loan', TRUE),
  ('Government Loan', TRUE)
ON CONFLICT (method_name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Lookup: Expense Categories (Module 12)
-- -----------------------------------------------------------------------------
INSERT INTO expense_categories (category_name, description)
VALUES
  ('Police Verification', 'Police verification related charges'),
  ('Agreement Charges', 'Agreement drafting and related fees'),
  ('Fuel Charges', 'Fuel and transport expenses'),
  ('Milk / Refreshments', 'Office refreshments and milk'),
  ('General Expenses', 'Miscellaneous office expenses'),
  ('Device Purchases', 'Laptops, printers, ACs and other devices')
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO expense_subcategories (category_id, subcategory_name)
SELECT c.id, s.subcategory_name
FROM expense_categories c
JOIN (VALUES
  ('Fuel Charges', 'Bike Fuel'),
  ('Fuel Charges', 'Car Fuel'),
  ('Device Purchases', 'Laptop'),
  ('Device Purchases', 'Printer'),
  ('Device Purchases', 'AC'),
  ('Device Purchases', 'Other Office Equipment'),
  ('General Expenses', 'Stationery'),
  ('General Expenses', 'Utilities')
) AS s(category_name, subcategory_name)
  ON c.category_name = s.category_name
ON CONFLICT (category_id, subcategory_name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Admin + Employee (Module 1 + Paid By / Agent support)
-- Password hash via pgcrypto blowfish (bcrypt-compatible for many stacks).
-- Backend should re-hash with bcrypt/bcryptjs on first real deployment if needed.
-- -----------------------------------------------------------------------------
INSERT INTO admins (full_name, email, password_hash, role, is_active)
VALUES (
  'System Administrator',
  'admin@estatex.pro',
  crypt('Admin@123', gen_salt('bf', 10)),
  'super_admin',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO employees (full_name, email, phone, designation, is_active, admin_id)
SELECT
  'System Administrator',
  'admin@estatex.pro',
  '0300-0000000',
  'Admin / Agent',
  TRUE,
  a.id
FROM admins a
WHERE a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.email = 'admin@estatex.pro'
  );

INSERT INTO employees (full_name, email, phone, designation, is_active)
SELECT 'Ali Khan', 'ali.khan@estatex.pro', '0301-1111111', 'Sales Agent', TRUE
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE email = 'ali.khan@estatex.pro');

INSERT INTO employees (full_name, email, phone, designation, is_active)
SELECT 'Sara Ahmed', 'sara.ahmed@estatex.pro', '0302-2222222', 'Accountant', TRUE
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE email = 'sara.ahmed@estatex.pro');

-- -----------------------------------------------------------------------------
-- Bank Accounts (Module 5)
-- -----------------------------------------------------------------------------
INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, iban, branch_name, account_details)
SELECT 'HBL', 'EstateX Pro', '123456789012', 'PK00HABB0000001234567890', 'Main Branch', 'Primary company account'
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts WHERE bank_name = 'HBL' AND account_number = '123456789012'
);

INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, iban, branch_name, account_details)
SELECT 'Meezan Bank', 'EstateX Pro', '987654321098', 'PK00MEZN0000009876543210', 'Gulberg Branch', 'Secondary account'
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts WHERE bank_name = 'Meezan Bank' AND account_number = '987654321098'
);

-- -----------------------------------------------------------------------------
-- Owners (Module 4) — one verified, one unverified
-- -----------------------------------------------------------------------------
INSERT INTO owners (
  owner_name, cnic, phone, email, address, ntn,
  nominee_name, nominee_cnic, nominee_relation, nominee_contact,
  verification_status, verified_at, verified_by, notes
)
SELECT
  'Muhammad Usman', '35202-1234567-1', '0300-1234567', 'usman@email.com',
  'Lahore, Pakistan', '1234567-8',
  'Ayesha Usman', '35202-7654321-0', 'Spouse', '0300-7654321',
  'verified', CURRENT_TIMESTAMP, a.id, 'Verified sample owner'
FROM admins a
WHERE a.email = 'admin@estatex.pro'
  AND NOT EXISTS (SELECT 1 FROM owners WHERE cnic = '35202-1234567-1');

INSERT INTO owners (
  owner_name, cnic, phone, email, address, verification_status, notes
)
SELECT
  'Imran Malik', '35202-9999888-2', '0333-9999888', 'imran@email.com',
  'Islamabad, Pakistan', 'unverified', 'Draft listing prerequisite demo'
WHERE NOT EXISTS (SELECT 1 FROM owners WHERE cnic = '35202-9999888-2');

-- -----------------------------------------------------------------------------
-- Clients (Module 6)
-- -----------------------------------------------------------------------------
INSERT INTO clients (
  client_name, cnic, phone, email, client_type,
  budget_min, budget_max, investment_preference,
  preferred_property_type, preferred_location, lead_source,
  referral_source, crm_notes, whatsapp_sms_preference,
  client_rating, next_follow_up_date
)
SELECT
  'Hassan Raza', '35202-1111222-3', '0311-1111222', 'hassan@email.com', 'buyer',
  5000000, 15000000, 'Long-term hold',
  'House', 'Lahore - DHA', 'Walk-in',
  'Friend referral', 'Interested in DHA Phase 5', 'whatsapp',
  4.50, CURRENT_DATE + 7
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE cnic = '35202-1111222-3');

INSERT INTO clients (
  client_name, cnic, phone, email, client_type,
  budget_min, budget_max, preferred_location, lead_source,
  whatsapp_sms_preference, client_rating
)
SELECT
  'Fatima Noor', '35202-3333444-5', '0312-3333444', 'fatima@email.com', 'both',
  2000000, 8000000, 'Lahore - Johar Town', 'Facebook Ads',
  'both', 4.00
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE cnic = '35202-3333444-5');

INSERT INTO client_communications (client_id, communication_type, subject, notes, created_by)
SELECT c.id, 'call', 'Initial inquiry', 'Asked about DHA houses under 1.5 Cr', a.id
FROM clients c
CROSS JOIN admins a
WHERE c.cnic = '35202-1111222-3'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM client_communications cc
    WHERE cc.client_id = c.id AND cc.subject = 'Initial inquiry'
  );

-- -----------------------------------------------------------------------------
-- Properties (Module 3) — insert as draft, link prerequisites, then list
-- -----------------------------------------------------------------------------
INSERT INTO properties (
  property_code, title, property_type, purpose, category, status,
  city, area, society, block, street, flat_or_plot_number,
  covered_area, plot_size, area_unit, furnishing_status, possession_status,
  asking_price, primary_payment_method_id, is_featured, description, created_by
)
SELECT
  'EXP-2026-0001',
  'DHA Phase 5 1 Kanal House',
  'House',
  'sale',
  'residential',
  'draft',
  'Lahore', 'DHA', 'Phase 5', 'Block B', 'Main Boulevard', '123',
  4500, 20, 'Marla', 'Semi-Furnished', 'Ready',
  125000000,
  pm.id,
  TRUE,
  'Sample listed property meeting listing prerequisites',
  a.id
FROM admins a
CROSS JOIN payment_methods pm
WHERE a.email = 'admin@estatex.pro'
  AND pm.method_name = 'Bank Transfer'
  AND NOT EXISTS (SELECT 1 FROM properties WHERE property_code = 'EXP-2026-0001');

INSERT INTO properties (
  property_code, title, property_type, purpose, category, status,
  city, area, society, monthly_rent, advance_rent_months, security_deposit,
  description, created_by
)
SELECT
  'EXP-2026-0002',
  'Johar Town Apartment (Draft)',
  'Apartment',
  'rent',
  'residential',
  'draft',
  'Lahore', 'Johar Town', 'Block H',
  85000, 2, 170000,
  'Draft rental — missing verified owner / bank link',
  a.id
FROM admins a
WHERE a.email = 'admin@estatex.pro'
  AND NOT EXISTS (SELECT 1 FROM properties WHERE property_code = 'EXP-2026-0002');

-- Link verified owner + bank to property that will be listed
INSERT INTO property_owners (property_id, owner_id, share_percentage, ownership_document_type, is_primary)
SELECT p.id, o.id, 100.00, 'Registry', TRUE
FROM properties p
JOIN owners o ON o.cnic = '35202-1234567-1'
WHERE p.property_code = 'EXP-2026-0001'
  AND NOT EXISTS (
    SELECT 1 FROM property_owners po WHERE po.property_id = p.id AND po.owner_id = o.id
  );

INSERT INTO property_bank_accounts (property_id, bank_account_id, is_primary)
SELECT p.id, b.id, TRUE
FROM properties p
JOIN bank_accounts b ON b.bank_name = 'HBL' AND b.account_number = '123456789012'
WHERE p.property_code = 'EXP-2026-0001'
  AND NOT EXISTS (
    SELECT 1 FROM property_bank_accounts pba
    WHERE pba.property_id = p.id AND pba.bank_account_id = b.id
  );

-- Promote to available only after listing prerequisites are satisfied
UPDATE properties
SET status = 'available',
    updated_at = CURRENT_TIMESTAMP
WHERE property_code = 'EXP-2026-0001'
  AND status = 'draft'
  AND deleted_at IS NULL;

INSERT INTO property_history (property_id, event_type, new_value, description, performed_by)
SELECT p.id, 'created', jsonb_build_object('status', p.status, 'code', p.property_code),
       'Property created (seed)', a.id
FROM properties p
CROSS JOIN admins a
WHERE p.property_code = 'EXP-2026-0001'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM property_history ph
    WHERE ph.property_id = p.id AND ph.event_type = 'created'
  );

INSERT INTO property_history (property_id, event_type, old_value, new_value, description, performed_by)
SELECT p.id, 'status_change',
       jsonb_build_object('status', 'draft'),
       jsonb_build_object('status', 'available'),
       'Listed after verified owner + bank account + payment method (seed)',
       a.id
FROM properties p
CROSS JOIN admins a
WHERE p.property_code = 'EXP-2026-0001'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM property_history ph
    WHERE ph.property_id = p.id AND ph.event_type = 'status_change'
  );

-- -----------------------------------------------------------------------------
-- Booking + installments + sample payment (Modules 7)
-- -----------------------------------------------------------------------------
INSERT INTO bookings (
  booking_code, property_id, client_id,
  booking_amount, total_price, remaining_balance,
  installment_plan_name, monthly_installment_amount,
  status, token_receipt_number, booking_expiry_date, created_by
)
SELECT
  'BK-2026-0001',
  p.id,
  c.id,
  5000000,
  125000000,
  120000000,
  '24-Month Plan',
  5000000,
  'pending',
  'TR-1001',
  CURRENT_DATE + 30,
  a.id
FROM properties p
JOIN clients c ON c.cnic = '35202-1111222-3'
CROSS JOIN admins a
WHERE p.property_code = 'EXP-2026-0001'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code = 'BK-2026-0001');

INSERT INTO booking_installments (booking_id, installment_number, due_date, amount_due, amount_paid, status)
SELECT b.id, 1, CURRENT_DATE + 30, 5000000, 0, 'pending'
FROM bookings b
WHERE b.booking_code = 'BK-2026-0001'
  AND NOT EXISTS (
    SELECT 1 FROM booking_installments bi WHERE bi.booking_id = b.id AND bi.installment_number = 1
  );

INSERT INTO booking_installments (booking_id, installment_number, due_date, amount_due, amount_paid, status)
SELECT b.id, 2, CURRENT_DATE + 60, 5000000, 0, 'pending'
FROM bookings b
WHERE b.booking_code = 'BK-2026-0001'
  AND NOT EXISTS (
    SELECT 1 FROM booking_installments bi WHERE bi.booking_id = b.id AND bi.installment_number = 2
  );

-- -----------------------------------------------------------------------------
-- Commission (Module 8)
-- -----------------------------------------------------------------------------
INSERT INTO commissions (
  property_id, booking_id, commission_percentage,
  calculated_amount, final_amount, is_manual_override,
  brokerage_from_buyer, brokerage_from_seller,
  payment_status, assigned_agent_id, created_by
)
SELECT
  p.id, b.id, 2.00,
  2500000, 2500000, FALSE,
  1250000, 1250000,
  'unpaid', e.id, a.id
FROM properties p
JOIN bookings b ON b.booking_code = 'BK-2026-0001'
JOIN employees e ON e.email = 'ali.khan@estatex.pro'
CROSS JOIN admins a
WHERE p.property_code = 'EXP-2026-0001'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM commissions c WHERE c.property_id = p.id AND c.booking_id = b.id
  );

-- -----------------------------------------------------------------------------
-- Vendor + Expense + Inventory (Modules 12–14)
-- -----------------------------------------------------------------------------
INSERT INTO vendors (
  vendor_name, contact_person, phone, email, services,
  contract_start_date, contract_end_date, payment_terms, is_preferred, outstanding_balance
)
SELECT
  'TechOffice Supplies', 'Bilal Sheikh', '0300-5555666', 'sales@techoffice.pk',
  'Laptops, printers, office equipment',
  CURRENT_DATE - 90, CURRENT_DATE + 275, 'Net 30', TRUE, 0
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE vendor_name = 'TechOffice Supplies');

INSERT INTO inventory_items (
  item_name, item_type, quantity, unit, status, assigned_to, purchase_date, purchase_cost, notes
)
SELECT
  'Dell Latitude Laptop', 'Laptop', 1, 'pcs', 'assigned',
  e.id, CURRENT_DATE - 10, 185000, 'Seed inventory item'
FROM employees e
WHERE e.email = 'ali.khan@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_items WHERE item_name = 'Dell Latitude Laptop'
  );

INSERT INTO expenses (
  expense_code, expense_date, category_id, subcategory_id, vendor_id,
  amount, gst_sales_tax, remaining_amount, payment_method_id,
  description, paid_by_employee_id, device_or_item_name, quantity,
  reimbursement_status, approval_status, approved_by, approved_at,
  inventory_item_id, created_by
)
SELECT
  'EX-2026-0001',
  CURRENT_DATE - 10,
  cat.id,
  sub.id,
  v.id,
  185000, 0, 0, pm.id,
  'Purchased laptop for sales agent',
  emp.id,
  'Dell Latitude Laptop',
  1,
  'none',
  'approved',
  a.id,
  CURRENT_TIMESTAMP,
  inv.id,
  a.id
FROM expense_categories cat
JOIN expense_subcategories sub ON sub.category_id = cat.id AND sub.subcategory_name = 'Laptop'
JOIN vendors v ON v.vendor_name = 'TechOffice Supplies'
JOIN payment_methods pm ON pm.method_name = 'Bank Transfer'
JOIN employees emp ON emp.email = 'sara.ahmed@estatex.pro'
JOIN inventory_items inv ON inv.item_name = 'Dell Latitude Laptop'
CROSS JOIN admins a
WHERE cat.category_name = 'Device Purchases'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (SELECT 1 FROM expenses WHERE expense_code = 'EX-2026-0001');

INSERT INTO inventory_transactions (
  inventory_item_id, expense_id, txn_type, quantity_change, assigned_to, notes, performed_by
)
SELECT
  inv.id, ex.id, 'purchase', 1, emp.id, 'Linked to device purchase expense', a.id
FROM inventory_items inv
JOIN expenses ex ON ex.expense_code = 'EX-2026-0001'
JOIN employees emp ON emp.email = 'ali.khan@estatex.pro'
CROSS JOIN admins a
WHERE inv.item_name = 'Dell Latitude Laptop'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_transactions it
    WHERE it.inventory_item_id = inv.id AND it.txn_type = 'purchase'
  );

-- -----------------------------------------------------------------------------
-- Recurring expense + Budget + Petty cash (Modules 15–17)
-- -----------------------------------------------------------------------------
INSERT INTO recurring_expenses (
  title, category_id, amount, frequency, due_day, next_due_date,
  reminder_days_before, auto_debit_flag, annual_escalation_pct, is_active, created_by
)
SELECT
  'Office Rent',
  cat.id,
  150000,
  'monthly',
  1,
  date_trunc('month', CURRENT_DATE)::date + INTERVAL '1 month',
  5,
  FALSE,
  5.00,
  TRUE,
  a.id
FROM expense_categories cat
CROSS JOIN admins a
WHERE cat.category_name = 'General Expenses'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (SELECT 1 FROM recurring_expenses WHERE title = 'Office Rent');

INSERT INTO budgets (name, period_type, year, month, total_amount, alert_threshold_pct, created_by)
SELECT
  'Monthly Office Budget',
  'monthly',
  EXTRACT(YEAR FROM CURRENT_DATE)::INT,
  EXTRACT(MONTH FROM CURRENT_DATE)::INT,
  500000,
  80,
  a.id
FROM admins a
WHERE a.email = 'admin@estatex.pro'
ON CONFLICT (period_type, year, month) DO NOTHING;

INSERT INTO budget_lines (budget_id, category_id, allocated_amount)
SELECT b.id, c.id, alloc.amount
FROM budgets b
CROSS JOIN (VALUES
  ('Fuel Charges', 50000::DECIMAL),
  ('Milk / Refreshments', 15000::DECIMAL),
  ('General Expenses', 200000::DECIMAL),
  ('Device Purchases', 235000::DECIMAL)
) AS alloc(category_name, amount)
JOIN expense_categories c ON c.category_name = alloc.category_name
WHERE b.name = 'Monthly Office Budget'
  AND NOT EXISTS (
    SELECT 1 FROM budget_lines bl WHERE bl.budget_id = b.id AND bl.category_id = c.id
  );

INSERT INTO petty_cash_accounts (
  account_name, custodian_employee_id, float_amount, current_balance, is_active, created_by
)
SELECT
  'Front Desk Petty Cash',
  e.id,
  20000,
  18500,
  TRUE,
  a.id
FROM employees e
CROSS JOIN admins a
WHERE e.email = 'sara.ahmed@estatex.pro'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM petty_cash_accounts WHERE account_name = 'Front Desk Petty Cash'
  );

INSERT INTO petty_cash_transactions (
  account_id, txn_type, amount, description, performed_by, created_by
)
SELECT
  pca.id, 'out', 1500, 'Milk / refreshments top-up', e.id, a.id
FROM petty_cash_accounts pca
JOIN employees e ON e.email = 'sara.ahmed@estatex.pro'
CROSS JOIN admins a
WHERE pca.account_name = 'Front Desk Petty Cash'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM petty_cash_transactions t
    WHERE t.account_id = pca.id AND t.description = 'Milk / refreshments top-up'
  );

-- -----------------------------------------------------------------------------
-- Notifications + Favorite + Audit sample (Modules 19–20)
-- -----------------------------------------------------------------------------
INSERT INTO notifications (admin_id, notification_type, title, message, entity_type, entity_id)
SELECT
  a.id, 'booking_expiry', 'Booking expiry reminder',
  'Booking BK-2026-0001 expires within 30 days',
  'booking', b.id
FROM admins a
JOIN bookings b ON b.booking_code = 'BK-2026-0001'
WHERE a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.admin_id = a.id AND n.title = 'Booking expiry reminder'
  );

INSERT INTO favorites (admin_id, entity_type, entity_id)
SELECT a.id, 'property', p.id
FROM admins a
JOIN properties p ON p.property_code = 'EXP-2026-0001'
WHERE a.email = 'admin@estatex.pro'
ON CONFLICT (admin_id, entity_type, entity_id) DO NOTHING;

INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
SELECT
  a.id, 'SEED_INIT', 'system', NULL,
  jsonb_build_object('message', 'Database seeded for EstateX Pro development')
FROM admins a
WHERE a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM audit_logs WHERE action = 'SEED_INIT'
  );

-- -----------------------------------------------------------------------------
-- Maintenance task (supports Maintenance Deadline notifications)
-- -----------------------------------------------------------------------------
INSERT INTO maintenance_tasks (
  property_id, title, description, category, status, priority,
  due_date, assigned_to, reminder_days_before, notes, created_by
)
SELECT
  p.id,
  'Annual AC servicing',
  'Scheduled maintenance for HVAC units',
  'HVAC',
  'scheduled',
  'medium',
  CURRENT_DATE + 14,
  e.id,
  5,
  'Seed maintenance deadline sample',
  a.id
FROM properties p
JOIN employees e ON e.email = 'ali.khan@estatex.pro'
CROSS JOIN admins a
WHERE p.property_code = 'EXP-2026-0001'
  AND a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    WHERE mt.property_id = p.id AND mt.title = 'Annual AC servicing'
  );

INSERT INTO notifications (admin_id, notification_type, title, message, entity_type, entity_id)
SELECT
  a.id,
  'maintenance_deadline',
  'Maintenance deadline approaching',
  'Annual AC servicing is due within 14 days for EXP-2026-0001',
  'maintenance_task',
  mt.id
FROM admins a
JOIN maintenance_tasks mt ON mt.title = 'Annual AC servicing'
JOIN properties p ON p.id = mt.property_id AND p.property_code = 'EXP-2026-0001'
WHERE a.email = 'admin@estatex.pro'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.admin_id = a.id AND n.title = 'Maintenance deadline approaching'
  );

COMMIT;

-- =============================================================================
-- End of seed.sql
-- =============================================================================
