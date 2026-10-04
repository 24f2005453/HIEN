import React from "react";
import { ProductStatus, ReservationStatus, ProductCondition, PickupStatus } from "../../types";

interface BadgeProps {
  variant?: "status" | "condition" | "confidence" | "demand" | "discount" | "mismatch";
  status?: ProductStatus | ReservationStatus | PickupStatus | string;
  condition?: ProductCondition | string;
  score?: number;
  label?: string;
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "status",
  status,
  condition,
  score,
  label,
  size = "md"
}) => {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs font-semibold" : "px-2.5 py-1 text-xs font-semibold";

  if (variant === "mismatch") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-bold uppercase tracking-wider ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {label || "Mismatch Return"}
      </span>
    );
  }

  if (variant === "confidence" && score !== undefined) {
    if (score >= 90) {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {score}% AI PASS
        </span>
      );
    }
    if (score >= 75) {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {score}% AI REVIEW
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-800 border border-rose-300 ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        {score}% LOW CONFIDENCE
      </span>
    );
  }

  if (variant === "discount") {
    return (
      <span className={`inline-flex items-center rounded-md bg-emerald-600 text-white font-bold tracking-tight ${sizeClasses}`}>
        {label || "15% OFF"}
      </span>
    );
  }

  if (variant === "condition") {
    const cond = condition || label;
    let style = "bg-slate-100 text-slate-700 border-slate-200";
    if (cond === "Pristine") {
      style = "bg-emerald-50 text-emerald-800 border-emerald-200";
    } else if (cond === "Good") {
      style = "bg-blue-50 text-blue-800 border-blue-200";
    } else if (cond === "Minor Damage") {
      style = "bg-amber-50 text-amber-800 border-amber-200";
    } else if (cond === "Damaged") {
      style = "bg-rose-50 text-rose-800 border-rose-200";
    }
    return (
      <span className={`inline-flex items-center rounded-lg border font-medium ${style} ${sizeClasses}`}>
        {cond}
      </span>
    );
  }

  // Status mapping
  const s = status || label || "";
  let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";

  switch (s) {
    case "AVAILABLE":
      badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";
      break;
    case "RESERVED":
      badgeStyle = "bg-amber-50 text-amber-800 border-amber-200";
      break;
    case "READY_FOR_PICKUP":
    case "PICKUP_IN_PROGRESS":
    case "LOCATION_SHARED":
    case "PICKUP_ASSIGNED":
    case "PICKUP_ACCEPTED":
      badgeStyle = "bg-cyan-50 text-cyan-800 border-cyan-200";
      break;
    case "ARRIVING":
    case "ARRIVED":
      badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold";
      break;
    case "MISMATCH_RETURN":
    case "MISMATCH RETURN":
      badgeStyle = "bg-amber-100 text-amber-900 border-amber-300 font-bold";
      break;
    case "PRODUCT_COLLECTED":
    case "REFUND_PROCESSING":
    case "REFUND_INITIATED":
      badgeStyle = "bg-purple-50 text-purple-800 border-purple-200";
      break;
    case "SOLD":
    case "COMPLETED":
      badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
      break;
    case "ROUTED_TO_CENTRAL":
      badgeStyle = "bg-purple-50 text-purple-700 border-purple-200";
      break;
    case "CANCELLED":
      badgeStyle = "bg-rose-50 text-rose-800 border-rose-200";
      break;
    case "ACTIVE":
      badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
      break;
    default:
      badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
  }

  return (
    <span className={`inline-flex items-center rounded-md border tracking-wide uppercase ${badgeStyle} ${sizeClasses}`}>
      {s.replace(/_/g, " ")}
    </span>
  );
};
