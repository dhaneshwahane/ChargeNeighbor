import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { chargerService } from '../services/chargerService';
import { Charger } from '../types';
import { 
  Zap, MapPin, ShieldCheck, Star, Clock, CheckCircle2, 
  AlertCircle, ArrowLeft, ArrowRight, DollarSign, BatteryCharging 
} from 'lucide-react';

export const ChargerDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [charger, setCharger] = useState<Charger | null>(null);
  const [loading, setLoading] = useState(true);

  // Estimator calculator state
  const [kwhNeeded, setKwhNeeded] = useState<number>(20);

  useEffect(() => {
    if (id) {
      chargerService.getChargerById(id).then(({ data }) => {
        setCharger(data);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Zap className="w-8 h-8 text-brand-700 animate-pulse mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading charger specifications...</p>
        </div>
      </div>
    );
  }

  if (!charger) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center bg-white p-8 rounded-2xl border border-slate-200">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <h2 className="text-base font-bold text-slate-900">Charger Not Found</h2>
          <Link to="/" className="text-xs text-brand-700 font-semibold mt-3 inline-block">Return to Map</Link>
        </div>
      </div>
    );
  }

  // Cost formula according to PRD section 9
  const energyCost = kwhNeeded * charger.price_per_kwh;
  const platformFee = Math.max(20, energyCost * 0.10);
  const gstTax = (energyCost + platformFee) * 0.18;
  const totalCost = energyCost + platformFee + gstTax;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Breadcrumb Back */}
        <button 
          onClick={() => navigate(-1)} 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </button>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800 text-[11px] font-bold">
                  {charger.connector_type}
                </span>
                {charger.verification_level ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" /> Level {charger.verification_level} Verified Host
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{charger.name}</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-slate-400" />
                {charger.area_description || 'Neighborhood residential location'}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium block">CHARGING RATE</span>
              <span className="text-2xl font-black text-brand-700">₹{charger.price_per_kwh}</span>
              <span className="text-xs text-slate-500"> / kWh</span>
            </div>
          </div>

          {/* Technical Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-slate-100 text-center">
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-semibold block">MAX POWER</span>
              <span className="text-lg font-extrabold text-slate-900">{charger.power_kw} kW</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-semibold block">CONNECTOR</span>
              <span className="text-lg font-extrabold text-slate-900">{charger.connector_type}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-semibold block">RATING</span>
              <span className="text-lg font-extrabold text-amber-500 flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-amber-400" /> {charger.host_rating || '5.0'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-semibold block">STATUS</span>
              <span className="text-lg font-extrabold text-brand-700 capitalize">Active</span>
            </div>
          </div>

          {/* Cost Calculator Breakdown */}
          <div className="py-6 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-brand-700" /> Transparent Pre-Booking Cost Estimator
            </h3>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                <span>Select Target Energy Needed:</span>
                <span className="font-extrabold text-brand-700">{kwhNeeded} kWh</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={kwhNeeded}
                onChange={(e) => setKwhNeeded(parseInt(e.target.value))}
                className="w-full accent-brand-700 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>5 kWh</span>
                <span>30 kWh</span>
                <span>60 kWh</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Energy Cost ({kwhNeeded} kWh &times; ₹{charger.price_per_kwh})</span>
                <span className="font-medium">₹{energyCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Platform Fee (10%, min ₹20)</span>
                <span className="font-medium">₹{platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST Tax (18%)</span>
                <span className="font-medium">₹{gstTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                <span>Estimated Total (INR)</span>
                <span className="text-brand-700">₹{totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Access & Privacy Notice */}
          <div className="py-6 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Host Access & Privacy Policy</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              To protect residential homeowners, exact parking bay numbers, access gate codes, and host telephone numbers are kept private and revealed automatically immediately upon booking confirmation.
            </p>
          </div>

          {/* Reserve CTA */}
          <div className="pt-6 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Ready to charge?</span>
              <span className="text-sm font-bold text-slate-800">Guaranteed slot prevention against double-booking</span>
            </div>
            <Link
              to={`/book/${charger.id}`}
              className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-800 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md transition"
            >
              <span>Reserve Charging Slot</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
};
