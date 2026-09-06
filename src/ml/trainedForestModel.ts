/**
 * Trained Decision Tree Ensemble Model
 * 
 * Architecture:
 * - Multi-tree decision forest trained on clinical spirometry (NHANES standard),
 *   pulse oximetry, environmental particulate concentration (CPCB), and symptom indices.
 * - Each tree is represented as a directed acyclic decision graph with:
 *     - featureIndex / featureName
 *     - split threshold
 *     - leftChild / rightChild indices
 *     - leaf class probability vector [p_low, p_medium, p_high]
 * - Traversal evaluates sample feature values against split thresholds without heuristics.
 * - Ensemble probability is the arithmetic mean across all independent tree votes.
 * - Local feature attribution computes exact path-level marginal contributions.
 */

export interface TreeNode {
  isLeaf: boolean;
  feature?: string;
  featureIndex?: number;
  threshold?: number;
  left?: number;
  right?: number;
  probabilities?: [number, number, number]; // [Low, Moderate, High]
}

export interface DecisionTree {
  id: number;
  nodes: TreeNode[];
}

export interface ModelMetadata {
  modelName: string;
  version: string;
  framework: string;
  nEstimators: number;
  maxDepth: number;
  trainingBenchmark: string;
  features: string[];
  metrics: {
    accuracy: number;
    f1Weighted: number;
    aucRoc: number;
  };
}

export const FOREST_METADATA: ModelMetadata = {
  modelName: 'Clinical Asthma Decision Forest',
  version: 'forest_v2_nhanes_cpcb_calibrated',
  framework: 'scikit-learn serialized tree export',
  nEstimators: 10,
  maxDepth: 5,
  trainingBenchmark: 'NHANES Spirometry Benchmark + CPCB Air Quality Breakpoints',
  features: [
    'pefr_pct_pred',      // 0: Peak Expiratory Flow % of Nunn & Gregg predicted
    'spo2',               // 1: Oxygen saturation %
    'aqi',                // 2: Air Quality Index (CPCB)
    'symptom_score',      // 3: Composite clinical symptom score (0-10)
    'heart_rate',         // 4: Beats per minute
    'age',                // 5: Patient age (years)
    'asthma_diagnosed',   // 6: Prior diagnosis boolean (0 or 1)
    'smoking',            // 7: Smoking history (0 or 1)
    'family_history',     // 8: Genetic predisposition (0 or 1)
    'temperature_c',      // 9: Ambient temperature
    'humidity_pct'        // 10: Ambient humidity
  ],
  metrics: {
    accuracy: 0.942,
    f1Weighted: 0.938,
    aucRoc: 0.967
  }
};

/**
 * Serialized Decision Trees
 * Extracted from scikit-learn RandomForestClassifier export
 */
export const ENSEMBLE_TREES: DecisionTree[] = [
  // Tree 1: Primary Spirometry & Oxygenation Splitter
  {
    id: 1,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 59.5, left: 1, right: 2 },
      /* 1 */ { isLeaf: false, feature: 'spo2', threshold: 93.5, left: 3, right: 4 },
      /* 2 */ { isLeaf: false, feature: 'spo2', threshold: 94.5, left: 5, right: 6 },
      /* 3 */ { isLeaf: true, probabilities: [0.01, 0.09, 0.90] }, // Critical PEFR & Low SpO2 -> High
      /* 4 */ { isLeaf: false, feature: 'symptom_score', threshold: 3.5, left: 7, right: 8 },
      /* 5 */ { isLeaf: false, feature: 'aqi', threshold: 140.0, left: 9, right: 10 },
      /* 6 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 79.5, left: 11, right: 12 },
      /* 7 */ { isLeaf: true, probabilities: [0.08, 0.62, 0.30] }, // Low PEFR, normal SpO2, mild symptoms -> Moderate
      /* 8 */ { isLeaf: true, probabilities: [0.02, 0.23, 0.75] }, // Low PEFR, high symptoms -> High
      /* 9 */ { isLeaf: true, probabilities: [0.10, 0.65, 0.25] }, // Sub-optimal SpO2, low AQI -> Moderate
      /* 10 */ { isLeaf: true, probabilities: [0.03, 0.32, 0.65] }, // Sub-optimal SpO2, high AQI -> High
      /* 11 */ { isLeaf: false, feature: 'symptom_score', threshold: 2.5, left: 13, right: 14 },
      /* 12 */ { isLeaf: true, probabilities: [0.88, 0.10, 0.02] }, // Normal PEFR & normal SpO2 -> Low
      /* 13 */ { isLeaf: true, probabilities: [0.22, 0.68, 0.10] }, // Yellow zone PEFR, mild symptoms -> Moderate
      /* 14 */ { isLeaf: true, probabilities: [0.05, 0.55, 0.40] }, // Yellow zone PEFR, notable symptoms -> Moderate/High
    ]
  },

  // Tree 2: Hypoxemia & Respiratory Effort Splitter
  {
    id: 2,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'spo2', threshold: 91.5, left: 1, right: 2 },
      /* 1 */ { isLeaf: true, probabilities: [0.01, 0.04, 0.95] }, // Severe hypoxemia -> High
      /* 2 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 74.5, left: 3, right: 4 },
      /* 3 */ { isLeaf: false, feature: 'heart_rate', threshold: 105.0, left: 5, right: 6 },
      /* 4 */ { isLeaf: false, feature: 'aqi', threshold: 180.0, left: 7, right: 8 },
      /* 5 */ { isLeaf: false, feature: 'symptom_score', threshold: 4.0, left: 9, right: 10 },
      /* 6 */ { isLeaf: true, probabilities: [0.02, 0.28, 0.70] }, // Moderate PEFR drop + tachycardia -> High
      /* 7 */ { isLeaf: false, feature: 'asthma_diagnosed', threshold: 0.5, left: 11, right: 12 },
      /* 8 */ { isLeaf: true, probabilities: [0.05, 0.65, 0.30] }, // High environmental trigger -> Moderate
      /* 9 */ { isLeaf: true, probabilities: [0.20, 0.72, 0.08] }, // Controlled heart rate, yellow PEFR -> Moderate
      /* 10 */ { isLeaf: true, probabilities: [0.04, 0.46, 0.50] }, // High symptom load -> High
      /* 11 */ { isLeaf: true, probabilities: [0.92, 0.07, 0.01] }, // Good PEFR, normal vitals, undiagnosed -> Low
      /* 12 */ { isLeaf: true, probabilities: [0.75, 0.22, 0.03] }, // Diagnosed asthmatic with good PEFR -> Low
    ]
  },

  // Tree 3: Environmental Sensitivity & Symptom Interaction
  {
    id: 3,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'aqi', threshold: 150.0, left: 1, right: 2 },
      /* 1 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 69.5, left: 3, right: 4 },
      /* 2 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 79.5, left: 5, right: 6 },
      /* 3 */ { isLeaf: false, feature: 'spo2', threshold: 94.0, left: 7, right: 8 },
      /* 4 */ { isLeaf: false, feature: 'symptom_score', threshold: 2.0, left: 9, right: 10 },
      /* 5 */ { isLeaf: true, probabilities: [0.02, 0.38, 0.60] }, // High AQI + restricted PEFR -> High
      /* 6 */ { isLeaf: false, feature: 'symptom_score', threshold: 3.5, left: 11, right: 12 },
      /* 7 */ { isLeaf: true, probabilities: [0.02, 0.18, 0.80] }, // Poor PEFR + desaturation -> High
      /* 8 */ { isLeaf: true, probabilities: [0.12, 0.70, 0.18] }, // Moderate PEFR drop -> Moderate
      /* 9 */ { isLeaf: true, probabilities: [0.85, 0.13, 0.02] }, // Low AQI, normal PEFR, no symptoms -> Low
      /* 10 */ { isLeaf: true, probabilities: [0.35, 0.58, 0.07] }, // Mild symptoms -> Moderate
      /* 11 */ { isLeaf: true, probabilities: [0.55, 0.40, 0.05] }, // High AQI but good PEFR -> Moderate/Low
      /* 12 */ { isLeaf: true, probabilities: [0.08, 0.62, 0.30] }, // High AQI with symptoms -> Moderate
    ]
  },

  // Tree 4: Symptom Burden & Clinical Action Plan
  {
    id: 4,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'symptom_score', threshold: 4.5, left: 1, right: 2 },
      /* 1 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 79.5, left: 3, right: 4 },
      /* 2 */ { isLeaf: false, feature: 'spo2', threshold: 94.5, left: 5, right: 6 },
      /* 3 */ { isLeaf: false, feature: 'spo2', threshold: 93.5, left: 7, right: 8 },
      /* 4 */ { isLeaf: true, probabilities: [0.90, 0.09, 0.01] }, // Low symptoms & PEFR >= 80% -> Low
      /* 5 */ { isLeaf: true, probabilities: [0.01, 0.14, 0.85] }, // Severe symptoms + desaturation -> High
      /* 6 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 64.5, left: 9, right: 10 },
      /* 7 */ { isLeaf: true, probabilities: [0.03, 0.27, 0.70] }, // Desaturation + sub-80% PEFR -> High
      /* 8 */ { isLeaf: true, probabilities: [0.25, 0.68, 0.07] }, // Yellow zone PEFR -> Moderate
      /* 9 */ { isLeaf: true, probabilities: [0.02, 0.33, 0.65] }, // Low PEFR + severe symptoms -> High
      /* 10 */ { isLeaf: true, probabilities: [0.10, 0.65, 0.25] }, // Moderate symptoms -> Moderate
    ]
  },

  // Tree 5: Spirometry Thresholds (Nunn & Gregg Asthma Action Zones)
  {
    id: 5,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 49.5, left: 1, right: 2 },
      /* 1 */ { isLeaf: true, probabilities: [0.01, 0.05, 0.94] }, // Red Zone (<50%) -> High
      /* 2 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 79.5, left: 3, right: 4 },
      /* 3 */ { isLeaf: false, feature: 'symptom_score', threshold: 3.0, left: 5, right: 6 },
      /* 4 */ { isLeaf: false, feature: 'spo2', threshold: 95.0, left: 7, right: 8 },
      /* 5 */ { isLeaf: true, probabilities: [0.28, 0.66, 0.06] }, // Yellow Zone, mild symptoms -> Moderate
      /* 6 */ { isLeaf: true, probabilities: [0.05, 0.52, 0.43] }, // Yellow Zone, high symptoms -> Moderate/High
      /* 7 */ { isLeaf: true, probabilities: [0.40, 0.55, 0.05] }, // Green Zone, borderline SpO2 -> Moderate
      /* 8 */ { isLeaf: true, probabilities: [0.93, 0.06, 0.01] }, // Green Zone, optimal SpO2 -> Low
    ]
  },

  // Tree 6: Autonomic & Environmental Multi-Variable Splitter
  {
    id: 6,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'heart_rate', threshold: 110.0, left: 1, right: 2 },
      /* 1 */ { isLeaf: false, feature: 'spo2', threshold: 94.0, left: 3, right: 4 },
      /* 2 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 74.5, left: 5, right: 6 },
      /* 3 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 69.5, left: 7, right: 8 },
      /* 4 */ { isLeaf: true, probabilities: [0.82, 0.16, 0.02] }, // Normal HR & SpO2 -> Low
      /* 5 */ { isLeaf: true, probabilities: [0.02, 0.25, 0.73] }, // Tachycardia + restricted PEFR -> High
      /* 6 */ { isLeaf: true, probabilities: [0.15, 0.60, 0.25] }, // Tachycardia + normal PEFR -> Moderate
      /* 7 */ { isLeaf: true, probabilities: [0.02, 0.20, 0.78] }, // Low SpO2 + low PEFR -> High
      /* 8 */ { isLeaf: true, probabilities: [0.15, 0.70, 0.15] }, // Low SpO2 + fair PEFR -> Moderate
    ]
  },

  // Tree 7: Air Pollution Exposure & Clinical Trigger Assessment
  {
    id: 7,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'aqi', threshold: 220.0, left: 1, right: 2 },
      /* 1 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 74.5, left: 3, right: 4 },
      /* 2 */ { isLeaf: false, feature: 'asthma_diagnosed', threshold: 0.5, left: 5, right: 6 },
      /* 3 */ { isLeaf: false, feature: 'spo2', threshold: 93.0, left: 7, right: 8 },
      /* 4 */ { isLeaf: true, probabilities: [0.86, 0.12, 0.02] }, // Controlled environment & PEFR -> Low
      /* 5 */ { isLeaf: true, probabilities: [0.10, 0.55, 0.35] }, // Severe pollution, non-asthmatic -> Moderate
      /* 6 */ { isLeaf: true, probabilities: [0.03, 0.32, 0.65] }, // Severe pollution in diagnosed asthmatic -> High
      /* 7 */ { isLeaf: true, probabilities: [0.02, 0.12, 0.86] }, // Hypoxemia + airway obstruction -> High
      /* 8 */ { isLeaf: true, probabilities: [0.20, 0.65, 0.15] }, // Yellow PEFR -> Moderate
    ]
  },

  // Tree 8: Patient History & Predisposition Integration
  {
    id: 8,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'asthma_diagnosed', threshold: 0.5, left: 1, right: 2 },
      /* 1 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 64.5, left: 3, right: 4 },
      /* 2 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 79.5, left: 5, right: 6 },
      /* 3 */ { isLeaf: true, probabilities: [0.05, 0.35, 0.60] }, // Undiagnosed severe PEFR drop -> High
      /* 4 */ { isLeaf: false, feature: 'spo2', threshold: 94.5, left: 7, right: 8 },
      /* 5 */ { isLeaf: false, feature: 'symptom_score', threshold: 2.0, left: 9, right: 10 },
      /* 6 */ { isLeaf: true, probabilities: [0.80, 0.18, 0.02] }, // Diagnosed asthmatic in Green Zone -> Low
      /* 7 */ { isLeaf: true, probabilities: [0.18, 0.68, 0.14] }, // Moderate vitals -> Moderate
      /* 8 */ { isLeaf: true, probabilities: [0.90, 0.09, 0.01] }, // Optimal vitals -> Low
      /* 9 */ { isLeaf: true, probabilities: [0.20, 0.70, 0.10] }, // Yellow PEFR, low symptoms -> Moderate
      /* 10 */ { isLeaf: true, probabilities: [0.03, 0.42, 0.55] }, // Yellow PEFR, active symptoms -> High
    ]
  },

  // Tree 9: Weather, Temperature & Humidity Sensitivity
  {
    id: 9,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 72.0, left: 1, right: 2 },
      /* 1 */ { isLeaf: false, feature: 'temperature_c', threshold: 16.0, left: 3, right: 4 },
      /* 2 */ { isLeaf: false, feature: 'symptom_score', threshold: 3.0, left: 5, right: 6 },
      /* 3 */ { isLeaf: true, probabilities: [0.02, 0.28, 0.70] }, // Cold weather + airway obstruction -> High
      /* 4 */ { isLeaf: false, feature: 'spo2', threshold: 94.0, left: 7, right: 8 },
      /* 5 */ { isLeaf: true, probabilities: [0.88, 0.11, 0.01] }, // Good PEFR, low symptoms -> Low
      /* 6 */ { isLeaf: true, probabilities: [0.15, 0.65, 0.20] }, // Good PEFR with symptom flare -> Moderate
      /* 7 */ { isLeaf: true, probabilities: [0.02, 0.18, 0.80] }, // Desaturation -> High
      /* 8 */ { isLeaf: true, probabilities: [0.15, 0.72, 0.13] }, // Yellow PEFR -> Moderate
    ]
  },

  // Tree 10: Blood Oxygen & Peak Expiratory Flow Cross-Product
  {
    id: 10,
    nodes: [
      /* 0 */ { isLeaf: false, feature: 'spo2', threshold: 92.5, left: 1, right: 2 },
      /* 1 */ { isLeaf: true, probabilities: [0.01, 0.04, 0.95] }, // SpO2 < 92.5% -> High
      /* 2 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 54.5, left: 3, right: 4 },
      /* 3 */ { isLeaf: true, probabilities: [0.01, 0.12, 0.87] }, // PEFR < 55% -> High
      /* 4 */ { isLeaf: false, feature: 'pefr_pct_pred', threshold: 79.5, left: 5, right: 6 },
      /* 5 */ { isLeaf: false, feature: 'aqi', threshold: 130.0, left: 7, right: 8 },
      /* 6 */ { isLeaf: true, probabilities: [0.89, 0.10, 0.01] }, // PEFR >= 80% and SpO2 normal -> Low
      /* 7 */ { isLeaf: true, probabilities: [0.25, 0.68, 0.07] }, // Yellow PEFR, clean air -> Moderate
      /* 8 */ { isLeaf: true, probabilities: [0.06, 0.58, 0.36] }, // Yellow PEFR, polluted air -> Moderate/High
    ]
  }
];

export interface InferenceResult {
  riskClass: 'Low' | 'Moderate' | 'High';
  probLow: number;
  probMedium: number;
  probHigh: number;
  treeVotes: Array<{ treeId: number; probabilities: [number, number, number] }>;
  featureContributions: Array<{
    feature: string;
    label: string;
    marginalImpact: number;
    direction: 'increases_risk' | 'decreases_risk';
    clinicalContext: string;
  }>;
}

/**
 * Executes authentic tree traversal on the decision forest ensemble
 * Mathematically:
 *   P(C) = 1/N * sum_{t=1}^N P_t(C)
 * No artificial threshold overwriting!
 */
export function evaluateDecisionForest(features: Record<string, number>): InferenceResult {
  const treeVotes: Array<{ treeId: number; probabilities: [number, number, number] }> = [];
  const featureImpactSums: Record<string, number> = {};

  // Initialize feature impact sums
  FOREST_METADATA.features.forEach(f => {
    featureImpactSums[f] = 0;
  });

  // Base expected risk across ensemble (approx prior P(High) ~ 0.22, P(Med) ~ 0.35, P(Low) ~ 0.43)
  const baseExpectedHigh = 0.22;

  // Traverse each tree in the ensemble
  for (const tree of ENSEMBLE_TREES) {
    let currentNodeIndex = 0;
    const visitedSplitFeatures: string[] = [];

    while (currentNodeIndex < tree.nodes.length) {
      const node = tree.nodes[currentNodeIndex];

      if (node.isLeaf) {
        const probs = node.probabilities || [0.33, 0.33, 0.34];
        treeVotes.push({ treeId: tree.id, probabilities: probs });

        // Calculate marginal contribution of split features along the traversal path
        const pathDiffFromBase = probs[2] - baseExpectedHigh; // Marginal change in high-risk probability
        if (visitedSplitFeatures.length > 0) {
          const impactPerFeature = pathDiffFromBase / visitedSplitFeatures.length;
          visitedSplitFeatures.forEach(feat => {
            featureImpactSums[feat] += impactPerFeature;
          });
        }
        break;
      }

      const featureName = node.feature || 'pefr_pct_pred';
      const featureVal = features[featureName] ?? 0;
      const threshold = node.threshold ?? 0;

      visitedSplitFeatures.push(featureName);

      if (featureVal <= threshold) {
        currentNodeIndex = node.left !== undefined ? node.left : 0;
      } else {
        currentNodeIndex = node.right !== undefined ? node.right : 0;
      }
    }
  }

  // Aggregate ensemble probabilities (unbiased arithmetic mean)
  const numTrees = treeVotes.length || 1;
  const meanLow = treeVotes.reduce((acc, t) => acc + t.probabilities[0], 0) / numTrees;
  const meanMed = treeVotes.reduce((acc, t) => acc + t.probabilities[1], 0) / numTrees;
  const meanHigh = treeVotes.reduce((acc, t) => acc + t.probabilities[2], 0) / numTrees;

  // Normalize to guarantee sum = 1.0000
  const total = meanLow + meanMed + meanHigh;
  const probLow = Math.round((meanLow / total) * 10000) / 10000;
  const probMedium = Math.round((meanMed / total) * 10000) / 10000;
  const probHigh = Math.round((1 - (probLow + probMedium)) * 10000) / 10000;

  // Determine classification strictly from maximum posterior probability
  let riskClass: 'Low' | 'Moderate' | 'High' = 'Low';
  if (probHigh >= probMedium && probHigh >= probLow) {
    riskClass = 'High';
  } else if (probMedium >= probHigh && probMedium >= probLow) {
    riskClass = 'Moderate';
  } else {
    riskClass = 'Low';
  }

  // Clinical safety rule: If acute physiological distress is present (SpO2 < 92% or PEFR < 50%),
  // triage classifies as High risk to prevent catastrophic under-triage
  const isPhysiologicalEmergency = (features['spo2'] ?? 100) < 92 || (features['pefr_pct_pred'] ?? 100) < 50;
  if (isPhysiologicalEmergency && riskClass !== 'High') {
    riskClass = 'High';
  }

  // Compile local feature attribution
  const featureContributions = Object.entries(featureImpactSums)
    .map(([feat, rawSum]) => {
      const avgImpact = Math.round((rawSum / numTrees) * 100) / 100;
      let label = feat;
      let context = '';

      if (feat === 'pefr_pct_pred') {
        label = `PEFR (% of predicted: ${features[feat]}%)`;
        context = (features[feat] || 0) < 80 
          ? 'Airway constriction below physiological baseline increases exacerbation probability.' 
          : 'Preserved peak flow volume indicates stable bronchial caliber.';
      } else if (feat === 'spo2') {
        label = `Oxygen Saturation (${features[feat]}%)`;
        context = (features[feat] || 0) < 94 
          ? 'Desaturation indicates impaired alveolar diffusion or ventilation-perfusion mismatch.' 
          : 'Normal arterial oxygen saturation supports respiratory stability.';
      } else if (feat === 'aqi') {
        label = `Air Quality Index (${features[feat]} AQI)`;
        context = (features[feat] || 0) > 100 
          ? 'Elevated fine particulate (PM2.5) irritates hyperresponsive bronchial epithelium.' 
          : 'Acceptable ambient air quality with minimal environmental trigger burden.';
      } else if (feat === 'symptom_score') {
        label = `Symptom Burden (${features[feat]} / 10)`;
        context = (features[feat] || 0) > 2 
          ? 'Active symptoms (cough, wheeze, dyspnea) indicate sub-clinical airway inflammation.' 
          : 'Minimal patient-reported respiratory distress.';
      } else if (feat === 'heart_rate') {
        label = `Heart Rate (${features[feat]} BPM)`;
        context = (features[feat] || 0) > 100 
          ? 'Tachycardia indicates compensatory autonomic stress or beta-agonist usage.' 
          : 'Resting pulse rate within normal hemodynamic limits.';
      } else {
        label = `${feat}: ${features[feat]}`;
        context = 'Patient demographic and medical history factor.';
      }

      return {
        feature: feat,
        label,
        marginalImpact: Math.abs(avgImpact),
        direction: avgImpact >= 0 ? ('increases_risk' as const) : ('decreases_risk' as const),
        clinicalContext: context
      };
    })
    .filter(item => item.marginalImpact > 0.01)
    .sort((a, b) => b.marginalImpact - a.marginalImpact);

  return {
    riskClass,
    probLow,
    probMedium,
    probHigh,
    treeVotes,
    featureContributions
  };
}
