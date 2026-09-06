import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  FileText,
  User,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Wind,
  Activity,
  Calendar,
  Sparkles,
  MapPin,
  Heart,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { generatePatientClinicalReport, formatReportAsMarkdown } from '../utils/reportGenerator';
import { PRESET_PATIENTS } from '../data/patientProfiles';

interface ClinicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPatientId?: string;
}

export const ClinicalReportModal: React.FC<ClinicalReportModalProps> = ({
  isOpen,
  onClose,
  initialPatientId,
}) => {
  const {
    patients,
    patient: activePatient,
    currentSensors,
    currentSymptoms,
    latestPrediction,
    predictionHistory,
    showToast,
    getPatientData,
  } = useApp();

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || activePatient.id
  );
  const [copied, setCopied] = useState<boolean>(false);

  // Sync selected patient if initialPatientId changes
  React.useEffect(() => {
    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    } else {
      setSelectedPatientId(activePatient.id);
    }
  }, [initialPatientId, activePatient.id, isOpen]);

  // Target patient object
  const targetPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || activePatient;
  }, [patients, selectedPatientId, activePatient]);

  // Target patient package or custom data
  const reportData = useMemo(() => {
    // If active patient is the target, use current live state
    if (targetPatient.id === activePatient.id) {
      const preset = PRESET_PATIENTS.find((p) => p.patient.id === targetPatient.id);
      return generatePatientClinicalReport(
        targetPatient,
        currentSymptoms,
        currentSensors,
        latestPrediction,
        preset?.location
      );
    }

    // Otherwise retrieve stored patient specific data or preset data
    const patientSpecific = getPatientData ? getPatientData(targetPatient.id) : null;
    const preset = PRESET_PATIENTS.find((p) => p.patient.id === targetPatient.id);

    const sensors = patientSpecific?.sensors || preset?.defaultSensors || currentSensors;
    const symptoms = patientSpecific?.symptoms || preset?.defaultSymptoms || currentSymptoms;
    const prediction = patientSpecific?.history?.[0] || null;

    return generatePatientClinicalReport(
      targetPatient,
      symptoms,
      sensors,
      prediction,
      preset?.location
    );
  }, [targetPatient, activePatient.id, currentSymptoms, currentSensors, latestPrediction, getPatientData]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    try {
      const md = formatReportAsMarkdown(reportData);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      showToast('Clinical report copied to clipboard.', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      showToast('Could not copy to clipboard.', 'error');
    }
  };

  const handleDownload = () => {
    const md = formatReportAsMarkdown(reportData);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Clinical_Report_${targetPatient.name.replace(/\s+/g, '_')}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded clinical report as Markdown document.', 'success');
  };

  const zoneColor =
    reportData.spirometry.zone === 'green'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
      : reportData.spirometry.zone === 'yellow'
      ? 'bg-amber-50 text-amber-900 border-amber-300'
      : 'bg-red-50 text-red-900 border-red-300';

  const riskBadgeColor =
    reportData.riskAssessment.riskClass === 'High'
      ? 'bg-red-600 text-white'
      : reportData.riskAssessment.riskClass === 'Moderate'
      ? 'bg-amber-600 text-white'
      : 'bg-emerald-600 text-white';

  return (
    <div
      id="clinical-report-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="clinical-report-dialog"
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Top Control Bar (Hidden during printing) */}
        <div className="print:hidden flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Patient Pulmonary & Telemetry Clinical Report
              </h2>
              <p className="text-[11px] text-slate-400">
                Official Clinical Summary • Nunn & Gregg (1989) Spirometric Standard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Patient Selector within Report */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <select
                id="report-patient-select"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="text-xs bg-transparent text-slate-200 font-semibold focus:outline-hidden cursor-pointer"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                    {p.name} ({p.age}{p.gender === 'female' ? 'F' : 'M'})
                  </option>
                ))}
              </select>
            </div>

            <button
              id="report-print-btn"
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              title="Print document or save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              id="report-download-btn"
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700 cursor-pointer"
              title="Download text report"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export MD</span>
            </button>

            <button
              id="report-copy-btn"
              onClick={handleCopy}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 cursor-pointer"
              title="Copy markdown text to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              id="report-close-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1 cursor-pointer"
              title="Close report modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Document Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800 font-sans print:p-0 print:overflow-visible">
          
          {/* Official Letterhead Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
            <div>
              <div className="flex items-center gap-2 text-blue-700 font-black tracking-tight text-lg sm:text-xl">
                <Wind className="w-6 h-6 text-blue-600" />
                <span>{reportData.clinicName}</span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Division of Pulmonary Medicine & Digital IoT Health Telemetry
              </p>
              <p className="text-[11px] text-slate-400">
                Accredited Reference Lab • Nunn & Gregg (1989) Spirometric Standard
              </p>
            </div>

            <div className="text-left sm:text-right text-xs space-y-0.5">
              <div className="font-mono text-slate-500 text-[11px]">
                Report ID: <span className="font-bold text-slate-900">{reportData.reportId}</span>
              </div>
              <div className="text-slate-600 text-[11px]">
                Generated: <strong>{new Date(reportData.generatedAt).toLocaleString()}</strong>
              </div>
              <div className="text-slate-600 text-[11px]">
                Attending: <strong>{reportData.doctorName}</strong>
              </div>
            </div>
          </div>

          {/* Section 1: Patient Demographics & Profile */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  1. Patient Demographics & Anthropometrics
                </h3>
              </div>
              {reportData.location && (
                <div className="flex items-center gap-1 text-xs text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span>{reportData.location}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Full Name</span>
                <span className="font-bold text-slate-900 text-sm">{reportData.patient.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Age & Biological Sex</span>
                <span className="font-semibold text-slate-800">
                  {reportData.patient.age} yrs • {reportData.patient.gender.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Height & Weight</span>
                <span className="font-semibold text-slate-800">
                  {reportData.patient.height_cm} cm • {reportData.patient.weight_kg} kg
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Body Mass Index (BMI)</span>
                <span className="font-semibold text-slate-800">
                  {reportData.bmi.value} kg/m² ({reportData.bmi.category})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1 border-t border-slate-200/60">
              <div>
                <span className="text-slate-400 block text-[11px]">Asthma Diagnosis</span>
                <span className={`font-semibold ${reportData.patient.asthma_diagnosed ? 'text-red-700' : 'text-slate-700'}`}>
                  {reportData.patient.asthma_diagnosed ? 'Confirmed Diagnosis' : 'Observation / At-Risk'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Smoking Status</span>
                <span className="font-semibold text-slate-800">
                  {reportData.patient.smoking ? 'Active / Former Smoker' : 'Non-Smoker'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Family History</span>
                <span className="font-semibold text-slate-800">
                  {reportData.patient.family_history_asthma ? 'Positive (1st Degree)' : 'Negative'}
                </span>
              </div>
            </div>

            {reportData.patient.medication && (
              <div className="text-xs pt-1 bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  Current Inhalers & Maintenance Therapy:
                </span>
                <span className="text-slate-800 font-medium">{reportData.patient.medication}</span>
              </div>
            )}
          </div>

          {/* Section 2: Pulmonary Function & PEFR Spirometry */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                2. Spirometric Pulmonary Assessment (Peak Expiratory Flow)
              </h3>
            </div>

            <div className={`p-4 rounded-xl border ${zoneColor} space-y-3`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Asthma Action Plan Zone:</span>
                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-white/80 border shadow-2xs">
                      {reportData.spirometry.zone} Zone ({reportData.spirometry.percentPredicted}%)
                    </span>
                  </div>
                  <p className="text-xs mt-1 font-medium">{reportData.spirometry.interpretation}</p>
                </div>

                <div className="flex items-center gap-4 text-right shrink-0">
                  <div className="bg-white/90 p-2.5 rounded-lg border text-center min-w-[100px]">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Measured PEFR</span>
                    <span className="text-xl font-black text-slate-900">{reportData.spirometry.measuredPefr}</span>
                    <span className="text-[10px] text-slate-400 block">L/min</span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-lg border text-center min-w-[100px]">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Predicted (Nunn)</span>
                    <span className="text-xl font-black text-blue-700">{reportData.spirometry.predictedPefr}</span>
                    <span className="text-[10px] text-slate-400 block">L/min</span>
                  </div>
                </div>
              </div>

              {/* Visual Zone Bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-red-500 h-full w-[50%]" title="Red Zone (<50%)" />
                <div className="bg-amber-400 h-full w-[30%]" title="Yellow Zone (50-80%)" />
                <div className="bg-emerald-500 h-full w-[20%]" title="Green Zone (>=80%)" />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Red Zone &lt;50%)</span>
                <span>50% (Yellow 50-80%)</span>
                <span>80% (Green &ge;80%)</span>
                <span>100%+</span>
              </div>
            </div>
          </div>

          {/* Section 3: Physiological Vitals & Environmental Matrix */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                3. Real-Time Physiological Vitals & Environmental Telemetry
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 font-semibold block">Blood Oxygen (SpO₂)</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">
                  {reportData.vitals.spo2}
                  <span className="text-xs font-normal text-slate-500 ml-0.5">%</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded inline-block mt-1 ${
                  reportData.vitals.spo2 >= 95 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {reportData.vitals.spo2 >= 95 ? 'Normal (≥95%)' : 'Caution / Low'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 font-semibold block">Pulse Rate</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">
                  {reportData.vitals.heartRate}
                  <span className="text-xs font-normal text-slate-500 ml-0.5">bpm</span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">Normal Resting: 60-100</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 font-semibold block">Air Quality Index</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">
                  {reportData.vitals.aqi}
                  <span className="text-xs font-normal text-slate-500 ml-0.5">AQI</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded inline-block mt-1 ${
                  reportData.vitals.aqi <= 50
                    ? 'bg-emerald-50 text-emerald-700'
                    : reportData.vitals.aqi <= 100
                    ? 'bg-blue-50 text-blue-700'
                    : reportData.vitals.aqi <= 150
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {reportData.vitals.aqi <= 50 ? 'Good' : reportData.vitals.aqi <= 100 ? 'Satisfactory' : reportData.vitals.aqi <= 150 ? 'Moderate' : 'Poor / Unhealthy'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 font-semibold block">Ambient Climate</span>
                <div className="text-lg font-bold text-slate-900 mt-0.5">
                  {reportData.vitals.temperatureC}°C • {reportData.vitals.humidityPct}%
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  PM2.5: {reportData.vitals.pm25Est} µg/m³
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Symptom Assessment Log */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  4. Reported Symptoms & Check-in
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                Symptom Score: {reportData.symptoms.totalScore} / 10
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">COUGH</span>
                <span className="font-bold text-slate-800">{reportData.symptoms.cough}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">WHEEZING</span>
                <span className="font-bold text-slate-800">{reportData.symptoms.wheezing}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">BREATHLESSNESS</span>
                <span className="font-bold text-slate-800">{reportData.symptoms.shortnessOfBreath}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">CHEST TIGHTNESS</span>
                <span className="font-bold text-slate-800">{reportData.symptoms.chestTightness}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[10px] font-semibold">NIGHT AWAKENINGS</span>
                <span className="font-bold text-slate-800">{reportData.symptoms.nightCough}</span>
              </div>
            </div>

            {reportData.symptoms.notes && (
              <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 italic">
                "{reportData.symptoms.notes}"
              </p>
            )}
          </div>

          {/* Section 5: Multi-Factor Risk Assessment & SHAP */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  5. Multi-Factor Risk Classification & Key Drivers
                </h3>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${riskBadgeColor}`}>
                {reportData.riskAssessment.riskClass.toUpperCase()} RISK
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Model Confidence:</span>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-700">Low: {reportData.riskAssessment.probLow}%</span>
                  <span className="text-amber-700">Mod: {reportData.riskAssessment.probMedium}%</span>
                  <span className="text-red-700">High: {reportData.riskAssessment.probHigh}%</span>
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                  Top Physiological & Environmental Contributing Drivers (SHAP Analysis):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {reportData.riskAssessment.topFactors.slice(0, 3).map((factor, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-800">{factor.label}</span>
                        <span className="text-blue-700">{factor.value}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{factor.clinicalContext}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Clinical Recommendations & Evidence-Based Action Plan */}
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-950 uppercase tracking-wide">
                6. Pulmonologist Recommendations & Action Plan
              </h3>
              <span className="text-xs font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                {reportData.riskAssessment.urgencyLevel}
              </span>
            </div>

            <p className="text-xs font-medium text-slate-800">
              {reportData.riskAssessment.recommendationSummary}
            </p>

            <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
              {reportData.riskAssessment.actionItems.map((item, idx) => (
                <li key={idx} className="font-medium">
                  {item}
                </li>
              ))}
            </ul>

            <div className="text-[11px] text-blue-900 bg-white/80 p-2 rounded border border-blue-200/80">
              <strong>Follow-up & Monitoring: </strong>
              <span>{reportData.riskAssessment.monitoringAdvice}</span>
            </div>
          </div>

          {/* Official Sign-off and Disclaimer */}
          <div className="pt-4 border-t border-slate-300 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs">
            <div className="max-w-md text-[10px] text-slate-400 space-y-1">
              <p>
                <strong>Clinical Telehealth Notice:</strong> This report is generated by a decision-support system referencing Nunn & Gregg (1989) normative regression equations and calibrated IoT spirometry/environmental sensors. It is designed to assist clinical judgment and does not replace diagnostic spirometry performed in an accredited pulmonary function laboratory.
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="h-10 border-b border-dashed border-slate-400 w-48 ml-auto flex items-end justify-center">
                <span className="text-[11px] text-blue-900 font-serif italic">Dr. S. K. Kulkarni</span>
              </div>
              <span className="text-[11px] font-bold text-slate-800 block">
                {reportData.doctorName}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Reg. No. MCI-49218 • Pulmonary Medicine
              </span>
            </div>
          </div>

        </div>

        {/* Modal Footer Controls (Hidden on print) */}
        <div className="print:hidden px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Viewing report for <strong>{targetPatient.name}</strong> • Document ID: {reportData.reportId}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
