import React, { useState, useEffect } from 'react';
import { invoiceService, customerService } from '../services/customerService';
import { Invoice, InvoiceFormData, Customer, CustomerFormData } from '../types/customer';

const InvoiceManagementPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<CustomerFormData>({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [formData, setFormData] = useState<InvoiceFormData>({
    customer_id: '',
    billing_address: '',
    amount: 0
  });

  // Load invoices and customers on component mount
  useEffect(() => {
    loadInvoices();
    loadCustomers();
  }, []);

  // Search customers when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchCustomers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    
    const response = await invoiceService.getAllInvoices();
    
    if (response.error) {
      setError(response.error);
    } else {
      setInvoices(response.data || []);
    }
    
    setLoading(false);
  };

  const loadCustomers = async () => {
    const response = await customerService.getAllCustomers();
    if (!response.error) {
      setCustomers(response.data || []);
    }
  };

  const searchCustomers = async () => {
    const response = await customerService.searchCustomers(searchQuery);
    if (!response.error) {
      setSearchResults(response.data || []);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value
    }));
  };

  const handleNewCustomerInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCustomerData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customer_id: customer.id,
      billing_address: customer.address || ''
    }));
    setSearchQuery(customer.name);
    setSearchResults([]);
    setShowNewCustomerForm(false);
  };

  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCustomerData.name.trim()) {
      setError('Customer name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await customerService.createCustomer(newCustomerData);
      
      if (response.error) {
        setError(response.error);
      } else {
        // Auto-select the newly created customer
        const newCustomer = response.data;
        if (newCustomer) {
          setSelectedCustomer(newCustomer);
          setFormData(prev => ({
            ...prev,
            customer_id: newCustomer.id,
            billing_address: newCustomer.address || ''
          }));
          setSearchQuery(newCustomer.name);
          
          // Refresh customers list
          await loadCustomers();
          
          // Close new customer form
          setShowNewCustomerForm(false);
          setNewCustomerData({
            name: '',
            email: '',
            phone: '',
            address: ''
          });
          
          setError(null);
        }
      }
    } catch (err) {
      setError('Failed to create customer');
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      billing_address: '',
      amount: 0
    });
    setSelectedCustomer(null);
    setSearchQuery('');
    setSearchResults([]);
    setEditingInvoice(null);
    setShowAddForm(false);
    setShowNewCustomerForm(false);
    setNewCustomerData({
      name: '',
      email: '',
      phone: '',
      address: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_id) {
      setError('Please select a customer');
      return;
    }

    if (formData.amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response;
      
      if (editingInvoice) {
        response = await invoiceService.updateInvoice(editingInvoice.id, formData);
      } else {
        response = await invoiceService.createInvoice(formData);
      }
      
      if (response.error) {
        setError(response.error);
      } else {
        await loadInvoices();
        resetForm();
        setError(null);
      }
    } catch (err) {
      setError('Failed to save invoice');
    }
    
    setLoading(false);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      customer_id: invoice.customer_id,
      billing_address: invoice.billing_address || '',
      amount: invoice.amount
    });
    
    // Find and set the customer
    const customer = customers.find(c => c.id === invoice.customer_id);
    if (customer) {
      setSelectedCustomer(customer);
      setSearchQuery(customer.name);
    }
    
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await invoiceService.deleteInvoice(id);
      
      if (response.error) {
        setError(response.error);
      } else {
        await loadInvoices();
        setError(null);
      }
    } catch (err) {
      setError('Failed to delete invoice');
    }
    
    setLoading(false);
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : 'Unknown Customer';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Invoice Management</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Create New Invoice
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by customer name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {searchResults.map((customer) => (
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
              {searchQuery.trim() && searchResults.length === 0 && !selectedCustomer && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomerData(prev => ({ ...prev, name: searchQuery }));
                      setShowNewCustomerForm(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    + Create new customer "{searchQuery}"
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1 rounded text-sm"
                    >
                      {loading ? 'Creating...' : 'Create Customer'}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Address
                </label>
                <textarea
                  name="billing_address"
                  value={formData.billing_address}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Billing address (will default to customer address if empty)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg"
              >
                {loading ? 'Saving...' : (editingInvoice ? 'Update Invoice' : 'Create Invoice')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoices List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Invoices ({invoices.length})
          </h3>
        </div>
        
        {invoices.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No invoices found. Create your first invoice to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.customer ? (
                        <div>
                          <div className="font-medium">{invoice.customer.name}</div>
                          <div className="text-gray-500">{invoice.customer.customer_code}</div>
                        </div>
                      ) : (
                        getCustomerName(invoice.customer_id)
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${invoice.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(invoice)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceManagementPage;
