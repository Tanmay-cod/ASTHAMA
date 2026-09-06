export type RiskLevel = 'Low' | 'Moderate' | 'High';

export type SensorSource = 
  | 'esp32_wifi' 
  | 'esp32_serial' 
  | 'nodemcu_esp8266_wifi' 
  | 'nodemcu_esp8266_serial' 
  | 'manual';

export interface Patient {
  id: string;
  user_id: string;
  name: string;
  email: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height_cm: number;
  weight_kg: number;
  smoking: boolean;
  family_history_asthma: boolean;
  asthma_diagnosed: boolean;
  medication: string;
  created_at: string;
  updated_at: string;
}

export interface SymptomLog {
  id: string;
  user_id: string;
  cough: number; // 0: None, 1: Mild/Intermittent, 2: Frequent/Severe
  wheezing: number; // 0: None, 1: Mild/Audible on exertion, 2: Severe/Audible at rest
  shortness_of_breath: number; // 0: None, 1: Moderate exertion, 2: At rest/Speaking
  chest_tightness: number; // 0: None, 1: Mild, 2: Severe/Constrictive
  night_cough: number; // 0: None, 1: Woke up once, 2: Frequent awakenings
  symptom_score: number; // Composite 0-10
  notes?: string;
  recorded_at: string;
}

export interface SensorReading {
  id: string;
  user_id: string;
  spo2: number; // 50 - 100 %
  heart_rate: number; // 30 - 220 bpm
  temperature_c: number; // e.g. 24.5 °C
  humidity_pct: number; // e.g. 58 %
  dust_density_mgm3: number; // Raw GP2Y optical reading, mg/m³
  pm25_est: number; // Derivation: dust_density * 1000 * 0.6 µg/m³
  aqi: number; // Computed AQI index 0 - 500
  pefr_lmin: number; // Measured PEFR in L/min
  source: SensorSource;
  recorded_at: string;
  isFingerDetected?: boolean;
}

export interface ShapFeatureImpact {
  feature: string;
  label: string;
  value: string | number;
  impact: number; // Positive = pushes toward higher risk, Negative = protects/pushes toward lower risk
  direction: 'increases_risk' | 'decreases_risk';
  clinicalContext: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  sensor_reading_id?: string;
  symptom_log_id?: string;
  risk_class: RiskLevel;
  prob_low: number;
  prob_medium: number;
  prob_high: number;
  top_shap_features: ShapFeatureImpact[];
  model_version: string;
  engine_type?: 'trained_forest' | 'clinical_guideline_baseline';
  tree_votes_count?: number;
  predicted_pefr_reference: number;
  pefr_percent_predicted: number;
  assembled_features: {
    age: number;
    gender: string;
    height_cm: number;
    smoking: boolean;
    family_history_asthma: boolean;
    symptom_score: number;
    pefr_pct_pred: number;
    spo2: number;
    heart_rate: number;
    aqi: number;
    temperature_c: number;
    humidity_pct: number;
  };
  recommendation: {
    summary: string;
    actions: string[];
    monitoringAdvice: string;
    urgencyLevel: 'routine' | 'elevated_monitoring' | 'immediate_clinical_attention';
  };
  created_at: string;
}

export type ActiveTab = 
  | 'dashboard'
  | 'checkin'
  | 'sensor'
  | 'result'
  | 'history'
  | 'analytics'
  | 'profile'
  | 'architecture';
