import React from "react";
import { User, MapPin, Store, CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";

export const BuyerProfile: React.FC = () => {
  const { user, reservations, switchRole } = useApp();

  const totalHolds = reservations.filter(
    (r) => r.buyerId === user.id || r.buyerName === user.name
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
          <User className="w-7 h-7 text-cyan-400" />
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-700 font-bold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
            Verified Local Buyer
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{user.name}</h1>
          <p className="text-xs text-slate-500 font-mono">Central Chennai Discovery Zone</p>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100 pb-2">
          Account Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Name</span>
            <p className="font-semibold text-slate-900">{user.name}</p>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Email</span>
            <p className="font-medium text-slate-800">{user.email}</p>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Phone</span>
            <p className="font-mono text-slate-800">{user.phone}</p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-slate-400 block mb-0.5 font-medium">Saved Address</span>
            <p className="font-medium text-slate-800">{user.address || "No address saved"}</p>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Total Holds</span>
            <p className="font-semibold text-emerald-700">{totalHolds} orders</p>
          </div>
        </div>
      </div>

      {/* Geofence notice */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2 text-xs">
        <div className="flex items-center gap-2 text-slate-900 font-semibold">
          <MapPin className="w-4 h-4 text-cyan-600" />
          <span>Hyperlocal Discovery Zone: 3.0 km Radius</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          Open-box products verified at nearby partner Access Points in Teynampet, T. Nagar, and
          Cathedral Road appear automatically in your feed for direct in-person inspection.
        </p>
      </div>

      {/* Switch role demo card */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-slate-600">Want to test the store verification workflow?</span>
        <button
          onClick={() => switchRole("manager")}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Store className="w-3.5 h-3.5" />
          <span>Switch to Store Manager</span>
        </button>
      </div>
    </div>
  );
};
