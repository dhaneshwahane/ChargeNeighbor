import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { chargerService } from '../services/chargerService';
import { Charger } from '../types';
import { useAuth } from '../context/AuthContext';
import { Zap, Calendar, Clock, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';

export const BookingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [charger, setCharger] = useState<Charger | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>('14:00 - 16:00');
  const [kwhAmount, setKwhAmount] = useState<number>(20);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

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
        <Zap className="w-8 h-8 text-brand-700 animate-pulse" />
      </div>
    );
  }

  if (!charger) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-6 rounded-2xl border text-center">
          <p>Charger not found.</p>
        </div>
      </div>
    );
  }

  const timeSlots = [
    '08:00 - 10:00',
    '10:00 - 12:00',
    '12:00 - 14:00',
    '14:00 - 16:00',
    '16:00 - 18:00',
    '18:00 - 20:00',
    '20:00 - 22:00'
  ];

  // Pricing math
  const energyCost = kwhAmount * charger.price_per_kwh;
  const platformFee = Math.max(20, energyCost * 0.10);
  const total = (energyCost + platformFee) * 1.18;

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!user) {
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    try {
      const [startHourStr] = selectedSlot.split(' - ')[0].split(':');
      const [endHourStr] = selectedSlot.split(' - ')[1].split(':');

      const start = new Date(`${selectedDate}T${startHourStr.padStart(2, '0')}:00:00`);
      const end = new Date(`${selectedDate}T${endHourStr.padStart(2, '0')}:00:00`);

      const res = await chargerService.createBooking({
        charger_id: charger.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        requested_kwh: kwhAmount,
      });

      setConfirmedBooking(res.data);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setErrorMessage('This time slot is already taken by another driver. Please pick another slot.');
      } else {
        setErrorMessage(err.response?.data?.detail || 'Unable to reserve charging slot. Please try again.');
      }
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
          <ArrowLeft className="w-4 h-4" /> Back to Charger
        </button>

        {confirmedBooking ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm">
            <div className="w-14 h-14 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Booking Confirmed</span>
            <h1 className="text-2xl font-black text-slate-900 mt-1 mb-2">Slot Reserved Successfully!</h1>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              Your reservation reference is #{confirmedBooking.id?.slice(0, 8)}. A receipt and access instructions have been saved.
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2 mb-6 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Charger</span>
                <span className="font-bold text-slate-800">{charger.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Slot</span>
                <span className="font-bold text-slate-800">{selectedDate} ({selectedSlot})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated Total</span>
                <span className="font-bold text-brand-700">₹{total.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-brand-800 font-semibold block mb-1">Access Instructions:</span>
                <span className="text-slate-700">{charger.access_instructions || 'Gate code: #2044. Dedicated EV charging spot.'}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Link
                to="/bookings"
                className="bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow-sm"
              >
                Go to My Bookings
              </Link>
              <Link
                to="/"
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-6 py-2.5 rounded-xl transition"
              >
                Explore More Chargers
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm">
            
            <div className="mb-6 pb-6 border-b border-slate-100">
              <span className="text-xs font-bold text-brand-700 uppercase tracking-wider">Step 2 of 2</span>
              <h1 className="text-2xl font-black text-slate-900 mt-1">Reserve Charging Slot</h1>
              <p className="text-xs text-slate-500 mt-1">
                Reserving at <span className="font-semibold text-slate-800">{charger.name}</span> • ₹{charger.price_per_kwh}/kWh
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleConfirmReservation} className="space-y-6">
              
              {/* Date selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                  required
                />
              </div>

              {/* Time Slots */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Select Available Time Slot</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition ${
                        selectedSlot === slot
                          ? 'bg-brand-700 text-white border-brand-700 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy requirement */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Estimated Energy: <span className="text-brand-700">{kwhAmount} kWh</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={kwhAmount}
                  onChange={(e) => setKwhAmount(parseInt(e.target.value))}
                  className="w-full accent-brand-700 cursor-pointer"
                />
              </div>

              {/* Cost Summary Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Energy Cost</span>
                  <span>₹{energyCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Service & Platform Fee</span>
                  <span>₹{platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST Tax (18%)</span>
                  <span>₹{((energyCost + platformFee) * 0.18).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 text-sm pt-2 border-t border-slate-200">
                  <span>Total Due (Simulated Auth)</span>
                  <span className="text-brand-700">₹{total.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold text-sm py-3.5 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying Slot & Authorizing...' : `Confirm Reservation • ₹${total.toFixed(2)}`}
              </button>

            </form>

          </div>
        )}

      </div>
    </div>
  );
};
