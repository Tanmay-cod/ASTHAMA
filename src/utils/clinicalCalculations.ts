/**
 * Clinical calculation utilities for Asthma Risk Prediction
 * Grounded in:
 * 1. Nunn & Gregg (1989) Peak Expiratory Flow Rate (PEFR) reference equations
 * 2. GP2Y optical dust sensor calibration (Sharp Application Note & TRD §3.1)
 * 3. Central Pollution Control Board (CPCB) / EPA AQI breakpoint derivation
 * 4. Physiological range validation constraints (TRD & RULES)
 */

export interface PefrPredictionResult {
  predictedPefr: number; // in L/min
  pefrPercent: number; // (measured / predicted) * 100
  clinicalZone: 'green' | 'yellow' | 'red'; // Asthma Action Plan standard
}

/**
 * Nunn & Gregg (1989) reference equations for predicted PEFR:
 * Men: predicted PEFR (L/min) = ((Height_m * 5.48) + 1.58 - (0.041 * Age)) * 60
 * Women: predicted PEFR (L/min) = ((Height_m * 3.72) + 2.24 - (0.030 * Age)) * 60
 */
export function calculatePredictedPefr(
  age: number,
  gender: 'male' | 'female' | 'other',
  heightCm: number,
  measuredPefrLmin?: number
): PefrPredictionResult {
  const heightM = Math.max(1.0, Math.min(2.5, heightCm / 100));
  const clampedAge = Math.max(12, Math.min(95, age));

  let predictedLmin: number;
  if (gender === 'male') {
    const pefrLsec = heightM * 5.48 + 1.58 - 0.041 * clampedAge;
    predictedLmin = Math.max(200, pefrLsec * 60);
  } else if (gender === 'female') {
    const pefrLsec = heightM * 3.72 + 2.24 - 0.030 * clampedAge;
    predictedLmin = Math.max(150, pefrLsec * 60);
  } else {
    // Average reference for other/non-binary
    const maleSec = heightM * 5.48 + 1.58 - 0.041 * clampedAge;
    const femaleSec = heightM * 3.72 + 2.24 - 0.030 * clampedAge;
    predictedLmin = Math.max(175, ((maleSec + femaleSec) / 2) * 60);
  }

  const roundedPred = Math.round(predictedLmin);
  const measured = measuredPefrLmin ?? roundedPred;
  const pefrPercent = Math.min(150, Math.max(10, Math.round((measured / roundedPred) * 100)));

  // Standard clinical Asthma Action Plan zones:
  // Green: >= 80% of predicted
  // Yellow: 50% - 79% of predicted (Caution)
  // Red: < 50% of predicted (Medical Alert)
  let clinicalZone: 'green' | 'yellow' | 'red' = 'green';
  if (pefrPercent < 50) {
    clinicalZone = 'red';
  } else if (pefrPercent < 80) {
    clinicalZone = 'yellow';
  }

  return {
    predictedPefr: roundedPred,
    pefrPercent,
    clinicalZone,
  };
}

/**
 * GP2Y1010AU0F / GP2Y1014AU0F dust sensor calibration
 * Voltage -> Dust Density (mg/m³) -> PM2.5 Equivalent (µg/m³) -> AQI
 * Equation: dust_density = 0.17 * V - 0.1 (Sharp documentation)
 * Calibration: PM2.5_est (µg/m³) ≈ dust_density_mg_m3 * 1000 * 0.6
 */
export function convertDustVoltageToPm25(voltage: number): {
  dustDensityMgM3: number;
  pm25Est: number;
  aqi: number;
  aqiCategory: string;
} {
  const clampedV = Math.max(0, Math.min(3.6, voltage));
  const dustDensity = Math.max(0.005, Math.min(0.8, 0.17 * clampedV - 0.1));
  const pm25 = Math.round(dustDensity * 1000 * 0.6 * 10) / 10;
  const { aqi, category } = calculateAqiFromPm25(pm25);

  return {
    dustDensityMgM3: Math.round(dustDensity * 1000) / 1000,
    pm25Est: pm25,
    aqi,
    aqiCategory: category,
  };
}

/**
 * CPCB / EPA AQI derivation from PM2.5 concentrations (µg/m³)
 */
export function calculateAqiFromPm25(pm25: number): { aqi: number; category: string; color: string } {
  // Breakpoints: [c_low, c_high, i_low, i_high, category, color]
  const table = [
    { cLow: 0.0, cHigh: 30.0, iLow: 0, iHigh: 50, cat: 'Good', color: '#16A34A' },
    { cLow: 30.1, cHigh: 60.0, iLow: 51, iHigh: 100, cat: 'Satisfactory', color: '#22C55E' },
    { cLow: 60.1, cHigh: 90.0, iLow: 101, iHigh: 200, cat: 'Moderate', color: '#D97706' },
    { cLow: 90.1, cHigh: 120.0, iLow: 201, iHigh: 300, cat: 'Poor', color: '#EA580C' },
    { cLow: 120.1, cHigh: 250.0, iLow: 301, iHigh: 400, cat: 'Very Poor', color: '#DC2626' },
    { cLow: 250.1, cHigh: 500.0, iLow: 401, iHigh: 500, cat: 'Severe', color: '#7F1D1D' },
  ];

  const val = Math.max(0, Math.min(500, pm25));
  let match = table[0];
  for (const row of table) {
    if (val <= row.cHigh) {
      match = row;
      break;
    }
    match = row;
  }

  const aqi = Math.round(
    ((match.iHigh - match.iLow) / (match.cHigh - match.cLow)) * (val - match.cLow) + match.iLow
  );

  return {
    aqi: Math.max(1, Math.min(500, aqi)),
    category: match.cat,
    color: match.color,
  };
}

/**
 * Sensor Range Validation Rules (Named constants per RULES §4 and §6)
 */
export const SENSOR_BOUNDS = {
  SPO2: { MIN: 50, MAX: 100, CRITICAL_LOW: 92, NORMAL_MIN: 95 },
  HEART_RATE: { MIN: 30, MAX: 220, TACHYCARDIA: 100, BRADYCARDIA: 55 },
  TEMPERATURE_C: { MIN: 10, MAX: 50, NORMAL_MIN: 18, NORMAL_MAX: 32 },
  HUMIDITY_PCT: { MIN: 10, MAX: 100, AIRWAY_DRY: 35, AIRWAY_HUMID: 75 },
  PEFR_LMIN: { MIN: 50, MAX: 900 },
};

export interface SensorValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateSensorReadings(readings: {
  spo2: number;
  heartRate: number;
  temperatureC: number;
  humidityPct: number;
  pefrLmin: number;
}): SensorValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // SpO2
  if (readings.spo2 < SENSOR_BOUNDS.SPO2.MIN || readings.spo2 > SENSOR_BOUNDS.SPO2.MAX) {
    errors.push(`SpO₂ reading (${readings.spo2}%) is outside valid biological sensor limits (50–100%).`);
  } else if (readings.spo2 < SENSOR_BOUNDS.SPO2.CRITICAL_LOW) {
    warnings.push(`Hypoxemia alert: Oxygen saturation (${readings.spo2}%) is below 92%.`);
  }

  // Heart Rate
  if (readings.heartRate < SENSOR_BOUNDS.HEART_RATE.MIN || readings.heartRate > SENSOR_BOUNDS.HEART_RATE.MAX) {
    errors.push(`Heart rate (${readings.heartRate} bpm) is outside physiological limits (30–220 bpm).`);
  } else if (readings.heartRate > SENSOR_BOUNDS.HEART_RATE.TACHYCARDIA) {
    warnings.push(`Tachycardia note: Heart rate elevated at ${readings.heartRate} bpm.`);
  }

  // Temperature
  if (readings.temperatureC < SENSOR_BOUNDS.TEMPERATURE_C.MIN || readings.temperatureC > SENSOR_BOUNDS.TEMPERATURE_C.MAX) {
    errors.push(`Ambient temperature (${readings.temperatureC}°C) is outside sensor range.`);
  }

  // Humidity
  if (readings.humidityPct < SENSOR_BOUNDS.HUMIDITY_PCT.MIN || readings.humidityPct > SENSOR_BOUNDS.HUMIDITY_PCT.MAX) {
    errors.push(`Ambient humidity (${readings.humidityPct}%) is outside valid limits.`);
  }

  // PEFR
  if (readings.pefrLmin < SENSOR_BOUNDS.PEFR_LMIN.MIN || readings.pefrLmin > SENSOR_BOUNDS.PEFR_LMIN.MAX) {
    errors.push(`PEFR entry (${readings.pefrLmin} L/min) is outside plausible range (50–900 L/min).`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Standard testing scenarios for demonstration and simulation
 */
export const CLINICAL_PRESETS = [
  {
    id: 'normal',
    name: 'Normal Physiological Baseline',
    description: 'Patient in stable condition; clean ambient air and normal airway flow.',
    values: {
      spo2: 98.5,
      heartRate: 72,
      temperatureC: 24.0,
      humidityPct: 52,
      dustDensity: 0.035,
      pm25Est: 21.0,
      pefrLmin: 480,
      symptoms: { cough: 0, wheezing: 0, shortness_of_breath: 0, chest_tightness: 0, night_cough: 0 },
    },
  },
  {
    id: 'pollution',
    name: 'High Pollution Episode (CPCB Exacerbation)',
    description: 'Elevated particulate matter (AQI > 220), mild wheezing and cough.',
    values: {
      spo2: 95.0,
      heartRate: 88,
      temperatureC: 28.5,
      humidityPct: 68,
      dustDensity: 0.22,
      pm25Est: 132.0,
      pefrLmin: 390,
      symptoms: { cough: 1, wheezing: 1, shortness_of_breath: 1, chest_tightness: 1, night_cough: 0 },
    },
  },
  {
    id: 'acute_exacerbation',
    name: 'Acute Bronchial Spasm / Severe Attack',
    description: 'Severe hypoxemia risk (SpO2 89%), low PEFR (< 50% predicted), active wheeze.',
    values: {
      spo2: 89.0,
      heartRate: 114,
      temperatureC: 21.0,
      humidityPct: 75,
      dustDensity: 0.16,
      pm25Est: 96.0,
      pefrLmin: 210,
      symptoms: { cough: 2, wheezing: 2, shortness_of_breath: 2, chest_tightness: 2, night_cough: 2 },
    },
  },
  {
    id: 'cold_dry_air',
    name: 'Cold & Dry Winter Weather Trigger',
    description: 'Cold ambient temp (13°C), dry air (22% humidity), inducing airway reactivity.',
    values: {
      spo2: 96.0,
      heartRate: 82,
      temperatureC: 13.5,
      humidityPct: 22,
      dustDensity: 0.09,
      pm25Est: 54.0,
      pefrLmin: 360,
      symptoms: { cough: 1, wheezing: 1, shortness_of_breath: 0, chest_tightness: 1, night_cough: 1 },
    },
  },
];
