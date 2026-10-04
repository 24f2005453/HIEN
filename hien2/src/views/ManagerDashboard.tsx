import React from "react";
import {
  Store,
  MapPin,
  QrCode,
  Package,
  CalendarCheck,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Truck,
  Tag,
  TrendingUp
} from "lucide-react";
import { useApp } from "../context/AppContext";

export const ManagerDashboard: React.FC = () => {
  const {
    currentAccessPoint,
    setManagerTab,
    products,
    reservations,
    returnOrders,
    user
  } = useApp();

  const apProducts = products.filter((p) => p.accessPointId === currentAccessPoint.id);
  const availableCount = apProducts.filter((p) => p.status === "AVAILABLE").length;
  const reservedCount = apProducts.filter((p) => p.status === "RESERVED").length;
  const soldCount = apProducts.filter((p) => p.status === "SOLD").length;
  const mismatchCount = apProducts.filter((p) => p.isMismatchReturn).length;
  const totalVerified = apProducts.length + 4;

  const activePickupsCount = returnOrders.filter(
    (r) =>
      r.accessPointId === currentAccessPoint.id &&
      (r.status === "PICKUP_IN_PROGRESS" ||
        r.status === "PICKUP_ASSIGNED" ||
        r.status === "LOCATION_SHARED")
  ).length;

  const firstName = user.name.split(" ")[0] || "Manager";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Top Welcome & Access Point Status (Section 12) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold">
              Good morning, {firstName}
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Active Hub
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {currentAccessPoint.name}
          </h1>

          <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {currentAccessPoint.code} · {currentAccessPoint.address}
            </span>
          </p>
        </div>

        {/* Priority Actions: Scan Return & Pickups */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setManagerTab("pickups")}
            className="px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Truck className="w-4 h-4 text-cyan-600" />
            <span>Pickups ({activePickupsCount})</span>
          </button>

          <button
            onClick={() => setManagerTab("scan")}
            className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan New Return</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5 Compact Statistics (Section 7 & 12: Verified, Available, Reserved, Sold, Mismatch) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Verified */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block mb-1">Verified</span>
          <p className="text-2xl font-bold text-slate-900">{totalVerified}</p>
          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">Returns Verified</span>
        </div>

        {/* Available */}
        <div
          onClick={() => setManagerTab("inventory")}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-300 transition-colors cursor-pointer"
        >
          <span className="text-xs text-slate-500 font-medium block mb-1">Available</span>
          <p className="text-2xl font-bold text-emerald-600">{availableCount}</p>
          <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">3 km Shelf Ready</span>
        </div>

        {/* Reserved */}
        <div
          onClick={() => setManagerTab("reservations")}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-amber-300 transition-colors cursor-pointer"
        >
          <span className="text-xs text-slate-500 font-medium block mb-1">Reserved</span>
          <p className="text-2xl font-bold text-amber-600">{reservedCount}</p>
          <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">Awaiting Collection</span>
        </div>

        {/* Sold */}
        <div
          onClick={() => setManagerTab("inventory")}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs"
        >
          <span className="text-xs text-slate-500 font-medium block mb-1">Sold</span>
          <p className="text-2xl font-bold text-slate-900">{soldCount}</p>
          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">Delivered Locally</span>
        </div>

        {/* New Metric: Mismatch Returns (Section 7) */}
        <div
          onClick={() => setManagerTab("inventory")}
          className="bg-white rounded-xl border border-amber-200 p-4 shadow-xs hover:border-amber-300 transition-colors cursor-pointer bg-amber-50/20 col-span-2 sm:col-span-1"
        >
          <span className="text-xs text-amber-800 font-medium block mb-1">Mismatch Returns</span>
          <p className="text-2xl font-bold text-amber-600">{mismatchCount}</p>
          <span className="text-[11px] text-amber-800 font-medium mt-0.5 block">AI Verified Mismatches</span>
        </div>
      </div>

      {/* Main Grid: Recent Activity & Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* RECENT ACTIVITY (Section 7 & 12) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent Activity
            </h2>
            <span className="text-xs font-mono text-slate-400">Live shelf feed</span>
          </div>

          <div className="divide-y divide-slate-100">
            {/* New Activity: Mismatched Return (Section 7) */}
            <div className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">Adidas Running Shoes</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                      Mismatch Return
                    </span>
                  </div>
                  <p className="text-slate-500">
                    AI verified at 96% · Original barcode: Nike Air Zoom
                  </p>
                </div>
              </div>
              <span className="text-slate-400 font-mono">5 min ago</span>
            </div>

            {/* Nike Air Zoom */}
            <div className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">Nike Air Zoom</p>
                  <p className="text-slate-500">Reserved by Rahul · Order hold confirmed</p>
                </div>
              </div>
              <span className="text-slate-400 font-mono">12 min ago</span>
            </div>

            {/* JBL Speaker */}
            <div className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">JBL Flip 6 Speaker</p>
                  <p className="text-slate-500">Sold · Handover completed at counter</p>
                </div>
              </div>
              <span className="text-slate-400 font-mono">28 min ago</span>
            </div>
          </div>
        </div>

        {/* Hyperlocal Radius Details */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
            Local Operations Hub
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Active Pickup Requests</span>
              <strong className="text-cyan-700 font-mono">{activePickupsCount} pending</strong>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Mismatch Acceptance Rate</span>
              <strong className="text-slate-900 font-mono">100% (High Confidence)</strong>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Freight Saved</span>
              <strong className="text-emerald-700 font-mono">142 km / week</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <button
              onClick={() => setManagerTab("pickups")}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-cyan-400" />
              <span>View Live Courier Pickups</span>
            </button>
            <button
              onClick={() => setManagerTab("inventory")}
              className="w-full py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span>Shelf Catalog</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
