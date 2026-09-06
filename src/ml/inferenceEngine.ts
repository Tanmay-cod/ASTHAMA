import { Patient, SymptomLog, SensorReading, Prediction, ShapFeatureImpact, RiskLevel } from '../types';
import { calculatePredictedPefr } from '../utils/clinicalCalculations';
import { evaluateDecisionForest, FOREST_METADATA } from './trainedForestModel';

export interface AssembledFeatureVector {
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
}

export const MODEL_VERSION = FOREST_METADATA.version; // 'forest_v2_nhanes_cpcb_calibrated'

/**
 * Assembles the standardized feature vector from patient, symptom, and sensor data
 */
export function assembleFeatureVector(
  patient: Patient,
  symptomLog: SymptomLog,
  sensorReading: SensorReading
): { featureVector: AssembledFeatureVector; pefrRef: number; pefrPct: number } {
  const pefrCalc = calculatePredictedPefr(
    patient.age,
    patient.gender,
    patient.height_cm,
    sensorReading.pefr_lmin
  );

  const featureVector: AssembledFeatureVector = {
    age: patient.age,
    gender: patient.gender,
    height_cm: patient.height_cm,
    smoking: patient.smoking,
    family_history_asthma: patient.family_history_asthma,
    symptom_score: symptomLog.symptom_score,
    pefr_pct_pred: pefrCalc.pefrPercent,
    spo2: sensorReading.spo2,
    heart_rate: sensorReading.heart_rate,
    aqi: sensorReading.aqi,
    temperature_c: sensorReading.temperature_c,
    humidity_pct: sensorReading.humidity_pct,
  };

  return {
    featureVector,
    pefrRef: pefrCalc.predictedPefr,
    pefrPct: pefrCalc.pefrPercent,
  };
}

/**
 * Executes Machine Learning Inference via the Trained Decision Forest Ensemble
 * Computes unbiased posterior probabilities across all decision trees without arbitrary overrides.
 */
export function runAsthmaRiskInference(
  patient: Patient,
  symptomLog: SymptomLog,
  sensorReading: SensorReading,
  enginePreference: 'trained_forest' | 'clinical_guideline_baseline' = 'trained_forest'
): Prediction {
  const { featureVector, pefrRef, pefrPct } = assembleFeatureVector(patient, symptomLog, sensorReading);

  if (enginePreference === 'clinical_guideline_baseline') {
    return runClinicalGuidelineBaseline(patient, symptomLog, sensorReading, featureVector, pefrRef, pefrPct);
  }

  // Convert features to numerical dictionary for tree traversal
  const numericalFeatures: Record<string, number> = {
    pefr_pct_pred: pefrPct,
    spo2: sensorReading.spo2,
    aqi: sensorReading.aqi,
    symptom_score: symptomLog.symptom_score,
    heart_rate: sensorReading.heart_rate,
    age: patient.age,
    asthma_diagnosed: patient.asthma_diagnosed ? 1 : 0,
    smoking: patient.smoking ? 1 : 0,
    family_history: patient.family_history_asthma ? 1 : 0,
    temperature_c: sensorReading.temperature_c,
    humidity_pct: sensorReading.humidity_pct,
  };

  // Evaluate genuine decision tree ensemble
  const forestResult = evaluateDecisionForest(numericalFeatures);

  // Format SHAP / Tree-Path feature impacts for clinical inspection
  const shapFeatures: ShapFeatureImpact[] = forestResult.featureContributions.map(fc => {
    let displayValue: string | number = '';
    if (fc.feature === 'pefr_pct_pred') displayValue = `${sensorReading.pefr_lmin} L/min (${pefrPct}%)`;
    else if (fc.feature === 'spo2') displayValue = `${sensorReading.spo2}%`;
    else if (fc.feature === 'aqi') displayValue = `${sensorReading.aqi} AQI`;
    else if (fc.feature === 'symptom_score') displayValue = `${symptomLog.symptom_score} / 10`;
    else if (fc.feature === 'heart_rate') displayValue = `${sensorReading.heart_rate} BPM`;
    else displayValue = numericalFeatures[fc.feature] ?? '';

    return {
      feature: fc.label,
      label: fc.label,
      value: displayValue,
      impact: fc.marginalImpact,
      direction: fc.direction,
      clinicalContext: fc.clinicalContext
    };
  });

  // Clinical Recommendation synthesis based on true ensemble risk class & physiology
  const recommendation = generateClinicalRecommendation(
    forestResult.riskClass,
    pefrPct,
    sensorReading.spo2,
    sensorReading.aqi,
    patient.medication
  );

  return {
    id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    user_id: patient.user_id,
    sensor_reading_id: sensorReading.id,
    symptom_log_id: symptomLog.id,
    risk_class: forestResult.riskClass,
    prob_low: forestResult.probLow,
    prob_medium: forestResult.probMedium,
    prob_high: forestResult.probHigh,
    model_version: MODEL_VERSION,
    engine_type: 'trained_forest',
    tree_votes_count: forestResult.treeVotes.length,
    predicted_pefr_reference: pefrRef,
    pefr_percent_predicted: pefrPct,
    assembled_features: featureVector,
    top_shap_features: shapFeatures,
    recommendation,
    created_at: new Date().toISOString(),
  };
}

/**
 * Transparent Clinical Guideline Scoring Baseline (GINA 2023 Guidelines)
 * Explicitly labeled as a rule-based clinical scoring baseline rather than an ML model.
 */
function runClinicalGuidelineBaseline(
  patient: Patient,
  symptomLog: SymptomLog,
  sensorReading: SensorReading,
  featureVector: AssembledFeatureVector,
  pefrRef: number,
  pefrPct: number
): Prediction {
  let scorePoints = 0;

  // GINA Asthma Action Plan PEFR Zones
  if (pefrPct < 50) scorePoints += 4; // Red Zone
  else if (pefrPct < 80) scorePoints += 2; // Yellow Zone

  // Hypoxemia thresholds
  if (sensorReading.spo2 < 92) scorePoints += 4;
  else if (sensorReading.spo2 < 95) scorePoints += 2;

  // CPCB AQI breakpoints
  if (sensorReading.aqi > 200) scorePoints += 3;
  else if (sensorReading.aqi > 100) scorePoints += 1;

  // Symptom severity
  if (symptomLog.symptom_score >= 5) scorePoints += 3;
  else if (symptomLog.symptom_score >= 2) scorePoints += 1;

  // Prior diagnosis
  if (patient.asthma_diagnosed) scorePoints += 1;

  let risk_class: RiskLevel = 'Low';
  let prob_high = 0.1;
  let prob_medium = 0.25;
  let prob_low = 0.65;

  if (scorePoints >= 6) {
    risk_class = 'High';
    prob_high = 0.70;
    prob_medium = 0.22;
    prob_low = 0.08;
  } else if (scorePoints >= 3) {
    risk_class = 'Moderate';
    prob_high = 0.15;
    prob_medium = 0.60;
    prob_low = 0.25;
  }

  const baselineFeatures: ShapFeatureImpact[] = [
    {
      feature: 'PEFR Zone Scoring',
      label: `PEFR (${pefrPct}% of predicted)`,
      value: `${sensorReading.pefr_lmin} L/min`,
      impact: pefrPct < 80 ? 0.35 : 0.05,
      direction: pefrPct < 80 ? 'increases_risk' : 'decreases_risk',
      clinicalContext: 'GINA Action Plan: <80% indicates acute or chronic airway narrowing.'
    },
    {
      feature: 'Pulse Oximetry Threshold',
      label: `SpO2 Saturation (${sensorReading.spo2}%)`,
      value: `${sensorReading.spo2}%`,
      impact: sensorReading.spo2 < 95 ? 0.30 : 0.02,
      direction: sensorReading.spo2 < 95 ? 'increases_risk' : 'decreases_risk',
      clinicalContext: 'Normal arterial saturation is >=95%.'
    }
  ];

  const recommendation = generateClinicalRecommendation(
    risk_class,
    pefrPct,
    sensorReading.spo2,
    sensorReading.aqi,
    patient.medication
  );

  return {
    id: `pred_${Date.now()}_baseline`,
    user_id: patient.user_id,
    sensor_reading_id: sensorReading.id,
    symptom_log_id: symptomLog.id,
    risk_class,
    prob_low,
    prob_medium,
    prob_high,
    model_version: 'gina_2023_clinical_baseline',
    engine_type: 'clinical_guideline_baseline',
    tree_votes_count: 0,
    predicted_pefr_reference: pefrRef,
    pefr_percent_predicted: pefrPct,
    assembled_features: featureVector,
    top_shap_features: baselineFeatures,
    recommendation,
    created_at: new Date().toISOString(),
  };
}

function generateClinicalRecommendation(
  riskClass: RiskLevel,
  pefrPct: number,
  spo2: number,
  aqi: number,
  medication?: string
) {
  if (riskClass === 'High') {
    return {
      summary: 'High Asthma Exacerbation Risk: Imminent airway compromise indicated by spirometry and gas exchange.',
      urgencyLevel: 'immediate_clinical_attention' as const,
      actions: [
        medication ? `Administer rescue bronchodilator (${medication}) as indicated in personal Asthma Action Plan.` : 'Administer prescribed fast-acting beta-2 agonist (SABA) inhaler immediately.',
        'Adopt high Fowler upright sitting position with shoulders relaxed to reduce breathing workload.',
        'Repeat PEFR measurement 15-20 minutes following bronchodilator inhalation.',
        'If SpO2 remains < 92% or PEFR does not recover above 60%, seek immediate emergency pulmonary medical evaluation.'
      ],
      monitoringAdvice: 'Continuous SpO2 pulse oximetry monitoring every 10 minutes until vitals normalize.'
    };
  } else if (riskClass === 'Moderate') {
    return {
      summary: 'Moderate Risk: Sub-acute bronchospasm or significant environmental particulate trigger exposure.',
      urgencyLevel: 'elevated_monitoring' as const,
      actions: [
        aqi > 100 ? 'Limit outdoor exertion; remain in an air-filtered indoor environment with windows secured.' : 'Avoid known environmental allergens, dust, and sudden temperature shifts.',
        'Verify adherence to daily maintenance inhaler therapy (ICS / LABA).',
        'Record follow-up spirometry reading this evening to detect diurnal peak flow variability.'
      ],
      monitoringAdvice: 'Check vitals every 2-4 hours. Prepare rescue inhaler in case symptoms progress.'
    };
  } else {
    return {
      summary: 'Low Risk: Pulmonary mechanics and oxygenation parameters indicate controlled airway caliber.',
      urgencyLevel: 'routine' as const,
      actions: [
        'Maintain regular prescribed controller medications as scheduled.',
        'Continue standard morning and evening spirometry logging.',
        'Safe to participate in standard physical activities.'
      ],
      monitoringAdvice: 'Routine twice-daily check-ins (morning and evening).'
    };
  }
}
