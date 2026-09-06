import React, { useState } from 'react';
import { 
  Radio, 
  Activity, 
  Heart, 
  Wind, 
  Thermometer, 
  Droplets, 
  CloudRain, 
  Sparkles, 
  Info, 
  Terminal, 
  Sliders, 
  SlidersHorizontal,
  Bookmark,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Zap,
  Database,
  UploadCloud,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  calculatePredictedPefr, 
  validateSensorReadings, 
  CLINICAL_PRESETS,
  convertDustVoltageToPm25
} from '../utils/clinicalCalculations';
import { isWebSerialSupported, isRunningInIframe } from '../utils/webSerial';
import { MedicalDisclaimer } from './MedicalDisclaimer';

export const SensorReadingView: React.FC = () => {
  const { 
    patient, 
    currentSensors, 
    setSensorField, 
    applyPresetScenario, 
    processSerialInput,
    isEsp32Connected,
    isStreamingTelemetry,
    toggleTelemetryStream,
    webSerialStatus,
    connectHardwareSerial,
    disconnectHardwareSerial,
    isSupabaseConnected,
    isSupabaseStreaming,
    setIsSupabaseStreaming,
    syncReadingToSupabase,
    setIsHardwareOrCloudModalOpen,
    runPrediction,
    setActiveTab,
    showToast
  } = useApp();

  const [activeIngestionMode, setActiveIngestionMode] = useState<'usb' | 'supabase' | 'stream' | 'serial' | 'manual' | 'presets'>('usb');
  const [serialInputText, setSerialInputText] = useState<string>(
    JSON.stringify(
      {
        user_id: patient.user_id,
        spo2: currentSensors.spo2,
        heart_rate: currentSensors.heart_rate,
        temperature_c: currentSensors.temperature_c,
        humidity_pct: currentSensors.humidity_pct,
        dust_density_mgm3: currentSensors.dust_density_mgm3,
        pm25_est: currentSensors.pm25_est,
        aqi: currentSensors.aqi,
        source: "nodemcu_esp8266_wifi",
      },
      null,
      2
    )
  );

  const [showPefrGuide, setShowPefrGuide] = useState<boolean>(false);

  // PEFR Predicted Calculation (Nunn & Gregg 1989)
  const pefrAnalysis = calculatePredictedPefr(
    patient.age,
    patient.gender,
    patient.height_cm,
    currentSensors.pefr_lmin
  );

  // Range validation
  const validation = validateSensorReadings({
    spo2: currentSensors.spo2,
    heartRate: currentSensors.heart_rate,
    temperatureC: currentSensors.temperature_c,
    humidityPct: currentSensors.humidity_pct,
    pefrLmin: currentSensors.pefr_lmin,
  });

  const handleComputePrediction = () => {
    if (!validation.isValid) {
      showToast('Cannot run prediction with out-of-range sensor values. Please correct flagged readings.', 'error');
      return;
    }
    runPrediction();
    setActiveTab('result');
  };

  const handleSerialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processSerialInput(serialInputText);
  };

  return (
    <div id="sensor-reading-container" className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Banner with Ingestion Modes */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-blue-600" />
              <h1 className="text-xl font-bold text-slate-900">Multi-Sensor Telemetry & IoT Ingestion</h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Capturing physiological metrics (SpO₂, HR, PEFR) and ambient environmental air quality (GP2Y Dust, Temp, Humidity).
            </p>
          </div>

          {/* Primary Action Button */}
          <button
            id="sensor-compute-risk-btn"
            onClick={handleComputePrediction}
            disabled={!validation.isValid}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold shadow-xs transition-colors shrink-0 ${
              validation.isValid
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Compute Asthma Risk</span>
          </button>
        </div>

        {/* Ingestion Mode Segmented Control */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Ingestion Mode:</span>
          
          <button
            id="ingestion-tab-usb"
            onClick={() => setActiveIngestionMode('usb')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeIngestionMode === 'usb'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Physical USB (Web Serial)</span>
            {webSerialStatus.isConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </button>

          <button
            id="ingestion-tab-supabase"
            onClick={() => setActiveIngestionMode('supabase')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeIngestionMode === 'supabase'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>Supabase Cloud Stream</span>
            {isSupabaseStreaming && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>

          <button
            id="ingestion-tab-stream"
            onClick={() => setActiveIngestionMode('stream')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeIngestionMode === 'stream'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Virtual Rig Simulator</span>
          </button>

          <button
            id="ingestion-tab-serial"
            onClick={() => setActiveIngestionMode('serial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeIngestionMode === 'serial'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Serial Console Paste</span>
          </button>

          <button
            id="ingestion-tab-manual"
            onClick={() => setActiveIngestionMode('manual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeIngestionMode === 'manual'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Manual Entry</span>
          </button>

          <button
            id="ingestion-tab-presets"
            onClick={() => setActiveIngestionMode('presets')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeIngestionMode === 'presets'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Clinical Scenarios</span>
          </button>
        </div>

        {/* Physical USB (Web Serial) Mode Panel */}
        {activeIngestionMode === 'usb' && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">Direct Physical NodeMCU / ESP32 (Web Serial):</span>
                  <span className={`px-2 py-0.5 rounded font-medium ${
                    webSerialStatus.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {webSerialStatus.isConnected 
                      ? `Connected (${webSerialStatus.portName}) • Packets: ${webSerialStatus.packetsReceived}` 
                      : 'Hardware Not Connected'}
                  </span>
                </div>
                <p className="text-slate-500">
                  Connect your real physical NodeMCU ESP8266 or ESP32 over USB (115200 baud). Sensor telemetry is parsed and streamed directly in browser.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {webSerialStatus.isConnected ? (
                  <button
                    id="sensor-usb-disconnect-btn"
                    onClick={disconnectHardwareSerial}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md transition-colors"
                  >
                    Disconnect USB
                  </button>
                ) : (
                  <button
                    id="sensor-usb-connect-btn"
                    onClick={connectHardwareSerial}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md transition-colors shadow-xs cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Connect NodeMCU / ESP32 (USB)</span>
                  </button>
                )}
                
                <button
                  onClick={() => setIsHardwareOrCloudModalOpen(true)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md font-medium transition-colors cursor-pointer"
                >
                  Pinout & Diagnostics
                </button>
              </div>
            </div>

            {isRunningInIframe() && !webSerialStatus.isConnected && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-950 rounded-lg text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-900 block">Preview Iframe Security:</span>
                    <span className="text-amber-800">
                      Browser permissions policy blocks direct USB cable connection inside embedded preview frames. Open this app in a full browser tab for direct USB Web Serial, or use the WiFi Supabase Cloud Stream.
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Full Browser Tab</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSupabaseStreaming(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold rounded-md text-xs transition-colors cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-blue-600" />
                    <span>Start Cloud Stream (No USB Needed)</span>
                  </button>
                </div>
              </div>
            )}

            {!isWebSerialSupported() && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded text-[11px]">
                Note: Web Serial API is enabled in Chromium browsers (Chrome, Edge, Brave, Opera). If using Firefox or Safari, switch to <strong>Supabase Cloud Stream</strong> or <strong>Serial Console Paste</strong>.
              </div>
            )}
          </div>
        )}

        {/* Supabase Cloud Stream Panel */}
        {activeIngestionMode === 'supabase' && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">Supabase Cloud Stream:</span>
                  <span className={`px-2 py-0.5 rounded font-medium ${
                    isSupabaseStreaming 
                      ? 'bg-blue-100 text-blue-800' 
                      : isSupabaseConnected 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {isSupabaseStreaming 
                      ? '● Live Cloud Listening Active' 
                      : isSupabaseConnected 
                      ? '✓ Supabase Connected' 
                      : 'Supabase Cloud Integration'}
                  </span>
                </div>
                <p className="text-slate-500">
                  NodeMCU ESP8266 or ESP32 transmits telemetry directly via WiFi HTTP POST to Supabase (<code>/rest/v1/sensor_readings</code>).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="sensor-supabase-stream-toggle-btn"
                  onClick={() => setIsSupabaseStreaming(!isSupabaseStreaming)}
                  className={`px-4 py-2 font-semibold rounded-md transition-colors cursor-pointer ${
                    isSupabaseStreaming 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  {isSupabaseStreaming ? 'Stop Cloud Stream' : 'Start Cloud Stream'}
                </button>

                <button
                  id="sensor-supabase-config-btn"
                  onClick={() => setIsHardwareOrCloudModalOpen(true)}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cloud Config</span>
                </button>

                <button
                  id="sensor-supabase-push-btn"
                  onClick={syncReadingToSupabase}
                  className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors cursor-pointer"
                  title="Push current reading snapshot to Supabase"
                >
                  <UploadCloud className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stream Mode Panel */}
        {activeIngestionMode === 'stream' && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">ESP32 DevKit Telemetry Simulator:</span>
                <span className={`px-2 py-0.5 rounded font-medium ${
                  isStreamingTelemetry ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {isStreamingTelemetry ? 'Streaming live packet cycle (2.5s)' : 'Idle / Standby'}
                </span>
              </div>
              <p className="text-slate-500">
                Transmitting simulated physiological and environmental cycles for testing when physical hardware is detached.
              </p>
            </div>

            <button
              id="sensor-toggle-stream-btn"
              onClick={toggleTelemetryStream}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold transition-colors ${
                isStreamingTelemetry
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isStreamingTelemetry ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isStreamingTelemetry ? 'Pause Simulator' : 'Start Simulator'}</span>
            </button>
          </div>
        )}

        {/* USB Serial Ingestion Mode Panel */}
        {activeIngestionMode === 'serial' && (
          <form onSubmit={handleSerialSubmit} className="bg-slate-900 text-emerald-400 p-4 rounded-lg font-mono text-xs space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>USB Serial Console Stream Reader (TRD §6.1 / Fallback Demo Mode)</span>
              </span>
              <span className="text-[11px]">Baud: 115200</span>
            </div>
            <textarea
              id="serial-raw-input"
              rows={4}
              value={serialInputText}
              onChange={(e) => setSerialInputText(e.target.value)}
              className="w-full bg-slate-950 text-emerald-300 p-2.5 rounded border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
              placeholder='Paste raw ESP32 serial output e.g.: {"spo2": 96.5, "heart_rate": 82, "temperature": 29.4, "humidity": 61.2, "pefr_lmin": 380}'
            />
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">
                Accepts JSON telemetry object or key-value pairs (`SPO2: 96, HR: 80...`)
              </span>
              <button
                type="submit"
                id="serial-parse-btn"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-semibold rounded text-xs transition-colors"
              >
                Parse & Apply Telemetry
              </button>
            </div>
          </form>
        )}

        {/* Scenario Presets Panel */}
        {activeIngestionMode === 'presets' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {CLINICAL_PRESETS.map((p) => (
              <button
                key={p.id}
                id={`preset-${p.id}`}
                onClick={() => applyPresetScenario(p.id)}
                className="p-3 bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all space-y-1 group"
              >
                <div className="font-semibold text-xs text-slate-900 group-hover:text-blue-700">
                  {p.name}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  {p.description}
                </p>
                <div className="text-[10px] font-medium text-slate-600 pt-1 flex items-center justify-between">
                  <span>SpO₂: {p.values.spo2}%</span>
                  <span>PEFR: {p.values.pefrLmin}</span>
                </div>
              </button>
            ))}
          </div>
        )}

      </div>

      {/* Validation Alert (if any bounds violated) */}
      {(!validation.isValid || validation.warnings.length > 0) && (
        <div className={`p-4 rounded-xl border space-y-1 text-xs ${
          !validation.isValid ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{validation.isValid ? 'Physiological Warning' : 'Sensor Range Validation Error'}</span>
          </div>
          {validation.errors.map((err, i) => (
            <p key={i} className="pl-6 text-red-700 font-medium">• {err}</p>
          ))}
          {validation.warnings.map((warn, i) => (
            <p key={i} className="pl-6 text-amber-700">• {warn}</p>
          ))}
        </div>
      )}

      {/* Sensor Metrics Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Physiological Signals */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>1. Physiological Readings</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">MAX30102 + Spirometry</span>
          </div>

          {/* Blood Oxygen Saturation (SpO2) Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">SpO₂ Oxygen Saturation</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-3xl font-extrabold ${currentSensors.spo2 < 92 ? 'text-red-600' : 'text-slate-900'}`}>
                    {currentSensors.spo2}
                  </span>
                  <span className="text-sm text-slate-500 font-medium">%</span>
                </div>
              </div>
              <div className={`p-2.5 rounded-lg shrink-0 ${currentSensors.spo2 < 92 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                <Activity className="w-5 h-5" />
              </div>
            </div>

            {activeIngestionMode === 'manual' && (
              <div className="pt-2">
                <input
                  type="range"
                  min="85"
                  max="100"
                  step="0.5"
                  value={currentSensors.spo2}
                  onChange={(e) => setSensorField('spo2', parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>Target Baseline: 95–100%</span>
              <span className={`font-semibold ${currentSensors.spo2 < 92 ? 'text-red-600' : 'text-emerald-700'}`}>
                {currentSensors.spo2 < 92 ? 'Hypoxemia' : 'Adequate Saturation'}
              </span>
            </div>
          </div>

          {/* Heart Rate (Pulse) Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Heart Rate / Pulse</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-extrabold text-slate-900">{currentSensors.heart_rate}</span>
                  <span className="text-sm text-slate-500 font-medium">bpm</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-100 text-rose-600 shrink-0">
                <Heart className="w-5 h-5" />
              </div>
            </div>

            {activeIngestionMode === 'manual' && (
              <div className="pt-2">
                <input
                  type="range"
                  min="40"
                  max="160"
                  step="1"
                  value={currentSensors.heart_rate}
                  onChange={(e) => setSensorField('heart_rate', parseInt(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>Resting Range: 60–100 bpm</span>
              <span className={`font-semibold ${currentSensors.heart_rate > 100 ? 'text-amber-600' : 'text-slate-700'}`}>
                {currentSensors.heart_rate > 100 ? 'Tachycardia (Elevated)' : 'Normal Sinus'}
              </span>
            </div>
          </div>

          {/* PEFR Mechanical Meter Manual Entry Card (Crucial per TRD §3 and APPFLOW §2.5) */}
          <div className="bg-white p-5 rounded-xl border-2 border-blue-200 shadow-xs space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                    PEFR (Peak Expiratory Flow Rate)
                  </span>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                    Manual Form Entry
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  From patient Mini-Wright mechanical peak flow meter.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPefrGuide(!showPefrGuide)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 shrink-0"
              >
                <Info className="w-3.5 h-3.5" />
                <span>How to measure</span>
              </button>
            </div>

            {/* PEFR Numeric Input with direct binding */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  id="pefr-manual-input"
                  min="50"
                  max="900"
                  step="5"
                  value={currentSensors.pefr_lmin}
                  onChange={(e) => setSensorField('pefr_lmin', parseInt(e.target.value) || 0)}
                  className="w-full text-2xl font-bold text-slate-900 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-hidden"
                />
                <span className="absolute right-3 top-3.5 text-xs font-semibold text-slate-400">
                  L/min
                </span>
              </div>

              {/* Action Plan Zone Badge */}
              <div className={`px-3 py-2 rounded-lg text-center shrink-0 border ${
                pefrAnalysis.clinicalZone === 'red'
                  ? 'bg-red-50 text-red-800 border-red-300'
                  : pefrAnalysis.clinicalZone === 'yellow'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}>
                <div className="text-[10px] font-semibold uppercase tracking-wider">Asthma Zone</div>
                <div className="text-sm font-extrabold capitalize">
                  {pefrAnalysis.clinicalZone} Zone
                </div>
              </div>
            </div>

            {/* Nunn & Gregg Predicted Comparison */}
            <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-100">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-600">Nunn & Gregg (1989) Expected:</span>
                <span className="text-slate-900 font-bold">{pefrAnalysis.predictedPefr} L/min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Achieved % of Predicted:</span>
                <span className={`font-bold ${
                  pefrAnalysis.clinicalZone === 'red' ? 'text-red-600' : pefrAnalysis.clinicalZone === 'yellow' ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {pefrAnalysis.pefrPercent}%
                </span>
              </div>
            </div>

            {/* Collapsible PEFR Clinical Guide */}
            {showPefrGuide && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-slate-700 space-y-1.5 animate-fadeIn">
                <h4 className="font-bold text-blue-900">Proper Peak Flow Measurement Protocol:</h4>
                <ol className="list-decimal pl-4 space-y-0.5 text-slate-600">
                  <li>Ensure the indicator slider is pushed all the way to zero.</li>
                  <li>Stand upright and take as deep a breath as possible.</li>
                  <li>Place the mouthpiece between your teeth, seal tightly with your lips (do not block hole with tongue).</li>
                  <li>Blow out as hard and fast as you can in a single sharp burst.</li>
                  <li>Repeat 3 times and record the <strong>highest of the three blows</strong>.</li>
                </ol>
              </div>
            )}

          </div>

        </div>

        {/* Right Column: Environmental Signals */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-amber-600" />
              <span>2. Environmental Telemetry</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">DHT22 + GP2Y1010AU0F</span>
          </div>

          {/* Particulate & AQI Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Air Quality Index (AQI)</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-3xl font-extrabold ${
                    currentSensors.aqi > 200 ? 'text-red-600' : currentSensors.aqi > 100 ? 'text-amber-600' : 'text-slate-900'
                  }`}>
                    {currentSensors.aqi}
                  </span>
                  <span className="text-sm text-slate-500 font-medium">AQI</span>
                </div>
              </div>

              <div className={`px-2.5 py-1.5 rounded-lg text-right text-xs font-bold ${
                currentSensors.aqi <= 50
                  ? 'bg-emerald-100 text-emerald-800'
                  : currentSensors.aqi <= 100
                  ? 'bg-green-100 text-green-800'
                  : currentSensors.aqi <= 200
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                <div>CPCB Standard</div>
                <div>{currentSensors.aqi <= 50 ? 'Good' : currentSensors.aqi <= 100 ? 'Satisfactory' : currentSensors.aqi <= 200 ? 'Moderate' : 'Poor/Severe'}</div>
              </div>
            </div>

            {/* Dust & Derived PM2.5 details */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-500 block">Raw Dust Density:</span>
                <span className="font-semibold text-slate-800">{currentSensors.dust_density_mgm3} mg/m³</span>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-500 block">Calibrated PM2.5 Eq:</span>
                <span className="font-semibold text-slate-800">{currentSensors.pm25_est} µg/m³</span>
              </div>
            </div>

            {activeIngestionMode === 'manual' && (
              <div className="pt-2">
                <label className="text-[11px] text-slate-500 font-medium block mb-1">
                  Adjust Particulate PM2.5 Equivalent (µg/m³):
                </label>
                <input
                  type="range"
                  min="5"
                  max="280"
                  step="2"
                  value={currentSensors.pm25_est}
                  onChange={(e) => setSensorField('pm25_est', parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Temperature & Humidity Combo Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
              Microclimate Temperature & Humidity (DHT22)
            </span>

            <div className="grid grid-cols-2 gap-4">
              {/* Temp */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                  <span>Ambient Temp</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-900">{currentSensors.temperature_c}</span>
                  <span className="text-xs text-slate-500">°C</span>
                </div>
                {activeIngestionMode === 'manual' && (
                  <input
                    type="range"
                    min="10"
                    max="45"
                    step="0.5"
                    value={currentSensors.temperature_c}
                    onChange={(e) => setSensorField('temperature_c', parseFloat(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer mt-1"
                  />
                )}
              </div>

              {/* Humidity */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Droplets className="w-3.5 h-3.5 text-blue-500" />
                  <span>Relative Humidity</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-900">{currentSensors.humidity_pct}</span>
                  <span className="text-xs text-slate-500">%</span>
                </div>
                {activeIngestionMode === 'manual' && (
                  <input
                    type="range"
                    min="15"
                    max="95"
                    step="1"
                    value={currentSensors.humidity_pct}
                    onChange={(e) => setSensorField('humidity_pct', parseFloat(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer mt-1"
                  />
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Airway Reactivity:</span>
              <span className="font-semibold text-slate-700">
                {currentSensors.temperature_c < 16 && currentSensors.humidity_pct < 35
                  ? 'High (Cold & Dry Bronchoconstriction)'
                  : currentSensors.humidity_pct > 80
                  ? 'Moderate (High Humidity / Molds)'
                  : 'Comfortable Thermal Baseline'}
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom CTA & Medical Disclaimer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <span className="text-xs text-slate-500">
          Ready to fuse physiological + environmental signals into Random Forest model.
        </span>

        <button
          id="sensor-bottom-run-inference-btn"
          onClick={handleComputePrediction}
          disabled={!validation.isValid}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-sm transition-colors w-full sm:w-auto justify-center"
        >
          <Sparkles className="w-4 h-4" />
          <span>Compute Risk & Explain via SHAP</span>
        </button>
      </div>

      <MedicalDisclaimer />

    </div>
  );
};
