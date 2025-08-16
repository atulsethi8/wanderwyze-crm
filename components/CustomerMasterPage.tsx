import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services';
import { Customer } from '../types';
import { FormInput, FormTextarea, Modal, Spinner, Icons } from './common';

export const CustomerMasterPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabaseService.listCustomers();
    if (error) setError(error);
    setCustomers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startAdd = () => {
    setSelected({ customer_id: '', name: '', address: '', gst_number: '', email: '', phone: '', created_at: '' });
    setEditOpen(true);
  };

  const startEdit = (c: Customer) => {
    setSelected({ ...c });
    setEditOpen(true);
  };

  const save = async () => {
    if (!selected) return;
    setEditing(true);
    setError(null);
    try {
      if (selected.customer_id) {
        const { data, error } = await supabaseService.updateCustomer(selected.customer_id, {
          name: selected.name,
          address: selected.address,
          email: selected.email || null,
          phone: selected.phone || null,
          gst_number: selected.gst_number
        });
        if (error) throw new Error(error);
        setCustomers(prev => prev.map(x => x.customer_id === selected.customer_id ? (data as Customer) : x));
      } else {
        const { data, error } = await supabaseService.addCustomer({
          name: selected.name,
          address: selected.address,
          email: selected.email || '',
          phone: selected.phone || '',
          gst_number: selected.gst_number
        } as any);
        if (error || !data) throw new Error(error || 'Failed to add');
        setCustomers(prev => [data, ...prev]);
      }
      setEditOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setEditing(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabaseService.deleteCustomer(confirmDelete.customer_id);
    if (error) {
      setError(error);
    } else {
      setCustomers(prev => prev.filter(x => x.customer_id !== confirmDelete.customer_id));
      setConfirmDelete(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Customer Master</h1>
          <button onClick={startAdd} className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-hover">{Icons.plus} Add Customer</button>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 p-4 bg-white rounded-md shadow border">
            <Spinner />
            <span className="text-slate-700 font-medium">Loading...</span>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">GST</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {customers.map(c => (
                  <tr key={c.customer_id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{c.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">{c.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">{c.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">{c.gst_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button onClick={() => startEdit(c)} className="text-brand-primary hover:underline mr-4">Edit</button>
                      <button onClick={() => setConfirmDelete(c)} className="text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-500">No customers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={selected?.customer_id ? 'Edit Customer' : 'Add Customer'}>
        <div className="space-y-4">
          <FormInput label="Name*" value={selected?.name || ''} onChange={e => setSelected(prev => prev ? ({...prev, name: e.target.value}) : prev)} />
          <FormInput label="Email" value={selected?.email || ''} onChange={e => setSelected(prev => prev ? ({...prev, email: e.target.value}) : prev)} />
          <FormInput label="Phone" value={selected?.phone || ''} onChange={e => setSelected(prev => prev ? ({...prev, phone: e.target.value}) : prev)} />
          <FormTextarea label="Address*" value={selected?.address || ''} onChange={e => setSelected(prev => prev ? ({...prev, address: e.target.value}) : prev)} rows={3} />
          <FormInput label="GST Number" value={selected?.gst_number || ''} onChange={e => setSelected(prev => prev ? ({...prev, gst_number: e.target.value}) : prev)} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
            <button onClick={save} disabled={editing} className="px-4 py-2 bg-brand-primary text-white rounded-md disabled:opacity-70">{editing ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Confirm Delete">
        <p className="mb-4">Are you sure you want to delete customer “{confirmDelete?.name}”?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
          <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded-md">Delete</button>
        </div>
      </Modal>
    </div>
  );
};