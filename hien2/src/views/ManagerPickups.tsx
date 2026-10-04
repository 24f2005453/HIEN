import React, { useState } from "react";
import {
  Truck,
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ShieldCheck,
  User,
  ArrowRight
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { ReturnOrder, PickupStatus } from "../types";

export const ManagerPickups: React.FC = () => {
  const {
    currentAccessPoint,
    returnOrders,
    acceptPickupRequest,
    advancePickupStatus,
    openChatForReturn,
    startMockCall,
    setManagerTab
  } = useApp();

  const apReturnOrders = returnOrders.filter(
    (order) => order.accessPointId === currentAccessPoint.id
  );

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    apReturnOrders[0]?.id || "RET-1042"
  );

  const activeOrder = apReturnOrders.find((o) => o.id === selectedOrderId) || apReturnOrders[0];

  const getStatusBadge = (status: PickupStatus) => {
    switch (status) {
      case "RETURN_REQUESTED":
        return {
          label: "Request Received",
          bg: "bg-amber-100 text-amber-800 border-amber-200"
        };
      case "LOCATION_SHARED":
        return {
          label: "Live Location Shared",
          bg: "bg-cyan-100 text-cyan-800 border-cyan-200"
        };
      case "PICKUP_ACCEPTED":
      case "PICKUP_ASSIGNED":
        return {
          label: "Partner Assigned",
          bg: "bg-cyan-100 text-cyan-800 border-cyan-200"
        };
      case "PICKUP_IN_PROGRESS":
      case "ARRIVING":
        return {
          label: "Courier En-Route",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200"
        };
      case "PRODUCT_COLLECTED":
        return {
          label: "Collected · At Hub",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200"
        };
      case "COMPLETED":
        return {
          label: "Completed & Refunded",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200"
        };
      default:
        return {
          label: status.replace(/_/g, " "),
          bg: "bg-slate-100 text-slate-700 border-slate-200"
        };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Top Header Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Access Point Logistics
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {currentAccessPoint.code} · {currentAccessPoint.name}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Doorstep Return Pickups
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage incoming return requests, assign hyper-local runners, and inspect collected items.
          </p>
        </div>

        {/* Scan Return button */}
        <button
          onClick={() => setManagerTab("scan")}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs shrink-0"
        >
          <QrCode className="w-4 h-4" />
          <span>Scan Arrived Item</span>
        </button>
      </div>

      {/* Main Grid: Orders list & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Orders list */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Active Requests ({apReturnOrders.length})
          </h2>

          <div className="space-y-2.5">
            {apReturnOrders.map((order) => {
              const isSelected = order.id === selectedOrderId;
              const badge = getStatusBadge(order.status);
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer bg-white ${
                    isSelected
                      ? "border-emerald-600 shadow-xs ring-1 ring-emerald-500/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={order.productImageUrl}
                      alt={order.productName}
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400">
                          #{order.id}
                        </span>
                        <span
                          className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.2 rounded border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <h4 className="font-semibold text-xs text-slate-900 truncate">
                        {order.productName}
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        Returner: <strong>{order.returnerName}</strong>
                      </p>
                      <p className="text-xs font-bold text-emerald-600">
                        Refund: ₹{order.refundAmount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Order Management Panel */}
        {activeOrder && (
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-4">
                <img
                  src={activeOrder.productImageUrl}
                  alt={activeOrder.productName}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-xs"
                />
                <div>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    Order #{activeOrder.id} · {activeOrder.orderNumber}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {activeOrder.productName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    SKU: {activeOrder.productSku} · Refund: ₹
                    {activeOrder.refundAmount.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div>
                <span
                  className={`text-xs font-mono uppercase font-bold px-3 py-1 rounded-full border ${
                    getStatusBadge(activeOrder.status).bg
                  }`}
                >
                  {getStatusBadge(activeOrder.status).label}
                </span>
              </div>
            </div>

            {/* Returner & Courier Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Returner Details */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-mono text-[10px] font-bold text-slate-500 uppercase block">
                  Returner Details
                </span>
                <p className="font-bold text-slate-900 text-sm">{activeOrder.returnerName}</p>
                <p className="text-slate-600 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeOrder.returnerPhone}</span>
                </p>
                <p className="text-slate-600 flex items-start gap-1.5 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{activeOrder.pickupAddress}</span>
                </p>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() =>
                      startMockCall({
                        name: activeOrder.returnerName,
                        subtitle: "Return Customer",
                        role: "buyer",
                        phone: activeOrder.returnerPhone
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </button>

                  <button
                    onClick={() => openChatForReturn(activeOrder.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Chat</span>
                  </button>
                </div>
              </div>

              {/* Courier Partner Info */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-mono text-[10px] font-bold text-slate-500 uppercase block">
                  Assigned Courier Partner
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  {activeOrder.pickupPersonName || "Courier Raj"}
                </p>
                <p className="text-slate-600">
                  Vehicle: <strong>{activeOrder.vehicleNumber || "TN-09-AX-4412"}</strong>
                </p>
                <p className="text-slate-600 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeOrder.pickupPersonPhone || "+91 98409 88776"}</span>
                </p>

                <div className="pt-2 flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                    Live GPS Linked
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ETA: ~{activeOrder.etaMinutes || 8} min
                  </span>
                </div>
              </div>
            </div>

            {/* Manager Lifecycle Actions */}
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
              <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Manage Reverse Logistics Workflow
              </span>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {activeOrder.status === "RETURN_REQUESTED" ||
                activeOrder.status === "LOCATION_SHARED" ? (
                  <button
                    onClick={() => acceptPickupRequest(activeOrder.id)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Accept Pickup & Dispatch Courier Raj</span>
                  </button>
                ) : null}

                {activeOrder.status === "PICKUP_IN_PROGRESS" ||
                activeOrder.status === "PICKUP_ACCEPTED" ? (
                  <button
                    onClick={() => advancePickupStatus(activeOrder.id, "PRODUCT_COLLECTED")}
                    className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Item Collected from Doorstep</span>
                  </button>
                ) : null}

                {activeOrder.status === "PRODUCT_COLLECTED" ? (
                  <button
                    onClick={() => setManagerTab("scan")}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Verify at AI Optical Gate & Settle</span>
                  </button>
                ) : null}

                <button
                  onClick={() => advancePickupStatus(activeOrder.id, "COMPLETED")}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
