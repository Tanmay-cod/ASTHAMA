import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Patient, SymptomLog, SensorReading, Prediction, ActiveTab } from '../types';
import { runAsthmaRiskInference } from '../ml/inferenceEngine';
import { CLINICAL_PRESETS, convertDustVoltageToPm25, calculatePredictedPefr } from '../utils/clinicalCalculations';
import { PRESET_PATIENTS, buildSeedPredictionsForPatient, PatientSeedPackage } from '../data/patientProfiles';
import { exportPatientRecordsCsv, exportAllPatientsJson } from '../utils/reportGenerator';
import {
  WebSerialStatus,
  connectWebSerial,
  disconnectWebSerial,
  isWebSerialSupported,
} from '../utils/webSerial';
import {
  SupabaseConfig,
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  pushSensorReadingToSupabase,
  pushPredictionToSupabase,
  fetchLatestSensorReadingFromSupabase,
  testSupabaseConnection,
  authSignIn,
  authSignUp,
  authSignOut,
  authResetPassword,
  authGetCurrentSession,
  syncPatientToSupabase,
} from '../utils/supabaseClient';

interface AppContextType {
  // Patient Registry & CRUD
  patient: Patient;
  patients: Patient[];
  activePatientId: string;
  updatePatient: (updated: Partial<Patient>) => void;
  updatePatientById: (id: string, updated: Partial<Patient>) => void;
  addPatient: (newPatient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>, autoSwitch?: boolean) => Patient;
  deletePatient: (id: string) => boolean;
  switchPatient: (patientIdOrKey: string) => void;
  getPatientData: (patientId: string) => { symptoms: SymptomLog; sensors: SensorReading; history: Prediction[] } | null;
  exportData: (format?: 'csv' | 'json', targetPatientId?: string) => void;

  // Clinical Report Modal State
  isReportModalOpen: boolean;
  setIsReportModalOpen: (open: boolean) => void;
  reportTargetPatientId: string | null;
  openReportModal: (patientId?: string) => void;
  closeReportModal: () => void;

  // Symptom Check-in
  currentSymptoms: SymptomLog;
  setSymptomField: (field: keyof Omit<SymptomLog, 'id' | 'user_id' | 'symptom_score' | 'recorded_at'>, val: number | string) => void;
  resetSymptoms: () => void;
  saveCurrentSymptoms: () => SymptomLog;

  // Sensor Readings & IoT
  currentSensors: SensorReading;
  setSensorField: (field: keyof Omit<SensorReading, 'id' | 'user_id' | 'source' | 'recorded_at'>, val: number) => void;
  applyPresetScenario: (presetId: string) => void;
  processSerialInput: (serialText: string) => boolean;
  
  // Physical Hardware Connection (Web Serial)
  webSerialStatus: WebSerialStatus;
  connectHardwareSerial: () => Promise<void>;
  disconnectHardwareSerial: () => Promise<void>;

  // Cloud Integration (Supabase)
  supabaseConfig: SupabaseConfig;
  updateSupabaseConfig: (cfg: Partial<SupabaseConfig>) => void;
  isSupabaseConnected: boolean;
  isSupabaseStreaming: boolean;
  setIsSupabaseStreaming: (streaming: boolean) => void;
  syncReadingToSupabase: () => Promise<void>;
  syncPredictionToSupabase: (pred: Prediction) => Promise<void>;
  applySupabaseSensorRow: (row: any) => void;
  fetchAndApplyLatestSupabaseReading: () => Promise<{ success: boolean; data?: any; error?: string }>;

  // Hardware/Cloud Modal
  isHardwareOrCloudModalOpen: boolean;
  setIsHardwareOrCloudModalOpen: (open: boolean) => void;

  // Supabase Auth & Session State
  currentUser: any | null;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authSignInMethod: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  authSignUpMethod: (email: string, password: string, meta?: any) => Promise<{ success: boolean; requiresEmailConfirmation?: boolean; error?: string }>;
  authSignOutMethod: () => Promise<void>;
  authResetPasswordMethod: (email: string) => Promise<{ success: boolean; error?: string }>;

  // ML Inference Engine Preference
  inferenceEnginePreference: 'trained_forest' | 'clinical_guideline_baseline';
  setInferenceEnginePreference: (pref: 'trained_forest' | 'clinical_guideline_baseline') => void;

  // Virtual Rig Telemetry Stream (Simulator)
  isEsp32Connected: boolean;
  setIsEsp32Connected: (conn: boolean) => void;
  isStreamingTelemetry: boolean;
  toggleTelemetryStream: () => void;
  lastEsp32PacketTime: string | null;

  // Prediction & Results
  latestPrediction: Prediction | null;
  predictionHistory: Prediction[];
  runPrediction: () => Prediction;
  deletePrediction: (id: string) => void;
  clearAllHistory: () => void;
  resetToDefaultData: () => void;

  // Navigation
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Toast / Status
  statusMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PATIENTS: 'iot_asthma_patients_list_v2',
  ACTIVE_PATIENT_ID: 'iot_asthma_active_patient_id_v2',
  PATIENT: 'iot_asthma_patient_v1',
  HISTORY: 'iot_asthma_history_v1',
  SENSORS: 'iot_asthma_sensors_v1',
  SYMPTOMS: 'iot_asthma_symptoms_v1',
  PATIENT_RECORDS_PREFIX: 'iot_asthma_patient_data_',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialize Patient Registry
  const [patients, setPatients] = useState<Patient[]>(() => {
    const presetList = PRESET_PATIENTS.map(p => p.patient);
    const saved = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    if (saved) {
      try {
        const parsed: Patient[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure all requested preset profiles exist in list
          const existingIds = new Set(parsed.map(p => p.id));
          const missingPresets = presetList.filter(p => !existingIds.has(p.id));
          return [...parsed, ...missingPresets];
        }
      } catch (e) {
        console.error('Error parsing saved patients:', e);
      }
    }
    return presetList;
  });

  // 2. Active Patient ID
  const [activePatientId, setActivePatientId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_PATIENT_ID);
    if (saved) return saved;
    // Default to Om Tyade or first patient
    return PRESET_PATIENTS[0]?.patient.id || 'pat_om_tyade_01';
  });

  // Current Patient Object
  const patient = patients.find(p => p.id === activePatientId) || patients[0] || PRESET_PATIENTS[0].patient;

  // Find preset package if current patient is a preset
  const currentPresetPkg = PRESET_PATIENTS.find(p => p.patient.id === patient.id) || PRESET_PATIENTS[0];

  // 3. Symptoms State
  const [currentSymptoms, setCurrentSymptoms] = useState<SymptomLog>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SYMPTOMS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return currentPresetPkg.defaultSymptoms;
  });

  // 4. Sensors State
  const [currentSensors, setCurrentSensors] = useState<SensorReading>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SENSORS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return currentPresetPkg.defaultSensors;
  });

  // 5. Prediction History
  const [predictionHistory, setPredictionHistory] = useState<Prediction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return buildSeedPredictionsForPatient(currentPresetPkg);
  });

  // 6. Latest Prediction
  const [latestPrediction, setLatestPrediction] = useState<Prediction | null>(() => {
    return predictionHistory.length > 0 ? predictionHistory[0] : null;
  });

  // Navigation & Simulation
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isEsp32Connected, setIsEsp32Connected] = useState<boolean>(true);
  const [isStreamingTelemetry, setIsStreamingTelemetry] = useState<boolean>(false);
  const [lastEsp32PacketTime, setLastEsp32PacketTime] = useState<string | null>(new Date().toISOString());
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Clinical Report Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportTargetPatientId, setReportTargetPatientId] = useState<string | null>(null);

  const openReportModal = useCallback((patientId?: string) => {
    setReportTargetPatientId(patientId || activePatientId);
    setIsReportModalOpen(true);
  }, [activePatientId]);

  const closeReportModal = useCallback(() => {
    setIsReportModalOpen(false);
  }, []);

  // Web Serial physical hardware status
  const [webSerialStatus, setWebSerialStatus] = useState<WebSerialStatus>({
    isSupported: isWebSerialSupported(),
    isConnected: false,
    portName: null,
    packetsReceived: 0,
    lastPacketTimestamp: null,
    error: null,
  });

  // Supabase Cloud Configuration
  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig>(getStoredSupabaseConfig());
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [isSupabaseStreaming, setIsSupabaseStreaming] = useState<boolean>(false);

  // Modal toggle
  const [isHardwareOrCloudModalOpen, setIsHardwareOrCloudModalOpen] = useState<boolean>(false);

  // Supabase Auth & Session State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [inferenceEnginePreference, setInferenceEnginePreference] = useState<'trained_forest' | 'clinical_guideline_baseline'>('trained_forest');

  // Check initial Supabase auth session on mount
  useEffect(() => {
    authGetCurrentSession().then(({ user }) => {
      if (user) {
        setCurrentUser(user);
      }
    });
  }, []);

  const authSignInMethod = useCallback(async (email: string, password: string) => {
    const res = await authSignIn(email, password);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      return { success: true };
    }
    return { success: false, error: res.error };
  }, []);

  const authSignUpMethod = useCallback(async (email: string, password: string, meta?: any) => {
    const res = await authSignUp(email, password, meta);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      // Provision clinical patient profile
      const newPat: Patient = {
        id: `pat_${Date.now()}`,
        user_id: res.user.id,
        name: meta?.name || 'Registered Patient',
        email: email,
        age: meta?.age || 30,
        gender: meta?.gender || 'male',
        height_cm: meta?.height_cm || 175,
        weight_kg: meta?.weight_kg || 70,
        smoking: false,
        family_history_asthma: false,
        asthma_diagnosed: true,
        medication: 'As prescribed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setPatients(prev => [newPat, ...prev]);
      setActivePatientId(newPat.id);
      syncPatientToSupabase(newPat).catch(console.error);
      return { success: true, requiresEmailConfirmation: res.requiresEmailConfirmation };
    }
    return { success: false, error: res.error };
  }, []);

  const authSignOutMethod = useCallback(async () => {
    await authSignOut();
    setCurrentUser(null);
  }, []);

  const authResetPasswordMethod = useCallback(async (email: string) => {
    return await authResetPassword(email);
  }, []);

  // Check initial Supabase connectivity on mount if URL and anonKey exist
  useEffect(() => {
    if (supabaseConfig.url && supabaseConfig.anonKey) {
      testSupabaseConnection(supabaseConfig).then(res => {
        setIsSupabaseConnected(res.success);
      });
    }
  }, [supabaseConfig.url, supabaseConfig.anonKey]);

  // Update Supabase configuration
  const updateSupabaseConfig = useCallback((cfg: Partial<SupabaseConfig>) => {
    setSupabaseConfigState(prev => {
      const next = { ...prev, ...cfg };
      saveStoredSupabaseConfig(next);
      if (next.url && next.anonKey) {
        testSupabaseConnection(next).then(res => setIsSupabaseConnected(res.success));
      }
      return next;
    });
  }, []);

  // Sync current reading to Supabase
  const syncReadingToSupabase = useCallback(async () => {
    const res = await pushSensorReadingToSupabase(currentSensors);
    if (res.success) {
      showToast('Sensor telemetry pushed to Supabase sensor_readings table.', 'success');
    } else {
      showToast(`Failed to push to Supabase: ${res.error}`, 'error');
    }
  }, [currentSensors]);

  // Sync prediction to Supabase
  const syncPredictionToSupabase = useCallback(async (pred: Prediction) => {
    const res = await pushPredictionToSupabase(pred);
    if (res.success) {
      showToast('Prediction archived to Supabase predictions table.', 'success');
    } else {
      console.warn('Supabase sync warning:', res.error);
    }
  }, []);

  // Web Serial Connect / Disconnect handlers
  const connectHardwareSerial = useCallback(async () => {
    const result = await connectWebSerial(
      (line) => {
        processSerialInput(line);
      },
      (status) => {
        setWebSerialStatus(status);
        if (status.isConnected) {
          setIsEsp32Connected(true);
        }
      }
    );

    if (result.success) {
      showToast(result.message, 'success');
    } else if (result.isIframeBlocked) {
      showToast(result.message, 'warning');
    } else {
      showToast(result.message, 'error');
    }
  }, []);

  const disconnectHardwareSerial = useCallback(async () => {
    await disconnectWebSerial();
    setWebSerialStatus(prev => ({
      ...prev,
      isConnected: false,
      portName: null,
    }));
    showToast('Disconnected physical ESP32 USB serial port.', 'info');
  }, []);

  // Update sensor readings from a Supabase row
  const applySupabaseSensorRow = useCallback((row: any) => {
    if (!row) return;

    setCurrentSensors(prev => {
      const recordedAt = row.created_at || new Date().toISOString();
      const hasValidFinger = row.spo2 !== null && row.spo2 !== undefined && Number(row.spo2) > 0;
      return {
        ...prev,
        spo2: hasValidFinger ? Number(row.spo2) : prev.spo2,
        heart_rate: (row.heart_rate !== null && row.heart_rate !== undefined && Number(row.heart_rate) > 0) ? Number(row.heart_rate) : prev.heart_rate,
        temperature_c: (row.temperature_c !== null && row.temperature_c !== undefined) ? Number(row.temperature_c) : prev.temperature_c,
        humidity_pct: (row.humidity_pct !== null && row.humidity_pct !== undefined) ? Number(row.humidity_pct) : prev.humidity_pct,
        dust_density_mgm3: (row.dust_density_mgm3 !== null && row.dust_density_mgm3 !== undefined) ? Number(row.dust_density_mgm3) : prev.dust_density_mgm3,
        pm25_est: (row.pm25_est !== null && row.pm25_est !== undefined) ? Number(row.pm25_est) : prev.pm25_est,
        aqi: (row.aqi !== null && row.aqi !== undefined) ? Number(row.aqi) : prev.aqi,
        pefr_lmin: (row.pefr_lmin !== null && row.pefr_lmin !== undefined) ? Number(row.pefr_lmin) : prev.pefr_lmin,
        source: (row.source as any) || 'nodemcu_esp8266_wifi',
        recorded_at: recordedAt,
        isFingerDetected: hasValidFinger,
      };
    });

    setLastEsp32PacketTime(row.created_at || new Date().toISOString());
    setIsEsp32Connected(true);
  }, []);

  // Fetch the latest reading from Supabase and apply to sensor state
  const fetchAndApplyLatestSupabaseReading = useCallback(async (): Promise<{ success: boolean; data?: any; error?: string }> => {
    const res = await fetchLatestSensorReadingFromSupabase();
    if (res.success && res.data) {
      applySupabaseSensorRow(res.data);
      return { success: true, data: res.data };
    }
    return { success: res.success, data: res.data, error: res.error };
  }, [applySupabaseSensorRow]);

  // Supabase real-time polling stream (when enabled)
  useEffect(() => {
    if (!isSupabaseStreaming || !supabaseConfig.url || !supabaseConfig.anonKey) return;

    let isMounted = true;
    const targetUserId = patient?.user_id || patient?.id || 'usr_alex_01';
    const interval = setInterval(async () => {
      const res = await fetchLatestSensorReadingFromSupabase(targetUserId);
      if (!isMounted || !res.success || !res.data) return;

      applySupabaseSensorRow(res.data);
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isSupabaseStreaming, supabaseConfig.url, supabaseConfig.anonKey, applySupabaseSensorRow, patient?.user_id, patient?.id]);

  // Sync patients and active patient to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PATIENT_ID, activePatientId);
    localStorage.setItem(STORAGE_KEYS.PATIENT, JSON.stringify(patient));
  }, [activePatientId, patient]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(predictionHistory));
  }, [predictionHistory]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SENSORS, JSON.stringify(currentSensors));
  }, [currentSensors]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SYMPTOMS, JSON.stringify(currentSymptoms));
  }, [currentSymptoms]);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(prev => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  // ----------------------------------------------------
  // PATIENT CRUD & SWITCHING LOGIC
  // ----------------------------------------------------

  // Switch patient profile
  const switchPatient = useCallback((patientIdOrKey: string) => {
    // Save outgoing patient's current telemetry & symptoms
    const outgoingRecord = {
      symptoms: currentSymptoms,
      sensors: currentSensors,
      history: predictionHistory,
    };
    localStorage.setItem(
      STORAGE_KEYS.PATIENT_RECORDS_PREFIX + activePatientId,
      JSON.stringify(outgoingRecord)
    );

    // Resolve target patient ID (supports legacy keys 'alex' | 'priya' | 'guest')
    let targetId = patientIdOrKey;
    if (patientIdOrKey === 'alex') targetId = 'pat_alex_01';
    else if (patientIdOrKey === 'priya') targetId = 'pat_priya_02';
    else if (patientIdOrKey === 'guest') targetId = 'pat_guest_03';

    const targetPatient = patients.find(p => p.id === targetId);
    if (!targetPatient) {
      showToast(`Patient not found: ${patientIdOrKey}`, 'error');
      return;
    }

    setActivePatientId(targetId);

    // Check if target patient has stored records
    const stored = localStorage.getItem(STORAGE_KEYS.PATIENT_RECORDS_PREFIX + targetId);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.symptoms && parsed.sensors) {
          setCurrentSymptoms(parsed.symptoms);
          setCurrentSensors(parsed.sensors);
          setPredictionHistory(parsed.history || []);
          setLatestPrediction(parsed.history?.[0] || null);
          showToast(`Switched active profile to ${targetPatient.name}.`, 'info');
          return;
        }
      } catch (e) {
        console.error('Error loading patient data:', e);
      }
    }

    // If no custom stored records, check if preset package exists
    const preset = PRESET_PATIENTS.find(p => p.patient.id === targetId);
    if (preset) {
      setCurrentSymptoms(preset.defaultSymptoms);
      setCurrentSensors(preset.defaultSensors);
      const seedHistory = buildSeedPredictionsForPatient(preset);
      setPredictionHistory(seedHistory);
      setLatestPrediction(seedHistory[0] || null);
    } else {
      // Newly created patient: generate baseline readings
      const basePefr = calculatePredictedPefr(targetPatient.age, targetPatient.gender, targetPatient.height_cm);
      const freshSensors: SensorReading = {
        id: `sens_${targetPatient.id}`,
        user_id: targetPatient.user_id,
        spo2: 97.5,
        heart_rate: 72,
        temperature_c: 26.5,
        humidity_pct: 55,
        dust_density_mgm3: 0.05,
        pm25_est: 30.0,
        aqi: 65,
        pefr_lmin: basePefr.predictedPefr,
        source: 'esp32_wifi',
        recorded_at: new Date().toISOString(),
      };
      const freshSymptoms: SymptomLog = {
        id: `symp_${targetPatient.id}`,
        user_id: targetPatient.user_id,
        cough: 0,
        wheezing: 0,
        shortness_of_breath: 0,
        chest_tightness: 0,
        night_cough: 0,
        symptom_score: 0,
        notes: '',
        recorded_at: new Date().toISOString(),
      };
      const initialPred = runAsthmaRiskInference(targetPatient, freshSymptoms, freshSensors);

      setCurrentSensors(freshSensors);
      setCurrentSymptoms(freshSymptoms);
      setPredictionHistory([initialPred]);
      setLatestPrediction(initialPred);
    }

    showToast(`Switched active profile to ${targetPatient.name}.`, 'info');
  }, [activePatientId, currentSymptoms, currentSensors, predictionHistory, patients, showToast]);

  // Add new patient (Create)
  const addPatient = useCallback((
    newPatientData: Omit<Patient, 'id' | 'created_at' | 'updated_at'>,
    autoSwitch: boolean = true
  ): Patient => {
    const newId = `pat_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const newPatient: Patient = {
      ...newPatientData,
      id: newId,
      created_at: timestamp,
      updated_at: timestamp,
    };

    setPatients(prev => [newPatient, ...prev]);

    // Setup initial baseline telemetry for this new patient
    const basePefr = calculatePredictedPefr(newPatient.age, newPatient.gender, newPatient.height_cm);
    const newSensors: SensorReading = {
      id: `sens_${newPatient.id}`,
      user_id: newPatient.user_id,
      spo2: 97.8,
      heart_rate: 72,
      temperature_c: 26.0,
      humidity_pct: 52,
      dust_density_mgm3: 0.048,
      pm25_est: 28.5,
      aqi: 62,
      pefr_lmin: basePefr.predictedPefr,
      source: 'esp32_wifi',
      recorded_at: timestamp,
    };

    const newSymptoms: SymptomLog = {
      id: `symp_${newPatient.id}`,
      user_id: newPatient.user_id,
      cough: 0,
      wheezing: 0,
      shortness_of_breath: 0,
      chest_tightness: 0,
      night_cough: 0,
      symptom_score: 0,
      notes: 'Initial clinical registration baseline.',
      recorded_at: timestamp,
    };

    const initialPred = runAsthmaRiskInference(newPatient, newSymptoms, newSensors);

    // Store records for this patient
    localStorage.setItem(
      STORAGE_KEYS.PATIENT_RECORDS_PREFIX + newId,
      JSON.stringify({
        symptoms: newSymptoms,
        sensors: newSensors,
        history: [initialPred],
      })
    );

    showToast(`Registered patient "${newPatient.name}" into clinical registry.`, 'success');

    if (autoSwitch) {
      switchPatient(newId);
    }

    return newPatient;
  }, [switchPatient, showToast]);

  // Update active patient details (Update)
  const updatePatient = useCallback((updated: Partial<Patient>) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id === activePatientId) {
          return {
            ...p,
            ...updated,
            updated_at: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    showToast('Patient clinical profile updated.', 'success');
  }, [activePatientId, showToast]);

  // Update patient by ID (Update)
  const updatePatientById = useCallback((id: string, updated: Partial<Patient>) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            ...updated,
            updated_at: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    showToast('Patient record updated.', 'success');
  }, [showToast]);

  // Delete patient (Delete)
  const deletePatient = useCallback((id: string): boolean => {
    if (patients.length <= 1) {
      showToast('Cannot delete the only remaining patient in the clinical registry.', 'error');
      return false;
    }

    const patientToDelete = patients.find(p => p.id === id);
    const remaining = patients.filter(p => p.id !== id);
    setPatients(remaining);

    // Remove stored records for this patient
    localStorage.removeItem(STORAGE_KEYS.PATIENT_RECORDS_PREFIX + id);

    // If deleted patient was active, switch to first remaining
    if (id === activePatientId) {
      const nextActive = remaining[0];
      switchPatient(nextActive.id);
    }

    showToast(`Deleted patient "${patientToDelete?.name || id}" from registry.`, 'info');
    return true;
  }, [patients, activePatientId, switchPatient, showToast]);

  // Retrieve patient records for report generator or viewing without switching
  const getPatientData = useCallback((patientId: string) => {
    // If currently active, return current live state
    if (patientId === activePatientId) {
      return {
        symptoms: currentSymptoms,
        sensors: currentSensors,
        history: predictionHistory,
      };
    }

    // Check stored records
    const stored = localStorage.getItem(STORAGE_KEYS.PATIENT_RECORDS_PREFIX + patientId);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.symptoms && parsed.sensors) {
          return parsed;
        }
      } catch (e) {
        console.error('Error loading patient data:', e);
      }
    }

    // Check preset
    const preset = PRESET_PATIENTS.find(p => p.patient.id === patientId);
    if (preset) {
      return {
        symptoms: preset.defaultSymptoms,
        sensors: preset.defaultSensors,
        history: buildSeedPredictionsForPatient(preset),
      };
    }

    return null;
  }, [activePatientId, currentSymptoms, currentSensors, predictionHistory]);

  // Export data helper
  const exportData = useCallback((format: 'csv' | 'json' = 'csv', targetPatientId?: string) => {
    if (format === 'json') {
      exportAllPatientsJson(patients, patient, predictionHistory);
      showToast('Exported complete patient registry and telemetry history as JSON.', 'success');
    } else {
      const target = patients.find(p => p.id === targetPatientId) || patient;
      exportPatientRecordsCsv(target, predictionHistory, currentSensors, currentSymptoms);
      showToast(`Exported clinical telemetry history for ${target.name} as CSV.`, 'success');
    }
  }, [patients, patient, predictionHistory, currentSensors, currentSymptoms, showToast]);

  // ----------------------------------------------------
  // SYMPTOMS & SENSORS HANDLING
  // ----------------------------------------------------

  const setSymptomField = useCallback((
    field: keyof Omit<SymptomLog, 'id' | 'user_id' | 'symptom_score' | 'recorded_at'>,
    val: number | string
  ) => {
    setCurrentSymptoms(prev => {
      const next = { ...prev, [field]: val };
      const score = (next.cough || 0) + (next.wheezing || 0) + (next.shortness_of_breath || 0) + (next.chest_tightness || 0) + (next.night_cough || 0);
      next.symptom_score = score;
      return next;
    });
  }, []);

  const resetSymptoms = useCallback(() => {
    setCurrentSymptoms({
      id: 'symp_' + Date.now(),
      user_id: patient.user_id,
      cough: 0,
      wheezing: 0,
      shortness_of_breath: 0,
      chest_tightness: 0,
      night_cough: 0,
      symptom_score: 0,
      notes: '',
      recorded_at: new Date().toISOString(),
    });
    showToast('Symptom check-in cleared.', 'info');
  }, [patient.user_id, showToast]);

  const saveCurrentSymptoms = useCallback((): SymptomLog => {
    const saved: SymptomLog = {
      ...currentSymptoms,
      id: 'symp_' + Date.now(),
      user_id: patient.user_id,
      recorded_at: new Date().toISOString(),
    };
    setCurrentSymptoms(saved);
    localStorage.setItem(STORAGE_KEYS.SYMPTOMS, JSON.stringify(saved));
    return saved;
  }, [currentSymptoms, patient.user_id]);

  const setSensorField = useCallback((
    field: keyof Omit<SensorReading, 'id' | 'user_id' | 'source' | 'recorded_at'>,
    val: number
  ) => {
    setCurrentSensors(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'dust_density_mgm3') {
        const pm25 = Math.round(val * 1000 * 0.6 * 10) / 10;
        next.pm25_est = pm25;
        const conv = convertDustVoltageToPm25((val + 0.1) / 0.17);
        next.aqi = conv.aqi;
      } else if (field === 'pm25_est') {
        const conv = convertDustVoltageToPm25((val / (1000 * 0.6) + 0.1) / 0.17);
        next.aqi = conv.aqi;
      }
      return next;
    });
  }, []);

  const applyPresetScenario = useCallback((presetId: string) => {
    const found = CLINICAL_PRESETS.find(p => p.id === presetId);
    if (!found) return;

    setCurrentSensors(prev => ({
      ...prev,
      spo2: found.values.spo2,
      heart_rate: found.values.heartRate,
      temperature_c: found.values.temperatureC,
      humidity_pct: found.values.humidityPct,
      dust_density_mgm3: found.values.dustDensity,
      pm25_est: found.values.pm25Est,
      aqi: convertDustVoltageToPm25((found.values.dustDensity + 0.1) / 0.17).aqi,
      pefr_lmin: found.values.pefrLmin,
      source: 'esp32_wifi',
      recorded_at: new Date().toISOString(),
    }));

    setCurrentSymptoms(prev => ({
      ...prev,
      cough: found.values.symptoms.cough,
      wheezing: found.values.symptoms.wheezing,
      shortness_of_breath: found.values.symptoms.shortness_of_breath,
      chest_tightness: found.values.symptoms.chest_tightness,
      night_cough: found.values.symptoms.night_cough,
      symptom_score:
        found.values.symptoms.cough +
        found.values.symptoms.wheezing +
        found.values.symptoms.shortness_of_breath +
        found.values.symptoms.chest_tightness +
        found.values.symptoms.night_cough,
      notes: `Applied scenario preset: ${found.name}`,
    }));

    showToast(`Loaded scenario: ${found.name}`, 'info');
  }, [showToast]);

  const processSerialInput = useCallback((serialText: string): boolean => {
    try {
      let parsed: Record<string, any> | null = null;
      const trimmed = serialText.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        parsed = JSON.parse(trimmed);
      } else {
        parsed = {};
        const pairs = trimmed.split(/[\n,;]+/);
        for (const pair of pairs) {
          const [k, v] = pair.split(/[:=]/).map(s => s.trim().toLowerCase());
          if (!k || !v) continue;
          const num = parseFloat(v);
          if (isNaN(num)) continue;
          if (k.includes('spo2') || k.includes('o2')) parsed.spo2 = num;
          if (k.includes('hr') || k.includes('heart') || k.includes('pulse')) parsed.heart_rate = num;
          if (k.includes('temp')) parsed.temperature = num;
          if (k.includes('hum')) parsed.humidity = num;
          if (k.includes('pm25') || k.includes('pm2.5')) parsed.pm25_est = num;
          if (k.includes('dust')) parsed.dust_density_mgm3 = num;
          if (k.includes('pefr') || k.includes('flow')) parsed.pefr = num;
        }
      }

      if (!parsed || Object.keys(parsed).length === 0) return false;

      setCurrentSensors(prev => {
        const next = { ...prev };
        if (parsed!.spo2 !== undefined && !isNaN(parsed!.spo2)) next.spo2 = Number(parsed!.spo2);
        if (parsed!.heart_rate !== undefined && !isNaN(parsed!.heart_rate)) next.heart_rate = Number(parsed!.heart_rate);
        if (parsed!.temperature !== undefined && !isNaN(parsed!.temperature)) next.temperature_c = Number(parsed!.temperature);
        if (parsed!.humidity !== undefined && !isNaN(parsed!.humidity)) next.humidity_pct = Number(parsed!.humidity);
        if (parsed!.pefr !== undefined && !isNaN(parsed!.pefr)) next.pefr_lmin = Number(parsed!.pefr);

        if (parsed!.dust_density_mgm3 !== undefined && !isNaN(parsed!.dust_density_mgm3)) {
          next.dust_density_mgm3 = Number(parsed!.dust_density_mgm3);
          const calc = convertDustVoltageToPm25((next.dust_density_mgm3 + 0.1) / 0.17);
          next.pm25_est = calc.pm25Est;
          next.aqi = calc.aqi;
        } else if (parsed!.pm25_est !== undefined && !isNaN(parsed!.pm25_est)) {
          next.pm25_est = Number(parsed!.pm25_est);
          const calc = convertDustVoltageToPm25((next.pm25_est / (1000 * 0.6) + 0.1) / 0.17);
          next.aqi = calc.aqi;
        }

        next.source = 'esp32_serial';
        next.recorded_at = new Date().toISOString();
        return next;
      });

      setLastEsp32PacketTime(new Date().toISOString());
      setIsEsp32Connected(true);
      showToast('Successfully parsed serial telemetry packet.', 'success');
      return true;
    } catch (err) {
      showToast('Error parsing serial data. Ensure valid JSON or key-value format.', 'error');
      return false;
    }
  }, [showToast]);

  // Live telemetry stream simulator
  useEffect(() => {
    if (!isStreamingTelemetry || !isEsp32Connected) return;

    const interval = setInterval(() => {
      setCurrentSensors(prev => {
        const deltaSpo2 = (Math.random() - 0.5) * 0.4;
        const deltaHr = (Math.random() - 0.5) * 2;
        const deltaTemp = (Math.random() - 0.5) * 0.2;
        const deltaHum = (Math.random() - 0.5) * 0.5;
        const deltaPm25 = (Math.random() - 0.5) * 1.5;

        const newSpo2 = Math.min(100, Math.max(88, Math.round((prev.spo2 + deltaSpo2) * 10) / 10));
        const newHr = Math.min(140, Math.max(55, Math.round(prev.heart_rate + deltaHr)));
        const newTemp = Math.round((prev.temperature_c + deltaTemp) * 10) / 10;
        const newHum = Math.min(100, Math.max(20, Math.round(prev.humidity_pct + deltaHum)));
        const newPm25 = Math.max(5, Math.round((prev.pm25_est + deltaPm25) * 10) / 10);
        const newDust = Math.round((newPm25 / (1000 * 0.6)) * 1000) / 1000;
        const conv = convertDustVoltageToPm25((newDust + 0.1) / 0.17);

        return {
          ...prev,
          spo2: newSpo2,
          heart_rate: newHr,
          temperature_c: newTemp,
          humidity_pct: newHum,
          dust_density_mgm3: newDust,
          pm25_est: newPm25,
          aqi: conv.aqi,
          source: 'esp32_wifi',
          recorded_at: new Date().toISOString(),
        };
      });

      setLastEsp32PacketTime(new Date().toISOString());
    }, 2500);

    return () => clearInterval(interval);
  }, [isStreamingTelemetry, isEsp32Connected]);

  const toggleTelemetryStream = useCallback(() => {
    setIsStreamingTelemetry(prev => {
      const next = !prev;
      showToast(next ? 'Live ESP32 telemetry streaming active.' : 'Telemetry stream paused.', next ? 'success' : 'info');
      return next;
    });
  }, [showToast]);

  // Run ML Inference & Save Prediction
  const runPrediction = useCallback((): Prediction => {
    const prediction = runAsthmaRiskInference(patient, currentSymptoms, currentSensors, inferenceEnginePreference);
    setLatestPrediction(prediction);
    setPredictionHistory(prev => [prediction, ...prev]);
    showToast(
      `Asthma Risk Computed (${prediction.engine_type === 'trained_forest' ? 'Decision Forest' : 'Clinical Guidelines'}): ${prediction.risk_class} Risk.`,
      prediction.risk_class === 'High' ? 'error' : prediction.risk_class === 'Moderate' ? 'info' : 'success'
    );
    return prediction;
  }, [patient, currentSymptoms, currentSensors, inferenceEnginePreference, showToast]);

  const deletePrediction = useCallback((id: string) => {
    setPredictionHistory(prev => prev.filter(p => p.id !== id));
    showToast('Historical reading record deleted.', 'info');
  }, [showToast]);

  const clearAllHistory = useCallback(() => {
    setPredictionHistory([]);
    setLatestPrediction(null);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    showToast('All patient history and prediction records erased (Data Privacy Compliance).', 'success');
  }, [showToast]);

  const resetToDefaultData = useCallback(() => {
    const defaultList = PRESET_PATIENTS.map(p => p.patient);
    setPatients(defaultList);
    setActivePatientId(defaultList[0].id);
    const initialPreset = PRESET_PATIENTS[0];
    const seed = buildSeedPredictionsForPatient(initialPreset);
    setPredictionHistory(seed);
    setLatestPrediction(seed[0]);
    setCurrentSensors(initialPreset.defaultSensors);
    setCurrentSymptoms(initialPreset.defaultSymptoms);
    localStorage.clear();
    showToast('Reset system to verified NHANES + CPCB baseline test data.', 'info');
  }, [showToast]);

  return (
    <AppContext.Provider
      value={{
        patient,
        patients,
        activePatientId,
        updatePatient,
        updatePatientById,
        addPatient,
        deletePatient,
        switchPatient,
        getPatientData,
        exportData,
        isReportModalOpen,
        setIsReportModalOpen,
        reportTargetPatientId,
        openReportModal,
        closeReportModal,
        currentSymptoms,
        setSymptomField,
        resetSymptoms,
        saveCurrentSymptoms,
        currentSensors,
        setSensorField,
        applyPresetScenario,
        processSerialInput,
        webSerialStatus,
        connectHardwareSerial,
        disconnectHardwareSerial,
        supabaseConfig,
        updateSupabaseConfig,
        isSupabaseConnected,
        isSupabaseStreaming,
        setIsSupabaseStreaming,
        syncReadingToSupabase,
        syncPredictionToSupabase,
        applySupabaseSensorRow,
        fetchAndApplyLatestSupabaseReading,
        isHardwareOrCloudModalOpen,
        setIsHardwareOrCloudModalOpen,
        currentUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authSignInMethod,
        authSignUpMethod,
        authSignOutMethod,
        authResetPasswordMethod,
        inferenceEnginePreference,
        setInferenceEnginePreference,
        isEsp32Connected,
        setIsEsp32Connected,
        isStreamingTelemetry,
        toggleTelemetryStream,
        lastEsp32PacketTime,
        latestPrediction,
        predictionHistory,
        runPrediction,
        deletePrediction,
        clearAllHistory,
        resetToDefaultData,
        activeTab,
        setActiveTab,
        statusMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
