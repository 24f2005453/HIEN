import React, { useState } from "react";
import {
  User,
  Store,
  MapPin,
  Edit3,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { UpdateAddressModal } from "../components/manager/UpdateAddressModal";

export const ManagerProfile: React.FC = () => {
  const { user, currentAccessPoint } = useApp();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
            <Store className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono font-bold text-slate-500">
                {currentAccessPoint.code}
              </span>
              <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Active Partner
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {currentAccessPoint.name}
            </h1>
            <p className="text-xs text-slate-500">Verified Access Point Hub</p>
          </div>
        </div>

        <button
          onClick={() => setIsEditModalOpen(true)}
          className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Edit3 className="w-4 h-4 text-slate-500" />
          <span>Edit Location</span>
        </button>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manager Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
          <h2 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100 pb-2">
            Manager Information
          </h2>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Full Name</span>
              <p className="font-semibold text-slate-900">{user.name}</p>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Role</span>
              <p className="font-semibold text-emerald-700">Access Point Manager</p>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Email</span>
              <p className="font-medium text-slate-800">{user.email}</p>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Phone</span>
              <p className="font-mono text-slate-800">{user.phone}</p>
            </div>
          </div>
        </div>

        {/* Store Location */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-500">
              Broadcasted Pickup Location
            </h2>
            <span className="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Synced with Buyers
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Facility Name</span>
              <p className="font-semibold text-slate-900">{currentAccessPoint.name}</p>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Physical Address</span>
              <p className="font-medium text-slate-800 leading-relaxed">{currentAccessPoint.address}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <div>
                <span className="text-slate-400 block font-medium">Coordinates</span>
                <p className="font-mono text-slate-700 text-[11px]">
                  {currentAccessPoint.latitude}, {currentAccessPoint.longitude}
                </p>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Pincode</span>
                <p className="font-mono text-slate-700 text-[11px]">{currentAccessPoint.pincode}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UpdateAddressModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
};
