export type UserRole = "manager" | "buyer" | "warehouse";

export type WarehousePickupStatus =
  | "AWAITING_ACCESS_POINT"
  | "STORED_AT_ACCESS_POINT"
  | "COLLECTION_SCHEDULED"
  | "IN_TRANSIT_TO_WAREHOUSE"
  | "RECEIVED_AT_WAREHOUSE";

export interface WarehouseCustodyEvent {
  id: string;
  status: WarehousePickupStatus;
  timestamp: string;
  actor: string;
}

export type ProductStatus =
  | "VERIFIED"
  | "AVAILABLE"
  | "RESERVED"
  | "READY_FOR_PICKUP"
  | "SOLD"
  | "ROUTED_TO_CENTRAL"
  | "MISMATCH_RETURN"
  | "EXPIRED";

export type ProductCondition =
  | "Pristine"
  | "Good"
  | "Minor Damage"
  | "Damaged";

export type DemandLevel = "HIGH" | "MEDIUM" | "LOW";

export type VerificationDecision =
  | "APPROVE"
  | "MISMATCH_RETURN"
  | "REVIEW"
  | "REJECT"
  | "CENTRAL_ROUTING";

export interface AccessPoint {
  id: string;
  code: string;
  name: string;
  address: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  sizeOrVariant?: string;
  originalPrice: number;
  openBoxPrice: number;
  discountPercentage: number;
  condition: ProductCondition;
  conditionDetails?: {
    surface: string;
    packaging: string;
  };
  aiConfidence: number;
  status: ProductStatus;
  accessPointId: string;
  imageUrl: string;
  createdAt: string;
  reservedAt?: string;
  reservedByBuyerId?: string;
  reservedByBuyerName?: string;
  demandLevel?: DemandLevel;

  // New Mismatch Return business logic properties
  isMismatchReturn?: boolean;
  originalBarcodeProduct?: {
    name: string;
    sku: string;
    barcode: string;
  };
  aiDetectedProduct?: {
    name: string;
    sku: string;
    confidence: number;
  };
}

export type ReservationStatus =
  | "RESERVED"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "CANCELLED";

export interface Reservation {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productPrice: number;
  productImageUrl: string;
  accessPointId: string;
  accessPointName: string;
  accessPointCode: string;
  buyerId: string;
  buyerName: string;
  buyerPhone?: string;
  status: ReservationStatus;
  reservedAt: string;
  updatedAt: string;
}

export type PickupStatus =
  | "RETURN_REQUESTED"
  | "LOCATION_SHARED"
  | "PICKUP_ASSIGNED"
  | "PICKUP_ACCEPTED"
  | "PICKUP_IN_PROGRESS"
  | "ARRIVING"
  | "ARRIVED"
  | "PRODUCT_COLLECTED"
  | "REFUND_PROCESSING"
  | "REFUND_INITIATED"
  | "COMPLETED"
  | "CANCELLED";

export interface LiveCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
}

export interface ReturnOrder {
  id: string; // e.g. "RET-1042"
  orderNumber: string; // e.g. "ORD-99214"
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl: string;
  refundAmount: number;
  returnerId: string;
  returnerName: string;
  returnerPhone: string;
  accessPointId: string;
  accessPointName: string;
  accessPointCode: string;
  status: PickupStatus;
  pickupAddress: string;
  pickupLocation: LiveCoordinates;
  locationSharingEnabled: boolean;
  pickupPersonId?: string;
  pickupPersonName?: string;
  pickupPersonPhone?: string;
  pickupPersonLocation?: LiveCoordinates;
  vehicleNumber?: string;
  etaMinutes?: number;
  distanceKm?: number;
  createdAt: string;
  collectedAt?: string;
  refundCompletedAt?: string;
  isDemoMovement?: boolean;
  warehousePickupStatus?: WarehousePickupStatus;
  warehouseCustodyEvents?: WarehouseCustodyEvent[];
}

export interface Message {
  id: string;
  senderId: string;
  senderRole: UserRole | "pickup_partner";
  senderName: string;
  text: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  buyerId: string;
  buyerName: string;
  accessPointId: string;
  accessPointName: string;
  accessPointCode: string;
  productId?: string;
  productName?: string;
  productImageUrl?: string;
  returnOrderId?: string;
  lastMessageSnippet: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  accessPointId?: string;
  address?: string;
}

export interface BarcodeProductMatch {
  barcode: string;
  expectedName: string;
  sizeOrVariant: string;
  sku: string;
  originalPrice: number;
  openBoxPrice: number;
  imageUrl: string;
  category: string;
}

export interface AiInferenceResult {
  detectedProduct: string;
  detectedClassIndex: number | null;
  expectedClassIndex: number | null;
  confidence: number;
  condition: ProductCondition | null;
  conditionConfidence: number;
  qualityStatus: "GOOD" | "DAMAGED" | "UNCERTAIN";
  goodProbability: number;
  damagedProbability: number;
  croppedImage: string | null;
  isIdentityMatch: boolean | null;
  decision: "PASS" | "REJECT" | "REVIEW";
}

export type ManagerTab =
  | "dashboard"
  | "scan"
  | "inventory"
  | "reservations"
  | "pickups"
  | "messages"
  | "profile";

export type BuyerTab =
  | "deals"
  | "reservations"
  | "returns"
  | "messages"
  | "profile";
