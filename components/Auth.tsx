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
    // Navy ground with the card floated on it - the sign-in screen sets the tone for the
    // rest of the app, so it carries the same chrome colour as the sidebar.
    <div className="min-h-screen bg-nav flex flex-col justify-center items-center p-4">
      <div className="max-w-[400px] w-full">
        <div className="flex items-center justify-center gap-2.5 mb-6">
            <span className="bg-brand text-white font-bold text-sm rounded-lg w-9 h-9 flex items-center justify-center">WD</span>
            <span className="text-lg font-semibold text-white tracking-tight">WanderWyze Docket</span>
        </div>
        <div className="bg-surface rounded-xl shadow-overlay border border-line p-7">
        <div className="mb-6">
            <h1 className="text-xl font-semibold text-ink tracking-tight">Sign in</h1>
            <p className="text-sm text-ink-muted mt-1">Manage your travel bookings and dockets.</p>
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
                    className="text-ink-subtle hover:text-ink"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                    {showPassword ? Icons.eyeSlash : Icons.eye}
                </button>
              }
            />
          </div>
          {error && (
            <p className="mt-4 text-sm text-danger bg-danger-subtle border border-danger-line rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-60 flex justify-center items-center shadow-card"
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
                      {error && (
            <p className="mt-4 text-sm text-danger bg-danger-subtle border border-danger-line rounded-lg px-3 py-2">
              {error}
            </p>
          )}
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
                {error && (
            <p className="mt-4 text-sm text-danger bg-danger-subtle border border-danger-line rounded-lg px-3 py-2">
              {error}
            </p>
          )}
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