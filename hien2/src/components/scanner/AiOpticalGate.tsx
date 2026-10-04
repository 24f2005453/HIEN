import React, { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { AlertTriangle, CheckCircle2, Cpu, PackageCheck, ScanLine, XCircle } from "lucide-react";
import { AiVerificationService } from "../../services/aiService";
import { AiInferenceResult, BarcodeProductMatch } from "../../types";
import { useApp } from "../../context/AppContext";

interface Props {
  expectedProduct: BarcodeProductMatch;
  onPostSuccess: () => void;
  onRetakeScan: () => void;
}

type ModelStatus = "loading" | "ready" | "error";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The camera frame could not be inspected.";

export const AiOpticalGate: React.FC<Props> = ({
  expectedProduct,
  onPostSuccess,
  onRetakeScan
}) => {
  const { currentAccessPoint, postNewProduct, setManagerTab } = useApp();
  const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [result, setResult] = useState<AiInferenceResult | null>(null);
  const [postedSuccess, setPostedSuccess] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    let isMounted = true;
    AiVerificationService.initializeModels()
      .then(() => {
        if (isMounted) {
          setModelStatus("ready");
          setModelError(null);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setModelStatus("error");
          setModelError(getErrorMessage(error));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const retryModelLoad = useCallback(() => {
    setModelStatus("loading");
    setModelError(null);
    AiVerificationService.initializeModels()
      .then(() => setModelStatus("ready"))
      .catch((error: unknown) => {
        setModelStatus("error");
        setModelError(getErrorMessage(error));
      });
  }, []);

  const inspectCurrentFrame = useCallback(async () => {
    const video = webcamRef.current?.video;
    if (!video || video.readyState < 2) {
      setInferenceError("Camera video is not ready. Allow access and wait for the preview before inspecting.");
      return;
    }

    setIsInspecting(true);
    setInferenceError(null);
    setResult(null);
    try {
      const inferenceResult = await AiVerificationService.analyzeFrame(video, expectedProduct);
      setResult(inferenceResult);
    } catch (error: unknown) {
      setInferenceError(getErrorMessage(error));
    } finally {
      setIsInspecting(false);
    }
  }, [expectedProduct]);

  const postVerifiedProduct = useCallback(() => {
    if (!result || result.decision !== "PASS" || result.condition !== "Good") {
      return;
    }

    postNewProduct({
      name: expectedProduct.expectedName,
      sku: expectedProduct.sku,
      barcode: expectedProduct.barcode,
      category: expectedProduct.category,
      sizeOrVariant: expectedProduct.sizeOrVariant,
      originalPrice: expectedProduct.originalPrice,
      openBoxPrice: expectedProduct.openBoxPrice,
      condition: result.condition,
      aiConfidence: Math.round(result.confidence * 100),
      imageUrl: expectedProduct.imageUrl,
      demandLevel: "MEDIUM"
    });
    setPostedSuccess(true);
    onPostSuccess();
  }, [expectedProduct, onPostSuccess, postNewProduct, result]);

  if (postedSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 animate-fade-in">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border bg-emerald-50 text-emerald-600 border-emerald-100">
            <PackageCheck className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              QA PASS · VERIFIED MATCH
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">PRODUCT POSTED</h2>
            <p className="text-sm font-semibold text-slate-700 mt-1">
              {expectedProduct.expectedName} · {expectedProduct.sizeOrVariant}
            </p>
            <p className="text-lg font-bold text-emerald-600 mt-1">
              ₹{expectedProduct.openBoxPrice.toLocaleString("en-IN")}{" "}
              <span className="text-xs text-slate-400 font-normal line-through">
                ₹{expectedProduct.originalPrice.toLocaleString("en-IN")}
              </span>
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 border border-slate-200 text-left space-y-1">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Access Point:</span>
              <strong className="text-slate-800 text-right">
                {currentAccessPoint.code} · {currentAccessPoint.name}
              </strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Identity confidence:</span>
              <strong className="text-emerald-700">
                {Math.round((result?.confidence ?? 0) * 100)}%
              </strong>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => setManagerTab("inventory")}
              className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors cursor-pointer shadow-xs"
            >
              View Inventory
            </button>
            <button
              onClick={onRetakeScan}
              className="w-full sm:w-auto py-3 px-5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors cursor-pointer"
            >
              Scan Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const decisionStyle =
    result?.decision === "PASS"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : result?.decision === "REJECT"
      ? "bg-rose-50 text-rose-800 border-rose-200"
      : "bg-amber-50 text-amber-900 border-amber-200";

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 font-bold border border-cyan-200">
              STEP 2 OF 2
            </span>
            <span className="text-xs font-mono text-slate-500">Two-model QA inspection</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">LIVE AI OPTICAL GATE</h1>
        </div>
        <div
          role="status"
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-2 border ${
            modelStatus === "ready"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : modelStatus === "error"
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : "bg-slate-900 text-cyan-300 border-slate-700"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>
            {modelStatus === "ready"
              ? "BOTH MODELS READY"
              : modelStatus === "error"
              ? "MODEL LOAD FAILED"
              : "LOADING ONNX MODELS"}
          </span>
        </div>
      </div>

      {modelError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Could not load the ONNX models.</p>
          <p className="mt-1 break-words">{modelError}</p>
          <button
            onClick={retryModelLoad}
            className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100"
          >
            Retry model loading
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-mono font-bold uppercase text-slate-500">Barcode identity</p>
            <p className="mt-1 font-semibold text-slate-900">{expectedProduct.expectedName}</p>
            <p className="mt-0.5 font-mono text-slate-500">{expectedProduct.sku}</p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3">
            <p className="font-mono font-bold uppercase text-cyan-800">Model pipeline</p>
            <p className="mt-1 text-slate-700">best.onnx · 200-class product detection</p>
            <p className="mt-0.5 text-slate-700">damage.onnx · GOOD / DAMAGED crop classification</p>
          </div>
        </div>
      </div>

      <div className="relative bg-[#0B1220] rounded-2xl border border-slate-800 overflow-hidden shadow-sm aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center">
        <Webcam
          ref={webcamRef}
          audio={false}
          className="absolute inset-0 w-full h-full object-cover"
          videoConstraints={{ facingMode: { ideal: "environment" } }}
          onUserMedia={() => {
            setCameraReady(true);
            setCameraError(null);
          }}
          onUserMediaError={(error) => {
            setCameraReady(false);
            setCameraError(
              error instanceof Error
                ? error.message
                : "Camera access is unavailable. Check browser permissions and try again."
            );
          }}
        />
        {!cameraReady && !cameraError && (
          <div className="relative z-10 rounded-xl bg-slate-900/90 px-4 py-3 text-center text-sm text-slate-200">
            Waiting for camera permission…
          </div>
        )}
        {cameraError && (
          <div role="alert" className="relative z-10 mx-4 max-w-md rounded-xl bg-slate-950/90 p-4 text-center text-sm text-rose-200">
            {cameraError}
          </div>
        )}
        {result?.croppedImage && (
          <div className="absolute right-3 top-3 z-10 rounded-lg border border-cyan-400 bg-slate-950/90 p-1.5 shadow-lg">
            <img src={result.croppedImage} alt="Detected product crop sent to damage classifier" className="h-20 w-20 rounded object-cover" />
            <p className="mt-1 text-center text-[9px] font-mono text-cyan-200">MODEL 2 CROP</p>
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 z-10 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/80 p-3.5 text-white flex items-center justify-between gap-3 text-xs">
          <div className="min-w-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Detected RPC class</span>
            <p className="font-bold text-white text-sm truncate">{result?.detectedProduct ?? "Awaiting inspection"}</p>
          </div>
          <div className="text-center shrink-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Detection</span>
            <p className="font-mono font-bold text-sm">
              {result?.detectedClassIndex === null || !result ? "—" : `${Math.round(result.confidence * 100)}%`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">QA decision</span>
            <span className="inline-flex items-center gap-1 font-bold text-xs">
              {result?.decision ?? "NOT RUN"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={inspectCurrentFrame}
          disabled={modelStatus !== "ready" || !cameraReady || isInspecting}
          className="flex-1 py-3 px-6 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <ScanLine className="w-4 h-4" />
          {isInspecting ? "Running both models…" : result ? "Inspect current frame again" : "Run two-model inspection"}
        </button>
        <button
          type="button"
          onClick={onRetakeScan}
          className="py-3 px-5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold"
        >
          Scan another barcode
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Inference runs locally in this browser. Model 1 detects the product; only its detected crop is passed to Model 2.
      </p>

      {inferenceError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Inspection failed.</p>
          <p className="mt-1 break-words">{inferenceError}</p>
        </div>
      )}

      {result && (
        <div className={`rounded-2xl border p-5 shadow-sm space-y-4 ${decisionStyle}`}>
          <div className="flex items-center justify-between gap-3 border-b border-current/10 pb-3">
            <div className="flex items-center gap-2">
              {result.decision === "PASS" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : result.decision === "REJECT" ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              <h2 className="text-sm font-bold">QA {result.decision}</h2>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase">
              {result.decision === "PASS" ? "Identity + quality accepted" : "Not published"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-current/10 bg-white/70 p-3">
              <p className="font-mono font-bold uppercase opacity-70">Model 1 · Identity</p>
              <p className="mt-1 font-semibold break-all">{result.detectedProduct}</p>
              <p className="mt-1">
                {result.isIdentityMatch === null
                  ? "Barcode SKU has no RPC class mapping"
                  : result.isIdentityMatch
                  ? "Matches expected barcode class"
                  : "Does not match expected barcode class"}
              </p>
              <p className="mt-1 opacity-80">Confidence: {Math.round(result.confidence * 100)}%</p>
            </div>

            <div className="rounded-xl border border-current/10 bg-white/70 p-3">
              <p className="font-mono font-bold uppercase opacity-70">Model 2 · Quality</p>
              <p className="mt-1 font-semibold">{result.qualityStatus}</p>
              <p className="mt-1">GOOD: {Math.round(result.goodProbability * 100)}%</p>
              <p>DAMAGED: {Math.round(result.damagedProbability * 100)}%</p>
              <p className="mt-1 opacity-80">Acceptance threshold: 70%</p>
            </div>

            <div className="rounded-xl border border-current/10 bg-white/70 p-3">
              <p className="font-mono font-bold uppercase opacity-70">Combined decision</p>
              <p className="mt-1 font-semibold">
                {result.decision === "PASS"
                  ? "Exact identity match and GOOD ≥70%"
                  : result.decision === "REJECT"
                  ? result.qualityStatus === "DAMAGED"
                    ? "DAMAGED ≥70% or identity mismatch"
                    : "Identity mismatch"
                  : "Identity mapping, detection, or quality is inconclusive"}
              </p>
            </div>
          </div>

          {result.decision === "PASS" ? (
            <button
              type="button"
              onClick={postVerifiedProduct}
              className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xs"
            >
              QA PASS · Place on Local Shelf
            </button>
          ) : (
            <p className="text-xs font-medium">
              This item was not posted. Rescan or send it for manual inspection; unmatched RPC classes are never auto-approved.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
