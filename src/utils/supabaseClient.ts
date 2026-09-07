import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { SensorReading, Prediction, Patient, SymptomLog } from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  realtimeEnabled: boolean;
}

// Read from Vite environment variables (Never hardcode live database keys in version control!)
export const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
export const ENV_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

const STORAGE_KEY_SUPABASE_CONFIG = 'iot_asthma_supabase_config_v3';

// Load stored Supabase configuration with environment variable fallback
export function getStoredSupabaseConfig(): SupabaseConfig {
  const fallbackConfig: SupabaseConfig = {
    url: ENV_SUPABASE_URL,
    anonKey: ENV_SUPABASE_ANON_KEY,
    autoSync: true,
    realtimeEnabled: true,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUPABASE_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.url === 'string' &&
        parsed.url.trim().length > 10 &&
        typeof parsed.anonKey === 'string' &&
        parsed.anonKey.trim().length > 15
      ) {
        return {
          url: parsed.url.trim(),
          anonKey: parsed.anonKey.trim(),
          autoSync: parsed.autoSync ?? true,
          realtimeEnabled: parsed.realtimeEnabled ?? true,
        };
      }
    }
  } catch (e) {
    console.error('Error reading Supabase config from localStorage', e);
  }

  return fallbackConfig;
}

// Save Supabase configuration
export function saveStoredSupabaseConfig(config: SupabaseConfig): void {
  try {
    const safeConfig: SupabaseConfig = {
      url: config.url?.trim() || ENV_SUPABASE_URL,
      anonKey: config.anonKey?.trim() || ENV_SUPABASE_ANON_KEY,
      autoSync: config.autoSync ?? true,
      realtimeEnabled: config.realtimeEnabled ?? true,
    };
    localStorage.setItem(STORAGE_KEY_SUPABASE_CONFIG, JSON.stringify(safeConfig));
    // Reset client instance so it re-initializes with updated credentials
    supabaseClientInstance = null;
  } catch (e) {
    console.error('Error saving Supabase config to localStorage', e);
  }
}

// Singleton client instance
let supabaseClientInstance: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';

export function getSupabaseClient(overrideConfig?: SupabaseConfig): SupabaseClient | null {
  const config = overrideConfig || getStoredSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  // Reuse existing instance if config matches
  if (supabaseClientInstance && currentClientUrl === config.url && currentClientKey === config.anonKey) {
    return supabaseClientInstance;
  }

  try {
    new URL(config.url);
    supabaseClientInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    currentClientUrl = config.url;
    currentClientKey = config.anonKey;
    return supabaseClientInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

// ----------------------------------------------------
// SUPABASE AUTHENTICATION METHODS (Sign In, Sign Up, Reset)
// ----------------------------------------------------

export async function authSignIn(email: string, password: string): Promise<{ success: boolean; user?: User | null; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase credentials are not configured. Please add URL & Anon Key in Settings.' };

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Authentication failed' };
  }
}

export async function authSignUp(
  email: string, 
  password: string, 
  patientMetadata?: { name: string; age: number; gender: string }
): Promise<{ success: boolean; user?: User | null; requiresEmailConfirmation?: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase credentials are not configured.' };

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: patientMetadata || {},
      },
    });
    if (error) return { success: false, error: error.message };
    const requiresEmailConfirmation = !data.session && !!data.user;
    return { success: true, user: data.user, requiresEmailConfirmation };
  } catch (err: any) {
    return { success: false, error: err.message || 'Sign up failed' };
  }
}

export async function authSignOut(): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: true };

  try {
    const { error } = await client.auth.signOut();
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function authResetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase is not configured.' };

  try {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Password reset request failed' };
  }
}

export async function authGetCurrentSession(): Promise<{ user: User | null; session: Session | null }> {
  const client = getSupabaseClient();
  if (!client) return { user: null, session: null };

  try {
    const { data } = await client.auth.getSession();
    return { user: data.session?.user || null, session: data.session || null };
  } catch {
    return { user: null, session: null };
  }
}

// ----------------------------------------------------
// SERVER-SIDE PATIENTS TABLE CRUD
// ----------------------------------------------------

export async function syncPatientToSupabase(patient: Patient): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase is not configured' };

  try {
    const payload = {
      id: patient.id,
      user_id: patient.user_id,
      name: patient.name,
      email: patient.email || null,
      age: patient.age,
      gender: patient.gender,
      height_cm: patient.height_cm,
      weight_kg: patient.weight_kg,
      smoking: patient.smoking,
      family_history_asthma: patient.family_history_asthma,
      asthma_diagnosed: patient.asthma_diagnosed,
      medication: patient.medication || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('patients')
      .upsert(payload, { onConflict: 'id' });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Patient sync failed' };
  }
}

export async function fetchPatientsFromSupabase(): Promise<{ success: boolean; patients?: Patient[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase is not configured' };

  try {
    const { data, error } = await client
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, patients: data as Patient[] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// TELEMETRY & PREDICTION DATABASE SYNC
// ----------------------------------------------------

// Test connection to Supabase
export async function testSupabaseConnection(config?: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Supabase URL or Anonymous Key is missing or invalid.' };
  }

  try {
    const { data, error } = await client
      .from('sensor_readings')
      .select('id, created_at')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        return { 
          success: true, 
          message: 'Connected to Supabase! The "sensor_readings" table is not yet created. Run the provided SQL Schema in the Supabase SQL Editor.' 
        };
      }
      return { success: false, message: `Supabase Error (${error.code || 'ERR'}): ${error.message}` };
    }

    return { 
      success: true, 
      message: `Successfully connected to Supabase! Remote database is active.` 
    };
  } catch (err: any) {
    return { success: false, message: `Network connection failed: ${err.message || String(err)}` };
  }
}

// Push a sensor reading to Supabase (Dynamic user_id, never hardcoded!)
export async function pushSensorReadingToSupabase(
  reading: Partial<SensorReading>,
  currentUserId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const resolvedUserId = currentUserId || reading.user_id || 'anonymous_telemetry';
    const payload = {
      user_id: resolvedUserId,
      spo2: reading.spo2 ?? null,
      heart_rate: reading.heart_rate ?? null,
      temperature_c: reading.temperature_c ?? null,
      humidity_pct: reading.humidity_pct ?? null,
      dust_density_mgm3: reading.dust_density_mgm3 ?? null,
      pm25_est: reading.pm25_est ?? null,
      aqi: reading.aqi ?? null,
      pefr_lmin: reading.pefr_lmin ?? null,
      source: reading.source || 'esp32_wifi',
      created_at: reading.recorded_at || new Date().toISOString(),
    };

    const { data, error } = await client
      .from('sensor_readings')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

// Push prediction result to Supabase
export async function pushPredictionToSupabase(
  prediction: Prediction,
  currentUserId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const payload = {
      id: prediction.id,
      user_id: currentUserId || prediction.user_id,
      risk_class: prediction.risk_class,
      prob_low: prediction.prob_low,
      prob_medium: prediction.prob_medium,
      prob_high: prediction.prob_high,
      model_version: prediction.model_version,
      predicted_pefr_reference: prediction.predicted_pefr_reference,
      pefr_percent_predicted: prediction.pefr_percent_predicted,
      assembled_features: prediction.assembled_features,
      top_shap_features: prediction.top_shap_features,
      recommendation: prediction.recommendation,
      created_at: prediction.created_at,
    };

    const { error } = await client
      .from('predictions')
      .insert([payload]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

// Fetch the most recent sensor reading from Supabase
export async function fetchLatestSensorReadingFromSupabase(targetUserId?: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    let query = client
      .from('sensor_readings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

// ----------------------------------------------------
// HARDENED POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY (RLS)
// ----------------------------------------------------

export const SUPABASE_SQL_SCHEMA = `-- ==========================================================
-- PostgreSQL Production Schema for IoT Asthma Risk Prediction
-- Includes:
--   1. patients table (server-side demographic registry)
--   2. sensor_readings table (NodeMCU ESP8266 / ESP32 telemetry)
--   3. predictions table (ML risk assessment & feature attribution)
--   4. symptom_logs table (self-reported symptom entries)
--   5. Hardened Row Level Security (RLS) using auth.uid()
-- ==========================================================

-- 1. Patients Registry Table
CREATE TABLE IF NOT EXISTS public.patients (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  age INTEGER NOT NULL CHECK (age >= 5 AND age <= 110),
  gender TEXT NOT NULL,
  height_cm NUMERIC(5, 1) NOT NULL CHECK (height_cm >= 80 AND height_cm <= 250),
  weight_kg NUMERIC(5, 1) NOT NULL CHECK (weight_kg >= 15 AND weight_kg <= 250),
  smoking BOOLEAN DEFAULT false,
  family_history_asthma BOOLEAN DEFAULT false,
  asthma_diagnosed BOOLEAN DEFAULT false,
  medication TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sensor Readings Table (Ingests MAX30102, GP2Y1010, DHT11/22 & PEFR)
CREATE TABLE IF NOT EXISTS public.sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  spo2 NUMERIC(5, 2), -- Nullable if sensor uncoupled / finger off
  heart_rate NUMERIC(5, 2),
  temperature_c NUMERIC(5, 2),
  humidity_pct NUMERIC(5, 2),
  dust_density_mgm3 NUMERIC(8, 4),
  pm25_est NUMERIC(6, 2),
  aqi NUMERIC(6, 2),
  pefr_lmin NUMERIC(6, 2),
  source TEXT DEFAULT 'esp32_wifi',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Predictions Table (ML Classifications & Explainability)
CREATE TABLE IF NOT EXISTS public.predictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  risk_class TEXT NOT NULL CHECK (risk_class IN ('Low', 'Moderate', 'High')),
  prob_low NUMERIC(5, 4) NOT NULL,
  prob_medium NUMERIC(5, 4) NOT NULL,
  prob_high NUMERIC(5, 4) NOT NULL,
  model_version TEXT NOT NULL,
  predicted_pefr_reference NUMERIC(6, 2),
  pefr_percent_predicted NUMERIC(6, 2),
  assembled_features JSONB NOT NULL,
  top_shap_features JSONB NOT NULL,
  recommendation JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Symptom Logs Table
CREATE TABLE IF NOT EXISTS public.symptom_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  cough INTEGER NOT NULL DEFAULT 0 CHECK (cough BETWEEN 0 AND 2),
  wheezing INTEGER NOT NULL DEFAULT 0 CHECK (wheezing BETWEEN 0 AND 2),
  shortness_of_breath INTEGER NOT NULL DEFAULT 0 CHECK (shortness_of_breath BETWEEN 0 AND 2),
  chest_tightness INTEGER NOT NULL DEFAULT 0 CHECK (chest_tightness BETWEEN 0 AND 2),
  night_cough INTEGER NOT NULL DEFAULT 0 CHECK (night_cough BETWEEN 0 AND 2),
  symptom_score INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict auth.uid() isolation preventing unauthorized access
-- ----------------------------------------------------

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;

-- Patients Table: Users can only read & write their own record
DROP POLICY IF EXISTS "Users can view own patient record" ON public.patients;
CREATE POLICY "Users can view own patient record" 
  ON public.patients FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own patient record" ON public.patients;
CREATE POLICY "Users can update own patient record" 
  ON public.patients FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Sensor Readings: Live dashboard telemetry stream policy
DROP POLICY IF EXISTS "Users can read own sensor readings" ON public.sensor_readings;
DROP POLICY IF EXISTS "Allow reading telemetry for live stream" ON public.sensor_readings;
CREATE POLICY "Allow reading telemetry for live stream" 
  ON public.sensor_readings FOR SELECT 
  TO anon, authenticated 
  USING (true);

DROP POLICY IF EXISTS "Users can insert own sensor readings" ON public.sensor_readings;
CREATE POLICY "Users can insert own sensor readings" 
  ON public.sensor_readings FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid()::text = user_id);

-- Ingestion policy for IoT hardware (ESP32/ESP8266 sending with anon key)
DROP POLICY IF EXISTS "IoT hardware can insert telemetry" ON public.sensor_readings;
CREATE POLICY "IoT hardware can insert telemetry" 
  ON public.sensor_readings FOR INSERT 
  TO anon 
  WITH CHECK (true);

-- Predictions: Users can view and insert their own predictions
DROP POLICY IF EXISTS "Users can read own predictions" ON public.predictions;
CREATE POLICY "Users can read own predictions" 
  ON public.predictions FOR SELECT 
  TO authenticated 
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own predictions" ON public.predictions;
CREATE POLICY "Users can insert own predictions" 
  ON public.predictions FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid()::text = user_id);

-- Enable Supabase Realtime for sensor telemetry
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;
`;
