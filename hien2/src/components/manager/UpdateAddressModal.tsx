import React, { useState } from "react";
import { X, MapPin, Check, Save } from "lucide-react";
import { useApp } from "../../context/AppContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateAddressModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentAccessPoint, updateAccessPointAddress } = useApp();

  const [name, setName] = useState(currentAccessPoint.name);
  const [addressLine, setAddressLine] = useState(
    currentAccessPoint.address.split(",")[0] || "123 Anna Salai"
  );
  const [area, setArea] = useState(currentAccessPoint.area);
  const [city, setCity] = useState(currentAccessPoint.city);
  const [state, setState] = useState(currentAccessPoint.state);
  const [pincode, setPincode] = useState(currentAccessPoint.pincode);
  const [latitude, setLatitude] = useState(currentAccessPoint.latitude.toString());
  const [longitude, setLongitude] = useState(currentAccessPoint.longitude.toString());
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullFormatted = `${addressLine}, ${area}, ${city}, ${state} - ${pincode}`;
    updateAccessPointAddress(currentAccessPoint.id, {
      name,
      address: fullFormatted,
      area,
      city,
      state,
      pincode,
      latitude: parseFloat(latitude) || 13.0418,
      longitude: parseFloat(longitude) || 80.2341
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 shadow-xl relative space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">
              Update Access Point Location
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {savedSuccess ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Location Synced</h4>
            <p className="text-xs text-slate-500">
              Updated coordinates broadcasted to all nearby buyers.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Store / Access Point Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Address Line
              </label>
              <input
                type="text"
                required
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Area</label>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">City</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pincode</label>
                <input
                  type="text"
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">State</label>
                <input
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Location</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
