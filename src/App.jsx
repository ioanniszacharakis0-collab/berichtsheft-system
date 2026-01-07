import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, Clock, Upload, LogOut, User, Download, AlertCircle } from 'lucide-react';

// ⚠️ WICHTIG: Ersetze diese Werte mit deinen Supabase Credentials!
const SUPABASE_URL = 'https://lgdrcttylguqrhvvedvx.supabase.co';  // z.B. https://xyz.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZHJjdHR5bGd1cXJodnZlZHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NzM3OTgsImV4cCI6MjA4MzM0OTc5OH0.xwmLr5wbIf4aLwP8UOmVxfc56NUIk6qAU6rMEIbdnYg';  // Dein anon/public key

const BerichtsheftSystem = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [berichte, setBerichte] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [neuerBericht, setNeuerBericht] = useState({
    datumVon: '',
    datumBis: '',
    taetigkeit: '',
    stunden: '',
    details: ''
  });
  const [bearbeitenModus, setBearbeitenModus] = useState(null); // Für Bearbeitung abgelehnter Berichte

  useEffect(() => {
    if (currentUser) {
      loadBerichte();
    }
  }, [currentUser]);

  // Supabase API Call Helper
  const supabaseCall = async (endpoint, options = {}) => {
    if (SUPABASE_URL === 'DEINE_SUPABASE_URL_HIER') {
      setError('⚠️ Bitte trage deine Supabase URL und Key im Code ein!');
      return null;
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      ...options,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${errorText}`);
    }

    return response.json();
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const users = await supabaseCall(
        `users?username=eq.${loginData.username}&password=eq.${loginData.password}&select=*`
      );

      if (users && users.length > 0) {
        setCurrentUser(users[0]);
      } else {
        setError('Falscher Benutzername oder Passwort!');
      }
    } catch (err) {
      setError('Login fehlgeschlagen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setBerichte([]);
    setLoginData({ username: '', password: '' });
    setError('');
  };

  const loadBerichte = async () => {
    setLoading(true);
    try {
      let query = 'berichte?select=*&order=created_at.desc';
      
      if (currentUser.role === 'azubi') {
        query += `&user_id=eq.${currentUser.id}`;
      }

      const data = await supabaseCall(query);
      setBerichte(data || []);
    } catch (err) {
      setError('Fehler beim Laden der Berichte: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const berichtEinreichen = async () => {
    if (!neuerBericht.datumVon || !neuerBericht.datumBis || !neuerBericht.taetigkeit || !neuerBericht.stunden) {
      alert('Bitte fülle alle Pflichtfelder aus!');
      return;
    }

    if (new Date(neuerBericht.datumVon) > new Date(neuerBericht.datumBis)) {
      alert('Das "Von"-Datum muss vor dem "Bis"-Datum liegen!');
      return;
    }

    setLoading(true);
    try {
      if (bearbeitenModus) {
        // Abgelehnten Bericht aktualisieren
        await supabaseCall(`berichte?id=eq.${bearbeitenModus}`, {
          method: 'PATCH',
          body: JSON.stringify({
            datum_von: neuerBericht.datumVon,
            datum_bis: neuerBericht.datumBis,
            taetigkeit: neuerBericht.taetigkeit,
            stunden: parseFloat(neuerBericht.stunden),
            details: neuerBericht.details,
            status: 'ausstehend',
            kommentar: '',
            bearbeitet_am: null
          })
        });
        alert('Bericht erfolgreich überarbeitet und neu eingereicht!');
        setBearbeitenModus(null);
      } else {
        // Neuen Bericht erstellen
        await supabaseCall('berichte', {
          method: 'POST',
          body: JSON.stringify({
            user_id: currentUser.id,
            azubi_name: currentUser.name,
            datum_von: neuerBericht.datumVon,
            datum_bis: neuerBericht.datumBis,
            taetigkeit: neuerBericht.taetigkeit,
            stunden: parseFloat(neuerBericht.stunden),
            details: neuerBericht.details,
            status: 'ausstehend'
          })
        });
        alert('Bericht erfolgreich eingereicht!');
      }

      await loadBerichte();
      setNeuerBericht({ datumVon: '', datumBis: '', taetigkeit: '', stunden: '', details: '' });
    } catch (err) {
      setError('Fehler beim Einreichen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const berichtBearbeiten = (bericht) => {
    setBearbeitenModus(bericht.id);
    setNeuerBericht({
      datumVon: bericht.datum_von,
      datumBis: bericht.datum_bis,
      taetigkeit: bericht.taetigkeit,
      stunden: bericht.stunden.toString(),
      details: bericht.details || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bearbeitungAbbrechen = () => {
    setBearbeitenModus(null);
    setNeuerBericht({ datumVon: '', datumBis: '', taetigkeit: '', stunden: '', details: '' });
  };

  const berichtBearbeitenAusbilder = async (berichtId, status, kommentar = '') => {
    setLoading(true);
    try {
      await supabaseCall(`berichte?id=eq.${berichtId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          kommentar,
          bearbeitet_am: new Date().toISOString()
        })
      });

      await loadBerichte();
    } catch (err) {
      setError('Fehler beim Bearbeiten: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'freigegeben':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'abgelehnt':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <Clock className="text-yellow-500" size={20} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'freigegeben':
        return 'Freigegeben';
      case 'abgelehnt':
        return 'Abgelehnt';
      default:
        return 'Ausstehend';
    }
  };

  const downloadPDF = () => {
    const azubiBerichte = berichte.filter(b => b.user_id === currentUser.id);
    
    if (azubiBerichte.length === 0) {
      alert('Keine Berichte zum Herunterladen vorhanden!');
      return;
    }

    // Erstelle ein neues Fenster mit druckbarer Seite
    const printWindow = window.open('', '_blank');
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Berichtsheft ${currentUser.name}</title>
        <style>
          @media print {
            @page { margin: 2cm; }
            body { margin: 0; }
          }
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #4F46E5;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #4F46E5;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #666;
            margin: 5px 0;
          }
          .bericht {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .bericht-header {
            background: #F3F4F6;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
          }
          .bericht-title {
            font-size: 18px;
            font-weight: bold;
            color: #1F2937;
            margin-bottom: 5px;
          }
          .bericht-meta {
            color: #6B7280;
            font-size: 14px;
          }
          .status {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
          }
          .status-freigegeben { background: #D1FAE5; color: #065F46; }
          .status-abgelehnt { background: #FEE2E2; color: #991B1B; }
          .status-ausstehend { background: #FEF3C7; color: #92400E; }
          .details {
            background: #F9FAFB;
            padding: 15px;
            border-radius: 5px;
            margin-top: 10px;
          }
          .details-title {
            font-weight: bold;
            margin-bottom: 8px;
          }
          .kommentar {
            background: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin-top: 15px;
            border-radius: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
          }
          .print-button {
            display: block;
            background: #4F46E5;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin: 20px auto;
          }
          @media print {
            .print-button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Digitales Berichtsheft</h1>
          <p><strong>Auszubildende/r:</strong> ${currentUser.name}</p>
          <p><strong>Erstellt am:</strong> ${new Date().toLocaleString('de-DE')}</p>
          <p><strong>Anzahl Berichte:</strong> ${azubiBerichte.length}</p>
        </div>

        <button class="print-button" onclick="window.print()">Als PDF speichern</button>
    `;

    azubiBerichte.forEach((bericht, index) => {
      const statusClass = `status-${bericht.status}`;
      htmlContent += `
        <div class="bericht">
          <div class="bericht-header">
            <div class="bericht-title">
              Bericht ${index + 1}: ${bericht.taetigkeit}
              <span class="status ${statusClass}">${getStatusText(bericht.status)}</span>
            </div>
            <div class="bericht-meta">
              <strong>Zeitraum:</strong> ${bericht.datum_von} bis ${bericht.datum_bis} | 
              <strong>Stunden:</strong> ${bericht.stunden}h | 
              <strong>Eingereicht:</strong> ${new Date(bericht.eingereicht_am).toLocaleString('de-DE')}
            </div>
          </div>
          ${bericht.details ? `
            <div class="details">
              <div class="details-title">Details:</div>
              <div>${bericht.details}</div>
            </div>
          ` : ''}
          ${bericht.kommentar ? `
            <div class="kommentar">
              <strong>💬 Kommentar vom Ausbilder:</strong><br>
              ${bericht.kommentar}<br>
              <small>Bearbeitet am: ${new Date(bericht.bearbeitet_am).toLocaleString('de-DE')}</small>
            </div>
          ` : ''}
        </div>
      `;
    });

    htmlContent += `
        <div class="footer">
          <p>Digitales Berichtsheft-System | TFG Transfracht</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <FileText className="mx-auto text-indigo-600 mb-4" size={48} />
            <h1 className="text-3xl font-bold text-gray-800">Digitales Berichtsheft</h1>
            <p className="text-gray-600 mt-2">TFG Transfracht</p>
            <p className="text-sm text-gray-500">Mit Supabase Backend</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Benutzername
              </label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Benutzername eingeben"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passwort
              </label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Passwort eingeben"
                disabled={loading}
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Wird geladen...' : 'Anmelden'}
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
            <p className="font-semibold text-gray-700 mb-2">Demo-Zugänge (falls noch vorhanden):</p>
            <p className="text-gray-600">Azubi: <code className="bg-white px-2 py-1 rounded">azubi / azubi123</code></p>
            <p className="text-gray-600">Ausbilder: <code className="bg-white px-2 py-1 rounded">ausbilder / ausbilder123</code></p>
            <p className="text-xs text-gray-500 mt-2">Hinweis: Falls diese nicht funktionieren, wurden sie bereits gelöscht.</p>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.role === 'azubi') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-indigo-600 text-white p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <FileText className="mx-auto text-indigo-600 mb-4" size={28} />
              <div>
                <h1 className="text-xl font-bold">Digitales Berichtsheft</h1>
                <p className="text-sm text-indigo-100">TFG Transfracht</p>
                <p className="text-xs text-indigo-200">Willkommen, {currentUser.name}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-lg transition"
            >
              <LogOut size={18} />
              Abmelden
            </button>
          </div>
        </header>

        {error && (
          <div className="max-w-6xl mx-auto p-6">
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Upload size={24} className="text-indigo-600" />
                {bearbeitenModus ? 'Bericht überarbeiten' : 'Neuen Bericht einreichen'}
              </h2>
              {bearbeitenModus && (
                <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>Hinweis:</strong> Du bearbeitest einen abgelehnten Bericht. Nach dem Speichern wird er erneut zur Prüfung eingereicht.
                  </p>
                </div>
              )}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Von (Datum) *
                    </label>
                    <input
                      type="date"
                      value={neuerBericht.datumVon}
                      onChange={(e) => setNeuerBericht({ ...neuerBericht, datumVon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bis (Datum) *
                    </label>
                    <input
                      type="date"
                      value={neuerBericht.datumBis}
                      onChange={(e) => setNeuerBericht({ ...neuerBericht, datumBis: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tätigkeit *
                  </label>
                  <input
                    type="text"
                    value={neuerBericht.taetigkeit}
                    onChange={(e) => setNeuerBericht({ ...neuerBericht, taetigkeit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="z.B. Kundenberatung, Programmierung..."
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stunden *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={neuerBericht.stunden}
                    onChange={(e) => setNeuerBericht({ ...neuerBericht, stunden: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="z.B. 8"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bericht
                  </label>
                  <textarea
                    value={neuerBericht.details}
                    onChange={(e) => setNeuerBericht({ ...neuerBericht, details: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 h-24"
                    placeholder="Beschreibe deine Tätigkeiten genauer..."
                    disabled={loading}
                  />
                </div>

                <button
                  onClick={berichtEinreichen}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Wird eingereicht...' : bearbeitenModus ? 'Bericht überarbeiten & neu einreichen' : 'Bericht einreichen'}
                </button>
                {bearbeitenModus && (
                  <button
                    onClick={bearbeitungAbbrechen}
                    disabled={loading}
                    className="w-full mt-2 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Abbrechen
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Meine Berichte</h2>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loading ? (
                  <p className="text-gray-500 text-center py-8">Lädt...</p>
                ) : berichte.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Noch keine Berichte vorhanden</p>
                ) : (
                  berichte.map((bericht) => (
                    <div key={bericht.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{bericht.taetigkeit}</p>
                          <p className="text-sm text-gray-600">{bericht.datum_von} bis {bericht.datum_bis} • {bericht.stunden}h</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          {getStatusIcon(bericht.status)}
                          <span className="text-sm font-medium">{getStatusText(bericht.status)}</span>
                        </div>
                      </div>
                      {bericht.details && (
                        <p className="text-sm text-gray-600 mt-2">{bericht.details}</p>
                      )}
                      {bericht.kommentar && (
                        <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                          <p className="text-sm font-medium text-gray-700">Kommentar vom Ausbilder:</p>
                          <p className="text-sm text-gray-600 mt-1">{bericht.kommentar}</p>
                          {bericht.status === 'abgelehnt' && (
                            <button
                              onClick={() => berichtBearbeiten(bericht)}
                              className="mt-3 w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                            >
                              Bericht überarbeiten
                            </button>
                          )}
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={() => downloadPDF(bericht)}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                        >
                          <Download size={16} />
                          Als PDF herunterladen
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-600 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <User size={28} />
            <div>
              <h1 className="text-xl font-bold">Ausbilder-Dashboard</h1>
              <p className="text-sm text-green-100">Willkommen, {currentUser.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 px-4 py-2 rounded-lg transition"
          >
            <LogOut size={18} />
            Abmelden
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto p-6">
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Berichte nach Azubis</h2>
          
          {loading ? (
            <p className="text-gray-500 text-center py-12">Lädt Berichte...</p>
          ) : berichte.length === 0 ? (
            <p className="text-gray-500 text-center py-12">Noch keine Berichte eingereicht</p>
          ) : (
            (() => {
              // Gruppiere Berichte nach Azubi
              const berichteNachAzubi = {};
              berichte.forEach(bericht => {
                if (!berichteNachAzubi[bericht.azubi_name]) {
                  berichteNachAzubi[bericht.azubi_name] = [];
                }
                berichteNachAzubi[bericht.azubi_name].push(bericht);
              });

              return (
                <div className="space-y-8">
                  {Object.entries(berichteNachAzubi).map(([azubiName, azubiBerichte]) => (
                    <div key={azubiName} className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-300">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                          <User size={24} className="text-green-600" />
                          {azubiName}
                        </h3>
                        <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full font-medium">
                          {azubiBerichte.length} {azubiBerichte.length === 1 ? 'Bericht' : 'Berichte'}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {azubiBerichte.map((bericht) => (
                          <div key={bericht.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="text-lg font-bold text-gray-800">{bericht.taetigkeit}</h4>
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(bericht.status)}
                                    <span className="text-sm font-medium">{getStatusText(bericht.status)}</span>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600">
                                  Zeitraum: {bericht.datum_von} bis {bericht.datum_bis} • Stunden: {bericht.stunden}h
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Eingereicht am: {new Date(bericht.eingereicht_am).toLocaleString('de-DE')}
                                </p>
                              </div>
                            </div>

                            {bericht.details && (
                              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm font-medium text-gray-700 mb-1">Bericht:</p>
                                <p className="text-sm text-gray-600">{bericht.details}</p>
                              </div>
                            )}

                            {bericht.status === 'ausstehend' && (
                              <div className="flex gap-3">
                                <button
                                  onClick={() => {
                                    const kommentar = prompt('Optional: Kommentar zur Freigabe hinzufügen');
                                    berichtBearbeitenAusbilder(bericht.id, 'freigegeben', kommentar || '');
                                  }}
                                  disabled={loading}
                                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                  <CheckCircle size={18} />
                                  Freigeben
                                </button>
                                <button
                                  onClick={() => {
                                    const kommentar = prompt('Bitte gib einen Grund für die Ablehnung an:');
                                    if (kommentar) {
                                      berichtBearbeitenAusbilder(bericht.id, 'abgelehnt', kommentar);
                                    }
                                  }}
                                  disabled={loading}
                                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                  <XCircle size={18} />
                                  Ablehnen
                                </button>
                              </div>
                            )}

                            {bericht.status !== 'ausstehend' && bericht.kommentar && (
                              <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                                <p className="text-sm font-medium text-gray-700">Ihr Kommentar:</p>
                                <p className="text-sm text-gray-600 mt-1">{bericht.kommentar}</p>
                                <p className="text-xs text-gray-500 mt-2">
                                  Bearbeitet am: {bericht.bearbeitet_am ? new Date(bericht.bearbeitet_am).toLocaleString('de-DE') : 'N/A'}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};

export default BerichtsheftSystem;
