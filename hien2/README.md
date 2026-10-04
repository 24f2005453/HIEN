<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a644c263-9410-4798-89fb-20c944a30b92

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Two-model return inspection

The manager scanner uses ONNX Runtime Web in the browser. Keep the trained models at:

- `public/best.onnx` — YOLO product detector; input `1×3×640×640`, output `1×204×8400`.
- `public/damage.onnx` — GOOD/DAMAGED classifier; input `1×3×224×224`, output `1×2`.

The detector's 200 output indices follow the `names:` order from `dataset_ready.yaml` and are recorded in `src/data/rpcProductClassIds.ts`. Product detections below `0.50` confidence are sent to review. The classifier output order is `0 = damaged`, `1 = good`; probabilities are accepted at a `0.70` threshold. A local shelf posting requires an exact identity mapping and a GOOD result. The current demo barcode SKUs do not map to RPC dataset classes, so they go to manual review instead of being treated as verified.

Camera inference runs locally in the browser. In the manager role, scan a barcode, allow camera access, then select **Run two-model inspection**.

## Barcode scanner on a phone

Live camera scanning requires a secure browser context (HTTPS, or localhost) and camera permission. A local Wi-Fi URL such as `http://172.x.x.x:3001/` is not secure, so mobile browsers block `getUserMedia`; open the app in Safari or Chrome, grant camera permission, and use an HTTPS deployment/tunnel for live camera access. The barcode reader uses `html5-qrcode` for EAN/UPC, Code 39/128 and QR decoding. When live camera access is blocked, **Scan barcode from photo** uses the phone photo/camera picker, and manual barcode/SKU lookup remains available. Photo and manual scanning require a matching entry in the app's barcode catalog.
