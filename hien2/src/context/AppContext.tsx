import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  UserRole,
  Product,
  AccessPoint,
  Reservation,
  Conversation,
  ManagerTab,
  BuyerTab,
  UserProfile,
  ReservationStatus,
  ProductStatus,
  ReturnOrder,
  PickupStatus,
  LiveCoordinates,
  BarcodeProductMatch,
  WarehousePickupStatus,
  WarehouseCustodyEvent
} from "../types";
import {
  INITIAL_ACCESS_POINTS,
  INITIAL_PRODUCTS,
  INITIAL_RESERVATIONS,
  INITIAL_CONVERSATIONS,
  INITIAL_RETURN_ORDERS
} from "../data/mockData";
import { MessageService } from "../services/messageService";
import { CallState, CallTarget } from "../services/callService";
import { HienApiService } from "../services/api";

interface LoginDetails {
  address?: string;
  storeName?: string;
}

interface AppContextType {
  // Authentication & Role
  isAuthenticated: boolean;
  role: UserRole;
  user: UserProfile;
  login: (role: UserRole, emailOrPhone: string, details?: LoginDetails) => void;
  signup: (role: UserRole, profileData: Partial<UserProfile> & { storeData?: Partial<AccessPoint> }) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;

  // Navigation Tabs
  managerTab: ManagerTab;
  setManagerTab: (tab: ManagerTab) => void;
  buyerTab: BuyerTab;
  setBuyerTab: (tab: BuyerTab) => void;

  // Selected entities & Drilldowns
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  selectedProduct: Product | null;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  activeConversation: Conversation | null;

  // Return & Pickup tracking
  returnOrders: ReturnOrder[];
  activeReturnOrderId: string | null;
  setActiveReturnOrderId: (id: string | null) => void;
  activeReturnOrder: ReturnOrder | null;
  isTrackingRouteOpen: boolean;
  setIsTrackingRouteOpen: (open: boolean) => void;

  // Core Data Collections (Shared Source of Truth)
  products: Product[];
  accessPoints: AccessPoint[];
  reservations: Reservation[];
  conversations: Conversation[];

  // Current Access Point for Manager
  currentAccessPoint: AccessPoint;
  updateAccessPointAddress: (apId: string, addressData: Partial<AccessPoint>) => void;

  // Product Lifecycle & Mismatch Actions
  postNewProduct: (productData: Partial<Product>) => Product;
  publishMismatchReturn: (
    productData: Partial<Product>,
    originalBarcode: BarcodeProductMatch,
    detectedAi: { name: string; sku: string; confidence: number }
  ) => Product;
  reserveProduct: (productId: string) => Reservation | null;
  updateReservationStatus: (reservationId: string, newStatus: ReservationStatus) => void;

  // Return & Pickup Actions
  requestReturnPickup: (returnOrderId: string) => void;
  startLocationSharing: (returnOrderId: string) => Promise<boolean>;
  stopLocationSharing: (returnOrderId: string) => void;
  acceptPickupRequest: (returnOrderId: string) => void;
  advancePickupStatus: (returnOrderId: string, nextStatus: PickupStatus) => void;
  updateWarehousePickupStatus: (returnOrderId: string, nextStatus: WarehousePickupStatus) => void;
  openChatForReturn: (returnOrderId: string) => void;
  openTrackPickup: (returnOrderId: string) => void;

  // Messaging Actions
  sendMessage: (conversationId: string, text: string) => void;
  openChatForProduct: (productId: string, preferredRole?: UserRole) => void;
  openChatForReservation: (reservationId: string) => void;

  // Mock Audio Call State
  callState: CallState;
  startMockCall: (target: CallTarget) => void;
  endMockCall: () => void;

  // Map state
  selectedMapAccessPointId: string | null;
  setSelectedMapAccessPointId: (apId: string | null) => void;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [role, setRole] = useState<UserRole>("manager");
  const [user, setUser] = useState<UserProfile>({
    id: "ap-04-mgr",
    name: "Suresh Raman",
    email: "suresh@expresselectronics.in",
    phone: "+91 98401 23456",
    role: "manager",
    accessPointId: "ap-04"
  });

  // Navigation
  const [managerTab, setManagerTab] = useState<ManagerTab>("dashboard");
  const [buyerTab, setBuyerTab] = useState<BuyerTab>("deals");

  // Selection
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>("conv-01");
  const [selectedMapAccessPointId, setSelectedMapAccessPointId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Return & Pickup state
  const [returnOrders, setReturnOrders] = useState<ReturnOrder[]>(INITIAL_RETURN_ORDERS);
  const [activeReturnOrderId, setActiveReturnOrderId] = useState<string | null>("RET-1042");
  const [isTrackingRouteOpen, setIsTrackingRouteOpen] = useState<boolean>(false);

  // Shared Data
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>(INITIAL_ACCESS_POINTS);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);

  // Geolocation watch id
  const geoWatchIdRef = useRef<number | null>(null);

  // Synchronize live data from backend if available
  useEffect(() => {
    HienApiService.getAccessPoints().then((aps) => {
      if (aps && aps.length > 0) setAccessPoints(aps);
    }).catch(() => {});

    HienApiService.getNearbyInventory(13.0418, 80.2341, 5000).then((items) => {
      if (items && items.length > 0) setProducts(items);
    }).catch(() => {});

    HienApiService.getReturnOrders().then((orders) => {
      if (orders && orders.length > 0) setReturnOrders(orders);
    }).catch(() => {});

    HienApiService.getReservations().then((res) => {
      if (res && res.length > 0) setReservations(res);
    }).catch(() => {});

    HienApiService.getConversations().then((convs) => {
      if (convs && convs.length > 0) setConversations(convs);
    }).catch(() => {});
  }, []);

  // Mock Calling
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    status: "ended",
    target: null,
    durationSeconds: 0
  });

  // Call timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState.isActive && callState.status === "connected") {
      timer = setInterval(() => {
        setCallState((prev) => ({
          ...prev,
          durationSeconds: prev.durationSeconds + 1
        }));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState.isActive, callState.status]);

  // Simulated courier movement loop for active pickup demonstration
  useEffect(() => {
    const interval = setInterval(() => {
      setReturnOrders((prev) =>
        prev.map((order) => {
          if (
            order.status === "PICKUP_IN_PROGRESS" &&
            order.pickupPersonLocation &&
            order.pickupLocation
          ) {
            // Move courier closer to returner
            const latDiff = (order.pickupLocation.latitude - order.pickupPersonLocation.latitude) * 0.12;
            const lngDiff = (order.pickupLocation.longitude - order.pickupPersonLocation.longitude) * 0.12;

            const nextDistance = Math.max(0.1, Number(((order.distanceKm || 1.2) - 0.1).toFixed(1)));
            const nextEta = Math.max(1, (order.etaMinutes || 8) - (nextDistance < 0.3 ? 2 : 1));

            return {
              ...order,
              distanceKm: nextDistance,
              etaMinutes: nextEta,
              pickupPersonLocation: {
                latitude: order.pickupPersonLocation.latitude + latDiff,
                longitude: order.pickupPersonLocation.longitude + lngDiff
              },
              status: nextDistance <= 0.2 ? "ARRIVED" : "PICKUP_IN_PROGRESS"
            };
          }
          return order;
        })
      );
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  const currentAccessPoint =
    accessPoints.find((ap) => ap.id === (user.accessPointId || "ap-04")) || accessPoints[0];

  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;
  const activeConversation = conversations.find((c) => c.id === activeConversationId) || conversations[0] || null;
  const activeReturnOrder = returnOrders.find((r) => r.id === activeReturnOrderId) || returnOrders[0] || null;

  // Login handler
  const login = (chosenRole: UserRole, emailOrPhone: string, details: LoginDetails = {}) => {
    setRole(chosenRole);
    setIsAuthenticated(true);
    if (chosenRole === "manager") {
      const storeName = details.storeName?.trim() || "Express Electronics";
      const storeAddress = details.address?.trim() || "123 Anna Salai, Teynampet, Chennai, Tamil Nadu - 600018";
      setAccessPoints((prev) =>
        prev.map((accessPoint) => accessPoint.id === "ap-04"
          ? { ...accessPoint, name: storeName, address: storeAddress }
          : accessPoint)
      );
      setUser({
        id: "ap-04-mgr",
        name: "Suresh Raman",
        email: emailOrPhone || "suresh@expresselectronics.in",
        phone: "+91 98401 23456",
        role: "manager",
        accessPointId: "ap-04",
        address: storeAddress
      });
      setManagerTab("dashboard");
    } else if (chosenRole === "buyer") {
      setUser({
        id: "buyer-01",
        name: "Rahul Verma",
        email: emailOrPhone || "rahul.verma@example.com",
        phone: "+91 98405 99887",
        role: "buyer",
        address: details.address?.trim() || "42 Eldams Road, Teynampet, Chennai, Tamil Nadu - 600018"
      });
      setBuyerTab("deals");
    } else {
      setUser({
        id: "warehouse-01",
        name: "Central Warehouse Team",
        email: emailOrPhone || "warehouse@hien.io",
        phone: "+91 90000 00000",
        role: "warehouse"
      });
    }
  };

  // Signup handler
  const signup = (
    chosenRole: UserRole,
    profileData: Partial<UserProfile> & { storeData?: Partial<AccessPoint> }
  ) => {
    setRole(chosenRole);
    setIsAuthenticated(true);

    if (chosenRole === "manager") {
      let apId = "ap-04";
      if (profileData.storeData) {
        apId = `ap-${Date.now().toString().slice(-4)}`;
        const newAP: AccessPoint = {
          id: apId,
          code: `AP-${Math.floor(10 + Math.random() * 89)}`,
          name: profileData.storeData.name || "Partner Store",
          address: profileData.storeData.address || "123 Anna Salai, Chennai",
          area: profileData.storeData.area || "Central Chennai",
          city: profileData.storeData.city || "Chennai",
          state: profileData.storeData.state || "Tamil Nadu",
          pincode: profileData.storeData.pincode || "600018",
          latitude: profileData.storeData.latitude || 13.0418,
          longitude: profileData.storeData.longitude || 80.2341,
          phone: profileData.phone || "+91 98401 00000",
          status: "ACTIVE"
        };
        setAccessPoints((prev) => [newAP, ...prev]);
      }

      setUser({
        id: `mgr-${Date.now()}`,
        name: profileData.name || "Partner Manager",
        email: profileData.email || "partner@hien.io",
        phone: profileData.phone || "+91 98401 00000",
        role: "manager",
        accessPointId: apId
      });
      setManagerTab("dashboard");
    } else if (chosenRole === "buyer") {
      setUser({
        id: `buyer-${Date.now()}`,
        name: profileData.name || "Rahul Verma",
        email: profileData.email || "buyer@example.com",
        phone: profileData.phone || "+91 98405 99887",
        role: "buyer",
        address: profileData.address
      });
      setBuyerTab("deals");
    } else {
      setUser({
        id: `warehouse-${Date.now()}`,
        name: profileData.name || "Central Warehouse Team",
        email: profileData.email || "warehouse@hien.io",
        phone: profileData.phone || "+91 90000 00000",
        role: "warehouse"
      });
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setSelectedProductId(null);
    setSearchQuery("");
  };

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === "manager") {
      setUser({
        id: "ap-04-mgr",
        name: "Suresh Raman",
        email: "suresh@expresselectronics.in",
        phone: "+91 98401 23456",
        role: "manager",
        accessPointId: "ap-04"
      });
      setManagerTab("dashboard");
    } else if (newRole === "buyer") {
      setUser({
        id: "buyer-01",
        name: "Rahul Verma",
        email: "rahul.verma@example.com",
        phone: "+91 98405 99887",
        role: "buyer"
      });
      setBuyerTab("deals");
    } else {
      setUser({
        id: "warehouse-01",
        name: "Central Warehouse Team",
        email: "warehouse@hien.io",
        phone: "+91 90000 00000",
        role: "warehouse"
      });
    }
  };

  // Update Access Point Location Data
  const updateAccessPointAddress = (apId: string, addressData: Partial<AccessPoint>) => {
    HienApiService.updateAccessPoint(apId, addressData).catch(() => {});
    setAccessPoints((prev) =>
      prev.map((ap) => {
        if (ap.id === apId) {
          const formattedAddress =
            addressData.address ||
            `${addressData.area || ap.area}, ${addressData.city || ap.city}, ${addressData.state || ap.state} - ${addressData.pincode || ap.pincode}`;
          return {
            ...ap,
            ...addressData,
            address: formattedAddress
          };
        }
        return ap;
      })
    );
  };

  // Post verified return product onto local shelf (Normal Match)
  const postNewProduct = (productData: Partial<Product>): Product => {
    const originalPrice = productData.originalPrice || 3000;
    const openBoxPrice = productData.openBoxPrice || Math.round(originalPrice * 0.85);

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      name: productData.name || "Verified Item",
      sku: productData.sku || "SKU-HIEN",
      barcode: productData.barcode || "890123456789",
      category: productData.category || "General",
      sizeOrVariant: productData.sizeOrVariant || "Standard",
      originalPrice,
      openBoxPrice,
      discountPercentage: 15,
      condition: productData.condition || "Pristine",
      conditionDetails: productData.conditionDetails || {
        surface: "Verified by Optical Gate inspection",
        packaging: "Open box retail condition"
      },
      aiConfidence: productData.aiConfidence || 94,
      status: "AVAILABLE",
      accessPointId: user.accessPointId || currentAccessPoint.id,
      imageUrl:
        productData.imageUrl ||
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
      createdAt: new Date().toISOString(),
      demandLevel: productData.demandLevel || "HIGH"
    };

    HienApiService.ingestInventory({
      sku: newProduct.sku,
      category: newProduct.category,
      msrp: newProduct.originalPrice,
      lat: currentAccessPoint.latitude || 13.0418,
      lon: currentAccessPoint.longitude || 80.2341,
      access_point_id: newProduct.accessPointId,
      routing_decision: "LOCAL_LIVE",
      barcode: newProduct.barcode,
      product_name: newProduct.name,
      image_url: newProduct.imageUrl,
      condition: newProduct.condition,
      size_or_variant: newProduct.sizeOrVariant,
      access_point_name: currentAccessPoint.name,
      access_point_code: currentAccessPoint.code,
      access_point_address: currentAccessPoint.address,
      is_mismatch_return: false,
      ai_confidence: newProduct.aiConfidence,
    }).catch(() => {});

    setProducts((prev) => [newProduct, ...prev]);
    return newProduct;
  };

  // NEW: Publish Mismatch Return (Section 4 & 5)
  // Uses AI-identified identity while storing both original barcode and AI data
  const publishMismatchReturn = (
    productData: Partial<Product>,
    originalBarcode: BarcodeProductMatch,
    detectedAi: { name: string; sku: string; confidence: number }
  ): Product => {
    const originalPrice = productData.originalPrice || 4000;
    const openBoxPrice = productData.openBoxPrice || Math.round(originalPrice * 0.85);

    const newMismatchProduct: Product = {
      id: `prod-mismatch-${Date.now()}`,
      name: detectedAi.name, // Uses the AI-identified product name!
      sku: detectedAi.sku,
      barcode: originalBarcode.barcode,
      category: productData.category || originalBarcode.category || "Footwear",
      sizeOrVariant: productData.sizeOrVariant || "Size 9",
      originalPrice,
      openBoxPrice,
      discountPercentage: 15,
      condition: productData.condition || "Pristine",
      conditionDetails: {
        surface: "Visual product identity verified via optical gate tensor analysis",
        packaging: "Mislabeled outer box; verified item inside is authentic"
      },
      aiConfidence: detectedAi.confidence,
      status: "AVAILABLE",
      accessPointId: user.accessPointId || currentAccessPoint.id,
      imageUrl:
        productData.imageUrl ||
        "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=600&auto=format&fit=crop&q=80",
      createdAt: new Date().toISOString(),
      demandLevel: "HIGH",
      isMismatchReturn: true,
      originalBarcodeProduct: {
        name: originalBarcode.expectedName,
        sku: originalBarcode.sku,
        barcode: originalBarcode.barcode
      },
      aiDetectedProduct: {
        name: detectedAi.name,
        sku: detectedAi.sku,
        confidence: detectedAi.confidence
      }
    };

    HienApiService.ingestInventory({
      sku: newMismatchProduct.sku,
      category: newMismatchProduct.category,
      msrp: newMismatchProduct.originalPrice,
      lat: currentAccessPoint.latitude || 13.0418,
      lon: currentAccessPoint.longitude || 80.2341,
      access_point_id: newMismatchProduct.accessPointId,
      routing_decision: "LOCAL_LIVE",
      barcode: originalBarcode.barcode,
      product_name: newMismatchProduct.name,
      image_url: newMismatchProduct.imageUrl,
      condition: newMismatchProduct.condition,
      size_or_variant: newMismatchProduct.sizeOrVariant,
      access_point_name: currentAccessPoint.name,
      access_point_code: currentAccessPoint.code,
      access_point_address: currentAccessPoint.address,
      is_mismatch_return: true,
      ai_confidence: detectedAi.confidence,
      original_barcode: originalBarcode.barcode,
      original_sku: originalBarcode.sku,
      original_product_name: originalBarcode.expectedName,
    }).catch(() => {});

    setProducts((prev) => [newMismatchProduct, ...prev]);
    return newMismatchProduct;
  };

  // Buyer reserves an available product
  const reserveProduct = (productId: string): Reservation | null => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return null;

    const ap = accessPoints.find((a) => a.id === prod.accessPointId) || currentAccessPoint;
    const nowIso = new Date().toISOString();

    HienApiService.reserveProduct(prod.id, user.id, user.name, user.phone, ap.id).catch(() => {});

    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              status: "RESERVED" as ProductStatus,
              reservedAt: nowIso,
              reservedByBuyerId: user.id,
              reservedByBuyerName: user.name
            }
          : p
      )
    );

    const newReservation: Reservation = {
      id: `res-${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      productSku: prod.sku,
      productPrice: prod.openBoxPrice,
      productImageUrl: prod.imageUrl,
      accessPointId: ap.id,
      accessPointName: ap.name,
      accessPointCode: ap.code,
      buyerId: user.id,
      buyerName: user.name,
      buyerPhone: user.phone,
      status: "RESERVED",
      reservedAt: nowIso,
      updatedAt: nowIso
    };

    setReservations((prev) => [newReservation, ...prev]);

    const { conversation } = MessageService.findOrCreateConversation(
      conversations,
      user.id,
      user.name,
      ap.id,
      ap.name,
      ap.code,
      prod.id,
      prod.name,
      prod.imageUrl
    );

    setConversations((prev) => {
      const exists = prev.some((c) => c.id === conversation.id);
      if (exists) return prev;
      return [conversation, ...prev];
    });

    return newReservation;
  };

  // Manager updates reservation status
  const updateReservationStatus = (reservationId: string, newStatus: ReservationStatus) => {
    HienApiService.updateReservationStatus(reservationId, newStatus).catch(() => {});
    const nowIso = new Date().toISOString();
    let targetProductId = "";

    setReservations((prev) =>
      prev.map((res) => {
        if (res.id === reservationId) {
          targetProductId = res.productId;
          return {
            ...res,
            status: newStatus,
            updatedAt: nowIso
          };
        }
        return res;
      })
    );

    if (targetProductId) {
      setProducts((prev) =>
        prev.map((prod) => {
          if (prod.id === targetProductId) {
            let nextProductStatus: ProductStatus = prod.status;
            if (newStatus === "READY_FOR_PICKUP") {
              nextProductStatus = "READY_FOR_PICKUP";
            } else if (newStatus === "COMPLETED") {
              nextProductStatus = "SOLD";
            } else if (newStatus === "CANCELLED") {
              nextProductStatus = "AVAILABLE";
            } else if (newStatus === "RESERVED") {
              nextProductStatus = "RESERVED";
            }
            return {
              ...prod,
              status: nextProductStatus
            };
          }
          return prod;
        })
      );
    }
  };

  // Returner requests pickup
  const requestReturnPickup = (returnOrderId: string) => {
    setReturnOrders((prev) =>
      prev.map((order) => {
        if (order.id === returnOrderId) {
          return {
            ...order,
            status: "PICKUP_ASSIGNED",
            pickupPersonId: "pickup-raj",
            pickupPersonName: "Raj",
            pickupPersonPhone: "+91 98409 88776",
            vehicleNumber: "TN-09-AX-4412",
            etaMinutes: 12,
            distanceKm: 1.5
          };
        }
        return order;
      })
    );
  };

  // Start Location Sharing using browser geolocation (Section 14 & 15)
  const startLocationSharing = async (returnOrderId: string): Promise<boolean> => {
    if (!navigator.geolocation) {
      console.warn("Geolocation API not available in browser");
      return false;
    }

    return new Promise((resolve) => {
      // Use watchPosition for continuous tracking until collection
      geoWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const coords: LiveCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
            timestamp: new Date().toISOString()
          };

          HienApiService.updateReturnLocation(returnOrderId, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            location_sharing_enabled: true
          }).catch(() => {});

          setReturnOrders((prev) =>
            prev.map((order) => {
              if (order.id === returnOrderId) {
                return {
                  ...order,
                  pickupLocation: coords,
                  locationSharingEnabled: true,
                  status:
                    order.status === "RETURN_REQUESTED"
                      ? "LOCATION_SHARED"
                      : order.status
                };
              }
              return order;
            })
          );
          resolve(true);
        },
        (error) => {
          console.warn("Geolocation permission error or unavailable, using fallback:", error);
          // Fallback location around Teynampet for demonstration
          setReturnOrders((prev) =>
            prev.map((order) => {
              if (order.id === returnOrderId) {
                return {
                  ...order,
                  locationSharingEnabled: true,
                  status:
                    order.status === "RETURN_REQUESTED"
                      ? "LOCATION_SHARED"
                      : order.status
                };
              }
              return order;
            })
          );
          resolve(true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  // Stop Location Sharing (Section 15: explicit stop or on product collection)
  const stopLocationSharing = (returnOrderId: string) => {
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }

    HienApiService.updateReturnLocation(returnOrderId, {
      latitude: 13.0458,
      longitude: 80.2382,
      location_sharing_enabled: false
    }).catch(() => {});

    setReturnOrders((prev) =>
      prev.map((order) => {
        if (order.id === returnOrderId) {
          return {
            ...order,
            locationSharingEnabled: false
          };
        }
        return order;
      })
    );
  };

  // Manager accepts pickup request (Section 17)
  const acceptPickupRequest = (returnOrderId: string) => {
    HienApiService.updateReturnStatus(returnOrderId, {
      status: "PICKUP_ACCEPTED",
      pickup_person_id: "pickup-raj",
      pickup_person_name: "Raj",
      pickup_person_phone: "+91 98409 88776",
      vehicle_number: "TN-09-AX-4412",
      eta_minutes: 10,
      distance_km: 1.2
    }).catch(() => {});

    setReturnOrders((prev) =>
      prev.map((order) => {
        if (order.id === returnOrderId) {
          return {
            ...order,
            status: "PICKUP_ACCEPTED",
            pickupPersonId: "pickup-raj",
            pickupPersonName: "Raj",
            pickupPersonPhone: "+91 98409 88776",
            vehicleNumber: "TN-09-AX-4412",
            etaMinutes: 10,
            distanceKm: 1.2
          };
        }
        return order;
      })
    );
  };

  // Advance pickup lifecycle (Section 26, 27, 28)
  const advancePickupStatus = (returnOrderId: string, nextStatus: PickupStatus) => {
    const nowIso = new Date().toISOString();

    HienApiService.updateReturnStatus(returnOrderId, { status: nextStatus }).catch(() => {});

    // If collected, immediately stop location sharing (Section 27)
    if (nextStatus === "PRODUCT_COLLECTED" || nextStatus === "COMPLETED") {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
    }

    setReturnOrders((prev) =>
      prev.map((order) => {
        if (order.id === returnOrderId) {
          return {
            ...order,
            status: nextStatus,
            locationSharingEnabled:
              nextStatus === "PRODUCT_COLLECTED" || nextStatus === "COMPLETED"
                ? false
                : order.locationSharingEnabled,
            collectedAt: nextStatus === "PRODUCT_COLLECTED" ? nowIso : order.collectedAt,
            warehousePickupStatus: nextStatus === "PRODUCT_COLLECTED"
              ? "STORED_AT_ACCESS_POINT"
              : order.warehousePickupStatus,
            warehouseCustodyEvents: nextStatus === "PRODUCT_COLLECTED"
              ? [
                  ...(order.warehouseCustodyEvents || []),
                  {
                    id: `custody-${Date.now()}`,
                    status: "STORED_AT_ACCESS_POINT" as WarehousePickupStatus,
                    timestamp: nowIso,
                    actor: user.name
                  }
                ]
              : order.warehouseCustodyEvents,
            refundCompletedAt: nextStatus === "COMPLETED" ? nowIso : order.refundCompletedAt
          };
        }
        return order;
      })
    );
  };

  const updateWarehousePickupStatus = (
    returnOrderId: string,
    nextStatus: WarehousePickupStatus
  ) => {
    const nowIso = new Date().toISOString();
    HienApiService.updateWarehouseCustodyStatus(returnOrderId, nextStatus, user.name).catch(() => {});
    setReturnOrders((prev) =>
      prev.map((order) => {
        if (order.id !== returnOrderId) {
          return order;
        }
        const currentStatus = order.warehousePickupStatus
          || (order.status === "PRODUCT_COLLECTED" ? "STORED_AT_ACCESS_POINT" : "AWAITING_ACCESS_POINT");
        const validNextStatus: Partial<Record<WarehousePickupStatus, WarehousePickupStatus>> = {
          STORED_AT_ACCESS_POINT: "COLLECTION_SCHEDULED",
          COLLECTION_SCHEDULED: "IN_TRANSIT_TO_WAREHOUSE",
          IN_TRANSIT_TO_WAREHOUSE: "RECEIVED_AT_WAREHOUSE"
        };
        if (validNextStatus[currentStatus] !== nextStatus) {
          return order;
        }

        const event: WarehouseCustodyEvent = {
          id: `custody-${Date.now()}`,
          status: nextStatus,
          timestamp: nowIso,
          actor: user.name
        };
        return {
          ...order,
          warehousePickupStatus: nextStatus,
          warehouseCustodyEvents: [...(order.warehouseCustodyEvents || []), event]
        };
      })
    );
  };

  // Open chat for return pickup
  const openChatForReturn = (returnOrderId: string) => {
    const order = returnOrders.find((r) => r.id === returnOrderId);
    if (!order) return;

    let conv = conversations.find((c) => c.returnOrderId === returnOrderId);

    if (!conv) {
      conv = {
        id: `conv-${returnOrderId}`,
        buyerId: order.returnerId,
        buyerName: order.returnerName,
        accessPointId: order.accessPointId,
        accessPointName: order.accessPointName,
        accessPointCode: order.accessPointCode,
        returnOrderId: order.id,
        productId: order.productId,
        productName: `${order.productName} (#${order.id})`,
        productImageUrl: order.productImageUrl,
        lastMessageSnippet: "Pickup coordination opened.",
        lastMessageTime: "Just now",
        unreadCount: 0,
        messages: [
          {
            id: `msg-${Date.now()}`,
            senderId: "system",
            senderRole: "pickup_partner",
            senderName: "HIEN Relay",
            text: `Pickup coordination opened for return #${order.id}. Courier Raj is assigned.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]
      };
      setConversations((prev) => [conv!, ...prev]);
    }

    setActiveConversationId(conv.id);
    if (role === "manager") {
      setManagerTab("messages");
    } else {
      setBuyerTab("messages");
    }
  };

  // Open Route Tracking View
  const openTrackPickup = (returnOrderId: string) => {
    setActiveReturnOrderId(returnOrderId);
    setIsTrackingRouteOpen(true);
  };

  // Send message
  const sendMessage = (conversationId: string, text: string) => {
    if (!text.trim()) return;

    HienApiService.sendMessage(conversationId, user.id, role, user.name, text.trim()).catch(() => {});

    const newMsg = MessageService.createNewMessage(
      user.id,
      role,
      user.name,
      text.trim()
    );

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            lastMessageSnippet: text.trim(),
            lastMessageTime: "Just now",
            unreadCount: 0,
            messages: [...conv.messages, newMsg]
          };
        }
        return conv;
      })
    );
  };

  // Open Chat from Product Details
  const openChatForProduct = (productId: string, preferredRole?: UserRole) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const ap = accessPoints.find((a) => a.id === prod.accessPointId) || currentAccessPoint;
    const buyerId = role === "buyer" ? user.id : "buyer-01";
    const buyerName = role === "buyer" ? user.name : "Rahul Verma";

    const { conversation, isNew } = MessageService.findOrCreateConversation(
      conversations,
      buyerId,
      buyerName,
      ap.id,
      ap.name,
      ap.code,
      prod.id,
      prod.name,
      prod.imageUrl
    );

    if (isNew) {
      setConversations((prev) => [conversation, ...prev]);
    }

    setActiveConversationId(conversation.id);
    if (role === "manager" || preferredRole === "manager") {
      setManagerTab("messages");
    } else {
      setBuyerTab("messages");
    }
  };

  // Open Chat from Reservation card
  const openChatForReservation = (reservationId: string) => {
    const res = reservations.find((r) => r.id === reservationId);
    if (!res) return;

    const { conversation, isNew } = MessageService.findOrCreateConversation(
      conversations,
      res.buyerId,
      res.buyerName,
      res.accessPointId,
      res.accessPointName,
      res.accessPointCode,
      res.productId,
      res.productName,
      res.productImageUrl
    );

    if (isNew) {
      setConversations((prev) => [conversation, ...prev]);
    }

    setActiveConversationId(conversation.id);
    if (role === "manager") {
      setManagerTab("messages");
    } else {
      setBuyerTab("messages");
    }
  };

  // Mock audio calling
  const startMockCall = (target: CallTarget) => {
    setCallState({
      isActive: true,
      status: "dialing",
      target,
      durationSeconds: 0
    });

    setTimeout(() => {
      setCallState((prev) => {
        if (!prev.isActive) return prev;
        return {
          ...prev,
          status: "connected"
        };
      });
    }, 1800);
  };

  const endMockCall = () => {
    setCallState({
      isActive: false,
      status: "ended",
      target: null,
      durationSeconds: 0
    });
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        role,
        user,
        login,
        signup,
        logout,
        switchRole,
        managerTab,
        setManagerTab,
        buyerTab,
        setBuyerTab,
        selectedProductId,
        setSelectedProductId,
        selectedProduct,
        activeConversationId,
        setActiveConversationId,
        activeConversation,
        returnOrders,
        activeReturnOrderId,
        setActiveReturnOrderId,
        activeReturnOrder,
        isTrackingRouteOpen,
        setIsTrackingRouteOpen,
        products,
        accessPoints,
        reservations,
        conversations,
        currentAccessPoint,
        updateAccessPointAddress,
        postNewProduct,
        publishMismatchReturn,
        reserveProduct,
        updateReservationStatus,
        requestReturnPickup,
        startLocationSharing,
        stopLocationSharing,
        acceptPickupRequest,
        advancePickupStatus,
        updateWarehousePickupStatus,
        openChatForReturn,
        openTrackPickup,
        sendMessage,
        openChatForProduct,
        openChatForReservation,
        callState,
        startMockCall,
        endMockCall,
        selectedMapAccessPointId,
        setSelectedMapAccessPointId,
        searchQuery,
        setSearchQuery
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppContextProvider");
  }
  return context;
};
