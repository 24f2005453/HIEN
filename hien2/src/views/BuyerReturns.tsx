import React, { useState } from "react";
import {
  Truck,
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Navigation as NavIcon,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Package,
  Share2
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { ReturnOrder, PickupStatus } from "../types";
import { LiveReturnMap } from "../components/buyer/LiveReturnMap";

export const BuyerReturns: React.FC = () => {
  const {
    returnOrders,
    accessPoints,
    requestReturnPickup,
    startLocationSharing,
    stopLocationSharing,
    openChatForReturn,
    startMockCall,
    advancePickupStatus
  } = useApp();

  const [activeOrderId, setActiveOrderId] = useState<string>("RET-1042");
  const [sharingLoading, setSharingLoading] = useState(false);

  const selectedOrder = returnOrders.find((r) => r.id === activeOrderId) || returnOrders[0];
  const selectedAccessPoint = selectedOrder
    ? accessPoints.find((accessPoint) => accessPoint.id === selectedOrder.accessPointId)
    : undefined;

  const handleToggleLocationSharing = async (orderId: string, currentEnabled: boolean) => {
    if (currentEnabled) {
      stopLocationSharing(orderId);
    } else {
      setSharingLoading(true);
      await startLocationSharing(orderId);
      setSharingLoading(false);
    }
  };

  const getStatusBadge = (status: PickupStatus) => {
    switch (status) {
      case "RETURN_REQUESTED":
        return {
          label: "Return Requested",
          bg: "bg-amber-100 text-amber-800 border-amber-200",
          desc: "Awaiting pickup acceptance by Access Point manager"
        };
      case "LOCATION_SHARED":
        return {
          label: "Location Shared",
          bg: "bg-cyan-100 text-cyan-800 border-cyan-200",
          desc: "Live GPS coordinates broadcast to partner AP-04"
        };
      case "PICKUP_ASSIGNED":
      case "PICKUP_ACCEPTED":
        return {
          label: "Courier Assigned",
          bg: "bg-cyan-100 text-cyan-800 border-cyan-200",
          desc: "Courier Raj assigned for doorstep collection"
        };
      case "PICKUP_IN_PROGRESS":
      case "ARRIVING":
        return {
          label: "Pickup In Progress",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          desc: "Courier Raj en-route (TN-09-AX-4412)"
        };
      case "PRODUCT_COLLECTED":
        return {
          label: "Product Collected",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          desc: "Collected from returner, delivering to AP-04"
        };
      case "COMPLETED":
        return {
          label: "Refund Complete",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          desc: "Refund settled to bank account"
        };
      default:
        return {
          label: status.replace(/_/g, " "),
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          desc: ""
        };
    }
  };

  const activeStatusInfo = selectedOrder ? getStatusBadge(selectedOrder.status) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Live Reverse Logistics
            </span>
            <span className="text-xs text-slate-400 font-mono">Chennai HyperHub</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Doorstep Return Pickups
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Request instant on-demand pickup from your local Access Point manager with live GPS tracking.
          </p>
        </div>

        {/* Access Point Info Badge */}
        <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-0.5 shrink-0">
          <span className="text-slate-400 text-[10px] font-mono uppercase font-semibold">
            Partner Access Point
          </span>
          <p className="font-bold text-slate-900">Express Electronics (AP-04)</p>
          <p className="text-slate-500 text-[11px]">Cenotaph Road, Teynampet</p>
        </div>
      </div>

      {/* Main Grid: Orders List & Detailed Live Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Return Orders List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            My Return Orders ({returnOrders.length})
          </h2>

          <div className="space-y-2.5">
            {returnOrders.map((order) => {
              const isSelected = order.id === activeOrderId;
              const badge = getStatusBadge(order.status);
              return (
                <div
                  key={order.id}
                  onClick={() => setActiveOrderId(order.id)}
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
                          {order.id} · {order.orderNumber}
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

        {/* Right Column: Active Live Pickup Details & Visual Tracking (8 cols) */}
        {selectedOrder && (
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            {/* Order Top Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-4">
                <img
                  src={selectedOrder.productImageUrl}
                  alt={selectedOrder.productName}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-xs"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-800">
                      #{selectedOrder.id}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-mono text-slate-500">
                      SKU: {selectedOrder.productSku}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {selectedOrder.productName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Refund Amount:{" "}
                    <strong className="text-emerald-700 font-bold">
                      ₹{selectedOrder.refundAmount.toLocaleString("en-IN")}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="text-right sm:self-center">
                <span
                  className={`inline-block text-xs font-mono uppercase font-bold px-3 py-1 rounded-full border ${activeStatusInfo?.bg}`}
                >
                  {activeStatusInfo?.label}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">{activeStatusInfo?.desc}</p>
              </div>
            </div>

            {/* Live Visual Map / Route Simulator */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-[#0B1220] p-5 text-white space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-emerald-400">
                    Live Courier Radar · Teynampet Hub
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <span>ETA:</span>
                  <strong className="text-white font-bold">
                    {selectedOrder.etaMinutes || 8} mins
                  </strong>
                  <span>·</span>
                  <span>Dist:</span>
                  <strong className="text-white font-bold">
                    {selectedOrder.distanceKm || 1.2} km
                  </strong>
                </div>
              </div>

              <LiveReturnMap order={selectedOrder} accessPoint={selectedAccessPoint} />

              {/* Courier details & communication */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                <div>
                  <p className="font-semibold text-white">
                    Assigned Partner: {selectedOrder.pickupPersonName || "Courier Raj"}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Vehicle: {selectedOrder.vehicleNumber || "TN-09-AX-4412"} · Mobile:{" "}
                    {selectedOrder.pickupPersonPhone || "+91 98409 88776"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      startMockCall({
                        name: selectedOrder.pickupPersonName || "Courier Raj",
                        subtitle: `Courier (${selectedOrder.vehicleNumber || "TN-09-AX-4412"})`,
                        role: "manager",
                        phone: selectedOrder.pickupPersonPhone || "+91 98409 88776"
                      })
                    }
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Courier</span>
                  </button>

                  <button
                    onClick={() => openChatForReturn(selectedOrder.id)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Chat</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Doorstep Address & GPS Toggle */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-slate-500">
                  Doorstep Pickup Address
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      selectedOrder.locationSharingEnabled ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  <span className="text-[11px] font-medium text-slate-600">
                    {selectedOrder.locationSharingEnabled ? "Live GPS Active" : "Static Address"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">{selectedOrder.pickupAddress}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Coordinates: {selectedOrder.pickupLocation.latitude.toFixed(4)},{" "}
                    {selectedOrder.pickupLocation.longitude.toFixed(4)}
                  </p>
                </div>
              </div>

              {/* Share Live Location Toggle */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Broadcast continuous real-time coordinates to speed up doorstep arrival.
                </p>

                <button
                  onClick={() =>
                    handleToggleLocationSharing(
                      selectedOrder.id,
                      selectedOrder.locationSharingEnabled
                    )
                  }
                  disabled={sharingLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    selectedOrder.locationSharingEnabled
                      ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                      : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>
                    {sharingLoading
                      ? "Acquiring..."
                      : selectedOrder.locationSharingEnabled
                      ? "Stop Sharing"
                      : "Share Live GPS"}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Demo Controls for Hackathon evaluation */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                Simulate Reverse Logistics Cycle (Hackathon Tools)
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => advancePickupStatus(selectedOrder.id, "PICKUP_IN_PROGRESS")}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium"
                >
                  1. Dispatch Courier
                </button>
                <button
                  onClick={() => advancePickupStatus(selectedOrder.id, "PRODUCT_COLLECTED")}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium"
                >
                  2. Mark Collected
                </button>
                <button
                  onClick={() => advancePickupStatus(selectedOrder.id, "COMPLETED")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  3. Verify & Settle Refund
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
