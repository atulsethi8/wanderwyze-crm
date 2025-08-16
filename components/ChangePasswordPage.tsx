import React, { useState } from 'react';
import { useAuth } from '../hooks';
import { supabase } from '../services';
import { FormInput } from './common';

export const ChangePasswordPage: React.FC = () => {
    const { logout } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!newPassword || newPassword.length < 8) {
            setError('New password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Confirm password must match the new password.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                setError(error.message || 'Failed to update password.');
                return;
            }
            setSuccess('Password updated successfully. Please log in again.');
            setTimeout(() => {
                logout();
            }, 1500);
        } catch (err: any) {
            setError(err?.message || 'Failed to update password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="max-w-xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 mb-6">Change Password</h1>

                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}
                {success && (
                    <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
                        <p className="font-bold">Success</p>
                        <p>{success}</p>
                    </div>
                )}

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <FormInput
                            label="New Password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            required
                        />
                        <FormInput
                            label="Confirm New Password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            required
                        />

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`bg-brand-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};