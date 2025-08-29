
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks';
import { AuthUser } from '../types';
import { Icons } from './common';

interface HeaderProps {
    onNewDocket: () => void;
    onNavigate: (view: string) => void;
    currentUser: AuthUser | null;
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewDocket, onNavigate, currentUser, searchTerm = '', onSearchChange }) => {
    const { logout } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

    const handleMobileMenuToggle = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const handleMobileNavigation = (view: string) => {
        setMobileMenuOpen(false);
        onNavigate(view);
    };

    return (
        <header className="var-bg/80 backdrop-blur-lg shadow-sm sticky top-0 z-40">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo and Brand */}
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate('dashboard')}>
                            <span className="bg-brand-primary text-on-brand font-bold text-xl rounded-md w-9 h-9 flex items-center justify-center">WD</span>
                            <span className="text-xl font-bold text-fg hidden sm:block">WanderWyze Docket</span>
                        </div>
                    </div>

                    {/* Search Bar - Always visible */}
                    <div className="flex-1 max-w-md mx-4 hidden sm:block">
                        {onSearchChange && (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by client, PAX, destination, age"
                                    value={searchTerm}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border bg-white border-slate-300 rounded-full shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary text-sm"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                    </svg>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-4">
                        <button onClick={() => onNavigate('dashboard')} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Dashboard</button>
                        <button onClick={() => onNavigate('calendar')} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">PAX Calendar</button>
                        <button onClick={() => onNavigate('reports')} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Reports</button>
                        {currentUser?.role === 'admin' && (
                            <div className="relative" ref={adminRef}>
                                <button onClick={() => setAdminOpen(!adminOpen)} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted flex items-center">
                                    Admin {React.cloneElement(Icons.chevronDown, { className: `ml-1 h-4 w-4 transition-transform ${adminOpen ? 'rotate-180' : ''}`})}
                                </button>
                                {adminOpen && (
                                    <div className="origin-top-right absolute left-0 mt-2 w-48 rounded-md shadow-lg var-bg ring-1 ring-border">
                                        <div className="py-1" role="menu" aria-orientation="vertical">
                                            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('customers'); setAdminOpen(false); }} className="block px-4 py-2 text-sm text-fg hover:bg-muted" role="menuitem">Customers</a>
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

                    {/* Right side buttons */}
                    <div className="flex items-center space-x-4">
                        {/* New Docket Button */}
                        <button onClick={onNewDocket} className="hidden sm:flex items-center space-x-2 bg-brand-primary text-on-brand px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-hover transition-colors">
                            {React.cloneElement(Icons.plus, { className: 'h-4 w-4'})}
                            <span>New Docket</span>
                        </button>
                        <button onClick={onNewDocket} className="sm:hidden flex items-center justify-center bg-brand-primary text-on-brand w-10 h-10 rounded-full font-semibold hover:bg-brand-hover transition-colors">
                            {React.cloneElement(Icons.plus, { className: 'h-5 w-5'})}
                        </button>

                        {/* Profile Menu */}
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

                        {/* Mobile Menu Button */}
                        <button
                            onClick={handleMobileMenuToggle}
                            className="md:hidden flex items-center justify-center w-10 h-10 rounded-md text-muted hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {mobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile Search Bar */}
                {onSearchChange && (
                    <div className="sm:hidden pb-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by client, PAX, destination, age"
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border bg-white border-slate-300 rounded-full shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary text-sm"
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden pb-4 border-t border-border">
                        <div className="pt-4 space-y-2">
                            <button onClick={() => handleMobileNavigation('dashboard')} className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Dashboard</button>
                            <button onClick={() => handleMobileNavigation('calendar')} className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">PAX Calendar</button>
                            <button onClick={() => handleMobileNavigation('reports')} className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Reports</button>
                            {currentUser?.role === 'admin' && (
                                <>
                                    <div className="border-t border-border pt-2 mt-2">
                                        <div className="px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Admin</div>
                                        <button onClick={() => handleMobileNavigation('customers')} className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Customers</button>
                                        <button onClick={() => handleMobileNavigation('users')} className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">User Management</button>
                                        <button onClick={() => handleMobileNavigation('agents')} className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Agents</button>
                                        <button onClick={() => handleMobileNavigation('settings')} className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Company Settings</button>
                                        <button onClick={() => handleMobileNavigation('change_password')} className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Change Password</button>
                                        <button onClick={() => handleMobileNavigation('deleted_log')} className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted hover:bg-muted">Deleted Dockets</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};
