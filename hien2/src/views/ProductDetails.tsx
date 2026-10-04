import React, { useState } from "react";
import {
  ArrowLeft,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  MessageSquare,
  CheckCircle2,
  CalendarCheck,
  Store
} from "lucide-react";
import { useApp } from "../context/AppContext";

interface Props {
  productId: string;
  onBack: () => void;
}

export const ProductDetails: React.FC<Props> = ({ productId, onBack }) => {
  const {
    products,
    accessPoints,
    reserveProduct,
    openChatForProduct,
    setBuyerTab,
    setSelectedMapAccessPointId
  } = useApp();

  const [reservationConfirmed, setReservationConfirmed] = useState(false);

  const product = products.find((p) => p.id === productId);

  if (!product) {
    return (
      <div className="max-w-xl mx-auto p-12 text-center text-slate-400 space-y-4">
        <h2 className="text-base font-bold text-slate-800">Product Not Found</h2>
        <p className="text-xs text-slate-500">The requested inventory item is no longer available.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
        >
          Back to Deals
        </button>
      </div>
    );
  }

  const ap = accessPoints.find((a) => a.id === product.accessPointId) || accessPoints[0];
  const amountSaved = product.originalPrice - product.openBoxPrice;

  const handleReserve = () => {
    reserveProduct(product.id);
    setReservationConfirmed(true);
  };

  // Reservation Confirmed View
  if (reservationConfirmed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 animate-fade-in">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
              STATUS: RESERVED
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2">RESERVATION CONFIRMED</h2>
            <p className="text-slate-500 text-xs mt-1">
              Held for in-person inspection and pickup at partner Access Point.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
            <div className="flex items-center gap-3">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-12 h-12 rounded-lg object-cover border border-slate-200"
              />
              <div>
                <h4 className="font-semibold text-slate-900">{product.name}</h4>
                <p className="text-emerald-600 font-bold">
                  ₹{product.openBoxPrice.toLocaleString("en-IN")}{" "}
                  <span className="text-slate-400 font-normal">
                    (Saved ₹{amountSaved.toLocaleString("en-IN")})
                  </span>
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-0.5">
              <span className="text-slate-500 font-medium">Pickup Location:</span>
              <p className="font-semibold text-slate-900">
                {ap.code} · {ap.name}
              </p>
              <p className="text-slate-600">{ap.address}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => setBuyerTab("reservations")}
              className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>View My Reservations</span>
            </button>
            <button
              onClick={() => openChatForProduct(product.id, "buyer")}
              className="w-full sm:w-auto py-3 px-5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Contact Store</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Section 33 Clean Product Details
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in pb-28">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Nearby Deals</span>
      </button>

      {/* Main Product Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left: Product Image */}
        <div className="md:col-span-6 space-y-3">
          <div className="relative aspect-[4/3] w-full rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2.5 left-2.5">
              <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold text-xs shadow-xs">
                15% OFF
              </span>
            </div>
            <div className="absolute top-2.5 right-2.5">
              <span className="px-2.5 py-1 rounded-md bg-white/95 text-emerald-700 text-xs font-semibold border border-slate-200 flex items-center gap-1 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>HIEN Verified</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Info, Price, Location */}
        <div className="md:col-span-6 space-y-5">
          <div>
            <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
              {product.category} · {product.sku}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{product.name}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Size {product.sizeOrVariant?.replace(/Size\s*/i, "") || "Standard"}
            </p>

            {/* Price (Section 33) */}
            <div className="flex items-baseline gap-3 pt-3">
              <span className="text-2xl font-bold text-slate-900">
                ₹{product.openBoxPrice.toLocaleString("en-IN")}
              </span>
              <span className="text-sm text-slate-400 line-through">
                ₹{product.originalPrice.toLocaleString("en-IN")}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                SAVE ₹{amountSaved.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Verification Pill */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-slate-800">
                {product.isMismatchReturn ? "Edge AI Optical Verified" : "HIEN Verified"}
              </span>
            </div>
            <span className="font-mono text-emerald-700 font-bold">
              {product.aiConfidence}% AI confidence
            </span>
            <span className="text-slate-600 font-medium">{product.condition} / Open Box</span>
          </div>

          {/* Dual Identity Transparency Panel for Mismatch Returns */}
          {product.isMismatchReturn && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-amber-900 uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 border border-amber-300">
                  Mismatch Return · Dual Identity Stored
                </span>
                <span className="text-amber-800 font-medium text-[11px]">Transparency Verified</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 rounded bg-white/80 border border-amber-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">
                    Claimed Barcode SKU
                  </span>
                  <strong className="text-slate-800">
                    {product.originalBarcodeProduct?.name || "Nike Air Zoom"}
                  </strong>
                  <p className="text-slate-500 text-[10px]">
                    {product.originalBarcodeProduct?.sku || "NIKE-AZ-10"}
                  </p>
                </div>

                <div className="p-2 rounded bg-white/80 border border-emerald-300">
                  <span className="text-emerald-700 block text-[10px] uppercase font-sans font-bold">
                    AI Identified Product
                  </span>
                  <strong className="text-slate-900">{product.name}</strong>
                  <p className="text-emerald-700 text-[10px] font-bold">
                    {product.sku} ({product.aiConfidence}%)
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-amber-900/90 leading-relaxed font-sans">
                Notice: Physical product was optical verified at partner Access Point. Published under genuine AI identity with original barcode logged for chain-of-custody.
              </p>
            </div>
          )}

          {/* PICKUP (Section 33) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono uppercase font-bold text-slate-500 text-[10px]">
                PICKUP LOCATION
              </span>
              <span className="text-slate-500 font-medium">300m away</span>
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {ap.name} ({ap.code})
            </h3>
            <p className="text-slate-600 leading-relaxed">{ap.address}</p>

            <button
              onClick={() => {
                setSelectedMapAccessPointId(ap.id);
                onBack();
              }}
              className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 pt-1 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>View on Map</span>
            </button>
          </div>

          {/* Contact Access Point */}
          <div>
            <button
              onClick={() => openChatForProduct(product.id, "buyer")}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Contact Access Point</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action (Section 33 & 45: [ Reserve Product — ₹2,550 ]) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 block">
              15% Open-Box Price
            </span>
            <span className="text-lg font-bold text-slate-900">
              ₹{product.openBoxPrice.toLocaleString("en-IN")}
            </span>
          </div>

          {product.status === "AVAILABLE" ? (
            <button
              onClick={handleReserve}
              className="flex-1 max-w-sm py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Reserve Product — ₹{product.openBoxPrice.toLocaleString("en-IN")}</span>
            </button>
          ) : (
            <span className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-100 text-slate-600">
              Item {product.status.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
