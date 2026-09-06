import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface MedicalDisclaimerProps {
  compact?: boolean;
}

export const MedicalDisclaimer: React.FC<MedicalDisclaimerProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <div 
        id="medical-disclaimer-compact" 
        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600"
      >
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong className="font-semibold text-slate-800">Decision-Support Tool:</strong> Not a medical diagnosis. Consult a qualified healthcare professional for medical advice.
        </span>
      </div>
    );
  }

  return (
    <aside 
      id="medical-disclaimer-banner"
      aria-label="Clinical Decision-Support Notice"
      className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs md:text-sm text-slate-700"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 bg-amber-100 rounded text-amber-800 shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-slate-900">Clinical Decision-Support Disclaimer</h4>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100/80 text-amber-900 px-2 py-0.5 rounded">
              <ShieldCheck className="w-3 h-3" /> GINA & ATS Aligned
            </span>
          </div>
          <p className="leading-relaxed text-slate-600">
            This system is an experimental decision-support instrument designed to fuse physiological, environmental, and self-reported signals to assess risk trends. It does not provide medical diagnoses, replace clinical spirometry, or prescribe medications. In case of acute breathlessness, chest pain, or emergency symptoms, seek immediate emergency medical care.
          </p>
        </div>
      </div>
    </aside>
  );
};
