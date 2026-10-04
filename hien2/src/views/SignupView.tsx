import React, { useState } from "react";
import {
  Store,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  MapPin,
  CheckCircle2
} from "lucide-react";
import { UserRole } from "../types";
import { useApp } from "../context/AppContext";
import { HienLogo } from "../components/common/HienLogo";

interface Props {
  onGoToLogin: () => void;
}

export const SignupView: React.FC<Props> = ({ onGoToLogin }) => {
  const { signup } = useApp();
  const [selectedRole, setSelectedRole] = useState<UserRole>("manager");
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Account
  const [fullName, setFullName] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 2: Access Point Details (Manager only)
  const [storeName, setStoreName] = useState("Express Electronics");
  const [addressLine, setAddressLine] = useState("123 Anna Salai");
  const [area, setArea] = useState("Teynampet");
  const [city, setCity] = useState("Chennai");
  const [pincode, setPincode] = useState("600018");

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }
    setErrorMsg(null);

    if (selectedRole === "buyer") {
      // Buyer signup is complete
      signup("buyer", {
        name: fullName || "Nearby Buyer",
        email: emailOrPhone.includes("@") ? emailOrPhone : "buyer@example.com",
        phone: emailOrPhone.includes("@") ? "+91 98405 99887" : emailOrPhone
      });
    } else {
      // Advance to step 2 for manager store location
      setStep(2);
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullAddress = `${addressLine}, ${area}, ${city}, Tamil Nadu - ${pincode}`;
    signup("manager", {
      name: fullName || "Partner Manager",
      email: emailOrPhone.includes("@") ? emailOrPhone : "partner@hien.io",
      phone: emailOrPhone.includes("@") ? "+91 98401 23456" : emailOrPhone,
      storeData: {
        name: storeName,
        address: fullAddress,
        area,
        city,
        state: "Tamil Nadu",
        pincode,
        latitude: 13.0418,
        longitude: 80.2341
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      <header className="border-b border-slate-800 bg-[#0B1220]/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <HienLogo variant="light" size="md" />

          <button
            onClick={onGoToLogin}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 w-full flex-1">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-slate-900 shadow-md space-y-5">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Registration
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-2">Create HIEN Account</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect verified reverse logistics with local buyers.
            </p>
          </div>

          {/* Role selector */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole("manager");
                  setStep(1);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedRole === "manager"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Store Manager</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRole("buyer");
                  setStep(1);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedRole === "buyer"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Nearby Buyer</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: Account Form */}
          {step === 1 ? (
            <form onSubmit={handleStep1Next} className="space-y-3.5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>{selectedRole === "manager" ? "Step 1 of 2: Account" : "Buyer Details"}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Suresh Raman"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email or Phone
                </label>
                <input
                  type="text"
                  required
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="contact@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>
                  {selectedRole === "manager" ? "Continue to Store Location" : "Create Buyer Account"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* STEP 2: Access Point Location (Manager only) */
            <form onSubmit={handleStep2Submit} className="space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>Step 2 of 2: Store Location</span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  ← Back to Step 1
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Access Point / Store Name
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Express Electronics"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address Line
                </label>
                <input
                  type="text"
                  required
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="123 Anna Salai"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Area</label>
                  <input
                    type="text"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Teynampet"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Chennai"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    required
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="600018"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Complete Store Partner Registration</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
            Already have an account?{" "}
            <button
              onClick={onGoToLogin}
              className="text-emerald-700 font-semibold hover:underline cursor-pointer ml-0.5"
            >
              Login
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
