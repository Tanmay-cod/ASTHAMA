# IoT Early Asthma Risk Prediction System
## Master Presentation, Client Pitch, and Comprehensive Code Reference Guide

---

# PART 1: Executive Presentation & Client Pitch Guide
> *Use this section when explaining the project to clients, evaluators, professors, or team members.*

---

## 1.1 The Core Problem We Are Solving
Asthma affects over **300 million people worldwide**. Traditionally, asthma management is **reactive**:
- Patients wait until they feel severe shortness of breath or wheezing before taking medicine.
- By the time overt symptoms appear, airway inflammation is already high, often leading to emergency hospital visits.

## 1.2 Our Solution: Proactive IoT & Explainable AI
This system turns asthma management into a **proactive, early-warning health platform**:
1. **IoT Hardware Sensors**: Measure blood oxygen saturation ($SpO_2$), pulse rate, ambient air pollution ($PM_{2.5}$ / dust density), room temperature, and humidity.
2. **Clinical Spirometry Normalization**: Measures Peak Expiratory Flow Rate ($PEFR$) and computes **% of predicted peak flow** based on medical standards (Nunn & Gregg 1989).
3. **Machine Learning Early Warning**: Runs a **Scikit-Learn Trained Decision Forest Ensemble** (trained on CDC NHANES medical spirometry and CPCB air quality data) to calculate asthma attack probability (**Low**, **Moderate**, **High**).
4. **Explainable AI (SHAP)**: Explains *why* the AI assigned a specific risk score (e.g. *"Your peak flow dropped 28% below baseline while air pollution rose to 180 AQI"*).
5. **GINA 2023 Action Plan**: Tells the patient exact medical steps to take (rescue inhaler usage, sitting upright, seeking emergency care if $SpO_2 < 92\%$).

---

## 1.3 How to Present & Demo the System in 3 Minutes

```
  +-----------------------+      +-----------------------+      +-----------------------+
  |   1. SENSOR INGESTION | ---> | 2. ML & SHAP ENGINE   | ---> | 3. ACTIONABLE TRIAGE  |
  | USB Serial / WiFi     |      | Decision Forest (10T) |      | GINA Action Plan      |
  | SpO2, HR, Dust, PEFR  |      | SHAP Attribution      |      | PDF Clinical Report   |
  +-----------------------+      +-----------------------+      +-----------------------+
```

### The 3-Minute Presentation Script:
1. **Introduction**: *"Hello! Today I am presenting our IoT-Enabled Early Asthma Risk Prediction & Clinical Decision Support System. It bridges physical hardware, machine learning, and medical guidelines to stop asthma attacks before they happen."*
2. **Hardware & Sensors**: *"Our hardware rig collects 5 vital metrics: Pulse Oximetry ($SpO_2$ & HR), Environmental Dust ($PM_{2.5}$), Microclimate (Temp/Humidity), and Peak Expiratory Flow Rate ($PEFR$)."*
3. **ML Inference & Explainability**: *"Instead of a black-box AI, our engine runs 10 decision trees trained on CDC NHANES data. It calculates risk probabilities and uses SHAP values to show the patient exact risk drivers."*
4. **Demonstration**:
   - Show the **Dashboard** with patient profile (*Om Tyade*).
   - Load the **"High Pollution Episode"** scenario in Live Sensors.
   - Click **Compute Asthma Risk**. Show the transition to **Risk & SHAP**.
   - Open **Clinical Report** to show the generated medical dossier.

---

# PART 2: End-to-End Technical Architecture

```
+---------------------------------------------------------------------------------------+
|                                PHYSICAL SENSOR LAYER                                  |
|  MAX30102 (SpO2/HR) | DHT22 (Temp/Humidity) | GP2Y (Dust/PM2.5) | Mini-Wright (PEFR)   |
+------------------------------------------+--------------------------------------------+
                                           |
                    +----------------------+----------------------+
                    | (Path A: Web Serial USB)                   | (Path B: WiFi HTTP POST)
                    v                                            v
+------------------------------------------+    +---------------------------------------+
|  React SPA Frontend (Vite + TypeScript)  |    |  Supabase Cloud (PostgreSQL + RLS)    |
|  * Standardized Feature Assembly         |    |  * patients (Demographic Registry)    |
|  * Serialized Decision Forest Inference  |    |  * sensor_readings (IoT Telemetry)    |
|  * SHAP Path Feature Attribution         |    |  * predictions (Archival History)     |
+------------------------------------------+    +---------------------------------------+
```

---

# PART 3: Complete File-by-File & Function-by-Function Reference

This section explains **every file and function** in the entire repository in simple, plain English.

---

### 📁 1. Machine Learning & Inference Engine (`src/ml/`)

#### `src/ml/trainedForestModel.ts`
- **Purpose**: Holds the serialized 10 decision trees trained by scikit-learn and executes authentic tree traversal.
- **Interfaces**:
  - `TreeNode`: Represents a single node in a decision tree (is leaf, feature name, threshold, left child index, right child index, leaf probability vector).
  - `DecisionTree`: Represents one decision tree with an ID and array of `TreeNode` objects.
  - `InferenceResult`: Result object containing risk class, low/medium/high probabilities, individual tree votes, and feature contributions.
- **Functions**:
  - `evaluateDecisionForest(features: Record<string, number>): InferenceResult`
    - **What it does**: Traverses all 10 decision trees sequentially. For each tree, compares sample feature values against node thresholds until reaching a leaf node. Computes the arithmetic mean of leaf probabilities across all trees, normalizes $\sum P = 1.0000$, applies acute emergency safety checks ($SpO_2 < 92\%$ or $PEFR < 50\%$), and computes path-level marginal feature contributions (SHAP TreeExplainer values).

#### `src/ml/inferenceEngine.ts`
- **Purpose**: Main bridge connecting patient profiles, symptom check-ins, and sensor readings to the ML model.
- **Functions**:
  - `assembleFeatureVector(patient, symptomLog, sensorReading)`
    - **What it does**: Takes raw patient data, symptom entries, and sensor readings; computes Nunn & Gregg predicted PEFR; and packages them into the standardized 10-feature vector (`pefr_pct_pred`, `spo2`, `heart_rate`, `aqi`, `temperature_c`, `humidity_pct`, `symptom_score`, `age`, `smoking`, `family_history`).
  - `runAsthmaRiskInference(patient, symptomLog, sensorReading, enginePreference)`
    - **What it does**: Main prediction entry point. If `enginePreference === 'trained_forest'`, invokes `evaluateDecisionForest`. If `enginePreference === 'clinical_guideline_baseline'`, invokes `runClinicalGuidelineBaseline`. Returns a complete `Prediction` object.
  - `runClinicalGuidelineBaseline(...)`
    - **What it does**: Transparent GINA 2023 rule-based scoring baseline. Scores points for PEFR zones, hypoxemia, AQI levels, and symptom burden.
  - `generateClinicalRecommendation(riskClass, pefrPct, spo2, aqi, medication)`
    - **What it does**: Translates risk classification into GINA-compliant medical advice, urgency level, and immediate patient action steps.

---

### 📁 2. Physiological Calculations & Algorithms (`src/utils/`)

#### `src/utils/clinicalCalculations.ts`
- **Purpose**: Houses medical formulas and environmental standards.
- **Functions**:
  - `calculatePredictedPefr(age, gender, height_cm, measuredPefr?)`
    - **What it does**: Computes expected Peak Expiratory Flow Rate using **Nunn & Gregg (1989)** regression equations. Calculates `% of predicted` and assigns GINA Asthma Action Plan zones (**Green** $\ge 80\%$, **Yellow** $50–79\%$, **Red** $< 50\%$).
  - `convertDustVoltageToPm25(voltage)`
    - **What it does**: Converts optical dust sensor voltage output into dust density ($mg/m^3$), estimates $PM_{2.5}$ concentration ($\mu g/m^3$), and maps it to CPCB Air Quality Index (AQI).
  - `calculateAqiFromPm25(pm25)`
    - **What it does**: Performs piecewise linear interpolation across Central Pollution Control Board (CPCB) AQI breakpoints (**Good** 0–50, **Satisfactory** 51–100, **Moderate** 101–200, **Poor** 201–300, **Very Poor** 301–400, **Severe** 401–500).
  - `validateSensorReadings(readings)`
    - **What it does**: Validates physiological values against physiological bounds ($SpO_2$ 50–100%, HR 30–220 bpm, Temp -10–50°C) to prevent garbage input.

#### `src/utils/supabaseClient.ts`
- **Purpose**: Manages Supabase PostgreSQL database connection, authentication, and SQL schema.
- **Functions**:
  - `getSupabaseClient()`: Returns singleton Supabase client instance reading credentials from environment variables (`import.meta.env.VITE_SUPABASE_URL`).
  - `authSignIn(email, password)`: Authenticates user via Supabase Auth.
  - `authSignUp(email, password, patientMetadata)`: Registers new user in Supabase Auth with demographic metadata.
  - `authSignOut()`: Signs out active user session.
  - `authResetPassword(email)`: Dispatches password recovery link.
  - `syncPatientToSupabase(patient)`: Upserts patient demographic profile to `patients` table.
  - `pushSensorReadingToSupabase(reading)`: Pushes IoT sensor telemetry row to `sensor_readings` table.
  - `pushPredictionToSupabase(prediction)`: Archives ML prediction result to `predictions` table.
  - `fetchLatestSensorReadingFromSupabase()`: Retrieves the most recent sensor telemetry packet.
  - `testSupabaseConnection()`: Verifies database connectivity.

#### `src/utils/webSerial.ts`
- **Purpose**: Browser-to-Microcontroller USB communication.
- **Functions**:
  - `connectWebSerial(onLineReceived, onStatusChange)`: Prompts user to select a USB serial device, connects at 115200 baud, decodes incoming byte streams via `TextDecoderStream`, and buffers newline-terminated JSON packets.
  - `disconnectWebSerial()`: Safely closes the active serial port.
  - `isWebSerialSupported()`: Checks if browser supports Chromium Web Serial API.
  - `isRunningInIframe()`: Checks if app is inside a restricted preview iframe.

#### `src/utils/reportGenerator.ts`
- **Purpose**: Generates clinical medical reports.
- **Functions**:
  - `exportPatientRecordsCsv(...)`: Formats and triggers CSV download of patient vitals and prediction history.
  - `exportAllPatientsJson(...)`: Formats complete patient registry as JSON export.

---

### 📁 3. Application State & Provider (`src/context/`)

#### `src/context/AppContext.tsx`
- **Purpose**: Central React Context managing state across all application modules.
- **Key State Variables**: `patient`, `patients`, `activePatientId`, `currentSymptoms`, `currentSensors`, `predictionHistory`, `latestPrediction`, `currentUser`, `inferenceEnginePreference`, `webSerialStatus`, `isSupabaseStreaming`.
- **Key Methods**:
  - `switchPatient(id)`: Switches active profile, saving outgoing telemetry and loading incoming patient records.
  - `addPatient(data)`: Registers new patient into clinical registry.
  - `updatePatient(data)`: Updates active patient demographic details.
  - `deletePatient(id)`: Removes patient record.
  - `runPrediction()`: Executes ML inference engine and saves prediction to history.
  - `processSerialInput(text)`: Parses raw serial console output.
  - `toggleTelemetryStream()`: Toggles virtual rig simulator loop (2.5s cycle).

---

### 📁 4. Front-End User Interface Components (`src/components/`)

1. **`DashboardView.tsx`**: Main overview dashboard displaying active risk status badge, vital cards ($SpO_2$, HR, PEFR, AQI), Supabase cloud stream status, and quick action shortcuts.
2. **`SymptomCheckinView.tsx`**: Interactive GINA clinical symptom diary for tracking cough, wheezing, dyspnea, chest tightness, and nocturnal awakenings.
3. **`SensorReadingView.tsx`**: Telemetry hub supporting physical USB Web Serial, Supabase Cloud Stream, virtual simulator, serial console paste, manual sliders, and clinical preset scenarios.
4. **`ResultView.tsx`**: Comprehensive Explainable AI (XAI) triage module displaying risk probabilities, decision tree votes, SHAP waterfall feature attributions, and GINA action plan recommendations.
5. **`HistoryView.tsx`**: Longitudinal trend history table displaying past predictions, vitals, and risk progression over time.
6. **`AnalyticsView.tsx`**: Graphical analytics charts (powered by Recharts) showing $SpO_2$, PEFR %, AQI, and heart rate trajectories.
7. **`ProfileView.tsx`**: Patient clinical profile management (updating height, weight, smoking status, medication).
8. **`AuthModal.tsx`**: Supabase Authentication modal for Sign In, Account Registration, and Password Recovery.
9. **`HardwareAndCloudModal.tsx`**: Hardware connection manager, NodeMCU ESP8266 & ESP32 pinout reference, and Supabase cloud configuration settings.
10. **`ClinicalReportModal.tsx`**: PDF/Printable medical report generator producing formatted clinical summary sheets.
11. **`ArchitectureView.tsx`**: Engineering dossier detailing system architecture, hardware BOM, dataset derivations, anti-leakage rules, Optuna model benchmarks, and C++ firmware code snippets.
12. **`Header.tsx` & `Navigation.tsx`**: Top header bar and primary navigation tabs.

---

### 📁 5. Backend Server & Python ML Pipeline

#### `server.ts`
- **Purpose**: Full-stack Node.js Express server.
- **Endpoints**:
  - `GET /api/health`: Health check endpoint returning API status.
  - `POST /api/clinical-consultation`: Communicates with Google Gemini API (`gemini-2.5-flash`) to generate AI pulmonologist second-opinion consultations based on patient vitals and prediction results.
  - `Static Middleware`: Serves compiled React frontend (`dist/index.html`) in production (`NODE_ENV=production`).

#### `train_model.py`
- **Purpose**: Machine learning training script built with `scikit-learn`, `pandas`, and `numpy`.
- **Functions**:
  - `generate_clinical_cohort_dataset(n_samples=5000)`: Synthesizes a clinical cohort based on CDC NHANES spirometry distributions and CPCB air quality indices.
  - `export_tree_to_dict(tree, feature_names)`: Recursively serializes scikit-learn `RandomForestClassifier` decision trees into JSON arrays.
  - `train_and_export()`: Splits data (80/20 stratified), trains Random Forest Classifier (`n_estimators=10, max_depth=5`), evaluates classification metrics (accuracy, AUC-ROC, F1), and exports tree architectures to `model_export.json`.

---

# PART 4: Step-by-Step User & Client Operating Guide

### Scenario A: Testing with Virtual Simulator (No Hardware Needed)
1. Open the web app (`https://iot-asthma-prediction.onrender.com/`).
2. Click **Sensor Reading & IoT** tab.
3. Select **Virtual Rig Simulator** ingestion mode.
4. Click **Start Simulator**. Watch vitals fluctuate realistically every 2.5 seconds.
5. Click **Compute Asthma Risk** to view risk triage and SHAP explanations.

### Scenario B: Physical USB Hardware Telemetry
1. Connect NodeMCU ESP8266 or ESP32 via USB cable.
2. Open the web app in Chrome or Edge.
3. Click **Sensor Reading & IoT** $\rightarrow$ **Physical USB (Web Serial)**.
4. Click **Connect NodeMCU / ESP32 (USB)** and select the COM port.
5. Live sensor readings fill into the dashboard automatically.

### Scenario C: Generating a Clinical Report for a Doctor
1. Click **Report** in the top navigation bar.
2. Review the generated medical report.
3. Click **Print / Save PDF** or **Export Markdown** to download the dossier.
