import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  Info,
  Calendar,
  Layers,
  Cpu,
  TrendingUp,
  TrendingDown,
  Bot,
  Loader2,
  Stethoscope,
  TreePine
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MedicalDisclaimer } from './MedicalDisclaimer';
import { requestGeminiClinicalConsultation, GeminiConsultationResponse } from '../services/geminiClient';

export const ResultView: React.FC = () => {
  const { latestPrediction, setActiveTab, runPrediction, patient, currentSymptoms, currentSensors } = useApp();
  const [isConsultingGemini, setIsConsultingGemini] = useState<boolean>(false);
  const [geminiResponse, setGeminiResponse] = useState<GeminiConsultationResponse | null>(null);

  const handleRunGeminiConsultation = async () => {
    if (!latestPrediction) return;
    setIsConsultingGemini(true);
    try {
      const res = await requestGeminiClinicalConsultation(patient, currentSymptoms, currentSensors, latestPrediction);
      setGeminiResponse(res);
    } catch (err: any) {
      setGeminiResponse({
        available: false,
        error: err.message || 'Consultation request failed',
      });
    } finally {
      setIsConsultingGemini(false);
    }
  };

  if (!latestPrediction) {
    return (
      <div id="result-empty-state" className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-4 max-w-2xl mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">No Assessment Computed Yet</h2>
        <p className="text-sm text-slate-600">
          Complete a symptom check-in and capture IoT sensor telemetry to generate an explainable asthma risk evaluation.
        </p>
        <div className="pt-2">
          <button
            id="result-run-now-btn"
            onClick={() => {
              runPrediction();
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            Compute Assessment From Current Readings
          </button>
        </div>
      </div>
    );
  }

  const { risk_class, prob_low, prob_medium, prob_high, top_shap_features, recommendation, model_version, created_at, assembled_features } = latestPrediction;

  const getRiskDesign = () => {
    switch (risk_class) {
      case 'High':
        return {
          bannerBg: 'bg-red-50 border-red-200 text-red-900',
          badgeBg: 'bg-red-600 text-white',
          icon: AlertCircle,
          title: 'HIGH ASTHMA RISK',
          sub: 'Airway restriction and environmental/hypoxemic indicators require clinical caution.',
        };
      case 'Moderate':
        return {
          bannerBg: 'bg-amber-50 border-amber-200 text-amber-900',
          badgeBg: 'bg-amber-600 text-white',
          icon: AlertTriangle,
          title: 'MODERATE ASTHMA RISK (CAUTION ZONE)',
          sub: 'Elevated airway sensitivity detected; monitor symptoms and minimize environmental triggers.',
        };
      case 'Low':
      default:
        return {
          bannerBg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          badgeBg: 'bg-emerald-600 text-white',
          icon: ShieldCheck,
          title: 'LOW ASTHMA RISK (STABLE)',
          sub: 'Physiological vitals, spirometric airflow, and atmospheric air quality are well-controlled.',
        };
    }
  };

  const riskDesign = getRiskDesign();
  const RiskIcon = riskDesign.icon;

  return (
    <div id="result-view-container" className="space-y-6 max-w-4xl mx-auto">
      
      {/* Risk Badge Primary Header Card (Matching DESIGN.md §4 Sketch) */}
      <div className={`p-6 sm:p-8 rounded-2xl border-2 ${riskDesign.bannerBg} shadow-xs text-center space-y-4 relative overflow-hidden`}>
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-white shadow-xs mx-auto">
          <RiskIcon className="w-8 h-8 text-current" />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/80 border border-current/20 shadow-2xs">
            {riskDesign.title}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-2">
            Asthma Risk Classification: {risk_class}
          </h1>
          <p className="text-sm text-slate-700 max-w-xl mx-auto font-medium">
            {riskDesign.sub}
          </p>
        </div>

        {/* Multi-class Probability Bar Distribution */}
        <div className="max-w-md mx-auto pt-2 space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-700 px-1">
            <span>Low: {(prob_low * 100).toFixed(1)}%</span>
            <span>Moderate: {(prob_medium * 100).toFixed(1)}%</span>
            <span>High: {(prob_high * 100).toFixed(1)}%</span>
          </div>

          <div className="w-full h-3 bg-white rounded-full overflow-hidden flex border border-slate-300/80 shadow-inner">
            <div 
              style={{ width: `${Math.max(3, prob_low * 100)}%` }} 
              className="bg-emerald-500 h-full transition-all duration-500" 
              title={`Low: ${(prob_low * 100).toFixed(1)}%`}
            />
            <div 
              style={{ width: `${Math.max(3, prob_medium * 100)}%` }} 
              className="bg-amber-500 h-full transition-all duration-500" 
              title={`Moderate: ${(prob_medium * 100).toFixed(1)}%`}
            />
            <div 
              style={{ width: `${Math.max(3, prob_high * 100)}%` }} 
              className="bg-red-600 h-full transition-all duration-500" 
              title={`High: ${(prob_high * 100).toFixed(1)}%`}
            />
          </div>

          <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-center gap-2 pt-1.5">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white/70 px-2 py-0.5 rounded border border-slate-200">
              <TreePine className="w-3 h-3 text-emerald-700" />
              {latestPrediction.engine_type === 'trained_forest' ? 'Trained Decision Forest' : 'Clinical Guideline Rule Engine'}
            </span>
            {latestPrediction.tree_votes_count && (
              <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Votes: {latestPrediction.tree_votes_count.Low}L / {latestPrediction.tree_votes_count.Moderate}M / {latestPrediction.tree_votes_count.High}H
              </span>
            )}
            <span>•</span>
            <span>{new Date(created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* SHAP Feature Explainability Section (Why this result?) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Why? (SHAP Feature Attribution Breakdown)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Local Shapley values (φ) quantifying each feature&apos;s push toward higher risk vs protective stability.
            </p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-1 rounded border border-slate-200 self-start sm:self-auto">
            TreeExplainer Exact
          </span>
        </div>

        {/* SHAP Attributions Bar Visualizer */}
        <div className="space-y-3">
          {top_shap_features.map((item, idx) => {
            const isPushingRisk = item.impact > 0;
            const absImpact = Math.min(1.0, Math.abs(item.impact));
            const barWidthPercent = Math.max(8, Math.round(absImpact * 100));

            return (
              <div 
                key={idx} 
                id={`shap-factor-${idx}`}
                className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/70 space-y-2 hover:bg-slate-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    {isPushingRisk ? (
                      <TrendingUp className="w-4 h-4 text-red-600 shrink-0" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-900">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Value: <strong className="text-slate-800 font-mono">{item.value}</strong></span>
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                      isPushingRisk ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {item.impact > 0 ? `+${item.impact.toFixed(2)} Risk` : `${item.impact.toFixed(2)} Protective`}
                    </span>
                  </div>
                </div>

                {/* Relative Impact Progress Bar */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${barWidthPercent}%` }}
                    className={`h-full rounded-full ${
                      isPushingRisk ? 'bg-red-600' : 'bg-emerald-600'
                    }`}
                  />
                </div>

                <p className="text-xs text-slate-600 leading-relaxed pl-1">
                  {item.clinicalContext}
                </p>
              </div>
            );
          })}
        </div>

        {/* Explainability Summary Callout */}
        <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-slate-700 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-blue-950">How to interpret this explanation:</h4>
            <p className="text-slate-600 leading-relaxed">
              Features with <strong className="text-red-700">+Impact</strong> push your risk assessment higher. Features with <strong className="text-emerald-700">-Impact</strong> reflect normal, stabilizing metrics that protect against exacerbation. For instance, when ambient AQI is high, it heavily pushes the risk upwards unless buffered by strong expiratory flow (PEFR) and clear symptom scores.
            </p>
          </div>
        </div>
      </div>

      {/* Actionable Clinical Recommendations Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Personalized Actionable Guidance</h2>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
            recommendation.urgencyLevel === 'immediate_clinical_attention'
              ? 'bg-red-100 text-red-800'
              : recommendation.urgencyLevel === 'elevated_monitoring'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            {recommendation.urgencyLevel.replace(/_/g, ' ')}
          </span>
        </div>

        <p className="text-sm font-semibold text-slate-800 leading-relaxed">
          {recommendation.summary}
        </p>

        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Recommended Next Steps:</h3>
          <ul className="space-y-2">
            {recommendation.actions.map((act, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-snug">{act}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
          <span><strong>Monitoring Protocol:</strong> {recommendation.monitoringAdvice}</span>
        </div>
      </div>

      {/* Pulmonologist AI Clinical Consultation (Gemini 2.5 Flash Integration) */}
      <div id="gemini-consultation-section" className="bg-white p-6 rounded-xl border border-indigo-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Pulmonology AI Consultation Co-Pilot</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                  Gemini 2.5 Flash
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Server-side synthesized clinical reasoning synthesizing spirometry, vitals, environmental AQI, and GINA guidelines.
              </p>
            </div>
          </div>

          <button
            id="gemini-request-consultation-btn"
            type="button"
            onClick={handleRunGeminiConsultation}
            disabled={isConsultingGemini}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-all shadow-xs shrink-0 cursor-pointer"
          >
            {isConsultingGemini ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Consulting Gemini...</span>
              </>
            ) : (
              <>
                <Bot className="w-3.5 h-3.5" />
                <span>{geminiResponse ? 'Regenerate Consultation' : 'Generate Clinical Consultation'}</span>
              </>
            )}
          </button>
        </div>

        {geminiResponse ? (
          <div className="space-y-3">
            {geminiResponse.available && geminiResponse.consultation ? (
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-4 text-xs text-slate-800 space-y-3 leading-relaxed">
                <div className="whitespace-pre-line font-sans text-slate-700">
                  {geminiResponse.consultation}
                </div>
                <div className="pt-2 border-t border-indigo-100 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Synthesized via secure server-side Gemini API gateway</span>
                  <span className="font-mono">{geminiResponse.model}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Gemini API Notice</span>
                </div>
                <p>{geminiResponse.error || 'The server-side Gemini consultation service is not currently configured.'}</p>
                <p className="text-amber-800">
                  To enable live AI pulmonologist evaluations, add your <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">GEMINI_API_KEY</code> in environment variables or your hosting provider settings.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            Click &quot;Generate Clinical Consultation&quot; above to request an autonomous second-opinion evaluation from the Gemini respiratory intelligence model.
          </p>
        )}
      </div>

      {/* Action Footer Navigation Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          id="result-new-checkin-btn"
          onClick={() => setActiveTab('checkin')}
          className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors w-full sm:w-auto justify-center shadow-2xs"
        >
          <RotateCcw className="w-4 h-4" />
          <span>New Symptom Check-in</span>
        </button>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            id="result-view-architecture-btn"
            onClick={() => setActiveTab('architecture')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Verify Model Pipeline</span>
          </button>

          <button
            type="button"
            id="result-save-history-btn"
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors"
          >
            <span>Save & View History</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mandatory Clinical Disclaimer */}
      <MedicalDisclaimer />

    </div>
  );
};
