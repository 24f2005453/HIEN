import React from "react";

interface Props {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

export const HienLogo: React.FC<Props> = ({
  variant = "light",
  size = "md",
  showTagline = false
}) => {
  const isDarkBg = variant === "light"; // light text on dark bg

  const iconSizes = {
    sm: "w-7 h-7",
    md: "w-8 h-8",
    lg: "w-10 h-10"
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl"
  };

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Geometric HIEN mark: 4 interconnected nodes with exchange loops & central verification node */}
      <div
        className={`${iconSizes[size]} rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-white"
        >
          {/* Outer connected nodes */}
          <circle cx="6" cy="6" r="2" fill="currentColor" />
          <circle cx="18" cy="6" r="2" fill="currentColor" />
          <circle cx="18" cy="18" r="2" fill="currentColor" />
          <circle cx="6" cy="18" r="2" fill="currentColor" />
          {/* Exchange connection vectors */}
          <path d="M8 6h8" strokeWidth="1.8" />
          <path d="M18 8v8" strokeWidth="1.8" />
          <path d="M16 18H8" strokeWidth="1.8" />
          <path d="M6 16V8" strokeWidth="1.8" />
          {/* Inner verification core */}
          <circle cx="12" cy="12" r="1.5" fill="#22D3EE" stroke="#22D3EE" />
        </svg>
      </div>

      <div className="leading-tight">
        <div className="flex items-center gap-2">
          <span
            className={`font-bold tracking-tight ${textSizes[size]} ${
              isDarkBg ? "text-white" : "text-slate-900"
            }`}
          >
            HIEN
          </span>
          <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            Network
          </span>
        </div>
        {showTagline && (
          <p className="text-[11px] text-slate-400 font-medium">
            Hyperlocal Inventory Exchange
          </p>
        )}
      </div>
    </div>
  );
};
