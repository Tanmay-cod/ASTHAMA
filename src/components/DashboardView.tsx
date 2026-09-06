import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  Activity, 
  Wind, 
  Heart, 
  CloudRain, 
  ArrowRight, 
  Calendar,
  Sparkles,
  ClipboardList,
  Database,
  RefreshCw,
  Clock,
  FileText,
  Users,
  TrendingUp
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MedicalDisclaimer } from './MedicalDisclaimer';
import { calculatePredictedPefr } from '../utils/clinicalCalculations';

export const DashboardView: React.FC = () => {
  const { 
    patient, 
    latestPrediction, 
    predictionHistory, 
    currentSensors, 
    setActiveTab, 
    openReportModal,
    isEsp32Connected,
    isStreamingTelemetry,
    toggleTelemetryStream,
    fetchAndApplyLatestSupabaseReading
  } = useApp();

  // 5-second polling mechanism states
  const [isSupabasePolling, setIsSupabasePolling] = useState<boolean>(true);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [isFetchingPoll, setIsFetchingPoll] = useState<boolean>(false);
  const [pollError, setPollError] = useState<string | null>(null);

  const isPollingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Poll latest sensor reading from Supabase
  const executePoll = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    if (isMountedRef.current) setIsFetchingPoll(true);

    try {
      const res = await fetchAndApplyLatestSupabaseReading();
      if (isMountedRef.current) {
        if (res.success) {
          setLastPollTime(new Date());
          setPollError(null);
        } else if (res.error) {
          // Filter harmless empty table messages from distracting the user
          if (!res.error.toLowerCase().includes('0 rows') && !res.error.toLowerCase().includes('empty')) {
            setPollError(res.error);
          }
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setPollError(err.message || 'Poll failed');
      }
    } finally {
      isPollingRef.current = false;
      if (isMountedRef.current) {
        setIsFetchingPoll(false);
      }
    }
  }, [fetchAndApplyLatestSupabaseReading]);

  // 5-second interval polling mechanism for real-time sensor updates from Supabase
  useEffect(() => {
    isMountedRef.current = true;

    if (!isSupabasePolling) {
      return () => {
        isMountedRef.current = false;
      };
    }

    // Initial immediate fetch on mount or when polling is enabled
    executePoll();

    // 5000 ms (5 seconds) recurring polling cycle
    const intervalId = setInterval(() => {
      executePoll();
    }, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [isSupabasePolling, executePoll]);

  const pefrRef = calculatePredictedPefr(
    patient.age,
    patient.gender,
    patient.height_cm,
    currentSensors.pefr_lmin
  );

  const getRiskBadge = (riskClass?: 'Low' | 'Moderate' | 'High') => {
    switch (riskClass) {
      case 'High':
        return {
          bg: 'bg-red-50 border-red-200',
          text: 'text-red-700',
          badgeBg: 'bg-red-600 text-white',
          icon: AlertCircle,
          label: 'HIGH RISK',
          sub: 'Airway restriction / Hypoxemic indicators require prompt attention.',
        };
      case 'Moderate':
        return {
          bg: 'bg-amber-50 border-amber-200',
          text: 'text-amber-800',
          badgeBg: 'bg-amber-600 text-white',
          icon: AlertTriangle,
          label: 'MODERATE RISK',
          sub: 'Elevated sensitivity; monitor airway triggers and follow care plan.',
        };
      case 'Low':
      default:
        return {
          bg: 'bg-emerald-50 border-emerald-200',
          text: 'text-emerald-800',
          badgeBg: 'bg-emerald-600 text-white',
          icon: ShieldCheck,
          label: 'LOW RISK',
          sub: 'Physiological parameters and ambient triggers are in the stable zone.',
        };
    }
  };

  const riskInfo = getRiskBadge(latestPrediction?.risk_class);
  const RiskIcon = riskInfo.icon;

  return (
    <div id="dashboard-view-container" className="space-y-6">
      
      {/* Top Patient Greeting & Quick Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Asthma Health Dashboard
            </h1>
            <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded-full">
              {patient.asthma_diagnosed ? 'Diagnosed Asthmatic' : 'Observation / At-Risk'}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Monitoring patient <strong className="text-slate-800">{patient.name}</strong> • Age: {patient.age} • Height: {patient.height_cm} cm
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="dashboard-open-report-btn"
            onClick={() => openReportModal(patient.id)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Generate comprehensive Clinical Report"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Report</span>
          </button>

          <button
            id="dashboard-goto-patients-btn"
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium rounded-lg transition-colors border border-slate-200 cursor-pointer"
            title="Manage Patient Registry"
          >
            <Users className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Patients</span>
          </button>

          <button
            id="dashboard-new-checkin-btn"
            onClick={() => setActiveTab('checkin')}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" />
            <span>New Check-in</span>
          </button>
          <button
            id="dashboard-goto-sensors-btn"
            onClick={() => setActiveTab('sensor')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-medium rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            <Activity className="w-4 h-4 text-blue-600" />
            <span>Live Sensors</span>
          </button>
        </div>
      </div>

      {/* Main Risk Status Card */}
      <div className={`p-6 rounded-xl border ${riskInfo.bg} shadow-xs relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold tracking-wide ${riskInfo.badgeBg}`}>
                <RiskIcon className="w-3.5 h-3.5" />
                {riskInfo.label}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {latestPrediction ? new Date(latestPrediction.created_at).toLocaleString() : 'Just now'}
              </span>
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              {latestPrediction?.recommendation.summary || riskInfo.sub}
            </h2>

            {latestPrediction && (
              <div className="flex items-center gap-4 text-xs font-medium text-slate-700 pt-1">
                <span>Class Probabilities:</span>
                <span className="text-emerald-700">Low: {(latestPrediction.prob_low * 100).toFixed(1)}%</span>
                <span className="text-amber-700">Moderate: {(latestPrediction.prob_medium * 100).toFixed(1)}%</span>
                <span className="text-red-700">High: {(latestPrediction.prob_high * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <button
              id="dashboard-view-shap-btn"
              onClick={() => setActiveTab('result')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-900 font-semibold text-xs sm:text-sm rounded-lg border border-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Inspect SHAP Explanation</span>
            </button>
            <button
              id="dashboard-view-analytics-btn"
              onClick={() => setActiveTab('analytics')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Clinical Analytics</span>
            </button>
            <button
              id="dashboard-view-trends-btn"
              onClick={() => setActiveTab('history')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <span>History Logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Cloud Live Polling Bar (5s Real-Time Updates) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:px-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isSupabasePolling && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSupabasePolling ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            </span>
            <div className="flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800">Supabase Cloud Stream:</span>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              isSupabasePolling 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {isSupabasePolling ? '5s Polling Active' : 'Polling Paused'}
            </span>
          </div>

          <span className="hidden md:inline text-slate-300">•</span>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {lastPollTime 
                ? `Last update: ${lastPollTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` 
                : 'Initial fetch in progress...'}
            </span>
            {isFetchingPoll && (
              <span className="text-[10px] font-medium text-blue-600 flex items-center gap-1 ml-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Polling...</span>
              </span>
            )}
          </div>

          {pollError && (
            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {pollError}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            id="dashboard-manual-poll-btn"
            onClick={executePoll}
            disabled={isFetchingPoll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer border border-slate-200"
            title="Fetch latest reading from Supabase immediately"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingPoll ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
            <span>Sync Now</span>
          </button>

          <button
            id="dashboard-toggle-polling-btn"
            onClick={() => setIsSupabasePolling(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              isSupabasePolling 
                ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
            }`}
          >
            {isSupabasePolling ? 'Pause 5s Stream' : 'Resume 5s Stream'}
          </button>
        </div>
      </div>

      {/* Primary Key Metrics 4-Box Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* PEFR Metric */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Expiratory Flow (PEFR)</span>
            <Wind className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{currentSensors.pefr_lmin}</span>
            <span className="text-xs text-slate-500">L/min</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">Nunn & Gregg Ref:</span>
            <span className={`font-semibold ${
              pefrRef.clinicalZone === 'red' ? 'text-red-600' : pefrRef.clinicalZone === 'yellow' ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {pefrRef.pefrPercent}% of {pefrRef.predictedPefr} L/min
            </span>
          </div>
        </div>

        {/* SpO2 Metric */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Blood Oxygen (SpO₂)</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${currentSensors.spo2 < 92 ? 'text-red-600' : 'text-slate-900'}`}>
              {currentSensors.spo2}%
            </span>
            <span className="text-xs text-slate-500">MAX30102</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">Oxygenation Status:</span>
            <span className={`font-semibold ${
              currentSensors.isFingerDetected === false
                ? 'text-amber-600'
                : currentSensors.spo2 < 92 ? 'text-red-600' : 'text-emerald-600'
            }`}>
              {currentSensors.isFingerDetected === false
                ? 'Finger Off Sensor'
                : currentSensors.spo2 < 92 ? 'Hypoxemic Alert' : currentSensors.spo2 < 95 ? 'Borderline' : 'Normal'}
            </span>
          </div>
        </div>

        {/* Heart Rate Metric */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pulse Rate (HR)</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{currentSensors.heart_rate}</span>
            <span className="text-xs text-slate-500">bpm</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">Autonomic Rhythm:</span>
            <span className={`font-semibold ${currentSensors.heart_rate > 100 ? 'text-amber-600' : 'text-slate-700'}`}>
              {currentSensors.heart_rate > 100 ? 'Tachycardia' : 'Regular Resting'}
            </span>
          </div>
        </div>

        {/* AQI / Particulate Metric */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Air Quality Index (AQI)</span>
            <CloudRain className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${
              currentSensors.aqi > 200 ? 'text-red-600' : currentSensors.aqi > 100 ? 'text-amber-600' : 'text-slate-900'
            }`}>
              {currentSensors.aqi}
            </span>
            <span className="text-xs text-slate-500">PM2.5: {currentSensors.pm25_est} µg/m³</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">CPCB Category:</span>
            <span className="font-semibold text-slate-800">
              {currentSensors.aqi <= 50 ? 'Good' : currentSensors.aqi <= 100 ? 'Satisfactory' : currentSensors.aqi <= 200 ? 'Moderate' : 'Poor/Severe'}
            </span>
          </div>
        </div>

      </div>

      {/* IoT Telemetry Strip & Hardware Quick Control */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">NodeMCU ESP8266 / ESP32 Sensor Rig:</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                isEsp32Connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {isEsp32Connected ? (isStreamingTelemetry ? 'Streaming Active (2.5s cycle)' : 'Connected - Telemetry Active') : 'Offline'}
              </span>
              {currentSensors.isFingerDetected === false && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  Finger Off Sensor
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Source: <span className="font-mono text-slate-700 font-medium">{currentSensors.source}</span> • Temp: {currentSensors.temperature_c}°C • Humidity: {currentSensors.humidity_pct}% • Dust: {currentSensors.dust_density_mgm3} mg/m³
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEsp32Connected && (
            <button
              id="dashboard-stream-toggle-action"
              onClick={toggleTelemetryStream}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                isStreamingTelemetry
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isStreamingTelemetry ? 'Pause Telemetry Stream' : 'Start Live Telemetry Stream'}
            </button>
          )}
          <button
            id="dashboard-open-sensor-details-btn"
            onClick={() => setActiveTab('sensor')}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-md transition-colors"
          >
            Adjust Sensors / Presets
          </button>
        </div>
      </div>

      {/* Recent Historical Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Risk Predictions</h3>
            <p className="text-xs text-slate-500">Historical sequence of patient telemetry & explainable evaluations</p>
          </div>
          <button
            id="dashboard-view-all-history-btn"
            onClick={() => setActiveTab('history')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            View Complete Log ({predictionHistory.length})
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {predictionHistory.slice(0, 3).map((item) => (
            <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
              <div className="flex items-start sm:items-center gap-3">
                <span
                  className={`px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wider shrink-0 ${
                    item.risk_class === 'High'
                      ? 'bg-red-100 text-red-700'
                      : item.risk_class === 'Moderate'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.risk_class} Risk
                </span>
                <div>
                  <div className="text-xs font-medium text-slate-800 line-clamp-1">
                    {item.recommendation.summary}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                    <span>PEFR: {item.assembled_features.pefr_pct_pred}% pred</span>
                    <span>SpO₂: {item.assembled_features.spo2}%</span>
                    <span>AQI: {item.assembled_features.aqi}</span>
                    <span>Symptoms: {item.assembled_features.symptom_score}/10</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs text-slate-400">
                  {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {predictionHistory.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No predictions recorded yet. Run a symptom check-in and sensor reading to generate your first assessment.
            </div>
          )}
        </div>
      </div>

      {/* Persistent Clinical Disclaimer */}
      <MedicalDisclaimer />

    </div>
  );
};
