import React, { useState, useMemo, useEffect } from 'react';
import { Docket, Passenger, Invoice, InvoiceLineItem, BilledTo, CompanySettings } from '../types';
import { useCompanySettings } from '../hooks';
import { formatCurrency, formatDate, amountToWords } from '../services';
import { Icons, FormInput, FormTextarea, FormSelect } from './common';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface InvoiceGeneratorProps {
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


export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ docket, passengers, onClose, onSaveInvoice }) => {
  const { settings, getNextInvoiceNumber } = useCompanySettings();

  // Component State
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


  const handleSaveAndDownload = async () => {
    if (!billedToDetails || !billedToDetails.name) {
      alert("Please select and confirm a passenger to bill to.");
      return;
    }

    const nextInvoiceNum = await getNextInvoiceNumber();
    const finalInvoiceNumber = generateInvoiceNumber(nextInvoiceNum - 1);
    
    setInvoiceNumber(finalInvoiceNumber); // Set for immediate preview update
    
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
      dueDate
    };
    
    onSaveInvoice(newInvoice);

    await new Promise(resolve => setTimeout(resolve, 200));

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
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice-${finalInvoiceNumber}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("An error occurred while generating the PDF.");
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
  
  return (
    <div className="fixed inset-0 bg-slate-800 bg-opacity-90 z-50 flex items-center justify-center p-0 md:p-4">
      <div className="bg-slate-50 rounded-lg shadow-2xl w-full h-full flex flex-col overflow-hidden">
        <div className="p-4 bg-white border-b flex justify-between items-center print:hidden flex-wrap gap-2">
          <h2 className="text-xl font-bold text-slate-800">Invoice Generator</h2>
          <div>
            <button onClick={handleSaveAndDownload} className="bg-brand-primary text-white px-4 py-2 rounded-md mr-2 text-sm font-semibold">Save & Download PDF</button>
            <button onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md text-sm">Close</button>
          </div>
        </div>
        <div className="flex-grow flex flex-col lg:flex-row overflow-auto">
          {/* Form Side */}
          <div className="w-full lg:w-3/5 p-4 sm:p-6 bg-white overflow-y-auto print:hidden">
                <div className="max-w-4xl mx-auto space-y-8">
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
                            <div className="col-span-2 text-right">Rate</div>
                            <div className="col-span-2 text-right">Tax</div>
                            <div className="col-span-2 text-right">Amount</div>
                        </div>
                        <div className="space-y-2">
                        {lineItems.map((item, index) => {
                            const amount = (item.quantity || 0) * (item.rate || 0);
                            return (
                            <div key={item.id} className="grid grid-cols-12 gap-x-3 gap-y-2 p-2 rounded-md hover:bg-slate-50 items-start">
                                <div className="col-span-12 md:col-span-5"><FormTextarea label="" value={item.description} onChange={e => handleLineItemChange(item.id, 'description', e.target.value)} placeholder="Item Description" rows={2} /></div>
                                <div className="col-span-4 md:col-span-1"><FormInput label="" type="number" value={item.quantity} onChange={e => handleLineItemChange(item.id, 'quantity', +e.target.value)} placeholder="Qty" className="text-right" /></div>
                                <div className="col-span-8 md:col-span-2"><FormInput label="" type="number" value={item.rate} onChange={e => handleLineItemChange(item.id, 'rate', +e.target.value)} placeholder="Rate" className="text-right" /></div>
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
          <div id="invoice-preview-container" className="w-full lg:w-2/5 bg-slate-200 p-4 sm:p-8 overflow-y-auto">
            <div id="invoice-preview" className="bg-white shadow-lg p-10 mx-auto" style={{width: '210mm', minHeight: '297mm'}}>
              {/* Header */}
              <div className="flex justify-between items-start pb-6 mb-8">
                <div>
                    { settings.companyName ? <h1 className="text-3xl font-bold text-slate-800">{settings.companyName}</h1> : <div className="w-48 h-8 bg-slate-200 rounded animate-pulse"></div> }
                    <p className="text-slate-500 whitespace-pre-line mt-2">{settings.companyAddress}</p>
                    <p className="text-slate-500">{settings.companyContact}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-bold uppercase text-slate-400">Invoice</h2>
                    <p className="text-slate-600 mt-2"># {invoiceNumber}</p>
                </div>
              </div>
              
              {/* Info section */}
              <div className="flex justify-between mb-8 text-sm">
                <div className="max-w-[50%]">
                    <h4 className="font-semibold text-slate-500 mb-1">Billed To</h4>
                    {billedToDetails ? (
                        <>
                            <p className="font-bold text-slate-800">{billedToDetails.name}</p>
                            <p className="text-slate-600 whitespace-pre-line">{billedToDetails.address}</p>
                            <p className="text-slate-600">{billedToDetails.email}</p>
                        </>
                    ) : <p className="text-slate-400 italic">Select a customer</p>}
                </div>
                <div className="text-right">
                    <p><span className="font-semibold text-slate-500">Invoice Date:</span> {formatDate(invoiceDate)}</p>
                    <p><span className="font-semibold text-slate-500">Due Date:</span> {formatDate(dueDate)}</p>
                    <p><span className="font-semibold text-slate-500">Place of Supply:</span> {placeOfSupply || 'N/A'}</p>
                    {settings.gstNumber && <p className="mt-2"><span className="font-semibold text-slate-500">Agency GSTIN:</span> {settings.gstNumber}</p>}
                </div>
              </div>
              
              {/* Items Table */}
              <table className="w-full mb-8 text-sm">
                <thead className="border-b-2 border-slate-700">
                    <tr className="text-slate-600 uppercase">
                        <th className="text-left p-2 font-semibold w-[50%]">Description</th>
                        <th className="text-right p-2 font-semibold">Qty</th>
                        <th className="text-right p-2 font-semibold">Rate</th>
                        <th className="text-right p-2 font-semibold">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {lineItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                        <td className="p-2 align-top">{item.description}</td>
                        <td className="text-right p-2 align-top">{item.quantity}</td>
                        <td className="text-right p-2 align-top">{formatCurrency(item.rate)}</td>
                        <td className="text-right p-2 align-top">{formatCurrency(item.quantity * item.rate)}</td>
                    </tr>
                    ))}
                </tbody>
              </table>

               {/* Totals */}
               <div className="flex justify-end mb-8">
                    <div className="w-full max-w-xs space-y-2 text-sm">
                        <div className="flex justify-between text-slate-800">
                            <span>Subtotal</span>
                            <span>{formatCurrency(financialTotals.subtotal)}</span>
                        </div>
                        
                        {financialTotals.gstAmount > 0 && gstType === 'CGST/SGST' && (
                            <>
                                <div className="flex justify-between text-slate-800">
                                    <span>CGST</span>
                                    <span>{formatCurrency(financialTotals.gstAmount / 2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-800">
                                    <span>SGST</span>
                                    <span>{formatCurrency(financialTotals.gstAmount / 2)}</span>
                                </div>
                            </>
                        )}

                        {financialTotals.gstAmount > 0 && gstType === 'IGST' && (
                            <div className="flex justify-between text-slate-800">
                                <span>IGST</span>
                                <span>{formatCurrency(financialTotals.gstAmount)}</span>
                            </div>
                        )}

                        <div className="flex justify-between font-bold text-lg text-slate-900 border-t pt-2 mt-2">
                            <span>Grand Total</span>
                            <span>{formatCurrency(financialTotals.grandTotal)}</span>
                        </div>
                    </div>
               </div>
               <div className="text-xs text-slate-600 mt-4 mb-8">
                    <span className="font-semibold">Amount in Words:</span> {amountToWords(financialTotals.grandTotal)} Only.
               </div>
               
               {/* Footer */}
               <div className="border-t-2 border-slate-200 pt-6 mt-12 text-xs text-slate-500 absolute bottom-10 left-10 right-10">
                   <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold text-slate-600 mb-1">Bank Details for Payment:</h4>
                            <p className="text-slate-700">Bank: {settings.bankName}</p>
                            <p className="text-slate-700">A/C No: {settings.accountNumber}</p>
                            <p className="text-slate-700">IFSC: {settings.ifscCode}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-600 mb-1">Notes & Terms:</h4>
                            <p className="whitespace-pre-line">{notes}</p>
                        </div>
                   </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};