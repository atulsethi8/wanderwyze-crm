

import React, { useState, useCallback, useMemo } from 'react';
import { AuthProvider, useAuth, useDockets } from './hooks';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { DocketForm } from './components/DocketForm';
import { ReportsDashboard } from './components/ReportsDashboard';
import { PaxCalendar } from './components/PaxCalendar';
import { LoginPage, PasswordResetPage, UserProfilePage } from './components/Auth';
import { DeletedDocketsLog } from './components/DeletedDocketsLog';
import { Spinner } from './components/common';
import { CompanySettingsPage } from './components/CompanySettingsPage';
import { AgentManagementPage } from './components/AgentManagementPage';
import { UserManagementPage } from './components/UserManagementPage';
import { ChangePasswordPage } from './components/ChangePasswordPage';
import { usingDefaultKeys } from './services';

/**
 * A full-screen overlay that blocks the app if API keys are not configured.
 * This is a critical step and the app cannot function without it.
 */
const FatalConfigError: React.FC = () => {
    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-95 z-50 flex justify-center items-center p-4 text-white">
            <div className="max-w-3xl w-full bg-slate-800 rounded-lg shadow-2xl p-8 border border-red-500">
                <div className="text-center">
                    <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <h1 className="text-3xl font-bold text-red-400">Action Required: Environment Variables Not Set</h1>
                    <p className="text-slate-300 mt-4 text-lg">
                        This application cannot connect to its backend services because the required API keys are missing.
                    </p>
                </div>

                <div className="mt-8 bg-slate-900 p-6 rounded-lg">
                     <p className="text-slate-200 text-md mb-4">
                        To fix this, provide the following environment variables to your deployment environment (e.g., Netlify, Vercel):
                    </p>
                    <pre className="bg-black text-white p-4 rounded-md overflow-x-auto text-sm">
                        <code>
{`# Supabase Credentials (User defined prefix, e.g. VITE_)
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Google Gemini API Key (MUST be named API_KEY)
API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
`}
                        </code>
                    </pre>
                     <p className="text-slate-400 mt-4 text-sm">
                        After setting the variables, you may need to redeploy your application for the changes to take effect.
                    </p>
                </div>
                
                 <p className="text-center text-slate-400 mt-8 text-md">
                    The application will not function until these keys are provided.
                </p>
            </div>
        </div>
    );
};


const AppContent: React.FC = () => {
    const { currentUser, loading: authLoading, hasSession } = useAuth();
    const { dockets, getDocketById, saveDocket, deleteDocket, suppliers, saveSupplier, agents, saveAgent, users, updateUserRole, deletionLog, loading: docketsLoading } = useDockets();
    const [currentView, setCurrentView] = useState('dashboard');
    const [selectedDocketId, setSelectedDocketId] = useState<string | null>(null);

    // This is the most important check. If default keys are used, block the entire app.
    if (usingDefaultKeys) {
        return <FatalConfigError />;
    }

    const navigate = (path: string) => {
        window.location.hash = path;
    };

    React.useEffect(() => {
        const handleHashChange = () => {
            const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
            // Recognize dynamic routes
            if (raw === 'docket/new') {
                setSelectedDocketId(null);
                setCurrentView('form');
                return;
            }
            const docketDetailsMatch = raw.match(/^dockets\/([^/]+)\/details$/);
            if (docketDetailsMatch) {
                const id = docketDetailsMatch[1];
                setSelectedDocketId(id);
                setCurrentView('form');
                return;
            }
            // Fallback to simple view name
            setCurrentView(raw || 'dashboard');
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange(); // Set initial view

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, []);

    const handleNavigation = (view: string) => {
        setSelectedDocketId(null);
        navigate(`/${view}`);
    };
    
    const handleNewDocket = () => {
        setSelectedDocketId(null);
        navigate('/docket/new');
    };

    const handleSelectDocket = (id: string) => {
        setSelectedDocketId(id);
        navigate(`/dockets/${id}/details`);
    };

    const handleSaveDocket = async (docketData: any, id?: string) => {
        try {
            const savedId = await saveDocket(docketData, id);
            if(savedId) {
                setSelectedDocketId(savedId);
                navigate(`/dockets/${savedId}/details`);
            }
        } catch (error: any) {
            console.error("Error saving docket from App.tsx:", error);
            alert(`Failed to save docket: ${error?.message || 'Unknown error'}`);
        }
    };

    const handleDeleteDocket = (id: string, reason: string) => {
        deleteDocket(id, reason);
        navigate('/dashboard');
    };
    
    const selectedDocket = useMemo(() => {
        return selectedDocketId ? getDocketById(selectedDocketId) : null;
    }, [selectedDocketId, getDocketById]);


    if (authLoading) {
        return (
            <div className="h-screen w-screen flex justify-center items-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!currentUser) {
        const hash = window.location.hash.replace(/^#\/?/, '');
        if (hash.startsWith('reset-password')) {
            return <PasswordResetPage />;
        }
        // If there is a session, show a spinner instead of login until profile resolves
        if (hasSession) {
            return (
                <div className="h-screen w-screen flex justify-center items-center">
                    <Spinner size="lg" />
                </div>
            );
        }
        return <LoginPage />;
    }

    const renderContent = () => {
        switch(currentView) {
            case 'dashboard':
                return <Dashboard dockets={dockets} agents={agents} onSelectDocket={handleSelectDocket} />;
            case 'form':
                return <DocketForm 
                    docket={selectedDocket} 
                    onSave={handleSaveDocket}
                    onDelete={handleDeleteDocket}
                    onClose={() => handleNavigation('dashboard')}
                    suppliers={suppliers}
                    saveSupplier={saveSupplier}
                    agents={agents}
                    loading={docketsLoading}
                />;
            case 'reports':
                return <ReportsDashboard dockets={dockets} agents={agents} onOpenDocket={(id) => { setSelectedDocketId(id); navigate(`/dockets/${id}/details`); }} />;
            case 'settings':
                return currentUser.role === 'admin' ? <CompanySettingsPage /> : <p>Access Denied</p>;
            case 'change_password':
                return currentUser.role === 'admin' ? <ChangePasswordPage /> : <p>Access Denied</p>;
            case 'agents':
                return currentUser.role === 'admin' ? <AgentManagementPage agents={agents} saveAgent={saveAgent} /> : <p>Access Denied</p>;
            case 'users':
                return currentUser.role === 'admin' ? <UserManagementPage users={users} updateUserRole={updateUserRole} /> : <p>Access Denied</p>;
            case 'calendar':
                return <PaxCalendar dockets={dockets} onSelectDocket={handleSelectDocket} />;
            case 'profile':
                return <UserProfilePage />;
            case 'deleted_log':
                 return currentUser.role === 'admin' ? <DeletedDocketsLog logs={deletionLog} /> : <p>Access Denied</p>;
            default:
                return <Dashboard dockets={dockets} agents={agents} onSelectDocket={handleSelectDocket} />;
        }
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header onNewDocket={handleNewDocket} onNavigate={handleNavigation} currentUser={currentUser} />
            <main className="flex-grow">
                {renderContent()}
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
