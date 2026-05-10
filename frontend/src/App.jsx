import { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Chatbot from './Chatbot';
import EmergencyResponse from './components/EmergencyResponse';
import { translations } from './translations';
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [qualityError, setQualityError] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [showReportForm, setShowReportForm] = useState(false);
  const [patientDetails, setPatientDetails] = useState({
    name: '', age: '', id: '', doctor: '', hospital: ''
  });
  
  const [activeTab, setActiveTab] = useState('diagnose');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveReports, setArchiveReports] = useState([]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'en');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [groupByHospital, setGroupByHospital] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);
  
  const t = translations[lang] || translations.en;
  
  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);
  
  const fileInputRef = useRef(null);

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (activeTab === 'archive' || activeTab === 'analytics') {
      fetchArchive();
    }
  }, [activeTab]);

  const fetchArchive = async () => {
    setLoadingArchive(true);
    try {
      const url = archiveSearch 
        ? `http://127.0.0.1:8000/reports/search?q=${encodeURIComponent(archiveSearch)}`
        : `http://127.0.0.1:8000/reports/search`;
      const res = await fetch(url);
      const data = await res.json();
      setArchiveReports(data);
    } catch (err) {
      console.error("Failed to fetch archive", err);
    } finally {
      setLoadingArchive(false);
    }
  };

  const viewPatientHistory = async (patientId) => {
    setLoadingArchive(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/reports/search?q=${encodeURIComponent(patientId)}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      if (!data || data.length === 0) {
        alert("No history found for this patient ID.");
        return;
      }
      setPatientHistory(data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
      setSelectedPatient(patientId);
    } catch (err) {
      console.error("Failed to load patient history", err);
      alert("Error: Could not retrieve patient records from the database.");
      setSelectedPatient(null);
    } finally {
      setLoadingArchive(false);
    }
  };

  const saveAndDownloadReport = async () => {
    try {
      const payload = {
        patient_name: patientDetails.name || 'N/A',
        patient_age: patientDetails.age || 'N/A',
        patient_id: patientDetails.id || 'N/A',
        doctor: patientDetails.doctor || 'N/A',
        hospital: patientDetails.hospital || 'N/A',
        prediction: result.prediction,
        confidence: result.confidence,
        original_image_b64: preview
      };
      
      await fetch('http://127.0.0.1:8000/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Failed to save report to DB", err);
    }
    
    await generatePDF();
    setShowReportForm(false);
  };

  // Converts any image src to normalized JPEG data URL via canvas
  const toCanvasJpeg = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 300;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch(e) {
        console.error('Canvas draw failed, using src directly:', e);
        resolve(src); // fallback: use source directly
      }
    };
    img.onerror = (e) => {
      console.error('Image load failed for PDF:', e, 'src prefix:', src?.slice(0, 50));
      resolve(null);
    };
    img.src = src;
  });

  const generatePDF = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, m = 18;
    const isParasitized = result.prediction === 'Parasitized';

    // Border
    doc.setDrawColor(14, 165, 233); doc.setLineWidth(0.6);
    doc.rect(8, 8, W - 16, H - 16);
    doc.setLineWidth(0.2); doc.rect(10, 10, W - 20, H - 20);

    // Header bar
    doc.setFillColor(10, 50, 90); doc.rect(8, 8, W - 16, 28, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(255,255,255);
    doc.text('MalariaAI', m, 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(150, 200, 240);
    doc.text('AI-Powered Clinical Diagnostic System', m, 29);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255,255,255);
    doc.text(patientDetails.hospital || 'Diagnostic Center', W - m, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150,200,240);
    doc.text(`Report Date: ${new Date().toLocaleString()}`, W - m, 29, { align: 'right' });

    // Title
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 50, 90);
    doc.text('CLINICAL DIAGNOSTIC REPORT', W / 2, 46, { align: 'center' });
    doc.setDrawColor(14, 165, 233); doc.setLineWidth(0.5); doc.line(m, 49, W - m, 49);

    // Patient Info Box
    doc.setFillColor(240, 248, 255); doc.roundedRect(m, 53, W - m * 2, 36, 3, 3, 'F');
    doc.setDrawColor(14, 165, 233); doc.setLineWidth(0.3); doc.roundedRect(m, 53, W - m * 2, 36, 3, 3, 'S');
    doc.setFillColor(14, 165, 233); doc.roundedRect(m, 53, 36, 7, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255,255,255);
    doc.text('PATIENT DETAILS', m + 3, 58);

    doc.setFontSize(8.5); doc.setTextColor(80,100,120); doc.setFont('helvetica', 'normal');
    doc.text('Patient Name', m + 4, 67); doc.text('Patient ID', m + 60, 67); doc.text('Age', m + 115, 67);
    doc.setTextColor(10, 50, 90); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(patientDetails.name || 'N/A', m + 4, 74);
    doc.text(patientDetails.id || 'N/A', m + 60, 74);
    doc.text(patientDetails.age || 'N/A', m + 115, 74);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(80,100,120);
    doc.text('Referring Doctor', m + 4, 82); doc.text('Institution', m + 80, 82);
    doc.setTextColor(10,50,90); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`Dr. ${patientDetails.doctor || 'N/A'}`, m + 4, 87);
    doc.text(patientDetails.hospital || 'N/A', m + 80, 87);

    // Diagnosis Result
    const diagY = 95;
    const diagColor = isParasitized ? [255,235,235] : [220,252,231];
    const diagBorder = isParasitized ? [239,68,68] : [16,185,129];
    const diagText = isParasitized ? [180,20,20] : [5,100,50];
    doc.setFillColor(...diagColor); doc.roundedRect(m, diagY, W - m * 2, 26, 3, 3, 'F');
    doc.setDrawColor(...diagBorder); doc.setLineWidth(0.5); doc.roundedRect(m, diagY, W - m * 2, 26, 3, 3, 'S');
    doc.setFillColor(...diagBorder); doc.rect(m, diagY, 4, 26, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100,100,100);
    doc.text('AI DIAGNOSTIC RESULT', m + 9, diagY + 8);
    doc.setFontSize(16); doc.setTextColor(...diagText);
    doc.text(result.prediction.toUpperCase(), m + 9, diagY + 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
    doc.text(`Confidence Score: ${result.confidence}%`, m + 9, diagY + 23);
    // Confidence bar
    const bx = W - m - 65, by = diagY + 14;
    doc.setFillColor(220,220,220); doc.roundedRect(bx, by, 55, 5, 2, 2, 'F');
    doc.setFillColor(...diagBorder); doc.roundedRect(bx, by, 55 * (result.confidence / 100), 5, 2, 2, 'F');
    doc.setFontSize(8); doc.setTextColor(60,60,60); doc.text(`${result.confidence}%`, bx + 57, by + 4);

    // Images — normalize both to canvas JPEG before passing to jsPDF
    // Microscopy Evidence - Single Image Centered
    const imgY = diagY + 33;
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(10,50,90);
    doc.text('MICROSCOPY EVIDENCE', m, imgY);
    doc.setDrawColor(14,165,233); doc.setLineWidth(0.4); doc.line(m, imgY + 3, W - m, imgY + 3);
    const imgStartY = imgY + 8;

    const [jpegPreview] = await Promise.all([
      toCanvasJpeg(preview)
    ]);

    const imgSz = 85;
    const centerX = (W - imgSz) / 2;
    doc.setFillColor(245,250,255); doc.setDrawColor(200,220,240); doc.setLineWidth(0.3);
    doc.roundedRect(centerX, imgStartY, imgSz, imgSz, 3, 3, 'FD');
    if (jpegPreview) doc.addImage(jpegPreview, 'JPEG', centerX+1, imgStartY+1, imgSz-2, imgSz-8);
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(14,165,233);
    doc.text('ORIGINAL CELL SCAN', W/2, imgStartY + imgSz - 2, { align: 'center' });

    const usedImgSz = 85;
    const noteY = imgStartY + usedImgSz + 8;
    doc.setFillColor(250,252,255); doc.setDrawColor(200,220,240); doc.setLineWidth(0.3);
    doc.roundedRect(m, noteY, W - m * 2, 26, 3, 3, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(10,50,90);
    doc.text('Clinical Notes:', m + 4, noteY + 7);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80,100,120);
    const note = isParasitized
      ? 'AI analysis detected high probability of Plasmodium parasites. Immediate clinical correlation and confirmatory thick/thin smear microscopy recommended. Consider antimalarial treatment protocol per local guidelines.'
      : 'AI analysis indicates no significant evidence of Plasmodium parasites. Blood smear appears morphologically normal. Continue routine monitoring as per clinical judgment.';
    doc.text(doc.splitTextToSize(note, W - m * 2 - 8), m + 4, noteY + 14);

    // Footer
    doc.setFillColor(10,50,90); doc.rect(8, H - 22, W - 16, 14, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100,100,100);
    doc.text(t.medicalDisclaimer, m, H - 22);
    doc.text(`System ID: ML-X842 | Node: ${patientDetails.id || 'LOC-A1'}`, W - m, H - 22, { align: 'right' });

    doc.save(`Malaria_Report_${patientDetails.id || 'N-A'}.pdf`);
  };

  // Analytics Data Processing
  const totalScans = archiveReports.length;
  const parasitizedCount = archiveReports.filter(r => r.prediction === 'Parasitized').length;
  const uninfectedCount = archiveReports.filter(r => r.prediction === 'Uninfected').length;
  
  const timelineData = archiveReports.reduce((acc, report) => {
    const date = new Date(report.timestamp).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = { date, Parasitized: 0, Uninfected: 0 };
    }
    acc[date][report.prediction]++;
    return acc;
  }, {});
  
  const chartData = Object.values(timelineData).sort((a, b) => new Date(a.date) - new Date(b.date));

  const exportToCSV = () => {
    if (archiveReports.length === 0) return;
    
    const headers = ['ID', 'Patient Name', 'Patient ID', 'Age', 'Doctor', 'Hospital', 'Diagnosis', 'Confidence', 'Date'];
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    archiveReports.forEach(report => {
      const row = [
        report.id,
        `"${report.patient_name}"`,
        `"${report.patient_id}"`,
        report.patient_age,
        `"${report.doctor}"`,
        `"${report.hospital}"`,
        report.prediction,
        report.confidence,
        new Date(report.timestamp).toLocaleString()
      ];
      csvRows.push(row.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `malaria_clinic_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (selectedFile) => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
      setShowReportForm(false);
      
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      alert('Please upload an image file.');
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const removeImage = (e) => {
    e.stopPropagation();
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyzeImage = async () => {
    if (!file) return;
    
    setLoading(true);
    setResult(null);
    setError(null);
    setQualityError(null);
    setShowReportForm(false);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://127.0.0.1:8000/predict', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();

      // ── Quality Check Failed ──────────────────────────────
      if (response.status === 422 && data.error === 'quality_check_failed') {
        setQualityError(data);
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Server error occurred');
      }
      
      setResult(data);
      setHistory(prev => [{ ...data, preview: preview, filename: file.name, id: Date.now() }, ...prev]);
      
      // ── Trigger Emergency Response ──────────────────────
      if (data.prediction === 'Parasitized') {
        setTimeout(() => setShowEmergency(true), 1200);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(`Connection Error: ${err.message}. Make sure the backend server and model are running.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="background-decor">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <nav className="top-nav glass-card">
        <div className="logo">
          <i className="ph ph-microscope"></i>
          <span>Malaria<strong>AI</strong></span>
        </div>
        
        <div className="nav-tabs-center">
          <button className={`nav-tab ${activeTab === 'diagnose' ? 'active' : ''}`} onClick={() => setActiveTab('diagnose')}>
            <i className="ph ph-stethoscope"></i> {t.diagnose}
          </button>
          <button className={`nav-tab ${activeTab === 'archive' ? 'active' : ''}`} onClick={() => setActiveTab('archive')}>
            <i className="ph ph-archive"></i> {t.history}
          </button>
          <button className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            <i className="ph ph-chart-bar"></i> {t.analytics}
          </button>
        </div>

        <div className="nav-actions-right">
          <div className="lang-dropdown-wrapper">
            <button 
              className={`icon-btn lang-toggle ${showLangMenu ? 'active' : ''}`} 
              onClick={() => setShowLangMenu(!showLangMenu)}
              title="Change Language"
            >
              <i className="ph ph-translate"></i>
              <span className="lang-code-indicator">{lang.toUpperCase()}</span>
            </button>
            
            {showLangMenu && (
              <div className="lang-dropdown-menu glass-card">
                <div className="lang-menu-header">Select Language</div>
                <div className="lang-options-grid">
                  {[
                    { code: 'en', label: 'English' },
                    { code: 'hi', label: 'हिन्दी' },
                    { code: 'kn', label: 'ಕನ್ನಡ' },
                    { code: 'te', label: 'తెలుగు' },
                    { code: 'ta', label: 'தமிழ்' },
                    { code: 'ml', label: 'മലയാളം' },
                    { code: 'mr', label: 'मराठी' },
                    { code: 'bn', label: 'বাংলা' },
                    { code: 'fr', label: 'Français' },
                    { code: 'es', label: 'Español' },
                    { code: 'ar', label: 'العربية' }
                  ].map((l) => (
                    <button 
                      key={l.code} 
                      className={`lang-option ${lang === l.code ? 'selected' : ''}`}
                      onClick={() => {
                        setLang(l.code);
                        setShowLangMenu(false);
                      }}
                    >
                      <span className="lang-option-code">{l.code.toUpperCase()}</span>
                      <span className="lang-option-label">{l.label}</span>
                      {lang === l.code && <i className="ph ph-check"></i>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="icon-btn theme-toggle" onClick={() => setDarkMode(!darkMode)}>
            <i className={`ph ${darkMode ? 'ph-sun' : 'ph-moon'}`}></i>
          </button>
        </div>
      </nav>

      <div className={`app-viewport ${(activeTab === 'archive' || activeTab === 'analytics') ? 'full-viewport' : ''}`}>
        {showEmergency ? (
          <EmergencyResponse 
            confidence={result?.confidence} 
            onBack={() => setShowEmergency(false)} 
          />
        ) : activeTab === 'diagnose' ? (
          <>
          <main className="clinical-console">
            <aside className="dashboard-sidebar glass-card">
              <div className="dashboard-header">
                <h3><i className="ph ph-chart-pie-slice"></i> {t.sessionStats}</h3>
              </div>
              
              <div className="stats-overview">
                <div 
                  className="stat-circle" 
                  style={{ 
                    background: history.length === 0 
                      ? 'rgba(148, 163, 184, 0.15)' 
                      : `conic-gradient(var(--danger) ${(history.filter(item => item.prediction === 'Parasitized').length / history.length) * 100}%, var(--success) 0)` 
                  }}
                >
                  <div className="stat-circle-inner">
                    <span className="stat-label">Critical</span>
                    <span className="stat-value">{history.length === 0 ? 0 : Math.round((history.filter(item => item.prediction === 'Parasitized').length / history.length) * 100)}%</span>
                  </div>
                </div>
                <div className="stats-legend">
                  <div className="legend-item"><span className="dot danger"></span> Parasitized</div>
                  <div className="legend-item"><span className="dot success"></span> Uninfected</div>
                </div>
              </div>

              <div className="recent-scans-list">
                <h4>{t.recentScans}</h4>
                {history.length === 0 ? (
                  <div className="empty-history">
                    <i className="ph ph-folder-open"></i>
                    <p>No recent activity</p>
                  </div>
                ) : (
                  history.slice().reverse().map((item, idx) => (
                    <div key={idx} className="recent-scan-item">
                      <div className={`scan-indicator ${item.prediction.toLowerCase()}`}></div>
                      <div className="scan-info">
                        <strong>{item.prediction}</strong>
                        <span>{item.confidence}% • {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>

            <section className="upload-section glass-card workstation-card">
              <header className="panel-header">
                <h3><i className="ph ph-microscope"></i> {t.imagePortal}</h3>
              </header>

              <div className="upload-box-wrapper">
                <section className="upload-section">
                  <div 
                    className={`glass-card upload-card ${isDragging ? 'dragover' : ''}`}
                    onClick={() => !file && fileInputRef.current?.click()}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept="image/*" 
                      onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                      hidden 
                    />
                    
                    {!preview ? (
                      <div className="upload-content">
                        <div className="icon-pulse">
                          <i className="ph ph-upload-simple"></i>
                        </div>
                        <h2>{t.uploadCell}</h2>
                        <p>Drag and drop a microscopic image here, or <span className="text-highlight">click to browse</span></p>
                        <span className="file-hint">Supports JPG, PNG (RGB 50x50 optimal)</span>
                      </div>
                    ) : (
                      <div className="preview-content">
                        <div className="image-wrapper">
                          <img src={preview} alt="Cell Preview" />
                          <button className="icon-btn remove-btn" onClick={removeImage} title="Remove image">
                            <i className="ph ph-x"></i>
                          </button>
                        </div>
                        <div className="preview-actions centered-actions">
                          <span className="file-name">{file?.name}</span>
                          <button 
                            className="primary-btn analyze-btn-large" 
                            onClick={analyzeImage} 
                            disabled={loading}
                          >
                            {loading ? (
                              <><i className="ph ph-spinner-gap ph-spin"></i> Processing...</>
                            ) : (
                              <><i className="ph ph-magic-wand"></i> {t.analyzeBtn}</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <section className="results-section glass-card workstation-card">
              <header className="panel-header">
                <h3><i className="ph ph-activity"></i> {t.analysisResult}</h3>
              </header>
              <div className="results-wrapper">
                {!(loading || result || error || qualityError) ? (
                  <div className="empty-results">
                    <i className="ph ph-clipboard-text"></i>
                    <p>Analysis output will appear here after processing.</p>
                  </div>
                ) : (
                  <>
                    <div className="glass-card result-card">
                      <div className="result-header">
                        <h2>{qualityError ? t.qualityCheck : t.analysisResult}</h2>
                        {loading && <div className="loading-spinner"></div>}
                      </div>

                      {error && !loading && (
                        <div className="error-banner glass-card">
                          <i className="ph ph-warning-circle"></i>
                          <div>
                            <h4>System Error</h4>
                            <p>{error}</p>
                          </div>
                        </div>
                      )}

                      {qualityError && !loading && (
                        <div className="quality-error-body">
                          <div className="quality-banner glass-card">
                            <div className="warning-pulse">
                              <i className="ph ph-warning-octagon"></i>
                            </div>
                            <div className="banner-text">
                              <h3>{t.qualityCheck} Failed</h3>
                              <p>Diagnostic validity cannot be guaranteed for this sample. Analysis halted to prevent false readings.</p>
                            </div>
                          </div>

                          <div className="quality-dashboard">
                            {/* Brightness Gauge */}
                            <div className={`quality-gauge-card ${qualityError.metrics.brightness < 35 || qualityError.metrics.brightness > 235 ? 'fail' : 'pass'}`}>
                              <div className="gauge-header">
                                <i className="ph ph-sun"></i>
                                <span>{t.brightness}</span>
                              </div>
                              <div className="gauge-visual">
                                <div className="gauge-track">
                                  <div className="gauge-fill" style={{ width: `${(qualityError.metrics.brightness / 255) * 100}%` }}></div>
                                </div>
                                <div className="gauge-labels">
                                  <span>0</span>
                                  <strong>{Math.round(qualityError.metrics.brightness)}</strong>
                                  <span>255</span>
                                </div>
                              </div>
                              <div className="status-mini-tag">
                                {qualityError.metrics.brightness < 35 || qualityError.metrics.brightness > 235 ? 'OUT OF RANGE' : 'OPTIMAL'}
                              </div>
                            </div>

                            {/* Sharpness Gauge */}
                            <div className={`quality-gauge-card ${qualityError.metrics.sharpness < 40 ? 'fail' : 'pass'}`}>
                              <div className="gauge-header">
                                <i className="ph ph-eye"></i>
                                <span>{t.sharpness}</span>
                              </div>
                              <div className="gauge-visual">
                                <div className="gauge-track">
                                  <div className="gauge-fill" style={{ width: `${Math.min(100, (qualityError.metrics.sharpness / 100) * 100)}%` }}></div>
                                </div>
                                <div className="gauge-labels">
                                  <span>Blurry</span>
                                  <strong>{Math.round(qualityError.metrics.sharpness)}</strong>
                                  <span>Crisp</span>
                                </div>
                              </div>
                              <div className="status-mini-tag">
                                {qualityError.metrics.sharpness < 40 ? 'POOR CLARITY' : 'VERIFIED'}
                              </div>
                            </div>

                            {/* Contrast Gauge */}
                            <div className={`quality-gauge-card ${qualityError.metrics.contrast < 15 ? 'fail' : 'pass'}`}>
                              <div className="gauge-header">
                                <i className="ph ph-circle-half"></i>
                                <span>{t.contrast}</span>
                              </div>
                              <div className="gauge-visual">
                                <div className="gauge-track">
                                  <div className="gauge-fill" style={{ width: `${Math.min(100, (qualityError.metrics.contrast / 60) * 100)}%` }}></div>
                                </div>
                                <div className="gauge-labels">
                                  <span>Flat</span>
                                  <strong>{Math.round(qualityError.metrics.contrast)}</strong>
                                  <span>Dynamic</span>
                                </div>
                              </div>
                              <div className="status-mini-tag">
                                {qualityError.metrics.contrast < 15 ? 'LOW RANGE' : 'VERIFIED'}
                              </div>
                            </div>
                          </div>

                          <div className="quality-issues-list glass-card">
                            <h4><i className="ph ph-warning-circle"></i> Required Adjustments</h4>
                            <div className="issue-grid">
                              {qualityError.issues.map((issue, i) => (
                                <div key={i} className="issue-pill">
                                  <i className="ph ph-caret-right-bold"></i>
                                  <span>{issue}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <button className="primary-btn full-width-btn" onClick={() => { setQualityError(null); setFile(null); setPreview(null); if(fileInputRef.current) fileInputRef.current.value=''; }}>
                            <i className="ph ph-upload-simple"></i> Re-Upload Corrected Image
                          </button>
                        </div>
                      )}

                      {result && !loading && (() => {
                        const isParasitized = result.prediction === 'Parasitized';
                        const statusClass = isParasitized ? 'parasitized' : 'uninfected';
                        const iconClass = isParasitized ? 'ph-virus' : 'ph-shield-check';
                        
                        return (
                          <div className="result-body">
                            <div className="single-analysis-preview">
                              <img src={preview} alt="Original Cell" />
                            </div>
                            
                            <div className={`status-badge ${statusClass}`}>
                              <i className={`ph ${iconClass}`}></i>
                              <span>{isParasitized ? t.parasitized : t.uninfected}</span>
                            </div>

                            <div className="confidence-meter">
                              <div className="meter-header">
                                <span>{t.confidence}</span>
                                <span className="percent">{result.confidence}%</span>
                              </div>
                              <div className="meter-track">
                                <div 
                                  className={`meter-fill ${statusClass}`} 
                                  style={{ width: `${result.confidence}%` }}
                                ></div>
                              </div>
                            </div>

                            <div className="result-actions">
                              {!showReportForm ? (
                                <button className="primary-btn" onClick={() => setShowReportForm(true)}>
                                  <i className="ph ph-file-pdf"></i> {t.generateReport}
                                </button>
                              ) : (
                                <div className="patient-form pro-form glass-card">
                                  <div className="form-header">
                                    <i className="ph ph-identification-card"></i>
                                    <div>
                                      <h4>Patient & Clinical Records</h4>
                                      <p>Enter data to include in the diagnostic report.</p>
                                    </div>
                                  </div>
                                  <div className="form-grid">
                                    <div className="input-group">
                                      <label><i className="ph ph-user"></i> Patient Name</label>
                                      <input type="text" placeholder="e.g. John Doe" value={patientDetails.name} onChange={e => setPatientDetails({...patientDetails, name: e.target.value})} />
                                    </div>
                                    <div className="input-group">
                                      <label><i className="ph ph-calendar"></i> Age</label>
                                      <input type="text" placeholder="e.g. 24" value={patientDetails.age} onChange={e => setPatientDetails({...patientDetails, age: e.target.value})} />
                                    </div>
                                    <div className="input-group">
                                      <label><i className="ph ph-hash"></i> Patient ID</label>
                                      <input type="text" placeholder="e.g. P-10293" value={patientDetails.id} onChange={e => setPatientDetails({...patientDetails, id: e.target.value})} />
                                    </div>
                                    <div className="input-group">
                                      <label><i className="ph ph-user-gear"></i> Referring Physician</label>
                                      <input type="text" placeholder="Dr. Smith" value={patientDetails.doctor} onChange={e => setPatientDetails({...patientDetails, doctor: e.target.value})} />
                                    </div>
                                    <div className="input-group full-width">
                                      <label><i className="ph ph-hospital"></i> Medical Facility</label>
                                      <input type="text" placeholder="City General Hospital" value={patientDetails.hospital} onChange={e => setPatientDetails({...patientDetails, hospital: e.target.value})} />
                                    </div>
                                  </div>
                                  <div className="form-actions">
                                    <button className="secondary-btn" onClick={() => setShowReportForm(false)}>Cancel</button>
                                    <button className="primary-btn" onClick={saveAndDownloadReport}>
                                      <i className="ph ph-file-pdf"></i> Generate & Save Report
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {error && !loading && (
                        <div className="error-body">
                          <div className="info-alert error-alert">
                            <i className="ph ph-warning-circle"></i>
                            <span>{error}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          </main>

          <footer className="console-footer">
            <div className="footer-content">
              <div className="footer-left">
                <p>© {new Date().getFullYear()} MalariaAI Project • Advanced CNN Diagnostic Suite</p>
                <span>Version 1.2.0 • Build #842-Clinical</span>
              </div>
              <div className="footer-right">
                <p><strong>{t.medicalDisclaimer.split(':')[0]}:</strong> {t.medicalDisclaimer.split(':')[1]}</p>
              </div>
            </div>
          </footer>
          </>
        ) : activeTab === 'analytics' ? (
          <main className="analytics-view">
          <div className="archive-header glass-card">
            <div className="archive-title">
              <h2>{t.analyticsTitle}</h2>
              <p>{t.analyticsSubtitle}</p>
            </div>
            <button className="primary-btn export-btn" onClick={exportToCSV}>
              <i className="ph ph-download-simple"></i> {t.exportCSV}
            </button>
          </div>
          
          <div className="analytics-summary">
            <div className="summary-card glass-card">
              <i className="ph ph-files"></i>
              <div className="summary-info">
                <span>{t.totalScans}</span>
                <h3>{totalScans}</h3>
              </div>
            </div>
            <div className="summary-card glass-card parasitized">
              <i className="ph ph-virus"></i>
              <div className="summary-info">
                <span>{t.totalParasitized}</span>
                <h3>{parasitizedCount}</h3>
              </div>
            </div>
            <div className="summary-card glass-card uninfected">
              <i className="ph ph-shield-check"></i>
              <div className="summary-info">
                <span>{t.totalClear}</span>
                <h3>{uninfectedCount}</h3>
              </div>
            </div>
          </div>
          
          <div className="chart-container glass-card">
            <h3>{t.trendAnalysis}</h3>
            <div className="chart-wrapper" style={{ width: '100%', height: '400px', minHeight: '400px' }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} dy={10} />
                  <YAxis axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="Parasitized" stackId="a" fill="#dc4b4b" radius={[0, 0, 6, 6]} barSize={40} />
                  <Bar dataKey="Uninfected" stackId="a" fill="#11a36a" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </main>
      ) : (
        <main className="archive-container">
          <div className="archive-header glass-card">
            <div className="archive-title">
              <h2>{t.archiveTitle}</h2>
              <p>{t.archiveSubtitle}</p>
            </div>
            <div className="search-box">
              <button 
                className={`icon-btn toggle-group-btn ${groupByHospital ? 'active' : ''}`}
                onClick={() => { setGroupByHospital(!groupByHospital); setSelectedHospital(null); }}
                title="Toggle Group by Hospital"
              >
                <i className="ph ph-buildings"></i>
              </button>
              <i className="ph ph-magnifying-glass"></i>
              <input 
                type="text" 
                placeholder={t.searchPlaceholder} 
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchArchive()}
              />
              <button className="primary-btn" onClick={fetchArchive}>{t.searchBtn}</button>
            </div>
          </div>

          <div className={`archive-grid ${groupByHospital ? 'grouped-mode' : ''}`}>
            {selectedPatient ? (
              <div className="patient-dashboard-view">
                <div className="dashboard-controls">
                  <button className="secondary-btn" onClick={() => setSelectedPatient(null)}>
                    <i className="ph ph-arrow-left"></i> {t.backToArchive}
                  </button>
                  <div className="patient-meta-header">
                    <h2>Patient: {patientHistory[0]?.patient_name}</h2>
                    <span>ID: {selectedPatient} • Age: {patientHistory[0]?.patient_age}</span>
                  </div>
                </div>

                <div className="patient-analysis-grid">
                  {patientHistory.length > 0 && (
                    <div className="history-chart-card glass-card">
                      <h3>{t.trendAnalysis}</h3>
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                          <LineChart 
                            data={patientHistory.map(h => ({
                              ...h,
                              displayScore: h.prediction === 'Parasitized' ? h.confidence : (100 - h.confidence)
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis 
                              dataKey="timestamp" 
                              tickFormatter={(t) => new Date(t).toLocaleDateString()} 
                              axisLine={false} 
                              tickLine={false}
                            />
                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                            <Tooltip 
                              labelFormatter={(t) => new Date(t).toLocaleString()} 
                              contentStyle={{borderRadius: '12px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff'}}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="displayScore" 
                              name="Infection Intensity"
                              stroke="var(--danger)" 
                              strokeWidth={4} 
                              dot={{ fill: 'var(--danger)', r: 6, strokeWidth: 2, stroke: '#fff' }} 
                              activeDot={{ r: 8, strokeWidth: 0 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="chart-hint">Graph represents Infection Intensity: High peaks indicate critical parasitization, low valleys indicate clear scans.</p>
                    </div>
                  )}

                  <div className="timeline-container">
                    <h3>{t.medicalTimeline}</h3>
                    <div className="vertical-timeline">
                      {patientHistory.slice().reverse().map((report, idx) => (
                        <div key={report.id} className="timeline-item">
                          <div className="timeline-marker">
                            <div className={`marker-dot ${report.prediction.toLowerCase()}`}></div>
                            {idx !== patientHistory.length - 1 && <div className="marker-line"></div>}
                          </div>
                          <div className="timeline-content glass-card">
                            <div className="timeline-date">{new Date(report.timestamp).toLocaleString()}</div>
                            <div className="timeline-prediction">
                              <span className={`status-badge small ${report.prediction.toLowerCase()}`}>{report.prediction}</span>
                              <strong>{report.confidence}% Confidence</strong>
                            </div>
                            <div className="timeline-images single">
                              <img src={report.original_image_b64} alt="Original Scan" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
              {loadingArchive ? (
                <div className="loading-spinner archive-spinner"></div>
              ) : archiveReports.length === 0 ? (
                <div className="empty-archive glass-card">
                  <i className="ph ph-folder-open"></i>
                  <p>No records found in the database.</p>
                </div>
              ) : (
                groupByHospital ? (
                  selectedHospital ? (
                    <div className="patient-dashboard-view">
                      <div className="dashboard-controls">
                        <button className="secondary-btn" onClick={() => setSelectedHospital(null)}>
                          <i className="ph ph-arrow-left"></i> Back to Hospitals
                        </button>
                        <div className="patient-meta-header">
                          <h2><i className="ph ph-hospital"></i> {selectedHospital}</h2>
                          <span>Showing all records for this facility</span>
                        </div>
                      </div>
                      <div className="archive-grid">
                        {archiveReports.filter(r => (r.hospital || 'Unknown Facility') === selectedHospital).map(report => (
                          <div key={report.id} className="archive-card glass-card">
                            <div className="archive-card-header">
                              <h3>{report.patient_name}</h3>
                              <span className={`status-badge small ${report.prediction.toLowerCase()}`}>
                                {report.prediction}
                              </span>
                            </div>
                            <div className="archive-card-body">
                              <p><strong>ID:</strong> {report.patient_id}</p>
                              <p><strong>Doctor:</strong> {report.doctor}</p>
                              <p><strong>Confidence:</strong> {report.confidence}%</p>
                              <p><strong>Date:</strong> {new Date(report.timestamp).toLocaleDateString()}</p>
                            </div>
                            <div className="archive-images single">
                              <img src={report.original_image_b64} alt="Original Scan" />
                            </div>
                            <button className="secondary-btn history-btn" onClick={() => viewPatientHistory(report.patient_id)}>
                              <i className="ph ph-clock-counter-clockwise"></i> {t.history}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="hospital-directory-grid">
                      {Object.entries(
                        archiveReports.reduce((acc, report) => {
                          const hosp = report.hospital || 'Unknown Facility';
                          if (!acc[hosp]) acc[hosp] = { count: 0, latest: null };
                          acc[hosp].count += 1;
                          if (!acc[hosp].latest || new Date(report.timestamp) > new Date(acc[hosp].latest)) {
                            acc[hosp].latest = report.timestamp;
                          }
                          return acc;
                        }, {})
                      ).map(([hospitalName, data]) => (
                        <div key={hospitalName} className="hospital-directory-card glass-card" onClick={() => setSelectedHospital(hospitalName)}>
                          <div className="hospital-icon-wrapper">
                            <i className="ph ph-buildings"></i>
                          </div>
                          <div className="hospital-card-info">
                            <h3>{hospitalName}</h3>
                            <p>{data.count} Patient Records</p>
                            <span className="last-active">Last active: {new Date(data.latest).toLocaleDateString()}</span>
                          </div>
                          <div className="hospital-card-action">
                            <i className="ph ph-caret-right"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  archiveReports.map(report => (
                    <div key={report.id} className="archive-card glass-card">
                      <div className="archive-card-header">
                        <h3>{report.patient_name}</h3>
                        <span className={`status-badge small ${report.prediction.toLowerCase()}`}>
                          {report.prediction}
                        </span>
                      </div>
                      <div className="archive-card-body">
                        <p><strong>ID:</strong> {report.patient_id}</p>
                        <p><strong>Doctor:</strong> {report.doctor}</p>
                        <p><strong>Confidence:</strong> {report.confidence}%</p>
                        <p><strong>Date:</strong> {new Date(report.timestamp).toLocaleDateString()}</p>
                      </div>
                      <div className="archive-images single">
                        <img src={report.original_image_b64} alt="Original Scan" />
                      </div>
                      <button className="secondary-btn history-btn" onClick={() => viewPatientHistory(report.patient_id)}>
                        <i className="ph ph-clock-counter-clockwise"></i> {t.history}
                      </button>
                    </div>
                  ))
                )
              )}
              </>
            )}
          </div>
        </main>
      )}
        <Chatbot lang={lang} />
      </div>
    </>
  );
}

export default App;
