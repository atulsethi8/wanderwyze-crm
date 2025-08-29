import React, { useState, useEffect, useMemo } from 'react';
import { Icons, Modal, Spinner, FormInput, FormTextarea, FormSelect } from './common';
import { leadService } from '../services/leadService';

export enum LeadStatus {
  Cold = 'cold',
  Warm = 'warm',
  Final = 'final'
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  source: string;
  status: LeadStatus;
  description: string;
  assignedTo: string;
  expectedValue: number;
  createdDate: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  notes: string;
  // Travel details
  travelDates: {
    departureDate: string;
    returnDate: string;
  };
  numberOfPax: number;
  numberOfNights: number; // Added
  // New fields for itinerary and quotation
  itinerary: {
    day1?: string;
    day2?: string;
    day3?: string;
    day4?: string;
    day5?: string;
    day6?: string;
    day7?: string;
    day8?: string;
    day9?: string;
    day10?: string;
  };
  quotation: {
    flights: number;
    hotels: number;
    excursions: number;
    transfers: number;
    total: number;
  };
}

interface LeadsPipelineProps {
  onConvertToDocket: (lead: Lead) => void;
}

const LeadCard: React.FC<{ lead: Lead; onEdit: (lead: Lead) => void; onDelete: (id: string) => void }> = ({ lead, onEdit, onDelete }) => {
  // Helper function to format date to dd/mm/yyyy
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // dd/mm/yyyy format
  };

  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case LeadStatus.Cold: return 'bg-blue-100 text-blue-800';
      case LeadStatus.Warm: return 'bg-orange-100 text-orange-800';
      case LeadStatus.Final: return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: LeadStatus) => {
    switch (status) {
      case LeadStatus.Cold: return '❄️';
      case LeadStatus.Warm: return '🔥';
      case LeadStatus.Final: return '✅';
      default: return '📋';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{lead.name}</h3>
          <p className="text-gray-600 text-sm">{lead.company || 'No Company'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
            {getStatusIcon(lead.status)} {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
          </span>
        </div>
      </div>
      
             <div className="space-y-2 mb-3">
         <div className="flex items-center gap-2 text-sm text-gray-600">
           <span>📧 {lead.email}</span>
         </div>
         <div className="flex items-center gap-2 text-sm text-gray-600">
           <span>📞 {lead.phone}</span>
         </div>
         <div className="flex items-center gap-2 text-sm text-gray-600">
           <span>💰 Expected: ₹{lead.expectedValue.toLocaleString()}</span>
         </div>
         <div className="flex items-center gap-2 text-sm text-gray-600">
           <span>👥 {lead.numberOfPax} Passenger(s)</span>
         </div>
                   {lead.travelDates.departureDate && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>✈️ {formatDate(lead.travelDates.departureDate)} - {lead.travelDates.returnDate ? formatDate(lead.travelDates.returnDate) : 'TBD'} ({lead.numberOfNights} Night{lead.numberOfNights > 1 ? 's' : ''})</span>
            </div>
          )}
       </div>

      {lead.quotation.total > 0 && (
        <div className="bg-gray-50 p-3 rounded-md mb-3">
          <h4 className="font-medium text-sm text-gray-700 mb-2">Quotation Summary</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Flights: ₹{lead.quotation.flights.toLocaleString()}</div>
            <div>Hotels: ₹{lead.quotation.hotels.toLocaleString()}</div>
            <div>Excursions: ₹{lead.quotation.excursions.toLocaleString()}</div>
            <div>Transfers: ₹{lead.quotation.transfers.toLocaleString()}</div>
          </div>
          <div className="border-t mt-2 pt-2">
            <strong>Total: ₹{lead.quotation.total.toLocaleString()}</strong>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
                 <div className="text-xs text-gray-500">
           Created: {formatDate(lead.createdDate)}
         </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(lead)}
            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(lead.id)}
            className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const AddLeadModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (lead: Omit<Lead, 'id'>) => void }> = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<Omit<Lead, 'id'>>({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: '',
    status: LeadStatus.Cold,
    description: '',
    assignedTo: '',
    expectedValue: 0,
    createdDate: new Date().toISOString().split('T')[0],
    lastContactDate: '',
    nextFollowUpDate: '',
    notes: '',
    travelDates: {
      departureDate: '',
      returnDate: ''
    },
    numberOfPax: 1,
    numberOfNights: 0, // Added
    itinerary: {},
    quotation: {
      flights: 0,
      hotels: 0,
      excursions: 0,
      transfers: 0,
      total: 0
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [numberOfDays, setNumberOfDays] = useState(5);

  // Helper function to calculate number of nights
  const calculateNights = (departureDate: string, returnDate: string): number => {
    if (!departureDate || !returnDate) return 0;
    const departure = new Date(departureDate);
    const returnDateObj = new Date(returnDate);
    const diffTime = returnDateObj.getTime() - departure.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Calculate total quotation
    const total = formData.quotation.flights + formData.quotation.hotels + formData.quotation.excursions + formData.quotation.transfers;
    const updatedFormData = { ...formData, quotation: { ...formData.quotation, total } };
    
    await onSave(updatedFormData);
    setIsSubmitting(false);
    onClose();
  };

  const updateItinerary = (day: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      itinerary: { ...prev.itinerary, [day]: value }
    }));
  };

  const updateQuotation = (field: keyof typeof formData.quotation, value: number) => {
    setFormData(prev => ({
      ...prev,
      quotation: { ...prev.quotation, [field]: value }
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Lead" width="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
        {/* Customer Details Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Customer Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <FormInput
               label="Name"
               value={formData.name}
               onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
             />
             <FormInput
               label="Email"
               type="email"
               value={formData.email}
               onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
             />
             <FormInput
               label="Phone"
               value={formData.phone}
               onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
             />
            <FormInput
              label="Company"
              value={formData.company}
              onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
            />
            <FormInput
              label="Source"
              value={formData.source}
              onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
            />
            <FormSelect
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as LeadStatus }))}
            >
              <option value={LeadStatus.Cold}>Cold</option>
              <option value={LeadStatus.Warm}>Warm</option>
              <option value={LeadStatus.Final}>Final</option>
            </FormSelect>
                         <FormSelect
               label="Assigned To"
               value={formData.assignedTo}
               onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
             >
               <option value="">Select Assignee</option>
               <option value="Atul">Atul</option>
               <option value="Ravi">Ravi</option>
             </FormSelect>
            <FormInput
              label="Expected Value (₹)"
              type="number"
              value={formData.expectedValue}
              onChange={(e) => setFormData(prev => ({ ...prev, expectedValue: Number(e.target.value) }))}
            />
          </div>
        </div>

        {/* Travel Details Section */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-blue-800">Travel Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInput
              label="Departure Date"
              type="date"
              value={formData.travelDates.departureDate}
              onChange={(e) => {
                const departureDate = e.target.value;
                const returnDate = formData.travelDates.returnDate;
                const nights = calculateNights(departureDate, returnDate);
                setFormData(prev => ({
                  ...prev,
                  travelDates: { ...prev.travelDates, departureDate },
                  numberOfNights: nights
                }));
              }}
            />
            <FormInput
              label="Return Date"
              type="date"
              value={formData.travelDates.returnDate}
              onChange={(e) => {
                const returnDate = e.target.value;
                const departureDate = formData.travelDates.departureDate;
                const nights = calculateNights(departureDate, returnDate);
                setFormData(prev => ({
                  ...prev,
                  travelDates: { ...prev.travelDates, returnDate },
                  numberOfNights: nights
                }));
              }}
            />
            <FormInput
              label="Number of Passengers"
              type="number"
              min="1"
              value={formData.numberOfPax}
              onChange={(e) => setFormData(prev => ({ ...prev, numberOfPax: Number(e.target.value) }))}
            />
            <FormInput
              label="Number of Nights"
              type="number"
              value={formData.numberOfNights}
              readOnly
              className="bg-gray-50"
            />
          </div>
        </div>

        {/* Description */}
        <FormTextarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
        />

        {/* Itinerary Section */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Day-wise Itinerary</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Number of Days:</label>
              <select
                value={numberOfDays}
                onChange={(e) => setNumberOfDays(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(day => (
                  <option key={day} value={day}>{day} Day{day > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: numberOfDays }, (_, index) => {
              const day = index + 1;
              return (
                <FormTextarea
                  key={day}
                  label={`Day ${day}`}
                  value={formData.itinerary[`day${day}` as keyof typeof formData.itinerary] || ''}
                  onChange={(e) => updateItinerary(`day${day}`, e.target.value)}
                  rows={2}
                  placeholder={`Enter itinerary for day ${day}...`}
                />
              );
            })}
          </div>
        </div>

        {/* Quotation Section */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-4">Quotation Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Flights (₹)"
              type="number"
              value={formData.quotation.flights}
              onChange={(e) => updateQuotation('flights', Number(e.target.value))}
            />
            <FormInput
              label="Hotels (₹)"
              type="number"
              value={formData.quotation.hotels}
              onChange={(e) => updateQuotation('hotels', Number(e.target.value))}
            />
            <FormInput
              label="Excursions (₹)"
              type="number"
              value={formData.quotation.excursions}
              onChange={(e) => updateQuotation('excursions', Number(e.target.value))}
            />
            <FormInput
              label="Transfers (₹)"
              type="number"
              value={formData.quotation.transfers}
              onChange={(e) => updateQuotation('transfers', Number(e.target.value))}
            />
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <div className="text-sm text-gray-600">Total Quotation:</div>
            <div className="text-xl font-bold text-green-600">
              ₹{(formData.quotation.flights + formData.quotation.hotels + formData.quotation.excursions + formData.quotation.transfers).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Notes */}
        <FormTextarea
          label="Notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
        />

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 flex items-center gap-2"
          >
            {isSubmitting ? <Spinner size="sm" /> : null}
            Add Lead
          </button>
        </div>
      </form>
    </Modal>
  );
};

const EditLeadModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (lead: Lead) => void; lead: Lead | null }> = ({ isOpen, onClose, onSave, lead }) => {
  const [formData, setFormData] = useState<Lead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [numberOfDays, setNumberOfDays] = useState(5);

  // Helper function to calculate number of nights
  const calculateNights = (departureDate: string, returnDate: string): number => {
    if (!departureDate || !returnDate) return 0;
    const departure = new Date(departureDate);
    const returnDateObj = new Date(returnDate);
    const diffTime = returnDateObj.getTime() - departure.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  useEffect(() => {
    if (lead) {
      setFormData(lead);
    }
  }, [lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    
    setIsSubmitting(true);
    
    // Calculate total quotation
    const total = formData.quotation.flights + formData.quotation.hotels + formData.quotation.excursions + formData.quotation.transfers;
    const updatedFormData = { ...formData, quotation: { ...formData.quotation, total } };
    
    await onSave(updatedFormData);
    setIsSubmitting(false);
    onClose();
  };

  const updateItinerary = (day: string, value: string) => {
    if (!formData) return;
    setFormData(prev => prev ? ({
      ...prev,
      itinerary: { ...prev.itinerary, [day]: value }
    }) : null);
  };

  const updateQuotation = (field: keyof typeof formData!.quotation, value: number) => {
    if (!formData) return;
    setFormData(prev => prev ? ({
      ...prev,
      quotation: { ...prev.quotation, [field]: value }
    }) : null);
  };

  if (!formData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Lead" width="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
        {/* Customer Details Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Customer Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <FormInput
               label="Name"
               value={formData.name}
               onChange={(e) => setFormData(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
             />
             <FormInput
               label="Email"
               type="email"
               value={formData.email}
               onChange={(e) => setFormData(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
             />
             <FormInput
               label="Phone"
               value={formData.phone}
               onChange={(e) => setFormData(prev => prev ? ({ ...prev, phone: e.target.value }) : null)}
             />
            <FormInput
              label="Company"
              value={formData.company}
              onChange={(e) => setFormData(prev => prev ? ({ ...prev, company: e.target.value }) : null)}
            />
            <FormInput
              label="Source"
              value={formData.source}
              onChange={(e) => setFormData(prev => prev ? ({ ...prev, source: e.target.value }) : null)}
            />
            <FormSelect
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData(prev => prev ? ({ ...prev, status: e.target.value as LeadStatus }) : null)}
            >
              <option value={LeadStatus.Cold}>Cold</option>
              <option value={LeadStatus.Warm}>Warm</option>
              <option value={LeadStatus.Final}>Final</option>
            </FormSelect>
                         <FormSelect
               label="Assigned To"
               value={formData.assignedTo}
               onChange={(e) => setFormData(prev => prev ? ({ ...prev, assignedTo: e.target.value }) : null)}
             >
               <option value="">Select Assignee</option>
               <option value="Atul">Atul</option>
               <option value="Ravi">Ravi</option>
             </FormSelect>
            <FormInput
              label="Expected Value (₹)"
              type="number"
              value={formData.expectedValue}
              onChange={(e) => setFormData(prev => prev ? ({ ...prev, expectedValue: Number(e.target.value) }) : null)}
            />
          </div>
        </div>

        {/* Travel Details Section */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-blue-800">Travel Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInput
              label="Departure Date"
              type="date"
              value={formData.travelDates.departureDate}
              onChange={(e) => {
                const departureDate = e.target.value;
                const returnDate = formData.travelDates.returnDate;
                const nights = calculateNights(departureDate, returnDate);
                setFormData(prev => prev ? ({
                  ...prev,
                  travelDates: { ...prev.travelDates, departureDate },
                  numberOfNights: nights
                }) : null);
              }}
            />
            <FormInput
              label="Return Date"
              type="date"
              value={formData.travelDates.returnDate}
              onChange={(e) => {
                const returnDate = e.target.value;
                const departureDate = formData.travelDates.departureDate;
                const nights = calculateNights(departureDate, returnDate);
                setFormData(prev => prev ? ({
                  ...prev,
                  travelDates: { ...prev.travelDates, returnDate },
                  numberOfNights: nights
                }) : null);
              }}
            />
            <FormInput
              label="Number of Passengers"
              type="number"
              min="1"
              value={formData.numberOfPax}
              onChange={(e) => setFormData(prev => prev ? ({ ...prev, numberOfPax: Number(e.target.value) }) : null)}
            />
            <FormInput
              label="Number of Nights"
              type="number"
              value={formData.numberOfNights}
              readOnly
              className="bg-gray-50"
            />
          </div>
        </div>

        {/* Description */}
        <FormTextarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
          rows={3}
        />

        {/* Itinerary Section */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Day-wise Itinerary</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Number of Days:</label>
              <select
                value={numberOfDays}
                onChange={(e) => setNumberOfDays(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(day => (
                  <option key={day} value={day}>{day} Day{day > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: numberOfDays }, (_, index) => {
              const day = index + 1;
              return (
                <FormTextarea
                  key={day}
                  label={`Day ${day}`}
                  value={formData.itinerary[`day${day}` as keyof typeof formData.itinerary] || ''}
                  onChange={(e) => updateItinerary(`day${day}`, e.target.value)}
                  rows={2}
                  placeholder={`Enter itinerary for day ${day}...`}
                />
              );
            })}
          </div>
        </div>

        {/* Quotation Section */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-4">Quotation Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Flights (₹)"
              type="number"
              value={formData.quotation.flights}
              onChange={(e) => updateQuotation('flights', Number(e.target.value))}
            />
            <FormInput
              label="Hotels (₹)"
              type="number"
              value={formData.quotation.hotels}
              onChange={(e) => updateQuotation('hotels', Number(e.target.value))}
            />
            <FormInput
              label="Excursions (₹)"
              type="number"
              value={formData.quotation.excursions}
              onChange={(e) => updateQuotation('excursions', Number(e.target.value))}
            />
            <FormInput
              label="Transfers (₹)"
              type="number"
              value={formData.quotation.transfers}
              onChange={(e) => updateQuotation('transfers', Number(e.target.value))}
            />
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <div className="text-sm text-gray-600">Total Quotation:</div>
            <div className="text-xl font-bold text-green-600">
              ₹{(formData.quotation.flights + formData.quotation.hotels + formData.quotation.excursions + formData.quotation.transfers).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Notes */}
        <FormTextarea
          label="Notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
          rows={3}
        />

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 flex items-center gap-2"
          >
            {isSubmitting ? <Spinner size="sm" /> : null}
            Update Lead
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const LeadsPipeline: React.FC<LeadsPipelineProps> = ({ onConvertToDocket }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus | 'all'>('all');
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load leads from database
  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await leadService.getAllLeads();
      setLeads(data);
    } catch (err) {
      console.error('Error loading leads:', err);
      setError('Failed to load leads. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLead = async (newLead: Omit<Lead, 'id'>) => {
    try {
      const createdLead = await leadService.createLead(newLead);
      setLeads(prev => [createdLead, ...prev]);
    } catch (err) {
      console.error('Error creating lead:', err);
      alert('Failed to create lead. Please try again.');
    }
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setEditModalOpen(true);
  };

  const handleUpdateLead = async (updatedLead: Lead) => {
    try {
      const updated = await leadService.updateLead(updatedLead);
      setLeads(prev => prev.map(lead => lead.id === updated.id ? updated : lead));
    } catch (err) {
      console.error('Error updating lead:', err);
      alert('Failed to update lead. Please try again.');
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        await leadService.deleteLead(id);
        setLeads(prev => prev.filter(lead => lead.id !== id));
      } catch (err) {
        console.error('Error deleting lead:', err);
        alert('Failed to delete lead. Please try again.');
      }
    }
  };

  const filteredLeads = useMemo(() => {
    let filtered = leads;

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(lead => lead.status === selectedStatus);
    }

    // Filter by assigned to
    if (selectedAssignedTo !== 'all') {
      filtered = filtered.filter(lead => lead.assignedTo === selectedAssignedTo);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(lead => {
        // Search in name
        if (lead.name && lead.name.toLowerCase().includes(lowercasedSearch)) return true;
        
        // Search in email
        if (lead.email && lead.email.toLowerCase().includes(lowercasedSearch)) return true;
        
        // Search in phone
        if (lead.phone && lead.phone.toLowerCase().includes(lowercasedSearch)) return true;
        
        // Search in company
        if (lead.company && lead.company.toLowerCase().includes(lowercasedSearch)) return true;
        
        // Search in source
        if (lead.source && lead.source.toLowerCase().includes(lowercasedSearch)) return true;
        
        // Search in assignedTo
        if (lead.assignedTo && lead.assignedTo.toLowerCase().includes(lowercasedSearch)) return true;
        
        // Search in description
        if (lead.description && lead.description.toLowerCase().includes(lowercasedSearch)) return true;
        
        // Search in notes
        if (lead.notes && lead.notes.toLowerCase().includes(lowercasedSearch)) return true;
        
        // Search in itinerary (day-wise)
        for (let i = 1; i <= 10; i++) {
          const dayKey = `day${i}` as keyof typeof lead.itinerary;
          if (lead.itinerary[dayKey] && lead.itinerary[dayKey]!.toLowerCase().includes(lowercasedSearch)) return true;
        }
        
        return false;
      });
    }

    return filtered;
  }, [leads, selectedStatus, selectedAssignedTo, searchTerm]);

  const getStatusCount = (status: LeadStatus) => {
    return leads.filter(lead => lead.status === status).length;
  };

  const getAssignedToCount = (assignedTo: string) => {
    return leads.filter(lead => lead.assignedTo === assignedTo).length;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leads Pipeline</h1>
        <div className="flex items-center gap-3">
          {loading && <Spinner size="sm" />}
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
          >
            {Icons.plus} Add New Lead
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <span className="text-red-800">{error}</span>
            <button
              onClick={loadLeads}
              className="ml-auto text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

             {/* Status Filter and Search */}
       <div className="mb-6">
         <div className="flex flex-wrap items-center gap-4">
           <div className="flex gap-4">
             <button
               onClick={() => setSelectedStatus('all')}
               className={`px-4 py-2 rounded-md font-medium ${
                 selectedStatus === 'all' 
                   ? 'bg-blue-500 text-white' 
                   : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
               }`}
             >
               All ({leads.length})
             </button>
             <button
               onClick={() => setSelectedStatus(LeadStatus.Cold)}
               className={`px-4 py-2 rounded-md font-medium ${
                 selectedStatus === LeadStatus.Cold 
                   ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' 
                   : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
               }`}
             >
               ❄️ Cold ({getStatusCount(LeadStatus.Cold)})
             </button>
             <button
               onClick={() => setSelectedStatus(LeadStatus.Warm)}
               className={`px-4 py-2 rounded-md font-medium ${
                 selectedStatus === LeadStatus.Warm 
                   ? 'bg-orange-100 text-orange-800 border-2 border-orange-300' 
                   : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
               }`}
             >
               🔥 Warm ({getStatusCount(LeadStatus.Warm)})
             </button>
             <button
               onClick={() => setSelectedStatus(LeadStatus.Final)}
               className={`px-4 py-2 rounded-md font-medium ${
                 selectedStatus === LeadStatus.Final 
                   ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                   : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
               }`}
             >
               ✅ Final ({getStatusCount(LeadStatus.Final)})
             </button>
           </div>
           
           {/* Assigned To Filter */}
           <div className="flex gap-2">
             <button
               onClick={() => setSelectedAssignedTo('all')}
               className={`px-4 py-2 rounded-md font-medium ${
                 selectedAssignedTo === 'all' 
                   ? 'bg-purple-500 text-white' 
                   : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
               }`}
             >
               All Assignees
             </button>
             <button
               onClick={() => setSelectedAssignedTo('Atul')}
               className={`px-4 py-2 rounded-md font-medium ${
                 selectedAssignedTo === 'Atul' 
                   ? 'bg-purple-100 text-purple-800 border-2 border-purple-300' 
                   : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
               }`}
             >
               👤 Atul ({getAssignedToCount('Atul')})
             </button>
             <button
               onClick={() => setSelectedAssignedTo('Ravi')}
               className={`px-4 py-2 rounded-md font-medium ${
                 selectedAssignedTo === 'Ravi' 
                   ? 'bg-purple-100 text-purple-800 border-2 border-purple-300' 
                   : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
               }`}
             >
               👤 Ravi ({getAssignedToCount('Ravi')})
             </button>
           </div>
           
           {/* Search Box */}
           <div className="flex-1 max-w-md">
             <div className="relative">
               <input
                 type="text"
                 placeholder="Search by name, email, phone, company, destination..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
               />
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
               </div>
               {searchTerm && (
                 <button
                   onClick={() => setSearchTerm('')}
                   className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                 >
                   <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>
               )}
             </div>
           </div>
         </div>
         
         {/* Search Results Info */}
         {(searchTerm || selectedAssignedTo !== 'all') && (
           <div className="mt-2 text-sm text-gray-600">
             {searchTerm && selectedAssignedTo !== 'all' ? (
               `Showing ${filteredLeads.length} of ${leads.length} leads matching "${searchTerm}" assigned to ${selectedAssignedTo}`
             ) : searchTerm ? (
               `Showing ${filteredLeads.length} of ${leads.length} leads matching "${searchTerm}"`
             ) : (
               `Showing ${filteredLeads.length} of ${leads.length} leads assigned to ${selectedAssignedTo}`
             )}
           </div>
         )}
       </div>

      {/* Leads Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading leads...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeads.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onEdit={handleEditLead}
                onDelete={handleDeleteLead}
              />
            ))}
          </div>

          {filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
              <p className="text-gray-500">Get started by adding your first lead.</p>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AddLeadModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddLead}
      />

      <EditLeadModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingLead(null);
        }}
        onSave={handleUpdateLead}
        lead={editingLead}
      />
    </div>
  );
};
