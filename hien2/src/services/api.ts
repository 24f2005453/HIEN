import {
  Product,
  Reservation,
  Conversation,
  AccessPoint,
  ReservationStatus,
  ReturnOrder,
  PickupStatus,
  WarehousePickupStatus,
  WarehouseCustodyEvent,
  BarcodeProductMatch,
} from "../types";
import {
  INITIAL_PRODUCTS,
  INITIAL_RESERVATIONS,
  INITIAL_CONVERSATIONS,
  INITIAL_ACCESS_POINTS,
  INITIAL_RETURN_ORDERS,
} from "../data/mockData";

// Resolve API base URL from Vite environment variable (default: http://localhost:8000/api/v1)
const RAW_API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
export const API_BASE_URL: string = RAW_API_BASE_URL.replace(/\/+$/, "");

/**
 * Typed API Error representation containing HTTP status, message, and backend validation details.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// HTTP Request Helper
// ---------------------------------------------------------------------------

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError) {
    const msg = networkError instanceof Error ? networkError.message : "Network error";
    throw new ApiError(
      0,
      `Cannot connect to HIEN backend at ${url}. Ensure the backend is running. (${msg})`,
      networkError
    );
  }

  if (!response.ok) {
    let errorDetail = `Request failed with HTTP ${response.status} ${response.statusText}`;
    try {
      const parsedBody = await response.json();
      if (parsedBody && typeof parsedBody === "object" && "detail" in parsedBody) {
        const detail = (parsedBody as { detail: unknown }).detail;
        if (typeof detail === "string") {
          errorDetail = detail;
        } else if (Array.isArray(detail)) {
          errorDetail = detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ");
        }
      }
    } catch {
      // Body is not JSON
    }
    throw new ApiError(response.status, errorDetail);
  }

  try {
    return (await response.json()) as T;
  } catch (jsonError) {
    throw new ApiError(response.status, "Server returned an invalid JSON response.", jsonError);
  }
}

// ---------------------------------------------------------------------------
// Typed Backend Service Client
// ---------------------------------------------------------------------------

export class HienApiService {
  /**
   * Service health check against GET /health
   */
  public static async checkHealth(): Promise<{ status: string; service: string; database?: string }> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v\d+$/i, "");
    const res = await fetch(`${rootUrl}/health`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new ApiError(res.status, "Health check degraded");
    return res.json();
  }

  /**
   * Fetch nearby local inventory from PostGIS discovery feed (GET /api/v1/discovery/local-feed)
   * Falls back to mock data if offline.
   */
  public static async getNearbyInventory(
    lat = 13.0418,
    lng = 80.2341,
    radiusMeters = 5000
  ): Promise<Product[]> {
    try {
      const query = new URLSearchParams({
        buyer_lat: String(lat),
        buyer_lon: String(lng),
        radius_meters: String(radiusMeters),
      });
      const data = await request<{
        type: string;
        features: Array<{
          geometry: { coordinates: [number, number] };
          properties: {
            id: string;
            sku: string;
            category: string;
            msrp: number;
            current_price: number;
            discount_percent: number;
            access_point_id: string;
            distance_meters?: number | null;
            name?: string | null;
            barcode?: string | null;
            image_url?: string | null;
            condition?: string | null;
            size_or_variant?: string | null;
            access_point_name?: string | null;
            access_point_code?: string | null;
            access_point_address?: string | null;
            is_mismatch_return?: boolean;
            ai_confidence?: number | null;
            original_barcode?: string | null;
            original_sku?: string | null;
            original_product_name?: string | null;
          };
        }>;
      }>(`/discovery/local-feed?${query.toString()}`);

      if (data && data.features && data.features.length > 0) {
        return data.features.map((f) => {
          const p = f.properties;
          return {
            id: p.id,
            name: p.name || `${p.category} (${p.sku})`,
            sku: p.sku,
            barcode: p.barcode || "890123456789",
            category: p.category,
            sizeOrVariant: p.size_or_variant || "Standard",
            originalPrice: p.msrp,
            openBoxPrice: p.current_price,
            discountPercentage: p.discount_percent || 15,
            condition: (p.condition as any) || "Pristine",
            conditionDetails: {
              surface: "Verified by Optical Gate inspection",
              packaging: "Open box retail condition",
            },
            aiConfidence: p.ai_confidence ? Math.round(p.ai_confidence) : 94,
            status: "AVAILABLE",
            accessPointId: p.access_point_id,
            imageUrl:
              p.image_url ||
              "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
            createdAt: new Date().toISOString(),
            demandLevel: "HIGH",
            isMismatchReturn: p.is_mismatch_return,
            originalBarcodeProduct: p.original_barcode
              ? {
                  name: p.original_product_name || "Original Item",
                  sku: p.original_sku || "ORIG-SKU",
                  barcode: p.original_barcode,
                }
              : undefined,
            aiDetectedProduct: p.is_mismatch_return
              ? {
                  name: p.name || p.sku,
                  sku: p.sku,
                  confidence: p.ai_confidence || 95,
                }
              : undefined,
          };
        });
      }
    } catch (err) {
      console.warn("Backend local-feed unreachable, using default items:", err);
    }
    return [...INITIAL_PRODUCTS];
  }

  /**
   * List verified partner Access Points (GET /api/v1/access-points)
   */
  public static async getAccessPoints(): Promise<AccessPoint[]> {
    try {
      const data = await request<AccessPoint[]>("/access-points");
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn("Backend access-points unreachable, using default:", err);
    }
    return [...INITIAL_ACCESS_POINTS];
  }

  /**
   * Update Access Point location / address (PATCH /api/v1/access-points/{apId})
   */
  public static async updateAccessPoint(
    apId: string,
    data: Partial<AccessPoint>
  ): Promise<AccessPoint> {
    try {
      return await request<AccessPoint>(`/access-points/${encodeURIComponent(apId)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn("Backend updateAccessPoint failed, falling back to local:", err);
      const match = INITIAL_ACCESS_POINTS.find((a) => a.id === apId) || INITIAL_ACCESS_POINTS[0];
      return { ...match, ...data };
    }
  }

  /**
   * Lookup authoritative catalog product metadata by barcode (GET /api/v1/catalog/barcode/{barcode})
   */
  public static async getCatalogProductByBarcode(barcode: string): Promise<BarcodeProductMatch | null> {
    try {
      const data = await request<{
        barcode: string;
        sku: string;
        name: string;
        category: string;
        size_or_variant?: string | null;
        msrp: number;
        open_box_price: number;
        image_url?: string | null;
      }>(`/catalog/barcode/${encodeURIComponent(barcode.trim())}`);

      if (data) {
        return {
          barcode: data.barcode,
          sku: data.sku,
          expectedName: data.name,
          category: data.category,
          sizeOrVariant: data.size_or_variant || "Standard",
          originalPrice: data.msrp,
          openBoxPrice: data.open_box_price,
          imageUrl: data.image_url || "",
        };
      }
    } catch (err) {
      console.warn("Catalog API lookup failed:", err);
    }
    return null;
  }

  /**
   * Ingest inventory into local Access Point shelf (POST /api/v1/inventory/ingest)
   */
  public static async ingestInventory(params: {
    sku: string;
    category: string;
    msrp: number;
    lat: number;
    lon: number;
    access_point_id: string;
    routing_decision: "LOCAL_LIVE" | "CENTRAL_ROUTING";
    barcode?: string;
    product_name?: string;
    image_url?: string;
    condition?: string;
    size_or_variant?: string;
    access_point_name?: string;
    access_point_code?: string;
    access_point_address?: string;
    is_mismatch_return?: boolean;
    ai_confidence?: number;
    original_barcode?: string;
    original_sku?: string;
    original_product_name?: string;
  }): Promise<{ success: boolean; inventory_id: string; current_price: number }> {
    return request("/inventory/ingest", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Fetch Return Orders (GET /api/v1/returns)
   */
  public static async getReturnOrders(accessPointId?: string, returnerId?: string): Promise<ReturnOrder[]> {
    try {
      const query = new URLSearchParams();
      if (accessPointId) query.set("access_point_id", accessPointId);
      if (returnerId) query.set("returner_id", returnerId);
      const data = await request<any[]>(`/returns?${query.toString()}`);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          orderNumber: d.order_number,
          productId: d.product_id,
          productName: d.product_name,
          productSku: d.product_sku,
          productImageUrl: d.product_image_url || "",
          refundAmount: d.refund_amount,
          returnerId: d.returner_id,
          returnerName: d.returner_name,
          returnerPhone: d.returner_phone,
          accessPointId: d.access_point_id,
          accessPointName: d.access_point_name,
          accessPointCode: d.access_point_code,
          status: d.status as PickupStatus,
          pickupAddress: d.pickup_address,
          pickupLocation: d.pickup_location,
          locationSharingEnabled: d.location_sharing_enabled,
          pickupPersonId: d.pickup_person_id,
          pickupPersonName: d.pickup_person_name,
          pickupPersonPhone: d.pickup_person_phone,
          pickupPersonLocation: d.pickup_person_location,
          vehicleNumber: d.vehicle_number,
          etaMinutes: d.eta_minutes,
          distanceKm: d.distance_km,
          createdAt: d.created_at,
          collectedAt: d.collected_at,
          refundCompletedAt: d.refund_completed_at,
          isDemoMovement: d.is_demo_movement,
          warehousePickupStatus: d.warehouse_pickup_status as WarehousePickupStatus,
          warehouseCustodyEvents: d.warehouse_custody_events,
        }));
      }
    } catch (err) {
      console.warn("Backend returns unreachable, using default:", err);
    }
    return [...INITIAL_RETURN_ORDERS];
  }

  /**
   * Advance return pickup lifecycle status (PATCH /api/v1/returns/{returnId}/status)
   */
  public static async updateReturnStatus(
    returnId: string,
    params: {
      status: string;
      pickup_person_id?: string;
      pickup_person_name?: string;
      pickup_person_phone?: string;
      vehicle_number?: string;
      eta_minutes?: number;
      distance_km?: number;
    }
  ): Promise<any> {
    try {
      return await request(`/returns/${encodeURIComponent(returnId)}/status`, {
        method: "PATCH",
        body: JSON.stringify(params),
      });
    } catch (err) {
      console.warn("updateReturnStatus backend call failed, continuing locally:", err);
      return { success: true };
    }
  }

  /**
   * Update return location (PATCH /api/v1/returns/{returnId}/location)
   */
  public static async updateReturnLocation(
    returnId: string,
    params: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      location_sharing_enabled: boolean;
    }
  ): Promise<any> {
    try {
      return await request(`/returns/${encodeURIComponent(returnId)}/location`, {
        method: "PATCH",
        body: JSON.stringify(params),
      });
    } catch (err) {
      console.warn("updateReturnLocation backend call failed, continuing locally:", err);
      return { success: true };
    }
  }

  /**
   * Warehouse custody queue (GET /api/v1/warehouse/custody-queue)
   */
  public static async getWarehouseCustodyQueue(status?: string): Promise<ReturnOrder[]> {
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      const data = await request<any[]>(`/warehouse/custody-queue${q}`);
      if (Array.isArray(data)) {
        return data.map((d) => ({
          id: d.id,
          orderNumber: d.order_number,
          productId: d.product_id,
          productName: d.product_name,
          productSku: d.product_sku,
          productImageUrl: d.product_image_url || "",
          refundAmount: d.refund_amount,
          returnerId: d.returner_id,
          returnerName: d.returner_name,
          returnerPhone: d.returner_phone,
          accessPointId: d.access_point_id,
          accessPointName: d.access_point_name,
          accessPointCode: d.access_point_code,
          status: d.status as PickupStatus,
          pickupAddress: d.pickup_address,
          pickupLocation: d.pickup_location,
          locationSharingEnabled: d.location_sharing_enabled,
          pickupPersonId: d.pickup_person_id,
          pickupPersonName: d.pickup_person_name,
          pickupPersonPhone: d.pickup_person_phone,
          pickupPersonLocation: d.pickup_person_location,
          vehicleNumber: d.vehicle_number,
          etaMinutes: d.eta_minutes,
          distanceKm: d.distance_km,
          createdAt: d.created_at,
          collectedAt: d.collected_at,
          refundCompletedAt: d.refund_completed_at,
          isDemoMovement: d.is_demo_movement,
          warehousePickupStatus: d.warehouse_pickup_status as WarehousePickupStatus,
          warehouseCustodyEvents: d.warehouse_custody_events,
        }));
      }
    } catch (err) {
      console.warn("Backend warehouse custody queue unreachable, using local:", err);
    }
    return INITIAL_RETURN_ORDERS.filter((r) => r.warehousePickupStatus && r.warehousePickupStatus !== "AWAITING_ACCESS_POINT");
  }

  /**
   * Advance warehouse custody status (PATCH /api/v1/warehouse/returns/{returnId}/status)
   */
  public static async updateWarehouseCustodyStatus(
    returnId: string,
    status: WarehousePickupStatus,
    actor = "Warehouse Manager"
  ): Promise<any> {
    try {
      return await request(`/warehouse/returns/${encodeURIComponent(returnId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, actor }),
      });
    } catch (err) {
      console.warn("Backend updateWarehouseCustodyStatus call failed, continuing locally:", err);
      return { success: true };
    }
  }

  /**
   * Fetch buyer reservations (GET /api/v1/reservations)
   */
  public static async getReservations(accessPointId?: string, buyerId?: string): Promise<Reservation[]> {
    try {
      const query = new URLSearchParams();
      if (accessPointId) query.set("access_point_id", accessPointId);
      if (buyerId) query.set("buyer_id", buyerId);
      const data = await request<any[]>(`/reservations?${query.toString()}`);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((r) => ({
          id: r.id,
          productId: r.product_id,
          productName: r.product_name,
          productSku: r.product_sku,
          productPrice: r.product_price,
          productImageUrl: r.product_image_url || "",
          accessPointId: r.access_point_id,
          accessPointName: r.access_point_name,
          accessPointCode: r.access_point_code,
          buyerId: r.buyer_id,
          buyerName: r.buyer_name,
          buyerPhone: r.buyer_phone,
          status: r.status as ReservationStatus,
          reservedAt: r.reserved_at,
          updatedAt: r.updated_at,
        }));
      }
    } catch (err) {
      console.warn("Backend reservations unreachable, using default:", err);
    }
    return accessPointId
      ? INITIAL_RESERVATIONS.filter((r) => r.accessPointId === accessPointId)
      : [...INITIAL_RESERVATIONS];
  }

  /**
   * Create a reservation (POST /api/v1/reservations)
   */
  public static async reserveProduct(
    productId: string,
    buyerId: string,
    buyerName: string,
    buyerPhone?: string,
    accessPointId?: string
  ): Promise<Reservation> {
    try {
      const data = await request<any>("/reservations", {
        method: "POST",
        body: JSON.stringify({
          product_id: productId,
          buyer_id: buyerId,
          buyer_name: buyerName,
          buyer_phone: buyerPhone,
          access_point_id: accessPointId,
        }),
      });
      return {
        id: data.id,
        productId: data.product_id,
        productName: data.product_name,
        productSku: data.product_sku,
        productPrice: data.product_price,
        productImageUrl: data.product_image_url || "",
        accessPointId: data.access_point_id,
        accessPointName: data.access_point_name,
        accessPointCode: data.access_point_code,
        buyerId: data.buyer_id,
        buyerName: data.buyer_name,
        buyerPhone: data.buyer_phone,
        status: data.status,
        reservedAt: data.reserved_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.warn("Backend reserveProduct failed, continuing with local state:", err);
      const product = INITIAL_PRODUCTS.find((p) => p.id === productId);
      const ap = INITIAL_ACCESS_POINTS.find((a) => a.id === product?.accessPointId) || INITIAL_ACCESS_POINTS[0];
      return {
        id: `res-${Date.now()}`,
        productId,
        productName: product?.name || "Product",
        productSku: product?.sku || "SKU-UNKNOWN",
        productPrice: product?.openBoxPrice || 0,
        productImageUrl: product?.imageUrl || "",
        accessPointId: ap.id,
        accessPointName: ap.name,
        accessPointCode: ap.code,
        buyerId,
        buyerName,
        status: "RESERVED",
        reservedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Update reservation status (PATCH /api/v1/reservations/{reservationId}/status)
   */
  public static async updateReservationStatus(
    reservationId: string,
    status: ReservationStatus
  ): Promise<{ success: boolean; updatedAt: string }> {
    try {
      await request(`/reservations/${encodeURIComponent(reservationId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      console.warn("Backend updateReservationStatus failed, continuing with local state:", err);
    }
    return { success: true, updatedAt: new Date().toISOString() };
  }

  /**
   * List conversations (GET /api/v1/conversations)
   */
  public static async getConversations(buyerId?: string, accessPointId?: string): Promise<Conversation[]> {
    try {
      const q = new URLSearchParams();
      if (buyerId) q.set("buyer_id", buyerId);
      if (accessPointId) q.set("access_point_id", accessPointId);
      const data = await request<any[]>(`/conversations?${q.toString()}`);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((c) => ({
          id: c.id,
          buyerId: c.buyer_id,
          buyerName: c.buyer_name,
          accessPointId: c.access_point_id,
          accessPointName: c.access_point_name,
          accessPointCode: c.access_point_code,
          productId: c.product_id,
          productName: c.product_name,
          productImageUrl: c.product_image_url,
          returnOrderId: c.return_order_id,
          lastMessageSnippet: c.last_message_snippet || "",
          lastMessageTime: c.last_message_time || "Just now",
          unreadCount: c.unread_count || 0,
          messages: (c.messages || []).map((m: any) => ({
            id: m.id,
            senderId: m.sender_id,
            senderRole: m.sender_role,
            senderName: m.sender_name,
            text: m.text,
            timestamp: m.timestamp,
          })),
        }));
      }
    } catch (err) {
      console.warn("Backend conversations unreachable, using default:", err);
    }
    return [...INITIAL_CONVERSATIONS];
  }

  /**
   * Send message (POST /api/v1/conversations/{convId}/messages)
   */
  public static async sendMessage(
    convId: string,
    senderId: string,
    senderRole: string,
    senderName: string,
    text: string
  ): Promise<any> {
    try {
      return await request(`/conversations/${encodeURIComponent(convId)}/messages`, {
        method: "POST",
        body: JSON.stringify({
          sender_id: senderId,
          sender_role: senderRole,
          sender_name: senderName,
          text,
        }),
      });
    } catch (err) {
      console.warn("Backend sendMessage failed, continuing locally:", err);
      return { success: true };
    }
  }
}
