import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats
} from "html5-qrcode";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Flashlight,
  Keyboard,
  RotateCcw,
  Sparkles,
  SwitchCamera,
  Zap
} from "lucide-react";
import { BarcodeService } from "../../services/barcodeService";
import { BarcodeProductMatch } from "../../types";
import { useApp } from "../../context/AppContext";

interface Props {
  onBarcodeVerified: (match: BarcodeProductMatch) => void;
  onCancel?: () => void;
}

export const BarcodeScanner: React.FC<Props> = ({ onBarcodeVerified, onCancel }) => {
  const { currentAccessPoint, setManagerTab } = useApp();

  const [verifiedMatch, setVerifiedMatch] = useState<BarcodeProductMatch | null>(null);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isPhotoScanning, setIsPhotoScanning] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [cameraRetryKey, setCameraRetryKey] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileScannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle successful barcode detection
  const handleBarcodeDecoded = useCallback(
    (decodedString: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      const matchedProduct = BarcodeService.resolveBarcode(decodedString);
      if (matchedProduct) {
        if (scannerRef.current?.isScanning) {
          void scannerRef.current.stop().catch((error: unknown) => {
            console.error("Could not stop the barcode camera after a successful scan.", error);
          });
        }
        setVerifiedMatch(matchedProduct);
      } else {
        setFeedbackNotice(`Barcode '${decodedString}' not found in master catalog.`);
        setTimeout(() => setFeedbackNotice(null), 3200);
      }
      isProcessingRef.current = false;
    },
    []
  );

  // Start the browser-compatible barcode decoder after checking camera security requirements.
  useEffect(() => {
    setCameraReady(false);
    setCameraError(null);

    if (!window.isSecureContext) {
      setCameraError(
        "Browser security blocks camera access on this HTTP network address. Open HIEN over HTTPS, or use Scan from photo / Enter Barcode Manually."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "This browser or embedded webview does not provide camera access (getUserMedia). Open this page in Safari or Chrome over HTTPS, or use Scan from photo / Enter Barcode Manually."
      );
      return;
    }

    let cancelled = false;
    const scanner = new Html5Qrcode("barcode-camera-reader", {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE
      ],
      useBarCodeDetectorIfSupported: true
    });
    scannerRef.current = scanner;

    void scanner
      .start(
        { facingMode },
        {
          fps: 10,
          aspectRatio: 4 / 3,
          qrbox: (width, height) => ({
            width: Math.round(width * 0.88),
            height: Math.round(height * 0.35)
          })
        },
        (decodedText) => handleBarcodeDecoded(decodedText),
        () => undefined
      )
      .then(async () => {
        if (cancelled) {
          await scanner.stop();
          return;
        }
        setCameraReady(true);
        setCameraError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCameraReady(false);
          const message = error instanceof Error ? error.message : String(error);
          const lowerMessage = message.toLowerCase();
          if (lowerMessage.includes("getusermedia") && lowerMessage.includes("not implemented")) {
            setCameraError(
              "This browser or embedded webview does not implement camera access. Open HIEN in Safari or Chrome over HTTPS, or use Scan from photo / Enter Barcode Manually."
            );
          } else if (lowerMessage.includes("permission") || lowerMessage.includes("denied")) {
            setCameraError(
              "Camera permission was denied. Allow camera access for this site in browser settings, then retry."
            );
          } else if (!window.isSecureContext) {
            setCameraError(
              "Browser security blocks camera access on this HTTP network address. Open HIEN over HTTPS, or use Scan from photo / Enter Barcode Manually."
            );
          } else {
            setCameraError(`Could not start the camera: ${message}`);
          }
        }
      });

    return () => {
      cancelled = true;
      if (scanner.isScanning) {
        void scanner.stop().catch((error: unknown) => {
          console.error("Could not stop the barcode scanner cleanly.", error);
        });
      }
      scannerRef.current = null;
    };
  }, [cameraRetryKey, facingMode, handleBarcodeDecoded]);

  // Flip Camera (Front / Rear)
  const toggleCameraFacing = async () => {
    setCameraReady(false);
    const scanner = scannerRef.current;
    if (scanner?.isScanning) {
      try {
        await scanner.stop();
      } catch (error) {
        console.error("Could not stop the current camera before switching lenses.", error);
        setCameraError("Could not switch cameras. Retry the scanner or use photo/manual barcode entry.");
        return;
      }
    }
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Torch toggle (if supported by active track)
  const toggleTorch = async () => {
    try {
      const next = !torchOn;
      await scannerRef.current?.applyVideoConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet]
      });
      setTorchOn(next);
    } catch (error) {
      console.warn("Torch constraint is unavailable on this camera.", error);
      setFeedbackNotice("Flashlight control is not supported by this camera.");
      setTimeout(() => setFeedbackNotice(null), 3200);
    }
  };

  const scanBarcodePhoto = async (file: File) => {
    setIsPhotoScanning(true);
    setFeedbackNotice(null);
    try {
      const fileScanner =
        fileScannerRef.current ??
        new Html5Qrcode("barcode-photo-file-decoder", { verbose: false });
      fileScannerRef.current = fileScanner;
      const decodedValue = await fileScanner.scanFile(file, false);
      handleBarcodeDecoded(decodedValue);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedbackNotice(`No supported barcode could be read from that photo. Try a sharper, well-lit image. ${message}`);
      setTimeout(() => setFeedbackNotice(null), 5000);
    } finally {
      setIsPhotoScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sampleBarcodes = BarcodeService.getSampleBarcodes();

  const handleManualSearch = (codeToSearch?: string) => {
    const target = codeToSearch || manualInput;
    if (!target.trim()) return;

    const match = BarcodeService.resolveBarcode(target);
    if (match) {
      setVerifiedMatch(match);
      setShowManualModal(false);
    } else {
      setFeedbackNotice(`Barcode '${target}' not found in catalog.`);
      setTimeout(() => setFeedbackNotice(null), 3000);
    }
  };

  // SUCCESS STATE (Section 16: Barcode Verified, Nike Air Zoom, SKU: NIKE-AZ-10, [ Continue to AI Verification ])
  if (verifiedMatch) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 animate-fade-in">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          {/* Small green success indicator */}
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Barcode Verified</span>
          </div>

          {/* Product details */}
          <div className="flex items-start gap-4">
            <img
              src={verifiedMatch.imageUrl}
              alt={verifiedMatch.expectedName}
              className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0"
            />
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">{verifiedMatch.expectedName}</h2>
              <p className="text-sm font-medium text-slate-600">
                Size {verifiedMatch.sizeOrVariant.replace(/Size\s*/i, "")}
              </p>
              <p className="text-xs font-mono text-slate-500">
                SKU: <strong className="text-slate-800">{verifiedMatch.sku}</strong> ·{" "}
                {verifiedMatch.barcode}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-900 block mb-0.5">Physical Barcode Validated</strong>
            Proceeding to live edge optical inspection to verify the actual product inside the box matches the SKU.
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => onBarcodeVerified(verifiedMatch)}
              className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <span>Continue to AI Verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setVerifiedMatch(null);
                setCameraReady(false);
              }}
              className="w-full sm:w-auto py-3 px-5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors cursor-pointer"
            >
              Scan Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE SCANNER UI (Section 14: Deep Navy #0B1220, Edge-to-edge camera, corner brackets, ALIGN BARCODE)
  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#0B1220] text-white flex flex-col justify-between rounded-2xl overflow-hidden shadow-lg border border-slate-800/80 relative animate-fade-in">
      {/* Top Bar: Back, Title, Access Point Code */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800/80 z-20 bg-[#0B1220]/95 backdrop-blur-md">
        <button
          onClick={() => {
            if (onCancel) onCancel();
            else setManagerTab("dashboard");
          }}
          className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Scan Return</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {currentAccessPoint.code}
          </span>
          <span className="text-slate-400">Step 1 of 2</span>
        </div>
      </div>

      {/* Main Viewfinder Canvas / Camera Area */}
      <div className="relative flex-1 flex flex-col items-center justify-center min-h-[380px] sm:min-h-[460px] overflow-hidden bg-[#0B1220]">
        {/* Live Video Feed using react-webcam */}
        <div
          id="barcode-camera-reader"
          className="absolute inset-0 w-full h-full overflow-hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
        <div id="barcode-photo-file-decoder" className="hidden" />

        {/* Camera Permission / Error Fallback */}
        {cameraError && (
          <div className="relative z-20 max-w-sm mx-auto p-6 bg-[#111A2E] border border-slate-700 rounded-2xl text-center space-y-4 m-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Camera unavailable</h3>
              <p className="text-xs text-slate-400 mt-1">{cameraError}</p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => {
                  setCameraRetryKey((value) => value + 1);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer border border-slate-700"
              >
                Scan from Photo
              </button>
            </div>
          </div>
        )}

        {/* Loading / Requesting Status */}
        {!cameraReady && !cameraError && (
          <div className="relative z-10 text-center space-y-2 bg-[#0B1220]/80 p-4 rounded-xl border border-slate-800">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-300 font-mono">Activating device camera...</p>
          </div>
        )}

        {/* Scanner Viewfinder Overlay with subtle corner brackets (Section 14) */}
        <div className="relative z-10 w-full max-w-xs sm:max-w-sm aspect-[4/3] flex flex-col items-center justify-between p-4 pointer-events-none select-none">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-400 rounded-br-lg shadow-[0_0_8px_rgba(16,185,129,0.3)]" />

          {/* Laser scanning beam */}
          <div className="absolute inset-x-6 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#10B981] animate-pulse" />

          {/* Center instructions */}
          <div className="text-center mt-2">
            <span className="text-[11px] font-mono tracking-widest uppercase font-bold text-white bg-slate-900/85 px-3 py-1 rounded backdrop-blur-sm border border-slate-700/80 shadow-xs">
              ALIGN BARCODE
            </span>
          </div>

          <div className="text-center mb-2">
            <span className="text-[11px] text-slate-300 bg-slate-900/85 px-3 py-1 rounded backdrop-blur-sm border border-slate-800">
              Keep the barcode inside the frame.
            </span>
          </div>
        </div>

        {/* Top-Right Controls: Camera switch & Torch */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={toggleCameraFacing}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer backdrop-blur-sm"
            title="Switch Camera (Front / Rear)"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          <button
            onClick={toggleTorch}
            className={`p-2.5 rounded-xl border text-xs transition-colors cursor-pointer backdrop-blur-sm ${
              torchOn
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-slate-900/80 text-slate-300 border-slate-700 hover:text-white"
            }`}
            title="Toggle Flashlight"
          >
            <Flashlight className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Feedback Notice */}
        {feedbackNotice && (
          <div className="absolute bottom-6 z-30 px-4 py-2 rounded-xl bg-rose-950/90 text-rose-200 border border-rose-800 text-xs font-medium flex items-center gap-2 shadow-lg animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{feedbackNotice}</span>
          </div>
        )}
      </div>

      {/* Bottom Controls (Section 14: Scanning..., [ Enter Barcode Manually ]) */}
      <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-[#0B1220] z-20 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                cameraReady ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span className="text-slate-400 font-mono text-[11px]">
              {cameraReady ? "Camera active · Scanning live frames..." : "Initializing camera..."}
            </span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isPhotoScanning ? "Reading photo…" : "Scan barcode from photo"}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void scanBarcodePhoto(file);
            }}
          />
          <button
            onClick={() => setShowManualModal(true)}
            className="text-xs text-slate-400 hover:text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Enter manually</span>
          </button>
        </div>

        {/* Quick Demo Simulator Bar: Click any catalog item to instantly simulate barcode capture */}
        <div className="pt-2 border-t border-slate-800/60">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate Barcode Feed (One-Click Scan):</span>
            </p>
            <span className="text-[10px] text-slate-500 font-mono">Hackathon demo tools</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            {sampleBarcodes.map((item) => (
              <button
                key={item.sku}
                onClick={() => handleBarcodeDecoded(item.barcode)}
                className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-750 border border-slate-700 text-slate-200 whitespace-nowrap text-left flex items-center gap-2 transition-all cursor-pointer shrink-0 hover:border-emerald-500/50"
              >
                <Zap className="w-3 h-3 text-emerald-400" />
                <span className="font-semibold text-white">{item.expectedName}</span>
                <span className="font-mono text-[10px] text-emerald-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {item.sku}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Manual Barcode Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 text-slate-900 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-emerald-600" />
                <span>Enter Barcode or SKU</span>
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Barcode Number / Product SKU
              </label>
              <input
                type="text"
                autoFocus
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                placeholder="e.g. NIKE-AZ-10 or 890123456789"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleManualSearch()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                Lookup SKU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
