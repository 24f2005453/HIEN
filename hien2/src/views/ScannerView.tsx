import React, { useState } from "react";
import { BarcodeScanner } from "../components/scanner/BarcodeScanner";
import { AiOpticalGate } from "../components/scanner/AiOpticalGate";
import { BarcodeProductMatch } from "../types";
import { useApp } from "../context/AppContext";

export const ScannerView: React.FC = () => {
  const { setManagerTab } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [verifiedBarcodeProduct, setVerifiedBarcodeProduct] = useState<BarcodeProductMatch | null>(null);

  const handleBarcodeVerified = (match: BarcodeProductMatch) => {
    setVerifiedBarcodeProduct(match);
    setStep(2); // strictly start AI optical camera only after this!
  };

  const handleRetakeScan = () => {
    setVerifiedBarcodeProduct(null);
    setStep(1);
  };

  const handlePostSuccess = () => {
    // Finished posting
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
      {step === 1 || !verifiedBarcodeProduct ? (
        <BarcodeScanner onBarcodeVerified={handleBarcodeVerified} />
      ) : (
        <AiOpticalGate
          expectedProduct={verifiedBarcodeProduct}
          onPostSuccess={handlePostSuccess}
          onRetakeScan={handleRetakeScan}
        />
      )}
    </div>
  );
};
