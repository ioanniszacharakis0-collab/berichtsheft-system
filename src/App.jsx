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
  const [datumVon, setDatumVon] = useState(new Date().toISOString().split('T')[0]);
  const [datumBis, setDatumBis] = useState(new Date().toISOString().split('T')[0]);
  const [zeitraumFilter, setZeitraumFilter] = useState('alle');
  const [sortierung, setSortierung] = useState('datum-neu'); // neu: Sortierung

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
      let query = 'berichte?select=*&order=datum_von.desc';
      
      if (currentUser.role === 'azubi') {
        // Azubi sieht nur seine eigenen Berichte
        query = `berichte?user_id=eq.${currentUser.id}&select=*&order=datum_von.desc`;
      } else if (currentUser.role === 'ausbilder' && selectedAzubi) {
        // Ausbilder sieht nur Berichte vom ausgewählten Azubi
        query = `berichte?user_id=eq.${selectedAzubi.id}&select=*&order=datum_von.desc`;
      }
      
      const data = await supabaseRequest(query);
      const berichteData = data || [];
      setBerichte(berichteData);
      setFilteredBerichte(berichteData);
      sortiereBerichte(berichteData, sortierung);
    } catch (error) {
      console.error('Fehler beim Laden der Berichte:', error);
      setBerichte([]);
      setFilteredBerichte([]);
    }
  };

  // SORTIERUNG
  const sortiereBerichte = (berichteList, sortType) => {
    const sorted = [...berichteList].sort((a, b) => {
      if (sortType === 'datum-neu') {
        return new Date(b.datum_von) - new Date(a.datum_von);
      } else if (sortType === 'datum-alt') {
        return new Date(a.datum_von) - new Date(b.datum_von);
      } else if (sortType === 'status') {
        const statusOrder = { 'pending': 0, 'approved': 1, 'rejected': 2 };
        return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
      }
      return 0;
    });
    setFilteredBerichte(sorted);
  };

  const handleSortChange = (newSort) => {
    setSortierung(newSort);
    sortiereBerichte(filteredBerichte, newSort);
  };

  const filterBerichteByZeitraum = (zeitraum) => {
    setZeitraumFilter(zeitraum);
    
    if (zeitraum === 'alle') {
      sortiereBerichte(berichte, sortierung);
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
          const berichtDatum = new Date(b.datum_von);
          return berichtDatum >= startDatum && berichtDatum <= endDatum;
        });
        sortiereBerichte(filtered, sortierung);
        return;
      case 'dieses-jahr':
        startDatum = new Date(heute.getFullYear(), 0, 1);
        break;
      default:
        sortiereBerichte(berichte, sortierung);
        return;
    }

    const filtered = berichte.filter(b => {
      const berichtDatum = new Date(b.datum_von);
      return berichtDatum >= startDatum;
    });
    
    sortiereBerichte(filtered, sortierung);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const taetigkeit = document.getElementById('taetigkeit-text').value;
    const details = document.getElementById('details-text').value;
    const stunden = document.getElementById('stunden-input').value;
    
    if (!taetigkeit.trim() || !details.trim()) {
      alert('Bitte fülle alle Pflichtfelder aus');
      return;
    }

    try {
      const neuerBericht = {
        user_id: user.id,
        azubi_name: user.name,
        datum_von: datumVon,
        datum_bis: datumBis,
        taetigkeit: taetigkeit,
        details: details,
        stunden: parseFloat(stunden) || 0,
        status: 'pending',
        kommentar: null,
        ueberarbeitet: false
      };

      await supabaseRequest('berichte', {
        method: 'POST',
        body: JSON.stringify(neuerBericht),
      });

      document.getElementById('taetigkeit-text').value = '';
      document.getElementById('details-text').value = '';
      document.getElementById('stunden-input').value = '';
      setDatumVon(new Date().toISOString().split('T')[0]);
      setDatumBis(new Date().toISOString().split('T')[0]);
      loadBerichte(user);
      alert('Bericht erfolgreich eingereicht!');
    } catch (error) {
      console.error('Fehler beim Einreichen:', error);
      alert('Fehler beim Einreichen des Berichts: ' + error.message);
    }
  };

  // BERICHT FREIGEBEN
  const handleApprove = async (berichtId) => {
    try {
      await supabaseRequest(`berichte?id=eq.${berichtId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status: 'approved',
          kommentar: null,
          ueberarbeitet: false
        }),
      });
      loadBerichte(user);
      alert('Bericht wurde freigegeben!');
    } catch (error) {
      console.error('Fehler beim Freigeben:', error);
      alert('Fehler beim Freigeben des Berichts');
    }
  };

  // BERICHT ABLEHNEN
  const handleReject = async (berichtId) => {
    const kommentarText = prompt('Bitte gib einen Kommentar für die Ablehnung ein:');
    
    if (!kommentarText || !kommentarText.trim()) {
      alert('Ablehnung abgebrochen - Kommentar ist erforderlich');
      return;
    }

    try {
      await supabaseRequest(`berichte?id=eq.${berichtId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status: 'rejected',
          kommentar: kommentarText,
          ueberarbeitet: false
        }),
      });
      loadBerichte(user);
      alert('Bericht wurde abgelehnt');
    } catch (error) {
      console.error('Fehler beim Ablehnen:', error);
      alert('Fehler beim Ablehnen des Berichts');
    }
  };

  // BERICHT ÜBERARBEITEN
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

  // ECHTES PDF MIT jsPDF ERSTELLEN
  const generatePdf = async (bericht) => {
    try {
      // Hilfsfunktion: Bricht lange Wörter ohne Leerzeichen auf
      const breakLongWords = (text, maxLength) => {
        const words = text.split(' ');
        const result = [];
        
        for (let word of words) {
          if (word.length > maxLength) {
            for (let i = 0; i < word.length; i += maxLength) {
              result.push(word.substring(i, i + maxLength));
            }
          } else {
            result.push(word);
          }
        }
        
        return result.join(' ');
      };
      
      // jsPDF dynamisch laden
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
      
      script.onload = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const margin = 15;
        const pageWidth = 210;
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;
        
        // ===== BLAUER HEADER =====
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, pageWidth, 30, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('AUSBILDUNGSNACHWEIS', margin, 20);
        
        y = 40;
        
        // ===== INFO BOX =====
        doc.setFillColor(243, 244, 246);
        doc.rect(margin, y, contentWidth, 35, 'F');
        
        doc.setTextColor(55, 65, 81);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('AUSZUBILDENDE/R', margin + 5, y + 8);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(9);
        doc.text(bericht.azubi_name, margin + 5, y + 15);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 65, 81);
        doc.setFontSize(10);
        doc.text('ZEITRAUM', margin + 5, y + 23);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(9);
        const zeitraumText = `${new Date(bericht.datum_von).toLocaleDateString('de-DE')} - ${new Date(bericht.datum_bis).toLocaleDateString('de-DE')}`;
        doc.text(zeitraumText, margin + 5, y + 30);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 65, 81);
        doc.setFontSize(10);
        doc.text('STUNDEN', pageWidth - margin - 30, y + 8);
        
        doc.setFontSize(16);
        doc.setTextColor(30, 64, 175);
        doc.text(bericht.stunden.toString(), pageWidth - margin - 30, y + 20);
        
        y += 45;
        
        // ===== TÄTIGKEIT SECTION =====
        doc.setFillColor(30, 64, 175);
        doc.rect(margin, y, contentWidth, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('TÄTIGKEIT', margin + 5, y + 7);
        
        y += 15;
        
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const taetigkeitBroken = breakLongWords(bericht.taetigkeit, 80);
        const taetigkeitLines = doc.splitTextToSize(taetigkeitBroken, contentWidth - 10);
        doc.text(taetigkeitLines, margin + 5, y);
        y += taetigkeitLines.length * 5 + 10;
        
        // ===== DETAILS SECTION =====
        doc.setFillColor(30, 64, 175);
        doc.rect(margin, y, contentWidth, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('AUSFÜHRLICHE BESCHREIBUNG', margin + 5, y + 7);
        
        y += 15;
        
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const detailsBroken = breakLongWords(bericht.details, 80);
        const detailsLines = doc.splitTextToSize(detailsBroken, contentWidth - 10);
        doc.text(detailsLines, margin + 5, y);
        y += detailsLines.length * 5 + 20;
        
        // ===== UNTERSCHRIFTEN =====
        if (y < 240) {
          y = 240;
        }
        
        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + 60, y);
        
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(8);
        doc.text('Unterschrift Auszubildende/r', margin, y + 5);
        
        doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
        doc.text('Unterschrift Ausbilder/in', pageWidth - margin - 60, y + 5);
        
        // ===== FOOTER =====
        doc.setTextColor(156, 163, 175);
        doc.setFontSize(8);
        doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, margin, 285);
        
        doc.save(`Ausbildungsnachweis_${bericht.azubi_name}_${bericht.datum_von}.pdf`);
        
        alert('PDF wird heruntergeladen...');
      };
      
      script.onerror = () => {
        alert('Fehler beim Laden der PDF-Bibliothek');
      };
    } catch (error) {
      console.error('Fehler beim Generieren:', error);
      alert('Fehler beim Erstellen des PDFs');
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
                    Datum von
                  </label>
                  <input
                    type="date"
                    value={datumVon}
                    onChange={(e) => setDatumVon(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Datum bis
                  </label>
                  <input
                    type="date"
                    value={datumBis}
                    onChange={(e) => setDatumBis(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stunden
                  </label>
                  <input
                    id="stunden-input"
                    type="number"
                    step="0.5"
                    defaultValue="8"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tätigkeit
                  </label>
                  <input
                    id="taetigkeit-text"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="z.B. Programmierung, Kundengespräch..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Details
                  </label>
                  <textarea
                    id="details-text"
                    rows="6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Beschreibe deine Tätigkeiten im Detail..."
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
                            {new Date(bericht.datum_von).toLocaleDateString('de-DE')} - {new Date(bericht.datum_bis).toLocaleDateString('de-DE')}
                          </p>
                          <p className="text-xs text-gray-500">{bericht.stunden} Stunden</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(bericht.status)}`}>
                          {getStatusIcon(bericht.status)}
                          <span className="ml-1">{getStatusText(bericht.status)}</span>
                        </span>
                      </div>
                      
                      <div className="w-full max-w-full overflow-hidden mb-2">
                        <p className="text-xs font-medium text-gray-700">Tätigkeit:</p>
                        <p 
                          className="text-sm text-gray-900 break-all whitespace-pre-wrap"
                          style={{
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            maxWidth: '100%'
                          }}
                        >
                          {bericht.taetigkeit}
                        </p>
                      </div>

                      <div className="w-full max-w-full overflow-hidden">
                        <p className="text-xs font-medium text-gray-700">Details:</p>
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

                      {/* KOMMENTAR BEI ABLEHNUNG */}
                      {bericht.status === 'rejected' && bericht.kommentar && (
                        <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                          <p className="text-xs font-medium text-red-800 mb-1">Kommentar vom Ausbilder:</p>
                          <p className="text-xs text-red-700">{bericht.kommentar}</p>
                          <button
                            onClick={() => handleResubmit(bericht.id)}
                            className="mt-2 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Überarbeiten und erneut einreichen
                          </button>
                        </div>
                      )}
                      
                      {/* PDF DOWNLOAD NUR BEI FREIGABE */}
                      {bericht.status === 'approved' && (
                        <div className="mt-3">
                          <button
                            onClick={() => generatePdf(bericht)}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            PDF herunterladen
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
                    onClick={async () => {
                      setSelectedAzubi(azubi);
                      setBerichte([]);
                      setFilteredBerichte([]);
                      
                      // Lade Berichte direkt mit der Azubi ID
                      try {
                        const query = `berichte?user_id=eq.${azubi.id}&select=*&order=datum_von.desc`;
                        const data = await supabaseRequest(query);
                        const berichteData = data || [];
                        setBerichte(berichteData);
                        setFilteredBerichte(berichteData);
                      } catch (error) {
                        console.error('Fehler beim Laden der Berichte:', error);
                      }
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
          {/* FILTER & SORTIERUNG */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center mb-3">
              <Filter className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
              <h3 className="font-medium text-gray-800">Filter & Sortierung</h3>
            </div>
            
            {/* ZEITRAUM FILTER */}
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">Zeitraum:</p>
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
            </div>

            {/* SORTIERUNG */}
            <div>
              <p className="text-sm text-gray-700 mb-2">Sortierung:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSortChange('datum-neu')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortierung === 'datum-neu' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Neuste zuerst
                </button>
                <button
                  onClick={() => handleSortChange('datum-alt')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortierung === 'datum-alt' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Älteste zuerst
                </button>
                <button
                  onClick={() => handleSortChange('status')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortierung === 'status' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Nach Status
                </button>
              </div>
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
                      <div>
                        <p className="text-sm font-medium text-blue-800">Überarbeiteter Bericht</p>
                        <p className="text-xs text-blue-600 mt-1">Dieser Bericht wurde überarbeitet</p>
                      </div>
                    </div>
                  )}

                  {/* HEADER MIT STATUS */}
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {new Date(bericht.datum_von).toLocaleDateString('de-DE')} - {new Date(bericht.datum_bis).toLocaleDateString('de-DE')}
                      </h3>
                      <p className="text-sm text-gray-600">von {bericht.azubi_name} • {bericht.stunden} Stunden</p>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${getStatusColor(bericht.status)}`}>
                      {getStatusIcon(bericht.status)}
                      <span className="ml-1">{getStatusText(bericht.status)}</span>
                    </span>
                  </div>

                  {/* TÄTIGKEIT */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg w-full max-w-full overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 mb-1">Tätigkeit:</p>
                    <p 
                      className="text-sm text-gray-900 break-all whitespace-pre-wrap"
                      style={{
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere',
                        maxWidth: '100%'
                      }}
                    >
                      {bericht.taetigkeit}
                    </p>
                  </div>

                  {/* DETAILS */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg w-full max-w-full overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 mb-1">Details:</p>
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

                  {/* KOMMENTAR ANZEIGEN */}
                  {bericht.status === 'rejected' && bericht.kommentar && (
                    <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
                      <p className="text-sm font-medium text-red-800 mb-1">Dein Kommentar:</p>
                      <p className="text-sm text-red-700">{bericht.kommentar}</p>
                    </div>
                  )}

                  {/* FREIGEBEN / ABLEHNEN BUTTONS - IMMER ANZEIGEN */}
                  <div className="flex gap-2 pt-4 border-t mt-4">
                    <button
                      onClick={() => handleApprove(bericht.id)}
                      className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center shadow-md"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Freigeben
                    </button>
                    <button
                      onClick={() => handleReject(bericht.id)}
                      className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center shadow-md"
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      Ablehnen
                    </button>
                  </div>

                  {/* STATUS INFO */}
                  {bericht.status === 'approved' && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg flex items-center border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                      <p className="text-sm text-green-800 font-medium">✓ Bereits freigegeben</p>
                    </div>
                  )}

                  {bericht.status === 'rejected' && bericht.kommentar && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center mb-2">
                        <XCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
                        <p className="text-sm text-red-800 font-medium">✗ Abgelehnt - Dein Kommentar:</p>
                      </div>
                      <p className="text-sm text-red-700 ml-7">{bericht.kommentar}</p>
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
