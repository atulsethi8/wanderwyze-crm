import React, { useState } from 'react';
import { useAuth } from '../hooks';
import { Spinner, Icons, FormInput } from './common';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    }
  };
  
  if (showPasswordReset) {
      return <PasswordResetPage onBack={() => setShowPasswordReset(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
            <div className="inline-block bg-brand-primary text-white rounded-full p-3 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <h1 className="text-3xl font-bold text-slate-800">WanderWyze Docket</h1>
            <p className="text-slate-500 mt-2">Sign in to manage your travel bookings.</p>
        </div>
        
        <form onSubmit={handleLogin}>
          <div className="space-y-4">
            <FormInput
              label=""
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (e.g., admin@wanderwyze.com)"
              required
            />
            <FormInput
              label=""
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (e.g., password)"
              required
              icon={
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-500 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                    {showPassword ? Icons.eyeSlash : Icons.eye}
                </button>
              }
            />
          </div>
          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition duration-300 disabled:bg-slate-400 flex justify-center items-center"
            >
              {loading ? <Spinner size="sm" /> : 'Sign In'}
            </button>
          </div>
        </form>
         <div className="text-center mt-6">
          <button onClick={() => setShowPasswordReset(true)} className="text-sm text-brand-primary hover:underline">
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
};

export const PasswordResetPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { sendPasswordReset, updatePassword, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [view, setView] = useState<'send_link' | 'update_password'>('send_link');
    const [showPasswords, setShowPasswords] = useState(false);
    
    // Check URL for Supabase password recovery token
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const isRecovery = hashParams.get('type') === 'recovery';

    const handleSendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            await sendPasswordReset(email);
            setMessage('Password reset instructions sent. Please check your email.');
            // No automatic view switch here, user must click the link in their email
        } catch (err: any) {
            setError(err.message || "Failed to send reset link.");
        }
    };
    
    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        setError('');
        setMessage('');
        try {
            await updatePassword(password);
            setMessage("Password updated successfully! You can now log in.");
        } catch (err: any) {
            setError(err.message || "Failed to update password.");
        }
    };
    
    if (isRecovery) {
      return (
          <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                  <h2 className="text-2xl font-bold text-center mb-6">Update Your Password</h2>
                  <form onSubmit={handleUpdatePassword}>
                      <div className="space-y-4">
                          <FormInput label="" type={showPasswords ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="New Password" required 
                            icon={
                                <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="text-slate-500 hover:text-slate-700" aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}>
                                  {showPasswords ? Icons.eyeSlash : Icons.eye}
                                </button>
                            }
                          />
                          <FormInput label="" type={showPasswords ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm New Password" required
                            icon={
                                <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="text-slate-500 hover:text-slate-700" aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}>
                                  {showPasswords ? Icons.eyeSlash : Icons.eye}
                                </button>
                            }
                           />
                      </div>
                      {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
                      {message && <p className="text-green-600 text-sm mt-4">{message}</p>}
                      <button type="submit" disabled={loading} className="w-full mt-6 bg-brand-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-400 flex justify-center">{loading ? <Spinner size="sm"/> : 'Update Password'}</button>
                  </form>
                  {onBack && <button onClick={onBack} className="text-sm text-brand-primary hover:underline mt-4">Back to Login</button>}
              </div>
          </div>
      );
    }
    
    return (
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-center mb-6">Reset Password</h2>
            <p className="text-slate-500 text-center mb-4">Enter your email to receive a password reset link.</p>
            <form onSubmit={handleSendLink}>
                <FormInput label="" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your Email" required />
                {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
                {message && <p className="text-green-600 text-sm mt-4">{message}</p>}
                <button type="submit" disabled={loading} className="w-full mt-6 bg-brand-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-400 flex justify-center">{loading ? <Spinner size="sm"/> : 'Send Reset Link'}</button>
            </form>
            {onBack && <button onClick={onBack} className="text-sm text-brand-primary hover:underline mt-4">Back to Login</button>}
        </div>
    );
};

export const UserProfilePage: React.FC = () => {
    const { currentUser } = useAuth();

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
                <h1 className="text-2xl font-bold text-slate-800 mb-6">My Profile</h1>
                <div className="space-y-6">
                    <div>
                        <p className="text-sm font-medium text-slate-500">Full Name</p>
                        <p className="text-lg text-slate-800">{currentUser?.name}</p>
                    </div>
                     <div>
                        <p className="text-sm font-medium text-slate-500">Email Address</p>
                        <p className="text-lg text-slate-800">{currentUser?.email}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Current Role</p>
                        <p>
                          <span className="capitalize bg-blue-100 text-blue-800 text-base font-medium mr-2 px-3 py-1 rounded-full">
                            {currentUser?.role}
                          </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};