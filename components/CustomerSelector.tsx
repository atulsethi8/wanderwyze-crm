import React, { useState, useEffect } from 'react';
import { Customer, Passenger, BilledTo } from '../types';
import { Icons, Modal, FormInput, FormTextarea, Spinner } from './common';

interface CustomerSelectorProps {
  passengers: Passenger[];
  customers: Customer[];
  onSelectCustomer: (billedTo: BilledTo) => void;
  onAddCustomer: (customer: Omit<Customer, 'customer_id' | 'created_at'>) => Promise<string>;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  passengers,
  customers,
  onSelectCustomer,
  onAddCustomer
}) => {
  const [activeTab, setActiveTab] = useState<'passengers' | 'customers' | 'new'>('passengers');
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    address: '',
    gst_number: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);

  const filteredPassengers = passengers.filter(passenger =>
    passenger.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    passenger.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    passenger.phone?.includes(searchTerm)
  );

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm) ||
    customer.gst_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePassengerSelect = (passenger: Passenger) => {
    const billedTo: BilledTo = {
      name: passenger.fullName,
      address: passenger.address,
      email: passenger.email,
      phone: passenger.phone,
      gstin: passenger.gstin
    };
    onSelectCustomer(billedTo);
  };

  const handleCustomerSelect = (customer: Customer) => {
    const billedTo: BilledTo = {
      name: customer.name,
      address: customer.address,
      email: customer.email,
      phone: customer.phone,
      gstin: customer.gst_number
    };
    onSelectCustomer(billedTo);
  };

  const handleAddNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerData.name.trim()) {
      alert('Customer name is required');
      return;
    }

    setLoading(true);
    try {
      const customerId = await onAddCustomer(newCustomerData);
      
      // Create the new customer object
      const newCustomer: Customer = {
        customer_id: customerId,
        name: newCustomerData.name,
        address: newCustomerData.address,
        gst_number: newCustomerData.gst_number,
        email: newCustomerData.email,
        phone: newCustomerData.phone,
        created_at: new Date().toISOString()
      };

      // Select the newly created customer
      handleCustomerSelect(newCustomer);
      setIsNewCustomerModalOpen(false);
      setNewCustomerData({
        name: '',
        address: '',
        gst_number: '',
        email: '',
        phone: ''
      });
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('passengers')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'passengers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Passengers ({passengers.length})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'customers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Customers ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'new'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Add New Customer
          </button>
        </nav>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder={`Search ${activeTab === 'passengers' ? 'passengers' : 'customers'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {Icons.search}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'passengers' && (
          <div className="p-4">
            {filteredPassengers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No passengers found' : 'No passengers in this docket'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPassengers.map((passenger) => (
                  <button
                    key={passenger.id}
                    onClick={() => handlePassengerSelect(passenger)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{passenger.fullName}</div>
                    <div className="text-sm text-gray-500">
                      {passenger.email && (
                        <div className="flex items-center mt-1">
                          {Icons.mail}
                          <span className="ml-1">{passenger.email}</span>
                        </div>
                      )}
                      {passenger.phone && (
                        <div className="flex items-center mt-1">
                          {Icons.phone}
                          <span className="ml-1">{passenger.phone}</span>
                        </div>
                      )}
                      {passenger.gstin && (
                        <div className="flex items-center mt-1">
                          {Icons.document}
                          <span className="ml-1">GST: {passenger.gstin}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="p-4">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No customers found' : 'No customers in database'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.customer_id}
                    onClick={() => handleCustomerSelect(customer)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-sm text-gray-500">
                      {customer.email && (
                        <div className="flex items-center mt-1">
                          {Icons.mail}
                          <span className="ml-1">{customer.email}</span>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center mt-1">
                          {Icons.phone}
                          <span className="ml-1">{customer.phone}</span>
                        </div>
                      )}
                      {customer.gst_number && (
                        <div className="flex items-center mt-1">
                          {Icons.document}
                          <span className="ml-1">GST: {customer.gst_number}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="p-4">
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                {Icons.userPlus}
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Add New Customer
              </h3>
              <p className="text-gray-500 mb-4">
                Create a new customer and automatically select them for this invoice
              </p>
              <button
                onClick={() => setIsNewCustomerModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {Icons.plus}
                <span className="ml-2">Add New Customer</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Customer Modal */}
      <Modal 
        isOpen={isNewCustomerModalOpen} 
        onClose={() => setIsNewCustomerModalOpen(false)} 
        title="Add New Customer"
      >
        <form onSubmit={handleAddNewCustomer} className="space-y-4">
          <FormInput
            label="Customer Name *"
            value={newCustomerData.name}
            onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
            required
          />
          
          <FormInput
            label="Email"
            type="email"
            value={newCustomerData.email}
            onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
          />
          
          <FormInput
            label="Phone"
            value={newCustomerData.phone}
            onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
          />
          
          <FormInput
            label="GST Number"
            value={newCustomerData.gst_number}
            onChange={(e) => setNewCustomerData({ ...newCustomerData, gst_number: e.target.value })}
          />
          
          <FormTextarea
            label="Address"
            value={newCustomerData.address}
            onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
            rows={3}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setIsNewCustomerModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading && <Spinner size="sm" className="mr-2" />}
              Add Customer & Select
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};