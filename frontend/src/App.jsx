import React, { useState, useEffect } from 'react';
import { 
  Zap, Navigation, ShieldCheck, MapPin, Calendar, Clock, 
  Car, UserCheck, AlertTriangle, ChevronRight, CheckCircle2, 
  DollarSign, Activity, Star, RefreshCw, Plus, ArrowRight, Info
} from 'lucide-react';
import api from './api/client';
import { useAuth, AuthProvider } from './auth/AuthContext';

// Helper for verification badge rendering
const VerificationBadge = ({ level }) => {
  const meta = {
    0: { label: 'Unverified', desc: 'No verification completed yet', cls: 'badge-v0' },
    1: { label: 'Phone Verified (L1)', desc: 'Mobile verified via OTP', cls: 'badge-v1' },
    2: { label: 'Host ID Verified (L2)', desc: 'Government photo ID verified', cls: 'badge-v2' },
    3: { label: 'Charger Verified (L3)', desc: 'Charger specs & ownership authorized', cls: 'badge-v3' },
    4: { label: 'Community Certified (L4)', desc: 'Inspected hardware & smart-charger link', cls: 'badge-v4' },
  };
  const item = meta[level] || meta[0];
  return (
    <span 
      title={item.desc}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: '700',
        cursor: 'help'
      }} 
      className={item.cls}
    >
      <ShieldCheck size={12} />
      {item.label}
    </span>
  );
};

// Main App Container
function ChargeNeighborApp() {
  const { user, login, register, logout, becomeHost, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('find'); // find, recommend, bookings, vehicles, host_dash, admin, login
  const [authMode, setAuthMode] = useState('login'); // login or register
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authRole, setAuthRole] = useState('driver');
  const [authError, setAuthError] = useState('');

  // Search & Recommendations State
  const [chargers, setChargers] = useState([]);
  const [selectedCharger, setSelectedCharger] = useState(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingHours, setBookingHours] = useState(2);
  const [bookingKwh, setBookingKwh] = useState(15);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState('');
  
  // Explainable Recommendation Engine Form
  const [recBatteryPct, setRecBatteryPct] = useState(18);
  const [recPriority, setRecPriority] = useState('balanced');
  const [recEmergency, setRecEmergency] = useState(false);
  const [recTargetPct, setRecTargetPct] = useState(80);
  const [recommendations, setRecommendations] = useState(null);
  const [recLoading, setRecLoading] = useState(false);

  // Driver Bookings & Alternatives
  const [myBookings, setMyBookings] = useState([]);
  const [alternativesMap, setAlternativesMap] = useState({});

  // Host State
  const [hostSummary, setHostSummary] = useState(null);
  const [hostChargers, setHostChargers] = useState([]);
  const [newChargerModal, setNewChargerModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPower, setNewPower] = useState(7.4);
  const [newPrice, setNewPrice] = useState(15);
  const [newConnector, setNewConnector] = useState('CCS2');
  const [newMode, setNewMode] = useState('instant');
  const [newAccess, setNewAccess] = useState('');

  // Admin State
  const [adminStats, setAdminStats] = useState(null);
  const [adminVerifications, setAdminVerifications] = useState([]);

  // Load Initial Public Chargers
  useEffect(() => {
    fetchNearbyChargers();
  }, []);

  // Reload user-specific data upon switching tabs
  useEffect(() => {
    if (user) {
      if (currentTab === 'bookings') fetchDriverBookings();
      if (currentTab === 'host_dash') fetchHostData();
      if (currentTab === 'admin') fetchAdminData();
    }
  }, [currentTab, user]);

  const fetchNearbyChargers = async () => {
    try {
      const res = await api.get('/chargers/nearby?lat=12.9716&lng=77.5946&radius_km=30');
      setChargers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDriverBookings = async () => {
    try {
      const res = await api.get('/bookings');
      setMyBookings(res.data);
      // For any cancelled bookings, fetch alternatives
      for (const b of res.data) {
        if (b.status === 'cancelled_by_host') {
          api.get(`/bookings/${b.id}/alternatives`).then(altRes => {
            setAlternativesMap(prev => ({ ...prev, [b.id]: altRes.data }));
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHostData = async () => {
    try {
      const sumRes = await api.get('/host/dashboard/summary');
      setHostSummary(sumRes.data);
      const chRes = await api.get('/host/chargers');
      setHostChargers(chRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminData = async () => {
    try {
      const stRes = await api.get('/admin/stats/overview');
      setAdminStats(stRes.data);
      const vRes = await api.get('/admin/verification-requests');
      setAdminVerifications(vRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await login(authEmail, authPassword);
      } else {
        await register(authName, authEmail, authPhone, authPassword, authRole);
      }
      setCurrentTab('find');
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  const runRecommendationEngine = async (emergencyMode = false) => {
    setRecLoading(true);
    try {
      const res = await api.post('/recommendations', {
        battery_pct: recBatteryPct,
        current_lat: 12.9716,
        current_lng: 77.5946,
        priority: emergencyMode ? 'safest' : recPriority,
        emergency: emergencyMode || recEmergency,
        target_pct: recTargetPct,
        radius_km: 25.0
      });
      setRecommendations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setRecLoading(false);
    }
  };

  const handleCreateBooking = async () => {
    if (!user) {
      setCurrentTab('login');
      return;
    }
    try {
      const now = new Date();
      const end = new Date(now.getTime() + bookingHours * 60 * 60 * 1000);
      
      const payload = {
        charger_id: selectedCharger.id,
        vehicle_id: "veh_default",
        start_time: now.toISOString(),
        end_time: end.toISOString(),
        requested_kwh: parseFloat(bookingKwh),
        is_emergency: recEmergency
      };
      
      const res = await api.post('/bookings', payload, {
        headers: { 'idempotency-key': `req_${Date.now()}` }
      });
      
      setBookingSuccessMsg(`Booking #${res.data.id.slice(0, 8)} confirmed! Estimated total: ₹${(res.data.est_total_paise / 100).toFixed(2)}`);
      fetchDriverBookings();
      setTimeout(() => {
        setBookingModalOpen(false);
        setBookingSuccessMsg('');
        setCurrentTab('bookings');
      }, 2000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Booking failed');
    }
  };

  const handleSimulateHostCancel = async (bookingId) => {
    try {
      await api.post(`/host/bookings/${bookingId}/cancel?reason=Host%20driveway%20maintenance`);
      fetchDriverBookings();
    } catch (err) {
      alert('Cancel failed');
    }
  };

  const handleAcceptAlternative = async (bookingId, offerId) => {
    try {
      await api.post(`/bookings/${bookingId}/alternatives/${offerId}/accept`);
      alert('Replacement charger booked successfully!');
      fetchDriverBookings();
    } catch (err) {
      alert('Accept alternative failed');
    }
  };

  const handleCreateCharger = async (e) => {
    e.preventDefault();
    try {
      await api.post('/host/chargers', {
        title: newTitle,
        address: newAddress,
        city: 'Bengaluru',
        latitude: 12.9716 + (Math.random() - 0.5) * 0.05,
        longitude: 77.5946 + (Math.random() - 0.5) * 0.05,
        connector_type: newConnector,
        power_kw: parseFloat(newPower),
        price_per_kwh_paise: parseInt(newPrice * 100),
        booking_mode: newMode,
        access_instructions: newAccess
      });
      setNewChargerModal(false);
      fetchHostData();
    } catch (err) {
      alert('Failed to list charger');
    }
  };

  const handleApproveVerification = async (reqId) => {
    try {
      await api.post(`/admin/verification-requests/${reqId}/approve?level=3`);
      fetchAdminData();
    } catch (err) {
      alert('Approval failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Demo Banner */}
      <div style={{
        background: 'linear-gradient(90deg, #1e1b4b, #312e81, #1e1b4b)',
        padding: '6px 16px',
        textAlign: 'center',
        fontSize: '0.8rem',
        fontWeight: '600',
        letterSpacing: '0.04em',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        <Info size={14} color="#a5b4fc" />
        <span>ChargeNeighbor Prototype Mode: Simulated Payments (in paise) & Algorithmic Reachability Active</span>
      </div>

      {/* Header & Nav */}
      <header style={{
        background: 'rgba(11, 15, 25, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '14px 24px'
      }}>
        <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Logo */}
          <div 
            onClick={() => setCurrentTab('find')} 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: '8px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
            }}>
              <Zap size={22} color="#ffffff" />
            </div>
            <div>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#ffffff' }}>
                Charge<span style={{ color: '#10b981' }}>Neighbor</span>
              </span>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '-2px' }}>Your neighborhood. Your next charge.</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              className={`btn ${currentTab === 'find' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCurrentTab('find')}
            >
              <MapPin size={16} /> Explore Map
            </button>
            <button 
              className={`btn ${currentTab === 'recommend' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setCurrentTab('recommend'); if (!recommendations) runRecommendationEngine(); }}
            >
              <Activity size={16} /> Smart Match
            </button>
            
            {user && (
              <>
                <button 
                  className={`btn ${currentTab === 'bookings' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCurrentTab('bookings')}
                >
                  <Calendar size={16} /> My Bookings
                </button>

                {user.roles.includes('host') ? (
                  <button 
                    className={`btn ${currentTab === 'host_dash' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCurrentTab('host_dash')}
                  >
                    <DollarSign size={16} /> Host Portal
                  </button>
                ) : (
                  <button 
                    className="btn btn-secondary" 
                    onClick={becomeHost}
                    title="List your residential charger and start earning"
                  >
                    Become Host
                  </button>
                )}

                {user.roles.includes('admin') && (
                  <button 
                    className={`btn ${currentTab === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCurrentTab('admin')}
                  >
                    <ShieldCheck size={16} /> Admin
                  </button>
                )}
              </>
            )}

            {/* Quick Emergency Button (PRD 14.5 requirement) */}
            <button 
              className="btn btn-danger emergency-pulse"
              onClick={() => {
                setRecBatteryPct(8);
                setRecEmergency(true);
                setCurrentTab('recommend');
                runRecommendationEngine(true);
              }}
              style={{ fontWeight: '700' }}
            >
              <AlertTriangle size={16} /> Low Battery SOS
            </button>

            {/* User Profile / Login */}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{user.name}</div>
                  <VerificationBadge level={user.verification_level} />
                </div>
                <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={logout}>
                  Logout
                </button>
              </div>
            ) : (
              <button 
                className="btn btn-secondary" 
                style={{ marginLeft: '10px' }}
                onClick={() => setCurrentTab('login')}
              >
                Sign In
              </button>
            )}
          </nav>

        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1300px', width: '100%', margin: '0 auto', padding: '24px' }}>
        
        {/* ========================================================================= */}
        {/* TAB 1: FIND / EXPLORE CHARGERS                                           */}
        {/* ========================================================================= */}
        {currentTab === 'find' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Available Neighborhood Chargers</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Verified peer-to-peer charging locations in Bengaluru with transparent pricing in ₹
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span className="glass-panel" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} color="#10b981" /> Center: Bengaluru (Indiranagar)
                </span>
              </div>
            </div>

            {/* Grid of Charger Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {chargers.map((ch) => (
                <div 
                  key={ch.id} 
                  className="glass-panel" 
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s, border-color 0.2s',
                    borderColor: selectedCharger?.id === ch.id ? '#10b981' : 'var(--border-subtle)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>{ch.title}</h3>
                      <VerificationBadge level={ch.verification_level} />
                    </div>
                    
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px', minHeight: '38px' }}>
                      {ch.description || 'Verified residential charger ready for driver booking.'}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                      <div className="glass-panel" style={{ padding: '8px 12px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>POWER & TYPE</div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#10b981' }}>
                          {ch.power_kw} kW ({ch.connector_type})
                        </div>
                      </div>
                      <div className="glass-panel" style={{ padding: '8px 12px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PRICE / KWH</div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                          ₹{ch.price_per_kwh_rupees}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Navigation size={13} color="#3b82f6" /> {ch.distance_km} km away
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={13} color="#f59e0b" fill="#f59e0b" /> {ch.avg_rating} ({ch.rating_count} reviews)
                      </span>
                      <span style={{ textTransform: 'capitalize', color: ch.booking_mode === 'instant' ? '#10b981' : '#f59e0b' }}>
                        ● {ch.booking_mode}
                      </span>
                    </div>
                  </div>

                  <button 
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setSelectedCharger(ch);
                      setBookingModalOpen(true);
                    }}
                  >
                    Book Charging Slot
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: EXPLAINABLE RECOMMENDATION ENGINE (PRD Section 7)                  */}
        {/* ========================================================================= */}
        {currentTab === 'recommend' && (
          <div>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap color="#10b981" /> Explainable Charger Recommendation Engine
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Evaluates true battery reachability with safety margins, OSRM route distance, and multi-factor ranking.
                </p>
              </div>

              {/* Input Form */}
              <div className="glass-panel-elevated" style={{ padding: '24px', marginBottom: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px', marginBottom: '20px' }}>
                  
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Current Battery State (%)
                    </label>
                    <input 
                      type="number" 
                      className="input-field" 
                      min="1" 
                      max="100" 
                      value={recBatteryPct}
                      onChange={(e) => setRecBatteryPct(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Target Battery (%)
                    </label>
                    <input 
                      type="number" 
                      className="input-field" 
                      min="50" 
                      max="100" 
                      value={recTargetPct}
                      onChange={(e) => setRecTargetPct(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Priority Optimization
                    </label>
                    <select 
                      className="input-field"
                      value={recPriority}
                      onChange={(e) => setRecPriority(e.target.value)}
                    >
                      <option value="balanced">Balanced (Multi-factor)</option>
                      <option value="fastest">Fastest Travel Time</option>
                      <option value="cheapest">Cheapest Cost</option>
                      <option value="safest">Safest (Reachability & Trust)</option>
                    </select>
                  </div>

                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="checkbox" 
                      checked={recEmergency} 
                      onChange={(e) => setRecEmergency(e.target.checked)} 
                    />
                    <span style={{ color: recEmergency ? '#f43f5e' : 'inherit', fontWeight: recEmergency ? '700' : 'normal' }}>
                      Emergency SOS Mode (Expands radius, lowers reach threshold)
                    </span>
                  </label>

                  <button 
                    className="btn btn-primary" 
                    onClick={() => runRecommendationEngine(false)}
                    disabled={recLoading}
                  >
                    <RefreshCw size={16} className={recLoading ? 'emergency-pulse' : ''} />
                    {recLoading ? 'Computing Routes & Scores...' : 'Compute Recommendations'}
                  </button>
                </div>
              </div>

              {/* Results View */}
              {recommendations && (
                <div>
                  {/* Vehicle Range Summary Card */}
                  <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ESTIMATED REACHABLE RADIUS</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                        Safe Range: <span style={{ color: '#10b981' }}>{recommendations.vehicle_info.safe_range_km} km</span> 
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                          (Raw: {recommendations.vehicle_info.estimated_range_km} km with 20% margin)
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#f59e0b', maxWidth: '350px' }}>
                      ⚠️ {recommendations.uncertainty_note}
                    </div>
                  </div>

                  {/* Scored & Ranked Recommendations */}
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '14px' }}>
                    Top Ranked Matches ({recommendations.recommendations.length})
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '30px' }}>
                    {recommendations.recommendations.map((rec, index) => (
                      <div 
                        key={rec.charger_id} 
                        className="glass-panel-elevated"
                        style={{ padding: '20px', borderLeft: index === 0 ? '4px solid #10b981' : '1px solid var(--border-subtle)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                background: index === 0 ? '#10b981' : '#334155',
                                color: '#ffffff',
                                borderRadius: '9999px',
                                width: '24px',
                                height: '24px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.8rem',
                                fontWeight: '700'
                              }}>
                                #{index + 1}
                              </span>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>{rec.title}</h3>
                              <VerificationBadge level={rec.verification_level} />
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                              {rec.address}, {rec.city}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#10b981' }}>
                              ₹{rec.cost_estimate.total_rupees}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated total</div>
                          </div>
                        </div>

                        {/* Explanation Callout */}
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          margin: '12px 0',
                          fontSize: '0.88rem',
                          color: '#34d399',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <CheckCircle2 size={16} />
                          <span>{rec.explanation}</span>
                        </div>

                        {/* Score Breakdown Bars */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', margin: '14px 0', fontSize: '0.75rem' }}>
                          <div className="glass-panel" style={{ padding: '6px 10px' }}>
                            <div style={{ color: 'var(--text-muted)' }}>Route Distance</div>
                            <div style={{ fontWeight: '700', color: '#f8fafc' }}>{rec.route_distance_km} km</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '6px 10px' }}>
                            <div style={{ color: 'var(--text-muted)' }}>Drive Duration</div>
                            <div style={{ fontWeight: '700', color: '#f8fafc' }}>{rec.eta_minutes} mins</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '6px 10px' }}>
                            <div style={{ color: 'var(--text-muted)' }}>Reach Confidence</div>
                            <div style={{ fontWeight: '700', color: rec.reach_confidence === 'high' ? '#10b981' : '#f59e0b', textTransform: 'uppercase' }}>
                              {rec.reach_confidence}
                            </div>
                          </div>
                          <div className="glass-panel" style={{ padding: '6px 10px' }}>
                            <div style={{ color: 'var(--text-muted)' }}>Overall Match Score</div>
                            <div style={{ fontWeight: '700', color: '#38bdf8' }}>{rec.score} / 1.0</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                          <button 
                            className="btn btn-primary"
                            onClick={() => {
                              setSelectedCharger({
                                id: rec.charger_id,
                                title: rec.title,
                                price_per_kwh_rupees: rec.cost_estimate.energy_cost_rupees,
                                price_per_kwh_paise: rec.cost_estimate.energy_cost_paise
                              });
                              setBookingModalOpen(true);
                            }}
                          >
                            Book This Recommended Match <ArrowRight size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rejected Candidates & Reasons (PRD 7.2) */}
                  {recommendations.rejected.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        Excluded / Incompatible Candidates ({recommendations.rejected.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recommendations.rejected.map((rej) => (
                          <div key={rej.charger_id} className="glass-panel" style={{ padding: '10px 16px', opacity: 0.7, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: '600' }}>{rej.title}</span>
                              <span style={{ color: '#f43f5e', marginLeft: '12px' }}>
                                Reason: {rej.reasons_rejected.join(', ')}
                              </span>
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rej.route_distance_km} km away</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DRIVER BOOKINGS & ALTERNATIVE RECOVERY                             */}
        {/* ========================================================================= */}
        {currentTab === 'bookings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>My Charging Bookings</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Live booking statuses, secret access codes, and automated cancellation recovery
                </p>
              </div>
              <button className="btn btn-secondary" onClick={fetchDriverBookings}>
                <RefreshCw size={15} /> Refresh
              </button>
            </div>

            {myBookings.length === 0 ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
                <Calendar size={36} color="#64748b" style={{ margin: '0 auto 12px' }} />
                <h3>No bookings found</h3>
                <p style={{ color: 'var(--text-secondary)', margin: '8px 0 16px' }}>You haven't reserved any neighborhood charging slots yet.</p>
                <button className="btn btn-primary" onClick={() => setCurrentTab('find')}>Browse Chargers</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {myBookings.map((b) => (
                  <div key={b.id} className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>{b.charger_title}</h3>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            background: b.status === 'confirmed' ? 'rgba(16, 185, 129, 0.2)' : b.status === 'cancelled_by_host' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: b.status === 'confirmed' ? '#34d399' : b.status === 'cancelled_by_host' ? '#f43f5e' : '#fbbf24',
                          }}>
                            {b.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                          Reserved Slot: {new Date(b.start_time).toLocaleDateString()} at {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                          ₹{b.est_total_rupees}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Simulated authorized</div>
                      </div>
                    </div>

                    {/* Secret Access Instructions (Concealed until confirmed per PRD) */}
                    {b.status === 'confirmed' && b.access_instructions && (
                      <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '12px', margin: '12px 0' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#60a5fa', marginBottom: '4px' }}>
                          CONFIRMED ACCESS INSTRUCTIONS & EXACT ADDRESS:
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>{b.access_instructions}</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>Address: {b.charger_address}</div>
                      </div>
                    )}

                    {/* Cancellation & Alternative Recovery Section (PRD Section 8.3) */}
                    {b.status === 'cancelled_by_host' && (
                      <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '10px', padding: '16px', margin: '14px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e', fontWeight: '700', marginBottom: '8px' }}>
                          <AlertTriangle size={18} />
                          <span>Host Cancelled Booking — Immediate Replacement Offers</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                          The recommendation engine automatically identified alternative chargers with matching connectors and battery reachability:
                        </p>

                        {alternativesMap[b.id] && alternativesMap[b.id].length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                            {alternativesMap[b.id].map((alt) => (
                              <div key={alt.offer_id} className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                  <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{alt.title}</div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {alt.power_kw}kW • {alt.eta_minutes}m drive away • ₹{alt.est_total_rupees}
                                  </div>
                                </div>
                                <button 
                                  className="btn btn-primary" 
                                  style={{ marginTop: '10px', padding: '6px 12px', fontSize: '0.8rem' }}
                                  onClick={() => handleAcceptAlternative(b.id, alt.offer_id)}
                                >
                                  Accept & Instant Switch
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Searching nearby network for alternative slots...</div>
                        )}
                      </div>
                    )}

                    {/* Demo button to trigger host cancel simulation */}
                    {b.status === 'confirmed' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ fontSize: '0.78rem', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                          onClick={() => handleSimulateHostCancel(b.id)}
                        >
                          Simulate Host Cancellation & Alternatives Flow
                        </button>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: HOST DASHBOARD                                                    */}
        {/* ========================================================================= */}
        {currentTab === 'host_dash' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Host Operations & Earnings</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Manage listings, review bookings, and monitor Bayesian reliability scores
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setNewChargerModal(true)}>
                <Plus size={16} /> Add New Charger
              </button>
            </div>

            {/* Metrics cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="glass-panel" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ESTIMATED EARNINGS (MONTH)</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                  ₹{hostSummary?.month_earnings_rupees || '0.00'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Simulated payout balance</div>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>BAYESIAN RELIABILITY</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
                  {hostSummary?.reliability_score_pct || '96.5'}%
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Completed / Confirmed score</div>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ACTIVE CHARGERS</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f8fafc', marginTop: '4px' }}>
                  {hostChargers.length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Available on public map</div>
              </div>
            </div>

            {/* Charger Listings */}
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '14px' }}>My Listed Chargers</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
              {hostChargers.map((c) => (
                <div key={c.id} className="glass-panel" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontWeight: '700', fontSize: '1.05rem' }}>{c.title}</h4>
                    <VerificationBadge level={c.verification_level} />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0' }}>{c.address}</div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#10b981', margin: '10px 0' }}>
                    <span>{c.power_kw} kW</span>
                    <span>•</span>
                    <span>₹{(c.price_per_kwh_paise / 100).toFixed(2)}/kWh</span>
                    <span>•</span>
                    <span>{c.booking_mode}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    <button className="btn btn-secondary" style={{ flex: 1, padding: '6px' }}>Edit Rules</button>
                    <button className="btn btn-secondary" style={{ flex: 1, padding: '6px' }}>Toggle Pause</button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ADMIN PORTAL                                                      */}
        {/* ========================================================================= */}
        {currentTab === 'admin' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Platform Operator & Admin Portal</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Manage verification queues (Levels 1 to 4), dispute resolutions, and audit compliance
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL USERS</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{adminStats?.total_users || 0}</div>
              </div>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACTIVE CHARGERS</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>{adminStats?.total_chargers || 0}</div>
              </div>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>COMPLETED SESSIONS</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#38bdf8' }}>{adminStats?.completed_bookings || 0}</div>
              </div>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MATCH RATE</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fbbf24' }}>{adminStats?.match_rate_pct || 98.4}%</div>
              </div>
            </div>

            {/* Verification Queue */}
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '14px' }}>Verification Requests Queue</h3>
            {adminVerifications.length === 0 ? (
              <div className="glass-panel" style={{ padding: '24px', color: 'var(--text-secondary)' }}>
                No pending verification documents requiring review.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {adminVerifications.map((vr) => (
                  <div key={vr.id} className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700' }}>Subject Type: {vr.subject_type.toUpperCase()} (ID: {vr.subject_id.slice(0, 8)})</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Requested Level: {vr.level} • Documents: {vr.documents.join(', ')}</div>
                    </div>
                    <button className="btn btn-primary" onClick={() => handleApproveVerification(vr.id)}>
                      Approve Level {vr.level}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: AUTHENTICATION (LOGIN / REGISTER)                                  */}
        {/* ========================================================================= */}
        {currentTab === 'login' && (
          <div style={{ maxWidth: '440px', margin: '40px auto' }}>
            <div className="glass-panel-elevated" style={{ padding: '32px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <Zap size={26} color="#ffffff" />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                  {authMode === 'login' ? 'Sign In to ChargeNeighbor' : 'Create an Account'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Access nearby community chargers or manage your listings
                </p>
              </div>

              {authError && (
                <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid #f43f5e', color: '#f43f5e', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                {authMode === 'register' && (
                  <>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Full Name</label>
                      <input 
                        className="input-field" 
                        value={authName} 
                        onChange={(e) => setAuthName(e.target.value)} 
                        placeholder="e.g. Ramesh Sen" 
                        required 
                      />
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                      <input 
                        className="input-field" 
                        value={authPhone} 
                        onChange={(e) => setAuthPhone(e.target.value)} 
                        placeholder="+91 98765 43210" 
                        required 
                      />
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Role</label>
                      <select className="input-field" value={authRole} onChange={(e) => setAuthRole(e.target.value)}>
                        <option value="driver">EV Driver (Find & Book Chargers)</option>
                        <option value="host">Charger Host (Share & Earn)</option>
                      </select>
                    </div>
                  </>
                )}

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Address</label>
                  <input 
                    type="email" 
                    className="input-field" 
                    value={authEmail} 
                    onChange={(e) => setAuthEmail(e.target.value)} 
                    placeholder="you@domain.com" 
                    required 
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Password</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={authPassword} 
                    onChange={(e) => setAuthPassword(e.target.value)} 
                    placeholder="••••••••" 
                    required 
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                  {authMode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              {/* Fast Demo Account Fillers */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '8px' }}>
                  OR SIGN IN WITH PRE-CONFIGURED PILOT ACCOUNTS:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.72rem', padding: '6px' }}
                    onClick={() => { setAuthEmail('driver@chargeneighbor.com'); setAuthPassword('password123'); }}
                  >
                    Driver
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.72rem', padding: '6px' }}
                    onClick={() => { setAuthEmail('host@chargeneighbor.com'); setAuthPassword('password123'); }}
                  >
                    Host
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.72rem', padding: '6px' }}
                    onClick={() => { setAuthEmail('admin@chargeneighbor.com'); setAuthPassword('admin123'); }}
                  >
                    Admin
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem' }}>
                {authMode === 'login' ? (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Don't have an account?{' '}
                    <button style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: '600' }} onClick={() => setAuthMode('register')}>
                      Sign Up
                    </button>
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Already have an account?{' '}
                    <button style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: '600' }} onClick={() => setAuthMode('login')}>
                      Log In
                    </button>
                  </span>
                )}
              </div>

            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* BOOKING MODAL WITH ITEMIZATION BREAKDOWN (PRD Section 9.3)               */}
      {/* ========================================================================= */}
      {bookingModalOpen && selectedCharger && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-panel-elevated" style={{ maxWidth: '500px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '6px' }}>Reserve Charging Slot</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '18px' }}>{selectedCharger.title}</p>

            {bookingSuccessMsg ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#34d399', padding: '16px', borderRadius: '8px', textAlign: 'center', fontWeight: '600' }}>
                {bookingSuccessMsg}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Estimated Energy (kWh)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={bookingKwh} 
                      onChange={(e) => setBookingKwh(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Session Duration (Hours)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={bookingHours} 
                      onChange={(e) => setBookingHours(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Section 9 Itemized Pricing Breakdown */}
                <div className="glass-panel" style={{ padding: '14px', marginBottom: '18px', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--text-main)' }}>Itemized Cost Estimate (Paise to INR):</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Energy ({bookingKwh} kWh @ ₹15.00)</span>
                    <span>₹{(bookingKwh * 15).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Platform Fee (10%, min ₹20)</span>
                    <span>₹{Math.max(20, bookingKwh * 15 * 0.10).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>GST Tax (18%)</span>
                    <span>₹{((bookingKwh * 15 + Math.max(20, bookingKwh * 15 * 0.10)) * 0.18).toFixed(2)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: '#10b981', fontSize: '1rem' }}>
                    <span>Estimated Total</span>
                    <span>
                      ₹{(
                        (bookingKwh * 15 + Math.max(20, bookingKwh * 15 * 0.10)) * 1.18
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  * All amounts authorized via simulated gateway. Real payment settlement happens after session completion.
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setBookingModalOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreateBooking}>
                    Authorize & Confirm Slot
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD CHARGER MODAL (FOR HOSTS)                                            */}
      {/* ========================================================================= */}
      {newChargerModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '20px'
        }}>
          <div className="glass-panel-elevated" style={{ maxWidth: '520px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '14px' }}>List New Home Charger</h3>
            <form onSubmit={handleCreateCharger}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Listing Title</label>
                <input className="input-field" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Indiranagar Solar Fast AC" required />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Address (Bengaluru)</label>
                <input className="input-field" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="e.g. 24, 100ft Road, Indiranagar" required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Power (kW)</label>
                  <input type="number" step="0.1" className="input-field" value={newPower} onChange={(e) => setNewPower(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Price per kWh (₹)</label>
                  <input type="number" className="input-field" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Connector Type</label>
                  <select className="input-field" value={newConnector} onChange={(e) => setNewConnector(e.target.value)}>
                    <option value="CCS2">CCS2</option>
                    <option value="Type2">Type2</option>
                    <option value="Bharat_AC001">Bharat AC001</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Booking Mode</label>
                  <select className="input-field" value={newMode} onChange={(e) => setNewMode(e.target.value)}>
                    <option value="instant">Instant Book</option>
                    <option value="approval">Host Approval Required</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Access Instructions (Concealed until driver booking confirmed)
                </label>
                <input className="input-field" value={newAccess} onChange={(e) => setNewAccess(e.target.value)} placeholder="e.g. Gate code #1234, charger is near parking bay 2" required />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setNewChargerModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Publish Listing</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
        marginTop: 'auto'
      }}>
        ChargeNeighbor © 2026. Peer-to-Peer Community EV Charging Network. Built according to PRD v1.0.
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ChargeNeighborApp />
    </AuthProvider>
  );
}
