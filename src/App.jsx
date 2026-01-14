import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, Clock, Upload, LogOut, User, Download, AlertCircle, Calendar, Filter } from 'lucide-react';

const SUPABASE_URL = 'https://lgdrcttylguqrhvvedvx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZHJjdHR5bGd1cXJodnZlZHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NzM3OTgsImV4cCI6MjA4MzM0OTc5OH0.xwmLr5wbIf4aLwP8UOmVxfc56NUIk6qAU6rMEIbdnYg';

const App = () => {
  const [user, setUser] = useState(null);
  const [berichte, setBerichte] = useState([]);
  const [filteredBerichte, setFilteredBerichte] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [selectedAzubi, setSelectedAzubi] = useState(null);
  const [azubis, setAzubis] = useState([]);
  const [kommentar, setKommentar] = useState('');
  const [berichtDatum, setBerichtDatum] = useState(new Date().toISOString().split('T')[0]);
  const [zeitraumFilter, setZeitraumFilter] = useState('alle');

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
      setFilteredBerichte(data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Berichte:', error);
    }
  };

  const filterBerichteByZeitraum = (zeitraum) => {
    setZeitraumFilter(zeitraum);
    
    if (zeitraum === 'alle') {
      setFilteredBerichte(berichte);
      return;
    }

    const heute = new Date();
    let startDatum = new Date();

    switch(zeitraum) {
      case 'heute':
        startDatum = new Date(heute.setHours(0, 0, 0, 0));
        break;
      case 'diese-woche':
        startDatum = new Date(heute);
        startDatum.setDate(heute.getDate() - heute.getDay() + 1);
        break;
      case 'dieser-monat':
        startDatum = new Date(heute.getFullYear(), heute.getMonth(), 1);
        break;
      case 'letzter-monat':
        startDatum = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
        const endDatum = new Date(heute.getFullYear(), heute.getMonth(), 0);
        const filtered = berichte.filter(b => {
          const berichtDatum = new Date(b.datum);
          return berichtDatum >= startDatum && berichtDatum <= endDatum;
        });
        setFilteredBerichte(filtered);
        return;
      case 'dieses-jahr':
        startDatum = new Date(heute.getFullYear(), 0, 1);
        break;
      default:
        setFilteredBerichte(berichte);
        return;
    }

    const filtered = berichte.filter(b => {
      const berichtDatum = new Date(b.datum);
      return berichtDatum >= startDatum;
    });
    
    setFilteredBerichte(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const berichtText = document.getElementById('bericht-text').value;
    
    if (!berichtText.trim()) {
      alert('Bitte gib einen Berichtstext ein');
      return;
    }

    try {
      const neuerBericht = {
        azubi_id: user.id,
        azubi_name: user.name,
        datum: berichtDatum,
        details: berichtText,
        status: 'pending',
        kommentar: null,
        ueberarbeitet: false
      };

      await supabaseRequest('berichte', {
        method: 'POST',
        body: JSON.stringify(neuerBericht),
      });

      document.getElementById('bericht-text').value = '';
      setBerichtDatum(new Date().toISOString().split('T')[0]);
      loadBerichte(user);
      alert('Bericht erfolgreich eingereicht!');
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

  const generatePdf = (bericht) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 595;
      canvas.height = 842;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'black';
      
      ctx.font = 'bold 20px Arial';
      ctx.fillText('AUSBILDUNGSNACHWEIS', 50, 60);
      
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, 75);
      ctx.lineTo(545, 75);
      ctx.stroke();
      
      ctx.font = '14px Arial';
      ctx.fillText(`Azubi: ${bericht.azubi_name}`, 50, 110);
      ctx.fillText(`Datum: ${new Date(bericht.datum).toLocaleDateString('de-DE')}`, 50, 135);
      ctx.fillText('Status: Freigegeben', 50, 160);
      
      ctx.font = 'bold 14px Arial';
      ctx.fillText('BERICHT:', 50, 200);
      
      ctx.font = '12px Arial';
      const maxWidth = 495;
      const lineHeight = 18;
      let y = 230;
      
      const words = bericht.details.split(' ');
      let line = '';
      
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && i > 0) {
          ctx.fillText(line, 50, y);
          line = words[i] + ' ';
          y += lineHeight;
          
          if (y > 750) {
            break;
          }
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 50, y);
      
      ctx.font = '10px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, 50, 800);
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bericht_${bericht.azubi_name}_${bericht.datum}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
      
      alert('Bericht wird heruntergeladen...');
    } catch (error) {
      console.error('Fehler beim Generieren:', error);
      alert('Fehler beim Erstellen des Berichts');
    }
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

  // LOGIN SCREEN
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

  // AZUBI DASHBOARD
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
            {/* BERICHT EINREICHEN */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Upload className="w-6 h-6 mr-2 text-blue-600" />
                Neuen Bericht einreichen
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Datum des Berichts
                  </label>
                  <input
                    type="date"
                    value={berichtDatum}
                    onChange={(e) => setBerichtDatum(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Berichtstext
                  </label>
                  <textarea
                    id="bericht-text"
                    rows="8"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Was hast du an diesem Tag gelernt? Beschreibe deine Tätigkeiten..."
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

            {/* MEINE BERICHTE */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-blue-600" />
                Meine Berichte
              </h2>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
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
                      
                      {/* ULTRA TEXT WRAPPING - AZUBI */}
                      <div className="w-full max-w-full overflow-hidden">
                        <p 
                          className="text-sm text-gray-600 mt-2 break-all whitespace-pre-wrap"
                          style={{
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            maxWidth: '100%'
                          }}
                        >
                          {bericht.details}
                        </p>
                      </div>
                      
                      {bericht.status === 'rejected' && bericht.kommentar && (
                        <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                          <p className="text-xs font-medium text-red-800 mb-1">Kommentar vom Ausbilder:</p>
                          <div className="w-full max-w-full overflow-hidden">
                            <p 
                              className="text-xs text-red-700 break-all whitespace-pre-wrap"
                              style={{
                                wordBreak: 'break-all',
                                overflowWrap: 'anywhere',
                                maxWidth: '100%'
                              }}
                            >
                              {bericht.kommentar}
                            </p>
                          </div>
                          <button
                            onClick={() => handleResubmit(bericht.id)}
                            className="mt-2 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Überarbeiten und erneut einreichen
                          </button>
                        </div>
                      )}
                      
                      {bericht.status === 'approved' && (
                        <div className="mt-3">
                          <button
                            onClick={() => generatePdf(bericht)}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Bericht herunterladen
                          </button>
                        </div>
                      )}
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

  // AUSBILDER DASHBOARD
  if (user.role === 'ausbilder') {
    // AZUBI-KARTEN ANSICHT
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
              
              {/* AZUBI KARTEN */}
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
                      <User className="w-10 h-10 text-blue-600 mr-3 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{azubi.name}</p>
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

    // BERICHTE ANSICHT FÜR GEWÄHLTEN AZUBI
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center min-w-0">
              <button
                onClick={() => {
                  setSelectedAzubi(null);
                  setBerichte([]);
                  setFilteredBerichte([]);
                  setZeitraumFilter('alle');
                }}
                className="mr-4 text-blue-600 hover:text-blue-800 flex-shrink-0"
              >
                ← Zurück
              </button>
              <FileText className="w-8 h-8 text-blue-600 mr-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-gray-800 truncate">
                  Berichte von {selectedAzubi.name}
                </h1>
                <p className="text-sm text-gray-600 truncate">{user.name}</p>
              </div>
            </div>
            <button
              onClick={() => setUser(null)}
              className="flex items-center text-gray-600 hover:text-gray-800 flex-shrink-0 ml-4"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Abmelden
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* ZEITRAUM FILTER */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center mb-3">
              <Filter className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
              <h3 className="font-medium text-gray-800">Zeitraum filtern:</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['alle', 'heute', 'diese-woche', 'dieser-monat', 'letzter-monat', 'dieses-jahr'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => filterBerichteByZeitraum(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    zeitraumFilter === filter 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter === 'alle' && 'Alle'}
                  {filter === 'heute' && 'Heute'}
                  {filter === 'diese-woche' && 'Diese Woche'}
                  {filter === 'dieser-monat' && 'Dieser Monat'}
                  {filter === 'letzter-monat' && 'Letzter Monat'}
                  {filter === 'dieses-jahr' && 'Dieses Jahr'}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-3">
              Zeige {filteredBerichte.length} von {berichte.length} Berichten
            </p>
          </div>

          {/* BERICHTE LISTE */}
          <div className="space-y-4">
            {filteredBerichte.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500">
                  {berichte.length === 0 
                    ? 'Dieser Azubi hat noch keine Berichte eingereicht' 
                    : 'Keine Berichte im ausgewählten Zeitraum'}
                </p>
              </div>
            ) : (
              filteredBerichte.map((bericht) => (
                <div key={bericht.id} className="bg-white rounded-lg shadow-md p-6">
                  {/* ÜBERARBEITET HINWEIS */}
                  {bericht.ueberarbeitet && bericht.status === 'pending' && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
                      <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-blue-800">Überarbeiteter Bericht</p>
                        <p className="text-xs text-blue-600 mt-1">Dieser Bericht wurde vom Azubi überarbeitet und erneut eingereicht</p>
                      </div>
                    </div>
                  )}
                  
                  {/* HEADER */}
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        Bericht vom {new Date(bericht.datum).toLocaleDateString('de-DE')}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">von {bericht.azubi_name}</p>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${getStatusColor(bericht.status)}`}>
                      {getStatusIcon(bericht.status)}
                      <span className="ml-1">{getStatusText(bericht.status)}</span>
                    </span>
                  </div>

                  {/* BERICHT TEXT - ULTRA TEXT WRAPPING */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg w-full max-w-full overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 mb-1">Bericht:</p>
                    <div className="w-full max-w-full overflow-hidden">
                      <p 
                        className="text-sm text-gray-600 break-all whitespace-pre-wrap"
                        style={{
                          wordBreak: 'break-all',
                          overflowWrap: 'anywhere',
                          maxWidth: '100%'
                        }}
                      >
                        {bericht.details}
                      </p>
                    </div>
                  </div>

                  {/* KOMMENTAR ANZEIGEN */}
                  {bericht.status === 'rejected' && bericht.kommentar && (
                    <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
                      <p className="text-sm font-medium text-red-800 mb-1">Dein Kommentar:</p>
                      <div className="w-full max-w-full overflow-hidden">
                        <p 
                          className="text-sm text-red-700 break-all whitespace-pre-wrap"
                          style={{
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            maxWidth: '100%'
                          }}
                        >
                          {bericht.kommentar}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AKTIONEN */}
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
