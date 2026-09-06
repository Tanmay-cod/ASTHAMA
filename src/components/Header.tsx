import React from 'react';
import { Activity, Wifi, WifiOff, Radio, User, RefreshCw, Cpu, Database, Zap, Terminal, FileText, Shield, KeyRound, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Header: React.FC = () => {
  const {
    patient,
    patients,
    switchPatient,
    openReportModal,
    isEsp32Connected,
    isStreamingTelemetry,
    toggleTelemetryStream,
    webSerialStatus,
    isSupabaseConnected,
    isSupabaseStreaming,
    setIsHardwareOrCloudModalOpen,
    setActiveTab,
    resetToDefaultData,
    currentUser,
    setIsAuthModalOpen,
    inferenceEnginePreference,
    setInferenceEnginePreference,
  } = useApp();

  // Determine active telemetry intake source
  const getHardwareStatusDisplay = () => {
    if (webSerialStatus.isConnected) {
      return {
        label: `USB Hardware: Connected`,
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dotClass: 'bg-emerald-500 animate-ping',
        icon: <Zap className="w-3.5 h-3.5 text-emerald-700" />,
      };
    }
    if (isSupabaseStreaming) {
      return {
        label: 'Supabase: Cloud Stream Active',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        dotClass: 'bg-blue-500 animate-pulse',
        icon: <Database className="w-3.5 h-3.5 text-blue-700" />,
        pill: 'Live',
      };
    }
    if (isSupabaseConnected) {
      return {
        label: 'Supabase: Connected',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-500',
        icon: <Database className="w-3.5 h-3.5 text-emerald-700" />,
        pill: 'Ready',
      };
    }
    if (isStreamingTelemetry) {
      return {
        label: 'Simulator: Active',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        dotClass: 'bg-amber-500 animate-pulse',
        icon: <Radio className="w-3.5 h-3.5 text-amber-700" />,
        pill: 'Sim',
      };
    }
    return {
      label: 'Hardware: Standby',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      dotClass: 'bg-slate-400',
      icon: <WifiOff className="w-3.5 h-3.5 text-slate-500" />,
      pill: 'Hub',
    };
  };

  const statusDisplay = getHardwareStatusDisplay();

  return (
    <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <button
              id="header-brand-btn"
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3 text-left focus:outline-hidden group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs group-hover:bg-blue-700 transition-colors">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-base tracking-tight leading-none">
                    IoT Asthma Risk Predictor
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                    B.Tech IoT
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 leading-none">
                  Fusing Multi-Sensor Telemetry with Explainable ML
                </p>
              </div>
            </button>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Hardware & Cloud Integration Status Button */}
            <button
              id="header-hardware-hub-btn"
              onClick={() => setIsHardwareOrCloudModalOpen(true)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:shadow-xs cursor-pointer ${statusDisplay.badgeClass}`}
              title="View NodeMCU / ESP32 Hardware Pinout or Supabase Cloud Settings"
            >
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${statusDisplay.dotClass}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${statusDisplay.dotClass}`} />
              </span>
              {statusDisplay.icon}
              <span className="hidden md:inline font-bold">{statusDisplay.label}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-white/80 px-1.5 py-0.5 rounded ml-0.5 border border-black/5 text-slate-700">
                {statusDisplay.pill || 'Hub'}
              </span>
            </button>

            {/* Quick Virtual Simulator Toggle */}
            <button
              id="header-stream-toggle-btn"
              onClick={toggleTelemetryStream}
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isStreamingTelemetry
                  ? 'bg-amber-50 border-amber-300 text-amber-800 animate-pulse'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Toggle continuous telemetry simulation"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isStreamingTelemetry ? 'Sim Active' : 'Test Sim'}</span>
            </button>

            {/* Patient Selector */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md p-1 max-w-[200px] sm:max-w-[260px]">
              <User className="w-3.5 h-3.5 text-blue-600 ml-1 shrink-0" />
              <label htmlFor="patient-profile-select" className="sr-only">Active Patient Profile</label>
              <select
                id="patient-profile-select"
                value={patient.id}
                onChange={(e) => switchPatient(e.target.value)}
                className="text-xs bg-transparent text-slate-800 font-medium border-0 focus:ring-0 focus:outline-hidden py-0.5 pr-2 cursor-pointer truncate"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.age}{p.gender === 'female' ? 'F' : 'M'}{p.asthma_diagnosed ? ' • Asthmatic' : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* Model Engine Selector */}
            <div className="hidden xl:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setInferenceEnginePreference('trained_forest')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                  inferenceEnginePreference === 'trained_forest'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Use genuine 10-tree Decision Forest trained on NHANES/CPCB benchmarks"
              >
                Forest ML
              </button>
              <button
                type="button"
                onClick={() => setInferenceEnginePreference('clinical_guideline_baseline')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                  inferenceEnginePreference === 'clinical_guideline_baseline'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Use transparent rule-based triage heuristic (GINA & Nunn/Gregg)"
              >
                GINA Rules
              </button>
            </div>

            {/* Supabase Cloud Auth Button */}
            <button
              id="header-auth-btn"
              onClick={() => setIsAuthModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                currentUser
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title={currentUser ? `Signed in as ${currentUser.email}. Click to view account & RLS.` : 'Sign in to Supabase cloud account'}
            >
              {currentUser ? (
                <>
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="max-w-[90px] truncate">{currentUser.email?.split('@')[0]}</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Cloud Auth</span>
                </>
              )}
            </button>

            {/* Quick Clinical Report Generator Button */}
            <button
              id="header-open-report-btn"
              onClick={() => openReportModal(patient.id)}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
              title="Generate comprehensive Clinical Report for active patient"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden md:inline">Report</span>
            </button>

            {/* Architecture / Engineering Specs Button */}
            <button
              id="header-nav-architecture-btn"
              onClick={() => setActiveTab('architecture')}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors"
              title="View Hardware Pinout, Firmware & ML Pipeline specs"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Engineering Specs</span>
            </button>

            {/* Reset Button */}
            <button
              id="header-reset-benchmark-btn"
              onClick={resetToDefaultData}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              title="Reset to benchmark evaluation dataset"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
