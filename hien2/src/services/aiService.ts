import * as ort from "onnxruntime-web/wasm";
import { RPC_PRODUCT_CLASS_LABELS } from "../data/rpcProductClassIds";
import { AiInferenceResult, BarcodeProductMatch } from "../types";

const DETECTOR_SIZE = 640;
const CLASSIFIER_SIZE = 224;
const CLASS_COUNT = RPC_PRODUCT_CLASS_LABELS.length;
const DETECTION_COUNT = 8400;
const DETECTION_CONFIDENCE_THRESHOLD = 0.5;
const QUALITY_CONFIDENCE_THRESHOLD = 0.7;
const DAMAGE_CLASS_INDEX = 0;
const GOOD_CLASS_INDEX = 1;

interface ModelSessions {
  detector: ort.InferenceSession;
  classifier: ort.InferenceSession;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Detection {
  classIndex: number;
  confidence: number;
  box: BoundingBox;
}

let modelSessionsPromise: Promise<ModelSessions> | null = null;

const getModelAssetUrl = (fileName: string): string =>
  `${import.meta.env.BASE_URL}${fileName}`;

const assertTensorShape = (
  actual: readonly (number | string)[],
  expected: readonly number[],
  modelName: string,
  tensorName: string
): void => {
  if (actual.length !== expected.length || actual.some((dimension, index) => dimension !== expected[index])) {
    throw new Error(
      `${modelName} returned an unexpected ${tensorName} shape: [${actual.join(", ")}].`
    );
  }
};

const getMetadataShape = (
  metadata: ort.InferenceSession.ValueMetadata | undefined,
  modelName: string,
  tensorName: string
): readonly (number | string)[] => {
  if (!metadata || !metadata.isTensor) {
    throw new Error(`${modelName} is missing its ${tensorName} tensor metadata.`);
  }
  return metadata.shape;
};

const loadModels = async (): Promise<ModelSessions> => {
  ort.env.wasm.numThreads = 1;
  const sessionOptions: ort.InferenceSession.SessionOptions = {
    executionProviders: ["wasm"]
  };

  const [detector, classifier] = await Promise.all([
    ort.InferenceSession.create(getModelAssetUrl("best.onnx"), sessionOptions),
    ort.InferenceSession.create(getModelAssetUrl("damage.onnx"), sessionOptions)
  ]);

  assertTensorShape(
    getMetadataShape(detector.inputMetadata[0], "Product detector", "input"),
    [1, 3, DETECTOR_SIZE, DETECTOR_SIZE],
    "Product detector",
    "input"
  );
  assertTensorShape(
    getMetadataShape(detector.outputMetadata[0], "Product detector", "output"),
    [1, 4 + CLASS_COUNT, DETECTION_COUNT],
    "Product detector",
    "output"
  );
  assertTensorShape(
    getMetadataShape(classifier.inputMetadata[0], "Damage classifier", "input"),
    [1, 3, CLASSIFIER_SIZE, CLASSIFIER_SIZE],
    "Damage classifier",
    "input"
  );
  assertTensorShape(
    getMetadataShape(classifier.outputMetadata[0], "Damage classifier", "output"),
    [1, 2],
    "Damage classifier",
    "output"
  );

  return { detector, classifier };
};

const getModels = (): Promise<ModelSessions> => {
  if (!modelSessionsPromise) {
    modelSessionsPromise = loadModels().catch((error: unknown) => {
      modelSessionsPromise = null;
      throw error;
    });
  }
  return modelSessionsPromise;
};

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const tensorFromCanvas = (canvas: HTMLCanvasElement): ort.Tensor => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("The browser could not prepare an image for model inference.");
  }

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const planeSize = canvas.width * canvas.height;
  const tensorData = new Float32Array(planeSize * 3);

  for (let pixelIndex = 0; pixelIndex < planeSize; pixelIndex += 1) {
    const sourceIndex = pixelIndex * 4;
    tensorData[pixelIndex] = pixels[sourceIndex] / 255;
    tensorData[planeSize + pixelIndex] = pixels[sourceIndex + 1] / 255;
    tensorData[planeSize * 2 + pixelIndex] = pixels[sourceIndex + 2] / 255;
  }

  return new ort.Tensor("float32", tensorData, [1, 3, canvas.height, canvas.width]);
};

const prepareDetectorInput = (
  video: HTMLVideoElement
): { tensor: ort.Tensor; scale: number; offsetX: number; offsetY: number } => {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("The camera is not ready. Allow camera access and try again.");
  }

  const scale = Math.min(DETECTOR_SIZE / sourceWidth, DETECTOR_SIZE / sourceHeight);
  const resizedWidth = Math.round(sourceWidth * scale);
  const resizedHeight = Math.round(sourceHeight * scale);
  const offsetX = Math.floor((DETECTOR_SIZE - resizedWidth) / 2);
  const offsetY = Math.floor((DETECTOR_SIZE - resizedHeight) / 2);
  const canvas = createCanvas(DETECTOR_SIZE, DETECTOR_SIZE);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("The browser could not prepare a camera frame for product detection.");
  }

  context.fillStyle = "rgb(114, 114, 114)";
  context.fillRect(0, 0, DETECTOR_SIZE, DETECTOR_SIZE);
  context.imageSmoothingQuality = "high";
  context.drawImage(video, 0, 0, sourceWidth, sourceHeight, offsetX, offsetY, resizedWidth, resizedHeight);

  return { tensor: tensorFromCanvas(canvas), scale, offsetX, offsetY };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

const detectProduct = (
  output: ort.Tensor,
  scale: number,
  offsetX: number,
  offsetY: number,
  sourceWidth: number,
  sourceHeight: number
): Detection | null => {
  assertTensorShape(output.dims, [1, 4 + CLASS_COUNT, DETECTION_COUNT], "Product detector", "output");
  const values = output.data;
  if (!(values instanceof Float32Array)) {
    throw new Error("The product detector output is not float32.");
  }

  let bestDetection: Detection | null = null;
  for (let anchor = 0; anchor < DETECTION_COUNT; anchor += 1) {
    let classIndex = -1;
    let confidence = 0;

    for (let candidateClass = 0; candidateClass < CLASS_COUNT; candidateClass += 1) {
      const score = values[(candidateClass + 4) * DETECTION_COUNT + anchor];
      if (score > confidence) {
        confidence = score;
        classIndex = candidateClass;
      }
    }

    if (confidence < DETECTION_CONFIDENCE_THRESHOLD || confidence <= (bestDetection?.confidence ?? 0)) {
      continue;
    }

    const centerX = values[anchor];
    const centerY = values[DETECTION_COUNT + anchor];
    const width = values[DETECTION_COUNT * 2 + anchor];
    const height = values[DETECTION_COUNT * 3 + anchor];
    const x1 = clamp((centerX - width / 2 - offsetX) / scale, 0, sourceWidth);
    const y1 = clamp((centerY - height / 2 - offsetY) / scale, 0, sourceHeight);
    const x2 = clamp((centerX + width / 2 - offsetX) / scale, 0, sourceWidth);
    const y2 = clamp((centerY + height / 2 - offsetY) / scale, 0, sourceHeight);

    if (x2 <= x1 || y2 <= y1) {
      continue;
    }

    bestDetection = {
      classIndex,
      confidence,
      box: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
    };
  }

  return bestDetection;
};

const prepareProductCrop = (
  video: HTMLVideoElement,
  box: BoundingBox
): { tensor: ort.Tensor; preview: string } => {
  const padding = 0.08;
  const side = Math.max(box.width, box.height) * (1 + padding * 2);
  const cropWidth = Math.min(side, video.videoWidth);
  const cropHeight = Math.min(side, video.videoHeight);
  const sourceX = clamp(box.x + box.width / 2 - cropWidth / 2, 0, video.videoWidth - cropWidth);
  const sourceY = clamp(box.y + box.height / 2 - cropHeight / 2, 0, video.videoHeight - cropHeight);
  const canvas = createCanvas(CLASSIFIER_SIZE, CLASSIFIER_SIZE);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("The browser could not crop the detected product.");
  }

  context.imageSmoothingQuality = "high";
  context.drawImage(
    video,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    CLASSIFIER_SIZE,
    CLASSIFIER_SIZE
  );

  return { tensor: tensorFromCanvas(canvas), preview: canvas.toDataURL("image/jpeg", 0.85) };
};

const normalizeLabel = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const getExpectedClassIndex = (product: BarcodeProductMatch): number => {
  const expectedNames = new Set([
    normalizeLabel(product.sku),
    normalizeLabel(product.expectedName)
  ]);
  return RPC_PRODUCT_CLASS_LABELS.findIndex((label) => expectedNames.has(normalizeLabel(label)));
};

const readQualityProbabilities = (output: ort.Tensor): [number, number] => {
  assertTensorShape(output.dims, [1, 2], "Damage classifier", "output");
  if (!(output.data instanceof Float32Array) || output.data.length !== 2) {
    throw new Error("The damage classifier output must contain two float32 probabilities.");
  }

  const damagedProbability = output.data[DAMAGE_CLASS_INDEX];
  const goodProbability = output.data[GOOD_CLASS_INDEX];
  const probabilitySum = damagedProbability + goodProbability;
  if (
    !Number.isFinite(damagedProbability) ||
    !Number.isFinite(goodProbability) ||
    damagedProbability < 0 ||
    goodProbability < 0 ||
    damagedProbability > 1 ||
    goodProbability > 1 ||
    Math.abs(probabilitySum - 1) > 0.02
  ) {
    throw new Error("The damage classifier did not return a valid normalized probability pair.");
  }

  return [damagedProbability, goodProbability];
};

export class AiVerificationService {
  public static async initializeModels(): Promise<void> {
    await getModels();
  }

  public static async analyzeFrame(
    video: HTMLVideoElement,
    expectedProduct: BarcodeProductMatch
  ): Promise<AiInferenceResult> {
    const { detector, classifier } = await getModels();
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const preparedFrame = prepareDetectorInput(video);
    const detectorOutputs = await detector.run({ images: preparedFrame.tensor });
    const detected = detectProduct(
      detectorOutputs.output0,
      preparedFrame.scale,
      preparedFrame.offsetX,
      preparedFrame.offsetY,
      sourceWidth,
      sourceHeight
    );

    const expectedClassIndex = getExpectedClassIndex(expectedProduct);
    if (!detected) {
      return {
        detectedProduct: "No product detected",
        detectedClassIndex: null,
        expectedClassIndex: expectedClassIndex < 0 ? null : expectedClassIndex,
        confidence: 0,
        condition: null,
        conditionConfidence: 0,
        qualityStatus: "UNCERTAIN",
        goodProbability: 0,
        damagedProbability: 0,
        croppedImage: null,
        isIdentityMatch: null,
        decision: "REVIEW"
      };
    }

    const productCrop = prepareProductCrop(video, detected.box);
    const classifierOutputs = await classifier.run({ images: productCrop.tensor });
    const [damagedProbability, goodProbability] = readQualityProbabilities(classifierOutputs.output0);
    const conditionConfidence = Math.max(damagedProbability, goodProbability);
    const qualityStatus =
      conditionConfidence < QUALITY_CONFIDENCE_THRESHOLD
        ? "UNCERTAIN"
        : damagedProbability >= goodProbability
        ? "DAMAGED"
        : "GOOD";
    const isIdentityMatch =
      expectedClassIndex < 0 ? null : detected.classIndex === expectedClassIndex;
    const decision =
      qualityStatus === "DAMAGED"
        ? "REJECT"
        : qualityStatus === "UNCERTAIN" || !detected || isIdentityMatch === null
        ? "REVIEW"
        : isIdentityMatch
        ? "PASS"
        : "REJECT";

    return {
      detectedProduct: RPC_PRODUCT_CLASS_LABELS[detected.classIndex],
      detectedClassIndex: detected.classIndex,
      expectedClassIndex: expectedClassIndex < 0 ? null : expectedClassIndex,
      confidence: detected.confidence,
      condition: qualityStatus === "GOOD" ? "Good" : qualityStatus === "DAMAGED" ? "Damaged" : null,
      conditionConfidence,
      qualityStatus,
      goodProbability,
      damagedProbability,
      croppedImage: productCrop.preview,
      isIdentityMatch,
      decision
    };
  }
}
