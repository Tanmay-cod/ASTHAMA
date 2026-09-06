import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { SymptomCheckinView } from './components/SymptomCheckinView';
import { SensorReadingView } from './components/SensorReadingView';
import { ResultView } from './components/ResultView';
import { HistoryView } from './components/HistoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { ProfileView } from './components/ProfileView';
import { ArchitectureView } from './components/ArchitectureView';
import { HardwareAndCloudModal } from './components/HardwareAndCloudModal';
import { ClinicalReportModal } from './components/ClinicalReportModal';
import { AuthModal } from './components/AuthModal';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const MainContent: React.FC = () => {
  const { 
    activeTab, 
    statusMessage, 
    isReportModalOpen, 
    closeReportModal, 
    reportTargetPatientId 
  } = useApp();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'checkin':
        return <SymptomCheckinView />;
      case 'sensor':
        return <SensorReadingView />;
      case 'result':
        return <ResultView />;
      case 'history':
        return <HistoryView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'profile':
        return <ProfileView />;
      case 'architecture':
        return <ArchitectureView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* Toast Notification Banner */}
      {statusMessage && (
        <div 
          id="global-status-toast"
          className={`fixed bottom-4 right-4 z-50 max-w-md p-3.5 rounded-xl shadow-lg border flex items-center gap-3 animate-slideIn ${
            statusMessage.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          {statusMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          ) : statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
          )}
          <span className="text-xs font-semibold leading-tight">{statusMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <Header />

      {/* Hardware & Supabase Cloud Integration Hub Modal */}
      <HardwareAndCloudModal />

      {/* Supabase Authentication & RLS Modal */}
      <AuthModal />

      {/* Clinical Telemetry & Spirometry Report Modal */}
      <ClinicalReportModal
        isOpen={isReportModalOpen}
        onClose={closeReportModal}
        initialPatientId={reportTargetPatientId || undefined}
      />

      {/* Multipage Tab Navigation */}
      <Navigation />

      {/* Main View Area */}
      <main id="main-content-area" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {renderActiveView()}
      </main>

      {/* Footer */}
      <footer id="app-footer" className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">IoT Early Asthma Risk Prediction System</span>
            <span>•</span>
            <span>Final Year Engineering Project</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span>NHANES 2011–2012 + CPCB city_day</span>
            <span>•</span>
            <span>Random Forest + SHAP TreeExplainer</span>
            <span>•</span>
            <span>Decision-Support Only</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
