import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Search,
  Truck,
  Warehouse
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { ReturnOrder, WarehousePickupStatus } from "../types";
import { WarehouseRouteMap } from "../components/warehouse/WarehouseRouteMap";

const getWarehouseStatus = (order: ReturnOrder): WarehousePickupStatus => {
  return order.warehousePickupStatus
    || (order.status === "PRODUCT_COLLECTED" ? "STORED_AT_ACCESS_POINT" : "AWAITING_ACCESS_POINT");
};

const statusLabels: Record<WarehousePickupStatus, string> = {
  AWAITING_ACCESS_POINT: "Awaiting AP intake",
  STORED_AT_ACCESS_POINT: "Stored at access point",
  COLLECTION_SCHEDULED: "Collection scheduled",
  IN_TRANSIT_TO_WAREHOUSE: "In transit to warehouse",
  RECEIVED_AT_WAREHOUSE: "Received at warehouse"
};

const nextAction: Partial<Record<WarehousePickupStatus, {
  label: string;
  status: WarehousePickupStatus;
}>> = {
  STORED_AT_ACCESS_POINT: {
    label: "Schedule collection",
    status: "COLLECTION_SCHEDULED"
  },
  COLLECTION_SCHEDULED: {
    label: "Confirm AP handoff",
    status: "IN_TRANSIT_TO_WAREHOUSE"
  },
  IN_TRANSIT_TO_WAREHOUSE: {
    label: "Confirm warehouse receipt",
    status: "RECEIVED_AT_WAREHOUSE"
  }
};

export const WarehouseDashboard: React.FC = () => {
  const { returnOrders, accessPoints, updateWarehousePickupStatus } = useApp();
  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return returnOrders.filter((order) => {
      const status = getWarehouseStatus(order);
      const isActive = status !== "RECEIVED_AT_WAREHOUSE";
      const matchesQuery = !normalizedQuery || [
        order.id,
        order.orderNumber,
        order.productName,
        order.productSku,
        order.accessPointName,
        order.accessPointCode
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return (filter === "all" || isActive) && matchesQuery;
    });
  }, [filter, query, returnOrders]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId)
    || filteredOrders.find((order) => getWarehouseStatus(order) === "STORED_AT_ACCESS_POINT")
    || filteredOrders[0]
    || null;
  const counts = {
    awaiting: returnOrders.filter((order) => getWarehouseStatus(order) === "AWAITING_ACCESS_POINT").length,
    stored: returnOrders.filter((order) => getWarehouseStatus(order) === "STORED_AT_ACCESS_POINT").length,
    scheduled: returnOrders.filter((order) => getWarehouseStatus(order) === "COLLECTION_SCHEDULED").length,
    transit: returnOrders.filter((order) => getWarehouseStatus(order) === "IN_TRANSIT_TO_WAREHOUSE").length,
    received: returnOrders.filter((order) => getWarehouseStatus(order) === "RECEIVED_AT_WAREHOUSE").length
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#111A2E] to-[#0B1220] p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
              <Warehouse className="h-4 w-4" />
              E-commerce reverse logistics
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Central Warehouse Dashboard</h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-300">
              Track defective returns from partner access points through scheduled collection, custody handoff, and warehouse receipt.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
            <Building2 className="h-4 w-4 text-cyan-300" />
            Demo operations · Chennai network
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Awaiting AP intake", value: counts.awaiting, icon: Clock3, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Stored at AP", value: counts.stored, icon: PackageCheck, color: "text-cyan-700", bg: "bg-cyan-50" },
          { label: "Collection scheduled", value: counts.scheduled, icon: Clock3, color: "text-violet-700", bg: "bg-violet-50" },
          { label: "In transit", value: counts.transit, icon: Truck, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Received", value: counts.received, icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50" }
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className={`mb-3 grid h-8 w-8 place-items-center rounded-lg ${bg} ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Return custody queue</h2>
              <p className="text-[11px] text-slate-500">Search by return, item, or access point.</p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search warehouse returns"
                  placeholder="Search returns…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-cyan-500 sm:w-48"
                />
              </div>
              <button
                onClick={() => setFilter((current) => current === "active" ? "all" : "active")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {filter === "active" ? "Active" : "All returns"}
              </button>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              No return records match this search.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((order) => {
                const status = getWarehouseStatus(order);
                const ap = accessPoints.find((accessPoint) => accessPoint.id === order.accessPointId);
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full rounded-xl border bg-white p-4 text-left transition-colors ${
                      selectedOrder?.id === order.id
                        ? "border-cyan-500 ring-1 ring-cyan-500/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <img src={order.productImageUrl} alt="" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-500">{order.id} · {order.orderNumber}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-700">{statusLabels[status]}</span>
                        </span>
                        <span className="mt-1 block truncate text-xs font-bold text-slate-900">{order.productName}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">
                          {ap?.code || order.accessPointCode} · {ap?.name || order.accessPointName} · SKU {order.productSku}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
          {selectedOrder ? (
            <>
              <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                <img src={selectedOrder.productImageUrl} alt={selectedOrder.productName} className="h-14 w-14 rounded-xl border border-slate-200 object-cover" />
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-bold text-slate-500">RETURN {selectedOrder.id}</p>
                  <h3 className="mt-0.5 truncate text-sm font-bold text-slate-900">{selectedOrder.productName}</h3>
                  <p className="text-[11px] text-slate-500">{selectedOrder.productSku} · {selectedOrder.accessPointCode}</p>
                  <span className="mt-2 inline-block rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-800">
                    {statusLabels[getWarehouseStatus(selectedOrder)]}
                  </span>
                </div>
              </div>

              <WarehouseRouteMap
                order={selectedOrder}
                accessPoint={accessPoints.find((accessPoint) => accessPoint.id === selectedOrder.accessPointId)}
              />

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Custody timeline</h4>
                {(selectedOrder.warehouseCustodyEvents || []).length ? (
                  [...(selectedOrder.warehouseCustodyEvents || [])].reverse().map((event) => (
                    <div key={event.id} className="flex gap-2.5 text-[10px]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-800">{statusLabels[event.status]}</p>
                        <p className="text-slate-500">{event.actor} · {new Date(event.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-500">No warehouse custody events yet. Events are recorded as custody changes are confirmed.</p>
                )}
              </div>

              {nextAction[getWarehouseStatus(selectedOrder)] ? (
                <button
                  onClick={() => {
                    setSelectedOrderId(selectedOrder.id);
                    const status = nextAction[getWarehouseStatus(selectedOrder)]!.status;
                    if (status === "RECEIVED_AT_WAREHOUSE") {
                      setFilter("all");
                    }
                    updateWarehousePickupStatus(
                      selectedOrder.id,
                      status
                    );
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-cyan-600"
                >
                  {nextAction[getWarehouseStatus(selectedOrder)]!.label}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="rounded-xl bg-slate-50 p-3 text-center text-[11px] font-medium text-slate-600">
                  {getWarehouseStatus(selectedOrder) === "AWAITING_ACCESS_POINT"
                    ? "Waiting for the access point to confirm receipt of the customer return."
                    : "This return has been received at the central warehouse."}
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">Select a return to inspect its custody history.</div>
          )}
        </aside>
      </section>
    </div>
  );
};
