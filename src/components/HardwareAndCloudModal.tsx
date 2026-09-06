import React, { useState } from 'react';
import { 
  X, 
  Cpu, 
  Database, 
  Wifi, 
  Terminal, 
  Check, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  RefreshCw, 
  UploadCloud, 
  Play, 
  Pause,
  ExternalLink,
  ShieldCheck,
  Zap,
  Sliders
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  SUPABASE_SQL_SCHEMA, 
  testSupabaseConnection,
  ENV_SUPABASE_URL,
  ENV_SUPABASE_ANON_KEY
} from '../utils/supabaseClient';
import { isWebSerialSupported, isRunningInIframe } from '../utils/webSerial';

export const HardwareAndCloudModal: React.FC = () => {
  const {
    isHardwareOrCloudModalOpen,
    setIsHardwareOrCloudModalOpen,
    webSerialStatus,
    connectHardwareSerial,
    disconnectHardwareSerial,
    supabaseConfig,
    updateSupabaseConfig,
    isSupabaseConnected,
    isSupabaseStreaming,
    setIsSupabaseStreaming,
    syncReadingToSupabase,
    isEsp32Connected,
    setIsEsp32Connected,
    isStreamingTelemetry,
    toggleTelemetryStream,
    currentSensors,
    showToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'hardware' | 'supabase' | 'simulation'>('hardware');
  const [copiedSql, setCopiedSql] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [tempUrl, setTempUrl] = useState(supabaseConfig.url || ENV_SUPABASE_URL);
  const [tempKey, setTempKey] = useState(supabaseConfig.anonKey || ENV_SUPABASE_ANON_KEY);

  // Sync inputs if supabaseConfig changes
  React.useEffect(() => {
    if (supabaseConfig.url) setTempUrl(supabaseConfig.url);
    if (supabaseConfig.anonKey) setTempKey(supabaseConfig.anonKey);
  }, [supabaseConfig.url, supabaseConfig.anonKey]);

  if (!isHardwareOrCloudModalOpen) return null;

  const handleResetToFixedProject = () => {
    setTempUrl(ENV_SUPABASE_URL);
    setTempKey(ENV_SUPABASE_ANON_KEY);
    updateSupabaseConfig({
      url: ENV_SUPABASE_URL,
      anonKey: ENV_SUPABASE_ANON_KEY,
    });
    showToast('Reset credentials to environment variable defaults.', 'info');
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
    showToast('Supabase SQL schema copied to clipboard.', 'success');
  };

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseTestResult(null);
    const res = await testSupabaseConnection({
      url: tempUrl.trim(),
      anonKey: tempKey.trim(),
      autoSync: supabaseConfig.autoSync,
      realtimeEnabled: supabaseConfig.realtimeEnabled,
    });
    setTestingSupabase(false);
    setSupabaseTestResult(res);
    if (res.success) {
      updateSupabaseConfig({
        url: tempUrl.trim(),
        anonKey: tempKey.trim(),
      });
      showToast('Supabase connection verified and credentials saved.', 'success');
    } else {
      showToast('Supabase connection test failed. Please check credentials.', 'error');
    }
  };

  const handleSaveSupabaseConfig = () => {
    updateSupabaseConfig({
      url: tempUrl.trim(),
      anonKey: tempKey.trim(),
    });
    showToast('Saved Supabase credentials.', 'success');
  };

  const serialSupported = isWebSerialSupported();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
      <div 
        id="hardware-cloud-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Hardware Connection & Cloud Integration Hub
              </h2>
              <p className="text-xs text-slate-500">
                Manage physical ESP32 USB connectivity, Supabase real-time cloud sync, or simulated telemetry.
              </p>
            </div>
          </div>

          <button
            id="close-hardware-cloud-modal-btn"
            onClick={() => setIsHardwareOrCloudModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-5 pt-3 gap-2 text-xs font-semibold">
          <button
            id="tab-hardware-usb"
            onClick={() => setActiveTab('hardware')}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'hardware'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Physical Hardware (USB Serial)</span>
            {webSerialStatus.isConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </button>

          <button
            id="tab-supabase-cloud"
            onClick={() => setActiveTab('supabase')}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'supabase'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Supabase Cloud Sync</span>
            {isSupabaseConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            id="tab-simulation-mode"
            onClick={() => setActiveTab('simulation')}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'simulation'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Virtual Rig Simulator</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700">
          
          {/* TAB 1: PHYSICAL HARDWARE (WEB SERIAL) */}
          {activeTab === 'hardware' && (
            <div className="space-y-4">
              
              {/* Status Alert */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                webSerialStatus.isConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                {webSerialStatus.isConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-bold text-sm">
                    {webSerialStatus.isConnected
                      ? `Physical ESP32 Connected (${webSerialStatus.portName || 'Serial Port'})`
                      : 'Physical Hardware is Currently NOT Connected'}
                  </h3>
                  <p className="text-xs mt-1 text-slate-600">
                    {webSerialStatus.isConnected
                      ? `Receiving continuous live telemetry packets directly from your microcontroller over USB at 115200 baud. Total packets ingested: ${webSerialStatus.packetsReceived}.`
                      : 'To stream live data from your real ESP32 + MAX30102 + DHT22 rig, connect it via USB cable to your computer and click the button below.'}
                  </p>
                </div>
              </div>

              {/* Hardware Actions */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Direct Web Serial Connection (Browser-to-Microcontroller)</span>
                    <span className="text-[11px] text-slate-500">
                      Supports NodeMCU ESP8266 & ESP32 via Chromium Web Serial API at 115200 baud
                    </span>
                  </div>

                  <div>
                    {webSerialStatus.isConnected ? (
                      <button
                        id="disconnect-web-serial-btn"
                        onClick={disconnectHardwareSerial}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-xs"
                      >
                        Disconnect USB
                      </button>
                    ) : (
                      <button
                        id="connect-web-serial-btn"
                        onClick={connectHardwareSerial}
                        disabled={!serialSupported}
                        className={`px-4 py-2 font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 ${
                          serialSupported
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Zap className="w-4 h-4" />
                        <span>Connect NodeMCU / ESP32 (USB)</span>
                      </button>
                    )}
                  </div>
                </div>

                {!serialSupported && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[11px]">
                    Your current browser does not support the Web Serial API. Please open this app in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> for direct USB hardware connection, or use the Supabase Cloud Ingestion path below.
                  </div>
                )}

                {isRunningInIframe() && !webSerialStatus.isConnected && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-amber-900">Preview Iframe Notice (Permissions Policy):</span>
                        <span className="text-amber-800">
                          Browsers restrict direct USB serial selection inside embedded preview iframes. To connect with a USB cable, open the app in a full browser tab, or use WiFi Supabase Cloud streaming.
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md text-xs transition-colors shadow-xs cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in New Browser Tab</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('cloud')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold rounded-md text-xs transition-colors cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5 text-blue-600" />
                        <span>Switch to Supabase Cloud (No USB Needed)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Hardware Pinout Quick Ref - NodeMCU ESP8266 & ESP32 */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 block text-xs">NodeMCU ESP8266 Pinout Mapping (Your Active Board):</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[10px] uppercase">NodeMCU ESP8266</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100 space-y-1">
                    <strong className="text-blue-900 font-bold block">MAX30102 (SpO2/HR)</strong>
                    <div className="text-[11px] space-y-0.5">
                      <div>SDA &rarr; <span className="font-mono font-bold text-slate-800">D2</span> (GPIO 4)</div>
                      <div>SCL &rarr; <span className="font-mono font-bold text-slate-800">D1</span> (GPIO 5)</div>
                      <div>VCC &rarr; <span className="font-mono text-slate-800">3.3V</span></div>
                      <div>GND &rarr; <span className="font-mono text-slate-800">GND</span></div>
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100 space-y-1">
                    <strong className="text-emerald-900 font-bold block">DHT22 (Temp/Hum)</strong>
                    <div className="text-[11px] space-y-0.5">
                      <div>DATA &rarr; <span className="font-mono font-bold text-slate-800">D4</span> (GPIO 2)</div>
                      <div>Pullup &rarr; <span className="font-mono text-slate-800">10k&Omega;</span> to 3.3V</div>
                      <div>VCC &rarr; <span className="font-mono text-slate-800">3.3V</span></div>
                      <div>GND &rarr; <span className="font-mono text-slate-800">GND</span></div>
                    </div>
                  </div>
                  <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-100 space-y-1">
                    <strong className="text-amber-900 font-bold block">GP2Y Dust Sensor</strong>
                    <div className="text-[11px] space-y-0.5">
                      <div>LED &rarr; <span className="font-mono font-bold text-slate-800">D5</span> (GPIO 14)</div>
                      <div>Vo &rarr; <span className="font-mono font-bold text-slate-800">A0</span> (ADC0)</div>
                      <div>Divider &rarr; <span className="font-mono text-slate-800">10k/33k</span></div>
                      <div>VCC &rarr; <span className="font-mono text-slate-800">5V (VIN)</span></div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Using standard ESP32 instead? SDA=21, SCL=22, DHT=4, Dust LED=25, Vo=34.</span>
                  <span className="text-emerald-700 font-medium">Baud rate: 115200</span>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: SUPABASE CLOUD SYNC */}
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900 text-xs">Supabase Project Configuration</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    isSupabaseConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isSupabaseConnected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>

                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Cloud Database Integration:</span>
                    <span>Configure your Supabase Project URL and Anon Key below or in your <code>.env</code> file (<code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>). Credentials persist safely in browser storage.</span>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://your-project-id.supabase.co"
                      value={tempUrl}
                      onChange={(e) => setTempUrl(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Supabase Anonymous Public Key (anon key)
                    </label>
                    <input
                      type="password"
                      placeholder="eyJh..."
                      value={tempKey}
                      onChange={(e) => setTempKey(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveSupabaseConfig}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Save Credentials
                      </button>
                      <button
                        type="button"
                        onClick={handleResetToFixedProject}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                        title="Reset to permanent project keys"
                      >
                        Restore Project Keys
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestSupabase}
                      disabled={testingSupabase || !tempUrl || !tempKey}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {testingSupabase ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      <span>{testingSupabase ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                  </div>

                  {supabaseTestResult && (
                    <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                      supabaseTestResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-900'
                    }`}>
                      {supabaseTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <span>{supabaseTestResult.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Real-time Cloud Streaming Toggle */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Real-Time Cloud Telemetry Ingestion</span>
                  <p className="text-[11px] text-slate-500">
                    Automatically poll or listen to new rows inserted into <code>sensor_readings</code> when ESP32 transmits over WiFi.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSupabaseStreaming(!isSupabaseStreaming)}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                    isSupabaseStreaming
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isSupabaseStreaming ? 'Cloud Stream Active' : 'Enable Cloud Stream'}
                </button>
              </div>

              {/* Push Local Telemetry to Supabase */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Manual Telemetry Upload</span>
                  <p className="text-[11px] text-slate-500">
                    Push current telemetry snapshot (SpO2 {currentSensors.spo2}%, HR {currentSensors.heart_rate}) to Supabase.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={syncReadingToSupabase}
                  className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Push to Supabase</span>
                </button>
              </div>

              {/* SQL Schema Copy Button */}
              <div className="p-4 bg-slate-900 text-emerald-400 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-sans">
                  <span className="font-bold text-xs">Supabase Database Setup (SQL Script)</span>
                  <button
                    onClick={handleCopySql}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Run this SQL in your Supabase SQL Editor to generate the <code>sensor_readings</code>, <code>predictions</code>, and <code>symptom_logs</code> tables with Row-Level Security enabled.
                </p>
              </div>

            </div>
          )}

          {/* TAB 3: SIMULATION MODE */}
          {activeTab === 'simulation' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Virtual IoT Telemetry Rig (Testing Mode)</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    When you do not have an ESP32 plugged in, this software simulator generates continuous physiological micro-fluctuations (SpO₂ &plusmn;0.4%, HR &plusmn;2 bpm, temperature &plusmn;0.2°C, dust density) every 2.5 seconds to simulate an active wireless patient monitor.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800">Simulator Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      isStreamingTelemetry ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {isStreamingTelemetry ? 'Streaming (2.5s cycle)' : 'Paused / Idle'}
                    </span>
                  </div>

                  <button
                    onClick={toggleTelemetryStream}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-colors ${
                      isStreamingTelemetry
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isStreamingTelemetry ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isStreamingTelemetry ? 'Pause Simulation' : 'Start Simulation'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Telemetry encrypted and client-validated before ML inference</span>
          </div>

          <button
            onClick={() => setIsHardwareOrCloudModalOpen(false)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
