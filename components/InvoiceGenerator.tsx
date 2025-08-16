import React, { useState, useMemo, useEffect } from 'react';
import { Docket, Passenger, Invoice, InvoiceLineItem, BilledTo, CompanySettings, Customer } from '../types';
import { useCompanySettings } from '../hooks';
import { formatCurrency, formatDate, amountToWords } from '../services';
import { Icons, FormInput, FormTextarea, FormSelect, Modal, Spinner } from './common';
import { CustomerSelector } from './CustomerSelector';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface InvoiceGeneratorProps {
  docket: Docket;
  passengers: Passenger[];
  customers: Customer[];
  saveCustomer: (customer: Omit<Customer, 'customer_id' | 'created_at'>) => Promise<string>;
  onClose: () => void;
  onSaveInvoice: (invoice: Invoice, customerId: string) => void;
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


export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ docket, passengers, customers, saveCustomer, onClose, onSaveInvoice }) => {
  const { settings, getNextInvoiceNumber } = useCompanySettings();

  // Component State
  const [invoiceNumber, setInvoiceNumber] = useState(() => generateInvoiceNumber(settings.lastInvoiceNumber));
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [billedToDetails, setBilledToDetails] = useState<BilledTo | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    customerAddress: '',
    customerEmail: '',
    customerPhone: '',
    customerGst: ''
  });
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [notes, setNotes] = useState("Thank you for your business. All payments are non-refundable.");
  const [gstType, setGstType] = useState<'IGST' | 'CGST/SGST'>('IGST');
  const [terms, setTerms] = useState('Due on Receipt');
  const [dueDate, setDueDate] = useState('');
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [loading, setLoading] = useState(false);

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
      if (billedToDetails) {
          setBilledToDetails({
              name: billedToDetails.name,
              email: billedToDetails.email || '',
              phone: billedToDetails.phone || '',
              address: billedToDetails.address || '',
              gstin: billedToDetails.gstin || ''
          });
          if (billedToDetails.address) {
             // Basic state extraction for place of supply
             const addressParts = billedToDetails.address.split(',');
             const stateGuess = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : '';
             if (INDIAN_STATES.map(s => s.toLowerCase()).includes(stateGuess.toLowerCase())) {
                 setPlaceOfSupply(INDIAN_STATES.find(s => s.toLowerCase() === stateGuess.toLowerCase()) || '');
             }
          }
      } else {
          setBilledToDetails(null);
      }
  }, [billedToDetails]);

  const handleCustomerSelect = (billedTo: BilledTo) => {
    setBilledToDetails(billedTo);
    setShowCustomerSelector(false);
    
    // Find the selected customer from the customers array
    const customer = customers.find(c => 
      c.name === billedTo.name && 
      c.email === billedTo.email
    );
    setSelectedCustomer(customer || null);
    
    // Populate form data with customer details
    setFormData({
      customerName: billedTo.name || '',
      customerAddress: billedTo.address || '',
      customerEmail: billedTo.email || '',
      customerPhone: billedTo.phone || '',
      customerGst: billedTo.gstin || ''
    });
    
    // Auto-set place of supply from address
    if (billedTo.address) {
      const addressParts = billedTo.address.split(',');
      const stateGuess = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : '';
      if (INDIAN_STATES.map(s => s.toLowerCase()).includes(stateGuess.toLowerCase())) {
        setPlaceOfSupply(INDIAN_STATES.find(s => s.toLowerCase() === stateGuess.toLowerCase()) || '');
      }
    }
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

  // Compute effective GST rate across all GST-applicable items
  const gstTaxableBase = useMemo(() => {
    return (financialTotals.gstBreakdown || []).reduce((sum, entry) => {
      const [, info] = entry as [string, { taxableAmount: number; gstValue: number }];
      return sum + (info?.taxableAmount || 0);
    }, 0);
  }, [financialTotals]);

  const effectiveGstRate = useMemo(() => {
    if (gstTaxableBase <= 0) return 0;
    return (financialTotals.gstAmount / gstTaxableBase) * 100;
  }, [financialTotals, gstTaxableBase]);

  const formatPercent = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '')}%`;

  const handleSaveAndDownload = async () => {
    if (!formData.customerName.trim()) {
      alert("Please enter a customer name.");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Upsert customer data
      let customerId: string;
      
      if (selectedCustomer) {
        // Update existing customer if data has changed
        const hasChanges = 
          selectedCustomer.name !== formData.customerName ||
          selectedCustomer.address !== formData.customerAddress ||
          selectedCustomer.email !== formData.customerEmail ||
          selectedCustomer.phone !== formData.customerPhone ||
          selectedCustomer.gst_number !== formData.customerGst;
        
        if (hasChanges) {
          // For now, we'll create a new customer record
          // In a full implementation, you might want to add an updateCustomer function
          customerId = await saveCustomer({
            name: formData.customerName,
            address: formData.customerAddress,
            email: formData.customerEmail,
            phone: formData.customerPhone,
            gst_number: formData.customerGst
          });
        } else {
          customerId = selectedCustomer.customer_id;
        }
      } else {
        // Create new customer
        customerId = await saveCustomer({
          name: formData.customerName,
          address: formData.customerAddress,
          email: formData.customerEmail,
          phone: formData.customerPhone,
          gst_number: formData.customerGst
        });
      }

      // Step 2: Generate invoice number
      const nextInvoiceNum = await getNextInvoiceNumber();
      const finalInvoiceNumber = generateInvoiceNumber(nextInvoiceNum - 1);
      
      setInvoiceNumber(finalInvoiceNumber); // Set for immediate preview update
      
      // Step 3: Create invoice object with current form data
      const newInvoice: Invoice = {
        id: `INV-${Date.now()}`,
        invoiceNumber: finalInvoiceNumber,
        date: invoiceDate,
        billedTo: {
          name: formData.customerName,
          address: formData.customerAddress,
          email: formData.customerEmail,
          phone: formData.customerPhone,
          gstin: formData.customerGst
        },
        lineItems,
        notes,
        placeOfSupply,
        subtotal: financialTotals.subtotal,
        gstAmount: financialTotals.gstAmount,
        grandTotal: financialTotals.grandTotal,
        gstType,
        companySettings: { ...settings },
        terms,
        dueDate
      };
      
      // Step 4: Save invoice
      onSaveInvoice(newInvoice, customerId);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 5: Generate PDF
      const invoiceElement = document.getElementById('invoice-preview');
      if (!invoiceElement) {
        alert('Could not find invoice element to download.');
        return;
      }

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
    } catch (error) {
      console.error("Error saving invoice:", error);
      alert(`Failed to save invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
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
  
  // Helpers for line totals
  const lineNet = (item: InvoiceLineItem) => (Number(item.quantity) || 0) * (Number(item.rate) || 0);
  const lineTax = (item: InvoiceLineItem) => item.isGstApplicable && item.gstRate ? lineNet(item) * (item.gstRate / 100) : 0;
  const lineGross = (item: InvoiceLineItem) => lineNet(item) + lineTax(item);

  return (
    <div className="fixed inset-0 bg-slate-800 bg-opacity-90 z-50 flex items-center justify-center p-0 md:p-4">
      <div className="bg-slate-50 rounded-lg shadow-2xl w-full h-full flex flex-col overflow-hidden">
        <div className="p-4 bg-white border-b flex justify-between items-center print:hidden flex-wrap gap-2">
          <h2 className="text-xl font-bold text-slate-800">Invoice Generator</h2>
          <div>
            <button 
              onClick={handleSaveAndDownload} 
              disabled={loading}
              className="bg-brand-primary text-white px-4 py-2 rounded-md mr-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                'Save & Download PDF'
              )}
            </button>
            <button onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md text-sm">Close</button>
          </div>
        </div>
        <div className="flex-grow flex flex-col lg:flex-row overflow-auto">
          {/* Form Side */}
          <div className="w-full lg:w-2/5 p-4 sm:p-6 bg-white overflow-y-auto print:hidden">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* Customer Column */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Customer *
                                </label>
                                {(formData.customerName || selectedCustomer) ? (
                                    <div className="p-3 border border-gray-300 rounded-md bg-gray-50">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-gray-900">{formData.customerName || selectedCustomer?.name}</div>
                                                {(formData.customerEmail || selectedCustomer?.email) && (
                                                    <div className="text-sm text-gray-500">{formData.customerEmail || selectedCustomer?.email}</div>
                                                )}
                                                {(formData.customerPhone || selectedCustomer?.phone) && (
                                                    <div className="text-sm text-gray-500">{formData.customerPhone || selectedCustomer?.phone}</div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setShowCustomerSelector(true)}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowCustomerSelector(true)}
                                        className="w-full p-3 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            {Icons.userPlus}
                                            <span>Select Customer</span>
                                        </div>
                                    </button>
                                )}
                            </div>
                            <FormInput 
                                label="Customer Name*" 
                                value={formData.customerName ?? selectedCustomer?.name ?? ""} 
                                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                placeholder="Enter customer's full name"
                            />
                            <FormTextarea
                                label="Customer Address*"
                                value={formData.customerAddress ?? selectedCustomer?.address ?? ""}
                                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                                placeholder="Enter customer's billing address"
                                rows={3}
                            />
                            <FormInput 
                                label="Email" 
                                value={formData.customerEmail ?? selectedCustomer?.email ?? ""} 
                                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })} 
                            />
                            <FormInput 
                                label="Phone" 
                                value={formData.customerPhone ?? selectedCustomer?.phone ?? ""} 
                                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })} 
                            />
                            <FormInput 
                                label="GST Number" 
                                value={formData.customerGst ?? selectedCustomer?.gst_number ?? ""} 
                                onChange={(e) => setFormData({ ...formData, customerGst: e.target.value })} 
                            />
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
                </div>
          </div>
          
          {/* Preview Side */}
          <div id="invoice-preview-container" className="w-full lg:w-3/5 bg-slate-200 p-4 sm:p-8 overflow-y-auto">
            <div id="invoice-preview" className="bg-white shadow-lg p-10 mx-auto" style={{width: '210mm', minHeight: '297mm'}}>
              {/* Header */}
              <div className="flex justify-between items-start pb-6 mb-8 border-b-2 border-slate-200">
                <div className="flex items-start">
                    <div>
                        { settings.companyName ? <h1 className="text-2xl font-extrabold text-slate-900">{settings.companyName}</h1> : <div className="w-48 h-6 bg-slate-200 rounded animate-pulse"></div> }
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
        </div>

        {/* Customer Selector Modal */}
        <Modal isOpen={showCustomerSelector} onClose={() => setShowCustomerSelector(false)} title="Select Customer">
          <CustomerSelector
            passengers={passengers}
            customers={customers}
            onSelectCustomer={handleCustomerSelect}
            onAddCustomer={saveCustomer}
          />
        </Modal>
      </div>
    </div>
  );
};