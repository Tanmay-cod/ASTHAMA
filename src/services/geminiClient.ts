import { Patient, SymptomLog, SensorReading, Prediction } from '../types';

export interface GeminiConsultationResponse {
  available: boolean;
  model?: string;
  consultation?: string | null;
  message?: string;
  error?: string;
}

export async function requestGeminiClinicalConsultation(
  patient: Patient,
  symptoms: SymptomLog,
  sensors: SensorReading,
  prediction: Prediction
): Promise<GeminiConsultationResponse> {
  try {
    const res = await fetch('/api/clinical-consultation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patient,
        symptoms,
        sensors,
        prediction,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return {
        available: false,
        error: errBody.error || `Server responded with status ${res.status}`,
      };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      available: false,
      error: err.message || 'Unable to connect to clinical consultation service',
    };
  }
}
