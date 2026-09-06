import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserPlus, 
  Edit3, 
  Save, 
  Wind, 
  User, 
  Mail, 
  AlertCircle,
  Activity,
  Calendar
} from 'lucide-react';
import { Patient } from '../types';
import { calculatePredictedPefr } from '../utils/clinicalCalculations';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patientData: Omit<Patient, 'id' | 'created_at' | 'updated_at'>, patientId?: string) => void;
  patientToEdit?: Patient | null;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  patientToEdit,
}) => {
  const isEditing = !!patientToEdit;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: 30,
    gender: 'male' as 'male' | 'female' | 'other',
    height_cm: 170,
    weight_kg: 68,
    smoking: false,
    family_history_asthma: false,
    asthma_diagnosed: false,
    medication: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Reset or populate form when modal opens or target changes
  useEffect(() => {
    if (patientToEdit) {
      setFormData({
        name: patientToEdit.name,
        email: patientToEdit.email,
        age: patientToEdit.age,
        gender: patientToEdit.gender,
        height_cm: patientToEdit.height_cm,
        weight_kg: patientToEdit.weight_kg,
        smoking: patientToEdit.smoking,
        family_history_asthma: patientToEdit.family_history_asthma,
        asthma_diagnosed: patientToEdit.asthma_diagnosed,
        medication: patientToEdit.medication || '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        age: 28,
        gender: 'male',
        height_cm: 172,
        weight_kg: 68,
        smoking: false,
        family_history_asthma: false,
        asthma_diagnosed: false,
        medication: '',
      });
    }
    setFormErrors({});
  }, [patientToEdit, isOpen]);

  if (!isOpen) return null;

  // Real-time Nunn & Gregg Predicted PEFR calculation
  const predictedPefr = calculatePredictedPefr(
    formData.age,
    formData.gender,
    formData.height_cm
  );

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Patient full name is required';
    if (!formData.email.trim()) errors.email = 'Valid contact email is required';
    if (formData.age < 5 || formData.age > 105) errors.age = 'Age must be between 5 and 105';
    if (formData.height_cm < 90 || formData.height_cm > 230) errors.height_cm = 'Height must be between 90 and 230 cm';
    if (formData.weight_kg < 15 || formData.weight_kg > 250) errors.weight_kg = 'Weight must be between 15 and 250 kg';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave(
      {
        user_id: patientToEdit ? patientToEdit.user_id : `usr_${Date.now()}`,
        name: formData.name.trim(),
        email: formData.email.trim(),
        age: Number(formData.age),
        gender: formData.gender,
        height_cm: Number(formData.height_cm),
        weight_kg: Number(formData.weight_kg),
        smoking: formData.smoking,
        family_history_asthma: formData.family_history_asthma,
        asthma_diagnosed: formData.asthma_diagnosed,
        medication: formData.medication.trim(),
      },
      patientToEdit?.id
    );
    onClose();
  };

  return (
    <div
      id="patient-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="patient-form-dialog"
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
              {isEditing ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? `Edit Clinical Profile: ${patientToEdit.name}` : 'Register New Clinical Patient'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? 'Update baseline demographics and prescribed asthma maintenance therapy'
                  : 'Add a new patient to clinical telemetry database and baseline reference'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Nunn & Gregg Preview Banner */}
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-blue-900 font-semibold">
            <Wind className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Predicted Nunn & Gregg Baseline:</span>
            <span className="font-bold text-blue-700 text-sm">{predictedPefr.predictedPefr} L/min</span>
          </div>
          <span className="text-slate-500 text-[11px]">
            Based on {formData.age}y {formData.gender.toUpperCase()}, {formData.height_cm}cm height
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Demographics Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-patient-name" className="block text-xs font-bold text-slate-700 mb-1">
                Full Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="modal-patient-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Om Tyade, Deepali Jichkar"
                  className={`w-full text-xs sm:text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden ${
                    formErrors.name ? 'border-red-500 bg-red-50/50' : 'border-slate-300'
                  }`}
                  required
                />
              </div>
              {formErrors.name && <p className="text-[11px] text-red-600 mt-1">{formErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="modal-patient-email" className="block text-xs font-bold text-slate-700 mb-1">
                Contact Email *
              </label>
              <input
                type="email"
                id="modal-patient-email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="patient@health.in"
                className={`w-full text-xs sm:text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden ${
                  formErrors.email ? 'border-red-500 bg-red-50/50' : 'border-slate-300'
                }`}
                required
              />
              {formErrors.email && <p className="text-[11px] text-red-600 mt-1">{formErrors.email}</p>}
            </div>
          </div>

          {/* Anthropometrics Row 2 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="modal-patient-age" className="block text-xs font-bold text-slate-700 mb-1">
                Age (years) *
              </label>
              <input
                type="number"
                id="modal-patient-age"
                min="5"
                max="105"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label htmlFor="modal-patient-gender" className="block text-xs font-bold text-slate-700 mb-1">
                Biological Sex *
              </label>
              <select
                id="modal-patient-gender"
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
              <label htmlFor="modal-patient-height" className="block text-xs font-bold text-slate-700 mb-1">
                Height (cm) *
              </label>
              <input
                type="number"
                id="modal-patient-height"
                min="90"
                max="230"
                step="0.5"
                value={formData.height_cm}
                onChange={(e) => setFormData({ ...formData, height_cm: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label htmlFor="modal-patient-weight" className="block text-xs font-bold text-slate-700 mb-1">
                Weight (kg) *
              </label>
              <input
                type="number"
                id="modal-patient-weight"
                min="15"
                max="250"
                step="0.5"
                value={formData.weight_kg}
                onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Clinical Risk Factor Checkboxes */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
              Clinical & History Factors
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.asthma_diagnosed}
                  onChange={(e) => setFormData({ ...formData, asthma_diagnosed: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Asthma Diagnosed</span>
                  <span className="text-[10px] text-slate-500">Confirmed by doctor</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.smoking}
                  onChange={(e) => setFormData({ ...formData, smoking: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Smoking Status</span>
                  <span className="text-[10px] text-slate-500">Smoker or ex-smoker</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.family_history_asthma}
                  onChange={(e) => setFormData({ ...formData, family_history_asthma: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Family History</span>
                  <span className="text-[10px] text-slate-500">1st-degree relative</span>
                </div>
              </label>
            </div>
          </div>

          {/* Current Medication */}
          <div>
            <label htmlFor="modal-patient-med" className="block text-xs font-bold text-slate-700 mb-1">
              Current Inhalers, Controllers & Prescriptions
            </label>
            <textarea
              id="modal-patient-med"
              rows={2}
              value={formData.medication}
              onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
              placeholder="e.g. Budesonide/Formoterol 200/6 mcg DPI twice daily; Salbutamol MDI 100mcg as needed."
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="patient-modal-submit-btn"
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'Save Profile Changes' : 'Add to Patient Registry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
