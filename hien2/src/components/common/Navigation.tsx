import React from "react";
import {
  LayoutDashboard,
  QrCode,
  Package,
  CalendarCheck,
  MessageSquare,
  ShoppingBag,
  User,
  ScanLine,
  Truck,
  Warehouse
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { ManagerTab, BuyerTab } from "../../types";

export const Navigation: React.FC = () => {
  const {
    role,
    managerTab,
    setManagerTab,
    buyerTab,
    setBuyerTab,
    setSelectedProductId,
    reservations,
    returnOrders,
    conversations,
    currentAccessPoint
  } = useApp();

  const unreadMessagesCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const activeReservationsCount = reservations.filter(
    (r) =>
      (r.status === "RESERVED" || r.status === "READY_FOR_PICKUP") &&
      (role === "manager" ? r.accessPointId === currentAccessPoint.id : true)
  ).length;

  const activePickupsCount = returnOrders.filter(
    (r) =>
      r.status === "PICKUP_IN_PROGRESS" ||
      r.status === "RETURN_REQUESTED" ||
      r.status === "LOCATION_SHARED"
  ).length;

  if (role === "warehouse") {
    return (
      <div className="border-b border-slate-800 bg-[#111A2E]">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs font-semibold text-cyan-200 sm:px-6">
          <Warehouse className="h-4 w-4 text-cyan-400" />
          <span>Central Warehouse Operations</span>
          <span className="ml-auto rounded-full border border-cyan-800 bg-cyan-950 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
            {returnOrders.filter((order) =>
              order.warehousePickupStatus
                ? order.warehousePickupStatus === "STORED_AT_ACCESS_POINT" || order.warehousePickupStatus === "COLLECTION_SCHEDULED"
                : order.status === "PRODUCT_COLLECTED"
            ).length} awaiting collection
          </span>
        </div>
      </div>
    );
  }

  if (role === "manager") {
    const desktopItems: {
      id: ManagerTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number;
    }[] = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "scan", label: "Scan Return", icon: QrCode },
      { id: "inventory", label: "Inventory", icon: Package },
      { id: "reservations", label: "Reservations", icon: CalendarCheck, badge: activeReservationsCount },
      { id: "pickups", label: "Live Pickups", icon: Truck, badge: activePickupsCount },
      { id: "messages", label: "Messages", icon: MessageSquare, badge: unreadMessagesCount }
    ];

    return (
      <>
        {/* Desktop Top Sub-Navigation */}
        <div className="hidden md:block bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex space-x-1" aria-label="Manager Navigation">
              {desktopItems.map((item) => {
                const Icon = item.icon;
                const isActive = managerTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setManagerTab(item.id);
                      setSelectedProductId(null);
                    }}
                    className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                        : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-slate-500"}`} />
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile Clean Bottom Navigation (Target: 390 × 844) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 shadow-sm">
          <nav className="grid grid-cols-5 items-center">
            {/* 1. Home */}
            <button
              onClick={() => {
                setManagerTab("dashboard");
                setSelectedProductId(null);
              }}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                managerTab === "dashboard" ? "text-emerald-600 font-semibold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] mt-1">Home</span>
            </button>

            {/* 2. Inventory */}
            <button
              onClick={() => {
                setManagerTab("inventory");
                setSelectedProductId(null);
              }}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                managerTab === "inventory" ? "text-emerald-600 font-semibold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Package className="w-5 h-5" />
              <span className="text-[10px] mt-1">Inventory</span>
            </button>

            {/* 3. Center Emphasized Scan Action */}
            <button
              onClick={() => {
                setManagerTab("scan");
                setSelectedProductId(null);
              }}
              className="flex flex-col items-center justify-center -mt-4"
              aria-label="Scan New Return"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md hover:bg-emerald-500 transition-colors">
                <ScanLine className="w-6 h-6" />
              </div>
              <span className="text-[10px] mt-1 font-semibold text-emerald-700">Scan</span>
            </button>

            {/* 4. Reservations */}
            <button
              onClick={() => {
                setManagerTab("reservations");
                setSelectedProductId(null);
              }}
              className={`flex flex-col items-center justify-center py-1 relative transition-colors ${
                managerTab === "reservations" ? "text-emerald-600 font-semibold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <div className="relative">
                <CalendarCheck className="w-5 h-5" />
                {activeReservationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </div>
              <span className="text-[10px] mt-1">Holds</span>
            </button>

            {/* 5. Messages */}
            <button
              onClick={() => {
                setManagerTab("messages");
                setSelectedProductId(null);
              }}
              className={`flex flex-col items-center justify-center py-1 relative transition-colors ${
                managerTab === "messages" ? "text-emerald-600 font-semibold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5" />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>
              <span className="text-[10px] mt-1">Chat</span>
            </button>
          </nav>
        </div>
      </>
    );
  }

  // Buyer Navigation
  const buyerDesktopItems: {
    id: BuyerTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: "deals", label: "Nearby Deals", icon: ShoppingBag },
    { id: "reservations", label: "My Reservations", icon: CalendarCheck, badge: activeReservationsCount },
    { id: "returns", label: "Live Returns", icon: Truck, badge: activePickupsCount },
    { id: "messages", label: "Messages", icon: MessageSquare, badge: unreadMessagesCount },
    { id: "profile", label: "Profile", icon: User }
  ];

  return (
    <>
      {/* Desktop Top Sub-Navigation */}
      <div className="hidden md:block bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex space-x-1" aria-label="Buyer Navigation">
            {buyerDesktopItems.map((item) => {
              const Icon = item.icon;
              const isActive = buyerTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setBuyerTab(item.id);
                    setSelectedProductId(null);
                  }}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-slate-500"}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Clean Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 shadow-sm">
        <nav className="grid grid-cols-5 items-center">
          {buyerDesktopItems.map((item) => {
            const Icon = item.icon;
            const isActive = buyerTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setBuyerTab(item.id);
                  setSelectedProductId(null);
                }}
                className={`flex flex-col items-center justify-center py-1 relative transition-colors ${
                  isActive ? "text-emerald-600 font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <span className="text-[10px] mt-1">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};
