import React, { useState, useMemo, useEffect } from 'react';
import { Docket, Passenger, Invoice, InvoiceLineItem, BilledTo, CompanySettings, Customer } from '../types';
import { useCompanySettings } from '../hooks';
import { formatCurrency, formatDate, amountToWords, supabaseService, supabase } from '../services';
import { Icons, FormInput, FormTextarea, FormSelect, Modal, Spinner } from './common';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface InvoiceFormModalProps {
  docketId: string;
  docket: Docket;
  passengers: Passenger[];
  onClose: () => void;
  onSaveInvoice: (invoice: Invoice) => void;
}

const generateInvoiceNumber = (lastNumber: number) => {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const nextNumber = lastNumber + 1;
    return `INV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
};

const GST_RATES = [0, 5, 12, 18, 28];
const PAYMENT_TERMS = {
    'Due on Receipt': 0,
    'Net 15': 15,
    'Net 30': 30,
    'Net 60': 60,
};

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({ docketId, docket, passengers, onClose, onSaveInvoice }) => {
  const { settings, getNextInvoiceNumber } = useCompanySettings();

  // Step management
  const [currentStep, setCurrentStep] = useState<'customer' | 'invoice'>('customer');

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Omit<Customer, 'customer_id' | 'created_at'>>({ name: '', address: '', gst_number: '', email: '', phone: '' });
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Invoice form state
  const [invoiceNumber, setInvoiceNumber] = useState(() => generateInvoiceNumber(settings.lastInvoiceNumber));
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [billedToPassengerId, setBilledToPassengerId] = useState<string>('');
  const [billedToDetails, setBilledToDetails] = useState<BilledTo | null>(null);
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [notes, setNotes] = useState("Thank you for your business. All payments are non-refundable.");
  const [gstType, setGstType] = useState<'IGST' | 'CGST/SGST'>('IGST');
  const [terms, setTerms] = useState('Due on Receipt');
  const [dueDate, setDueDate] = useState('');

  // Loading states
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCustomers = async () => {
      setCustomersLoading(true);
      const { data } = await supabaseService.listCustomers();
      setCustomers(data || []);
      setCustomersLoading(false);
    };
    loadCustomers();
  }, []);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    const { data, error } = await supabaseService.searchCustomers(searchTerm.trim());
    if (!error) setCustomers(data || []);
    setSearching(false);
  };

  const paxToCustomer = (fullName: string): Omit<Customer, 'customer_id' | 'created_at'> => ({ name: fullName, address: '', gst_number: '', email: '', phone: '' });

  const addPaxToMaster = async (fullName: string) => {
    try {
      setAddingCustomer(true);
      const payload = paxToCustomer(fullName);
      const { data, error } = await supabaseService.addCustomer(payload);
      if (error || !data) throw new Error(error || 'Failed to add');
      setCustomers(prev => [data, ...prev]);
      setSelectedCustomerId(data.customer_id);
      setMessage('Customer added successfully.');
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to add customer');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setAddingCustomer(false);
    }
  };

  // Auto-set GST type based on Place of Supply vs Company State
  useEffect(() => {
    if (placeOfSupply && settings.companyState) {
        if (placeOfSupply.trim().toLowerCase() === settings.companyState.trim().toLowerCase()) {
            setGstType('CGST/SGST');
        } else {
            setGstType('IGST');
        }
    }
  }, [placeOfSupply, settings.companyState]);
  
  // Calculate Due Date based on terms
  useEffect(() => {
    const date = new Date(invoiceDate);
    const daysToAdd = PAYMENT_TERMS[terms as keyof typeof PAYMENT_TERMS] || 0;
    date.setDate(date.getDate() + daysToAdd);
    setDueDate(date.toISOString().split('T')[0]);
  }, [invoiceDate, terms]);

  // Initialize line items from docket
  useEffect(() => {
    const initialLineItems: InvoiceLineItem[] = [];
    docket.itinerary.flights.forEach(f => {
        const paxCount = f.passengerDetails.length;
        if (paxCount > 0) {
            const totalGross = f.passengerDetails.reduce((sum, pd) => sum + pd.grossBilled, 0);
            if (totalGross > 0) {
              initialLineItems.push({
                  id: `line-${Date.now()}-flight-${f.id}`,
                  description: `Flights: ${f.airline} (${f.departureAirport}-${f.arrivalAirport}) for ${paxCount} passenger(s)`,
                  quantity: 1,
                  rate: totalGross,
                  isGstApplicable: false,
                  gstRate: 0,
              });
            }
        }
    });
    docket.itinerary.hotels.forEach(h => {
        if(h.grossBilled > 0) initialLineItems.push({ id: `line-${Date.now()}-hotel-${h.id}`, description: `Hotel: ${h.name}`, quantity: 1, rate: h.grossBilled, isGstApplicable: false, gstRate: 0 });
    });
    docket.itinerary.excursions.forEach(a => {
        if(a.grossBilled > 0) initialLineItems.push({ id: `line-${Date.now()}-excursion-${a.id}`, description: `Excursion: ${a.name}`, quantity: 1, rate: a.grossBilled, isGstApplicable: false, gstRate: 0 });
    });
    docket.itinerary.transfers.forEach(t => {
       if(t.grossBilled > 0) initialLineItems.push({ id: `line-${Date.now()}-transfer-${t.id}`, description: `Transfer: ${t.provider}`, quantity: 1, rate: t.grossBilled, isGstApplicable: false, gstRate: 0 });
    });
    setLineItems(initialLineItems);
  }, [docket]);

  // Update billing details when a passenger is selected
  useEffect(() => {
      if (billedToPassengerId) {
          const passenger = passengers.find(p => p.id === billedToPassengerId);
          if (passenger) {
              setBilledToDetails({
                  name: passenger.fullName,
                  email: passenger.email || '',
                  phone: passenger.phone || '',
                  address: passenger.address || '',
                  gstin: passenger.gstin || ''
              });
              if (passenger.address) {
                 // Basic state extraction for place of supply
                 const addressParts = passenger.address.split(',');
                 const stateGuess = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : '';
                 if (INDIAN_STATES.map(s => s.toLowerCase()).includes(stateGuess.toLowerCase())) {
                     setPlaceOfSupply(INDIAN_STATES.find(s => s.toLowerCase() === stateGuess.toLowerCase()) || '');
                 }
              }
          }
      } else {
          setBilledToDetails(null);
      }
  }, [billedToPassengerId, passengers]);

  // When selecting a customer from master
  useEffect(() => {
    if (!selectedCustomerId) return;
    const selected = customers.find(c => c.customer_id === selectedCustomerId);
    if (selected) {
      setBilledToDetails({
        name: selected.name,
        address: selected.address,
        email: selected.email || '',
        phone: selected.phone || '',
        gstin: selected.gst_number || ''
      });
    }
  }, [selectedCustomerId, customers]);

  const handleBilledToChange = (field: keyof BilledTo, value: string) => {
    setBilledToDetails(prev => {
        const newDetails: BilledTo = prev ? { ...prev } : { name: '', address: '', email: '', phone: '', gstin: '' };
        (newDetails as any)[field] = value;
        return newDetails;
    });
  };
  
  const financialTotals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0), 0);
    const gstAmount = lineItems.reduce((sum, item) => {
        if (item.isGstApplicable && item.rate && item.gstRate) {
            return sum + ((item.quantity * item.rate) * (item.gstRate / 100));
        }
        return sum;
    }, 0);
    const grandTotal = subtotal + gstAmount;
    
    const gstBreakdown: {[rate: string]: { taxableAmount: number, gstValue: number }} = {};
    lineItems.forEach(item => {
        if(item.isGstApplicable && item.gstRate > 0) {
            const taxableAmount = item.quantity * item.rate;
            const itemGst = taxableAmount * (item.gstRate / 100);
            if (!gstBreakdown[item.gstRate]) {
                gstBreakdown[item.gstRate] = { taxableAmount: 0, gstValue: 0 };
            }
            gstBreakdown[item.gstRate].taxableAmount += taxableAmount;
            gstBreakdown[item.gstRate].gstValue += itemGst;
        }
    });

    return { subtotal, gstAmount, grandTotal, gstBreakdown: Object.entries(gstBreakdown) };
  }, [lineItems]);

  const handleSaveInvoice = async () => {
    if (!billedToDetails || !billedToDetails.name) {
      alert("Please select a customer or fill in the billed to details.");
      return;
    }

    setSaving(true);
    try {
      const nextInvoiceNum = await getNextInvoiceNumber();
      const finalInvoiceNumber = generateInvoiceNumber(nextInvoiceNum - 1);
      
      const newInvoice: Invoice = {
        id: `INV-${Date.now()}`,
        invoiceNumber: finalInvoiceNumber,
        date: invoiceDate,
        billedTo: billedToDetails,
        lineItems,
        notes,
        placeOfSupply,
        subtotal: financialTotals.subtotal,
        gstAmount: financialTotals.gstAmount,
        grandTotal: financialTotals.grandTotal,
        gstType,
        companySettings: { ...settings },
        terms,
        dueDate,
        customerId: selectedCustomerId || undefined,
        docketId: docket.id
      };
      
      // Save to database
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        alert("User not authenticated. Please log in again.");
        return;
      }

      const { error: dbError } = await supabaseService.addInvoice(newInvoice, currentUser.user.id);
      if (dbError) {
        console.error("Error saving invoice to database:", dbError);
        alert(`Failed to save invoice: ${dbError}`);
        return;
      }

      // Call the parent callback to update local state
      onSaveInvoice(newInvoice);

      // Generate PDF
      await new Promise(resolve => setTimeout(resolve, 200));

      const invoiceElement = document.getElementById('invoice-preview');
      if (invoiceElement) {
        try {
          const canvas = await html2canvas(invoiceElement, { scale: 2, useCORS: true });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const imgHeight = (canvas.height * pdfWidth) / canvas.width;

          let heightLeft = imgHeight;
          let position = 0;

          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pageHeight;

          while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pageHeight;
          }

          // Add page numbers
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(10);
            pdf.setTextColor(120);
            pdf.text(`Page ${i} of ${totalPages}`, pdfWidth - 30, pageHeight - 10);
          }

          pdf.save(`Invoice-${finalInvoiceNumber}.pdf`);
        } catch (error) {
          console.error("Error generating PDF:", error);
          alert("An error occurred while generating the PDF.");
        }
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error("Error in invoice save process:", error);
      alert("An error occurred while saving the invoice.");
    } finally {
      setSaving(false);
    }
  };

  const handleLineItemChange = (id: string, field: keyof InvoiceLineItem, value: string | number | boolean) => {
      setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addLineItem = () => {
      setLineItems(prev => [...prev, { id: `line-${Date.now()}`, description: '', quantity: 1, rate: 0, isGstApplicable: false, gstRate: 0 }]);
  };

  const removeLineItem = (id: string) => {
      setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.address) {
      alert('Please fill in Name and Address for the new customer.');
      return;
    }
    setAddingCustomer(true);
    const { data, error } = await supabaseService.addCustomer(newCustomer);
    setAddingCustomer(false);
    if (error || !data) {
      alert(error || 'Failed to add customer.');
      return;
    }
    setCustomers(prev => [data, ...prev]);
    setSelectedCustomerId(data.customer_id);
    setAddCustomerOpen(false);
    setNewCustomer({ name: '', address: '', gst_number: '', email: '', phone: '' });
  };

  const lineGross = (item: InvoiceLineItem) => {
    const base = item.quantity * item.rate;
    return item.isGstApplicable && item.gstRate ? base * (1 + item.gstRate / 100) : base;
  };

  const lineNet = (item: InvoiceLineItem) => {
    return item.quantity * item.rate;
  };

  const formatPercent = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '')}%`;

  const effectiveGstRate = useMemo(() => {
    const gstTaxableBase = (financialTotals.gstBreakdown || []).reduce((sum, entry) => {
      const [, info] = entry as [string, { taxableAmount: number; gstValue: number }];
      return sum + (info?.taxableAmount || 0);
    }, 0);
    
    if (gstTaxableBase <= 0) return 0;
    return (financialTotals.gstAmount / gstTaxableBase) * 100;
  }, [financialTotals]);

  const renderCustomerStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Step 1: Choose Customer</h3>
        <p className="text-slate-600">Select a customer from the docket passengers or customer master</p>
      </div>

      <div className="border rounded-lg p-4 bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-md font-semibold text-slate-700">Select Customer / Add Customer</h3>
          <button onClick={() => setAddCustomerOpen(true)} className="text-sm font-semibold text-brand-primary">{Icons.plus} Add New Customer</button>
        </div>

        {message && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 mb-3">{message}</div>
        )}
        {errorMessage && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-3">{errorMessage}</div>
        )}

        {/* Option A: Select from Pax */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-slate-600 mb-1">Pick from Docket Pax</label>
          <div className="flex flex-wrap gap-2">
            {docket.passengers.map(p => {
              const existing = customers.find(c => c.name.toLowerCase() === p.fullName.toLowerCase());
              return (
                <div key={p.id} className="flex items-center gap-2 bg-white border rounded-md px-3 py-1">
                  <button type="button" onClick={() => {
                    if (existing) {
                      setSelectedCustomerId(existing.customer_id);
                    } else {
                      setBilledToDetails({ name: p.fullName, address: p.address || '', email: p.email || '', phone: p.phone || '', gstin: p.gstin || '' });
                    }
                  }} className="text-sm font-medium text-brand-primary hover:underline">{p.fullName}</button>
                  {!existing && (
                    <button type="button" onClick={() => addPaxToMaster(p.fullName)} className="text-xs text-slate-600 hover:text-slate-900">Add to Master</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Option B: Search from Customer Master */}
        <div className="flex items-end gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-600 mb-1">Search Customers (name / email / phone)</label>
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 border bg-white border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary text-slate-900" placeholder="Type to search..." />
          </div>
          <button type="button" onClick={handleSearch} className="px-4 py-2 bg-slate-200 rounded-md">{searching ? 'Searching...' : 'Search'}</button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <FormSelect label="Customer Master" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
              <option value="">-- Select from Customer Master --</option>
              {customers.map(c => (<option key={c.customer_id} value={c.customer_id}>{c.name}</option>))}
            </FormSelect>
          </div>
          {customersLoading && <Spinner size="sm" />}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md">Cancel</button>
        <button 
          onClick={() => setCurrentStep('invoice')} 
          disabled={!billedToDetails?.name}
          className="px-4 py-2 bg-brand-primary text-white rounded-md disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          Next: Invoice Details
        </button>
      </div>
    </div>
  );

  const renderInvoiceStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Step 2: Invoice Details</h3>
        <p className="text-slate-600">Review and customize the invoice details</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Customer Column */}
        <div className="space-y-4">
          <FormSelect label="Quick-fill from Passenger" value={billedToPassengerId} onChange={e => setBilledToPassengerId(e.target.value)}>
            <option value="">-- Select Passenger to Autofill --</option>
            {passengers.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </FormSelect>
          <FormInput 
            label="Customer Name*" 
            value={billedToDetails?.name || ''} 
            onChange={e => handleBilledToChange('name', e.target.value)}
            placeholder="Enter customer's full name"
          />
          <FormTextarea
            label="Customer Address*"
            value={billedToDetails?.address || ''}
            onChange={e => handleBilledToChange('address', e.target.value)}
            placeholder="Enter customer's billing address"
            rows={3}
          />
          <FormInput label="Email" value={billedToDetails?.email || ''} onChange={e => handleBilledToChange('email', e.target.value)} />
          <FormInput label="Phone" value={billedToDetails?.phone || ''} onChange={e => handleBilledToChange('phone', e.target.value)} />
          <FormInput label="GSTIN" value={billedToDetails?.gstin || ''} onChange={e => handleBilledToChange('gstin', e.target.value)} />
        </div>
        {/* Invoice Details Column */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput label="Invoice#*" type="text" readOnly value={invoiceNumber} containerClassName="col-span-2"/>
          <FormInput label="Invoice Date*" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} icon={Icons.calendar} />
          <FormSelect label="Terms" value={terms} onChange={e => setTerms(e.target.value)}>{Object.keys(PAYMENT_TERMS).map(t => <option key={t}>{t}</option>)}</FormSelect>
          <FormInput label="Due Date" type="date" value={dueDate} readOnly />
          <FormSelect 
            label="Place of Supply" 
            containerClassName="col-span-2" 
            value={placeOfSupply} 
            onChange={e => setPlaceOfSupply(e.target.value)}
          >
            <option value="">-- Select State/UT --</option>
            {INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
          </FormSelect>
          <FormSelect label="GST Type (Override)" containerClassName="col-span-2" value={gstType} onChange={e => setGstType(e.target.value as 'IGST' | 'CGST/SGST')}>
            <option value="IGST">IGST (Interstate)</option>
            <option value="CGST/SGST">CGST/SGST (Intrastate)</option>
          </FormSelect>
        </div>
      </div>

      {/* Item Table */}
      <div className="border-t pt-6">
        <div className="hidden md:grid grid-cols-12 gap-3 px-2 py-2 font-semibold text-xs text-slate-500 uppercase">
          <div className="col-span-5">Item Details</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-2 text-right">Unit Price</div>
          <div className="col-span-2 text-right">Tax %</div>
          <div className="col-span-2 text-right">Line Total</div>
        </div>
        <div className="space-y-2">
          {lineItems.map((item, index) => {
            const amount = lineGross(item);
            return (
              <div key={item.id} className="grid grid-cols-12 gap-x-3 gap-y-2 p-2 rounded-md hover:bg-slate-50 items-start">
                <div className="col-span-12 md:col-span-5"><FormTextarea label="" value={item.description} onChange={e => handleLineItemChange(item.id, 'description', e.target.value)} placeholder="Item Description" rows={2} /></div>
                <div className="col-span-4 md:col-span-1"><FormInput label="" type="number" value={item.quantity} onChange={e => handleLineItemChange(item.id, 'quantity', +e.target.value)} placeholder="Qty" className="text-right" /></div>
                <div className="col-span-8 md:col-span-2"><FormInput label="" type="number" value={item.rate} onChange={e => handleLineItemChange(item.id, 'rate', +e.target.value)} placeholder="Unit Price" className="text-right" /></div>
                <div className="col-span-8 md:col-span-2">
                  <div className="flex items-center justify-end h-full">
                    <FormSelect label="" value={item.gstRate} onChange={e => handleLineItemChange(item.id, 'gstRate', +e.target.value)} onFocus={()=>handleLineItemChange(item.id, 'isGstApplicable', true)}>
                      {GST_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                    </FormSelect>
                  </div>
                </div>
                <div className="col-span-4 md:col-span-2 flex items-center justify-between h-full">
                  <p className="text-sm font-medium text-slate-800 text-right w-full pr-2">{formatCurrency(amount)}</p>
                  <button onClick={() => removeLineItem(item.id)} className="text-slate-400 hover:text-red-500">{React.cloneElement(Icons.trash, {className:"h-4 w-4"})}</button>
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={addLineItem} className="mt-4 text-sm font-semibold text-brand-primary flex items-center gap-1">{Icons.plus} Add New Row</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
        <FormTextarea label="Customer Notes (will be displayed on the invoice)" value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium text-slate-800">{formatCurrency(financialTotals.subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Total GST</span>
            <span className="font-medium text-slate-800">{formatCurrency(financialTotals.gstAmount)}</span>
          </div>
          <div className="flex justify-between items-center text-lg font-bold pt-2 border-t mt-2">
            <span className="text-slate-800">Total</span>
            <span className="text-slate-900">{formatCurrency(financialTotals.grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => setCurrentStep('customer')} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md">Back</button>
        <button 
          onClick={handleSaveInvoice} 
          disabled={saving || !billedToDetails?.name}
          className="px-4 py-2 bg-brand-primary text-white rounded-md disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? <Spinner size="sm" /> : null}
          Save & Download PDF
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-800 bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Generate Invoice</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 'customer' ? renderCustomerStep() : renderInvoiceStep()}
        </div>

        {/* Invoice Preview (hidden for PDF generation) */}
        <div id="invoice-preview" className="hidden">
          <div className="bg-white shadow-lg p-10 mx-auto" style={{width: '210mm', minHeight: '297mm'}}>
            {/* Header */}
            <div className="flex justify-between items-start pb-6 mb-8 border-b-2 border-slate-200">
              <div className="flex items-start">
                <div>
                  {settings.companyName ? <h1 className="text-2xl font-extrabold text-slate-900">{settings.companyName}</h1> : <div className="w-48 h-6 bg-slate-200 rounded animate-pulse"></div>}
                  <p className="text-slate-500 whitespace-pre-line mt-1 text-sm leading-5">{settings.companyAddress}</p>
                  <p className="text-slate-500 text-sm">{settings.companyContact}</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-bold uppercase text-slate-800">{settings.gstNumber ? 'Tax Invoice' : 'Invoice'}</h2>
                <p className="text-slate-600 mt-2 font-medium"># {invoiceNumber}</p>
                <div className="text-xs text-slate-600 mt-1">
                  <p>Invoice Date: {formatDate(invoiceDate)}</p>
                  <p>Due Date: {formatDate(dueDate)}</p>
                  <p>Place of Supply: {placeOfSupply || 'N/A'}</p>
                  {settings.gstNumber && <p className="mt-1">Agency GSTIN: {settings.gstNumber}</p>}
                </div>
              </div>
            </div>
            
            {/* Recipient */}
            <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
              <div>
                <h4 className="font-semibold text-slate-600 mb-1">Billed To</h4>
                {billedToDetails ? (
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-900">{billedToDetails.name}</p>
                    {billedToDetails.address && <p className="text-slate-700 whitespace-pre-line">{billedToDetails.address}</p>}
                    {billedToDetails.email && <p className="text-slate-700">{billedToDetails.email}</p>}
                    {billedToDetails.phone && <p className="text-slate-700">{billedToDetails.phone}</p>}
                    {billedToDetails.gstin && <p className="text-slate-700">GSTIN: {billedToDetails.gstin}</p>}
                  </div>
                ) : <p className="text-slate-400 italic">Select a customer</p>}
              </div>
              <div className="text-right">
                <h4 className="font-semibold text-slate-600 mb-1">Remit To</h4>
                <div className="text-slate-700 text-sm">
                  <p>Bank: {settings.bankName}</p>
                  <p>A/C No: {settings.accountNumber}</p>
                  <p>IFSC: {settings.ifscCode}</p>
                </div>
              </div>
            </div>
            
            {/* Items Table */}
            <table className="w-full mb-8 text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-xs">
                  <th className="text-left p-2 font-semibold">Item Description</th>
                  <th className="text-right p-2 font-semibold">Qty</th>
                  <th className="text-right p-2 font-semibold">Unit Price</th>
                  <th className="text-right p-2 font-semibold">Net Cost</th>
                  <th className="text-right p-2 font-semibold">Tax %</th>
                  <th className="text-right p-2 font-semibold">Gross Cost</th>
                  <th className="text-right p-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 align-top">{item.description}</td>
                    <td className="text-right p-2 align-top">{item.quantity}</td>
                    <td className="text-right p-2 align-top">{formatCurrency(item.rate)}</td>
                    <td className="text-right p-2 align-top">{formatCurrency(lineNet(item))}</td>
                    <td className="text-right p-2 align-top">{item.isGstApplicable ? `${item.gstRate}%` : '0%'}</td>
                    <td className="text-right p-2 align-top">{formatCurrency(lineGross(item))}</td>
                    <td className="text-right p-2 align-top">{formatCurrency(lineGross(item))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div className="flex justify-between gap-8 mb-8">
              <div className="text-xs text-slate-600 max-w-md">
                <h4 className="font-semibold text-slate-600 mb-1">Amount in Words:</h4>
                <p>{amountToWords(financialTotals.grandTotal)} Only.</p>
              </div>
              <div className="w-full max-w-sm space-y-2 text-sm">
                <div className="flex justify-between text-slate-800">
                  <span>Subtotal</span>
                  <span>{formatCurrency(financialTotals.subtotal)}</span>
                </div>

                {financialTotals.gstAmount > 0 && (
                  <>
                    {gstType === 'CGST/SGST' ? (
                      <>
                        <div className="flex justify-between text-slate-800">
                          <span>{`CGST @ ${formatPercent(effectiveGstRate / 2)}`}</span>
                          <span>{formatCurrency(financialTotals.gstAmount / 2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-800">
                          <span>{`SGST @ ${formatPercent(effectiveGstRate / 2)}`}</span>
                          <span>{formatCurrency(financialTotals.gstAmount / 2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-slate-800">
                        <span>{`IGST @ ${formatPercent(effectiveGstRate)}`}</span>
                        <span>{formatCurrency(financialTotals.gstAmount)}</span>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-between font-bold text-base text-slate-900 border-t pt-2 mt-2">
                  <span>Grand Total</span>
                  <span>{formatCurrency(financialTotals.grandTotal)}</span>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="border-t border-slate-200 pt-4 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-600 mb-1">Company Info</h4>
                  <p className="whitespace-pre-line">{settings.companyAddress}</p>
                  <p>{settings.companyContact}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-600 mb-1">Terms & Conditions</h4>
                  <p className="whitespace-pre-line">{notes}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Customer Modal */}
        <Modal isOpen={addCustomerOpen} onClose={() => setAddCustomerOpen(false)} title="Add New Customer">
          <div className="space-y-4">
            <FormInput label="Customer Name*" value={newCustomer.name} onChange={e => setNewCustomer(prev => ({...prev, name: e.target.value}))} />
            <FormTextarea label="Address*" value={newCustomer.address} onChange={e => setNewCustomer(prev => ({...prev, address: e.target.value}))} rows={3} />
            <FormInput label="GST Number" value={newCustomer.gst_number} onChange={e => setNewCustomer(prev => ({...prev, gst_number: e.target.value}))} />
            <FormInput label="Email" value={newCustomer.email || ''} onChange={e => setNewCustomer(prev => ({...prev, email: e.target.value}))} />
            <FormInput label="Phone" value={newCustomer.phone || ''} onChange={e => setNewCustomer(prev => ({...prev, phone: e.target.value}))} />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setAddCustomerOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
              <button onClick={handleAddCustomer} disabled={addingCustomer} className="px-4 py-2 bg-brand-primary text-white rounded-md disabled:opacity-70">{addingCustomer ? 'Saving...' : 'Save Customer'}</button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};