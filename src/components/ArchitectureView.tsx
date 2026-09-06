import React, { useState } from 'react';
import { 
  Cpu, 
  Layers, 
  Database, 
  Code, 
  ShieldCheck, 
  ExternalLink, 
  Check, 
  Copy,
  Sliders,
  Terminal,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { MedicalDisclaimer } from './MedicalDisclaimer';

export const ArchitectureView: React.FC = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'nodemcu' | 'dht_test' | 'max_test' | 'dust_test' | 'esp32'>('nodemcu');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const nodemcuFirmware = `// =====================================================
//   IoT Early Asthma Predictor - NodeMCU ESP8266
// =====================================================
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>
#include <Wire.h>

#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"

#include <DHT.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* WIFI_SSID = "Brotherhood";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase Configuration
const char* SUPABASE_URL = "https://YOUR_SUPABASE_PROJECT_ID.supabase.co/rest/v1/sensor_readings";
const char* SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Pin Definitions
#define DHTPIN D4           // DHT22 DATA -> GPIO2
#define DHTTYPE DHT22
#define DUST_LED_PIN D5     // GP2Y LED -> GPIO14
#define DUST_ANALOG_PIN A0  // GP2Y Vo -> ADC0 (via 10k/33k divider)

// Dust sensor pulse timing (10ms duty cycle)
const int SAMPLING_TIME_US = 280;
const int DELTA_TIME_US = 40;
const int SLEEP_TIME_US = 9680;

const unsigned long SEND_INTERVAL_MS = 3000;

MAX30105 particleSensor;
DHT dht(DHTPIN, DHTTYPE);

uint32_t irBuffer[100];
uint32_t redBuffer[100];
int32_t spo2;
int8_t validSPO2;
int32_t heartRate;
int8_t validHeartRate;

unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\\n==========================================");
  Serial.println(" IoT Early Asthma Predictor - NodeMCU ESP8266");
  Serial.println("==========================================");

  pinMode(DUST_LED_PIN, OUTPUT);
  digitalWrite(DUST_LED_PIN, HIGH); // LED OFF (active LOW)

  dht.begin();
  Serial.println("[OK] DHT22 on D4 initialized.");

  // NodeMCU I2C: D2 = SDA (GPIO4), D1 = SCL (GPIO5)
  Wire.begin(D2, D1);
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[WARN] MAX30102 not detected. Check D2(SDA) and D1(SCL).");
  } else {
    particleSensor.setup(60, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
    Serial.println("[OK] MAX30102 initialized on D2/D1.");
  }

  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\n[OK] WiFi connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\\n[WARN] WiFi connection failed.");
  }
}

float readDustDensityMgM3() {
  digitalWrite(DUST_LED_PIN, LOW);
  delayMicroseconds(SAMPLING_TIME_US);
  int rawAdc = analogRead(DUST_ANALOG_PIN);
  delayMicroseconds(DELTA_TIME_US);
  digitalWrite(DUST_LED_PIN, HIGH);
  delayMicroseconds(SLEEP_TIME_US);

  float a0Voltage = (rawAdc * 3.3f) / 1023.0f;
  float sensorVoltage = a0Voltage * (43.0f / 33.0f);
  float density = (0.17f * sensorVoltage) - 0.10f;
  return density < 0.0f ? 0.0f : density;
}

float calculateAqiFromPm25(float pm25) {
  if (pm25 <= 30.0f) return (pm25 / 30.0f) * 50.0f;
  if (pm25 <= 60.0f) return 50.0f + ((pm25 - 30.0f) / 30.0f) * 50.0f;
  if (pm25 <= 90.0f) return 100.0f + ((pm25 - 60.0f) / 30.0f) * 100.0f;
  if (pm25 <= 120.0f) return 200.0f + ((pm25 - 90.0f) / 30.0f) * 100.0f;
  return 300.0f + ((pm25 - 120.0f) / 130.0f) * 100.0f;
}

bool readMAX30102(int32_t &hr, int32_t &sp) {
  for (int i = 0; i < 100; i++) {
    while (!particleSensor.available()) particleSensor.check();
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();
    particleSensor.nextSample();
  }
  if (irBuffer[99] < 50000) return false;

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, 100, redBuffer, &spo2, &validSPO2, &heartRate, &validHeartRate
  );
  if (validHeartRate && validSPO2) {
    hr = heartRate;
    sp = spo2;
    return true;
  }
  return false;
}

// Set your registered patient ID or Supabase auth.users UID:
const char* USER_ID = "pat_registered_patient_id";

void sendToSupabase(float t, float h, float dust, float pm25, float aqi, int32_t hr, int32_t sp, bool valid) {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    return;
  }
  StaticJsonDocument<512> doc;
  doc["user_id"] = USER_ID;
  if (valid) {
    doc["spo2"] = sp;
    doc["heart_rate"] = hr;
  } else {
    doc["spo2"] = nullptr;
    doc["heart_rate"] = nullptr;
  }
  doc["temperature_c"] = t;
  doc["humidity_pct"] = h;
  doc["dust_density_mgm3"] = dust;
  doc["pm25_est"] = pm25;
  doc["aqi"] = aqi;
  doc["source"] = "nodemcu_esp8266_wifi";

  String jsonOutput;
  serializeJson(doc, jsonOutput);
  Serial.println("[TELEMETRY JSON] " + jsonOutput);

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  if (http.begin(client, SUPABASE_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    http.addHeader("Prefer", "return=minimal");
    int code = http.POST(jsonOutput);
    Serial.printf(">> Supabase HTTP: %d\\n", code);
    http.end();
  }
}

void loop() {
  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (isnan(t) || isnan(h)) { t = 0; h = 0; }

    float dust = readDustDensityMgM3();
    float pm25 = dust * 600.0f;
    float aqi = calculateAqiFromPm25(pm25);

    int32_t hr = 0, sp = 0;
    bool valid = readMAX30102(hr, sp);

    sendToSupabase(t, h, dust, pm25, aqi, hr, sp, valid);
  }
}`;

  const dhtTestCode = `// Single Sensor Test 1: DHT22 on NodeMCU ESP8266 (Pin D4)
#include <DHT.h>

#define DHTPIN D4     // GPIO2 on NodeMCU
#define DHTTYPE DHT22

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n--- Testing DHT22 on NodeMCU Pin D4 ---");
  dht.begin();
}

void loop() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    Serial.println("[ERROR] Failed to read from DHT22. Check 3.3V, GND, and D4 with 10k pullup.");
  } else {
    Serial.print("[DHT22 OK] Temperature: ");
    Serial.print(temp, 1);
    Serial.print(" °C | Humidity: ");
    Serial.print(hum, 1);
    Serial.println(" %");
  }
  delay(2000);
}`;

  const maxTestCode = `// Single Sensor Test 2: MAX30102 on NodeMCU (SDA=D2, SCL=D1)
#include <Wire.h>
#include "MAX30105.h"

MAX30105 particleSensor;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n--- Testing MAX30102 on NodeMCU D2/D1 ---");

  // NodeMCU: D2 = GPIO4 (SDA), D1 = GPIO5 (SCL)
  Wire.begin(D2, D1);

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[ERROR] MAX30102 sensor was not found!");
    Serial.println("Check SDA -> D2, SCL -> D1, VCC -> 3.3V, GND -> GND.");
    while (1);
  }

  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeGreen(0);
  Serial.println("[MAX30102 OK] Sensor configured. Place finger gently on sensor...");
}

void loop() {
  long irValue = particleSensor.getIR();
  long redValue = particleSensor.getRed();

  if (irValue < 50000) {
    Serial.printf("No finger detected. IR: %ld\\n", irValue);
  } else {
    Serial.printf("[FINGER DETECTED] IR: %ld | RED: %ld\\n", irValue, redValue);
  }
  delay(500);
}`;

  const dustTestCode = `// Single Sensor Test 3: GP2Y1010AU0F Dust Sensor on NodeMCU (LED=D5, Vo=A0)
#define DUST_LED_PIN D5     // GPIO14
#define DUST_ANALOG_PIN A0  // ADC0 (0-1.0V or 0-3.3V depending on module)

const int SAMPLING_TIME_US = 280;
const int DELTA_TIME_US = 40;
const int SLEEP_TIME_US = 9680;

void setup() {
  Serial.begin(115200);
  delay(1000);
  pinMode(DUST_LED_PIN, OUTPUT);
  digitalWrite(DUST_LED_PIN, HIGH); // LED off
  Serial.println("\\n--- Testing GP2Y Dust Sensor on NodeMCU (D5, A0) ---");
}

void loop() {
  // 10ms sampling pulse
  digitalWrite(DUST_LED_PIN, LOW); // LED ON
  delayMicroseconds(SAMPLING_TIME_US);
  int rawAdc = analogRead(DUST_ANALOG_PIN);
  delayMicroseconds(DELTA_TIME_US);
  digitalWrite(DUST_LED_PIN, HIGH); // LED OFF
  delayMicroseconds(SLEEP_TIME_US);

  // Convert NodeMCU 10-bit ADC (0-1023)
  float a0Voltage = (rawAdc * 3.3f) / 1023.0f;
  float sensorVoltage = a0Voltage * (43.0f / 33.0f); // 10k / 33k divider
  float density = (0.17f * sensorVoltage) - 0.10f;
  if (density < 0.0f) density = 0.0f;
  float pm25 = density * 600.0f;

  Serial.printf("Raw ADC: %4d | Vo: %.3f V | Dust: %.4f mg/m3 | PM2.5: %.1f ug/m3\\n", rawAdc, sensorVoltage, density, pm25);
  delay(1000);
}`;

  const esp32Firmware = `// ESP32 DevKit WROOM-32 Implementation
// SDA=GPIO21, SCL=GPIO22, DHT=GPIO4, Dust LED=GPIO25, Dust Vo=GPIO34
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "MAX30105.h"
#include <DHT.h>

#define DHTPIN 4
#define DHTTYPE DHT22
#define DUST_LED_PIN 25
#define DUST_ANALOG_PIN 34

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* supabase_url = "https://YOUR_SUPABASE_PROJECT_ID.supabase.co/rest/v1/sensor_readings";
const char* supabase_anon_key = "YOUR_KEY";

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  WiFi.begin(ssid, password);
}
void loop() {
  // Read sensors and POST to Supabase
  delay(3000);
}`;

  const getActiveCode = () => {
    switch (activeCodeTab) {
      case 'nodemcu': return nodemcuFirmware;
      case 'dht_test': return dhtTestCode;
      case 'max_test': return maxTestCode;
      case 'dust_test': return dustTestCode;
      case 'esp32': return esp32Firmware;
    }
  };

  return (
    <div id="architecture-view-container" className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Engineering Specifications & System Architecture</h1>
        </div>
        <p className="text-sm text-slate-600">
          Comprehensive technical dossier for final-year project evaluations: hardware pinout, clinical derivations, ML governance, and IoT ingestion contracts.
        </p>
      </div>

      {/* High-Level Architecture Flow Diagram */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>1. End-to-End System Architecture</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          
          {/* Edge Tier */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-bold text-slate-900 block text-sm">Edge / IoT Hardware</span>
            <ul className="space-y-1 text-slate-600">
              <li>• <strong>NodeMCU ESP8266</strong> (or ESP32)</li>
              <li>• <strong>MAX30102</strong> (SpO₂, Pulse)</li>
              <li>• <strong>DHT22</strong> (Temp, Humidity)</li>
              <li>• <strong>GP2Y1010AU0F</strong> (Dust mg/m³)</li>
              <li>• <strong>Mini-Wright</strong> (PEFR Manual)</li>
            </ul>
            <div className="text-[11px] font-semibold text-blue-700 pt-1">
              Dual Link: WiFi HTTPS / USB Serial
            </div>
          </div>

          {/* Database Tier */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-bold text-slate-900 block text-sm">Storage & Security</span>
            <ul className="space-y-1 text-slate-600">
              <li>• <strong>Supabase / Postgres 15</strong></li>
              <li>• <code>patients</code> (Onboarding)</li>
              <li>• <code>symptom_logs</code> (0–10 scale)</li>
              <li>• <code>sensor_readings</code> (IoT)</li>
              <li>• <code>predictions</code> (History)</li>
            </ul>
            <div className="text-[11px] font-semibold text-emerald-700 pt-1">
              Row-Level Security (RLS) Active
            </div>
          </div>

          {/* ML Serving Tier */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-bold text-slate-900 block text-sm">Machine Learning Tier</span>
            <ul className="space-y-1 text-slate-600">
              <li>• <strong>Random Forest</strong> (287 Trees)</li>
              <li>• <strong>Optuna Tuned</strong> (Macro-F1)</li>
              <li>• <strong>SMOTETomek</strong> Balanced</li>
              <li>• <strong>TreeExplainer</strong> SHAP values</li>
              <li>• <strong>Nunn & Gregg</strong> PEFR% norm</li>
            </ul>
            <div className="text-[11px] font-semibold text-purple-700 pt-1">
              ROC-AUC: 0.9554 • Acc: 92.48%
            </div>
          </div>

          {/* UI Dashboard Tier */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-bold text-slate-900 block text-sm">Clinical UI & Triage</span>
            <ul className="space-y-1 text-slate-600">
              <li>• <strong>React SPA + Vite</strong></li>
              <li>• Low / Moderate / High Badge</li>
              <li>• Feature Attribution Waterfall</li>
              <li>• Longitudinal Trends (Recharts)</li>
              <li>• Action Plan Recommendations</li>
            </ul>
            <div className="text-[11px] font-semibold text-amber-700 pt-1">
              Sub-second Triage Feedback
            </div>
          </div>

        </div>
      </div>

      {/* Hardware Wiring & Pinout Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            <span>2. Hardware Bill of Materials (BOM) & Pinout Table</span>
          </h2>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-md uppercase">
            Active: NodeMCU ESP8266
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Component</th>
                <th className="py-2.5 px-3">Protocol</th>
                <th className="py-2.5 px-3 bg-blue-50/70 text-blue-900 font-bold">NodeMCU Pinout (Active)</th>
                <th className="py-2.5 px-3">ESP32 Pinout</th>
                <th className="py-2.5 px-3">Voltage</th>
                <th className="py-2.5 px-3">Calibration & Calculation Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 px-3 font-semibold text-slate-900">MAX30102</td>
                <td className="py-2.5 px-3">I2C (Fast 400kHz)</td>
                <td className="py-2.5 px-3 font-mono font-bold text-blue-700 bg-blue-50/40">
                  SDA: D2 (GPIO4)<br />SCL: D1 (GPIO5)
                </td>
                <td className="py-2.5 px-3 font-mono text-slate-600">SDA: 21, SCL: 22</td>
                <td className="py-2.5 px-3">3.3V</td>
                <td className="py-2.5 px-3 text-slate-600">SpO₂ & Heart Rate with red/IR photoplethysmography (Maxim algorithm)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-slate-900">DHT22 (AM2302)</td>
                <td className="py-2.5 px-3">Single-bus digital</td>
                <td className="py-2.5 px-3 font-mono font-bold text-blue-700 bg-blue-50/40">
                  DATA: D4 (GPIO2)<br />(10k pull-up to 3.3V)
                </td>
                <td className="py-2.5 px-3 font-mono text-slate-600">DATA: GPIO4</td>
                <td className="py-2.5 px-3">3.3V</td>
                <td className="py-2.5 px-3 text-slate-600">Ambient Temperature (-40 to 80°C) & Relative Humidity (0-100%)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-slate-900">GP2Y1010AU0F Dust Sensor</td>
                <td className="py-2.5 px-3">Pulsed LED + ADC</td>
                <td className="py-2.5 px-3 font-mono font-bold text-blue-700 bg-blue-50/40">
                  LED: D5 (GPIO14)<br />Vo: A0 (ADC0)
                </td>
                <td className="py-2.5 px-3 font-mono text-slate-600">LED: 25, Vo: 34</td>
                <td className="py-2.5 px-3">5V (VIN) / 3.3V ADC</td>
                <td className="py-2.5 px-3 text-slate-600">
                  Vo piped through 10k/33k voltage divider. Converted via: <code>density = 0.17*V - 0.1</code>; PM2.5 = dust × 600
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-slate-900">Mini-Wright Peak Flow Meter</td>
                <td className="py-2.5 px-3">Manual Entry</td>
                <td className="py-2.5 px-3 font-mono text-slate-600 bg-blue-50/40">App Input</td>
                <td className="py-2.5 px-3 font-mono text-slate-600">App Input</td>
                <td className="py-2.5 px-3">N/A</td>
                <td className="py-2.5 px-3 text-slate-600">
                  Normalized via Nunn & Gregg (1989) sex/height formula: <code>% predicted = (measured / predicted) * 100</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ML Pipeline & Model Governance */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          <span>3. Clinical Dataset & Model Governance Specs</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 block text-sm">NHANES 2011-2012 Spirometry Derivation</span>
            <ul className="space-y-1.5 text-slate-700">
              <li>• <strong>Files:</strong> <code>SPX_G</code>, <code>DEMO_G</code>, <code>BMX_G</code>, <code>MCQ_G</code>, <code>SMQ_G</code>, <code>RDQ_G</code></li>
              <li>• <strong>Quality Filter:</strong> Spirometry grades A/B/C retained (ATS/ERS standard).</li>
              <li>• <strong>Label Definition:</strong> 
                <span className="block pl-3 text-slate-600 mt-0.5">
                  - <strong>Low:</strong> No asthma diagnosis<br />
                  - <strong>Medium:</strong> Diagnosed with FEV1/FVC &ge; 0.70<br />
                  - <strong>High:</strong> Diagnosed with FEV1/FVC &lt; 0.70 (GINA obstruction threshold)
                </span>
              </li>
              <li>• <strong>Anti-Leakage Mandate:</strong> FEV1, FVC, and FEV1/FVC ratio are strictly dropped from input features!</li>
            </ul>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 block text-sm">Model Benchmark Comparison</span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-1">Model</th>
                    <th className="py-1">Macro-F1</th>
                    <th className="py-1">ROC-AUC</th>
                    <th className="py-1">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-1 font-semibold text-blue-700">Random Forest (Optuna)</td>
                    <td className="py-1 font-bold">0.918</td>
                    <td className="py-1 font-bold">0.9554</td>
                    <td className="py-1 font-bold">92.48%</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-700">XGBoost (Tuned)</td>
                    <td className="py-1">0.914</td>
                    <td className="py-1">0.9520</td>
                    <td className="py-1">92.10%</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-700">LightGBM</td>
                    <td className="py-1">0.908</td>
                    <td className="py-1">0.9482</td>
                    <td className="py-1">91.65%</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-700">CatBoost</td>
                    <td className="py-1">0.911</td>
                    <td className="py-1">0.9501</td>
                    <td className="py-1">91.90%</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-500">Logistic Baseline</td>
                    <td className="py-1">0.782</td>
                    <td className="py-1">0.8350</td>
                    <td className="py-1">79.20%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-emerald-800 font-semibold pt-1">
              Zero High-Risk cases misclassified as Low-Risk in confusion matrix.
            </div>
          </div>

        </div>
      </div>

      {/* Arduino Firmware Source Code Tabs */}
      <div className="bg-slate-900 rounded-xl p-5 text-emerald-400 font-mono text-xs space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-300 font-sans border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-sm">Arduino Firmware & Sensor Diagnostics</span>
          </div>

          <button
            onClick={() => copyToClipboard(getActiveCode(), activeCodeTab)}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            {copiedCode === activeCodeTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode === activeCodeTab ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Code Selector Tabs */}
        <div className="flex flex-wrap gap-1 text-[11px] font-sans">
          <button
            onClick={() => setActiveCodeTab('nodemcu')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              activeCodeTab === 'nodemcu' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ★ NodeMCU ESP8266 Full Firmware
          </button>
          <button
            onClick={() => setActiveCodeTab('dht_test')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              activeCodeTab === 'dht_test' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Test 1: DHT22 (D4)
          </button>
          <button
            onClick={() => setActiveCodeTab('max_test')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              activeCodeTab === 'max_test' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Test 2: MAX30102 (D2/D1)
          </button>
          <button
            onClick={() => setActiveCodeTab('dust_test')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              activeCodeTab === 'dust_test' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Test 3: Dust Sensor (D5, A0)
          </button>
          <button
            onClick={() => setActiveCodeTab('esp32')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              activeCodeTab === 'esp32' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ESP32 Reference
          </button>
        </div>

        <pre className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto text-[11px] leading-relaxed max-h-80 scrollbar-thin">
          {getActiveCode()}
        </pre>
      </div>

      <MedicalDisclaimer />

    </div>
  );
};
