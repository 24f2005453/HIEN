import React, { useState } from "react";
import { useApp } from "./context/AppContext";
import { Header } from "./components/common/Header";
import { Navigation } from "./components/common/Navigation";
import { MockCallModal } from "./components/common/MockCallModal";
import { LoginView } from "./views/LoginView";
import { SignupView } from "./views/SignupView";

// Manager Views
import { ManagerDashboard } from "./views/ManagerDashboard";
import { ScannerView } from "./views/ScannerView";
import { ManagerInventory } from "./views/ManagerInventory";
import { ManagerReservations } from "./views/ManagerReservations";
import { ManagerPickups } from "./views/ManagerPickups";
import { ManagerProfile } from "./views/ManagerProfile";

// Buyer Views
import { BuyerDeals } from "./views/BuyerDeals";
import { BuyerReservations } from "./views/BuyerReservations";
import { BuyerReturns } from "./views/BuyerReturns";
import { BuyerProfile } from "./views/BuyerProfile";
import { ProductDetails } from "./views/ProductDetails";

// Shared Views
import { MessagesView } from "./views/MessagesView";
import { WarehouseDashboard } from "./views/WarehouseDashboard";

export const App: React.FC = () => {
  const {
    isAuthenticated,
    role,
    managerTab,
    buyerTab,
    selectedProductId,
    setSelectedProductId
  } = useApp();

  const [showSignup, setShowSignup] = useState(false);

  // Safe fallback 1: Unauthenticated
  if (!isAuthenticated) {
    if (showSignup) {
      return <SignupView onGoToLogin={() => setShowSignup(false)} />;
    }
    return <LoginView onGoToSignup={() => setShowSignup(true)} />;
  }

  // Render Manager Role Application
  const renderManagerContent = () => {
    switch (managerTab) {
      case "dashboard":
        return <ManagerDashboard />;
      case "scan":
        return <ScannerView />;
      case "inventory":
        return <ManagerInventory />;
      case "reservations":
        return <ManagerReservations />;
      case "pickups":
        return <ManagerPickups />;
      case "messages":
        return <MessagesView />;
      case "profile":
        return <ManagerProfile />;
      default:
        return <ManagerDashboard />;
    }
  };

  // Render Buyer Role Application
  const renderBuyerContent = () => {
    // If a product is actively selected for detail inspection
    if (selectedProductId) {
      return (
        <ProductDetails
          productId={selectedProductId}
          onBack={() => setSelectedProductId(null)}
        />
      );
    }

    switch (buyerTab) {
      case "deals":
        return <BuyerDeals />;
      case "reservations":
        return <BuyerReservations />;
      case "returns":
        return <BuyerReturns />;
      case "messages":
        return <MessagesView />;
      case "profile":
        return <BuyerProfile />;
      default:
        return <BuyerDeals />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Application Header */}
      <Header />

      {/* Navigation Sub-Bar (Desktop Top, Mobile Bottom) */}
      <Navigation />

      {/* Main Role Content View with padding for bottom mobile nav (Target: 390 × 844) */}
      <main className="flex-1 pb-24 md:pb-8">
        {role === "manager"
          ? renderManagerContent()
          : role === "buyer"
            ? renderBuyerContent()
            : <WarehouseDashboard />}
      </main>

      {/* Persistent Mock Call Overlay Modal */}
      <MockCallModal />
    </div>
  );
};

export default App;
