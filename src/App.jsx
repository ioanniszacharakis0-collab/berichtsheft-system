import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, Clock, Upload, LogOut, User, Download, AlertCircle } from 'lucide-react';

const SUPABASE_URL = 'https://lgdrcttylguqrhvvedvx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZHJjdHR5bGd1cXJodnZlZHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NzM3OTgsImV4cCI6MjA4MzM0OTc5OH0.xwmLr5wbIf4aLwP8UOmVxfc56NUIk6qAU6rMEIbdnYg';

const App = () => {
  const [user, setUser] = useState(null);
  const [berichte, setBerichte] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedAzubi, setSelectedAzubi] = useState(null);
  const [azubis, setAzubis] = useState([]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [kommentar, setKommentar] = useState('');

  const supabaseRequest = async (endpoint, options = {}) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      ...options,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const users = await supabaseRequest(
        `users?username=eq.${username}&password=eq.${password}&select=*`
      );
      
      if (users && users.length > 0) {
        setUser(users[0]);
        loadBerichte(users[0]);
        if (users[0].role === 'ausbilder') {
          loadAzubis();
        }
      } else {
        setLoginError('Ungültige Anmeldedaten');
      }
    } catch (error) {
      setLoginError('Fehler beim Anmelden');
      console.error('Login error:', error);
    }
  };

  const loadAzubis = async () => {
    try {
      const azubiUsers = await supabaseRequest('users?role=eq.azubi&select=*');
      setAzubis(azubiUsers || []);
    } catch (error) {
      console.error('Fehler beim Laden der Azubis:', error);
    }
  };

  const loadBerichte = async (currentUser) => {
    try {
      let query = 'berichte?select=*&order=datum.desc';
      
      if (currentUser.role === 'azubi') {
        query = `berichte?azubi_id=eq.${currentUser.id}&select=*&order=datum.desc`;
      } else if (selectedAzubi) {
        query = `berichte?azubi_id=eq.${selectedAzubi.id}&select=*&order=datum.desc`;
      }
      
      const data = await supabaseRequest(query);
      setBerichte(data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Berichte:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      alert('Bitte wähle eine PDF-Datei aus');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        
        const berichtText = document.getElementById('bericht-text').value;
        
        const neuerBericht = {
          azubi_id: user.id,
          azubi_name: user.name,
          datum: new Date().toISOString().split('T')[0],
          details: berichtText,
          pdf_data: base64,
          status: 'pending',
          kommentar: null,
          ueberarbeitet: false
        };

        await supabaseRequest('berichte', {
          method: 'POST',
          body: JSON.stringify(neuerBericht),
        });

        setSelectedFile(null);
        document.getElementById('bericht-text').value = '';
        document.getElementById('file-input').value = '';
        loadBerichte(user);
        alert('Bericht erfolgreich eingereicht!');
      };
      
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Fehler beim Einreichen:', error);
      alert('Fehler beim Einreichen des Berichts');
    }
  };

  const handleApprove = async (berichtId) => {
    try {
      await supabaseRequest(`berichte?id=eq.${berichtId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status: 'approved',
          ueberarbeitet: false
        }),
      });
      loadBerichte(user);
    } catch (error) {
      console.error('Fehler beim Freigeben:', error);
    }
  };

  const handleReject = async (berichtId) => {
    if (!kommentar.trim()) {
      alert('Bitte gib einen Kommentar ein');
      return;
    }

    try {
      await supabaseRequest(`berichte?id=eq.${berichtId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status: 'rejected',
          kommentar: kommentar,
          ueberarbeitet: false
        }),
      });
      setKommentar('');
      loadBerichte(user);
    } catch (error) {
      console.error('Fehler beim Ablehnen:', error);
    }
  };

  const handleResubmit = async (berichtId) => {
    try {
      await supabaseRequest(`berichte?id=eq.${berichtId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status: 'pending',
          ueberarbeitet: true
        }),
      });
      loadBerichte(user);
      alert('Bericht wurde zur erneuten Prüfung eingereicht!');
    } catch (error) {
      console.error('Fehler beim erneuten Einreichen:', error);
    }
  };

  const handleViewPdf = (pdfData) => {
    const blob = base64ToBlob(pdfData, 'application/pdf');
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
    setShowPdfPreview(true);
  };

  const handleDownloadPdf = (pdfData, berichtId) => {
    const blob = base64ToBlob(pdfData, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bericht_${berichtId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const base64ToBlob = (base64, type) => {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArrays.push(byteCharacters.charCodeAt(i));
    }
    return new Blob([new Uint8Array(byteArrays)], { type });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'approved': return 'Freigegeben';
      case 'rejected': return 'Abgelehnt';
      default: return 'Ausstehend';
    }
  };

  if (showPdfPreview) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-bold">PDF Vorschau</h2>
            <button
              onClick={() => {
                setShowPdfPreview(false);
                URL.revokeObjectURL(pdfUrl);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="PDF Preview"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <FileText className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-800">Berichtsheft</h1>
          </div>
          
          {loginError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {loginError}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Benutzername
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Anmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (user.role === 'azubi') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-800">Berichtsheft</h1>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
            </div>
            <button
              onClick={() => setUser(null)}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Abmelden
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Upload className="w-6 h-6 mr-2 text-blue-600" />
                Neuen Bericht einreichen
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Berichtstext
                  </label>
                  <textarea
                    id="bericht-text"
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Was hast du diese Woche gelernt?"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDF hochladen
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Bericht einreichen
                </button>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-blue-600" />
                Meine Berichte
              </h2>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {berichte.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Noch keine Berichte eingereicht</p>
                ) : (
                  berichte.map((bericht) => (
                    <div key={bericht.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-sm font-medium text-gray-900">
                            Bericht vom {new Date(bericht.datum).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(bericht.status)}`}>
                          {getStatusIcon(bericht.status)}
                          <span className="ml-1">{getStatusText(bericht.status)}</span>
                        </span>
                      </div>
                      
                      <div className="max-w-full overflow-hidden">
                        <div className="max-w-full overflow-hidden">
                          <p 
                            className="text-sm text-gray-600 mt-2 break-all whitespace-pre-wrap"
                            style={{
                              wordBreak: 'break-all',
                              overflowWrap: 'anywhere',
                              maxWidth: '100%',
                              width: '100%'
                            }}
                          >
                            {bericht.details}
                          </p>
                        </div>
                      </div>
                      
                      {bericht.status === 'rejected' && bericht.kommentar && (
                        <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                          <p className="text-xs font-medium text-red-800 mb-1">Kommentar vom Ausbilder:</p>
                          <div className="max-w-full overflow-hidden">
                            <div className="max-w-full overflow-hidden">
                              <p 
                                className="text-xs text-red-700 break-all whitespace-pre-wrap"
                                style={{
                                  wordBreak: 'break-all',
                                  overflowWrap: 'anywhere',
                                  maxWidth: '100%',
                                  width: '100%'
                                }}
                              >
                                {bericht.kommentar}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleResubmit(bericht.id)}
                            className="mt-2 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Überarbeiten und erneut einreichen
                          </button>
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleViewPdf(bericht.pdf_data)}
                          className="flex-1 bg-gray-100 text-gray-700 py-2 px-3 rounded hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          PDF ansehen
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(bericht.pdf_data, bericht.id)}
                          className="bg-gray-100 text-gray-700 py-2 px-3 rounded hover:bg-gray-200 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user.role === 'ausbilder') {
    if (!selectedAzubi) {
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-xl font-bold text-gray-800">Ausbilder Dashboard</h1>
                  <p className="text-sm text-gray-600">{user.name}</p>
                </div>
              </div>
              <button
                onClick={() => setUser(null)}
                className="flex items-center text-gray-600 hover:text-gray-800"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Abmelden
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <User className="w-6 h-6 mr-2 text-blue-600" />
                Azubis
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                {azubis.map((azubi) => (
                  <button
                    key={azubi.id}
                    onClick={() => {
                      setSelectedAzubi(azubi);
                      loadBerichte({ ...user, role: 'ausbilder' });
                    }}
                    className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                  >
                    <div className="flex items-center">
                      <User className="w-10 h-10 text-blue-600 mr-3" />
                      <div>
                        <p className="font-medium text-gray-900">{azubi.name}</p>
                        <p className="text-sm text-gray-500">Berichte ansehen →</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <button
                onClick={() => {
                  setSelectedAzubi(null);
                  setBerichte([]);
                }}
                className="mr-4 text-blue-600 hover:text-blue-800"
              >
                ← Zurück
              </button>
              <FileText className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-800">Berichte von {selectedAzubi.name}</h1>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
            </div>
            <button
              onClick={() => setUser(null)}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Abmelden
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-4">
            {berichte.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500">Dieser Azubi hat noch keine Berichte eingereicht</p>
              </div>
            ) : (
              berichte.map((bericht) => (
                <div key={bericht.id} className="bg-white rounded-lg shadow-md p-6">
                  {bericht.ueberarbeitet && bericht.status === 'pending' && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
                      <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Überarbeiteter Bericht</p>
                        <p className="text-xs text-blue-600 mt-1">Dieser Bericht wurde vom Azubi überarbeitet und erneut eingereicht</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Bericht vom {new Date(bericht.datum).toLocaleDateString('de-DE')}
                      </h3>
                      <p className="text-sm text-gray-600">von {bericht.azubi_name}</p>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(bericht.status)}`}>
                      {getStatusIcon(bericht.status)}
                      <span className="ml-1">{getStatusText(bericht.status)}</span>
                    </span>
                  </div>

                  <div className="mb-4 p-4 bg-gray-50 rounded-lg max-w-full overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 mb-1">Bericht:</p>
                    <div className="max-w-full overflow-hidden">
                      <div className="max-w-full overflow-hidden">
                        <p 
                          className="text-sm text-gray-600 break-all whitespace-pre-wrap"
                          style={{
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            maxWidth: '100%',
                            width: '100%'
                          }}
                        >
                          {bericht.details}
                        </p>
                      </div>
                    </div>
                  </div>

                  {bericht.status === 'rejected' && bericht.kommentar && (
                    <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
                      <p className="text-sm font-medium text-red-800 mb-1">Dein Kommentar:</p>
                      <div className="max-w-full overflow-hidden">
                        <div className="max-w-full overflow-hidden">
                          <p 
                            className="text-sm text-red-700 break-all whitespace-pre-wrap"
                            style={{
                              wordBreak: 'break-all',
                              overflowWrap: 'anywhere',
                              maxWidth: '100%',
                              width: '100%'
                            }}
                          >
                            {bericht.kommentar}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => handleViewPdf(bericht.pdf_data)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded hover:bg-gray-200 transition-colors font-medium"
                    >
                      PDF ansehen
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(bericht.pdf_data, bericht.id)}
                      className="bg-gray-100 text-gray-700 py-2 px-4 rounded hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>

                  {bericht.status === 'pending' && (
                    <div className="space-y-3 pt-4 border-t">
                      <textarea
                        value={kommentar}
                        onChange={(e) => setKommentar(e.target.value)}
                        placeholder="Kommentar für Ablehnung (optional)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows="3"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(bericht.id)}
                          className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors font-medium flex items-center justify-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Freigeben
                        </button>
                        <button
                          onClick={() => handleReject(bericht.id)}
                          className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors font-medium flex items-center justify-center"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Ablehnen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default App;
