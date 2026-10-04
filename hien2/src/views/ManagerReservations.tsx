import React, { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { ReservationCard } from "../components/reservations/ReservationCard";
import { ReservationStatus } from "../types";

export const ManagerReservations: React.FC = () => {
  const { currentAccessPoint, reservations, openChatForReservation } = useApp();
  const [filter, setFilter] = useState<ReservationStatus | "ALL">("ALL");

  const apReservations = reservations.filter(
    (r) => r.accessPointId === currentAccessPoint.id
  );

  const filteredReservations = apReservations.filter((r) => {
    if (filter !== "ALL" && r.status !== filter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-1">
        <span className="text-xs font-mono font-semibold text-slate-500">
          {currentAccessPoint.code} · Store Counter Queue
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Active Reservations</h1>
        <p className="text-xs text-slate-500">
          Track buyer holds and advance status from hold to ready and counter handover.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        {[
          { id: "ALL", label: "All Holds" },
          { id: "RESERVED", label: "Reserved" },
          { id: "READY_FOR_PICKUP", label: "Ready for Pickup" },
          { id: "COMPLETED", label: "Completed" }
        ].map((tab) => {
          const count =
            tab.id === "ALL"
              ? apReservations.length
              : apReservations.filter((r) => r.status === tab.id).length;
          const isActive = filter === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as ReservationStatus | "ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-slate-900 text-white font-semibold shadow-xs"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Reservations List */}
      {filteredReservations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
          <CalendarCheck className="w-10 h-10 mx-auto text-slate-300" />
          <h3 className="font-semibold text-sm text-slate-800">No reservations yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            When nearby buyers within 3 km reserve items from your local shelf, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReservations.map((res) => (
            <ReservationCard
              key={res.id}
              reservation={res}
              onContact={() => openChatForReservation(res.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
