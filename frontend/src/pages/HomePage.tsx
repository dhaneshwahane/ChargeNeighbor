import React, { useState, useEffect } from 'react';
import { ChargerMap } from '../components/map/ChargerMap';
import { chargerService } from '../services/chargerService';
import { Charger } from '../types';
import { Link } from 'react-router-dom';
import { 
  Zap, Star, ShieldCheck, MapPin, Navigation, SlidersHorizontal, 
  ArrowRight, CheckCircle2, AlertCircle, Info, Sparkles 
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemoData, setIsDemoData] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  // Filters state
  const [connectorFilter, setConnectorFilter] = useState<string>('all');
  const [speedFilter, setSpeedFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('distance');

  // Load nearby chargers (defaults around Nagpur / Bengaluru)
  const fetchChargers = async (lat: number = 21.1458, lng: number = 79.0882) => {
    setIsLoading(true);
    const { data, isDemo } = await chargerService.getNearbyChargers(lat, lng, 30);
    setChargers(data);
    setIsDemoData(isDemo);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchChargers();
  }, []);

  // Filter & Sort Logic
  const filteredChargers = chargers.filter(c => {
    if (connectorFilter !== 'all' && !c.connector_type.toLowerCase().includes(connectorFilter.toLowerCase())) {
      return false;
    }
    if (speedFilter === 'fast' && c.power_kw < 11) return false;
    if (speedFilter === 'standard' && c.power_kw >= 11) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'price') return a.price_per_kwh - b.price_per_kwh;
    if (sortBy === 'rating') return (b.host_rating || 0) - (a.host_rating || 0);
    return (a.distance_km || 0) - (b.distance_km || 0);
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* Demo Notice Banner (if using fallback fixture) */}
      {isDemoData && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs font-semibold text-amber-900 flex items-center justify-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Showing verified demo chargers in Nagpur, Maharashtra (simulated fixture). Real map tiles and coordinates are live.</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 text-brand-900 text-xs font-bold mb-4">
              <Sparkles className="w-3.5 h-3.5 text-brand-700" />
              Community-Powered EV Energy
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-3">
              Charge Smarter. <span className="text-brand-700">Together.</span>
            </h1>
            <p className="text-slate-600 text-base sm:text-lg mb-6 leading-relaxed">
              Find a nearby home charger, book your slot, and get back on the road. Residential charging hosts offering verified, reachable power right around the corner.
            </p>
          </div>

          {/* Quick Filter Bar */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter:
            </div>

            <select
              value={connectorFilter}
              onChange={(e) => setConnectorFilter(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            >
              <option value="all">All Connectors</option>
              <option value="Type 2">Type 2 (AC)</option>
              <option value="CCS2">CCS2 (DC / Fast AC)</option>
              <option value="Bharat">Bharat AC/DC</option>
            </select>

            <select
              value={speedFilter}
              onChange={(e) => setSpeedFilter(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            >
              <option value="all">Any Charging Power</option>
              <option value="fast">Rapid &gt; 11 kW</option>
              <option value="standard">Standard &le; 7.4 kW</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            >
              <option value="distance">Sort by Distance</option>
              <option value="price">Lowest Price</option>
              <option value="rating">Highest Rating</option>
            </select>

            <div className="ml-auto text-xs font-bold text-brand-800 bg-brand-50 px-3 py-2 rounded-xl border border-brand-200">
              {filteredChargers.length} Chargers Active
            </div>
          </div>
        </div>
      </section>

      {/* Main Two-Column Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col">
        
        {/* Mobile View Toggle */}
        <div className="flex md:hidden mb-4 bg-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setMobileView('map')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${mobileView === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Interactive Map
          </button>
          <button
            onClick={() => setMobileView('list')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${mobileView === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Charger List ({filteredChargers.length})
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[620px]">
          
          {/* Left Column: Interactive Leaflet Map (Approx 60% Width) */}
          <div className={`md:col-span-7 lg:col-span-8 flex flex-col h-[520px] md:h-[680px] ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
            <ChargerMap
              chargers={filteredChargers}
              selectedChargerId={selectedChargerId}
              onSelectCharger={(ch) => setSelectedChargerId(ch.id)}
              isLoading={isLoading}
              onLocationChange={(lat, lng) => fetchChargers(lat, lng)}
            />
          </div>

          {/* Right Column: Charger Stations List (Approx 40% Width) */}
          <div className={`md:col-span-5 lg:col-span-4 flex flex-col h-[680px] overflow-hidden ${mobileView === 'map' ? 'hidden md:flex' : 'flex'}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Stations Nearby
              </h2>
              <span className="text-xs text-slate-500 font-medium">Click to highlight on map</span>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5">
              {filteredChargers.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No matching chargers found</p>
                  <p className="text-xs text-slate-500 mt-1">Try resetting your filters or searching another neighborhood.</p>
                </div>
              ) : (
                filteredChargers.map((ch) => {
                  const isSelected = ch.id === selectedChargerId;
                  return (
                    <div
                      key={ch.id}
                      onClick={() => setSelectedChargerId(ch.id)}
                      className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                        isSelected 
                          ? 'border-brand-700 ring-2 ring-brand-700/20 bg-brand-50/20' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-sm text-slate-900 leading-snug">{ch.name}</h3>
                        {ch.verification_level ? (
                          <span className="shrink-0 flex items-center gap-0.5 bg-emerald-50 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" /> Level {ch.verification_level}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{ch.area_description || 'Residential locality'}</span>
                      </div>

                      {/* Specs badges */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block font-medium">CONNECTOR & POWER</span>
                          <span className="font-extrabold text-brand-700">{ch.power_kw} kW • {ch.connector_type}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block font-medium">PRICE PER KWH</span>
                          <span className="font-extrabold text-slate-900">₹{ch.price_per_kwh}</span>
                        </div>
                      </div>

                      {/* Distance & Status Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-3">
                          {ch.distance_km != null && (
                            <span className="text-slate-500 font-medium flex items-center gap-1">
                              <Navigation className="w-3 h-3 text-slate-400" />
                              {ch.distance_km} km
                            </span>
                          )}
                          <span className="text-amber-500 font-bold flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {ch.host_rating || 'New'}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Link
                            to={`/chargers/${ch.id}`}
                            className="text-[11px] font-semibold text-slate-600 hover:text-brand-700 px-2 py-1 rounded-lg transition"
                          >
                            Details
                          </Link>
                          <Link
                            to={`/book/${ch.id}`}
                            className="text-[11px] font-bold bg-brand-700 hover:bg-brand-800 text-white px-3 py-1.5 rounded-lg shadow-sm transition"
                          >
                            Reserve
                          </Link>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </main>

    </div>
  );
};
