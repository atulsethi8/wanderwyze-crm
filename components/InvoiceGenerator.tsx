import React, { useState, useMemo, useEffect } from 'react';
import { Docket, Passenger, Invoice, InvoiceLineItem, BilledTo, CompanySettings } from '../types';
import { Customer, CustomerFormData } from '../types/customer';
import { customerService } from '../services/customerService';
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
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);

  // Customer search and selection state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<CustomerFormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    gstin: ''
  });
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  
  // Enhanced functionality state
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [auditLog, setAuditLog] = useState<string[]>([]);
  const [originalBilledToDetails, setOriginalBilledToDetails] = useState<BilledTo | null>(null);

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

  // Search customers when query changes
  useEffect(() => {
    if (customerSearchQuery.trim()) {
      searchCustomers();
    } else {
      setCustomerSearchResults([]);
    }
  }, [customerSearchQuery]);

  // Sync docket invoices when docket changes
  useEffect(() => {
    // Reset state when docket changes
    setCurrentInvoiceId(null);
    setIsReadOnly(false);
    setIsEditing(false);
    setOriginalBilledToDetails(null);
    setAuditLog([]);
  }, [docket.id]);

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
    // Add Service Charge from itinerary if present
    if (docket.itinerary.serviceCharge && (docket.itinerary.serviceCharge.grossBilled || 0) > 0) {
        initialLineItems.push({
            id: `line-${Date.now()}-service-charge`,
            description: 'Service Charge',
            quantity: 1,
            rate: docket.itinerary.serviceCharge.grossBilled || 0,
            isGstApplicable: false,
            gstRate: 0,
        });
    }
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

  // Customer search functionality
  const searchCustomers = async () => {
    setCustomerSearchLoading(true);
    try {
      const response = await customerService.searchCustomers(customerSearchQuery);
      if (!response.error) {
        setCustomerSearchResults(response.data || []);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    }
    setCustomerSearchLoading(false);
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setBilledToDetails({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      gstin: ''
    });
    setCustomerSearchQuery(customer.name);
    setCustomerSearchResults([]);
    setShowNewCustomerForm(false);
    
    // Clear passenger selection when customer is selected
    setBilledToPassengerId('');
    
    // Set place of supply if address contains state
    if (customer.address) {
      const addressParts = customer.address.split(',');
      const stateGuess = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : '';
      if (INDIAN_STATES.map(s => s.toLowerCase()).includes(stateGuess.toLowerCase())) {
        setPlaceOfSupply(INDIAN_STATES.find(s => s.toLowerCase() === stateGuess.toLowerCase()) || '');
      }
    }
  };

  const handleNewCustomerInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCustomerData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCustomerData.name.trim()) {
      alert('Customer name is required');
      return;
    }

    setCustomerSearchLoading(true);

    try {
      const response = await customerService.createCustomer(newCustomerData);
      
      if (response.error) {
        alert(response.error);
      } else {
        const newCustomer = response.data;
        if (newCustomer) {
          // Set the selected customer and billed to details
          setSelectedCustomer(newCustomer);
          setBilledToDetails({
            name: newCustomer.name,
            email: newCustomer.email || '',
            phone: newCustomer.phone || '',
            address: newCustomer.address || '',
            gstin: newCustomer.gstin || ''
          });
          
          // Reset the form
          setNewCustomerData({
            name: '',
            email: '',
            phone: '',
            address: '',
            gstin: ''
          });
          setShowNewCustomerForm(false);
          
          // Add to audit log
          const timestamp = new Date().toLocaleString();
          setAuditLog(prev => [...prev, `${timestamp}: New customer "${newCustomer.name}" created and selected`]);
        }
      }
    } catch (err) {
      console.error('Failed to create customer:', err);
      alert('Failed to create customer');
    }
    
    setCustomerSearchLoading(false);
  };

  const handleBilledToChange = (field: keyof BilledTo, value: string) => {
    setBilledToDetails(prev => {
        const newDetails: BilledTo = prev ? { ...prev } : { name: '', address: '', email: '', phone: '', gstin: '' };
        (newDetails as any)[field] = value;
        return newDetails;
    });
    
    // Add to audit log if editing
    if (isEditing && originalBilledToDetails) {
      const oldValue = originalBilledToDetails[field] || '';
      if (oldValue !== value) {
        const timestamp = new Date().toLocaleString();
        setAuditLog(prev => [...prev, `${timestamp}: Updated ${field} from "${oldValue}" to "${value}"`]);
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

  const loadInvoice = (invoice: Invoice) => {
    setInvoiceNumber(invoice.invoiceNumber);
    setInvoiceDate(invoice.date);
    setBilledToDetails(invoice.billedTo);
    setPlaceOfSupply(invoice.placeOfSupply);
    setLineItems(invoice.lineItems);
    setNotes(invoice.notes);
    setGstType(invoice.gstType);
    setTerms(invoice.terms);
    setDueDate(invoice.dueDate);
    setCurrentInvoiceId(invoice.id);
    setIsReadOnly(false); // Allow editing of saved invoices
    setIsEditing(true); // Mark as editing mode
    setOriginalBilledToDetails(invoice.billedTo);
    
    // Try to find and set the selected customer if it exists in the database
    if (invoice.billedTo && invoice.billedTo.name) {
      // Search for the customer in the database
      customerService.searchCustomers(invoice.billedTo.name).then(result => {
        if (result.data && result.data.length > 0) {
          // Find the best match - prioritize exact name match, then email, then phone
          const bestMatch = result.data.find(customer => 
            customer.name.toLowerCase() === invoice.billedTo!.name.toLowerCase()
          ) || result.data.find(customer => 
            customer.email && customer.email === invoice.billedTo!.email
          ) || result.data.find(customer => 
            customer.phone && customer.phone === invoice.billedTo!.phone
          ) || result.data[0]; // Fallback to first result
          
          if (bestMatch) {
            setSelectedCustomer(bestMatch);
            // Also update the billed to details to match the database record
            setBilledToDetails({
              name: bestMatch.name,
              email: bestMatch.email || invoice.billedTo.email,
              phone: bestMatch.phone || invoice.billedTo.phone,
              address: bestMatch.address || invoice.billedTo.address,
              gstin: bestMatch.gstin || invoice.billedTo.gstin
            });
          }
        }
      }).catch(error => {
        console.error('Error searching for customer:', error);
      });
    }
    
    const timestamp = new Date().toLocaleString();
    setAuditLog(prev => [...prev, `${timestamp}: Loaded existing invoice ${invoice.invoiceNumber}`]);
  };

  const handleSaveInvoice = async () => {
    if (!billedToDetails || !billedToDetails.name) {
      alert("Please select and confirm a customer or passenger to bill to.");
      return;
    }

    // If a passenger is selected as billed to, convert them to a customer in the database
    if (billedToPassengerId && !selectedCustomer) {
      const selectedPassenger = passengers.find(p => p.id === billedToPassengerId);
      if (selectedPassenger) {
        try {
          // Check if passenger already exists as a customer
          const searchResult = await customerService.searchCustomers(selectedPassenger.fullName);
          let existingCustomer = null;
          
          if (searchResult.data && searchResult.data.length > 0) {
            existingCustomer = searchResult.data.find(customer => 
              customer.name.toLowerCase() === selectedPassenger.fullName.toLowerCase()
            );
          }
          
          if (!existingCustomer) {
            // Create new customer from passenger data
            const newCustomerData: CustomerFormData = {
              name: selectedPassenger.fullName,
              email: selectedPassenger.email || '',
              phone: selectedPassenger.phone || '',
              address: selectedPassenger.address || '',
              gstin: selectedPassenger.gstin || ''
            };
            
            const createResult = await customerService.createCustomer(newCustomerData);
            if (createResult.data) {
              setSelectedCustomer(createResult.data);
              const timestamp = new Date().toLocaleString();
              setAuditLog(prev => [...prev, `${timestamp}: Passenger "${selectedPassenger.fullName}" converted to customer in database`]);
            }
          } else {
            setSelectedCustomer(existingCustomer);
          }
        } catch (error) {
          console.error('Failed to convert passenger to customer:', error);
        }
      }
    }

    // Update customer database if customer details were modified
    if (billedToDetails && billedToDetails.name) {
      try {
        // If we have a selected customer, update it
        if (selectedCustomer) {
          const updateData: Partial<CustomerFormData> = {};
          let hasChanges = false;

          if (selectedCustomer.name !== billedToDetails.name) {
            updateData.name = billedToDetails.name;
            hasChanges = true;
          }
          if (selectedCustomer.email !== billedToDetails.email) {
            updateData.email = billedToDetails.email;
            hasChanges = true;
          }
          if (selectedCustomer.phone !== billedToDetails.phone) {
            updateData.phone = billedToDetails.phone;
            hasChanges = true;
          }
          if (selectedCustomer.address !== billedToDetails.address) {
            updateData.address = billedToDetails.address;
            hasChanges = true;
          }
          if (selectedCustomer.gstin !== billedToDetails.gstin) {
            updateData.gstin = billedToDetails.gstin;
            hasChanges = true;
          }

          if (hasChanges) {
            await customerService.updateCustomer(selectedCustomer.id, updateData);
            const timestamp = new Date().toLocaleString();
            setAuditLog(prev => [...prev, `${timestamp}: Customer details updated in database`]);
          }
        } else {
          // If no selected customer, try to find one by name and update it
          const searchResult = await customerService.searchCustomers(billedToDetails.name);
          if (searchResult.data && searchResult.data.length > 0) {
            const existingCustomer = searchResult.data.find(customer => 
              customer.name.toLowerCase() === billedToDetails.name.toLowerCase()
            );
            
            if (existingCustomer) {
              const updateData: Partial<CustomerFormData> = {};
              let hasChanges = false;

              if (existingCustomer.email !== billedToDetails.email) {
                updateData.email = billedToDetails.email;
                hasChanges = true;
              }
              if (existingCustomer.phone !== billedToDetails.phone) {
                updateData.phone = billedToDetails.phone;
                hasChanges = true;
              }
              if (existingCustomer.address !== billedToDetails.address) {
                updateData.address = billedToDetails.address;
                hasChanges = true;
              }
              if (existingCustomer.gstin !== billedToDetails.gstin) {
                updateData.gstin = billedToDetails.gstin;
                hasChanges = true;
              }

              if (hasChanges) {
                await customerService.updateCustomer(existingCustomer.id, updateData);
                const timestamp = new Date().toLocaleString();
                setAuditLog(prev => [...prev, `${timestamp}: Customer details updated in database`]);
              }
            } else {
              // Customer not found, create a new one
              try {
                const newCustomerData: CustomerFormData = {
                  name: billedToDetails.name,
                  email: billedToDetails.email || '',
                  phone: billedToDetails.phone || '',
                  address: billedToDetails.address || '',
                  gstin: billedToDetails.gstin || ''
                };
                
                const createResult = await customerService.createCustomer(newCustomerData);
                if (createResult.data) {
                  setSelectedCustomer(createResult.data);
                  const timestamp = new Date().toLocaleString();
                  setAuditLog(prev => [...prev, `${timestamp}: New customer "${billedToDetails.name}" created in database`]);
                } else {
                  console.error('Failed to create customer:', createResult.error);
                }
              } catch (error) {
                console.error('Failed to create customer:', error);
              }
            }
          } else {
            // No search results, create a new customer
            try {
              const newCustomerData: CustomerFormData = {
                name: billedToDetails.name,
                email: billedToDetails.email || '',
                phone: billedToDetails.phone || '',
                address: billedToDetails.address || '',
                gstin: billedToDetails.gstin || ''
              };
              
              const createResult = await customerService.createCustomer(newCustomerData);
              if (createResult.data) {
                setSelectedCustomer(createResult.data);
                const timestamp = new Date().toLocaleString();
                setAuditLog(prev => [...prev, `${timestamp}: New customer "${billedToDetails.name}" created in database`]);
              } else {
                console.error('Failed to create customer:', createResult.error);
              }
            } catch (error) {
              console.error('Failed to create customer:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to update customer:', error);
      }
    }

    // Only generate new invoice number if this is the first save (not editing existing)
    let finalInvoiceNumber = invoiceNumber;
    if (!currentInvoiceId) {
      // This is the first save, generate new invoice number
      const nextInvoiceNum = await getNextInvoiceNumber();
      finalInvoiceNumber = generateInvoiceNumber(nextInvoiceNum - 1);
      setInvoiceNumber(finalInvoiceNumber);
    }
    
    const newInvoice: Invoice = {
      id: currentInvoiceId || `INV-${Date.now()}`,
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

    // Update state after saving
    setCurrentInvoiceId(newInvoice.id);
    setIsReadOnly(false);
    setIsEditing(true);
    setOriginalBilledToDetails(billedToDetails);
    const timestamp = new Date().toLocaleString();
    setAuditLog(prev => [...prev, `${timestamp}: Invoice ${currentInvoiceId ? 'updated' : 'saved'} successfully`]);

    alert(`Invoice ${currentInvoiceId ? 'updated' : 'saved'} successfully!`);
  };

  const handleDownloadPDF = async () => {
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
      const totalPages = pdf.internal.pages.length;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(120);
        pdf.text(`Page ${i} of ${totalPages}`, pdfWidth - 30, pageHeight - 10);
      }

      pdf.save(`Invoice-${invoiceNumber}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("An error occurred while generating the PDF.");
    }
  };


  const handleLineItemChange = (id: string, field: keyof InvoiceLineItem, value: string | number | boolean) => {
      setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleEditMode = () => {
    setIsEditing(true);
    setIsReadOnly(false);
    setOriginalBilledToDetails(billedToDetails);
    const timestamp = new Date().toLocaleString();
    setAuditLog(prev => [...prev, `${timestamp}: Edit mode enabled`]);
  };

  const handleSaveChanges = async () => {
    if (selectedCustomer && billedToDetails) {
      try {
        const updateData: Partial<CustomerFormData> = {};
        let hasChanges = false;

        if (originalBilledToDetails) {
          if (originalBilledToDetails.name !== billedToDetails.name) {
            updateData.name = billedToDetails.name;
            hasChanges = true;
          }
          if (originalBilledToDetails.email !== billedToDetails.email) {
            updateData.email = billedToDetails.email;
            hasChanges = true;
          }
          if (originalBilledToDetails.phone !== billedToDetails.phone) {
            updateData.phone = billedToDetails.phone;
            hasChanges = true;
          }
          if (originalBilledToDetails.address !== billedToDetails.address) {
            updateData.address = billedToDetails.address;
            hasChanges = true;
          }
          if (originalBilledToDetails.gstin !== billedToDetails.gstin) {
            updateData.gstin = billedToDetails.gstin;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          await customerService.updateCustomer(selectedCustomer.id, updateData);
          const timestamp = new Date().toLocaleString();
          setAuditLog(prev => [...prev, `${timestamp}: Changes saved to customer database`]);
        }
      } catch (error) {
        console.error('Failed to update customer:', error);
      }
    }

    setIsEditing(false);
    setIsReadOnly(true);
    setOriginalBilledToDetails(billedToDetails);
    const timestamp = new Date().toLocaleString();
    setAuditLog(prev => [...prev, `${timestamp}: Edit mode disabled`]);
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
          <div className="flex gap-2">
            {isReadOnly && !isEditing && (
              <button onClick={handleEditMode} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-semibold">
                Edit Invoice
              </button>
            )}
            {isEditing && (
              <button onClick={handleSaveChanges} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-semibold">
                Save Changes
              </button>
            )}
            {!isReadOnly && (
              <div className="flex gap-2">
                                        <button onClick={handleSaveInvoice} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-semibold">
                            {currentInvoiceId ? 'Update Invoice' : 'Save Invoice'}
                        </button>
                <button onClick={handleDownloadPDF} className="bg-brand-primary text-white px-4 py-2 rounded-md text-sm font-semibold">Download PDF</button>
              </div>
            )}
            {isReadOnly && !isEditing && (
              <button onClick={handleDownloadPDF} className="bg-brand-primary text-white px-4 py-2 rounded-md text-sm font-semibold">Download PDF</button>
            )}
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
                            {/* Customer Search */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Search Customer
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search by customer name or code..."
                                        value={customerSearchQuery}
                                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    
                                    {/* Search Results Dropdown */}
                                    {customerSearchResults.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                            {customerSearchResults.map((customer) => (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    onClick={() => handleCustomerSelect(customer)}
                                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                                                >
                                                    <div className="font-medium">{customer.name}</div>
                                                    <div className="text-sm text-gray-500">
                                                        {customer.customer_code} • {customer.email || 'No email'}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Create New Customer Button */}
                                {customerSearchQuery.trim() && customerSearchResults.length === 0 && !selectedCustomer && (
                                    <div className="mt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewCustomerData(prev => ({ ...prev, name: customerSearchQuery }));
                                                setShowNewCustomerForm(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            + Create new customer "{customerSearchQuery}"
                                        </button>
                                    </div>
                                )}
                                
                                {/* Selected Customer Display */}
                                {selectedCustomer && (
                                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                        <div className="font-medium text-blue-900">{selectedCustomer.name}</div>
                                        <div className="text-sm text-blue-700">
                                            {selectedCustomer.customer_code} • {selectedCustomer.email || 'No email'}
                                        </div>
                                        {selectedCustomer.phone && (
                                            <div className="text-sm text-blue-700">Phone: {selectedCustomer.phone}</div>
                                        )}
                                        {selectedCustomer.address && (
                                            <div className="text-sm text-blue-700 mt-1">Address: {selectedCustomer.address}</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* New Customer Form */}
                            {showNewCustomerForm && (
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <h3 className="font-medium text-gray-900 mb-3">Create New Customer</h3>
                                    <form onSubmit={handleCreateNewCustomer} className="space-y-3">
                                        <div className="grid grid-cols-1 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={newCustomerData.name}
                                                    onChange={handleNewCustomerInputChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Email
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={newCustomerData.email}
                                                    onChange={handleNewCustomerInputChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Phone
                                                </label>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    value={newCustomerData.phone}
                                                    onChange={handleNewCustomerInputChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Address
                                                </label>
                                                <textarea
                                                    name="address"
                                                    value={newCustomerData.address}
                                                    onChange={handleNewCustomerInputChange}
                                                    rows={2}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    GSTIN
                                                </label>
                                                <input
                                                    type="text"
                                                    name="gstin"
                                                    value={newCustomerData.gstin}
                                                    onChange={handleNewCustomerInputChange}
                                                    placeholder="22AAAAA0000A1Z5"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="submit"
                                                disabled={customerSearchLoading}
                                                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1 rounded text-sm"
                                            >
                                                {customerSearchLoading ? 'Creating...' : 'Create Customer'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowNewCustomerForm(false);
                                                    setNewCustomerData({
                                                        name: '',
                                                        email: '',
                                                        phone: '',
                                                        address: ''
                                                    });
                                                }}
                                                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* OR Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-gray-500">OR</span>
                                </div>
                            </div>

                             <FormSelect label="Quick-fill from Passenger" value={billedToPassengerId} onChange={e => setBilledToPassengerId(e.target.value)}>
                                <option value="">-- Select Passenger to Autofill --</option>
                                {passengers.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                            </FormSelect>
                            <FormInput 
                                label="Customer Name*" 
                                value={billedToDetails?.name || ''} 
                                onChange={e => handleBilledToChange('name', e.target.value)}
                                placeholder="Enter customer's full name"
                                disabled={isReadOnly && !isEditing}
                            />
                            <FormTextarea
                                label="Customer Address*"
                                value={billedToDetails?.address || ''}
                                onChange={e => handleBilledToChange('address', e.target.value)}
                                placeholder="Enter complete billing address"
                                rows={3}
                                disabled={isReadOnly && !isEditing}
                            />
                            <FormInput 
                                label="Email" 
                                type="email"
                                value={billedToDetails?.email || ''} 
                                onChange={e => handleBilledToChange('email', e.target.value)}
                                placeholder="customer@example.com"
                                disabled={isReadOnly && !isEditing}
                            />
                            <FormInput 
                                label="Phone" 
                                type="tel"
                                value={billedToDetails?.phone || ''} 
                                onChange={e => handleBilledToChange('phone', e.target.value)}
                                placeholder="+91 98765 43210"
                                disabled={isReadOnly && !isEditing}
                            />
                            <FormInput 
                                label="GSTIN (Optional)" 
                                value={billedToDetails?.gstin || ''} 
                                onChange={e => handleBilledToChange('gstin', e.target.value)}
                                placeholder="22AAAAA0000A1Z5"
                                disabled={isReadOnly && !isEditing}
                            />
                        </div>
                        
                        {/* Invoice Details Column */}
                        <div className="space-y-4">
                            <FormInput 
                                label="Invoice#" 
                                value={invoiceNumber} 
                                onChange={e => setInvoiceNumber(e.target.value)}
                                placeholder="Auto-generated"
                            />
                            <FormInput 
                                label="Invoice Date*" 
                                type="date"
                                value={invoiceDate} 
                                onChange={e => setInvoiceDate(e.target.value)}
                            />
                            <FormSelect label="Terms" value={terms} onChange={e => setTerms(e.target.value)}>
                                {Object.keys(PAYMENT_TERMS).map(term => <option key={term} value={term}>{term}</option>)}
                            </FormSelect>
                            <FormInput 
                                label="Due Date" 
                                type="date"
                                value={dueDate} 
                                onChange={e => setDueDate(e.target.value)}
                                placeholder="Auto-calculated"
                            />
                            <FormSelect label="Place of Supply" value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)}>
                                <option value="">-- Select State/UT --</option>
                                {INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                            </FormSelect>
                            <FormSelect label="GST Type (Override)" value={gstType} onChange={e => setGstType(e.target.value as 'IGST' | 'CGST/SGST')}>
                                <option value="IGST">IGST (Interstate)</option>
                                <option value="CGST/SGST">CGST/SGST (Intrastate)</option>
                            </FormSelect>
                        </div>
                    </div>
                    
                    {/* Line Items Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
                            <button type="button" onClick={addLineItem} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
                                + Add Item
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {lineItems.map((item, index) => (
                                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                        <FormInput 
                                            label="Description" 
                                            value={item.description} 
                                            onChange={e => handleLineItemChange(item.id, 'description', e.target.value)}
                                            placeholder="Item description"
                                        />
                                        <div className="grid grid-cols-3 gap-2">
                                            <FormInput 
                                                label="Qty" 
                                                type="number"
                                                value={item.quantity} 
                                                onChange={e => handleLineItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                                min="0"
                                            />
                                            <FormInput 
                                                label="Rate" 
                                                type="number"
                                                value={item.rate} 
                                                onChange={e => handleLineItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="0.01"
                                            />
                                            <div className="flex items-end">
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeLineItem(item.id)}
                                                    className="bg-red-500 text-white px-2 py-2 rounded text-sm w-full"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="flex items-center space-x-2">
                                            <input 
                                                type="checkbox" 
                                                id={`gst-${item.id}`}
                                                checked={item.isGstApplicable} 
                                                onChange={e => handleLineItemChange(item.id, 'isGstApplicable', e.target.checked)}
                                                className="rounded"
                                            />
                                            <label htmlFor={`gst-${item.id}`} className="text-sm text-gray-700">GST Applicable</label>
                                        </div>
                                        {item.isGstApplicable && (
                                            <FormSelect 
                                                label="GST Rate" 
                                                value={item.gstRate} 
                                                onChange={e => handleLineItemChange(item.id, 'gstRate', parseInt(e.target.value) || 0)}
                                            >
                                                {GST_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                                            </FormSelect>
                                        )}
                                    </div>
                                    
                                    <div className="mt-3 text-sm text-gray-600">
                                        Net: ₹{formatCurrency(lineNet(item))} | 
                                        Tax: ₹{formatCurrency(lineTax(item))} | 
                                        Total: ₹{formatCurrency(lineGross(item))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Notes Section */}
                    <div>
                        <FormTextarea
                            label="Notes"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Additional notes or terms..."
                            rows={3}
                            disabled={isReadOnly && !isEditing}
                        />
                    </div>

                    {/* Saved Invoices Section */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">Saved Invoices</h3>
                            <button
                                onClick={() => {
                                    // Reset to new invoice state
                                    setInvoiceNumber(generateInvoiceNumber(settings.lastInvoiceNumber));
                                    setInvoiceDate(new Date().toISOString().split('T')[0]);
                                    setBilledToDetails(null);
                                    setPlaceOfSupply('');
                                    setLineItems([]);
                                    setNotes("Thank you for your business. All payments are non-refundable.");
                                    setGstType('IGST');
                                    setTerms('Due on Receipt');
                                    setDueDate('');
                                    setCurrentInvoiceId(null);
                                    setIsReadOnly(false);
                                    setIsEditing(false);
                                    setOriginalBilledToDetails(null);
                                    setSelectedCustomer(null);
                                    setBilledToPassengerId('');
                                    setCustomerSearchQuery('');
                                    setCustomerSearchResults([]);
                                    setAuditLog([]);
                                    const timestamp = new Date().toLocaleString();
                                    setAuditLog([`${timestamp}: Started new invoice`]);
                                }}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            >
                                + New Invoice
                            </button>
                        </div>
                        {docket.invoices && docket.invoices.length > 0 ? (
                            <div className="bg-gray-50 p-4 rounded-lg border max-h-40 overflow-y-auto">
                                <div className="space-y-2 text-sm">
                                    {docket.invoices.map((inv) => (
                                        <button
                                            key={inv.id}
                                            onClick={() => loadInvoice(inv)}
                                            className={`w-full flex justify-between items-center p-2 rounded border transition-colors ${
                                                currentInvoiceId === inv.id 
                                                    ? 'border-blue-500 bg-blue-50' 
                                                    : 'bg-white border-gray-200 hover:bg-blue-50'
                                            }`}
                                        >
                                            <div className="text-left">
                                                <div className="font-medium text-gray-800">{inv.invoiceNumber}</div>
                                                <div className="text-xs text-gray-500">
                                                    {formatDate(inv.date)} - {formatCurrency(inv.grandTotal)}
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 text-xs rounded ${
                                                currentInvoiceId === inv.id 
                                                    ? 'bg-blue-100 text-blue-700' 
                                                    : 'bg-green-100 text-green-700'
                                            }`}>
                                                {currentInvoiceId === inv.id ? 'Editing' : 'Saved'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 p-4 rounded-lg border text-center text-gray-500">
                                No saved invoices yet
                            </div>
                        )}
                    </div>

                    {/* Audit Log Section */}
                    {auditLog.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Change Log</h3>
                            <div className="bg-gray-50 p-4 rounded-lg border max-h-40 overflow-y-auto">
                                <div className="space-y-2 text-sm">
                                    {auditLog.map((log, index) => (
                                        <div key={index} className="text-gray-700 border-b border-gray-200 pb-1">
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
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
                    <h4 className="font-semibold text-slate-500 mb-1">Billed To</h4>
                    {billedToDetails ? (
                        <>
                            <p className="font-bold text-slate-800">{billedToDetails.name}</p>
                            <p className="text-slate-600 whitespace-pre-line">{billedToDetails.address}</p>
                            <p className="text-slate-600">{billedToDetails.email}</p>
                            {billedToDetails.phone && <p className="text-slate-600">{billedToDetails.phone}</p>}
                            {billedToDetails.gstin && <p className="text-slate-600">GSTIN: {billedToDetails.gstin}</p>}
                        </>
                    ) : <p className="text-slate-400 italic">No billing details</p>}
                </div>
                <div>
                    <h4 className="font-semibold text-slate-500 mb-1">Remit To</h4>
                    <p className="text-slate-600">Bank: {settings.bankName || 'N/A'}</p>
                    <p className="text-slate-600">Account: {settings.accountNumber || 'N/A'}</p>
                    <p className="text-slate-600">IFSC: {settings.ifscCode || 'N/A'}</p>
                </div>
              </div>
              
              {/* Items Table */}
              <table className="w-full mb-8 text-sm">
                <thead>
                    <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-2 font-semibold text-slate-700">ITEM DESCRIPTION</th>
                        <th className="text-right py-2 font-semibold text-slate-700">QTY</th>
                        <th className="text-right py-2 font-semibold text-slate-700">UNIT PRICE</th>
                        <th className="text-right py-2 font-semibold text-slate-700">NET COST</th>
                        <th className="text-right py-2 font-semibold text-slate-700">TAX %</th>
                        <th className="text-right py-2 font-semibold text-slate-700">GROSS COST</th>
                        <th className="text-right py-2 font-semibold text-slate-700">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    {lineItems.map((item, index) => (
                        <tr key={item.id} className="border-b border-slate-100">
                            <td className="py-3 text-slate-800">{item.description}</td>
                            <td className="py-3 text-right text-slate-600">{item.quantity}</td>
                            <td className="py-3 text-right text-slate-600">₹{formatCurrency(item.rate)}</td>
                            <td className="py-3 text-right text-slate-600">₹{formatCurrency(lineNet(item))}</td>
                            <td className="py-3 text-right text-slate-600">{item.isGstApplicable ? `${item.gstRate}%` : '0%'}</td>
                            <td className="py-3 text-right text-slate-600">₹{formatCurrency(lineNet(item))}</td>
                            <td className="py-3 text-right font-semibold text-slate-800">₹{formatCurrency(lineGross(item))}</td>
                        </tr>
                    ))}
                </tbody>
              </table>
              
              {/* Totals */}
              <div className="flex justify-end mb-8">
                <div className="w-64 text-sm">
                    <div className="flex justify-between py-1">
                        <span className="text-slate-600">Subtotal:</span>
                        <span className="text-slate-800">₹{formatCurrency(financialTotals.subtotal)}</span>
                    </div>
                    {financialTotals.gstAmount > 0 && (
                        <div className="flex justify-between py-1">
                            <span className="text-slate-600">GST ({formatPercent(effectiveGstRate)}):</span>
                            <span className="text-slate-800">₹{formatCurrency(financialTotals.gstAmount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between py-2 border-t-2 border-slate-200 font-bold text-lg">
                        <span className="text-slate-800">Grand Total:</span>
                        <span className="text-slate-900">₹{formatCurrency(financialTotals.grandTotal)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Amount in words: {amountToWords(financialTotals.grandTotal)}
                    </div>
                </div>
              </div>
              
              {/* Notes */}
              {notes && (
                <div className="mb-8 text-sm">
                    <h4 className="font-semibold text-slate-700 mb-2">Notes</h4>
                    <p className="text-slate-600 whitespace-pre-line">{notes}</p>
                </div>
              )}
              
              {/* Footer */}
              <div className="text-center text-xs text-slate-500 border-t-2 border-slate-200 pt-4">
                <p>Thank you for your business!</p>
                <p>This is a computer generated invoice.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};