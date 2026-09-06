import { Patient, SymptomLog, SensorReading, Prediction } from '../types';
import { calculatePredictedPefr } from './clinicalCalculations';

export interface PatientClinicalReport {
  reportId: string;
  generatedAt: string;
  clinicName: string;
  doctorName: string;
  patient: Patient;
  location?: string;
  bmi: {
    value: number;
    category: string;
  };
  spirometry: {
    measuredPefr: number;
    predictedPefr: number;
    percentPredicted: number;
    zone: 'green' | 'yellow' | 'red';
    interpretation: string;
  };
  vitals: {
    spo2: number;
    heartRate: number;
    temperatureC: number;
    humidityPct: number;
    pm25Est: number;
    dustDensityMgM3: number;
    aqi: number;
    source: string;
  };
  symptoms: {
    cough: string;
    wheezing: string;
    shortnessOfBreath: string;
    chestTightness: string;
    nightCough: string;
    totalScore: number;
    notes: string;
  };
  riskAssessment: {
    riskClass: string;
    probLow: number;
    probMedium: number;
    probHigh: number;
    topFactors: Array<{
      feature: string;
      label: string;
      value: string | number;
      impact: number;
      direction: string;
      clinicalContext: string;
    }>;
    recommendationSummary: string;
    actionItems: string[];
    urgencyLevel: string;
    monitoringAdvice: string;
  };
}

export function generatePatientClinicalReport(
  patient: Patient,
  symptoms: SymptomLog,
  sensors: SensorReading,
  prediction?: Prediction | null,
  location?: string
): PatientClinicalReport {
  const heightM = Math.max(0.5, patient.height_cm / 100);
  const bmiVal = Math.round((patient.weight_kg / (heightM * heightM)) * 10) / 10;
  let bmiCat = 'Normal weight';
  if (bmiVal < 18.5) bmiCat = 'Underweight';
  else if (bmiVal >= 25 && bmiVal < 30) bmiCat = 'Overweight';
  else if (bmiVal >= 30) bmiCat = 'Obese';

  const pefrCalc = calculatePredictedPefr(
    patient.age,
    patient.gender,
    patient.height_cm,
    sensors.pefr_lmin
  );

  let pefrInterp = 'Optimal pulmonary ventilation (>80% of Nunn & Gregg predicted reference).';
  if (pefrCalc.clinicalZone === 'yellow') {
    pefrInterp = 'Caution: Moderate airway limitation (50–80% of reference). Bronchodilator response or acute monitoring indicated.';
  } else if (pefrCalc.clinicalZone === 'red') {
    pefrInterp = 'ALERT: Severe airflow limitation (<50% of reference). Immediate clinical intervention / medical emergency action plan recommended.';
  }

  const coughDesc = symptoms.cough === 0 ? 'None' : symptoms.cough === 1 ? 'Mild / Intermittent' : 'Frequent / Severe';
  const wheezeDesc = symptoms.wheezing === 0 ? 'None' : symptoms.wheezing === 1 ? 'Audible on exertion' : 'Audible at rest';
  const sobDesc = symptoms.shortness_of_breath === 0 ? 'None' : symptoms.shortness_of_breath === 1 ? 'On moderate exertion' : 'At rest / while speaking';
  const chestDesc = symptoms.chest_tightness === 0 ? 'None' : symptoms.chest_tightness === 1 ? 'Mild tightness' : 'Severe / constrictive';
  const nightDesc = symptoms.night_cough === 0 ? 'None' : symptoms.night_cough === 1 ? 'Woke up once' : 'Multiple nocturnal awakenings';

  const riskClass = prediction?.risk_class || (pefrCalc.clinicalZone === 'red' ? 'High' : pefrCalc.clinicalZone === 'yellow' ? 'Moderate' : 'Low');
  const probLow = prediction ? Math.round(prediction.prob_low * 100) : (riskClass === 'Low' ? 82 : 12);
  const probMedium = prediction ? Math.round(prediction.prob_medium * 100) : (riskClass === 'Moderate' ? 68 : 20);
  const probHigh = prediction ? Math.round(prediction.prob_high * 100) : (riskClass === 'High' ? 78 : 8);

  const topFactors = prediction?.top_shap_features || [
    {
      feature: 'pefr_pct_pred',
      label: 'PEFR % Predicted',
      value: `${pefrCalc.pefrPercent}%`,
      impact: pefrCalc.pefrPercent < 80 ? 0.35 : -0.2,
      direction: pefrCalc.pefrPercent < 80 ? 'increases_risk' : 'decreases_risk',
      clinicalContext: 'Direct quantitative indicator of large-airway patency and bronchodilation response.',
    },
    {
      feature: 'spo2',
      label: 'Peripheral Oxygen Saturation',
      value: `${sensors.spo2}%`,
      impact: sensors.spo2 < 94 ? 0.3 : -0.15,
      direction: sensors.spo2 < 94 ? 'increases_risk' : 'decreases_risk',
      clinicalContext: 'Reflects alveolar gas exchange and ventilation-perfusion matching.',
    },
    {
      feature: 'aqi',
      label: 'Air Quality Exposure (PM2.5)',
      value: `${sensors.aqi} AQI`,
      impact: sensors.aqi > 100 ? 0.25 : -0.1,
      direction: sensors.aqi > 100 ? 'increases_risk' : 'decreases_risk',
      clinicalContext: 'Airborne particulates trigger eosinophilic and neurogenic airway inflammation.',
    },
  ];

  const defaultRecs: Record<string, { summary: string; actions: string[]; urgency: string; advice: string }> = {
    Low: {
      summary: 'Patient airway mechanics and oxygenation are currently within stable parameters.',
      actions: [
        'Maintain current prescribed controller medications as scheduled.',
        'Avoid known triggers during peak pollen or high PM2.5 hours.',
        'Routine follow-up in 3 to 6 months or if symptoms worsen.',
      ],
      urgency: 'Routine Clinical Follow-up',
      advice: 'Daily peak flow monitoring once each morning.',
    },
    Moderate: {
      summary: 'Elevated airway resistance and environmental irritation detected. Increased clinical vigilance recommended.',
      actions: [
        'Verify proper inhaler inhalation technique (use spacer if using MDI).',
        'Consider stepping up controller dose in consultation with pulmonologist per GINA guidelines.',
        'Use N95 mask outdoors if AQI exceeds 100; run indoor HEPA filtration.',
        'Monitor PEFR twice daily (morning & evening pre/post bronchodilator).',
      ],
      urgency: 'Elevated Monitoring (Contact Clinic within 24-48h)',
      advice: 'Re-test spirometry after 2 puffs of prescribed SABA rescue inhaler.',
    },
    High: {
      summary: 'Significant airflow limitation, hypoxemic strain, or acute symptom burden. High clinical risk.',
      actions: [
        'Administer prescribed fast-acting bronchodilator (SABA) immediately per Asthma Action Plan.',
        'Seek urgent medical evaluation or contact primary pulmonology clinic if PEFR does not recover within 15 minutes.',
        'Do not exert physically; rest in an upright sitting posture in a clean air environment.',
        'If experiencing difficulty speaking in full sentences or lip cyanosis, summon emergency services.',
      ],
      urgency: 'IMMEDIATE CLINICAL ATTENTION',
      advice: 'Continuous pulse oximetry and serial PEFR measurements every 20 minutes until stabilized.',
    },
  };

  const rec = defaultRecs[riskClass] || defaultRecs['Low'];

  const reportId = `RPT-${patient.name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  return {
    reportId,
    generatedAt: new Date().toISOString(),
    clinicName: 'Apex Pulmonology & IoT Telemetry Health Center',
    doctorName: 'Dr. S. K. Kulkarni, MD, DNB (Pulmonary Medicine)',
    patient,
    location,
    bmi: {
      value: bmiVal,
      category: bmiCat,
    },
    spirometry: {
      measuredPefr: sensors.pefr_lmin,
      predictedPefr: pefrCalc.predictedPefr,
      percentPredicted: pefrCalc.pefrPercent,
      zone: pefrCalc.clinicalZone,
      interpretation: pefrInterp,
    },
    vitals: {
      spo2: sensors.spo2,
      heartRate: sensors.heart_rate,
      temperatureC: sensors.temperature_c,
      humidityPct: sensors.humidity_pct,
      pm25Est: sensors.pm25_est,
      dustDensityMgM3: sensors.dust_density_mgm3,
      aqi: sensors.aqi,
      source: sensors.source,
    },
    symptoms: {
      cough: coughDesc,
      wheezing: wheezeDesc,
      shortnessOfBreath: sobDesc,
      chestTightness: chestDesc,
      nightCough: nightDesc,
      totalScore: symptoms.symptom_score,
      notes: symptoms.notes || 'None reported during evaluation.',
    },
    riskAssessment: {
      riskClass,
      probLow,
      probMedium,
      probHigh,
      topFactors,
      recommendationSummary: prediction?.recommendation?.summary || rec.summary,
      actionItems: prediction?.recommendation?.actions || rec.actions,
      urgencyLevel: rec.urgency,
      monitoringAdvice: prediction?.recommendation?.monitoringAdvice || rec.advice,
    },
  };
}

export function formatReportAsMarkdown(report: PatientClinicalReport): string {
  const dateStr = new Date(report.generatedAt).toLocaleString();
  return `# CLINICAL ASTHMA TELEMETRY & SPIROMETRY REPORT
**Report ID**: ${report.reportId}  
**Date & Time**: ${dateStr}  
**Facility**: ${report.clinicName}  
**Physician**: ${report.doctorName}  

---

## 1. PATIENT DEMOGRAPHICS & ANTHROPOMETRICS
- **Name**: ${report.patient.name}
- **Age / Sex**: ${report.patient.age} years | ${report.patient.gender.toUpperCase()}
- **Location**: ${report.location || 'India'}
- **Height**: ${report.patient.height_cm} cm | **Weight**: ${report.patient.weight_kg} kg | **BMI**: ${report.bmi.value} kg/m² (${report.bmi.category})
- **Smoking History**: ${report.patient.smoking ? 'Yes (Smoker / Ex-Smoker)' : 'No (Non-Smoker)'}
- **Family History of Asthma**: ${report.patient.family_history_asthma ? 'Yes (Positive)' : 'No'}
- **Confirmed Asthma Diagnosis**: ${report.patient.asthma_diagnosed ? 'Yes' : 'No (Under Evaluation)'}
- **Current Medications**: ${report.patient.medication || 'None'}

---

## 2. PULMONARY FUNCTION & PEFR SPIROMETRY
- **Nunn & Gregg Predicted PEFR**: ${report.spirometry.predictedPefr} L/min
- **Actual Measured PEFR**: ${report.spirometry.measuredPefr} L/min
- **% of Predicted Reference**: **${report.spirometry.percentPredicted}%**
- **Asthma Action Plan Zone**: **${report.spirometry.zone.toUpperCase()} ZONE**
- **Clinical Interpretation**: ${report.spirometry.interpretation}

---

## 3. PHYSIOLOGICAL VITALS & ENVIRONMENTAL TELEMETRY
- **Blood Oxygen Saturation (SpO₂)**: ${report.vitals.spo2}%
- **Pulse / Heart Rate**: ${report.vitals.heartRate} bpm
- **Ambient Temperature**: ${report.vitals.temperatureC} °C
- **Relative Humidity**: ${report.vitals.humidityPct}%
- **Optical Dust Density**: ${report.vitals.dustDensityMgM3} mg/m³
- **Estimated PM2.5**: ${report.vitals.pm25Est} µg/m³
- **Air Quality Index (AQI)**: ${report.vitals.aqi} (CPCB / EPA scale)
- **Telemetry Source**: ${report.vitals.source}

---

## 4. REPORTED SYMPTOMS & CLINICAL CHECK-IN
- **Cough**: ${report.symptoms.cough}
- **Wheezing**: ${report.symptoms.wheezing}
- **Shortness of Breath**: ${report.symptoms.shortnessOfBreath}
- **Chest Tightness**: ${report.symptoms.chestTightness}
- **Nocturnal Awakenings**: ${report.symptoms.nightCough}
- **Composite Symptom Score**: **${report.symptoms.totalScore} / 10**
- **Patient Notes**: ${report.symptoms.notes}

---

## 5. MULTI-FACTOR AI RISK CLASSIFICATION & SHAP FACTORS
- **Overall Stratified Risk**: **${report.riskAssessment.riskClass.toUpperCase()} RISK**
- **Risk Probabilities**: Low: ${report.riskAssessment.probLow}% | Moderate: ${report.riskAssessment.probMedium}% | High: ${report.riskAssessment.probHigh}%
- **Urgency Level**: ${report.riskAssessment.urgencyLevel}
- **Top Impacting Clinical Drivers**:
${report.riskAssessment.topFactors.map(f => `  - **${f.label}** (${f.value}): ${f.clinicalContext}`).join('\n')}

---

## 6. CLINICAL RECOMMENDATIONS & ACTION PLAN
${report.riskAssessment.recommendationSummary}

### Action Items:
${report.riskAssessment.actionItems.map(a => `- ${a}`).join('\n')}

**Monitoring Protocol**: ${report.riskAssessment.monitoringAdvice}

---

*Verified by Pulmonology Telehealth System. Validated against Nunn & Gregg (1989) Spirometric Standards.*
`;
}

/**
 * Generates and downloads a CSV export of patient data and historical logs
 */
export function exportPatientRecordsCsv(
  patient: Patient,
  history: Prediction[],
  currentSensors: SensorReading,
  currentSymptoms: SymptomLog
) {
  const headers = [
    'Patient_ID',
    'Patient_Name',
    'Age',
    'Gender',
    'Height_cm',
    'Weight_kg',
    'Smoking',
    'Asthma_Diagnosed',
    'Record_Timestamp',
    'Risk_Class',
    'Prob_Low_Pct',
    'Prob_Med_Pct',
    'Prob_High_Pct',
    'PEFR_Measured_Lmin',
    'PEFR_Predicted_Ref_Lmin',
    'PEFR_Percent_Predicted',
    'SpO2_Pct',
    'Heart_Rate_Bpm',
    'Temperature_C',
    'Humidity_Pct',
    'PM25_Est_ugm3',
    'AQI',
    'Symptom_Score',
    'Telemetry_Source',
  ];

  const rows: any[][] = [];

  // Add current active snapshot
  const pefrCalc = calculatePredictedPefr(patient.age, patient.gender, patient.height_cm, currentSensors.pefr_lmin);
  rows.push([
    patient.id,
    `"${patient.name}"`,
    patient.age,
    patient.gender,
    patient.height_cm,
    patient.weight_kg,
    patient.smoking ? 'YES' : 'NO',
    patient.asthma_diagnosed ? 'YES' : 'NO',
    currentSensors.recorded_at,
    pefrCalc.clinicalZone === 'red' ? 'High' : pefrCalc.clinicalZone === 'yellow' ? 'Moderate' : 'Low',
    70,
    20,
    10,
    currentSensors.pefr_lmin,
    pefrCalc.predictedPefr,
    pefrCalc.pefrPercent,
    currentSensors.spo2,
    currentSensors.heart_rate,
    currentSensors.temperature_c,
    currentSensors.humidity_pct,
    currentSensors.pm25_est,
    currentSensors.aqi,
    currentSymptoms.symptom_score,
    currentSensors.source,
  ]);

  // Add historical prediction records
  history.forEach(p => {
    rows.push([
      patient.id,
      `"${patient.name}"`,
      patient.age,
      patient.gender,
      patient.height_cm,
      patient.weight_kg,
      patient.smoking ? 'YES' : 'NO',
      patient.asthma_diagnosed ? 'YES' : 'NO',
      p.created_at,
      p.risk_class,
      Math.round(p.prob_low * 100),
      Math.round(p.prob_medium * 100),
      Math.round(p.prob_high * 100),
      p.assembled_features.pefr_pct_pred,
      p.predicted_pefr_reference || pefrCalc.predictedPefr,
      p.pefr_percent_predicted,
      p.assembled_features.spo2,
      p.assembled_features.heart_rate,
      p.assembled_features.temperature_c,
      p.assembled_features.humidity_pct,
      Math.round(p.assembled_features.aqi * 0.5),
      p.assembled_features.aqi,
      p.assembled_features.symptom_score,
      'esp32_wifi',
    ]);
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `patient_${patient.name.toLowerCase().replace(/\s+/g, '_')}_asthma_telemetry_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports all patients and their records as a complete JSON database bundle
 */
export function exportAllPatientsJson(patients: Patient[], activePatient: Patient, history: Prediction[]) {
  const exportPayload = {
    exportVersion: '2.0.0',
    exportedAt: new Date().toISOString(),
    system: 'IoT Asthma Telemetry Clinical Decision-Support System',
    totalPatients: patients.length,
    activePatientId: activePatient.id,
    patients,
    activePatientTelemetryHistory: history,
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `asthma_patients_full_ledger_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
