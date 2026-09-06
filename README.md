# IoT-Enabled Early Asthma Risk Prediction & Clinical Decision-Support System

[![Live Demo](https://img.shields.io/badge/Live_App-Render-brightgreen?style=for-the-badge&logo=render)](https://iot-asthma-prediction.onrender.com/)
[![React](https://img.shields.io/badge/Frontend-React_19_%2B_Vite-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase_PostgreSQL-emerald?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Scikit-Learn](https://img.shields.io/badge/ML_Engine-Scikit--Learn-orange?style=for-the-badge&logo=scikit-learn)](https://scikit-learn.org/)

An end-to-end, proactive medical IoT system that fuses multi-sensor telemetry, clinical spirometry normalization, machine learning early warning, and explainable AI (SHAP) to predict asthma exacerbations before overt respiratory distress occurs.

---

## 🌟 Key Features

- **Multi-Sensor Telemetry Ingestion**:
  - **Blood Oxygen Saturation ($SpO_2$) & Heart Rate**: Pulse oximetry via MAX30102.
  - **Environmental Air Quality**: GP2Y optical dust sensor ($PM_{2.5}$) mapped to Central Pollution Control Board (CPCB) AQI standards.
  - **Microclimate**: Ambient Temperature ($^\circ\text{C}$) & Relative Humidity ($\%$) via DHT22.
  - **Mechanical Spirometry**: Peak Expiratory Flow Rate ($PEFR$ in L/min) normalized using **Nunn & Gregg (1989)** sex and height regression equations.

- **Dual-Channel Ingestion Pipeline**:
  - **Path A**: Direct in-browser physical USB hardware connection using the **Chromium Web Serial API** at 115200 baud.
  - **Path B**: Wireless IoT cloud streaming via **NodeMCU ESP8266 / ESP32 Wi-Fi HTTP POST** to Supabase.
  - **Path C**: Autonomous **Virtual Rig Simulator** (2.5s cycle) for hardware-free demonstrations.

- **Machine Learning Early-Warning Engine**:
  - **Scikit-Learn Serialized Decision Forest Ensemble**: 10 decision trees trained on CDC NHANES spirometry and CPCB environmental datasets (`accuracy: 96.0%`, `AUC-ROC: 0.9983`).
  - **Zero Arbitrary Probability Overwrites**: Pure tree leaf probability traversal and normalization ($\sum P = 1.0000$).
  - **Dual Engine Choice**: Selectable between **Trained Decision Forest** and **GINA 2023 Clinical Guideline Baseline**.

- **Explainable AI (SHAP Attribution)**:
  - Calculates local feature attributions (TreeExplainer Shapley values) for every inference.
  - Interactive **Attribution Waterfall** showing exact risk-elevating (red) and protective (green) clinical drivers.

- **Enterprise Security & Cloud Backend**:
  - **Supabase Authentication**: Secure user registration, sign-in, and email OTP recovery.
  - **PostgreSQL Row Level Security (RLS)**: Enforces `auth.uid() = user_id` isolation across `patients`, `sensor_readings`, `predictions`, and `symptom_logs`.

- **Clinical Reports & AI Consultation**:
  - **Printable Medical Dossier**: Formatted PDF/Print and Markdown report export.
  - **Gemini Clinical AI Consultation**: Optional server-side AI second-opinion pulmonologist consultations (`gemini-2.5-flash`).

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5, Vite 6, TailwindCSS 4, Lucide React, Recharts.
- **Backend / Server**: Node.js, Express, `@google/genai`.
- **Database & Auth**: Supabase PostgreSQL 15, Supabase JS Client v2, Row-Level Security.
- **Machine Learning & Pipeline**: Python 3.13, Scikit-Learn 1.9, Pandas, NumPy.
- **Hardware Rig**: NodeMCU ESP8266 / ESP32 DevKit, MAX30102, DHT22, GP2Y1010AU0F, Mini-Wright Peak Flow Meter.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- **Node.js**: v18+ or v20+
- **Python**: 3.9+ (for retraining the ML model)

### 1. Clone the Repository
```bash
git clone https://github.com/Tanmay-cod/ASTHAMA.git
cd ASTHAMA
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-optional-gemini-api-key
```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in Google Chrome or Microsoft Edge.

---

## 🧪 Automated Testing & Verification

Run the automated clinical calculation and decision forest test suite:
```bash
npm test
```
*Executes unit tests covering Nunn & Gregg PEFR equations, CPCB AQI breakpoints, decision forest probability normalization ($\sum P = 1.0000$), and triage classification bounds.*

To run TypeScript compilation and lint checks:
```bash
npm run lint
```

---

## 🤖 Machine Learning Pipeline & Model Retraining

The Random Forest model is trained via `train_model.py`:

```bash
# 1. Install Python requirements
python -m pip install scikit-learn pandas numpy

# 2. Execute training script
python train_model.py
```

- **Training Output**: Generates `model_export.json` containing serialized decision tree split thresholds, features, and leaf probabilities transcribed into `src/ml/trainedForestModel.ts`.

---

## 🌐 Production Deployment (Render + Supabase)

### 1. Supabase Database Setup
Run the SQL schema provided in `PROJECT_DOCUMENTATION.md` or `src/utils/supabaseClient.ts` in the **Supabase SQL Editor** to generate `patients`, `sensor_readings`, `predictions`, and `symptom_logs` tables with Row Level Security.

### 2. Deploy Full-Stack App to Render
1. Connect your GitHub repository `Tanmay-cod/ASTHAMA` to **[Render.com](https://render.com)**.
2. Select **Web Service**.
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm start`
5. **Environment Variables**:
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
   - `NODE_ENV` = `production`

---

## 📖 Comprehensive Guides & Documentation

- 📄 **[CLIENT_AND_PEER_EXPLANATION_GUIDE.md](CLIENT_AND_PEER_EXPLANATION_GUIDE.md)**: Master presentation script, 3-minute client pitch, and complete function-by-function code reference guide.
- 📄 **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)**: Full engineering dossier, clinical datasets (NHANES/CPCB), hardware pinouts, and mathematical formulas.

---

## 📄 License & Medical Disclaimer

This software is developed for research, engineering demonstration, and educational purposes. Peak flow measurements and sensor readings should be verified with certified clinical diagnostic equipment. Emergency respiratory distress ($SpO_2 < 92\%$) requires immediate medical evaluation.
