import { AccessPoint, Product, Reservation, Conversation, BarcodeProductMatch, ReturnOrder } from "../types";

export const INITIAL_ACCESS_POINTS: AccessPoint[] = [
  {
    id: "ap-04",
    code: "AP-04",
    name: "Express Electronics",
    address: "123 Anna Salai, Teynampet, Chennai, Tamil Nadu - 600018",
    area: "Teynampet",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600018",
    latitude: 13.0418,
    longitude: 80.2341,
    phone: "+91 98401 23456",
    status: "ACTIVE"
  },
  {
    id: "ap-09",
    code: "AP-09",
    name: "Nexus Tech Point",
    address: "45 GN Chetty Road, T. Nagar, Chennai, Tamil Nadu - 600017",
    area: "T. Nagar",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600017",
    latitude: 13.0405,
    longitude: 80.2435,
    phone: "+91 98402 34567",
    status: "ACTIVE"
  },
  {
    id: "ap-12",
    code: "AP-12",
    name: "City HyperHub",
    address: "78 Cathedral Road, Gopalapuram, Chennai, Tamil Nadu - 600086",
    area: "Gopalapuram",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600086",
    latitude: 13.0475,
    longitude: 80.2520,
    phone: "+91 98403 45678",
    status: "ACTIVE"
  }
];

export const BARCODE_CATALOG: BarcodeProductMatch[] = [
  {
    barcode: "890123456789",
    sku: "NIKE-AZ-10",
    expectedName: "Nike Air Zoom",
    sizeOrVariant: "Size 10",
    originalPrice: 3000,
    openBoxPrice: 2550,
    category: "Footwear",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80"
  },
  {
    barcode: "890123456790",
    sku: "SAMSUNG-GB-2",
    expectedName: "Samsung Galaxy Buds Pro",
    sizeOrVariant: "Phantom Black",
    originalPrice: 5000,
    openBoxPrice: 4250,
    category: "Electronics",
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80"
  },
  {
    barcode: "890123456791",
    sku: "ADIDAS-RS-9",
    expectedName: "Adidas Running Shoes",
    sizeOrVariant: "Size 9",
    originalPrice: 4000,
    openBoxPrice: 3400,
    category: "Footwear",
    imageUrl: "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=600&auto=format&fit=crop&q=80"
  },
  {
    barcode: "890123456792",
    sku: "JBL-SPK-6",
    expectedName: "JBL Flip 6 Portable Speaker",
    sizeOrVariant: "Midnight Blue",
    originalPrice: 7000,
    openBoxPrice: 5950,
    category: "Audio",
    imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80"
  },
  {
    barcode: "890123456793",
    sku: "APPLE-STP-44",
    expectedName: "Apple Watch Magnetic Strap",
    sizeOrVariant: "44mm Black",
    originalPrice: 1500,
    openBoxPrice: 1275,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80"
  },
  {
    barcode: "890123456794",
    sku: "SONY-WH-XM4",
    expectedName: "Sony WH-1000XM4 Wireless",
    sizeOrVariant: "Silver",
    originalPrice: 19999,
    openBoxPrice: 16999,
    category: "Audio",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80"
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-01",
    name: "Nike Air Zoom",
    sku: "NIKE-AZ-10",
    barcode: "890123456789",
    category: "Footwear",
    sizeOrVariant: "Size 10",
    originalPrice: 3000,
    openBoxPrice: 2550,
    discountPercentage: 15,
    condition: "Pristine",
    conditionDetails: {
      surface: "No visible scratches or sole wear",
      packaging: "Original manufacturer box intact"
    },
    aiConfidence: 94,
    status: "AVAILABLE",
    accessPointId: "ap-04",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
    createdAt: "2026-10-03T10:15:00Z",
    demandLevel: "HIGH"
  },
  {
    id: "prod-02",
    name: "Samsung Galaxy Buds Pro",
    sku: "SAMSUNG-GB-2",
    barcode: "890123456790",
    category: "Electronics",
    sizeOrVariant: "Phantom Black",
    originalPrice: 5000,
    openBoxPrice: 4250,
    discountPercentage: 15,
    condition: "Pristine",
    conditionDetails: {
      surface: "Charging case & earbuds sanitized, flawless",
      packaging: "Box unsealed, all ear tips included"
    },
    aiConfidence: 91,
    status: "RESERVED",
    accessPointId: "ap-04",
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
    createdAt: "2026-10-03T09:40:00Z",
    reservedAt: "2026-10-03T11:20:00Z",
    reservedByBuyerId: "buyer-02",
    reservedByBuyerName: "Priya",
    demandLevel: "HIGH"
  },
  {
    id: "prod-03",
    name: "Adidas Running Shoes",
    sku: "ADIDAS-RUN-01",
    barcode: "890123456789", // Returned in a Nike box!
    category: "Footwear",
    sizeOrVariant: "Size 9",
    originalPrice: 4000,
    openBoxPrice: 3400,
    discountPercentage: 15,
    condition: "Pristine",
    conditionDetails: {
      surface: "Laces and soles completely clean, no defects",
      packaging: "Outer box mislabeled; verified visually by optical gate"
    },
    aiConfidence: 96,
    status: "AVAILABLE",
    accessPointId: "ap-04",
    imageUrl: "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=600&auto=format&fit=crop&q=80",
    createdAt: "2026-10-03T08:30:00Z",
    demandLevel: "HIGH",
    // Mismatch return tracking
    isMismatchReturn: true,
    originalBarcodeProduct: {
      name: "Nike Air Zoom",
      sku: "NIKE-AZ-10",
      barcode: "890123456789"
    },
    aiDetectedProduct: {
      name: "Adidas Running Shoes",
      sku: "ADIDAS-RUN-01",
      confidence: 96
    }
  },
  {
    id: "prod-04",
    name: "JBL Flip 6 Portable Speaker",
    sku: "JBL-SPK-6",
    barcode: "890123456792",
    category: "Audio",
    sizeOrVariant: "Midnight Blue",
    originalPrice: 7000,
    openBoxPrice: 5950,
    discountPercentage: 15,
    condition: "Pristine",
    conditionDetails: {
      surface: "No cosmetic marks, tested audio drivers",
      packaging: "Complete with original braided USB-C cable"
    },
    aiConfidence: 96,
    status: "SOLD",
    accessPointId: "ap-04",
    imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80",
    createdAt: "2026-10-02T16:20:00Z",
    reservedAt: "2026-10-03T07:15:00Z",
    reservedByBuyerId: "buyer-01",
    reservedByBuyerName: "Rahul",
    demandLevel: "HIGH"
  },
  {
    id: "prod-05",
    name: "Apple Watch Magnetic Strap",
    sku: "APPLE-STP-44",
    barcode: "890123456793",
    category: "Accessories",
    sizeOrVariant: "44mm Black",
    originalPrice: 1500,
    openBoxPrice: 1275,
    discountPercentage: 15,
    condition: "Pristine",
    conditionDetails: {
      surface: "Immaculate leather finish, strong magnetic grip",
      packaging: "Clean retail sleeve"
    },
    aiConfidence: 93,
    status: "AVAILABLE",
    accessPointId: "ap-09",
    imageUrl: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80",
    createdAt: "2026-10-03T11:00:00Z",
    demandLevel: "HIGH"
  },
  {
    id: "prod-06",
    name: "Sony WH-1000XM4 Wireless",
    sku: "SONY-WH-XM4",
    barcode: "890123456794",
    category: "Audio",
    sizeOrVariant: "Silver",
    originalPrice: 19999,
    openBoxPrice: 16999,
    discountPercentage: 15,
    condition: "Pristine",
    conditionDetails: {
      surface: "Pads and headband pristine, active noise cancellation verified",
      packaging: "Original hard carrying case included"
    },
    aiConfidence: 95,
    status: "AVAILABLE",
    accessPointId: "ap-12",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
    createdAt: "2026-10-03T11:45:00Z",
    demandLevel: "HIGH"
  }
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: "res-01",
    productId: "prod-02",
    productName: "Samsung Galaxy Buds Pro",
    productSku: "SAMSUNG-GB-2",
    productPrice: 4250,
    productImageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
    accessPointId: "ap-04",
    accessPointName: "Express Electronics",
    accessPointCode: "AP-04",
    buyerId: "buyer-02",
    buyerName: "Priya",
    buyerPhone: "+91 98404 11223",
    status: "READY_FOR_PICKUP",
    reservedAt: "2026-10-03T11:20:00Z",
    updatedAt: "2026-10-03T11:40:00Z"
  },
  {
    id: "res-02",
    productId: "prod-04",
    productName: "JBL Flip 6 Portable Speaker",
    productSku: "JBL-SPK-6",
    productPrice: 5950,
    productImageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80",
    accessPointId: "ap-04",
    accessPointName: "Express Electronics",
    accessPointCode: "AP-04",
    buyerId: "buyer-01",
    buyerName: "Rahul",
    buyerPhone: "+91 98405 99887",
    status: "COMPLETED",
    reservedAt: "2026-10-03T07:15:00Z",
    updatedAt: "2026-10-03T08:10:00Z"
  }
];

export const INITIAL_RETURN_ORDERS: ReturnOrder[] = [
  {
    id: "RET-1042",
    orderNumber: "ORD-99214",
    productId: "prod-01",
    productName: "Nike Air Zoom",
    productSku: "NIKE-AZ-10",
    productImageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
    refundAmount: 3000,
    returnerId: "buyer-01",
    returnerName: "Rahul Verma",
    returnerPhone: "+91 98405 99887",
    accessPointId: "ap-04",
    accessPointName: "Express Electronics",
    accessPointCode: "AP-04",
    status: "PICKUP_IN_PROGRESS",
    pickupAddress: "Flat 4B, Emerald Residency, Cenotaph Road, Teynampet, Chennai",
    pickupLocation: {
      latitude: 13.0458,
      longitude: 80.2382,
      accuracy: 12,
      timestamp: "2026-10-03T11:40:00Z"
    },
    locationSharingEnabled: true,
    pickupPersonId: "pickup-raj",
    pickupPersonName: "Raj",
    pickupPersonPhone: "+91 98409 88776",
    pickupPersonLocation: {
      latitude: 13.0422,
      longitude: 80.2355
    },
    vehicleNumber: "TN-09-AX-4412",
    etaMinutes: 8,
    distanceKm: 1.2,
    createdAt: "2026-10-03T11:20:00Z",
    isDemoMovement: true,
    warehousePickupStatus: "AWAITING_ACCESS_POINT"
  },
  {
    id: "RET-1043",
    orderNumber: "ORD-88120",
    productId: "prod-02",
    productName: "Samsung Galaxy Buds Pro",
    productSku: "SAMSUNG-GB-2",
    productImageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
    refundAmount: 5000,
    returnerId: "buyer-01",
    returnerName: "Rahul Verma",
    returnerPhone: "+91 98405 99887",
    accessPointId: "ap-04",
    accessPointName: "Express Electronics",
    accessPointCode: "AP-04",
    status: "PRODUCT_COLLECTED",
    pickupAddress: "42 Eldams Road, Teynampet, Chennai",
    pickupLocation: {
      latitude: 13.0410,
      longitude: 80.2410
    },
    locationSharingEnabled: false,
    pickupPersonId: "pickup-raj",
    pickupPersonName: "Raj",
    pickupPersonPhone: "+91 98409 88776",
    createdAt: "2026-10-03T09:10:00Z",
    collectedAt: "2026-10-03T10:15:00Z",
    warehousePickupStatus: "STORED_AT_ACCESS_POINT",
    warehouseCustodyEvents: [
      {
        id: "custody-RET-1043-1",
        status: "STORED_AT_ACCESS_POINT",
        timestamp: "2026-10-03T10:15:00Z",
        actor: "AP-04 Manager"
      }
    ]
  },
  {
    id: "RET-1044",
    orderNumber: "ORD-77401",
    productId: "prod-05",
    productName: "Apple Watch Magnetic Strap",
    productSku: "APPLE-STP-44",
    productImageUrl: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80",
    refundAmount: 1500,
    returnerId: "buyer-01",
    returnerName: "Rahul Verma",
    returnerPhone: "+91 98405 99887",
    accessPointId: "ap-04",
    accessPointName: "Express Electronics",
    accessPointCode: "AP-04",
    status: "RETURN_REQUESTED",
    pickupAddress: "Flat 4B, Cenotaph Road, Teynampet, Chennai",
    pickupLocation: {
      latitude: 13.0458,
      longitude: 80.2382
    },
    locationSharingEnabled: false,
    createdAt: "2026-10-03T11:50:00Z",
    warehousePickupStatus: "AWAITING_ACCESS_POINT"
  }
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-01",
    buyerId: "buyer-01",
    buyerName: "Rahul",
    accessPointId: "ap-04",
    accessPointName: "Express Electronics",
    accessPointCode: "AP-04",
    productId: "prod-01",
    productName: "Nike Air Zoom",
    productImageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
    lastMessageSnippet: "Yes, it is ready at the Access Point.",
    lastMessageTime: "2 min ago",
    unreadCount: 1,
    messages: [
      {
        id: "msg-101",
        senderId: "buyer-01",
        senderRole: "buyer",
        senderName: "Rahul",
        text: "Hi, is the Nike Air Zoom still available for inspection?",
        timestamp: "10:24 AM"
      },
      {
        id: "msg-102",
        senderId: "ap-04-mgr",
        senderRole: "manager",
        senderName: "Express Electronics",
        text: "Yes, your reservation is confirmed on our local shelf.",
        timestamp: "10:26 AM"
      },
      {
        id: "msg-103",
        senderId: "buyer-01",
        senderRole: "buyer",
        senderName: "Rahul",
        text: "Can I collect it today afternoon?",
        timestamp: "10:28 AM"
      },
      {
        id: "msg-104",
        senderId: "ap-04-mgr",
        senderRole: "manager",
        senderName: "Express Electronics",
        text: "Yes, it is ready at the Access Point. Please bring order ID.",
        timestamp: "10:29 AM"
      }
    ]
  },
  {
    id: "conv-pickup-1042",
    buyerId: "buyer-01",
    buyerName: "Rahul Verma",
    accessPointId: "ap-04",
    accessPointName: "Express Electronics",
    accessPointCode: "AP-04",
    returnOrderId: "RET-1042",
    productId: "prod-01",
    productName: "Nike Air Zoom Return (#RET-1042)",
    productImageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
    lastMessageSnippet: "I'll wait near the entrance.",
    lastMessageTime: "3 min ago",
    unreadCount: 0,
    messages: [
      {
        id: "msg-p1",
        senderId: "buyer-01",
        senderRole: "buyer",
        senderName: "Rahul",
        text: "I'm near the blue gate with the Nike box.",
        timestamp: "11:42 AM"
      },
      {
        id: "msg-p2",
        senderId: "pickup-raj",
        senderRole: "pickup_partner",
        senderName: "Raj (Pickup Partner)",
        text: "Okay, I'm on vehicle TN-09-AX-4412, about 2 minutes away.",
        timestamp: "11:44 AM"
      },
      {
        id: "msg-p3",
        senderId: "buyer-01",
        senderRole: "buyer",
        senderName: "Rahul",
        text: "I'll wait near the entrance.",
        timestamp: "11:45 AM"
      }
    ]
  }
];
