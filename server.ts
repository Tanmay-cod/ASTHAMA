import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'IoT Asthma Decision Support API',
      timestamp: new Date().toISOString(),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY)
    });
  });

  // Server-side Gemini Clinical AI Second-Opinion Consultation
  app.post('/api/clinical-consultation', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(200).json({
          available: false,
          message: 'GEMINI_API_KEY is not configured in the server environment. Provide GEMINI_API_KEY in the environment settings to activate live Gemini AI clinical consultations.',
          consultation: null
        });
      }

      const { patient, symptoms, sensors, prediction } = req.body;
      if (!patient || !sensors) {
        return res.status(400).json({ error: 'Missing clinical payload data (patient or sensors)' });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
You are an expert Pulmonologist and Clinical Decision Support AI Assistant.
Analyze this patient encounter for an asthma risk assessment:

PATIENT DEMOGRAPHICS:
- Name: ${patient.name}
- Age: ${patient.age} years | Gender: ${patient.gender} | Height: ${patient.height_cm} cm | Weight: ${patient.weight_kg} kg
- Smoker: ${patient.smoking ? 'Yes' : 'No'}
- Known Asthma Diagnosis: ${patient.asthma_diagnosed ? 'Yes' : 'No'}
- Family History of Asthma: ${patient.family_history_asthma ? 'Yes' : 'No'}
- Current Maintenance Medication: ${patient.medication || 'None documented'}

TELEMETRY & SENSOR READINGS:
- Measured PEFR: ${sensors.pefr_lmin} L/min (Nunn & Gregg Predicted Baseline: ${prediction?.predicted_pefr_reference || 'N/A'} L/min; ${prediction?.pefr_percent_predicted || 'N/A'}% of predicted)
- Blood Oxygen (SpO2): ${sensors.spo2}%
- Heart Rate: ${sensors.heart_rate} BPM
- Air Quality Index (AQI): ${sensors.aqi} (PM2.5 est: ${sensors.pm25_est} ug/m3)
- Ambient Temperature: ${sensors.temperature_c} °C | Humidity: ${sensors.humidity_pct}%

SELF-REPORTED SYMPTOMS:
- Cough: ${symptoms?.cough ?? 0} / 2
- Wheezing: ${symptoms?.wheezing ?? 0} / 2
- Dyspnea / Shortness of Breath: ${symptoms?.shortness_of_breath ?? 0} / 2
- Chest Tightness: ${symptoms?.chest_tightness ?? 0} / 2
- Nighttime Cough: ${symptoms?.night_cough ?? 0} / 2
- Composite Symptom Score: ${symptoms?.symptom_score ?? 0} / 10

DECISION FOREST PREDICTION:
- Risk Classification: ${prediction?.risk_class || 'N/A'}
- Probability Distribution: Low: ${(prediction?.prob_low * 100).toFixed(1)}%, Moderate: ${(prediction?.prob_medium * 100).toFixed(1)}%, High: ${(prediction?.prob_high * 100).toFixed(1)}%

Please provide a concise, structured clinical interpretation:
1. Spirometric & Respiratory Assessment (airflow limitation & gas exchange stability)
2. Environmental & Trigger Exposure Analysis (impact of AQI and ambient weather)
3. Actionable Clinical Recommendations (immediate intervention & maintenance action plan)
4. Red Flag Warning Signs (when to seek emergency hospital care)
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || 'No consultation text generated.';

      return res.json({
        available: true,
        model: 'gemini-2.5-flash',
        consultation: text,
        timestamp: new Date().toISOString()
      });

    } catch (err: any) {
      console.error('Gemini Consultation error:', err);
      return res.status(500).json({
        error: 'Failed to generate consultation from Gemini API',
        details: err.message
      });
    }
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Clinical Decision Support Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
