import React from "react";
import { Phone, PhoneOff, Store, User } from "lucide-react";
import { useApp } from "../../context/AppContext";

export const MockCallModal: React.FC = () => {
  const { callState, endMockCall } = useApp();

  if (!callState.isActive || !callState.target) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 text-center text-slate-900 shadow-xl border border-slate-200 space-y-4">
        {/* Circular Store Icon (Section 36) */}
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
          {callState.target.role === "buyer" ? (
            <User className="w-8 h-8" />
          ) : (
            <Store className="w-8 h-8" />
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900">{callState.target.name}</h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            {callState.target.accessPointCode || "Direct Voice Relay"}
          </p>
          <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Calling...</span>
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={endMockCall}
            className="w-full py-3 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
