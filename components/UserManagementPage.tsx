
import React from 'react';
import { AuthUser } from '../types';
import { FormSelect } from './common';

interface UserManagementPageProps {
  users: AuthUser[];
  updateUserRole: (userId: string, role: 'admin' | 'user') => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ users, updateUserRole }) => {

    const handleRoleChange = (userId: string, newRole: 'admin' | 'user') => {
        updateUserRole(userId, newRole);
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 mb-6">User Management</h1>
                
                <div className="bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-slate-700 p-6">System Users</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">User Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{user.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <FormSelect 
                                                label=""
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'user')}
                                                className="w-32"
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                            </FormSelect>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-center py-10 text-slate-500">No users found.</td>
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