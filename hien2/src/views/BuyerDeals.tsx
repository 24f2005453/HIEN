import React, { useState } from "react";
import { Search, MapPin, X, ShoppingBag } from "lucide-react";
import { useApp } from "../context/AppContext";
import { MapDiscovery } from "../components/buyer/MapDiscovery";
import { ProductCard } from "../components/buyer/ProductCard";

export const BuyerDeals: React.FC = () => {
  const {
    products,
    accessPoints,
    setSelectedProductId,
    selectedMapAccessPointId,
    setSelectedMapAccessPointId,
    searchQuery,
    setSearchQuery
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const availableProducts = products.filter((p) => p.status === "AVAILABLE");

  const filteredProducts = availableProducts.filter((product) => {
    if (selectedMapAccessPointId && product.accessPointId !== selectedMapAccessPointId) {
      return false;
    }
    if (selectedCategory !== "ALL" && product.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = ["ALL", "Footwear", "Electronics", "Audio", "Accessories"];
  const activeAP = accessPoints.find((a) => a.id === selectedMapAccessPointId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 animate-fade-in">
      {/* Top Header & Search (Section 31: Nearby Deals, Within 3 km, Search) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-mono uppercase font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Within 3 km
              </span>
              <span className="text-xs text-slate-400 font-mono">Central Chennai</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Nearby Deals</h1>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white font-semibold shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              {cat === "ALL" ? "All Deals" : cat}
            </button>
          ))}

          {activeAP && (
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs shrink-0">
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span>{activeAP.code}</span>
              <button
                onClick={() => setSelectedMapAccessPointId(null)}
                className="hover:text-emerald-950 font-bold ml-1 text-slate-400"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Responsive Split Layout (Section 31: Mobile Map ~45% / Products ~55%, Desktop Map ~60-65% / Products ~35-40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Map Area (Desktop: 7 cols ~60%, Mobile: ~45% height) */}
        <div className="lg:col-span-7 h-[320px] sm:h-[420px] lg:h-[600px] sticky top-20">
          <MapDiscovery
            accessPoints={accessPoints}
            products={products}
            selectedAccessPointId={selectedMapAccessPointId}
            onSelectAccessPoint={(id) => setSelectedMapAccessPointId(id)}
            onViewProductsAtAP={(id) => setSelectedMapAccessPointId(id)}
          />
        </div>

        {/* Products Area (Desktop: 5 cols ~40%, Mobile: ~55%) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Verified Open-Box Stock ({filteredProducts.length})
            </h2>
            <span className="text-[11px] font-mono text-emerald-600 font-semibold">15% Discount</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-8 rounded-xl bg-white border border-slate-200 text-center text-slate-400 space-y-2">
              <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">No deals found</p>
              <p className="text-[11px] text-slate-500">
                Try selecting a different category or clearing filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => setSelectedProductId(product.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
