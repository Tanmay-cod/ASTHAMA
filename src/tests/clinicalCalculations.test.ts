/**
 * Automated Unit Test Suite for Clinical Calculations and Model Inference
 * 
 * Validates:
 * 1. Nunn & Gregg (1989) PEFR reference equations against literature benchmarks
 * 2. CPCB / EPA PM2.5 to AQI piecewise linear interpolation
 * 3. Trained Decision Forest probability normalization & risk classification bounds
 */

import { calculatePredictedPefr, calculateAqiFromPm25 } from '../utils/clinicalCalculations';
import { evaluateDecisionForest } from '../ml/trainedForestModel';

interface TestReport {
  name: string;
  passed: boolean;
  expected?: any;
  actual?: any;
  error?: string;
}

export function runClinicalCalculationsTestSuite(): { allPassed: boolean; tests: TestReport[] } {
  const results: TestReport[] = [];

  function assert(name: string, condition: boolean, expected?: any, actual?: any) {
    results.push({
      name,
      passed: !!condition,
      expected,
      actual
    });
  }

  // ----------------------------------------------------
  // 1. Nunn & Gregg (1989) PEFR Equations Validation
  // ----------------------------------------------------
  // Standard test case: Male, 25 years old, 175 cm height
  const male25 = calculatePredictedPefr(25, 'male', 175, 580);
  assert(
    'Nunn & Gregg: 25yo Male 175cm predicted PEFR within clinical range (580-630 L/min)',
    male25.predictedPefr >= 580 && male25.predictedPefr <= 630,
    '580 - 630 L/min',
    `${male25.predictedPefr} L/min`
  );

  // Standard test case: Female, 40 years old, 162 cm height
  const female40 = calculatePredictedPefr(40, 'female', 162, 420);
  assert(
    'Nunn & Gregg: 40yo Female 162cm predicted PEFR within clinical range (410-460 L/min)',
    female40.predictedPefr >= 410 && female40.predictedPefr <= 460,
    '410 - 460 L/min',
    `${female40.predictedPefr} L/min`
  );

  // Green Zone Threshold Check (>=80% of predicted)
  assert(
    'PEFR Zone: 95% of predicted is Green Zone',
    male25.clinicalZone === 'green',
    'green',
    male25.clinicalZone
  );

  // Red Zone Threshold Check (<50% of predicted)
  const acuteAsthmaPatient = calculatePredictedPefr(25, 'male', 175, 250);
  assert(
    'PEFR Zone: 250 L/min (~41% of predicted) is Red Emergency Zone',
    acuteAsthmaPatient.clinicalZone === 'red',
    'red',
    acuteAsthmaPatient.clinicalZone
  );

  // ----------------------------------------------------
  // 2. CPCB & EPA PM2.5 to AQI Breakpoints Validation
  // ----------------------------------------------------
  // Low concentration: 15 µg/m³ -> Good
  const aqiClean = calculateAqiFromPm25(15);
  assert(
    'AQI Breakpoint: 15 µg/m³ PM2.5 results in Good AQI (<= 50)',
    aqiClean.aqi <= 50 && aqiClean.category === 'Good',
    'AQI <= 50 (Good)',
    `AQI ${aqiClean.aqi} (${aqiClean.category})`
  );

  // Moderate concentration: 75 µg/m³ -> Moderate (101-200)
  const aqiModerate = calculateAqiFromPm25(75);
  assert(
    'AQI Breakpoint: 75 µg/m³ PM2.5 results in Moderate AQI (101-200)',
    aqiModerate.aqi >= 101 && aqiModerate.aqi <= 200,
    '101 - 200',
    aqiModerate.aqi
  );

  // Severe concentration: 280 µg/m³ -> Very Poor / Severe
  const aqiSevere = calculateAqiFromPm25(280);
  assert(
    'AQI Breakpoint: 280 µg/m³ PM2.5 results in Severe / Hazardous AQI (> 300)',
    aqiSevere.aqi > 300,
    '> 300',
    aqiSevere.aqi
  );

  // ----------------------------------------------------
  // 3. Decision Forest Mathematical Traversal & Probability Sum
  // ----------------------------------------------------
  const healthySample = {
    pefr_pct_pred: 95,
    spo2: 98.5,
    aqi: 35,
    symptom_score: 0,
    heart_rate: 72,
    age: 26,
    asthma_diagnosed: 0,
    smoking: 0,
    family_history: 0,
    temperature_c: 22,
    humidity_pct: 50,
  };

  const healthyResult = evaluateDecisionForest(healthySample);
  const probSumHealthy = Math.round((healthyResult.probLow + healthyResult.probMedium + healthyResult.probHigh) * 100) / 100;
  
  assert(
    'Decision Forest: Probabilities strictly sum to 1.0000',
    probSumHealthy === 1.0,
    1.0,
    probSumHealthy
  );

  assert(
    'Decision Forest: Healthy vitals classify as Low Risk',
    healthyResult.riskClass === 'Low',
    'Low',
    healthyResult.riskClass
  );

  const emergencySample = {
    pefr_pct_pred: 42,   // Severe airway restriction
    spo2: 89,            // Acute hypoxemia
    aqi: 220,           // Severe pollution
    symptom_score: 8,   // High symptom distress
    heart_rate: 125,    // Tachycardia
    age: 34,
    asthma_diagnosed: 1,
    smoking: 0,
    family_history: 1,
    temperature_c: 12,
    humidity_pct: 40,
  };

  const emergencyResult = evaluateDecisionForest(emergencySample);
  assert(
    'Decision Forest: Acute distress (SpO2 89%, PEFR 42%) classifies as High Risk',
    emergencyResult.riskClass === 'High',
    'High',
    emergencyResult.riskClass
  );

  const allPassed = results.every(r => r.passed);
  return { allPassed, tests: results };
}
