
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
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { CompanySettingsPage } from './components/CompanySettingsPage';
import { AgentManagementPage } from './components/AgentManagementPage';
import { UserManagementPage } from './components/UserManagementPage';
import { usingFallbackKeys } from './services';

/**
 * A banner that warns the developer if fallback (hardcoded) keys are being used.
 * This encourages the adoption of secure environment variables.
 */
const DevWarningBanner: React.FC = () => {
    if (!usingFallbackKeys) {
        return null;
    }

    return (
        <div className="bg-amber-100 border-b-2 border-amber-500 text-amber-800 p-2 text-center print:hidden">
            <p className="text-sm">
                <span className="font-bold">Developer Notice:</span> This app is using fallback credentials. For production, use environment variables for better security.
            </p>
        </div>
    );
};


const AppContent: React.FC = () => {
    const { currentUser, loading: authLoading } = useAuth();
    const { dockets, getDocketById, saveDocket, deleteDocket, suppliers, saveSupplier, agents, saveAgent, users, updateUserRole, deletionLog, loading: docketsLoading } = useDockets();
    const [currentView, setCurrentView] = useState('dashboard');
    const [selectedDocketId, setSelectedDocketId] = useState<string | null>(null);

    const navigate = useNavigate();
    const location = useLocation();
    
    // This effect synchronizes the React state 'currentView' with the URL from HashRouter
    React.useEffect(() => {
        const path = location.pathname.substring(1) || 'dashboard';
        setCurrentView(path);
    }, [location]);

    const handleNavigation = (view: string) => {
        setSelectedDocketId(null);
        navigate(`/${view}`);
    };
    
    const handleNewDocket = () => {
        setSelectedDocketId(null);
        navigate('/form');
    };

    const handleSelectDocket = (id: string) => {
        setSelectedDocketId(id);
        navigate('/form');
    };

    const handleSaveDocket = async (docketData: any, id?: string) => {
        try {
            const savedId = await saveDocket(docketData, id);
            if(savedId) {
                setSelectedDocketId(savedId);
                navigate('/form'); // stay on form after save
            }
        } catch (error) {
            console.error("Error saving docket from App.tsx:", error);
            alert("Failed to save docket. Please check your connection and try again.");
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
        // Simple routing for auth pages
        if (location.pathname.startsWith('/reset-password')) {
            return <PasswordResetPage />;
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
                return <ReportsDashboard dockets={dockets} agents={agents} />;
            case 'settings':
                return currentUser.role === 'admin' ? <CompanySettingsPage /> : <p>Access Denied</p>;
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
            <DevWarningBanner />
            <Header onNewDocket={handleNewDocket} onNavigate={handleNavigation} currentUser={currentUser} />
            <main className="flex-grow">
                {renderContent()}
            </main>
        </div>
    );
};

// Main App component wraps everything in providers
const App: React.FC = () => {
    return (
        <AuthProvider>
            <HashRouter>
                 <AppContent />
            </HashRouter>
        </AuthProvider>
    );
};

export default App;
