import React from 'react';
import { LayoutDashboard, ClipboardCheck, Radio, Sparkles, History, TrendingUp, UserCheck, Cpu } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';

interface TabItem {
  id: ActiveTab;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab, latestPrediction } = useApp();

  const tabs: TabItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'checkin', label: 'Symptom Check-in', icon: ClipboardCheck },
    { id: 'sensor', label: 'Sensor Reading & IoT', icon: Radio },
    { 
      id: 'result', 
      label: 'Risk & SHAP', 
      icon: Sparkles,
      badge: latestPrediction?.risk_class
    },
    { id: 'history', label: 'History Logs', icon: History },
    { id: 'analytics', label: 'Clinical Analytics', icon: TrendingUp },
    { id: 'profile', label: 'Patient Registry', icon: UserCheck },
    { id: 'architecture', label: 'Architecture & Firmware', icon: Cpu },
  ];

  return (
    <nav id="app-navigation-bar" className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors relative ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                      tab.badge === 'High'
                        ? 'bg-red-100 text-red-700'
                        : tab.badge === 'Moderate'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
