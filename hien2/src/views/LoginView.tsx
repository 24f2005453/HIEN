import React, { useState } from "react";
import {
  Store,
  ShoppingBag,
  Warehouse,
  ArrowRight,
  ShieldCheck,
  Lock,
  Mail
} from "lucide-react";
import { UserRole } from "../types";
import { useApp } from "../context/AppContext";
import { HienLogo } from "../components/common/HienLogo";

interface Props {
  onGoToSignup: () => void;
}

export const LoginView: React.FC<Props> = ({ onGoToSignup }) => {
  const { login } = useApp();
  const [selectedRole, setSelectedRole] = useState<UserRole>("manager");
  const [emailOrPhone, setEmailOrPhone] = useState(
    selectedRole === "manager" ? "suresh@expresselectronics.in" : "rahul.verma@example.com"
  );
  const [storeName, setStoreName] = useState("Express Electronics");
  const [address, setAddress] = useState("123 Anna Salai, Teynampet, Chennai, Tamil Nadu - 600018");
  const [password, setPassword] = useState("••••••••");

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setEmailOrPhone(role === "manager"
      ? "suresh@expresselectronics.in"
      : role === "buyer"
        ? "rahul.verma@example.com"
        : "warehouse@hien.io");
    if (role === "manager") {
      setStoreName("Express Electronics");
      setAddress("123 Anna Salai, Teynampet, Chennai, Tamil Nadu - 600018");
    } else if (role === "buyer") {
      setAddress("42 Eldams Road, Teynampet, Chennai, Tamil Nadu - 600018");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(selectedRole, emailOrPhone, { storeName, address });
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#0B1220]/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <HienLogo variant="light" size="md" showTagline />

          <button
            onClick={onGoToSignup}
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Create Account
          </button>
        </div>
      </header>

      {/* Main Content (Section 10: Left concept, Right login card) */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center flex-1 w-full">
        {/* Left Column: Brand & Concept */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Reverse Logistics · Local Return Operations</span>
            </span>

            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Returns, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                Verified Locally.
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base max-w-lg leading-relaxed">
              Verify returns locally with edge AI and reconnect trusted open-box inventory with nearby
              buyers within 3 km.
            </p>
          </div>

          {/* Core premise */}
          <div className="p-4 rounded-xl bg-[#111A2E] border border-slate-800 text-xs sm:text-sm text-slate-300 italic border-l-4 border-l-emerald-500 max-w-lg">
            "We don't move the product to establish trust — we move the trust to the product."
          </div>

          {/* Simple 5-Stage Step Flow */}
          <div className="pt-2">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2 font-medium">
              The 5-Stage Network Loop
            </span>
            <div className="grid grid-cols-5 gap-2 max-w-lg text-center text-xs">
              <div className="p-2 rounded-lg bg-[#111A2E] border border-slate-800">
                <span className="font-mono text-emerald-400 text-[10px] font-bold block">1. DROP</span>
                <span className="text-slate-400 text-[11px]">At AP</span>
              </div>
              <div className="p-2 rounded-lg bg-[#111A2E] border border-slate-800">
                <span className="font-mono text-cyan-400 text-[10px] font-bold block">2. SCAN</span>
                <span className="text-slate-400 text-[11px]">Barcode</span>
              </div>
              <div className="p-2 rounded-lg bg-[#111A2E] border border-slate-800">
                <span className="font-mono text-emerald-400 text-[10px] font-bold block">3. VERIFY</span>
                <span className="text-slate-400 text-[11px]">AI Gate</span>
              </div>
              <div className="p-2 rounded-lg bg-[#111A2E] border border-slate-800">
                <span className="font-mono text-cyan-400 text-[10px] font-bold block">4. MATCH</span>
                <span className="text-slate-400 text-[11px]">3km Buyer</span>
              </div>
              <div className="p-2 rounded-lg bg-[#111A2E] border border-slate-800">
                <span className="font-mono text-emerald-400 text-[10px] font-bold block">5. SOLD</span>
                <span className="text-slate-400 text-[11px]">15% OFF</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean Login Card (Section 10) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-slate-900 shadow-md space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Login to HIEN</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose your role to access the inventory exchange.
              </p>
            </div>

            {/* Choose Role Selector (Section 10: [ Access Point Manager ] [ Buyer ]) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Choose Role:
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleRoleChange("manager")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedRole === "manager"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Manager</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange("buyer")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedRole === "buyer"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Buyer</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange("warehouse")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedRole === "warehouse"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Warehouse className="w-3.5 h-3.5" />
                  <span>Warehouse</span>
                </button>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email or Phone
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="you@example.com"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {selectedRole === "manager" && (
                <div>
                  <label htmlFor="store-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Store Name
                  </label>
                  <div className="relative">
                    <input
                      id="store-name"
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                      placeholder="Your store name"
                    />
                    <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              )}

              {(selectedRole === "manager" || selectedRole === "buyer") && (
                <div>
                  <label htmlFor="login-address" className="block text-xs font-semibold text-slate-700 mb-1">
                    {selectedRole === "manager" ? "Store Address" : "Exact Address"}
                  </label>
                  <textarea
                    id="login-address"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    autoComplete="street-address"
                    className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    placeholder={selectedRole === "manager"
                      ? "Building, street, area, city, PIN code"
                      : "Flat/house number, street, area, city, PIN code"}
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    {selectedRole === "manager"
                      ? "Enter the full address of your Access Point store."
                      : "Enter your full pickup/delivery address, including flat or house number and PIN code."}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="Enter password"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer pt-2"
              >
                <span>Login as {selectedRole === "manager" ? "Manager" : selectedRole === "buyer" ? "Buyer" : "Warehouse"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick 1-Click Demo Profiles for Hackathon Evaluators */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
                1-Click Demo Logins:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    handleRoleChange("manager");
                    login("manager", "suresh@expresselectronics.in", {
                      storeName: "Express Electronics",
                      address: "123 Anna Salai, Teynampet, Chennai, Tamil Nadu - 600018"
                    });
                  }}
                  className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-slate-800 block">AP-04 Manager</span>
                  <span className="text-[10px] text-slate-500">Express Electronics</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRoleChange("buyer");
                    login("buyer", "rahul.verma@example.com", {
                      address: "42 Eldams Road, Teynampet, Chennai, Tamil Nadu - 600018"
                    });
                  }}
                  className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-slate-800 block">Nearby Buyer</span>
                  <span className="text-[10px] text-slate-500">Rahul (3 km Chennai)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleRoleChange("warehouse");
                    login("warehouse", "warehouse@hien.io");
                  }}
                  className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-slate-800 block">Central Warehouse</span>
                  <span className="text-[10px] text-slate-500">Returns & custody</span>
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500 pt-1">
              New to HIEN?{" "}
              <button
                type="button"
                onClick={onGoToSignup}
                className="text-emerald-700 font-semibold hover:underline cursor-pointer ml-0.5"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900/80 py-4 text-center text-xs text-slate-500 font-mono">
        HIEN — Hyperlocal Reverse-Logistics Network Pilot
      </footer>
    </div>
  );
};
