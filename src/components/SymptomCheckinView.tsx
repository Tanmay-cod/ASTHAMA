import React from 'react';
import { 
  ClipboardCheck, 
  RotateCcw, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Activity
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MedicalDisclaimer } from './MedicalDisclaimer';

interface SymptomQuestion {
  key: 'cough' | 'wheezing' | 'shortness_of_breath' | 'chest_tightness' | 'night_cough';
  title: string;
  description: string;
  options: Array<{ value: number; label: string; detail: string }>;
}

export const SymptomCheckinView: React.FC = () => {
  const { 
    currentSymptoms, 
    setSymptomField, 
    resetSymptoms, 
    saveCurrentSymptoms, 
    setActiveTab, 
    showToast 
  } = useApp();

  const questions: SymptomQuestion[] = [
    {
      key: 'wheezing',
      title: 'Wheezing or Whistling Sound',
      description: 'High-pitched sound produced in the airways during expiration',
      options: [
        { value: 0, label: 'None (0)', detail: 'Normal quiet breathing, no whistling' },
        { value: 1, label: 'Mild (1)', detail: 'Audible during physical activity or heavy breathing' },
        { value: 2, label: 'Severe (2)', detail: 'Audible at rest or causing visible breathing distress' },
      ],
    },
    {
      key: 'shortness_of_breath',
      title: 'Shortness of Breath (Dyspnea)',
      description: 'Sensation of air hunger or labored breathing',
      options: [
        { value: 0, label: 'None (0)', detail: 'Normal breathing during regular daily routines' },
        { value: 1, label: 'Moderate (1)', detail: 'Short of breath when climbing stairs or walking briskly' },
        { value: 2, label: 'Severe (2)', detail: 'Breathless while sitting still or difficulty completing full sentences' },
      ],
    },
    {
      key: 'cough',
      title: 'Cough Frequency',
      description: 'Dry or hacking cough irritating the upper/lower bronchial tree',
      options: [
        { value: 0, label: 'None (0)', detail: 'No persistent coughing episodes' },
        { value: 1, label: 'Intermittent (1)', detail: 'Occasional coughing bouts throughout the day' },
        { value: 2, label: 'Frequent (2)', detail: 'Continuous paroxysmal coughing disrupting activities' },
      ],
    },
    {
      key: 'chest_tightness',
      title: 'Chest Tightness or Heaviness',
      description: 'Constrictive sensation around the ribcage or sternum',
      options: [
        { value: 0, label: 'None (0)', detail: 'Chest feels completely relaxed and comfortable' },
        { value: 1, label: 'Mild (1)', detail: 'Slight heaviness or stiffness across the chest' },
        { value: 2, label: 'Severe (2)', detail: 'Intense constrictive band feeling, labored expansion' },
      ],
    },
    {
      key: 'night_cough',
      title: 'Nighttime Respiratory Symptoms',
      description: 'Nocturnal awakenings caused by coughing or breathlessness',
      options: [
        { value: 0, label: 'None (0)', detail: 'Slept soundly through the night without respiratory wakeups' },
        { value: 1, label: 'Once (1)', detail: 'Woke up once due to cough or mild wheeze' },
        { value: 2, label: 'Frequent (2)', detail: 'Awakened multiple times or had to sit up to breathe' },
      ],
    },
  ];

  const handleSaveAndProceed = () => {
    saveCurrentSymptoms();
    showToast('Symptom check-in recorded. Proceeding to sensor ingestion.', 'success');
    setActiveTab('sensor');
  };

  const getScoreSeverity = (score: number) => {
    if (score === 0) return { label: 'Asymptomatic', color: 'text-emerald-700 bg-emerald-100 border-emerald-300' };
    if (score <= 3) return { label: 'Mild Symptoms', color: 'text-blue-800 bg-blue-100 border-blue-300' };
    if (score <= 6) return { label: 'Moderate Symptoms', color: 'text-amber-800 bg-amber-100 border-amber-300' };
    return { label: 'Severe Clinical Symptoms', color: 'text-red-800 bg-red-100 border-red-300' };
  };

  const severity = getScoreSeverity(currentSymptoms.symptom_score);

  return (
    <div id="symptom-checkin-container" className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header Info */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Current Symptom Check-in</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Standardized respiratory symptom inventory aligned with GINA clinical questionnaire guidelines.
          </p>
        </div>

        {/* Live Composite Score Badge */}
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 shrink-0">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Composite Score</div>
            <div className={`text-xs font-bold px-2 py-0.5 rounded border mt-0.5 ${severity.color}`}>
              {severity.label}
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex flex-col items-center justify-center font-bold shadow-xs">
            <span className="text-lg leading-none">{currentSymptoms.symptom_score}</span>
            <span className="text-[10px] opacity-80 leading-none">/ 10</span>
          </div>
        </div>
      </div>

      {/* Quick Template Selector */}
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-700">Quick Templates:</span>
        <button
          type="button"
          onClick={() => {
            setSymptomField('cough', 0);
            setSymptomField('wheezing', 0);
            setSymptomField('shortness_of_breath', 0);
            setSymptomField('chest_tightness', 0);
            setSymptomField('night_cough', 0);
          }}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-medium transition-colors"
        >
          All Clear (0/10)
        </button>
        <button
          type="button"
          onClick={() => {
            setSymptomField('cough', 1);
            setSymptomField('wheezing', 1);
            setSymptomField('shortness_of_breath', 0);
            setSymptomField('chest_tightness', 1);
            setSymptomField('night_cough', 0);
          }}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-medium transition-colors"
        >
          Mild Weather Reaction (3/10)
        </button>
        <button
          type="button"
          onClick={() => {
            setSymptomField('cough', 2);
            setSymptomField('wheezing', 2);
            setSymptomField('shortness_of_breath', 2);
            setSymptomField('chest_tightness', 2);
            setSymptomField('night_cough', 1);
          }}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-red-700 border border-red-200 rounded font-medium transition-colors"
        >
          Acute Exacerbation (9/10)
        </button>
      </div>

      {/* Symptom Questions List */}
      <div className="space-y-4">
        {questions.map((q) => {
          const currentValue = currentSymptoms[q.key] as number;
          return (
            <div 
              key={q.key} 
              id={`symptom-card-${q.key}`}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{q.title}</h3>
                  <p className="text-xs text-slate-500">{q.description}</p>
                </div>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 self-start sm:self-auto">
                  Selected: {currentValue} / 2
                </span>
              </div>

              {/* 3-State Radio Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {q.options.map((opt) => {
                  const isSelected = currentValue === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      id={`opt-${q.key}-${opt.value}`}
                      onClick={() => setSymptomField(q.key, opt.value)}
                      className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {opt.label}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                        {opt.detail}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional Contextual Notes */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <label htmlFor="symptom-notes-input" className="block text-sm font-bold text-slate-900">
          Additional Clinical Observations (Optional)
        </label>
        <p className="text-xs text-slate-500">
          Note any specific triggers (e.g. exercise, cold air, pet dander, perfume) or recent inhaler uses.
        </p>
        <textarea
          id="symptom-notes-input"
          value={currentSymptoms.notes || ''}
          onChange={(e) => setSymptomField('notes', e.target.value)}
          placeholder="e.g. Experienced shortness of breath after climbing two flights of stairs; used 2 puffs of albuterol 1 hour ago."
          rows={2}
          className="w-full text-xs sm:text-sm p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-hidden"
        />
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          id="symptom-reset-btn"
          onClick={resetSymptoms}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 w-full sm:w-auto justify-center"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Clear Symptoms</span>
        </button>

        <button
          type="button"
          id="symptom-proceed-sensor-btn"
          onClick={handleSaveAndProceed}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors w-full sm:w-auto justify-center"
        >
          <span>Save & Proceed to Sensor Reading</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <MedicalDisclaimer />

    </div>
  );
};
