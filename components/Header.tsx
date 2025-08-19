
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks';
import { AuthUser } from '../types';
import { Icons } from './common';

interface HeaderProps {
    onNewDocket: () => void;
    onNavigate: (view: string) => void;
    currentUser: AuthUser | null;
}

export const Header: React.FC<HeaderProps> = ({ onNewDocket, onNavigate, currentUser }) => {
    const { logout } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const adminRef = useRef<HTMLDivElement>(null);

    const handleClickOutside = (event: MouseEvent) => {
        if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
            setProfileOpen(false);
        }
        if (adminRef.current && !adminRef.current.contains(event.target as Node)) {
            setAdminOpen(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    return (
        <header className="var-bg/80 backdrop-blur-lg shadow-sm sticky top-0 z-40">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate('dashboard')}>
                            <span className="bg-brand-primary text-on-brand font-bold text-xl rounded-md w-9 h-9 flex items-center justify-center">WD</span>
                            <span className="text-xl font-bold text-fg hidden sm:block">WanderWyze Docket</span>
                        </div>
                        <nav className="hidden md:flex items-center space-x-4">
                            <button onClick={() => onNavigate('dashboard')} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Dashboard</button>
                            <button onClick={() => onNavigate('calendar')} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">PAX Calendar</button>
                            <button onClick={() => onNavigate('reports')} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Reports</button>
                            <button onClick={() => onNavigate('customers')} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Customers</button>
                            {currentUser?.role === 'admin' && (
                                <div className="relative" ref={adminRef}>
                                    <button onClick={() => setAdminOpen(!adminOpen)} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted flex items-center">
                                        Admin {React.cloneElement(Icons.chevronDown, { className: `ml-1 h-4 w-4 transition-transform ${adminOpen ? 'rotate-180' : ''}`})}
                                    </button>
                                    {adminOpen && (
                                        <div className="origin-top-right absolute left-0 mt-2 w-48 rounded-md shadow-lg var-bg ring-1 ring-border">
                                            <div className="py-1" role="menu" aria-orientation="vertical">
                                                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('users'); setAdminOpen(false); }} className="block px-4 py-2 text-sm text-fg hover:bg-muted" role="menuitem">User Management</a>
                                                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('agents'); setAdminOpen(false); }} className="block px-4 py-2 text-sm text-fg hover:bg-muted" role="menuitem">Agents</a>
                                                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('settings'); setAdminOpen(false); }} className="block px-4 py-2 text-sm text-fg hover:bg-muted" role="menuitem">Company Settings</a>
                                                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('change_password'); setAdminOpen(false); }} className="block px-4 py-2 text-sm text-fg hover:bg-muted" role="menuitem">Change Password</a>
                                                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('deleted_log'); setAdminOpen(false); }} className="block px-4 py-2 text-sm text-fg hover:bg-muted" role="menuitem">Deleted Dockets</a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </nav>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button onClick={onNewDocket} className="hidden sm:flex items-center space-x-2 bg-brand-primary text-on-brand px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-hover transition-colors">
                            {React.cloneElement(Icons.plus, { className: 'h-4 w-4'})}
                            <span>New Docket</span>
                        </button>
                         <button onClick={onNewDocket} className="sm:hidden flex items-center justify-center bg-brand-primary text-on-brand w-10 h-10 rounded-full font-semibold hover:bg-brand-hover transition-colors">
                            {React.cloneElement(Icons.plus, { className: 'h-5 w-5'})}
                        </button>
                        <div className="relative" ref={profileRef}>
                            <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center text-left p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary">
                                <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center">
                                    <span className="text-sm font-semibold text-muted-fg">{currentUser?.name?.charAt(0).toUpperCase()}</span>
                                </div>
                            </button>
                            {profileOpen && (
                                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg var-bg ring-1 ring-border">
                                    <div className="py-1" role="menu" aria-orientation="vertical">
                                        <div className="px-4 py-3 border-b">
                                            <p className="text-sm text-fg font-medium truncate">{currentUser?.name}</p>
                                            <p className="text-xs text-muted">{currentUser?.email}</p>
                                        </div>
                                        <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('profile'); setProfileOpen(false); }} className="flex items-center px-4 py-2 text-sm text-fg hover:bg-muted" role="menuitem">
                                            {Icons.user}
                                            <span className="ml-2">My Profile</span>
                                        </a>
                                        <a href="#" onClick={logout} className="flex items-center px-4 py-2 text-sm text-fg hover:bg-muted" role="menuitem">
                                            {Icons.logout}
                                            <span className="ml-2">Logout</span>
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};
