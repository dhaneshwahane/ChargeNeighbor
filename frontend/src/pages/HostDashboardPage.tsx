import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { DollarSign, ShieldCheck, CheckCircle2, AlertTriangle, Calendar, Star } from 'lucide-react';

export const HostDashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [chargers, setChargers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHostData = async () => {
      try {
        const token = localStorage.getItem('chargeneighbor_token');
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const [sumRes, chRes] = await Promise.all([
          axios.get(`${API_BASE}/api/v1/host/dashboard/summary`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE}/api/v1/host/chargers`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setSummary(sumRes.data);
        setChargers(chRes.data);
      } catch {
        // Fallback demo state
        setSummary({
          month_earnings_rupees: 4250.00,
          reliability_score_pct: 98.2,
          upcoming_count: 3
        });
      } finally {
        setLoading(false);
      }
    };
    fetchHostData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Host Operations & Analytics</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Monitor upcoming charging sessions, payout balances, and reliability.</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Earnings This Month</span>
            <div className="text-2xl font-black text-brand-700 mt-1">₹{summary?.month_earnings_rupees || '0.00'}</div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Simulated escrow payout</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Host Reliability Score</span>
            <div className="text-2xl font-black text-blue-600 mt-1">{summary?.reliability_score_pct || '100'}%</div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Bayesian completion calculation</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Upcoming Bookings</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{summary?.upcoming_count || '0'}</div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Slots booked this week</span>
          </div>
        </div>

        {/* My Chargers */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4">Your Active Charger Listings</h2>
          {chargers.length === 0 ? (
            <p className="text-xs text-slate-400">No chargers listed under this account yet.</p>
          ) : (
            <div className="space-y-3">
              {chargers.map(ch => (
                <div key={ch.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{ch.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{ch.address} • {ch.power_kw} kW • ₹{(ch.price_per_kwh_paise / 100).toFixed(2)}/kWh</p>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-brand-800">
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
