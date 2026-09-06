import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Activity, 
  Wind, 
  CloudRain, 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  FileText, 
  Download, 
  Users, 
  User, 
  ArrowUpRight, 
  ArrowDownRight, 
  BarChart3, 
  Filter, 
  CheckCircle2, 
  ChevronRight,
  Sparkles,
  Heart,
  Gauge,
  Info,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { useApp } from '../context/AppContext';
import { calculatePredictedPefr } from '../utils/clinicalCalculations';
import { Patient, RiskLevel } from '../types';

export const AnalyticsView: React.FC = () => {
  const {
    patient: activePatient,
    patients,
    activePatientId,
    switchPatient,
    getPatientData,
    predictionHistory,
    openReportModal,
    showToast,
    exportData
  } = useApp();

  const [viewMode, setViewMode] = useState<'individual' | 'cohort'>('individual');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(activePatientId);
  const [timeRange, setTimeRange] = useState<'all' | '7d' | '48h'>('all');
  const [activeMetricTab, setActiveMetricTab] = useState<'all' | 'pulmonary' | 'vitals' | 'environment' | 'risk'>('all');
  const [showZoneBands, setShowZoneBands] = useState<boolean>(true);

  // Resolved selected patient
  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === selectedPatientId) || activePatient;
  }, [patients, selectedPatientId, activePatient]);

  // Retrieve data for the selected patient
  const patientData = useMemo(() => {
    if (selectedPatientId === activePatientId) {
      return {
        history: predictionHistory,
        currentPatient: activePatient
      };
    }
    const retrieved = getPatientData(selectedPatientId);
    return {
      history: retrieved?.history || [],
      currentPatient: selectedPatient
    };
  }, [selectedPatientId, activePatientId, predictionHistory, activePatient, getPatientData, selectedPatient]);

  // Filter history chronologically (oldest to newest) & by time range
  const filteredChronologicalHistory = useMemo(() => {
    const raw = [...patientData.history].reverse(); // reverse so oldest is first
    if (raw.length === 0) return [];

    const now = new Date().getTime();
    if (timeRange === '48h') {
      const cutoff = now - 48 * 3600 * 1000;
      return raw.filter(item => new Date(item.created_at).getTime() >= cutoff);
    }
    if (timeRange === '7d') {
      const cutoff = now - 7 * 24 * 3600 * 1000;
      return raw.filter(item => new Date(item.created_at).getTime() >= cutoff);
    }
    return raw;
  }, [patientData.history, timeRange]);

  // Calculate predicted baseline for selected patient
  const predictedBaseline = useMemo(() => {
    return calculatePredictedPefr(
      selectedPatient.age,
      selectedPatient.gender,
      selectedPatient.height_cm
    );
  }, [selectedPatient]);

  // Chart data points
  const timeSeriesData = useMemo(() => {
    return filteredChronologicalHistory.map((item, index) => {
      const date = new Date(item.created_at);
      const shortDate = `${date.getMonth() + 1}/${date.getDate()}`;
      const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      
      const pefr = item.assembled_features.pefr_pct_pred !== undefined 
        ? Math.round((item.assembled_features.pefr_pct_pred / 100) * (item.predicted_pefr_reference || predictedBaseline.predictedPefr))
        : 450;
      const pefrPct = item.assembled_features.pefr_pct_pred || Math.round((pefr / predictedBaseline.predictedPefr) * 100);

      return {
        id: item.id,
        index: index + 1,
        timestamp: item.created_at,
        dateTimeLabel: `${shortDate} ${timeStr}`,
        dateLabel: shortDate,
        pefrMeasured: pefr,
        pefrPredicted: item.predicted_pefr_reference || predictedBaseline.predictedPefr,
        pefrPercent: pefrPct,
        spo2: item.assembled_features.spo2,
        heartRate: item.assembled_features.heart_rate,
        aqi: item.assembled_features.aqi,
        temperature: item.assembled_features.temperature_c,
        humidity: item.assembled_features.humidity_pct,
        symptomScore: item.assembled_features.symptom_score,
        probLow: Math.round(item.prob_low * 100),
        probMed: Math.round(item.prob_medium * 100),
        probHigh: Math.round(item.prob_high * 100),
        riskClass: item.risk_class,
        greenZoneFloor: Math.round((item.predicted_pefr_reference || predictedBaseline.predictedPefr) * 0.8),
        yellowZoneFloor: Math.round((item.predicted_pefr_reference || predictedBaseline.predictedPefr) * 0.5),
      };
    });
  }, [filteredChronologicalHistory, predictedBaseline]);

  // Summary Metrics & Clinical KPIs
  const kpiStats = useMemo(() => {
    if (timeSeriesData.length === 0) {
      return {
        count: 0,
        latestPefr: 0,
        latestPefrPct: 0,
        avgPefr: 0,
        pefrVariabilityPct: 0,
        avgSpo2: 0,
        minSpo2: 0,
        desaturationCount: 0,
        avgAqi: 0,
        maxAqi: 0,
        avgSymptoms: 0,
        highRiskSessions: 0,
        latestRisk: 'Low' as RiskLevel
      };
    }

    const pefrs = timeSeriesData.map(d => d.pefrMeasured);
    const spo2s = timeSeriesData.map(d => d.spo2);
    const aqis = timeSeriesData.map(d => d.aqi);
    const symptoms = timeSeriesData.map(d => d.symptomScore);
    const risks = timeSeriesData.map(d => d.riskClass);

    const minPefr = Math.min(...pefrs);
    const maxPefr = Math.max(...pefrs);
    const avgPefr = Math.round(pefrs.reduce((a, b) => a + b, 0) / pefrs.length);
    const pefrVariabilityPct = avgPefr > 0 ? Math.round(((maxPefr - minPefr) / avgPefr) * 100) : 0;

    const avgSpo2 = Number((spo2s.reduce((a, b) => a + b, 0) / spo2s.length).toFixed(1));
    const minSpo2 = Math.min(...spo2s);
    const desaturationCount = spo2s.filter(s => s < 94).length;

    const avgAqi = Math.round(aqis.reduce((a, b) => a + b, 0) / aqis.length);
    const maxAqi = Math.max(...aqis);

    const avgSymptoms = Number((symptoms.reduce((a, b) => a + b, 0) / symptoms.length).toFixed(1));
    const highRiskSessions = risks.filter(r => r === 'High').length;
    const latestRisk = risks[risks.length - 1] || 'Low';

    const latest = timeSeriesData[timeSeriesData.length - 1];

    return {
      count: timeSeriesData.length,
      latestPefr: latest.pefrMeasured,
      latestPefrPct: latest.pefrPercent,
      avgPefr,
      pefrVariabilityPct,
      avgSpo2,
      minSpo2,
      desaturationCount,
      avgAqi,
      maxAqi,
      avgSymptoms,
      highRiskSessions,
      latestRisk
    };
  }, [timeSeriesData]);

  // SHAP Feature Driver Frequency for this patient
  const shapDrivers = useMemo(() => {
    const counts: Record<string, { label: string; count: number; totalImpact: number }> = {};
    filteredChronologicalHistory.forEach(item => {
      (item.top_shap_features || []).forEach(feat => {
        if (feat.direction === 'increases_risk') {
          if (!counts[feat.feature]) {
            counts[feat.feature] = { label: feat.label, count: 0, totalImpact: 0 };
          }
          counts[feat.feature].count += 1;
          counts[feat.feature].totalImpact += feat.impact;
        }
      });
    });

    return Object.entries(counts)
      .map(([key, val]) => ({
        feature: key,
        label: val.label,
        frequency: val.count,
        avgImpact: Number((val.totalImpact / val.count).toFixed(2))
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 6);
  }, [filteredChronologicalHistory]);

  // Cohort Multi-Patient Comparison Data
  const cohortComparisonData = useMemo(() => {
    return patients.map(pat => {
      const data = pat.id === activePatientId 
        ? { history: predictionHistory } 
        : getPatientData(pat.id) || { history: [] };

      const hist = data.history || [];
      const predBaseline = calculatePredictedPefr(pat.age, pat.gender, pat.height_cm);
      
      let meanPefrPct = 0;
      let meanSpo2 = 98;
      let meanAqi = 60;
      let latestRisk: RiskLevel = 'Low';

      if (hist.length > 0) {
        const pefrPcts = hist.map(h => h.assembled_features.pefr_pct_pred || 85);
        meanPefrPct = Math.round(pefrPcts.reduce((a, b) => a + b, 0) / pefrPcts.length);
        const spo2s = hist.map(h => h.assembled_features.spo2 || 98);
        meanSpo2 = Number((spo2s.reduce((a, b) => a + b, 0) / spo2s.length).toFixed(1));
        const aqis = hist.map(h => h.assembled_features.aqi || 60);
        meanAqi = Math.round(aqis.reduce((a, b) => a + b, 0) / aqis.length);
        latestRisk = hist[0]?.risk_class || 'Low';
      } else {
        meanPefrPct = 95;
      }

      return {
        id: pat.id,
        name: pat.name,
        shortName: pat.name.split(' ')[0],
        age: pat.age,
        gender: pat.gender,
        asthmaDiagnosed: pat.asthma_diagnosed,
        smoking: pat.smoking,
        predictedPefrRef: predBaseline.predictedPefr,
        meanPefrPct,
        meanSpo2,
        meanAqi,
        latestRisk,
        sessionCount: hist.length,
        isCurrentActive: pat.id === activePatientId
      };
    });
  }, [patients, activePatientId, predictionHistory, getPatientData]);

  // Cohort Risk Breakdown Pie Chart Data
  const cohortRiskPieData = useMemo(() => {
    const counts = { Low: 0, Moderate: 0, High: 0 };
    cohortComparisonData.forEach(p => {
      counts[p.latestRisk] += 1;
    });
    return [
      { name: 'Low Risk', value: counts.Low, color: '#10B981' },
      { name: 'Moderate Risk', value: counts.Moderate, color: '#F59E0B' },
      { name: 'High Risk', value: counts.High, color: '#EF4444' },
    ].filter(item => item.value > 0);
  }, [cohortComparisonData]);

  // Export CSV for current patient analytics
  const handleExportAnalyticsCsv = () => {
    if (timeSeriesData.length === 0) {
      showToast('No time-series points available for export.', 'info');
      return;
    }

    const headers = [
      'Timestamp',
      'PEFR_Measured_Lmin',
      'PEFR_Predicted_Lmin',
      'PEFR_Percent_Predicted',
      'SpO2_Percent',
      'Heart_Rate_Bpm',
      'AQI',
      'Temperature_C',
      'Humidity_Pct',
      'Symptom_Score',
      'Prob_Low',
      'Prob_Moderate',
      'Prob_High',
      'Risk_Classification'
    ];

    const rows = timeSeriesData.map(d => [
      d.timestamp,
      d.pefrMeasured,
      d.pefrPredicted,
      d.pefrPercent,
      d.spo2,
      d.heartRate,
      d.aqi,
      d.temperature,
      d.humidity,
      d.symptomScore,
      d.probLow,
      d.probMed,
      d.probHigh,
      d.riskClass
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_${selectedPatient.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported clinical analytics CSV for ${selectedPatient.name}.`, 'success');
  };

  return (
    <div id="analytics-view-container" className="space-y-6">
      
      {/* View Header & Controls */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Clinical Trends & Telemetry Analytics
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Longitudinal pulmonary mechanics, cardiopulmonary dynamics, environmental trigger correlations, and cohort risk stratification using Recharts.
          </p>
        </div>

        {/* Top Control Bar: Mode Toggle & Global Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Individual vs Cohort View Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-semibold">
            <button
              id="analytics-toggle-individual"
              onClick={() => setViewMode('individual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'individual'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Patient Longitudinal</span>
            </button>
            <button
              id="analytics-toggle-cohort"
              onClick={() => setViewMode('cohort')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'cohort'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Cohort Comparative ({patients.length})</span>
            </button>
          </div>

          {/* Quick Actions */}
          <button
            id="analytics-btn-export-csv"
            onClick={handleExportAnalyticsCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            title="Download CSV for this patient"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            id="analytics-btn-clinical-report"
            onClick={() => openReportModal(selectedPatientId)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW MODE 1: INDIVIDUAL PATIENT LONGITUDINAL ANALYTICS */}
      {/* ========================================================= */}
      {viewMode === 'individual' && (
        <div className="space-y-6">
          
          {/* Patient Selection & Filter Bar */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="analytics-patient-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                <span>Selected Patient:</span>
              </label>
              <select
                id="analytics-patient-select"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="text-xs sm:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.age}y {p.gender}) {p.id === activePatientId ? '★ Active' : ''}
                  </option>
                ))}
              </select>

              {selectedPatientId !== activePatientId && (
                <button
                  id="analytics-btn-set-active-patient"
                  onClick={() => switchPatient(selectedPatientId)}
                  className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Make Active Patient
                </button>
              )}
            </div>

            {/* Time Filter & Zone Band Toggle */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[11px] px-1.5">Range:</span>
                {(['all', '7d', '48h'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      timeRange === range
                        ? 'bg-white text-blue-700 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {range === 'all' ? 'All Data' : range === '7d' ? 'Last 7 Days' : 'Last 48 Hours'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowZoneBands(prev => !prev)}
                className={`px-2.5 py-1.5 rounded-lg border transition-colors ${
                  showZoneBands
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {showZoneBands ? '✓ Asthma Action Bands' : 'Asthma Action Bands'}
              </button>
            </div>
          </div>

          {/* Patient Overview Banner */}
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-xl font-bold">{selectedPatient.name}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    kpiStats.latestRisk === 'High' 
                      ? 'bg-red-500 text-white' 
                      : kpiStats.latestRisk === 'Moderate' 
                      ? 'bg-amber-400 text-slate-900' 
                      : 'bg-emerald-400 text-slate-900'
                  }`}>
                    Latest: {kpiStats.latestRisk} Risk
                  </span>
                  {selectedPatient.asthma_diagnosed && (
                    <span className="text-[11px] font-semibold bg-blue-800 text-blue-200 px-2 py-0.5 rounded-full">
                      Asthma Diagnosed
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  {selectedPatient.age} years old • {selectedPatient.gender.toUpperCase()} • Height: {selectedPatient.height_cm} cm • Weight: {selectedPatient.weight_kg} kg • Predicted Baseline (Nunn & Gregg): <strong className="text-white">{predictedBaseline.predictedPefr} L/min</strong>
                </p>
                {selectedPatient.medication && (
                  <p className="text-[11px] text-blue-200 italic">
                    Rx: {selectedPatient.medication}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10 text-xs">
                <div>
                  <div className="text-[11px] text-slate-300">Telemetry Points</div>
                  <div className="text-lg font-bold text-white">{kpiStats.count} check-ins</div>
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div>
                  <div className="text-[11px] text-slate-300">Current PEFR</div>
                  <div className="text-lg font-bold text-white">
                    {kpiStats.latestPefr} <span className="text-xs font-normal text-slate-300">L/min ({kpiStats.latestPefrPct}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Clinical Metrics Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Card 1: PEFR Variability */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">PEFR Fluctuation</span>
                <Gauge className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{kpiStats.pefrVariabilityPct}%</span>
                <span className={`text-[11px] font-bold ${kpiStats.pefrVariabilityPct > 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {kpiStats.pefrVariabilityPct > 20 ? 'High Lability (>20%)' : 'Stable (<20%)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Mean: {kpiStats.avgPefr} L/min (Nunn Ref: {predictedBaseline.predictedPefr})
              </p>
            </div>

            {/* Card 2: Mean SpO2 */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Mean SpO2 Saturation</span>
                <Heart className="w-4 h-4 text-rose-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{kpiStats.avgSpo2}%</span>
                <span className={`text-[11px] font-bold ${kpiStats.minSpo2 < 94 ? 'text-red-600' : 'text-emerald-600'}`}>
                  Min: {kpiStats.minSpo2}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {kpiStats.desaturationCount > 0 
                  ? `${kpiStats.desaturationCount} reading(s) under 94% threshold`
                  : 'Zero hypoxemic desaturations observed'}
              </p>
            </div>

            {/* Card 3: Environmental AQI Exposure */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Mean AQI Exposure</span>
                <Wind className="w-4 h-4 text-teal-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{kpiStats.avgAqi}</span>
                <span className={`text-[11px] font-bold ${kpiStats.avgAqi > 100 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  Max: {kpiStats.maxAqi} AQI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {kpiStats.avgAqi > 100 ? 'Airway trigger alert: High particulate exposure' : 'Moderate / acceptable ambient exposure'}
              </p>
            </div>

            {/* Card 4: Symptom & Risk Load */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Symptom Burden</span>
                <Activity className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{kpiStats.avgSymptoms} / 10</span>
                <span className={`text-[11px] font-bold ${kpiStats.highRiskSessions > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {kpiStats.highRiskSessions} High-Risk sessions
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Cough, wheezing, dyspnea & nocturnal awakenings
              </p>
            </div>

          </div>

          {/* Metric Category Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
            {[
              { id: 'all', label: 'All Charts' },
              { id: 'pulmonary', label: 'Pulmonary Mechanics (PEFR)' },
              { id: 'vitals', label: 'Cardiopulmonary (SpO2 & HR)' },
              { id: 'environment', label: 'Environmental Triggers (AQI)' },
              { id: 'risk', label: 'Risk Probabilities & SHAP' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveMetricTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  activeMetricTab === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ============================================================== */}
          {/* CHART 1: PULMONARY MECHANICS (PEFR & NUNN & GREGG ZONES) */}
          {/* ============================================================== */}
          {(activeMetricTab === 'all' || activeMetricTab === 'pulmonary') && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span>Peak Expiratory Flow Rate (PEFR) vs. Nunn & Gregg Reference</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Longitudinal spirometry readings with Green (≥80%), Yellow (50–79%), and Red (&lt;50%) clinical asthma action plan zones.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                    <span className="font-semibold text-slate-700">Measured PEFR (L/min)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-slate-400 inline-block" />
                    <span className="text-slate-500">Nunn & Gregg Baseline ({predictedBaseline.predictedPefr})</span>
                  </div>
                </div>
              </div>

              <div className="h-72 sm:h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timeSeriesData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="dateTimeLabel" 
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={[
                        Math.max(100, Math.round(predictedBaseline.predictedPefr * 0.35)),
                        Math.round(predictedBaseline.predictedPefr * 1.25)
                      ]}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      unit=" L"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700">
                              <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 flex justify-between gap-4">
                                <span>{label}</span>
                                <span className="text-blue-400 font-semibold">{data.riskClass} Risk</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Measured PEFR:</span>
                                <span className="font-bold text-white">{data.pefrMeasured} L/min</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Predicted Baseline:</span>
                                <span>{data.pefrPredicted} L/min</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">% Predicted:</span>
                                <span className={`font-bold ${data.pefrPercent >= 80 ? 'text-emerald-400' : data.pefrPercent >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                  {data.pefrPercent}% ({data.pefrPercent >= 80 ? 'Green' : data.pefrPercent >= 50 ? 'Yellow' : 'Red'} Zone)
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* Action Plan Reference Lines */}
                    {showZoneBands && (
                      <>
                        <ReferenceLine 
                          y={Math.round(predictedBaseline.predictedPefr * 0.8)} 
                          stroke="#10B981" 
                          strokeDasharray="4 4" 
                          strokeWidth={1.5}
                          label={{ value: 'Green Zone Threshold (80%)', position: 'insideTopRight', fill: '#059669', fontSize: 10 }}
                        />
                        <ReferenceLine 
                          y={Math.round(predictedBaseline.predictedPefr * 0.5)} 
                          stroke="#EF4444" 
                          strokeDasharray="4 4" 
                          strokeWidth={1.5}
                          label={{ value: 'Red Zone Alert (<50%)', position: 'insideBottomRight', fill: '#DC2626', fontSize: 10 }}
                        />
                      </>
                    )}

                    {/* Predicted Baseline Reference Line */}
                    <ReferenceLine 
                      y={predictedBaseline.predictedPefr} 
                      stroke="#2563EB" 
                      strokeDasharray="3 3" 
                      strokeWidth={1.5}
                      label={{ value: `Predicted Baseline (${predictedBaseline.predictedPefr} L/min)`, position: 'insideTopLeft', fill: '#2563EB', fontSize: 10 }}
                    />

                    {/* Measured PEFR Area + Line */}
                    <Area 
                      type="monotone" 
                      dataKey="pefrMeasured" 
                      fill="#3B82F6" 
                      fillOpacity={0.15} 
                      stroke="none" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pefrMeasured" 
                      stroke="#2563EB" 
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#2563EB', strokeWidth: 2, stroke: '#FFFFFF' }}
                      activeDot={{ r: 6, fill: '#1D4ED8' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Zone Legend */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Green Zone (&ge;80% / &ge;{Math.round(predictedBaseline.predictedPefr * 0.8)} L/min): Controlled</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Yellow Zone (50-80%): Caution / Bronchospasm</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Red Zone (&lt;50%): Medical Emergency</span>
                  </span>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">
                  Nunn & Gregg (1989) Model
                </span>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CHART 2: CARDIOPULMONARY DYNAMICS (SPO2 & HEART RATE DUAL AXIS) */}
          {/* ============================================================== */}
          {(activeMetricTab === 'all' || activeMetricTab === 'vitals') && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500" />
                    <span>Cardiopulmonary Dynamics: Oxygen Saturation (SpO2) & Pulse Rate</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Dual-axis tracking correlates desaturation dips (&lt;94%) with compensatory tachycardia during asthma stress.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
                    <span>SpO2 Saturation (%) [Left Axis]</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-600">
                    <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                    <span>Heart Rate (BPM) [Right Axis]</span>
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="dateTimeLabel" 
                      tick={{ fontSize: 11, fill: '#64748B' }} 
                    />
                    {/* Left Axis: SpO2 */}
                    <YAxis 
                      yAxisId="left"
                      domain={[88, 100]} 
                      tick={{ fontSize: 11, fill: '#059669' }} 
                      unit="%"
                    />
                    {/* Right Axis: Heart Rate */}
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      domain={[50, 140]} 
                      tick={{ fontSize: 11, fill: '#E11D48' }} 
                      unit=" bpm"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                              <div className="font-bold text-slate-200 border-b border-slate-700 pb-1">{label}</div>
                              <div className="flex justify-between gap-4 text-emerald-400">
                                <span>SpO2 Saturation:</span>
                                <span className="font-bold">{data.spo2}%</span>
                              </div>
                              <div className="flex justify-between gap-4 text-rose-400">
                                <span>Heart Rate:</span>
                                <span className="font-bold">{data.heartRate} bpm</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-300">
                                <span>Temperature:</span>
                                <span>{data.temperature}°C (Hum: {data.humidity}%)</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* Desaturation Warning Line at 94% */}
                    <ReferenceLine 
                      yAxisId="left" 
                      y={94} 
                      stroke="#EF4444" 
                      strokeDasharray="4 4" 
                      strokeWidth={1.5}
                      label={{ value: 'Desaturation Alert (<94%)', position: 'insideBottomLeft', fill: '#EF4444', fontSize: 10 }}
                    />

                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="spo2" 
                      stroke="#059669" 
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#059669', strokeWidth: 2, stroke: '#FFFFFF' }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="heartRate" 
                      stroke="#E11D48" 
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={{ r: 3, fill: '#E11D48', strokeWidth: 2, stroke: '#FFFFFF' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CHART 3: ENVIRONMENTAL EXPOSURE & SYMPTOM CORRELATION */}
          {/* ============================================================== */}
          {(activeMetricTab === 'all' || activeMetricTab === 'environment') && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-teal-600" />
                    <span>Environmental Air Quality (AQI) vs. Patient Symptom Score</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Highlights airway sensitivity to particulate spikes (CPCB city_day AQI breakpoints vs. 0-10 composite symptom burden).
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <span className="w-3 h-3 bg-amber-400 rounded-sm inline-block" />
                    <span>Ambient AQI (Exposure)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-purple-600">
                    <span className="w-3 h-0.5 bg-purple-600 inline-block" />
                    <span>Symptom Score (0–10)</span>
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timeSeriesData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="dateTimeLabel" 
                      tick={{ fontSize: 11, fill: '#64748B' }} 
                    />
                    <YAxis 
                      yAxisId="left"
                      domain={[0, Math.max(150, kpiStats.maxAqi + 20)]} 
                      tick={{ fontSize: 11, fill: '#D97706' }} 
                      unit=" AQI"
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 10]} 
                      tick={{ fontSize: 11, fill: '#9333EA' }} 
                      unit="/10"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                              <div className="font-bold text-slate-200 border-b border-slate-700 pb-1">{label}</div>
                              <div className="flex justify-between gap-4 text-amber-400">
                                <span>Ambient AQI:</span>
                                <span className="font-bold">{data.aqi}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-purple-400">
                                <span>Symptom Score:</span>
                                <span className="font-bold">{data.symptomScore} / 10</span>
                              </div>
                              <div className="flex justify-between gap-4 text-blue-400">
                                <span>Peak Flow (PEFR):</span>
                                <span>{data.pefrMeasured} L/min ({data.pefrPercent}%)</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* Unhealthy AQI Reference Line */}
                    <ReferenceLine 
                      yAxisId="left" 
                      y={100} 
                      stroke="#F97316" 
                      strokeDasharray="3 3"
                      label={{ value: 'Unhealthy for Sensitive Groups (AQI > 100)', position: 'insideTopLeft', fill: '#F97316', fontSize: 10 }}
                    />

                    <Bar 
                      yAxisId="left" 
                      dataKey="aqi" 
                      radius={[4, 4, 0, 0]}
                    >
                      {timeSeriesData.map((entry, idx) => {
                        const color = entry.aqi > 200 ? '#EF4444' : entry.aqi > 100 ? '#F97316' : entry.aqi > 50 ? '#F59E0B' : '#10B981';
                        return <Cell key={`cell-${idx}`} fill={color} fillOpacity={0.8} />;
                      })}
                    </Bar>

                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="symptomScore" 
                      stroke="#9333EA" 
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#9333EA', strokeWidth: 2, stroke: '#FFFFFF' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CHART 4: RISK PROBABILITIES TRAJECTORY & SHAP DRIVERS */}
          {/* ============================================================== */}
          {(activeMetricTab === 'all' || activeMetricTab === 'risk') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Stacked Risk Trajectory */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Machine Learning Risk Class Probability Trajectory</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Stacked area representation of Random Forest predicted probabilities (Low, Moderate, High) over time.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Low</span>
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>Moderate</span>
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span>High</span>
                    </span>
                  </div>
                </div>

                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="dateTimeLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700">
                                <div className="font-bold text-slate-200 border-b border-slate-700 pb-1">{label}</div>
                                <div className="flex justify-between gap-4 text-emerald-400">
                                  <span>Prob(Low Risk):</span>
                                  <span className="font-bold">{data.probLow}%</span>
                                </div>
                                <div className="flex justify-between gap-4 text-amber-400">
                                  <span>Prob(Moderate Risk):</span>
                                  <span className="font-bold">{data.probMed}%</span>
                                </div>
                                <div className="flex justify-between gap-4 text-red-400">
                                  <span>Prob(High Risk):</span>
                                  <span className="font-bold">{data.probHigh}%</span>
                                </div>
                                <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                                  Classified: <strong className="text-white">{data.riskClass}</strong>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area type="monotone" dataKey="probLow" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.7} />
                      <Area type="monotone" dataKey="probMed" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.7} />
                      <Area type="monotone" dataKey="probHigh" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.7} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* SHAP Factor Attribution Frequency */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Top Risk Drivers (SHAP)</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Most frequent features driving elevated risk in {selectedPatient.name.split(' ')[0]}'s history.
                  </p>
                </div>

                {shapDrivers.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shapDrivers} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis 
                          dataKey="label" 
                          type="category" 
                          width={110}
                          tick={{ fontSize: 10, fill: '#334155' }} 
                        />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white p-2 rounded-lg text-xs shadow-md">
                                  <div className="font-bold text-purple-300">{d.label}</div>
                                  <div>Frequency: {d.frequency} sessions</div>
                                  <div>Avg SHAP Contribution: +{d.avgImpact}</div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="frequency" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No risk-increasing factors detected in current time range.
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-100 text-[11px] text-purple-900 leading-snug">
                  <strong>SHAP Explainability:</strong> TreeExplainer decomposes model output into additive local feature attributions.
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW MODE 2: COHORT COMPARATIVE ANALYTICS (ALL PATIENTS) */}
      {/* ========================================================= */}
      {viewMode === 'cohort' && (
        <div className="space-y-6">
          
          {/* Cohort Overview Card */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1 rounded bg-indigo-500/20 text-indigo-300">
                    <Users className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl font-bold">Registered Patient Cohort Comparative Analysis</h2>
                </div>
                <p className="text-xs text-slate-300 max-w-2xl">
                  Cross-sectional clinical comparison of pulmonary mechanics, blood oxygenation, environmental particulate burden, and predictive risk stratification across all {patients.length} registered profiles.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/10 text-xs">
                <div>
                  <div className="text-[11px] text-slate-300">Total Cohort</div>
                  <div className="text-xl font-extrabold text-white">{patients.length} Patients</div>
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div>
                  <div className="text-[11px] text-slate-300">Active Profile</div>
                  <div className="text-sm font-bold text-indigo-300">{activePatient.name}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Cohort Charts: 2 Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart A: Cohort Mean PEFR % Predicted */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span>Cohort Mean Peak Expiratory Flow (% of Predicted Baseline)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparing patient baseline control against 80% clinical threshold. Red indicates severe chronic airflow obstruction.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                  Target: &ge;80% Reference
                </span>
              </div>

              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohortComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="shortName" 
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis 
                      domain={[30, 120]} 
                      unit="%" 
                      tick={{ fontSize: 11, fill: '#64748B' }} 
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                              <div className="font-bold text-white border-b border-slate-700 pb-1">
                                {d.name} ({d.age}y {d.gender})
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Mean PEFR:</span>
                                <span className="font-bold text-blue-400">{d.meanPefrPct}% predicted</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Predicted Baseline:</span>
                                <span>{d.predictedPefrRef} L/min</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Current Risk:</span>
                                <span className={`font-semibold ${d.latestRisk === 'High' ? 'text-red-400' : d.latestRisk === 'Moderate' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {d.latestRisk}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* 80% Action Threshold Line */}
                    <ReferenceLine 
                      y={80} 
                      stroke="#10B981" 
                      strokeDasharray="4 4" 
                      strokeWidth={1.5}
                      label={{ value: 'Asthma Control Line (80%)', position: 'insideTopRight', fill: '#10B981', fontSize: 10 }}
                    />

                    <Bar dataKey="meanPefrPct" radius={[4, 4, 0, 0]}>
                      {cohortComparisonData.map((entry, index) => {
                        const color = entry.meanPefrPct >= 80 
                          ? '#10B981' 
                          : entry.meanPefrPct >= 50 
                          ? '#F59E0B' 
                          : '#EF4444';
                        return <Cell key={`bar-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart B: Cohort Risk Stratification Donut */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Cohort Risk Stratification</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Distribution of latest classified risk levels across the registered registry.
                </p>
              </div>

              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cohortRiskPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {cohortRiskPieData.map((entry, index) => (
                        <Cell key={`pie-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} Patients`, name]}
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                {cohortRiskPieData.map(item => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {item.value} ({Math.round((item.value / patients.length) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Cohort Clinical Directory Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Patient Cohort Telemetry Summary
                </h3>
                <p className="text-xs text-slate-500">
                  Click any row to switch individual analytics or generate a comprehensive clinical report.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-3">Demographics</th>
                    <th className="py-3 px-3">Nunn Predicted</th>
                    <th className="py-3 px-3">Mean PEFR %</th>
                    <th className="py-3 px-3">Mean SpO2</th>
                    <th className="py-3 px-3">Exposure (AQI)</th>
                    <th className="py-3 px-3">Risk Level</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {cohortComparisonData.map(p => (
                    <tr 
                      key={p.id}
                      className={`hover:bg-blue-50/50 transition-colors ${
                        p.isCurrentActive ? 'bg-blue-50/30 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        {p.name}
                        {p.isCurrentActive && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {p.age}y • {p.gender.toUpperCase()}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {p.predictedPefrRef} L/min
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-bold px-2 py-0.5 rounded-md ${
                          p.meanPefrPct >= 80 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : p.meanPefrPct >= 50 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {p.meanPefrPct}%
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        {p.meanSpo2}%
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-semibold ${p.meanAqi > 100 ? 'text-amber-600' : 'text-slate-700'}`}>
                          {p.meanAqi} AQI
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                          p.latestRisk === 'High' 
                            ? 'bg-red-100 text-red-700' 
                            : p.latestRisk === 'Moderate' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {p.latestRisk}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedPatientId(p.id);
                              setViewMode('individual');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                          >
                            Analytics
                          </button>
                          <button
                            onClick={() => openReportModal(p.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                            title="Generate Report"
                          >
                            Report
                          </button>
                          {!p.isCurrentActive && (
                            <button
                              onClick={() => switchPatient(p.id)}
                              className="px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Make this patient active"
                            >
                              Select
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
