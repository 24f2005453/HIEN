import React from "react";
import {
  MapPin,
  Store,
  ShoppingBag,
  Warehouse,
  LogOut,
  Bell,
  UserCheck
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { HienLogo } from "./HienLogo";

export const Header: React.FC = () => {
  const {
    role,
    switchRole,
    logout,
    currentAccessPoint,
    managerTab,
    setManagerTab,
    buyerTab,
    setBuyerTab,
    reservations
  } = useApp();

  const pendingReservationsCount = reservations.filter(
    (r) => r.status === "RESERVED" && (role === "manager" ? r.accessPointId === currentAccessPoint.id : true)
  ).length;

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B1220] border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* LEFT: HIEN minimal geometric wordmark */}
        <div className="flex items-center gap-6">
          <HienLogo variant="light" size="md" />

          {/* Desktop in-header location indicator */}
          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-800 text-xs text-slate-300">
            {role === "manager" ? (
              <>
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-white">{currentAccessPoint.name}</span>
                <span className="font-mono text-emerald-400 text-[10px] px-1 py-0.2 rounded bg-slate-800">
                  {currentAccessPoint.code}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 truncate max-w-[130px]">{currentAccessPoint.area}</span>
              </>
            ) : role === "buyer" ? (
              <>
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-white">Hyperlocal Radius</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                  3.0 km
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">Chennai</span>
              </>
            ) : (
              <>
                <Warehouse className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-white">Central Warehouse</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                  RETURNS
                </span>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Role Switcher, Alerts, Profile, Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Subtle Role Toggle */}
          <div className="flex items-center bg-[#111A2E] p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => switchRole("manager")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                role === "manager"
                  ? "bg-emerald-600 text-white shadow-xs font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Access Point Manager View"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Manager</span>
            </button>
            <button
              onClick={() => switchRole("buyer")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                role === "buyer"
                  ? "bg-emerald-600 text-white shadow-xs font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Nearby Buyer View"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Buyer</span>
            </button>
            <button
              onClick={() => switchRole("warehouse")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                role === "warehouse"
                  ? "bg-cyan-700 text-white shadow-xs font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Central Warehouse Operations"
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Warehouse</span>
            </button>
          </div>

          {/* Pending Alerts */}
          {role !== "warehouse" && <button
            onClick={() => {
              if (role === "manager") setManagerTab("reservations");
              else setBuyerTab("reservations");
            }}
            className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Pending Reservations"
          >
            <Bell className="w-4 h-4" />
            {pendingReservationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>}

          {/* Profile */}
          {role !== "warehouse" && <button
            onClick={() => {
              if (role === "manager") setManagerTab("profile");
              else setBuyerTab("profile");
            }}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Account Profile"
          >
            <UserCheck className="w-4 h-4" />
          </button>}

          {/* Logout */}
          <button
            onClick={logout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
