import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { chargerService } from '../services/chargerService';
import { Zap, MapPin, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

const pinIcon = L.divIcon({
  className: 'host-custom-pin',
  html: `
    <div style="background-color: #15803D; width: 34px; height: 34px; border-radius: 50%; border: 3px solid #FFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
      <svg style="width: 16px; height: 16px; fill: none; stroke: #FFF; stroke-width: 2.5;" viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// Click listener to position charger pin
const LocationSelector = ({ position, setPosition }: { position: [number, number]; setPosition: (p: [number, number]) => void }) => {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return <Marker position={position} icon={pinIcon} />;
};

export const AddChargerPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [powerKw, setPowerKw] = useState('7.4');
  const [connectorType, setConnectorType] = useState('CCS2');
  const [pricePerKwh, setPricePerKwh] = useState('15');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [pinPosition, setPinPosition] = useState<[number, number]>([21.1458, 79.0882]); // Nagpur center default
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await chargerService.createChargerListing({
        title,
        address,
        city: 'Nagpur',
        latitude: pinPosition[0],
        longitude: pinPosition[1],
        connector_type: connectorType,
        power_kw: parseFloat(powerKw),
        price_per_kwh_paise: parseInt(pricePerKwh) * 100,
        booking_mode: 'instant',
        access_instructions: accessInstructions,
      });

      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to publish listing. Please make sure you are logged in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        <button 
          onClick={() => navigate(-1)} 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Cancel
        </button>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm">
          
          <div className="mb-8 pb-6 border-b border-slate-100">
            <span className="text-xs font-bold text-brand-700 uppercase tracking-wider">Host Registration</span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">List Your Home Charger</h1>
            <p className="text-xs text-slate-500 mt-1">
              Earn steady income by sharing your idle residential charger with neighborhood drivers.
            </p>
          </div>

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold mb-6">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Charger listing published successfully! Redirecting to map...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-xs font-bold mb-6">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Charger Name / Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Civil Lines Solar Powered Fast AC"
                className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Street / Locality Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Plot 18, Temple Road, Civil Lines"
                className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                required
              />
            </div>

            {/* Interactive Pin Drop Map (Section 7 requirement) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 block">Pinpoint Charger Location on Map</label>
                <span className="text-[11px] text-slate-400">Click anywhere on the map to set pin</span>
              </div>
              <div className="h-56 rounded-2xl overflow-hidden border border-slate-200">
                <MapContainer center={pinPosition} zoom={13} className="w-full h-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationSelector position={pinPosition} setPosition={setPinPosition} />
                </MapContainer>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Lat: {pinPosition[0].toFixed(4)}, Lng: {pinPosition[1].toFixed(4)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Power (kW)</label>
                <input
                  type="number"
                  step="0.1"
                  value={powerKw}
                  onChange={(e) => setPowerKw(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Connector Type</label>
                <select
                  value={connectorType}
                  onChange={(e) => setConnectorType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                >
                  <option value="CCS2">CCS2</option>
                  <option value="Type 2">Type 2</option>
                  <option value="Bharat_AC001">Bharat AC001</option>
                  <option value="CHAdeMO">CHAdeMO</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Rate (₹ / kWh)</label>
                <input
                  type="number"
                  value={pricePerKwh}
                  onChange={(e) => setPricePerKwh(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Secret Access Instructions (Private until confirmed)
              </label>
              <textarea
                value={accessInstructions}
                onChange={(e) => setAccessInstructions(e.target.value)}
                placeholder="e.g. Driveway gate code is #4088. Charger is mounted on the red brick wall."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold text-sm py-3.5 rounded-xl shadow-md transition disabled:opacity-50"
            >
              {isSubmitting ? 'Publishing Listing...' : 'Publish Charger Listing'}
            </button>

          </form>

        </div>

      </div>
    </div>
  );
};
