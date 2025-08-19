# Unified Numbering System Setup

## 🎯 Goal
Unify the numbering system so that both dockets and invoices use the same 5-digit format (e.g., "00105", "00106", etc.) instead of having separate formats.

## 📋 Current State
- **Dockets**: Use 5-digit numbers (e.g., "00105", "00106")
- **Invoices**: Use "INV-XXXX" format (e.g., "INV-0001", "INV-0002")
- **Customers**: Use "CUST-XXXX" format (e.g., "CUST-0001", "CUST-0002")

## 🔄 New Unified System
- **Dockets**: 5-digit numbers (e.g., "00105", "00106")
- **Invoices**: 5-digit numbers (e.g., "00107", "00108") - **SAME FORMAT AS DOCKETS**
- **Customers**: Keep "CUST-XXXX" format (unchanged)

## 🚀 Implementation Steps

### Step 1: Run the Database Migration
Copy and paste the contents of `database-schema-unified-numbering.sql` into your Supabase SQL Editor and run it.

### Step 2: Test the New System
```sql
-- Test the unified document number generator
SELECT generate_unified_document_number();

-- Test invoice number generation
SELECT generate_invoice_number();

-- Check existing docket numbers
SELECT docket_no FROM public.dockets ORDER BY docket_no;

-- Check existing invoice numbers (should now be 5-digit)
SELECT invoice_number FROM public.invoice ORDER BY invoice_number;
```

### Step 3: Verify the Application
1. Navigate to `http://localhost:5173/customers` and create a new customer
2. Navigate to `http://localhost:5173/invoices` and create a new invoice
3. Check that the invoice number is now a 5-digit number (not INV-XXXX)
4. Verify that docket numbers continue to work as before

## 🔧 What the Migration Does

### 1. **Creates Unified Sequence**
- New sequence `unified_document_seq` starting from 105
- Automatically bumps to the highest existing number from both dockets and invoices

### 2. **Updates Existing Invoices**
- Converts existing "INV-XXXX" format to 5-digit numbers
- Example: "INV-0001" becomes "00001"

### 3. **Unified Number Generation**
- Both dockets and invoices now use `generate_unified_document_number()`
- Ensures no duplicate numbers across both systems

### 4. **Duplicate Prevention**
- Triggers ensure no duplicate numbers between dockets and invoices
- Maintains data integrity

### 5. **Customer Codes Unchanged**
- Customer codes remain "CUST-XXXX" format to avoid confusion
- Only document numbers (dockets/invoices) are unified

## 📊 Expected Results

### Before Migration:
```
Dockets: 00105, 00106, 00107
Invoices: INV-0001, INV-0002, INV-0003
Customers: CUST-0001, CUST-0002
```

### After Migration:
```
Dockets: 00105, 00106, 00107
Invoices: 00001, 00002, 00003 (converted from INV-XXXX)
Customers: CUST-0001, CUST-0002 (unchanged)
```

### Next Numbers Generated:
```
Next Docket: 00108
Next Invoice: 00109
Next Customer: CUST-0003
```

## ⚠️ Important Notes

1. **No Data Loss**: All existing data is preserved
2. **Backward Compatibility**: Existing docket functionality remains unchanged
3. **Unique Numbers**: No duplicate numbers between dockets and invoices
4. **Customer Codes**: Remain separate to avoid confusion

## 🎉 Benefits

1. **Consistent User Experience**: Both dockets and invoices use the same number format
2. **Simplified Reference**: Easy to reference documents by number
3. **Professional Appearance**: Clean 5-digit numbers for all documents
4. **No Confusion**: Clear distinction between document numbers and customer codes

## 🔍 Troubleshooting

### If you see errors:
1. **Check existing data**: Ensure no conflicts between docket and invoice numbers
2. **Verify sequence**: Check that `unified_document_seq` is properly set
3. **Test functions**: Run the test queries above

### If numbers seem wrong:
1. **Check the sequence value**: `SELECT currval('unified_document_seq');`
2. **Reset if needed**: `SELECT setval('unified_document_seq', 105, true);`

## ✅ Success Criteria

- [ ] Database migration runs without errors
- [ ] New invoices get 5-digit numbers (not INV-XXXX)
- [ ] Existing docket functionality works unchanged
- [ ] No duplicate numbers between dockets and invoices
- [ ] Customer codes remain in CUST-XXXX format
- [ ] Application displays unified numbers correctly

