import React from "react";
import {
  MapPin,
  MessageSquare,
  CheckCircle2,
  Clock,
  Phone,
  ChevronRight
} from "lucide-react";
import { Reservation } from "../../types";
import { useApp } from "../../context/AppContext";

interface Props {
  reservation: Reservation;
  onViewProduct?: (productId: string) => void;
  onContact?: () => void;
}

export const ReservationCard: React.FC<Props> = ({
  reservation,
  onViewProduct,
  onContact
}) => {
  const {
    role,
    accessPoints,
    updateReservationStatus,
    openChatForReservation,
    setSelectedProductId,
    startMockCall
  } = useApp();

  const ap = accessPoints.find((a) => a.id === reservation.accessPointId) || accessPoints[0];

  const handleStatusAdvance = () => {
    if (reservation.status === "RESERVED") {
      updateReservationStatus(reservation.id, "READY_FOR_PICKUP");
    } else if (reservation.status === "READY_FOR_PICKUP") {
      updateReservationStatus(reservation.id, "COMPLETED");
    }
  };

  const handleOpenChat = () => {
    if (onContact) {
      onContact();
    } else {
      openChatForReservation(reservation.id);
    }
  };

  const handleStartCall = () => {
    if (role === "manager") {
      startMockCall({
        name: reservation.buyerName,
        subtitle: `Buyer for ${reservation.productName}`,
        role: "buyer",
        phone: reservation.buyerPhone || "+91 98405 99887"
      });
    } else {
      startMockCall({
        name: ap.name,
        subtitle: ap.address,
        role: "manager",
        phone: ap.phone || "+91 98401 23456",
        accessPointCode: ap.code
      });
    }
  };

  const getStatusBadge = () => {
    switch (reservation.status) {
      case "RESERVED":
        return (
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
            Reserved
          </span>
        );
      case "READY_FOR_PICKUP":
        return (
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200">
            Ready for Pickup
          </span>
        );
      case "COMPLETED":
        return (
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Completed
          </span>
        );
      case "CANCELLED":
        return (
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <span className="text-[11px] font-mono text-slate-500 font-semibold">
            {reservation.productSku}
          </span>
        </div>

        <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(reservation.reservedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </span>
      </div>

      {/* Body: Thumbnail, Name, Price, Location */}
      <div className="flex items-start gap-3">
        <img
          src={reservation.productImageUrl}
          alt={reservation.productName}
          className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
        />

        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-semibold text-sm text-slate-900 truncate">
            {reservation.productName}
          </h3>

          <p className="text-sm font-bold text-slate-900">
            ₹{reservation.productPrice.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-normal text-slate-500">Open-box price</span>
          </p>

          <p className="text-xs text-slate-600 flex items-start gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="truncate">
              <strong>{ap.name}</strong> · {ap.address}
            </span>
          </p>

          {role === "manager" && (
            <p className="text-xs text-slate-500 pt-0.5">
              Buyer: <strong>{reservation.buyerName}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenChat}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
            <span>Chat</span>
          </button>

          <button
            onClick={handleStartCall}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            title="Call"
            aria-label="Call"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
        </div>

        <div>
          {role === "manager" ? (
            <>
              {reservation.status === "RESERVED" && (
                <button
                  onClick={handleStatusAdvance}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  Mark Ready
                </button>
              )}
              {reservation.status === "READY_FOR_PICKUP" && (
                <button
                  onClick={handleStatusAdvance}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Handover (Sold)</span>
                </button>
              )}
              {reservation.status === "COMPLETED" && (
                <span className="text-xs font-mono text-slate-500 font-medium">✓ Handed Over</span>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                setSelectedProductId(reservation.productId);
                if (onViewProduct) onViewProduct(reservation.productId);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
