import React, { useEffect, useState } from 'react';
import { chargerService } from '../services/chargerService';
import { Booking } from '../types';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

export const MyBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'active' | 'completed' | 'cancelled'>('upcoming');
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await chargerService.getMyBookings();
      setBookings(res.data);
    } catch {
      // Mock local fallback
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'upcoming') return b.status === 'confirmed' || b.status === 'pending';
    if (activeTab === 'active') return b.status === 'active';
    if (activeTab === 'completed') return b.status === 'completed';
    if (activeTab === 'cancelled') return b.status?.includes('cancel') || b.status === 'expired';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">My Charging Bookings</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Review scheduled sessions, secret access pins, and receipts.</p>
          </div>
          <button
            onClick={fetchBookings}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6 gap-6 text-xs font-bold text-slate-500">
          {(['upcoming', 'active', 'completed', 'cancelled'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 capitalize transition border-b-2 ${
                activeTab === tab 
                  ? 'border-brand-700 text-brand-700' 
                  : 'border-transparent hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">Loading bookings...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No {activeTab} bookings</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">When you reserve a neighborhood charging slot, it will appear right here.</p>
            <Link
              to="/"
              className="inline-flex bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition"
            >
              Browse Nearby Chargers
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">REF: #{b.id?.slice(0, 8)}</span>
                    <h3 className="font-bold text-base text-slate-900 mt-0.5">{b.charger_title || 'Residential Station'}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(b.start_time).toLocaleDateString()} at {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full uppercase bg-brand-50 text-brand-800 border border-brand-200 text-[10px]">
                      {b.status}
                    </span>
                    <div className="text-base font-black text-slate-900 mt-2">
                      ₹{b.est_total_rupees || (b.est_total_paise ? (b.est_total_paise / 100).toFixed(2) : '350.00')}
                    </div>
                  </div>
                </div>

                {/* Confirmed Access Details (PRD Requirement: exact details revealed once confirmed) */}
                {b.access_instructions && (
                  <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 rounded-xl text-xs text-emerald-900 mt-3">
                    <div className="font-bold flex items-center gap-1 text-[11px] mb-1 text-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5" /> Confirmed Host Access Info:
                    </div>
                    <div>{b.access_instructions}</div>
                    {b.charger_address && (
                      <div className="text-[11px] text-emerald-700 mt-1">Address: {b.charger_address}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
