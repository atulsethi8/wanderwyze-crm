import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Docket, Client, Itinerary, Passenger, Flight, Hotel, Excursion, Transfer, Payment, UploadedFile, Comment, BookingStatus, Tag, PaymentType, Supplier, PassengerType, Gender, LeadSource, FlightPassengerDetail, Invoice, Agent } from '../types';
import { INITIAL_DOCKET_FORM_STATE, LEAD_SOURCES } from '../constants';
import { formatCurrency, formatDate, getNumberOfNights, toBase64, geminiService, amountToWords, formatDateTimeIST } from '../services';
import { useAuth } from '../hooks';
import { Icons, Modal, Spinner, FormInput, FormTextarea, FormSelect } from './common';
import { InvoiceGenerator } from './InvoiceGenerator';
import { Type } from '@google/genai';
import { InvoicePreview } from './InvoicePreview';

interface DocketFormProps {
  docket: Docket | null;
  onSave: (docketData: Omit<Docket, 'id' | 'searchTags' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDelete: (id: string, reason: string) => void;
  onClose: () => void;
  suppliers: Supplier[];
  saveSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  agents: Agent[];
  loading: boolean;
  forceReadOnly?: boolean;
  readOnlyBanner?: string;
}

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; bgClass?: string }> = ({ title, icon, children, defaultOpen = true, bgClass = 'bg-white' }) => (
    <details open={defaultOpen} className={`${bgClass} rounded-lg shadow-sm border border-slate-200 mb-4`}> 
        <summary className="px-5 py-4 cursor-pointer flex items-center justify-between font-semibold text-slate-800">
            <div className="flex items-center gap-3 text-slate-800">
                <span className="inline-flex items-center justify-center w-6 h-6 text-slate-600">{icon}</span>
                <span className="text-base">{title}</span>
            </div>
            <span className="text-slate-500 transform transition-transform duration-200 group-open:rotate-180">{Icons.chevronDown}</span>
        </summary>
        <div className="p-5 border-t border-slate-200">{children}</div>
    </details>
);

const NewPaymentForm: React.FC<{onAddPayment: (p: Omit<Payment, 'id'>) => void, disabled: boolean}> = ({onAddPayment, disabled}) => {
    const [amount, setAmount] = useState<number | ''>('');
    const [type, setType] = useState(PaymentType.BankTransfer);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(amount && +amount > 0) {
            onAddPayment({amount: +amount, type, date, notes});
            setAmount(''); setNotes('');
        }
    }
    return (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-100 rounded-lg grid grid-cols-2 gap-4 items-end">
             <div className="col-span-2"><FormInput label="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value ? +e.target.value : '')} required disabled={disabled} /></div>
             <FormSelect label="Payment Type" value={type} onChange={e => setType(e.target.value as PaymentType)} disabled={disabled}>
                {Object.values(PaymentType).map(t => <option key={t}>{t}</option>)}
             </FormSelect>
             <FormInput label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} icon={Icons.calendar} disabled={disabled} />
             <div className="col-span-2"><FormInput label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} disabled={disabled} /></div>
             <div className="col-span-2"><button type="submit" className="w-full bg-green-600 text-white font-semibold py-2 rounded-md hover:bg-green-700 disabled:bg-slate-400" disabled={disabled}>Add Payment</button></div>
        </form>
    );
};

const NewCommentForm: React.FC<{onAddComment: (text: string) => void}> = ({onAddComment}) => {
    const [text, setText] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(text.trim()) {
            onAddComment(text);
            setText('');
        }
    }
    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <FormInput label="" type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment..." className="w-full" />
            <button type="submit" className="px-4 py-2 bg-brand-primary text-white font-semibold rounded-md">Add</button>
        </form>
    )
}


// --- MODAL CONTENT FOR ADDING PAX TO FLIGHT ---
const AddPaxToFlightModalContent: React.FC<{
    availablePassengers: Passenger[];
    onAdd: (selectedIds: string[]) => void;
    onCancel: () => void;
}> = ({ availablePassengers, onAdd, onCancel }) => {
    const [selected, setSelected] = useState<string[]>([]);
    
    const handleToggle = (id: string) => {
        setSelected(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleConfirm = () => {
        onAdd(selected);
    };

    return (
        <div>
            <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                {availablePassengers.length > 0 ? availablePassengers.map(pax => (
                    <label key={pax.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                        <input type="checkbox" checked={selected.includes(pax.id)} onChange={() => handleToggle(pax.id)} className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                        {pax.fullName}
                    </label>
                )) : <p className="text-slate-500 text-center py-4">All passengers in the docket are already added to this flight.</p>}
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                <button onClick={onCancel} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
                <button onClick={handleConfirm} disabled={selected.length === 0} className="px-4 py-2 bg-brand-primary text-white rounded-md disabled:bg-slate-400">Add Selected</button>
            </div>
        </div>
    );
};


// --- MAIN DOCKET FORM COMPONENT ---
export const DocketForm: React.FC<DocketFormProps> = ({ docket, onSave, onDelete, onClose, suppliers, saveSupplier, agents, loading: isSaving, forceReadOnly, readOnlyBanner }) => {
    const { currentUser } = useAuth();
    const [formState, setFormState] = useState<Omit<Docket, 'id' | 'searchTags' | 'createdAt' | 'updatedAt'>>(INITIAL_DOCKET_FORM_STATE);
    const [activeTab, setActiveTab] = useState('details');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [supplierModalOpen, setSupplierModalOpen] = useState(false);
    const [newSupplier, setNewSupplier] = useState<Omit<Supplier, 'id'>>({ name: '', contactPerson: '', contactNumber: '' });
    const [addPaxToFlightIndex, setAddPaxToFlightIndex] = useState<number | null>(null);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
    const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
    const notificationTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const computedReadOnly = useMemo(() => {
        if (!docket || !currentUser) return false; // New dockets are always editable
        return currentUser.role !== 'admin' && docket.createdBy !== currentUser.id;
    }, [docket, currentUser]);
    const isReadOnly = forceReadOnly ? true : computedReadOnly;

    useEffect(() => {
        if (docket) {
            setFormState(JSON.parse(JSON.stringify(docket))); // Deep copy to avoid mutation issues
        } else {
            setFormState(INITIAL_DOCKET_FORM_STATE);
        }
    }, [docket]);

    useEffect(() => {
        return () => {
            if (notificationTimer.current) clearTimeout(notificationTimer.current);
        };
    }, []);

    const handleClientChange = <T extends keyof Client>(field: T, value: Client[T]) => {
        setFormState(prev => ({ ...prev, client: { ...prev.client, [field]: value } }));
    };
    
    const handleArrayChange = useCallback((category: keyof Itinerary, indexToUpdate: number, field: string, value: any) => {
        setFormState(prev => {
            const newItems = (prev.itinerary[category] as any[]).map((item, index) => {
                if (index === indexToUpdate) {
                    return { ...item, [field]: value };
                }
                return item;
            });

            return {
                ...prev,
                itinerary: {
                    ...prev.itinerary,
                    [category]: newItems,
                }
            };
        });
    }, []);

    const handleFlightFieldChange = useCallback((flightIndex: number, field: keyof Flight, value: any) => {
        setFormState(prev => {
            const updatedFlights = prev.itinerary.flights.map((flight, index) => {
                if (index === flightIndex) {
                    return { ...flight, [field]: value };
                }
                return flight;
            });
            return { ...prev, itinerary: { ...prev.itinerary, flights: updatedFlights } };
        });
    }, []);

    const removePassengerFromFlight = useCallback((flightIndex: number, passengerId: string) => {
        setFormState(prev => {
            const updatedFlights = prev.itinerary.flights.map((flight, index) => {
                if (index !== flightIndex) return flight;
    
                const newPassengerDetails = flight.passengerDetails.filter(pd => pd.passengerId !== passengerId);
                
                return { ...flight, passengerDetails: newPassengerDetails };
            });
            return { ...prev, itinerary: { ...prev.itinerary, flights: updatedFlights } };
        });
    }, []);
    
    const handleAddPassengersToFlight = useCallback((flightIndex: number, passengerIds: string[]) => {
        setFormState(prev => {
            const flightToUpdate = prev.itinerary.flights[flightIndex];
            if (!flightToUpdate) return prev;

            const updatedFlights = [...prev.itinerary.flights];
            const targetFlight = { ...flightToUpdate };

            const existingPaxIds = new Set(targetFlight.passengerDetails.map(pd => pd.passengerId));
            
            const newPassengerDetailsToAdd: FlightPassengerDetail[] = passengerIds
                .filter(id => !existingPaxIds.has(id))
                .map(paxId => {
                    const passenger = prev.passengers.find(p => p.id === paxId);
                    if (!passenger) return null;
                    
                    const netCost = targetFlight.isNetGrossSameForAll ? targetFlight.commonNetCost : 0;
                    const grossBilled = targetFlight.isNetGrossSameForAll ? targetFlight.commonGrossBilled : 0;

                    return {
                        passengerId: paxId,
                        passengerType: passenger.type,
                        netCost,
                        grossBilled,
                    };
                })
                .filter((pd): pd is FlightPassengerDetail => pd !== null);
            
            targetFlight.passengerDetails = [...targetFlight.passengerDetails, ...newPassengerDetailsToAdd];
            updatedFlights[flightIndex] = targetFlight;
            
            return {
                ...prev,
                itinerary: { ...prev.itinerary, flights: updatedFlights }
            };
        });
        setAddPaxToFlightIndex(null); // Close the modal
    }, []);

    const handleFlightPaxPriceChange = useCallback((flightIndex: number, passengerId: string, field: 'netCost' | 'grossBilled', value: number) => {
        setFormState(prev => {
            const updatedFlights = prev.itinerary.flights.map((flight, index) => {
                if (index !== flightIndex) return flight;

                const newPassengerDetails = flight.passengerDetails.map(pd => {
                    if (pd.passengerId === passengerId) {
                        return { ...pd, [field]: value };
                    }
                    return pd;
                });
                return { ...flight, passengerDetails: newPassengerDetails };
            });
            return { ...prev, itinerary: { ...prev.itinerary, flights: updatedFlights } };
        });
    }, []);

    const handleFlightSameCostToggle = useCallback((flightIndex: number) => {
        setFormState(prev => {
            const updatedFlights = prev.itinerary.flights.map((flight, index) => {
                if (index !== flightIndex) return flight;

                const newIsSame = !flight.isNetGrossSameForAll;
                let newPassengerDetails = [...flight.passengerDetails];

                if (newIsSame) {
                    newPassengerDetails = newPassengerDetails.map(pd => ({
                        ...pd,
                        netCost: flight.commonNetCost,
                        grossBilled: flight.commonGrossBilled,
                    }));
                }
                
                return { ...flight, isNetGrossSameForAll: newIsSame, passengerDetails: newPassengerDetails };
            });

            return { ...prev, itinerary: { ...prev.itinerary, flights: updatedFlights } };
        });
    }, []);

    const handleFlightCommonCostChange = useCallback((flightIndex: number, field: 'commonNetCost' | 'commonGrossBilled', value: number) => {
        setFormState(prev => {
            const updatedFlights = prev.itinerary.flights.map((flight, index) => {
                if (index !== flightIndex) return flight;

                let newPassengerDetails = [...flight.passengerDetails];
                if (flight.isNetGrossSameForAll) {
                    const detailField = field === 'commonNetCost' ? 'netCost' : 'grossBilled';
                    newPassengerDetails = newPassengerDetails.map(pd => ({
                        ...pd,
                        [detailField]: value
                    }));
                }
                
                return { ...flight, [field]: value, passengerDetails: newPassengerDetails };
            });

            return { ...prev, itinerary: { ...prev.itinerary, flights: updatedFlights } };
        });
    }, []);

    const handleHotelPaxToggle = useCallback((hotelIndex: number, passengerId: string) => {
        setFormState(prev => {
            const updatedHotels = prev.itinerary.hotels.map((hotel, index) => {
                if (index !== hotelIndex) return hotel;

                const newPaxRefs = hotel.paxRefs.includes(passengerId)
                    ? hotel.paxRefs.filter(id => id !== passengerId)
                    : [...hotel.paxRefs, passengerId];
                
                return { ...hotel, paxRefs: newPaxRefs };
            });
            return { ...prev, itinerary: { ...prev.itinerary, hotels: updatedHotels } };
        });
    }, []);

    const addToArray = <K extends keyof Itinerary>(category: K, newItem: Itinerary[K][0]) => {
        setFormState(prev => ({
            ...prev,
            itinerary: { ...prev.itinerary, [category]: [...prev.itinerary[category], newItem] }
        }));
    };

    const removeFromArray = <K extends keyof Itinerary>(category: K, index: number) => {
        setFormState(prev => ({
            ...prev,
            itinerary: { ...prev.itinerary, [category]: prev.itinerary[category].filter((_, i) => i !== index) }
        }));
    };

    const addPassenger = () => setFormState(p => ({ ...p, passengers: [...p.passengers, { id: `PAX-${Date.now()}`, fullName: '', type: PassengerType.Adult, gender: Gender.Male }] }));
    const removePassenger = (id: string) => setFormState(p => ({ ...p, passengers: p.passengers.filter(px => px.id !== id) }));
    const updatePassenger = (id: string, field: keyof Omit<Passenger, 'id'>, value: any) => {
        setFormState(p => ({ ...p, passengers: p.passengers.map(px => px.id === id ? { ...px, [field]: value } : px) }));
    };
    
    const financialSummary = useMemo(() => {
        const flightsTotal = formState.itinerary.flights.reduce((flightAcc, flight) => {
            const passengerSubtotals = flight.passengerDetails.reduce((paxAcc, paxDetail) => {
                return {
                    netCost: paxAcc.netCost + (paxDetail.netCost || 0),
                    grossBilled: paxAcc.grossBilled + (paxDetail.grossBilled || 0),
                };
            }, { netCost: 0, grossBilled: 0 });

            return {
                netCost: flightAcc.netCost + passengerSubtotals.netCost,
                grossBilled: flightAcc.grossBilled + passengerSubtotals.grossBilled,
            };
        }, { netCost: 0, grossBilled: 0 });

        const calculateSimpleTotals = (items: (Hotel | Excursion | Transfer)[]) => items.reduce((acc, item) => {
            return {
                netCost: acc.netCost + (item.netCost || 0),
                grossBilled: acc.grossBilled + (item.grossBilled || 0),
            };
        }, { netCost: 0, grossBilled: 0 });
        
        const hotelsTotal = calculateSimpleTotals(formState.itinerary.hotels);
        const excursionsTotal = calculateSimpleTotals(formState.itinerary.excursions);
        const transfersTotal = calculateSimpleTotals(formState.itinerary.transfers);
        
        const grandTotalGross = flightsTotal.grossBilled + hotelsTotal.grossBilled + excursionsTotal.grossBilled + transfersTotal.grossBilled;
        const grandTotalNet = flightsTotal.netCost + hotelsTotal.netCost + excursionsTotal.netCost + transfersTotal.netCost;
        const totalPaid = formState.payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
            flights: { netCost: flightsTotal.netCost, grossBilled: flightsTotal.grossBilled, profit: flightsTotal.grossBilled - flightsTotal.netCost },
            hotels: { netCost: hotelsTotal.netCost, grossBilled: hotelsTotal.grossBilled, profit: hotelsTotal.grossBilled - hotelsTotal.netCost },
            excursions: { netCost: excursionsTotal.netCost, grossBilled: excursionsTotal.grossBilled, profit: excursionsTotal.grossBilled - excursionsTotal.netCost },
            transfers: { netCost: transfersTotal.netCost, grossBilled: transfersTotal.grossBilled, profit: transfersTotal.grossBilled - transfersTotal.netCost },
            grandTotalGross,
            grandTotalNet,
            grandTotalProfit: grandTotalGross - grandTotalNet,
            amountPaid: totalPaid,
            balanceDue: grandTotalGross - totalPaid
        };
    }, [formState.itinerary, formState.payments]);
    
    const addPayment = (payment: Omit<Payment, 'id'>) => {
        const newPayment: Payment = { ...payment, id: `PAY-${Date.now()}` };
        const comment: Comment = {
            id: `SYS-PAY-${Date.now()}`,
            text: `🔒 Auto-log: Payment of ${formatCurrency(payment.amount)} recorded. Type: ${payment.type}, Date: ${formatDate(payment.date)}.`,
            timestamp: new Date().toISOString(),
            author: "System",
            isSystem: true,
        };
        setFormState(p => ({ ...p, payments: [newPayment, ...p.payments], comments: [comment, ...p.comments] }));
    };
    
    const addComment = (text: string) => {
        const newComment: Comment = { id: `COM-${Date.now()}`, text, timestamp: new Date().toISOString(), author: currentUser?.email };
        setFormState(p => ({ ...p, comments: [newComment, ...p.comments] }));
    };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, linkedItemId?: string, linkedItemType?: 'flight' | 'hotel' | 'excursion' | 'transfer') => {
        if(e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const base64 = await toBase64(file);
            const uploadedFile: UploadedFile = {
                id: `FILE-${Date.now()}`,
                name: file.name,
                type: file.type,
                size: file.size,
                content: base64,
                linkedItemId,
                linkedItemType,
            };
            setFormState(p => ({...p, files: [...p.files, uploadedFile]}));
            e.target.value = ''; // Reset file input to allow re-uploading the same file
        }
    };
    
    // Dedicated handler for processing flight e-tickets. It only updates flight-related state.
    const handleFlightTicketUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemIndex: number) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setAiLoading(true);
        console.log("Uploading in tab: flight", "Updating flight details...");

        try {
            const base64 = await toBase64(file);
            const uploadedFile: Omit<UploadedFile, 'id'> = { name: file.name, type: file.type, size: file.size, content: base64 };
            const prompt = "From this e-ticket, extract all passenger full names and the primary flight segment details. Ensure dates are in YYYY-MM-DD format and times are in HH:MM (24-hour) format.";
            const schema = {
                type: Type.OBJECT, properties: {
                    passengers: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { fullName: { type: Type.STRING } } } },
                    flight: { type: Type.OBJECT, properties: { airline: { type: Type.STRING }, flightNumber: { type: Type.STRING }, pnr: { type: Type.STRING }, departureDate: { type: Type.STRING }, departureTime: { type: Type.STRING }, departureAirport: { type: Type.STRING }, arrivalDate: { type: Type.STRING }, arrivalTime: { type: Type.STRING }, arrivalAirport: { type: Type.STRING } } }
                }
            };
            
            const extractedData = await geminiService.extractDataFromDocument(base64, file.type, schema, prompt);
    
            if (extractedData && extractedData.flight) {
                setFormState(prev => {
                    const { passengers: extractedPassengers, flight: extractedFlight } = extractedData;
                    const existingNames = new Set(prev.passengers.map(p => p.fullName.toLowerCase().trim()));
                    const newUniquePassengers: Passenger[] = (extractedPassengers || []).filter((p: { fullName: string }) => p.fullName && !existingNames.has(p.fullName.toLowerCase().trim())).map((p: { fullName: string }): Passenger => ({ id: `PAX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, fullName: p.fullName.trim(), type: PassengerType.Adult, gender: Gender.Male }));
                    const updatedGlobalPassengers = [...prev.passengers, ...newUniquePassengers];
                    const extractedPassengerNames = new Set((extractedPassengers || []).map((p: { fullName: string }) => p.fullName.toLowerCase().trim()));
                    const passengerIdsForThisFlight = updatedGlobalPassengers.filter(p => extractedPassengerNames.has(p.fullName.toLowerCase().trim())).map(p => p.id);
                    const newPassengerDetailsForFlight: FlightPassengerDetail[] = passengerIdsForThisFlight.map(paxId => ({ passengerId: paxId, passengerType: updatedGlobalPassengers.find(p => p.id === paxId)!.type, netCost: 0, grossBilled: 0 }));
    
                    const updatedFlights = prev.itinerary.flights.map((flight, index) => {
                        if (index === itemIndex) {
                            const updatedFlight = { ...flight, ...extractedFlight, passengerDetails: newPassengerDetailsForFlight };
                            if (updatedFlight.isNetGrossSameForAll) {
                                updatedFlight.passengerDetails = updatedFlight.passengerDetails.map(pd => ({ ...pd, netCost: updatedFlight.commonNetCost, grossBilled: updatedFlight.commonGrossBilled, }));
                            }
                            return updatedFlight;
                        }
                        return flight;
                    });
                    
                    const flightId = updatedFlights[itemIndex].id;
                    const fileToAdd: UploadedFile = { ...uploadedFile, id: `FILE-${Date.now()}`, linkedItemId: flightId, linkedItemType: 'flight' };
                    
                    return { ...prev, passengers: updatedGlobalPassengers, itinerary: { ...prev.itinerary, flights: updatedFlights }, files: [...prev.files, fileToAdd] };
                });
            } else {
                console.warn("AI did not return flight data from the document.");
            }
        } catch (error) {
            console.error("AI parsing error in Flight tab:", error);
            alert("Failed to parse e-ticket. Please check the file and try again.");
        } finally {
            setAiLoading(false);
            e.target.value = '';
        }
    };
    
    // Dedicated handler for processing hotel vouchers. It only updates hotel-related state.
    const handleHotelVoucherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
    
        const file = e.target.files[0];
        setAiLoading(true);
        console.log("Uploading in tab: hotel", "Updating hotel details...");

        try {
            const base64 = await toBase64(file);
            const uploadedFile: Omit<UploadedFile, 'id'> = { name: file.name, type: file.type, size: file.size, content: base64 };
            const prompt = "From this hotel voucher, extract the guest full names and hotel booking details. Ensure dates are in YYYY-MM-DD format.";
            const schema = {
                type: Type.OBJECT, properties: {
                    passengers: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { fullName: { type: Type.STRING } } } },
                    hotel: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, checkIn: { type: Type.STRING }, checkOut: { type: Type.STRING } } }
                }
            };
    
            const extractedData = await geminiService.extractDataFromDocument(base64, file.type, schema, prompt);
            
            if (extractedData && extractedData.hotel) {
                setFormState(prev => {
                    const { passengers: extractedPassengers, hotel: extractedHotel } = extractedData;
                    const existingNames = new Set(prev.passengers.map(p => p.fullName.toLowerCase().trim()));
                    const newUniquePassengers: Passenger[] = (extractedPassengers || []).filter((p: { fullName: string }) => p.fullName && !existingNames.has(p.fullName.toLowerCase().trim())).map((p: { fullName: string }): Passenger => ({ id: `PAX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, fullName: p.fullName.trim(), type: PassengerType.Adult, gender: Gender.Male }));
                    const updatedGlobalPassengers = [...prev.passengers, ...newUniquePassengers];
                    const extractedPassengerNames = new Set((extractedPassengers || []).map((p: { fullName: string }) => p.fullName.toLowerCase().trim()));
                    const passengerIdsForThisHotel = updatedGlobalPassengers.filter(p => extractedPassengerNames.has(p.fullName.toLowerCase().trim())).map(p => p.id);
                    
                    const newHotelId = `HO-${Date.now()}`;
                    const newHotel: Hotel = { id: newHotelId, netCost: 0, grossBilled: 0, supplier: null, numberOfRooms: 1, ...extractedHotel, paxRefs: passengerIdsForThisHotel };
    
                    const fileToAdd: UploadedFile = { ...uploadedFile, id: `FILE-${Date.now()}`, linkedItemId: newHotelId, linkedItemType: 'hotel' };

                    return { ...prev, passengers: updatedGlobalPassengers, itinerary: { ...prev.itinerary, hotels: [...prev.itinerary.hotels, newHotel] }, files: [...prev.files, fileToAdd] };
                });
            } else {
                 console.warn("AI did not return hotel data from the document.");
            }
        } catch (error) {
            console.error("AI parsing error in Hotel tab:", error);
            alert("Failed to parse hotel voucher. Please check the file and try again.");
        } finally {
            setAiLoading(false);
            e.target.value = '';
        }
    };


    const handleSaveSupplier = () => {
        if(newSupplier.name) {
            saveSupplier({ ...newSupplier });
            setSupplierModalOpen(false);
            setNewSupplier({ name: '', contactPerson: '', contactNumber: '' });
        }
    };
    
    const handleSaveInvoice = (invoice: Invoice) => {
        setFormState(p => ({
            ...p,
            invoices: [...(p.invoices || []), invoice]
        }));
    };

    const handleSaveClick = async () => {
        let stateToSave = { ...formState };
        const newSystemLogs: Comment[] = [];
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const rupee = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
    
        const getFlightTotals = (flight: Flight) => {
            return flight.passengerDetails.reduce((acc, pd) => {
                acc.netCost += pd.netCost || 0;
                acc.grossBilled += pd.grossBilled || 0;
                return acc;
            }, { netCost: 0, grossBilled: 0 });
        };

        // Build per-type totals from current form state
        const totals = {
            flights: stateToSave.itinerary.flights.reduce((acc, f) => {
                const t = getFlightTotals(f);
                acc.netCost += t.netCost;
                acc.grossBilled += t.grossBilled;
                return acc;
            }, { netCost: 0, grossBilled: 0 }),
            hotels: stateToSave.itinerary.hotels.reduce((acc, h) => ({ netCost: acc.netCost + (h.netCost || 0), grossBilled: acc.grossBilled + (h.grossBilled || 0) }), { netCost: 0, grossBilled: 0 }),
            transfers: stateToSave.itinerary.transfers.reduce((acc, t) => ({ netCost: acc.netCost + (t.netCost || 0), grossBilled: acc.grossBilled + (t.grossBilled || 0) }), { netCost: 0, grossBilled: 0 }),
            excursions: stateToSave.itinerary.excursions.reduce((acc, e) => ({ netCost: acc.netCost + (e.netCost || 0), grossBilled: acc.grossBilled + (e.grossBilled || 0) }), { netCost: 0, grossBilled: 0 })
        };

        const findMostRecentSystemForType = (label: 'Flight' | 'Hotel' | 'Transfers' | 'Excursions') => {
            return (stateToSave.comments || []).find(c => c.isSystem && typeof c.text === 'string' && c.text.trim().endsWith(`– ${label}`));
        };

        const pushTypeLogIfAny = (label: 'Flight' | 'Hotel' | 'Transfers' | 'Excursions', net: number, gross: number) => {
            if ((net || 0) > 0 || (gross || 0) > 0) {
                const nextText = `${ts} – Net Cost: ${rupee(net)}, Gross Cost: ${rupee(gross)} – ${label}`;
                const recent = findMostRecentSystemForType(label);
                if (recent && recent.isSystem && recent.text === nextText) {
                    return; // skip identical consecutive duplicate
                }
                newSystemLogs.push({
                    id: `SYS-COST-${label}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                    text: nextText,
                    timestamp: now.toISOString(),
                    author: 'System',
                    isSystem: true
                });
            }
        };

        // Log costs only when creating a new docket OR when status changes to Confirmed
        const isNew = !docket;
        const statusJustConfirmed = !!docket && docket.status !== BookingStatus.Confirmed && stateToSave.status === BookingStatus.Confirmed;
        if (isNew || statusJustConfirmed) {
            pushTypeLogIfAny('Flight', totals.flights.netCost, totals.flights.grossBilled);
            pushTypeLogIfAny('Hotel', totals.hotels.netCost, totals.hotels.grossBilled);
            pushTypeLogIfAny('Transfers', totals.transfers.netCost, totals.transfers.grossBilled);
            pushTypeLogIfAny('Excursions', totals.excursions.netCost, totals.excursions.grossBilled);
        }
    
        // If there are new logs, add them to the state that will be saved (prepend to keep latest on top)
        if (newSystemLogs.length > 0) {
            stateToSave = {
                ...stateToSave,
                comments: [...newSystemLogs.reverse(), ...stateToSave.comments],
            };
        }
    
        await onSave(stateToSave, docket?.id);
    
        // Show success message logic
        setShowSaveSuccess(true);
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
        notificationTimer.current = setTimeout(() => {
            setShowSaveSuccess(false);
        }, 3000);
    };

    const handleDeleteClick = () => { if (docket?.id && deleteReason) onDelete(docket.id, deleteReason); setDeleteModalOpen(false); };

    const getLinkedItemDescription = useCallback((file: UploadedFile): string | null => {
        if (!file.linkedItemId || !file.linkedItemType) return null;

        const findItem = (items: any[], id: string) => items.find(item => item.id === id);

        switch (file.linkedItemType) {
            case 'flight':
                const flight = findItem(formState.itinerary.flights, file.linkedItemId);
                return flight ? `Flight: ${flight.airline} (${flight.departureAirport}-${flight.arrivalAirport})` : 'Linked Flight';
            case 'hotel':
                 const hotel = findItem(formState.itinerary.hotels, file.linkedItemId);
                 return hotel ? `Hotel: ${hotel.name}`: 'Linked Hotel';
            default:
                return null;
        }
    }, [formState.itinerary]);

    const tabs = [ { id: 'details', label: 'Client Details', icon: Icons.user }, { id: 'itinerary', label: 'Itinerary', icon: Icons.plane }, { id: 'payments', label: 'Payments', icon: Icons.payment }, { id: 'files', label: 'Files & Comments', icon: Icons.file } ];
    const summaryItems = { flights: financialSummary.flights, hotels: financialSummary.hotels, excursions: financialSummary.excursions, transfers: financialSummary.transfers };

    const SupplierSelectControl: React.FC<{value: string | undefined, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void}> = ({ value, onChange }) => (
        <div className="flex items-end gap-2">
            <FormSelect label="Supplier" value={value || ''} onChange={onChange} disabled={isReadOnly}>
                <option value="">None</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FormSelect>
            <button type="button" onClick={() => setSupplierModalOpen(true)} className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 h-10" disabled={isReadOnly}>{Icons.plus}</button>
        </div>
    );

    // New: Handler to upload an e-ticket from the Passengers tab.
    // This will auto-fill the passenger list and create a new flight from the ticket details.
    const handlePassengerTabTicketUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setAiLoading(true);
        try {
            const base64 = await toBase64(file);
            const uploadedFile: Omit<UploadedFile, 'id'> = { name: file.name, type: file.type, size: file.size, content: base64 };
            const prompt = "From this e-ticket, extract passenger full names and the primary flight segment details. Ensure dates are YYYY-MM-DD and times HH:MM (24h).";
            const schema = {
                type: Type.OBJECT, properties: {
                    passengers: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { fullName: { type: Type.STRING } } } },
                    flight: { type: Type.OBJECT, properties: {
                        airline: { type: Type.STRING },
                        pnr: { type: Type.STRING },
                        flightNumber: { type: Type.STRING },
                        departureDate: { type: Type.STRING },
                        departureTime: { type: Type.STRING },
                        arrivalDate: { type: Type.STRING },
                        arrivalTime: { type: Type.STRING },
                        departureAirport: { type: Type.STRING },
                        arrivalAirport: { type: Type.STRING }
                    } }
                }
            };

            const extractedData = await geminiService.extractDataFromDocument(base64, file.type, schema, prompt);
            if (extractedData && extractedData.flight) {
                setFormState(prev => {
                    const { passengers: extractedPassengers, flight: extractedFlight } = extractedData;
                    // Merge passengers
                    const existingNames = new Set(prev.passengers.map(p => p.fullName.toLowerCase().trim()));
                    const newUniquePassengers: Passenger[] = (extractedPassengers || [])
                        .filter((p: { fullName: string }) => p.fullName && !existingNames.has(p.fullName.toLowerCase().trim()))
                        .map((p: { fullName: string }): Passenger => ({
                            id: `PAX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            fullName: p.fullName.trim(),
                            type: PassengerType.Adult,
                            gender: Gender.Male
                        }));
                    const updatedGlobalPassengers = [...prev.passengers, ...newUniquePassengers];
                    const extractedPassengerNames = new Set((extractedPassengers || []).map((p: { fullName: string }) => p.fullName.toLowerCase().trim()));
                    const passengerIdsForThisFlight = updatedGlobalPassengers
                        .filter(p => extractedPassengerNames.has(p.fullName.toLowerCase().trim()))
                        .map(p => p.id);

                    // Create a new flight entry populated from the ticket
                    const newFlightId = `FL-${Date.now()}`;
                    const newFlight: Flight = {
                        id: newFlightId,
                        airline: extractedFlight.airline || '',
                        pnr: extractedFlight.pnr || '',
                        bookingId: '',
                        flightNumber: extractedFlight.flightNumber || '',
                        departureDate: extractedFlight.departureDate || '',
                        departureTime: extractedFlight.departureTime || '',
                        arrivalDate: extractedFlight.arrivalDate || '',
                        arrivalTime: extractedFlight.arrivalTime || '',
                        departureAirport: extractedFlight.departureAirport || '',
                        arrivalAirport: extractedFlight.arrivalAirport || '',
                        supplier: null,
                        isNetGrossSameForAll: true,
                        commonNetCost: 0,
                        commonGrossBilled: 0,
                        passengerDetails: passengerIdsForThisFlight.map(paxId => ({
                            passengerId: paxId,
                            passengerType: updatedGlobalPassengers.find(p => p.id === paxId)!.type,
                            netCost: 0,
                            grossBilled: 0
                        }))
                    };

                    const fileToAdd: UploadedFile = { ...uploadedFile, id: `FILE-${Date.now()}`, linkedItemId: newFlightId, linkedItemType: 'flight' };

                    return {
                        ...prev,
                        passengers: updatedGlobalPassengers,
                        itinerary: { ...prev.itinerary, flights: [...prev.itinerary.flights, newFlight] },
                        files: [...prev.files, fileToAdd]
                    };
                });
            } else {
                console.warn("AI did not return flight data from the document (Passengers tab upload).");
                alert("Could not detect flight details from the e-ticket. Please try another file or fill manually.");
            }
        } catch (error) {
            console.error("AI parsing error in Passengers tab:", error);
            alert("Failed to parse e-ticket. Please check the file and try again.");
        } finally {
            setAiLoading(false);
            e.target.value = '';
        }
    };

    return (
    <>
        {showSaveSuccess && (
            <div className="fixed top-24 right-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300" role="alert">
                <strong className="font-bold">Success!</strong>
                <span className="block sm:inline ml-2">Docket saved successfully.</span>
            </div>
        )}
        <div className="flex flex-col lg:flex-row h-full bg-slate-100">
            <div className="flex-grow lg:w-2/3 p-4 sm:p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        {docket ? `Edit Docket: ${docket.docketNo || docket.id}` : 'Create New Docket'}
                        {isReadOnly && <span className="text-amber-500" title="Read-only mode">🔒</span>}
                    </h1>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </div>
                
                {isReadOnly && (
                    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 mb-4 rounded-r-lg" role="alert">
                      <p className="font-bold">Read-Only Mode</p>
                      <p>This docket was created by another user. You can view details and add comments, but you cannot make any other changes.</p>
                    </div>
                )}


                <div className="border-b border-slate-200 mb-6"><nav className="-mb-px flex space-x-6" aria-label="Tabs">{tabs.map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`${ activeTab === tab.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>{tab.icon} {tab.label}</button>))}</nav></div>
                
                {aiLoading && (<div className="absolute inset-0 bg-white/70 z-30 flex flex-col justify-center items-center"><Spinner /><p className="mt-4 text-slate-600 font-semibold">AI is processing your document...</p></div>)}

                <div className="space-y-6">
                {activeTab === 'details' && (<Section title="Client Details" icon={Icons.user}><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormInput label="Client Name" value={formState.client.name} onChange={e => handleClientChange('name', e.target.value)} disabled={isReadOnly} /><FormInput label="Contact Info (Email/Phone)" value={formState.client.contactInfo} onChange={e => handleClientChange('contactInfo', e.target.value)} disabled={isReadOnly}/><FormSelect label="Lead Source" value={formState.client.leadSource} onChange={e => handleClientChange('leadSource', e.target.value as LeadSource)} disabled={isReadOnly}>{LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</FormSelect><FormSelect label="Assigned Agent" value={formState.agentId || ''} onChange={e => setFormState(p => ({...p, agentId: e.target.value || null}))} disabled={isReadOnly}><option value="">-- Unassigned --</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</FormSelect></div></Section>)}

                {activeTab === 'itinerary' && (<>
                    <div className={`${formState.status === BookingStatus.Confirmed ? 'confirmed-mode' : 'editable-mode'}`}>
                     <Section title="Passengers" icon={Icons.user} bgClass="bg-white">
                         <div className="flex items-center gap-4 mb-4">
                             <button onClick={addPassenger} disabled={isReadOnly} className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 disabled:bg-slate-200 disabled:text-slate-500">{Icons.plus} Add Passenger</button>
                             <label htmlFor="pax-ticket-upload" className={`flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-purple-200 ${isReadOnly ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'cursor-pointer'}`}>
                                 {Icons.ai} Upload E‑Ticket & Autofill
                             </label>
                             <input id="pax-ticket-upload" type="file" className="hidden" onChange={handlePassengerTabTicketUpload} accept="image/*,application/pdf" disabled={isReadOnly} />
                         </div>
                         <div className="space-y-3">{formState.passengers.map((pax, index) => (
                             <details key={pax.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                 <summary className="flex justify-between items-center cursor-pointer list-none">
                                     <div className="flex items-center gap-2">
                                          <span className="text-slate-400">{Icons.chevronDown}</span>
                                         <span className="font-medium text-slate-800">{pax.fullName || `Passenger ${index + 1}`}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <FormSelect label="" value={pax.type} onChange={e => updatePassenger(pax.id, 'type', e.target.value as PassengerType)} disabled={isReadOnly} className="w-24 text-sm !p-1.5">{Object.values(PassengerType).map(t => <option key={t} value={t}>{t}</option>)}</FormSelect>
                                         <FormSelect label="" value={pax.gender} onChange={e => updatePassenger(pax.id, 'gender', e.target.value as Gender)} disabled={isReadOnly} className="w-24 text-sm !p-1.5">{Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}</FormSelect>
                                         <button onClick={() => removePassenger(pax.id)} disabled={isReadOnly} className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent">{Icons.trash}</button>
                                     </div>
                                 </summary>
                                 <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                                     <FormInput label="Full Name" value={pax.fullName} onChange={e => updatePassenger(pax.id, 'fullName', e.target.value)} placeholder={`Passenger ${index + 1} Full Name`} disabled={isReadOnly} />
                                     <FormInput label="Email" type="email" value={pax.email || ''} onChange={e => updatePassenger(pax.id, 'email', e.target.value)} placeholder="Email Address" disabled={isReadOnly} />
                                     <FormInput label="Phone" value={pax.phone || ''} onChange={e => updatePassenger(pax.id, 'phone', e.target.value)} placeholder="Phone Number" disabled={isReadOnly} />
                                     <FormInput label="GSTIN (Optional)" value={pax.gstin || ''} onChange={e => updatePassenger(pax.id, 'gstin', e.target.value)} placeholder="GST Identification Number" disabled={isReadOnly} />
                                     <FormTextarea containerClassName="md:col-span-2" label="Address" value={pax.address || ''} onChange={e => updatePassenger(pax.id, 'address', e.target.value)} placeholder="Billing Address" rows={2} disabled={isReadOnly} />
                                 </div>
                             </details>
                         ))}</div>
                     </Section>

                     <Section title="Flights" icon={Icons.plane} bgClass="bg-[#f0f8ff]">
                         <div className="flex items-center gap-2 mb-4">
                             <button onClick={() => addToArray('flights', { id: `FL-${Date.now()}`, airline: '', pnr: '', bookingId: '', flightNumber: '', departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '', departureAirport: '', arrivalAirport: '', supplier: null, isNetGrossSameForAll: false, commonNetCost: 0, commonGrossBilled: 0, passengerDetails: [] })} disabled={isReadOnly} className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 disabled:bg-slate-200 disabled:text-slate-500">{Icons.plus} Add Flight</button>
                         </div>
                         {formState.itinerary.flights.map((flight, index) => (
                         <div key={flight.id} className="p-4 border rounded-md mb-4 bg-slate-50">
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                 <FormInput label="Airline" value={flight.airline} onChange={e => handleFlightFieldChange(index, 'airline', e.target.value)} disabled={isReadOnly} />
                                 <FormInput label="Flight No." value={flight.flightNumber || ''} onChange={e => handleFlightFieldChange(index, 'flightNumber', e.target.value)} disabled={isReadOnly} />
                                 <FormInput label="PNR" value={flight.pnr} onChange={e => handleFlightFieldChange(index, 'pnr', e.target.value)} disabled={isReadOnly} />
                                 <div><SupplierSelectControl value={flight.supplier?.id} onChange={e => handleFlightFieldChange(index, 'supplier', suppliers.find(s => s.id === e.target.value) || null)} /></div>
                                 <FormInput containerClassName="md:col-span-2" label="From Airport" value={flight.departureAirport} onChange={e => handleFlightFieldChange(index, 'departureAirport', e.target.value)} disabled={isReadOnly} />
                                 <FormInput containerClassName="md:col-span-2" label="To Airport" value={flight.arrivalAirport} onChange={e => handleFlightFieldChange(index, 'arrivalAirport', e.target.value)} disabled={isReadOnly} />
                                 <FormInput label="Departure Date" type="date" value={flight.departureDate} onChange={e => handleFlightFieldChange(index, 'departureDate', e.target.value)} icon={Icons.calendar} disabled={isReadOnly} />
                                 <FormInput label="Departure Time" type="time" value={flight.departureTime || ''} onChange={e => handleFlightFieldChange(index, 'departureTime', e.target.value)} disabled={isReadOnly} />
                                 <FormInput label="Arrival Date" type="date" value={flight.arrivalDate || ''} onChange={e => handleFlightFieldChange(index, 'arrivalDate', e.target.value)} icon={Icons.calendar} disabled={isReadOnly} />
                                 <FormInput label="Arrival Time" type="time" value={flight.arrivalTime || ''} onChange={e => handleFlightFieldChange(index, 'arrivalTime', e.target.value)} disabled={isReadOnly} />
                             </div>
                             <div className="flex items-center justify-end gap-2">
                                 <label htmlFor={`flight-upload-${index}`} className={`flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-2 rounded-md text-sm font-semibold hover:bg-purple-200 ${isReadOnly ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'cursor-pointer'}`}>
                                     {Icons.ai} Upload & Autofill Ticket
                                 </label>
                                 <input id={`flight-upload-${index}`} type="file" className="hidden" onChange={e => handleFlightTicketUpload(e, index)} accept="image/*,application/pdf" disabled={isReadOnly} />
                                 <button onClick={() => removeFromArray('flights', index)} className="p-2 text-red-500 hover:bg-red-100 rounded-md h-10 disabled:text-slate-400 disabled:hover:bg-transparent" disabled={isReadOnly}>{Icons.trash}</button>
                             </div>
                             <div className="p-3 border-t mt-4">
                                 <div className="flex justify-between items-center mb-2">
                                     <h4 className="font-semibold">Passengers & Pricing</h4>
                                     <button
                                         type="button"
                                         onClick={() => setAddPaxToFlightIndex(index)}
                                         className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 disabled:bg-slate-200 disabled:text-slate-500"
                                         disabled={isReadOnly}
                                     >
                                         {Icons.plus} Add Passenger Manually
                                     </button>
                                 </div>
                                 <div className="flex items-center gap-4 mb-3 p-2 bg-slate-200 rounded-md">
                                     <label className="flex items-center gap-2 text-sm font-medium">
                                         <input 
                                             type="checkbox" 
                                             checked={flight.isNetGrossSameForAll} 
                                             onChange={() => handleFlightSameCostToggle(index)} 
                                             className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                             disabled={isReadOnly}
                                         />
                                         Net/Gross is same for all
                                     </label>
                                     {flight.isNetGrossSameForAll && (
                                         <>
                                             <FormInput 
                                                 label="Common Net" 
                                                 type="number" 
                                                 value={flight.commonNetCost || ''} 
                                                 onChange={e => handleFlightCommonCostChange(index, 'commonNetCost', +e.target.value)} 
                                                 disabled={isReadOnly}
                                             />
                                             <FormInput 
                                                 label="Common Gross" 
                                                 type="number" 
                                                 value={flight.commonGrossBilled || ''} 
                                                 onChange={e => handleFlightCommonCostChange(index, 'commonGrossBilled', +e.target.value)} 
                                                 disabled={isReadOnly}
                                             />
                                         </>
                                     )}
                                 </div>
                                 <div className="space-y-2">
                                     {flight.passengerDetails.length > 0 ? (
                                         flight.passengerDetails.map((paxDetail) => {
                                             const pax = formState.passengers.find(p => p.id === paxDetail.passengerId);
                                             if (!pax) return null;

                                             return (
                                                 <div key={pax.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md hover:bg-slate-100">
                                                     <div className="col-span-12 md:col-span-5 flex items-center">
                                                         <span className="font-medium text-sm truncate">{pax.fullName}</span>
                                                     </div>
                                                     <div className="col-span-5 md:col-span-3">
                                                         <FormInput
                                                             label=""
                                                             placeholder="Net Cost"
                                                             type="number"
                                                             disabled={flight.isNetGrossSameForAll || isReadOnly}
                                                             value={paxDetail.netCost || ''}
                                                             onChange={e => handleFlightPaxPriceChange(index, pax.id, 'netCost', +e.target.value)}
                                                         />
                                                     </div>
                                                     <div className="col-span-5 md:col-span-3">
                                                         <FormInput
                                                             label=""
                                                             placeholder="Gross Billed"
                                                             type="number"
                                                             disabled={flight.isNetGrossSameForAll || isReadOnly}
                                                             value={paxDetail.grossBilled || ''}
                                                             onChange={e => handleFlightPaxPriceChange(index, pax.id, 'grossBilled', +e.target.value)}
                                                         />
                                                     </div>
                                                     <div className="col-span-2 md:col-span-1 flex justify-end">
                                                         <button
                                                             type="button"
                                                             onClick={() => removePassengerFromFlight(index, pax.id)}
                                                             className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent"
                                                             aria-label={`Remove ${pax.fullName} from flight`}
                                                             disabled={isReadOnly}
                                                         >
                                                             {Icons.trash}
                                                         </button>
                                                     </div>
                                                 </div>
                                             );
                                         })
                                     ) : (
                                         <p className="text-sm text-slate-500 text-center py-2">Add passengers to this flight via the "Add Passenger Manually" button or by uploading an e-ticket.</p>
                                     )}
                                 </div>
                             </div>
                         </div>
                         ))}
                     </Section>
                     <Section title="Hotels" icon={Icons.hotel} bgClass="bg-[#f4fff0]"><div className="flex items-center gap-4 mb-4"><button onClick={() => addToArray('hotels', { id: `HO-${Date.now()}`, name: '', checkIn: '', checkOut: '', numberOfRooms: 1, netCost: 0, grossBilled: 0, supplier: null, paxRefs: [] })} disabled={isReadOnly} className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 disabled:bg-slate-200 disabled:text-slate-500">{Icons.plus} Add Hotel</button><label htmlFor="hotel-upload" className={`flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-purple-200 ${isReadOnly ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'cursor-pointer'}`}>{Icons.ai} Autofill from Voucher</label><input id="hotel-upload" type="file" className="hidden" onChange={handleHotelVoucherUpload} accept="image/*,application/pdf" disabled={isReadOnly}/></div>{formState.itinerary.hotels.map((hotel, index) => (<div key={hotel.id} className="p-4 border rounded-md mb-2 bg-slate-50 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end"><FormInput containerClassName="col-span-2 md:col-span-3 lg:col-span-5" label="Hotel Name" value={hotel.name} onChange={e => handleArrayChange('hotels', index, 'name', e.target.value)} disabled={isReadOnly} /><FormInput label="Check-in" type="date" value={hotel.checkIn} onChange={e => handleArrayChange('hotels', index, 'checkIn', e.target.value)} icon={Icons.calendar} disabled={isReadOnly} /><FormInput label="Check-out" type="date" value={hotel.checkOut} onChange={e => handleArrayChange('hotels', index, 'checkOut', e.target.value)} icon={Icons.calendar} disabled={isReadOnly} /><FormInput label="Nights" type="text" readOnly value={getNumberOfNights(hotel.checkIn, hotel.checkOut)} /><FormInput label="Rooms" type="number" value={hotel.numberOfRooms} onChange={e => handleArrayChange('hotels', index, 'numberOfRooms', +e.target.value)} disabled={isReadOnly} /><button onClick={() => removeFromArray('hotels', index)} className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent" disabled={isReadOnly}>{Icons.trash} Remove</button><FormInput label="Net Cost" type="number" value={hotel.netCost} onChange={e => handleArrayChange('hotels', index, 'netCost', +e.target.value)} disabled={isReadOnly} /><FormInput label="Gross Billed" type="number" value={hotel.grossBilled} onChange={e => handleArrayChange('hotels', index, 'grossBilled', +e.target.value)} disabled={isReadOnly} /><div className="col-span-2 md:col-span-1"><SupplierSelectControl value={hotel.supplier?.id} onChange={e => handleArrayChange('hotels', index, 'supplier', suppliers.find(s => s.id === e.target.value) || null)} /></div><div className="col-span-full border-t pt-4 mt-4"><h4 className="font-semibold text-sm mb-2 text-slate-600">Guests for this Hotel</h4>{formState.passengers.length > 0 ? (<div className="grid grid-cols-2 md:grid-cols-3 gap-2">{formState.passengers.map(pax => (<label key={pax.id} className="flex items-center gap-2 p-2 bg-white rounded-md border text-left"><input type="checkbox" checked={hotel.paxRefs.includes(pax.id)} onChange={() => handleHotelPaxToggle(index, pax.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" disabled={isReadOnly} /><span className="text-sm truncate">{pax.fullName}</span></label>))}</div>) : (<p className="text-sm text-slate-500">Add passengers to the docket first to assign them to this hotel.</p>)}</div></div>))}</Section>
                     <Section title="Excursions / Activities" icon={Icons.excursion} bgClass="bg-[#fffdf0]"><button onClick={() => addToArray('excursions', { id: `EX-${Date.now()}`, name: '', date: '', netCost: 0, grossBilled: 0, supplier: null })} disabled={isReadOnly} className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 mb-4 disabled:bg-slate-200 disabled:text-slate-500">{Icons.plus} Add Excursion</button>{formState.itinerary.excursions.map((excursion, index) => (<div key={excursion.id} className="p-4 border rounded-md mb-2 bg-slate-50 grid grid-cols-2 md:grid-cols-4 gap-4 items-end"><FormInput containerClassName="col-span-2" label="Excursion Name" value={excursion.name} onChange={e => handleArrayChange('excursions', index, 'name', e.target.value)} disabled={isReadOnly} /><FormInput label="Date" type="date" value={excursion.date} onChange={e => handleArrayChange('excursions', index, 'date', e.target.value)} icon={Icons.calendar} disabled={isReadOnly} /><button onClick={() => removeFromArray('excursions', index)} className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent" disabled={isReadOnly}>{Icons.trash} Remove</button><FormInput label="Net Cost" type="number" value={excursion.netCost} onChange={e => handleArrayChange('excursions', index, 'netCost', +e.target.value)} disabled={isReadOnly} /><FormInput label="Gross Billed" type="number" value={excursion.grossBilled} onChange={e => handleArrayChange('excursions', index, 'grossBilled', +e.target.value)} disabled={isReadOnly} /><div className="col-span-2 md:col-span-1"><SupplierSelectControl value={excursion.supplier?.id} onChange={e => handleArrayChange('excursions', index, 'supplier', suppliers.find(s => s.id === e.target.value) || null)} /></div></div>))}</Section>
                     <Section title="Transfers" icon={Icons.transfer} bgClass="bg-[#f9f0ff]"><button onClick={() => addToArray('transfers', { id: `TR-${Date.now()}`, provider: '', date: '', netCost: 0, grossBilled: 0, supplier: null })} disabled={isReadOnly} className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 mb-4 disabled:bg-slate-200 disabled:text-slate-500">{Icons.plus} Add Transfer</button>{formState.itinerary.transfers.map((transfer, index) => (<div key={transfer.id} className="p-4 border rounded-md mb-2 bg-slate-50 grid grid-cols-2 md:grid-cols-4 gap-4 items-end"><FormInput containerClassName="col-span-2" label="Provider Name" value={transfer.provider} onChange={e => handleArrayChange('transfers', index, 'provider', e.target.value)} disabled={isReadOnly} /><FormInput label="Date" type="date" value={transfer.date} onChange={e => handleArrayChange('transfers', index, 'date', e.target.value)} icon={Icons.calendar} disabled={isReadOnly} /><button onClick={() => removeFromArray('transfers', index)} className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent" disabled={isReadOnly}>{Icons.trash} Remove</button><FormInput label="Net Cost" type="number" value={transfer.netCost} onChange={e => handleArrayChange('transfers', index, 'netCost', +e.target.value)} disabled={isReadOnly} /><FormInput label="Gross Billed" type="number" value={transfer.grossBilled} onChange={e => handleArrayChange('transfers', index, 'grossBilled', +e.target.value)} disabled={isReadOnly} /><div className="col-span-2 md:col-span-1"><SupplierSelectControl value={transfer.supplier?.id} onChange={e => handleArrayChange('transfers', index, 'supplier', suppliers.find(s => s.id === e.target.value) || null)} /></div></div>))}</Section>
                     </div>
                 </>)}

                {activeTab === 'payments' && (<Section title="Payments" icon={Icons.payment}><NewPaymentForm onAddPayment={addPayment} disabled={isReadOnly} /><h4 className="text-lg font-semibold mt-6 mb-2">Payment History</h4><div className="space-y-2">{formState.payments.map(p => (<div key={p.id} className="bg-slate-50 p-3 rounded-md "><div className="flex justify-between items-center"><div><p className="font-bold text-lg text-green-700">{formatCurrency(p.amount)}</p><p className="text-sm text-slate-600">{p.type} on {formatDate(p.date)}</p></div></div><p className="text-xs text-slate-500 italic mt-1">{amountToWords(p.amount)}</p>{p.notes && <p className="text-xs text-slate-500 mt-1">Note: {p.notes}</p>}</div>))}</div></Section>)}
                {activeTab === 'files' && (<><Section title="Files" icon={Icons.file}><input type="file" onChange={e => handleFileUpload(e)} className="mb-4" disabled={isReadOnly} /><div className="space-y-2">{formState.files.map(f => {
                    const linkedItemDesc = getLinkedItemDescription(f);
                    return (
                    <div key={f.id} className="bg-slate-100 p-2 rounded flex justify-between items-center">
                        <div>
                            <p className="font-medium text-slate-700">{f.name} ({(f.size/1024).toFixed(1)} KB)</p>
                            {linkedItemDesc && <p className="text-xs text-slate-500 italic">Linked to: {linkedItemDesc}</p>}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPreviewFile(f)}
                                className="px-3 py-1 text-xs bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                            >
                                View
                            </button>
                            <button
                                onClick={() => {
                                    const dataUrl = `data:${f.type};base64,${f.content}`;
                                    const link = document.createElement('a');
                                    link.href = dataUrl;
                                    link.download = f.name;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                className="px-3 py-1 text-xs bg-brand-secondary text-white rounded-md hover:bg-slate-700"
                            >
                                Download
                            </button>
                        </div>
                    </div>)
                })}</div></Section><Section title="Comments" icon={Icons.comment}><NewCommentForm onAddComment={addComment} /><div className="space-y-3 mt-4">{formState.comments.map(c => (<div key={c.id} className={`p-3 rounded-lg ${c.isSystem ? 'bg-slate-100' : 'bg-slate-50'}`}><p className="text-slate-800 whitespace-pre-wrap">{c.isSystem && <span className="mr-2" role="img" aria-label="System Log">🔒</span>}{c.text}</p><p className="text-xs text-slate-400 text-right mt-1">{c.author || 'User'} at {formatDateTimeIST(c.timestamp)}</p></div>))}</div></Section></>)}
                </div>
            </div>

            <div className="lg:w-1/3 bg-white p-6 border-l border-slate-200"><div className="sticky top-20"><div className="space-y-6">
            {forceReadOnly && (
              <div className="p-3 rounded bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold">
                {readOnlyBanner || 'Read Only View – Deleted Docket'}
              </div>
            )}
            <div className="bg-slate-50 p-4 rounded-lg shadow-sm"><h3 className="font-semibold mb-3">Docket Control</h3><div className="space-y-4"><FormSelect label="Booking Status" value={formState.status} onChange={e => setFormState(p => ({...p, status: e.target.value as BookingStatus}))} disabled={isReadOnly}>{Object.values(BookingStatus).map(s => <option key={s} value={s}>{s}</option>)}</FormSelect><FormSelect label="Tag" value={formState.tag} onChange={e => setFormState(p => ({...p, tag: e.target.value as Tag}))} disabled={isReadOnly}>{Object.values(Tag).map(t => <option key={t} value={t}>{t}</option>)}</FormSelect></div></div>
            {!isReadOnly && (
              <div className="bg-slate-50 p-4 rounded-lg shadow-sm">
                  <h3 className="font-semibold mb-3">Actions</h3>
                  <button onClick={() => setInvoiceModalOpen(true)} disabled={!docket?.id} className="w-full bg-teal-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-teal-600 disabled:bg-slate-400 disabled:cursor-not-allowed">Generate Invoice</button>
                  {formState.invoices && formState.invoices.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                          <h4 className="font-semibold text-sm mb-2 text-slate-600">Generated Invoices</h4>
                          <div className="space-y-2">
                              {[...formState.invoices].reverse().map(inv => (
                                  <div key={inv.id} className="flex justify-between items-center bg-white p-2 rounded-md border">
                                      <div>
                                          <p className="font-semibold text-sm text-slate-800">{inv.invoiceNumber}</p>
                                          <p className="text-xs text-slate-500">{formatDate(inv.date)} - {formatCurrency(inv.grandTotal)}</p>
                                      </div>
                                      <button onClick={() => setPreviewInvoice(inv)} className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">
                                          Preview
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
            )}
            <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200"><h3 className="font-semibold mb-3 text-blue-800">Financial Summary</h3><div className="space-y-2 text-sm">{Object.entries(summaryItems).map(([key, value]) => (<div key={key} className="flex justify-between items-center"><span className="capitalize text-slate-600">{key}</span><div className="text-right"><p className="font-semibold text-slate-800">{formatCurrency(value.grossBilled)} <span className={`text-xs ${value.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>({formatCurrency(value.profit)})</span></p></div></div>))}<div className="pt-2 border-t mt-2"><div className="flex justify-between font-bold"><span className="text-slate-700">Grand Total</span><span className="text-slate-900">{formatCurrency(financialSummary.grandTotalGross)}</span></div><div className="flex justify-between font-bold"><span className="text-slate-700">Total Net</span><span className="text-slate-900">{formatCurrency(financialSummary.grandTotalNet)}</span></div><div className="flex justify-between font-bold text-green-700"><span >Total Profit</span><span>{formatCurrency(financialSummary.grandTotalProfit)}</span></div></div><div className="pt-2 border-t mt-2"><div className="flex justify-between"><span className="text-slate-700">Amount Paid</span><span className="text-green-700 font-semibold">{formatCurrency(financialSummary.amountPaid)}</span></div><div className="flex justify-between font-bold"><span className="text-slate-700">Balance Due</span><span className="text-orange-600">{formatCurrency(financialSummary.balanceDue)}</span></div></div></div></div><div className="space-y-4">{!isReadOnly ? (
              <button onClick={handleSaveClick} disabled={isSaving} className="w-full flex justify-center items-center bg-brand-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-slate-400">{isSaving ? <Spinner size="sm" /> : (docket ? 'Save Changes' : 'Create Docket')}</button>
            ) : (
              <button onClick={onClose} className="w-full flex justify-center items-center bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-lg">Close</button>
            )}
            {!isReadOnly && docket && (
              <div className="p-4 border border-red-200 rounded-lg bg-red-50"><h3 className="font-semibold text-red-800">Danger Zone</h3><p className="text-sm text-red-600 my-2">Deleting a docket is permanent and cannot be undone.</p><button onClick={() => setDeleteModalOpen(true)} className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700">Delete Docket</button></div>
            )}
            </div></div></div></div>
        </div>

        <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Confirm Deletion"><p className="mb-4">Are you sure you want to delete this docket? This action cannot be undone. Please provide a reason for deletion.</p><FormTextarea label="Reason" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Reason for deletion..." className="mb-4"></FormTextarea><div className="flex justify-end gap-3"><button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button><button onClick={handleDeleteClick} disabled={!deleteReason} className="px-4 py-2 bg-red-600 text-white rounded-md disabled:bg-red-300">Delete</button></div></Modal>
        
        <Modal isOpen={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} title="Add New Supplier">
            <div className="space-y-4">
                <FormInput label="Supplier Name" value={newSupplier.name} onChange={e => setNewSupplier(p => ({...p, name: e.target.value}))} />
                <FormInput label="Contact Person" value={newSupplier.contactPerson} onChange={e => setNewSupplier(p => ({...p, contactPerson: e.target.value}))} />
                <FormInput label="Contact Number" value={newSupplier.contactNumber} onChange={e => setNewSupplier(p => ({...p, contactNumber: e.target.value}))} />
                <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => setSupplierModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
                    <button onClick={handleSaveSupplier} className="px-4 py-2 bg-brand-primary text-white rounded-md">Save Supplier</button>
                </div>
            </div>
        </Modal>

        {invoiceModalOpen && docket && (
            <InvoiceGenerator 
                docket={docket}
                passengers={formState.passengers}
                onClose={() => setInvoiceModalOpen(false)}
                onSaveInvoice={handleSaveInvoice}
            />
        )}

        <Modal isOpen={addPaxToFlightIndex !== null} onClose={() => setAddPaxToFlightIndex(null)} title="Add Passengers to Flight">
            {addPaxToFlightIndex !== null && (
                <AddPaxToFlightModalContent 
                    availablePassengers={formState.passengers.filter(p => !formState.itinerary.flights[addPaxToFlightIndex].passengerDetails.some(pd => pd.passengerId === p.id))}
                    onAdd={(selectedIds) => handleAddPassengersToFlight(addPaxToFlightIndex, selectedIds)}
                    onCancel={() => setAddPaxToFlightIndex(null)}
                />
            )}
        </Modal>

        {previewInvoice && (
            <Modal isOpen={!!previewInvoice} onClose={() => setPreviewInvoice(null)} title={`Preview Invoice: ${previewInvoice.invoiceNumber}`} width="max-w-5xl">
                <InvoicePreview invoice={previewInvoice} />
            </Modal>
        )}

        {previewFile && (
          <Modal isOpen={!!previewFile} onClose={() => setPreviewFile(null)} title={`View File: ${previewFile.name}`} width="max-w-5xl">
            {previewFile.type?.includes('pdf') ? (
              <iframe
                src={`data:${previewFile.type};base64,${previewFile.content}`}
                className="w-full"
                style={{ height: '75vh' }}
              />
            ) : (
              <img
                src={`data:${previewFile.type};base64,${previewFile.content}`}
                alt={previewFile.name}
                className="max-h-[75vh] w-auto mx-auto"
              />
            )}
          </Modal>
        )}
    </>
    );
};