import React, { useState } from "react";
import {
  Package,
  QrCode,
  Search,
  Clock,
  Tag,
  AlertTriangle
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { ProductStatus } from "../types";

type FilterTab = "ALL" | "AVAILABLE" | "RESERVED" | "MISMATCH_RETURNS" | "SOLD";

export const ManagerInventory: React.FC = () => {
  const { currentAccessPoint, products, setManagerTab, openChatForProduct } = useApp();
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [search, setSearch] = useState("");

  const apProducts = products.filter((p) => p.accessPointId === currentAccessPoint.id);

  const filteredProducts = apProducts.filter((product) => {
    if (filter === "AVAILABLE" && product.status !== "AVAILABLE") return false;
    if (filter === "RESERVED" && product.status !== "RESERVED" && product.status !== "READY_FOR_PICKUP") return false;
    if (filter === "MISMATCH_RETURNS" && !product.isMismatchReturn) return false;
    if (filter === "SOLD" && product.status !== "SOLD") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        product.barcode.includes(q) ||
        (product.originalBarcodeProduct?.name.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const getStatusBadge = (product: typeof apProducts[0]) => {
    if (product.isMismatchReturn) {
      return (
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
          <Tag className="w-3 h-3 text-amber-600" />
          <span>Mismatch Return</span>
        </span>
      );
    }

    switch (product.status) {
      case "AVAILABLE":
        return (
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
            Available
          </span>
        );
      case "RESERVED":
        return (
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
            Reserved
          </span>
        );
      case "READY_FOR_PICKUP":
        return (
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200">
            Ready
          </span>
        );
      case "SOLD":
        return (
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Sold
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            {product.status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-slate-500">
              {currentAccessPoint.code} · Catalog
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Shelf Inventory</h1>
          <p className="text-xs text-slate-500">
            Verified open-box items and accepted mismatch returns at {currentAccessPoint.name}.
          </p>
        </div>

        <button
          onClick={() => setManagerTab("scan")}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs shrink-0"
        >
          <QrCode className="w-4 h-4" />
          <span>Scan New Return</span>
        </button>
      </div>

      {/* Search & Filter Bar (Section 8) */}
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name, SKU, or original barcode..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: "ALL", label: "All Items" },
            { id: "AVAILABLE", label: "Available" },
            { id: "RESERVED", label: "Reserved" },
            { id: "MISMATCH_RETURNS", label: "Mismatch Returns" },
            { id: "SOLD", label: "Sold" }
          ].map((tab) => {
            const count =
              tab.id === "ALL"
                ? apProducts.length
                : tab.id === "RESERVED"
                ? apProducts.filter((p) => p.status === "RESERVED" || p.status === "READY_FOR_PICKUP").length
                : tab.id === "MISMATCH_RETURNS"
                ? apProducts.filter((p) => p.isMismatchReturn).length
                : apProducts.filter((p) => p.status === tab.id).length;

            const isActive = filter === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as FilterTab)}
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
      </div>

      {/* Inventory Cards Grid (Section 8) */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
          <Package className="w-10 h-10 mx-auto text-slate-300" />
          <h3 className="font-semibold text-sm text-slate-800">No products matching this filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Scan and verify returned items with optical edge AI to list them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between space-y-3 transition-colors ${
                product.isMismatchReturn ? "border-amber-300 bg-amber-50/10" : "border-slate-200"
              }`}
            >
              <div className="space-y-3">
                {/* Top Status & Verification Badge */}
                <div className="flex items-center justify-between">
                  {getStatusBadge(product)}
                  <span className="text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ {product.aiConfidence}% Verified
                  </span>
                </div>

                {/* Product Thumbnail & Title (Section 8: Uses AI-identified product name!) */}
                <div className="flex items-start gap-3">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{product.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      SKU: {product.sku} · {product.sizeOrVariant}
                    </p>

                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-base font-bold text-slate-900">
                        ₹{product.openBoxPrice.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        ₹{product.originalPrice.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mismatch Return Specific Callout (Section 8) */}
                {product.isMismatchReturn && product.originalBarcodeProduct && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1 text-amber-900">
                    <span className="text-[10px] font-mono uppercase font-bold text-amber-800 block">
                      Original Barcode Reference:
                    </span>
                    <p className="font-semibold text-slate-800">
                      {product.originalBarcodeProduct.name} ({product.originalBarcodeProduct.sku})
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Verified visually as authentic {product.name}
                    </p>
                  </div>
                )}

                {/* Condition & Status */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Condition:</span>
                  <span className="font-medium text-slate-800">{product.condition} / Open Box</span>
                </div>

                {/* Buyer hold info if reserved */}
                {product.reservedByBuyerName && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs flex items-center justify-between text-amber-900">
                    <span className="truncate">
                      Held by <strong>{product.reservedByBuyerName}</strong>
                    </span>
                    <button
                      onClick={() => openChatForProduct(product.id, "manager")}
                      className="text-amber-800 hover:underline font-semibold text-[11px] shrink-0 ml-2"
                    >
                      Message
                    </button>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(product.createdAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric"
                  })}
                </span>
                <span>AP Shelf ID: {product.id.slice(-6)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
