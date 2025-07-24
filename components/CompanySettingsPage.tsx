
import React, { useState, useEffect } from 'react';
import { useCompanySettings } from '../hooks';
import { CompanySettings } from '../types';
import { FormInput, FormTextarea } from './common';

export const CompanySettingsPage: React.FC = () => {
    const { settings, updateSettings } = useCompanySettings();
    const [localSettings, setLocalSettings] = useState<CompanySettings>(settings);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (field: keyof CompanySettings, value: string) => {
        setLocalSettings(prev => ({...prev, [field]: value}));
    };
    
    const handleSave = () => {
        updateSettings(localSettings);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 mb-6">Company Settings</h1>
                {showSuccess && (
                     <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
                        <p className="font-bold">Success</p>
                        <p>Settings saved successfully.</p>
                    </div>
                )}
                <div className="bg-white p-6 rounded-lg shadow-md space-y-8">
                    
                    <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4 border-b pb-2">Company Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormInput label="Company Name" value={localSettings.companyName} onChange={e => handleChange('companyName', e.target.value)} />
                            <FormInput label="Company Contact (Phone/Email)" value={localSettings.companyContact} onChange={e => handleChange('companyContact', e.target.value)} />
                            <FormTextarea containerClassName="md:col-span-2" label="Company Address" value={localSettings.companyAddress} onChange={e => handleChange('companyAddress', e.target.value)} rows={3} />
                        </div>
                    </div>
                    
                    <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4 border-b pb-2">Financial & Tax Details</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormInput label="Agency GSTIN" value={localSettings.gstNumber || ''} onChange={e => handleChange('gstNumber', e.target.value)} />
                            <FormInput label="Company State (for GST)" value={localSettings.companyState || ''} onChange={e => handleChange('companyState', e.target.value)} placeholder="e.g., Delhi" />
                            <FormInput label="Bank Name" value={localSettings.bankName} onChange={e => handleChange('bankName', e.target.value)} />
                            <FormInput label="Bank Account Number" value={localSettings.accountNumber} onChange={e => handleChange('accountNumber', e.target.value)} />
                            <FormInput label="IFSC Code" value={localSettings.ifscCode} onChange={e => handleChange('ifscCode', e.target.value)} />
                         </div>
                    </div>
                    
                    <div className="pt-6 border-t flex justify-end">
                        <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">
                            Save Settings
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
