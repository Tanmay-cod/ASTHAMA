import React, { useState, useMemo } from 'react';
import { 
  History as HistoryIcon, 
  Download, 
  Trash2, 
  Calendar, 
  Filter, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  Activity,
  Wind,
  CloudRain,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { useApp } from '../context/AppContext';
import { MedicalDisclaimer } from './MedicalDisclaimer';

export const HistoryView: React.FC = () => {
  const { 
    patient,
    predictionHistory, 
    deletePrediction, 
    clearAllHistory, 
    showToast, 
    setActiveTab,
    openReportModal,
    exportData
  } = useApp();

  const [filterRisk, setFilterRisk] = useState<'all' | 'Low' | 'Moderate' | 'High'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeChartMetric, setActiveChartMetric] = useState<'all' | 'pefr' | 'spo2' | 'aqi'>('all');

  const filteredHistory = useMemo(() => {
    if (filterRisk === 'all') return predictionHistory;
    return predictionHistory.filter((p) => p.risk_class === filterRisk);
  }, [predictionHistory, filterRisk]);

  // Transform chronological history for Recharts (oldest -> newest)
  const chartData = useMemo(() => {
    return [...predictionHistory]
      .reverse()
      .map((item, idx) => {
        const date = new Date(item.created_at);
        const label = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        return {
          id: item.id,
          timeLabel: label,
          pefrPct: item.assembled_features.pefr_pct_pred,
          pefrLmin: item.assembled_features.pefr_pct_pred,
          spo2: item.assembled_features.spo2,
          aqi: item.assembled_features.aqi,
          symptoms: item.assembled_features.symptom_score * 10, // scaled to 0-100 for easy plotting
          riskScore: item.risk_class === 'High' ? 90 : item.risk_class === 'Moderate' ? 55 : 20,
          riskClass: item.risk_class,
        };
      });
  }, [predictionHistory]);

  // Export to CSV function
  const handleExportCsv = () => {
    if (predictionHistory.length === 0) {
      showToast('No history available to export.', 'info');
      return;
    }

    const headers = [
      'Timestamp',
      'Risk_Class',
      'Prob_Low',
      'Prob_Moderate',
      'Prob_High',
      'PEFR_Measured_Lmin',
      'PEFR_Percent_Predicted',
      'SpO2_Percent',
      'Heart_Rate_Bpm',
      'AQI',
      'Temperature_C',
      'Humidity_Pct',
      'Symptom_Score',
      'Model_Version'
    ];

    const rows = predictionHistory.map((p) => [
      p.created_at,
      p.risk_class,
      p.prob_low,
      p.prob_medium,
      p.prob_high,
      p.assembled_features.pefr_pct_pred,
      p.pefr_percent_predicted,
      p.assembled_features.spo2,
      p.assembled_features.heart_rate,
      p.assembled_features.aqi,
      p.assembled_features.temperature_c,
      p.assembled_features.humidity_pct,
      p.assembled_features.symptom_score,
      p.model_version
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `asthma_prediction_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Exported prediction history to CSV.', 'success');
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div id="history-view-container" className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Longitudinal History & Trends</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Tracking chronological changes in expiratory airflow (PEFR), blood oxygenation, and air pollution exposure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="history-generate-report-btn"
            onClick={() => openReportModal(patient.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
            title="Generate Clinical Report for active patient"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Report</span>
          </button>

          <button
            id="history-export-csv-btn"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Export CSV</span>
          </button>

          <button
            id="history-export-json-btn"
            onClick={() => exportData('json')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-lg transition-colors border border-slate-200 cursor-pointer"
            title="Export full registry ledger as JSON"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>

          {predictionHistory.length > 0 && (
            <button
              id="history-clear-all-btn"
              onClick={() => {
                if (window.confirm('Erase all local patient prediction records? This complies with health data privacy rules.')) {
                  clearAllHistory();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs sm:text-sm font-medium rounded-lg transition-colors"
              title="Delete all data"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Metric Trend Chart (Recharts) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Physiological & Environmental Timeline</h2>
            <p className="text-xs text-slate-500">Track how PEFR% airflow dips correspond to AQI spikes or symptom surges</p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveChartMetric('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeChartMetric === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Signals
            </button>
            <button
              onClick={() => setActiveChartMetric('pefr')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeChartMetric === 'pefr' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PEFR %
            </button>
            <button
              onClick={() => setActiveChartMetric('spo2')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeChartMetric === 'spo2' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SpO₂ %
            </button>
            <button
              onClick={() => setActiveChartMetric('aqi')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeChartMetric === 'aqi' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AQI
            </button>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    borderColor: '#CBD5E1',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                {(activeChartMetric === 'all' || activeChartMetric === 'pefr') && (
                  <Line
                    type="monotone"
                    name="PEFR (% pred)"
                    dataKey="pefrPct"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#2563EB' }}
                    activeDot={{ r: 6 }}
                  />
                )}

                {(activeChartMetric === 'all' || activeChartMetric === 'spo2') && (
                  <Line
                    type="monotone"
                    name="SpO₂ (%)"
                    dataKey="spo2"
                    stroke="#16A34A"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#16A34A' }}
                  />
                )}

                {(activeChartMetric === 'all' || activeChartMetric === 'aqi') && (
                  <Line
                    type="monotone"
                    name="Ambient AQI"
                    dataKey="aqi"
                    stroke="#D97706"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#D97706' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
            No chronological data points available yet.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span>PEFR Green Zone: &ge;80%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Yellow Zone: 50–79%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <span>Red Zone: &lt;50%</span>
          </span>
        </div>
      </div>

      {/* Historical Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Filter Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-800">Filter by Classification:</span>
            <div className="flex items-center gap-1">
              {(['all', 'High', 'Moderate', 'Low'] as const).map((lvl) => (
                <button
                  key={lvl}
                  id={`filter-risk-${lvl.toLowerCase()}`}
                  onClick={() => setFilterRisk(lvl)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition-colors ${
                    filterRisk === lvl
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-slate-500">
            Showing <strong>{filteredHistory.length}</strong> of {predictionHistory.length} recordings
          </span>
        </div>

        {/* Table Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Risk Class</th>
                <th className="py-3 px-4">PEFR (% pred)</th>
                <th className="py-3 px-4">SpO₂</th>
                <th className="py-3 px-4">Heart Rate</th>
                <th className="py-3 px-4">Ambient AQI</th>
                <th className="py-3 px-4">Primary SHAP Driver</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredHistory.map((item) => {
                const isExpanded = expandedId === item.id;
                const topDriver = item.top_shap_features[0];

                return (
                  <React.Fragment key={item.id}>
                    <tr 
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/40' : ''}`}
                      onClick={() => toggleExpand(item.id)}
                    >
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                        {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                          item.risk_class === 'High'
                            ? 'bg-red-100 text-red-700'
                            : item.risk_class === 'Moderate'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {item.risk_class}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-800">
                        {item.assembled_features.pefr_pct_pred}%
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-800">
                        {item.assembled_features.spo2}%
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        {item.assembled_features.heart_rate} bpm
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{item.assembled_features.aqi}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 max-w-xs truncate">
                        {topDriver ? `${topDriver.label} (${topDriver.impact > 0 ? '+' : ''}${topDriver.impact})` : '—'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Row with SHAP & Recommendations */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={8} className="p-4 border-b border-slate-200">
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              
                              {/* Left: Summary & Recommendation */}
                              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 text-xs">
                                <span className="font-bold text-slate-900 block">Clinical Assessment Note:</span>
                                <p className="text-slate-700">{item.recommendation.summary}</p>
                                <div className="pt-2 text-slate-500 font-medium">
                                  <strong>Care Actions:</strong> {item.recommendation.actions.join('; ')}
                                </div>
                              </div>

                              {/* Right: Top SHAP Attributions */}
                              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5 text-xs">
                                <span className="font-bold text-slate-900 block flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Key Contributing SHAP Attributions:</span>
                                </span>
                                <ul className="space-y-1">
                                  {item.top_shap_features.slice(0, 3).map((shap, sIdx) => (
                                    <li key={sIdx} className="flex items-center justify-between text-[11px]">
                                      <span className="text-slate-700">{shap.label}</span>
                                      <span className={`font-mono font-bold ${
                                        shap.impact > 0 ? 'text-red-700' : 'text-emerald-700'
                                      }`}>
                                        {shap.impact > 0 ? `+${shap.impact}` : `${shap.impact}`}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                              <span>Record ID: <code className="font-mono text-slate-700">{item.id}</code></span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePrediction(item.id);
                                }}
                                className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete this reading</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                    No historical logs matching current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MedicalDisclaimer />

    </div>
  );
};
