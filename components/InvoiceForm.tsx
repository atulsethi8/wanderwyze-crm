import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services';
import { Customer } from '../types';
import { FormInput, FormTextarea, FormSelect, Modal, Spinner, Icons } from './common';

export const InvoiceForm: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Omit<Customer, 'customer_id' | 'created_at'>>({
    name: '',
    address: '',
    gst_number: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabaseService.listCustomers();
        if (error) throw new Error(error);
        setCustomers(data || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAdd = async () => {
    if (!newCustomer.name || !newCustomer.address) {
      setError('Name and Address are required to add a customer.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const { data, error } = await supabaseService.addCustomer(newCustomer);
      if (error || !data) throw new Error(error || 'Failed to add customer');
      setCustomers(prev => [data, ...prev]);
      setSelectedCustomerId(data.customer_id);
      setAddOpen(false);
      setNewCustomer({ name: '', address: '', gst_number: '', email: '', phone: '' });
    } catch (e: any) {
      setError(e?.message || 'Failed to add customer');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen var-bg text-fg p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Invoice Form</h1>
          <button onClick={() => setAddOpen(true)} className="text-sm font-semibold text-brand-primary">{Icons.plus} Add New Customer</button>
        </div>

        {loading && (
          <div className="flex items-center gap-3 p-4 bg-white rounded-md shadow border">
            <Spinner />
            <span className="text-slate-700 font-medium">Loading...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <FormSelect label="Select Existing Customer" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
              <option value="">-- Choose a Customer --</option>
              {customers.map(c => (
                <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
              ))}
            </FormSelect>

            {selectedCustomerId && (
              <div className="p-4 bg-slate-50 rounded-md border">
                {(() => {
                  const c = customers.find(x => x.customer_id === selectedCustomerId);
                  if (!c) return null;
                  return (
                    <div className="text-sm text-slate-700 space-y-1">
                      <p><span className="font-semibold">Name:</span> {c.name}</p>
                      <p><span className="font-semibold">Address:</span> {c.address}</p>
                      {c.gst_number && <p><span className="font-semibold">GSTIN:</span> {c.gst_number}</p>}
                      {c.email && <p><span className="font-semibold">Email:</span> {c.email}</p>}
                      {c.phone && <p><span className="font-semibold">Phone:</span> {c.phone}</p>}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="text-right">
              <button className="bg-brand-primary text-white px-4 py-2 rounded-md text-sm font-semibold">Continue</button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add New Customer">
        <div className="space-y-4">
          <FormInput label="Customer Name*" value={newCustomer.name} onChange={e => setNewCustomer(prev => ({...prev, name: e.target.value}))} />
          <FormTextarea label="Address*" value={newCustomer.address} onChange={e => setNewCustomer(prev => ({...prev, address: e.target.value}))} rows={3} />
          <FormInput label="GST Number" value={newCustomer.gst_number} onChange={e => setNewCustomer(prev => ({...prev, gst_number: e.target.value}))} />
          <FormInput label="Email" value={newCustomer.email || ''} onChange={e => setNewCustomer(prev => ({...prev, email: e.target.value}))} />
          <FormInput label="Phone" value={newCustomer.phone || ''} onChange={e => setNewCustomer(prev => ({...prev, phone: e.target.value}))} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
            <button onClick={handleAdd} disabled={adding} className="px-4 py-2 bg-brand-primary text-white rounded-md disabled:opacity-70">{adding ? 'Saving...' : 'Save Customer'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};