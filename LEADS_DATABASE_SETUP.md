# Leads Database Setup Guide

This guide will help you set up the database tables and functionality for the Leads Pipeline feature.

## 🗄️ Database Schema Setup

### 1. Run the Database Schema

Execute the SQL commands in `database-schema-leads.sql` in your Supabase SQL editor:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `database-schema-leads.sql`
4. Click "Run" to execute the commands

This will create:
- `leads` table - Main lead information
- `lead_itinerary` table - Day-wise itinerary details
- `lead_quotation` table - Quotation breakdown
- Indexes for better performance
- Triggers for automatic calculations
- Sample data for testing

### 2. Verify the Setup

After running the schema, you should see:

#### Tables Created:
- ✅ `leads` - Main lead data
- ✅ `lead_itinerary` - Itinerary details
- ✅ `lead_quotation` - Quotation information

#### Sample Data:
- ✅ 3 sample leads (John Smith, Sarah Johnson, Mike Wilson)
- ✅ Itinerary data for each lead
- ✅ Quotation data for each lead

## 🔧 Environment Variables

Ensure your `.env.local` file has the correct Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🚀 Testing the Setup

### 1. Check Database Connection

1. Open your application
2. Navigate to the "Leads Pipeline" section
3. You should see the 3 sample leads loaded from the database

### 2. Test CRUD Operations

#### Create Lead:
1. Click "Add New Lead"
2. Fill in the form with test data
3. Click "Add Lead"
4. Verify the lead appears in the list

#### Update Lead:
1. Click "Edit" on any lead
2. Modify some fields
3. Click "Update Lead"
4. Verify changes are saved

#### Delete Lead:
1. Click "Delete" on any lead
2. Confirm deletion
3. Verify lead is removed from the list

## 📊 Database Structure

### Leads Table
```sql
leads (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  company VARCHAR(255),
  source VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  description TEXT,
  assigned_to VARCHAR(255),
  expected_value DECIMAL(12,2),
  created_date DATE,
  last_contact_date DATE,
  next_follow_up_date DATE,
  notes TEXT,
  travel_dates JSONB,
  number_of_pax INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Lead Itinerary Table
```sql
lead_itinerary (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  day_number INTEGER (1-10),
  itinerary_text TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Lead Quotation Table
```sql
lead_quotation (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  flights DECIMAL(12,2),
  hotels DECIMAL(12,2),
  excursions DECIMAL(12,2),
  transfers DECIMAL(12,2),
  total DECIMAL(12,2),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## 🔄 Automatic Features

### Triggers:
- **Updated At**: Automatically updates `updated_at` timestamp
- **Quotation Total**: Automatically calculates total from flights, hotels, excursions, and transfers

### Indexes:
- Status filtering
- Email searches
- Date-based queries
- Foreign key relationships

## 🛠️ Troubleshooting

### Common Issues:

#### 1. "Failed to load leads" Error
- Check Supabase URL and API key in `.env.local`
- Verify database tables exist
- Check browser console for detailed error

#### 2. Leads Not Saving
- Ensure RLS (Row Level Security) is disabled or properly configured
- Check Supabase logs for permission errors
- Verify table structure matches the schema

#### 3. Missing Data
- Run the sample data insertion commands again
- Check if tables were created successfully
- Verify foreign key relationships

### Debug Steps:
1. Check browser console for errors
2. Verify Supabase connection in Network tab
3. Test database queries in Supabase SQL editor
4. Check RLS policies if enabled

## 📈 Performance Considerations

### Indexes:
- All foreign keys are indexed
- Status and email fields are indexed
- Date fields are indexed for sorting

### Query Optimization:
- Uses efficient JOINs for related data
- Implements proper pagination (can be added)
- Optimized for common filtering scenarios

## 🔐 Security Notes

### Row Level Security (RLS):
- Currently disabled for simplicity
- Enable RLS and add policies for production
- Consider user-based access control

### Data Validation:
- Client-side validation implemented
- Server-side validation recommended for production
- Input sanitization should be added

## 🚀 Next Steps

### Production Considerations:
1. Enable Row Level Security
2. Add user authentication
3. Implement audit logging
4. Add data backup strategies
5. Set up monitoring and alerts

### Feature Enhancements:
1. Lead conversion to docket
2. Email notifications
3. Lead scoring
4. Advanced filtering
5. Export functionality
6. Bulk operations

---

## ✅ Setup Checklist

- [ ] Database schema executed
- [ ] Sample data inserted
- [ ] Environment variables configured
- [ ] Application loads leads successfully
- [ ] Create/Update/Delete operations work
- [ ] Error handling tested
- [ ] Performance verified

Your Leads Pipeline is now ready to use with persistent database storage! 🎉
