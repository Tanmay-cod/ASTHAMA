import React, { useState, useMemo } from 'react';
import { 
  UserCheck, 
  Save, 
  Trash2, 
  Download, 
  ShieldCheck, 
  AlertTriangle,
  Heart,
  Wind,
  Plus,
  Edit3,
  FileText,
  Search,
  CheckCircle2,
  Users,
  MapPin,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Patient } from '../types';
import { calculatePredictedPefr } from '../utils/clinicalCalculations';
import { MedicalDisclaimer } from './MedicalDisclaimer';
import { PatientModal } from './PatientModal';
import { PRESET_PATIENTS } from '../data/patientProfiles';

export const ProfileView: React.FC = () => {
  const { 
    patient, 
    patients, 
    activePatientId,
    updatePatient, 
    updatePatientById,
    addPatient,
    deletePatient,
    switchPatient,
    openReportModal,
    exportData,
    clearAllHistory, 
    resetToDefaultData, 
    showToast 
  } = useApp();

  const [activeTabMode, setActiveTabMode] = useState<'directory' | 'edit-active'>('directory');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'asthmatic' | 'at-risk' | 'smoker'>('all');

  // Modal State
  const [isPatientModalOpen, setIsPatientModalOpen] = useState<boolean>(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);

  // Active Patient Form State
  const [formData, setFormData] = useState({
    name: patient.name,
    email: patient.email,
    age: patient.age,
    gender: patient.gender,
    height_cm: patient.height_cm,
    weight_kg: patient.weight_kg,
    smoking: patient.smoking,
    family_history_asthma: patient.family_history_asthma,
    asthma_diagnosed: patient.asthma_diagnosed,
    medication: patient.medication || '',
  });

  // Sync formData when active patient changes
  React.useEffect(() => {
    setFormData({
      name: patient.name,
      email: patient.email,
      age: patient.age,
      gender: patient.gender,
      height_cm: patient.height_cm,
      weight_kg: patient.weight_kg,
      smoking: patient.smoking,
      family_history_asthma: patient.family_history_asthma,
      asthma_diagnosed: patient.asthma_diagnosed,
      medication: patient.medication || '',
    });
  }, [patient]);

  // Live Predicted PEFR baseline calculation for form
  const pefrBaseline = calculatePredictedPefr(
    formData.age,
    formData.gender,
    formData.height_cm
  );

  // Filtered patients for directory
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Search matching
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.medication && p.medication.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Filter category
      if (filterType === 'asthmatic') return p.asthma_diagnosed;
      if (filterType === 'at-risk') return !p.asthma_diagnosed;
      if (filterType === 'smoker') return p.smoking;
      return true;
    });
  }, [patients, searchQuery, filterType]);

  const handleActiveFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePatient({
      name: formData.name,
      email: formData.email,
      age: Number(formData.age),
      gender: formData.gender,
      height_cm: Number(formData.height_cm),
      weight_kg: Number(formData.weight_kg),
      smoking: formData.smoking,
      family_history_asthma: formData.family_history_asthma,
      asthma_diagnosed: formData.asthma_diagnosed,
      medication: formData.medication,
    });
  };

  const handleOpenAddModal = () => {
    setPatientToEdit(null);
    setIsPatientModalOpen(true);
  };

  const handleOpenEditModal = (targetPatient: Patient) => {
    setPatientToEdit(targetPatient);
    setIsPatientModalOpen(true);
  };

  const handleSaveModalPatient = (
    data: Omit<Patient, 'id' | 'created_at' | 'updated_at'>,
    patientId?: string
  ) => {
    if (patientId) {
      updatePatientById(patientId, data);
    } else {
      addPatient(data, true);
    }
  };

  const handleDeletePatient = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete patient record for "${name}"? This action cannot be undone.`)) {
      deletePatient(id);
    }
  };

  return (
    <div id="profile-view-container" className="space-y-6 max-w-6xl mx-auto">
      
      {/* Patient Add / Edit Modal */}
      <PatientModal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        onSave={handleSaveModalPatient}
        patientToEdit={patientToEdit}
      />

      {/* Header Info & Action Toolbar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Clinical Patient Registry & Profile Management</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manage multi-patient cohorts, register new patients, evaluate Nunn & Gregg spirometric baselines, and generate clinical reports.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            id="profile-add-patient-btn"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Patient</span>
          </button>

          <button
            id="profile-generate-report-btn"
            onClick={() => openReportModal(activePatientId)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Clinical Report</span>
          </button>

          <button
            id="profile-export-data-btn"
            onClick={() => exportData('csv', activePatientId)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200 cursor-pointer"
            title="Export telemetry history as CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Navigation Switcher: Directory vs Active Profile Editor */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            id="profile-tab-directory-btn"
            onClick={() => setActiveTabMode('directory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTabMode === 'directory'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Patient Registry ({patients.length})</span>
          </button>

          <button
            id="profile-tab-active-editor-btn"
            onClick={() => setActiveTabMode('edit-active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTabMode === 'edit-active'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Active Profile: {patient.name}</span>
          </button>
        </div>

        <span className="text-xs text-slate-500 hidden sm:inline">
          Active: <strong className="text-blue-700">{patient.name}</strong> ({patient.age}y {patient.gender.toUpperCase()})
        </span>
      </div>

      {/* VIEW 1: PATIENT REGISTRY & DIRECTORY */}
      {activeTabMode === 'directory' && (
        <div className="space-y-4">
          
          {/* Search and Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient name, email, meds..."
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filterType === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({patients.length})
              </button>
              <button
                onClick={() => setFilterType('asthmatic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filterType === 'asthmatic'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Asthmatic
              </button>
              <button
                onClick={() => setFilterType('at-risk')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filterType === 'at-risk'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                At-Risk / Evaluation
              </button>
              <button
                onClick={() => setFilterType('smoker')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filterType === 'smoker'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Smokers
              </button>
            </div>
          </div>

          {/* Patients Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPatients.map((p) => {
              const isActive = p.id === activePatientId;
              const preset = PRESET_PATIENTS.find((item) => item.patient.id === p.id);
              const predictedRef = calculatePredictedPefr(p.age, p.gender, p.height_cm);
              const bmiVal = Math.round((p.weight_kg / Math.pow(p.height_cm / 100, 2)) * 10) / 10;

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-xl border p-4.5 space-y-3.5 transition-all shadow-xs flex flex-col justify-between ${
                    isActive
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                          {isActive && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded border border-blue-200">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{p.email}</p>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                          p.asthma_diagnosed
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {p.asthma_diagnosed ? 'Asthma Dx' : 'At-Risk'}
                      </span>
                    </div>

                    {/* Location or Condition note */}
                    {preset?.location && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="truncate">{preset.location}</span>
                      </div>
                    )}
                    {preset?.conditionDescription && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                        {preset.conditionDescription}
                      </p>
                    )}
                  </div>

                  {/* Body Metrics & Nunn & Gregg Reference */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">AGE/SEX</span>
                        <span className="font-bold text-slate-800">
                          {p.age}y {p.gender === 'female' ? 'F' : 'M'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">BMI</span>
                        <span className="font-bold text-slate-800">{bmiVal}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">REF PEFR</span>
                        <span className="font-bold text-blue-700">{predictedRef.predictedPefr}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {p.smoking && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                          Smoker
                        </span>
                      )}
                      {p.family_history_asthma && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                          Family Hx
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                        {p.height_cm}cm • {p.weight_kg}kg
                      </span>
                    </div>

                    {p.medication && (
                      <p className="text-[10px] text-slate-500 truncate" title={p.medication}>
                        Rx: {p.medication}
                      </p>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    {!isActive ? (
                      <button
                        onClick={() => switchPatient(p.id)}
                        className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors text-center cursor-pointer"
                      >
                        Select Patient
                      </button>
                    ) : (
                      <span className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg text-center border border-emerald-200">
                        Current Active
                      </span>
                    )}

                    <button
                      onClick={() => openReportModal(p.id)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Generate clinical report for this patient"
                    >
                      <FileText className="w-4 h-4 text-emerald-600" />
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(p)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Edit patient profile"
                    >
                      <Edit3 className="w-4 h-4 text-blue-600" />
                    </button>

                    <button
                      onClick={() => handleDeletePatient(p.id, p.name)}
                      className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                      title="Delete patient record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPatients.length === 0 && (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-sm font-semibold">No patients match your current filter or query.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}

        </div>
      )}

      {/* VIEW 2: ACTIVE PROFILE EDITOR */}
      {activeTabMode === 'edit-active' && (
        <div className="space-y-6">
          
          {/* Active Patient Details Form */}
          <form onSubmit={handleActiveFormSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Editing Active Profile: {patient.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Patient ID: <span className="font-mono">{patient.id}</span> • Registered: {new Date(patient.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Nunn & Gregg Predicted Baseline Badge */}
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-xs space-y-0.5 shrink-0">
                <div className="flex items-center gap-1.5 font-bold text-blue-900">
                  <Wind className="w-3.5 h-3.5 text-blue-600" />
                  <span>Nunn & Gregg Baseline:</span>
                </div>
                <div className="text-slate-700">
                  Predicted PEFR: <strong className="text-blue-700 font-bold">{pefrBaseline.predictedPefr} L/min</strong>
                </div>
              </div>
            </div>

            {/* Section 1: Demographics */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                1. Personal Demographics & Contact
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="patient-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="patient-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="patient-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="patient-email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="patient-age" className="block text-xs font-semibold text-slate-700 mb-1">
                    Age (years)
                  </label>
                  <input
                    type="number"
                    id="patient-age"
                    min="5"
                    max="105"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="patient-gender" className="block text-xs font-semibold text-slate-700 mb-1">
                    Biological Sex
                  </label>
                  <select
                    id="patient-gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="patient-height" className="block text-xs font-semibold text-slate-700 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    id="patient-height"
                    min="90"
                    max="230"
                    step="0.5"
                    value={formData.height_cm}
                    onChange={(e) => setFormData({ ...formData, height_cm: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="patient-weight" className="block text-xs font-semibold text-slate-700 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    id="patient-weight"
                    min="15"
                    max="250"
                    step="0.5"
                    value={formData.weight_kg}
                    onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">Calculated BMI</span>
                    <span className="text-[11px] text-slate-500">Weight-to-height index</span>
                  </div>
                  <span className="font-bold text-sm text-slate-900">
                    {Math.round((formData.weight_kg / Math.pow(formData.height_cm / 100, 2)) * 10) / 10} kg/m²
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Clinical Risk Factors */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                2. Clinical Factors & Medication Protocol
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Asthma Diagnosed</span>
                    <span className="text-[11px] text-slate-500">Confirmed by doctor</span>
                  </div>
                  <input
                    type="checkbox"
                    id="patient-diagnosed-cb"
                    checked={formData.asthma_diagnosed}
                    onChange={(e) => setFormData({ ...formData, asthma_diagnosed: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Smoking Status</span>
                    <span className="text-[11px] text-slate-500">Active or former smoker</span>
                  </div>
                  <input
                    type="checkbox"
                    id="patient-smoking-cb"
                    checked={formData.smoking}
                    onChange={(e) => setFormData({ ...formData, smoking: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Family History</span>
                    <span className="text-[11px] text-slate-500">First-degree relative</span>
                  </div>
                  <input
                    type="checkbox"
                    id="patient-family-history-cb"
                    checked={formData.family_history_asthma}
                    onChange={(e) => setFormData({ ...formData, family_history_asthma: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="patient-medication" className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Inhalers & Maintenance Medications
                </label>
                <textarea
                  id="patient-medication"
                  rows={2}
                  value={formData.medication}
                  onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
                  placeholder="e.g. Fluticasone/Salmeterol 250/50 mcg bid; Albuterol 90mcg rescue inhaler as needed."
                  className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Form Submission */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                id="profile-save-btn"
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Data Export & Privacy Management */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Data Export & Patient Privacy Governance</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Export structured patient ledgers, download telemetry CSVs for statistical modeling, or reset cohorts to baseline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            id="profile-export-csv-btn"
            type="button"
            onClick={() => exportData('csv', activePatientId)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export Active Patient CSV</span>
          </button>

          <button
            id="profile-export-ledger-btn"
            type="button"
            onClick={() => exportData('json')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export All Patients JSON ({patients.length})</span>
          </button>

          <button
            id="profile-reset-benchmark-btn"
            type="button"
            onClick={resetToDefaultData}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            <span>Reset to Benchmark Test Data</span>
          </button>

          <button
            id="profile-erase-all-btn"
            type="button"
            onClick={() => {
              if (window.confirm('Erase all historical predictions and telemetry records? Patient profiles will remain.')) {
                clearAllHistory();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors border border-red-200 ml-auto cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Erase Historical Telemetry</span>
          </button>
        </div>
      </div>

      <MedicalDisclaimer />

    </div>
  );
};
