-- Database Schema for Leads Pipeline
-- This file contains the SQL commands to create the necessary tables for leads management

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    company VARCHAR(255),
    source VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('cold', 'warm', 'final')),
    description TEXT,
    assigned_to VARCHAR(255),
    expected_value DECIMAL(12,2) DEFAULT 0,
    created_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_contact_date DATE,
    next_follow_up_date DATE,
    notes TEXT,
    travel_dates JSONB NOT NULL DEFAULT '{"departureDate": "", "returnDate": ""}',
    number_of_pax INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lead itinerary table
CREATE TABLE IF NOT EXISTS lead_itinerary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 10),
    itinerary_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lead_id, day_number)
);

-- Create lead quotation table
CREATE TABLE IF NOT EXISTS lead_quotation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    flights DECIMAL(12,2) DEFAULT 0,
    hotels DECIMAL(12,2) DEFAULT 0,
    excursions DECIMAL(12,2) DEFAULT 0,
    transfers DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lead_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_date ON leads(created_date);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_lead_itinerary_lead_id ON lead_itinerary(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_quotation_lead_id ON lead_quotation(lead_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_itinerary_updated_at BEFORE UPDATE ON lead_itinerary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_quotation_updated_at BEFORE UPDATE ON lead_quotation
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate quotation total
CREATE OR REPLACE FUNCTION calculate_quotation_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total = COALESCE(NEW.flights, 0) + COALESCE(NEW.hotels, 0) + COALESCE(NEW.excursions, 0) + COALESCE(NEW.transfers, 0);
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically calculate quotation total
CREATE TRIGGER calculate_quotation_total_trigger BEFORE INSERT OR UPDATE ON lead_quotation
    FOR EACH ROW EXECUTE FUNCTION calculate_quotation_total();

-- Create view for leads with complete information
CREATE OR REPLACE VIEW leads_complete AS
SELECT 
    l.*,
    COALESCE(q.flights, 0) as quotation_flights,
    COALESCE(q.hotels, 0) as quotation_hotels,
    COALESCE(q.excursions, 0) as quotation_excursions,
    COALESCE(q.transfers, 0) as quotation_transfers,
    COALESCE(q.total, 0) as quotation_total,
    jsonb_object_agg(
        'day' || li.day_number, 
        li.itinerary_text
    ) FILTER (WHERE li.itinerary_text IS NOT NULL) as itinerary
FROM leads l
LEFT JOIN lead_quotation q ON l.id = q.lead_id
LEFT JOIN lead_itinerary li ON l.id = li.lead_id
GROUP BY l.id, q.flights, q.hotels, q.excursions, q.transfers, q.total;

-- Insert sample data for testing
INSERT INTO leads (name, email, phone, company, source, status, description, assigned_to, expected_value, notes, travel_dates, number_of_pax) VALUES
('John Smith', 'john@example.com', '+91 98765 43210', 'Tech Corp', 'Website', 'cold', 'Interested in Goa package', 'Agent 1', 50000, 'Initial contact made', '{"departureDate": "2024-12-15", "returnDate": "2024-12-20"}', 2),
('Sarah Johnson', 'sarah@example.com', '+91 98765 43211', 'Travel Co', 'Referral', 'warm', 'Kerala backwaters package', 'Agent 2', 75000, 'Quotation sent, waiting for response', '{"departureDate": "2024-12-25", "returnDate": "2024-12-31"}', 4),
('Mike Wilson', 'mike@example.com', '+91 98765 43212', 'Business Inc', 'Cold Call', 'final', 'Rajasthan heritage tour', 'Agent 1', 100000, 'Ready to convert to docket', '{"departureDate": "2024-01-10", "returnDate": "2024-01-17"}', 6)
ON CONFLICT DO NOTHING;

-- Insert sample itinerary data
INSERT INTO lead_itinerary (lead_id, day_number, itinerary_text) 
SELECT l.id, 1, 'Arrival in Goa, Check-in at hotel' FROM leads l WHERE l.name = 'John Smith'
UNION ALL
SELECT l.id, 2, 'Beach activities, Water sports' FROM leads l WHERE l.name = 'John Smith'
UNION ALL
SELECT l.id, 3, 'Old Goa churches tour' FROM leads l WHERE l.name = 'John Smith'
UNION ALL
SELECT l.id, 4, 'Spice plantation visit' FROM leads l WHERE l.name = 'John Smith'
UNION ALL
SELECT l.id, 5, 'Departure' FROM leads l WHERE l.name = 'John Smith'
UNION ALL
SELECT l.id, 1, 'Arrival in Kochi' FROM leads l WHERE l.name = 'Sarah Johnson'
UNION ALL
SELECT l.id, 2, 'Munnar hill station' FROM leads l WHERE l.name = 'Sarah Johnson'
UNION ALL
SELECT l.id, 3, 'Thekkady wildlife' FROM leads l WHERE l.name = 'Sarah Johnson'
UNION ALL
SELECT l.id, 4, 'Kumarakom backwaters' FROM leads l WHERE l.name = 'Sarah Johnson'
UNION ALL
SELECT l.id, 5, 'Alleppey houseboat' FROM leads l WHERE l.name = 'Sarah Johnson'
UNION ALL
SELECT l.id, 6, 'Departure' FROM leads l WHERE l.name = 'Sarah Johnson'
UNION ALL
SELECT l.id, 1, 'Arrival in Jaipur' FROM leads l WHERE l.name = 'Mike Wilson'
UNION ALL
SELECT l.id, 2, 'Jaipur city tour' FROM leads l WHERE l.name = 'Mike Wilson'
UNION ALL
SELECT l.id, 3, 'Jodhpur blue city' FROM leads l WHERE l.name = 'Mike Wilson'
UNION ALL
SELECT l.id, 4, 'Jaisalmer desert' FROM leads l WHERE l.name = 'Mike Wilson'
UNION ALL
SELECT l.id, 5, 'Udaipur lake city' FROM leads l WHERE l.name = 'Mike Wilson'
UNION ALL
SELECT l.id, 6, 'Pushkar temple' FROM leads l WHERE l.name = 'Mike Wilson'
UNION ALL
SELECT l.id, 7, 'Departure' FROM leads l WHERE l.name = 'Mike Wilson'
ON CONFLICT DO NOTHING;

-- Insert sample quotation data
INSERT INTO lead_quotation (lead_id, flights, hotels, excursions, transfers) 
SELECT l.id, 15000, 20000, 8000, 2000 FROM leads l WHERE l.name = 'John Smith'
UNION ALL
SELECT l.id, 20000, 30000, 15000, 5000 FROM leads l WHERE l.name = 'Sarah Johnson'
UNION ALL
SELECT l.id, 25000, 40000, 20000, 8000 FROM leads l WHERE l.name = 'Mike Wilson'
ON CONFLICT DO NOTHING;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON TABLE leads TO your_app_user;
-- GRANT ALL PRIVILEGES ON TABLE lead_itinerary TO your_app_user;
-- GRANT ALL PRIVILEGES ON TABLE lead_quotation TO your_app_user;
-- GRANT ALL PRIVILEGES ON VIEW leads_complete TO your_app_user;
