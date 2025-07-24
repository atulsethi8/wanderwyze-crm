
import React, { useState } from 'react';
import { Agent } from '../types';
import { FormInput } from './common';

interface AgentManagementPageProps {
  agents: Agent[];
  saveAgent: (agent: Omit<Agent, 'id'>) => void;
}

export const AgentManagementPage: React.FC<AgentManagementPageProps> = ({ agents, saveAgent }) => {
    const [newAgent, setNewAgent] = useState({ name: '', contactInfo: '' });
    const [showSuccess, setShowSuccess] = useState(false);

    const handleInputChange = (field: keyof typeof newAgent, value: string) => {
        setNewAgent(prev => ({...prev, [field]: value}));
    };

    const handleSave = () => {
        if (newAgent.name && newAgent.contactInfo) {
            saveAgent(newAgent);
            setNewAgent({ name: '', contactInfo: '' });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } else {
            alert('Please fill out all fields.');
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 mb-6">Manage Agents</h1>
                 {showSuccess && (
                     <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
                        <p className="font-bold">Success</p>
                        <p>New agent added successfully.</p>
                    </div>
                )}
                
                {/* Add Agent Form */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Add New Agent</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <FormInput 
                            label="Agent Name" 
                            value={newAgent.name} 
                            onChange={e => handleInputChange('name', e.target.value)}
                            placeholder="e.g., John Doe"
                        />
                        <FormInput 
                            label="Contact Info (Email/Phone)" 
                            value={newAgent.contactInfo} 
                            onChange={e => handleInputChange('contactInfo', e.target.value)}
                            placeholder="e.g., john.doe@example.com"
                        />
                        <button 
                            onClick={handleSave} 
                            className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 h-10"
                        >
                            Save Agent
                        </button>
                    </div>
                </div>

                {/* Agents List */}
                <div className="bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-slate-700 p-6">Existing Agents</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Agent Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contact Info</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Agent ID</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {agents.length > 0 ? agents.map(agent => (
                                    <tr key={agent.id}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{agent.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">{agent.contactInfo}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-500">{agent.id}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="text-center py-10 text-slate-500">No agents found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
