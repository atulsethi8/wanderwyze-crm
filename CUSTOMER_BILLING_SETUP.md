# Customer Management & Billing System Setup Guide

This guide will help you set up the complete customer management and billing system for your WanderWyze CRM.

## 🗄️ Database Setup

### Step 1: Run the Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `database-schema.sql`
4. Click **Run** to execute the schema

This will create:
- `customer_master` table with auto-generated customer codes
- `invoice` table with auto-generated invoice numbers
- Database functions for code generation
- Proper indexes for performance
- Row Level Security policies

### Step 2: Verify the Setup

After running the schema, you should see:
- Two new tables in your **Table Editor**
- Two new functions in your **Database Functions** section
- Proper RLS policies enabled

## 🚀 Application Setup

### Step 1: Environment Variables

Make sure your `.env.local` file contains the required Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 2: Install Dependencies

The system uses existing dependencies, so no additional installation is needed.

### Step 3: Start the Development Server

```bash
npm run dev
```

## 📋 Features Overview

### Customer Management (`/customers`)

**Features:**
- ✅ Add new customers with auto-generated customer codes (CUST-0001, CUST-0002, etc.)
- ✅ View all customers in a clean table format
- ✅ Edit customer details (name, email, phone, address)
- ✅ Delete customers (with confirmation)
- ✅ Search and filter customers
- ✅ Responsive design for mobile and desktop

**Customer Code Format:**
- Auto-generated as `CUST-XXXX` where XXXX is a sequential number
- Unique and never reused
- Used only for display purposes, not for database relations

### Invoice Management (`/invoices`)

**Features:**
- ✅ Create invoices with auto-generated invoice numbers (INV-0001, INV-0002, etc.)
- ✅ Customer search and selection with dropdown
- ✅ Auto-fill billing details from customer record
- ✅ Edit billing address before saving
- ✅ View all invoices with customer details
- ✅ Edit and delete invoices
- ✅ Proper UUID relationships between tables

**Invoice Number Format:**
- Auto-generated as `INV-XXXX` where XXXX is a sequential number
- Unique and never reused
- Used only for display purposes

## 🔧 Technical Implementation

### Database Relationships

```sql
-- Customer Master Table
customer_master (
  id UUID PRIMARY KEY,           -- Used for relationships
  customer_code TEXT UNIQUE,     -- Display only (CUST-XXXX)
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP
)

-- Invoice Table
invoice (
  id UUID PRIMARY KEY,           -- Used for relationships
  invoice_number TEXT UNIQUE,    -- Display only (INV-XXXX)
  customer_id UUID REFERENCES customer_master(id), -- UUID relationship
  billing_address TEXT,
  amount NUMERIC(10,2),
  created_at TIMESTAMP
)
```

### Key Design Principles

1. **UUID for Relationships**: Always use UUID (`id`) for database relationships
2. **Display Codes**: Customer codes and invoice numbers are for display only
3. **Auto-generation**: Codes are automatically generated using database functions
4. **Data Integrity**: Foreign key constraints ensure data consistency
5. **Search Functionality**: Customers can be searched by name or code

### Service Layer

The system includes comprehensive service functions:

**Customer Service:**
- `getAllCustomers()` - Fetch all customers
- `getCustomerById(id)` - Get specific customer
- `searchCustomers(query)` - Search by name or code
- `createCustomer(data)` - Create with auto-generated code
- `updateCustomer(id, data)` - Update customer details
- `deleteCustomer(id)` - Delete customer

**Invoice Service:**
- `getAllInvoices()` - Fetch all invoices with customer details
- `getInvoiceById(id)` - Get specific invoice
- `createInvoice(data)` - Create with auto-generated number
- `updateInvoice(id, data)` - Update invoice
- `deleteInvoice(id)` - Delete invoice

## 🎨 User Interface

### Customer Management Page

- **Add Customer Form**: Clean form with validation
- **Customer List**: Responsive table with all customer details
- **Edit/Delete Actions**: Inline actions for each customer
- **Error Handling**: Proper error messages and loading states

### Invoice Management Page

- **Customer Search**: Real-time search with dropdown results
- **Auto-fill**: Billing details automatically populated from customer
- **Invoice List**: Complete invoice history with customer details
- **Form Validation**: Ensures required fields are filled

## 🔒 Security Features

- **Row Level Security (RLS)**: Enabled on all tables
- **Authentication Required**: All operations require user authentication
- **Input Validation**: Client and server-side validation
- **Error Handling**: Secure error messages without exposing internals

## 📱 Responsive Design

- **Mobile Friendly**: Works on all screen sizes
- **Touch Optimized**: Proper touch targets for mobile devices
- **Progressive Enhancement**: Core functionality works without JavaScript

## 🚀 Performance Optimizations

- **Database Indexes**: Optimized queries with proper indexing
- **Lazy Loading**: Components load data efficiently
- **Caching**: Smart caching of customer data
- **Debounced Search**: Efficient customer search with debouncing

## 🔄 Workflow Examples

### Creating a New Customer

1. Navigate to `/customers`
2. Click "Add Customer"
3. Fill in customer details (name is required)
4. Click "Add Customer"
5. Customer is created with auto-generated code (e.g., CUST-0001)

### Creating an Invoice

1. Navigate to `/invoices`
2. Click "Create Invoice"
3. Search for customer by name or code
4. Select customer from dropdown
5. Billing address auto-fills from customer record
6. Edit billing address if needed
7. Enter amount
8. Click "Create Invoice"
9. Invoice is created with auto-generated number (e.g., INV-0001)

## 🐛 Troubleshooting

### Common Issues

**"Function not found" error:**
- Make sure you ran the complete `database-schema.sql`
- Check that the functions `generate_customer_code()` and `generate_invoice_number()` exist

**"Permission denied" error:**
- Verify RLS policies are properly set up
- Check that user is authenticated
- Ensure environment variables are correct

**Customer search not working:**
- Verify the search query is not empty
- Check network connectivity to Supabase
- Ensure customer data exists in the database

### Debug Mode

To enable debug logging, add this to your browser console:

```javascript
localStorage.setItem('debug', 'customer-service,invoice-service');
```

## 📈 Future Enhancements

Potential improvements for the system:

1. **Invoice Templates**: Customizable invoice templates
2. **Payment Tracking**: Track payment status and due dates
3. **Customer Categories**: Group customers by type or region
4. **Bulk Operations**: Import/export customer data
5. **Advanced Reporting**: Customer and invoice analytics
6. **Email Integration**: Send invoices via email
7. **PDF Generation**: Generate printable invoices

## 🎯 Best Practices

1. **Always use UUIDs** for database relationships
2. **Validate input** on both client and server
3. **Handle errors gracefully** with user-friendly messages
4. **Use proper TypeScript types** for type safety
5. **Follow React best practices** for component structure
6. **Test thoroughly** before deploying to production

---

Your customer management and billing system is now ready to use! 🎉

