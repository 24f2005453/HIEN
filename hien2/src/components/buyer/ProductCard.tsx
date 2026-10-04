import React from "react";
import { MapPin, ShieldCheck } from "lucide-react";
import { Product } from "../../types";
import { useApp } from "../../context/AppContext";

interface Props {
  product: Product;
  onClick: () => void;
}

export const ProductCard: React.FC<Props> = ({ product, onClick }) => {
  const { accessPoints } = useApp();
  const ap = accessPoints.find((a) => a.id === product.accessPointId) || accessPoints[0];

  const getDistanceText = (apId: string) => {
    if (apId === "ap-04") return "300m";
    if (apId === "ap-09") return "850m";
    return "1.4 km";
  };

  const distanceText = getDistanceText(product.accessPointId);

  return (
    <div
      onClick={onClick}
      className="group bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Product Image & Key Badges (Section 32) */}
        <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            loading="lazy"
          />

          {/* 15% OFF Badge */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold shadow-xs">
              15% OFF
            </span>
            {product.isMismatchReturn && (
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 text-[10px] font-bold tracking-tight shadow-xs uppercase">
                Mismatch Return
              </span>
            )}
          </div>

          {/* Small: ✓ HIEN Verified */}
          <div className="absolute top-2.5 right-2.5">
            <span className="px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-emerald-700 text-[10px] font-semibold border border-slate-200 flex items-center gap-1 shadow-xs">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>{product.isMismatchReturn ? "AI Verified" : "Verified"}</span>
            </span>
          </div>

          {/* Distance & AP Badge */}
          <div className="absolute bottom-2.5 right-2.5">
            <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span>{distanceText}</span>
            </span>
          </div>
        </div>

        {/* Card Content (Section 32: Product name, Price, Pristine, AP #04) */}
        <div className="p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono text-[11px] uppercase font-semibold text-slate-600">
              {ap.code} · {ap.name}
            </span>
            <span className="text-slate-500 font-medium">{product.condition}</span>
          </div>

          <h3 className="font-semibold text-sm text-slate-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">
            {product.name}
          </h3>

          {/* Pricing */}
          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-base font-bold text-slate-900">
              ₹{product.openBoxPrice.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-400 line-through">
              ₹{product.originalPrice.toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium ml-auto">
              Save ₹{(product.originalPrice - product.openBoxPrice).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
