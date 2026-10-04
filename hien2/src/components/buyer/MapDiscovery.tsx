import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ChevronRight, LocateFixed, RefreshCw, Truck } from "lucide-react";
import { AccessPoint, Product } from "../../types";

interface Props {
  accessPoints: AccessPoint[];
  products: Product[];
  selectedAccessPointId: string | null;
  onSelectAccessPoint: (apId: string | null) => void;
  onViewProductsAtAP: (apId: string) => void;
}

const INITIAL_CENTER: [number, number] = [80.243, 13.044];
const DELIVERY_DURATION_MS = 10000;
const DELIVERY_ROUTE_SOURCE_ID = "simulated-delivery-route";
const DELIVERY_ROUTE_LAYER_ID = "simulated-delivery-route";

interface DirectionsResponse {
  message?: string;
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
}

interface SimulatedKirana {
  id: string;
  name: string;
  coordinates: [number, number];
  distanceKm: number;
}

const createSimulatedKiranas = ([longitude, latitude]: [number, number]): SimulatedKirana[] => {
  const simulatedStores = [
    { bearing: 45, distanceKm: 0.7 },
    { bearing: 165, distanceKm: 1.5 },
    { bearing: 285, distanceKm: 2.4 }
  ];

  return simulatedStores.map(({ bearing, distanceKm }, index) => {
    const radians = (bearing * Math.PI) / 180;
    const latitudeOffset = (distanceKm * Math.cos(radians)) / 111.32;
    const longitudeOffset = (distanceKm * Math.sin(radians)) / (111.32 * Math.cos((latitude * Math.PI) / 180));

    return {
      id: `demo-kirana-${index + 1}`,
      name: `Demo Kirana ${index + 1}`,
      coordinates: [longitude + longitudeOffset, latitude + latitudeOffset],
      distanceKm
    };
  });
};

export const MapDiscovery: React.FC<Props> = ({
  accessPoints,
  products,
  selectedAccessPointId,
  onSelectAccessPoint,
  onViewProductsAtAP
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const kiranaMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const deliveryMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const deliveryFrameRef = useRef<number | null>(null);
  const deliveryRequestRef = useRef<AbortController | null>(null);
  const [activePopupAP, setActivePopupAP] = useState<AccessPoint | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [selectedKiranaId, setSelectedKiranaId] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<"idle" | "loading-route" | "in-transit" | "delivered">("idle");
  const simulatedKiranas = React.useMemo(
    () => userLocation ? createSimulatedKiranas(userLocation) : [],
    [userLocation]
  );
  const selectedKirana = simulatedKiranas.find((store) => store.id === selectedKiranaId) ?? simulatedKiranas[0];
  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token) {
      setMapError("Mapbox token is missing. Add VITE_MAPBOX_TOKEN to hien2/.env.local and restart the dev server.");
      return;
    }

    const container = mapContainerRef.current;
    if (!container) {
      return;
    }

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        accessToken: token,
        container,
        style: "mapbox://styles/mapbox/streets-v12",
        center: INITIAL_CENTER,
        zoom: 12.5
      });
    } catch (error) {
      setMapError(error instanceof Error ? error.message : "Mapbox could not initialize.");
      return;
    }

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    const handleLoad = () => {
      map.resize();
      setMapReady(true);
      setMapError(null);
    };
    const handleError = (event: mapboxgl.ErrorEvent) => {
      setMapError(event.error.message);
    };

    map.on("load", handleLoad);
    map.on("error", handleError);

    return () => {
      map.off("load", handleLoad);
      map.off("error", handleError);
      resizeObserver.disconnect();
      if (deliveryFrameRef.current !== null) {
        cancelAnimationFrame(deliveryFrameRef.current);
      }
      deliveryRequestRef.current?.abort();
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
      kiranaMarkersRef.current.forEach((marker) => marker.remove());
      kiranaMarkersRef.current = [];
      deliveryMarkerRef.current?.remove();
      deliveryMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [token]);

  useEffect(() => {
    if (selectedAccessPointId) {
      const match = accessPoints.find((ap) => ap.id === selectedAccessPointId);
      if (match) {
        setActivePopupAP(match);
        mapRef.current?.flyTo({
          center: [match.longitude, match.latitude],
          zoom: 14
        });
      }
    } else {
      setActivePopupAP(null);
    }
  }, [selectedAccessPointId, accessPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const markers = accessPoints.map((ap) => {
      const availableCount = products.filter(
        (product) => product.accessPointId === ap.id && product.status === "AVAILABLE"
      ).length;
      const isSelected = selectedAccessPointId === ap.id;
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = "flex flex-col items-center cursor-pointer";
      markerElement.setAttribute("aria-label", `${ap.name}, ${availableCount} available items`);

      const icon = document.createElement("span");
      icon.className = `grid h-9 w-9 place-items-center rounded-xl border text-sm font-bold shadow-lg transition-colors ${
        isSelected
          ? "border-emerald-400 bg-emerald-500 text-slate-950"
          : "border-emerald-500/70 bg-slate-900 text-emerald-400"
      }`;
      icon.textContent = "H";

      const count = document.createElement("span");
      count.className = "absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-slate-950";
      count.textContent = String(availableCount);

      const markerIcon = document.createElement("span");
      markerIcon.className = "relative";
      markerIcon.append(icon, count);

      const label = document.createElement("span");
      label.className = "mt-1 rounded border border-slate-700 bg-slate-900/95 px-1.5 py-0.5 text-[10px] font-mono text-white shadow";
      label.textContent = ap.code;
      markerElement.append(markerIcon, label);

      markerElement.addEventListener("click", () => {
        setActivePopupAP(ap);
        onSelectAccessPoint(ap.id);
        map.flyTo({
          center: [ap.longitude, ap.latitude],
          zoom: 14
        });
      });

      return new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat([ap.longitude, ap.latitude])
        .addTo(map);
    });

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [accessPoints, mapReady, onSelectAccessPoint, products, selectedAccessPointId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !userLocation) {
      return;
    }

    const [longitude, latitude] = userLocation;
    const locationElement = document.createElement("div");
    locationElement.className = "h-5 w-5 rounded-full border-[3px] border-white bg-blue-600 shadow-[0_0_0_7px_rgba(37,99,235,0.25)]";
    locationElement.setAttribute("role", "img");
    locationElement.setAttribute("aria-label", "Your current location");
    userLocationMarkerRef.current?.remove();
    userLocationMarkerRef.current = new mapboxgl.Marker({ element: locationElement, anchor: "center" })
      .setLngLat(userLocation)
      .addTo(map);

    kiranaMarkersRef.current.forEach((marker) => marker.remove());
    kiranaMarkersRef.current = simulatedKiranas.map((store) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = "flex flex-col items-center cursor-pointer";
      markerElement.setAttribute("aria-label", `${store.name}, simulated, ${store.distanceKm} km away`);

      const icon = document.createElement("span");
      icon.className = `grid h-9 w-9 place-items-center rounded-full border text-sm font-bold shadow-lg ${
        store.id === selectedKiranaId
          ? "border-amber-300 bg-amber-400 text-slate-950"
          : "border-amber-400 bg-slate-900 text-amber-300"
      }`;
      icon.textContent = "K";

      const label = document.createElement("span");
      label.className = "mt-1 rounded border border-amber-500/60 bg-slate-900/95 px-1.5 py-0.5 text-[10px] font-mono text-amber-100 shadow";
      label.textContent = `DEMO ${store.distanceKm} km`;
      markerElement.append(icon, label);
      markerElement.addEventListener("click", () => {
        setSelectedKiranaId(store.id);
        clearSimulatedDelivery();
        map.flyTo({ center: store.coordinates, zoom: 14 });
      });

      return new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat(store.coordinates)
        .addTo(map);
    });

    return () => {
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
      kiranaMarkersRef.current.forEach((marker) => marker.remove());
      kiranaMarkersRef.current = [];
    };
  }, [mapReady, selectedKiranaId, simulatedKiranas, userLocation]);

  const getAvailableCount = (apId: string) => {
    return products.filter((product) => product.accessPointId === apId && product.status === "AVAILABLE").length;
  };

  const clearSimulatedDelivery = () => {
    deliveryRequestRef.current?.abort();
    deliveryRequestRef.current = null;
    if (deliveryFrameRef.current !== null) {
      cancelAnimationFrame(deliveryFrameRef.current);
      deliveryFrameRef.current = null;
    }
    deliveryMarkerRef.current?.remove();
    deliveryMarkerRef.current = null;

    const map = mapRef.current;
    if (map?.getLayer(DELIVERY_ROUTE_LAYER_ID)) {
      map.removeLayer(DELIVERY_ROUTE_LAYER_ID);
    }
    if (map?.getSource(DELIVERY_ROUTE_SOURCE_ID)) {
      map.removeSource(DELIVERY_ROUTE_SOURCE_ID);
    }
    setDeliveryStatus("idle");
  };

  const resetMap = () => {
    onSelectAccessPoint(null);
    setActivePopupAP(null);
    mapRef.current?.flyTo({ center: INITIAL_CENTER, zoom: 12.5 });
  };

  const showMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location access is not supported by this browser.");
      return;
    }

    setLocationError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setIsLocating(false);
        setLocationError(null);
        onSelectAccessPoint(null);
        setActivePopupAP(null);
        clearSimulatedDelivery();

        const map = mapRef.current;
        if (!map) {
          setLocationError("The map is not ready yet. Please try again.");
          return;
        }

        const location: [number, number] = [coords.longitude, coords.latitude];
        setUserLocation(location);
        setSelectedKiranaId("demo-kirana-1");
        setDeliveryStatus("idle");
        map.flyTo({
          center: location,
          zoom: 15
        });
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location permission was denied. Allow location access for this site in your browser settings, then try again.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError("Your current location is unavailable. Check your device's location services and try again.");
        } else if (error.code === error.TIMEOUT) {
          setLocationError("Getting your location timed out. Please try again.");
        } else {
          setLocationError("Could not get your location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const simulateDelivery = async () => {
    const map = mapRef.current;
    if (!map || !userLocation || !selectedKirana) {
      setLocationError("Share your location first to simulate a nearby kirana delivery.");
      return;
    }

    clearSimulatedDelivery();
    const start = selectedKirana.coordinates;
    const destination = userLocation;
    const controller = new AbortController();
    deliveryRequestRef.current = controller;
    setDeliveryStatus("loading-route");
    setLocationError(null);

    try {
      const routeUrl = new URL(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${destination[0]},${destination[1]}`
      );
      routeUrl.search = new URLSearchParams({
        geometries: "geojson",
        overview: "full",
        steps: "true",
        access_token: token
      }).toString();

      const response = await fetch(routeUrl, { signal: controller.signal });
      const directions = await response.json() as DirectionsResponse;
      if (!response.ok) {
        throw new Error(directions.message || `Directions request failed (${response.status}).`);
      }

      const routeCoordinates = directions.routes?.[0]?.geometry?.coordinates;
      if (!routeCoordinates || routeCoordinates.length < 2) {
        throw new Error("Mapbox did not return a drivable route for this location.");
      }

      if (controller.signal.aborted || mapRef.current !== map) {
        return;
      }
      deliveryRequestRef.current = null;

      map.addSource(DELIVERY_ROUTE_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: routeCoordinates }
        }
      });
      map.addLayer({
        id: DELIVERY_ROUTE_LAYER_ID,
        type: "line",
        source: DELIVERY_ROUTE_SOURCE_ID,
        paint: {
          "line-color": "#f59e0b",
          "line-width": 5,
          "line-opacity": 0.9
        }
      });

      const courierElement = document.createElement("div");
      courierElement.className = "grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-emerald-500 text-slate-950 shadow-lg";
      courierElement.setAttribute("role", "img");
      courierElement.setAttribute("aria-label", "Simulated delivery courier");
      courierElement.textContent = "D";
      const courier = new mapboxgl.Marker({ element: courierElement, anchor: "center" })
        .setLngLat(routeCoordinates[0])
        .addTo(map);
      deliveryMarkerRef.current = courier;
      setDeliveryStatus("in-transit");
      map.fitBounds(
        routeCoordinates.reduce(
          (bounds, coordinate) => bounds.extend(coordinate),
          new mapboxgl.LngLatBounds(routeCoordinates[0], routeCoordinates[0])
        ),
        { padding: 100, maxZoom: 15, duration: 700 }
      );

      const distanceMeters = (from: [number, number], to: [number, number]) => {
        const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
        const [fromLongitude, fromLatitude] = from.map(toRadians);
        const [toLongitude, toLatitude] = to.map(toRadians);
        const latitudeDelta = toLatitude - fromLatitude;
        const longitudeDelta = toLongitude - fromLongitude;
        const haversine = Math.sin(latitudeDelta / 2) ** 2
          + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
        return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
      };
      const cumulativeDistances = [0];
      for (let index = 1; index < routeCoordinates.length; index += 1) {
        cumulativeDistances.push(
          cumulativeDistances[index - 1] + distanceMeters(routeCoordinates[index - 1], routeCoordinates[index])
        );
      }
      const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
      if (totalDistance <= 0) {
        throw new Error("Mapbox returned a route with no measurable distance.");
      }

      const startedAt = performance.now();
      const moveCourier = (now: number) => {
        const progress = Math.min((now - startedAt) / DELIVERY_DURATION_MS, 1);
        const targetDistance = totalDistance * progress;
        let segmentIndex = 1;
        while (
          segmentIndex < cumulativeDistances.length - 1
          && cumulativeDistances[segmentIndex] < targetDistance
        ) {
          segmentIndex += 1;
        }

        const segmentStartDistance = cumulativeDistances[segmentIndex - 1];
        const segmentDistance = cumulativeDistances[segmentIndex] - segmentStartDistance;
        const segmentProgress = segmentDistance > 0
          ? (targetDistance - segmentStartDistance) / segmentDistance
          : 0;
        const segmentStart = routeCoordinates[segmentIndex - 1];
        const segmentEnd = routeCoordinates[segmentIndex];
        courier.setLngLat([
          segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * segmentProgress,
          segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * segmentProgress
        ]);

        if (progress < 1) {
          deliveryFrameRef.current = requestAnimationFrame(moveCourier);
        } else {
          deliveryFrameRef.current = null;
          setDeliveryStatus("delivered");
        }
      };
      deliveryFrameRef.current = requestAnimationFrame(moveCourier);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      deliveryRequestRef.current = null;
      setDeliveryStatus("idle");
      setLocationError(error instanceof Error ? error.message : "Could not load a road route for the delivery.");
    }
  };

  return (
    <div className="relative h-full min-h-[300px] w-full select-none overflow-hidden rounded-2xl border border-slate-800 bg-[#0B1220] shadow-xs">
      <div
        ref={mapContainerRef}
        className="absolute inset-0"
        style={{ position: "absolute", inset: 0 }}
      />

      <div className="pointer-events-none absolute left-3 right-12 top-3 z-10 flex items-center justify-between">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs text-white shadow-xs backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-semibold">HIEN Local Radar</span>
          <span className="text-slate-500">|</span>
          <span className="font-mono text-[11px] text-slate-300">3.0 km radius</span>
        </div>

        <button
          onClick={resetMap}
          className="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 p-1.5 text-xs font-medium text-slate-300 shadow-xs transition-colors hover:bg-slate-800 hover:text-white"
          title="Reset map view"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">All APs</span>
        </button>
      </div>

      <button
        onClick={showMyLocation}
        disabled={!mapReady || isLocating}
        className="absolute right-3 top-16 z-10 flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs font-semibold text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
        aria-label="Show my location"
        title="Show my location"
      >
        <LocateFixed className="h-4 w-4 text-blue-300" />
        <span>{isLocating ? "Locating…" : "My location"}</span>
      </button>

      {!mapReady && !mapError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/30 text-sm text-white">
          Loading map…
        </div>
      )}

      {mapError && (
        <div role="alert" className="absolute inset-x-3 top-16 z-20 rounded-xl border border-amber-400/50 bg-slate-950/95 p-3 text-xs text-amber-100 shadow-lg">
          Mapbox map failed to load: {mapError}
        </div>
      )}

      {locationError && (
        <div role="alert" className="absolute inset-x-3 top-16 z-20 rounded-xl border border-amber-400/50 bg-slate-950/95 p-3 pr-9 text-xs text-amber-100 shadow-lg">
          {locationError}
          <button
            onClick={() => setLocationError(null)}
            className="absolute right-3 top-2 text-sm text-amber-100/70 hover:text-white"
            aria-label="Dismiss location message"
          >
            ✕
          </button>
        </div>
      )}

      {userLocation && selectedKirana && (
        <div className="absolute bottom-3 left-3 right-3 z-20 rounded-xl border border-amber-500/50 bg-slate-900/95 p-3 text-white shadow-lg backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-amber-200">Simulated kirana stores</p>
              <p className="text-[10px] text-slate-400">Demo locations only — not verified real shops</p>
            </div>
            <span className="shrink-0 rounded bg-emerald-950 px-2 py-1 text-[10px] font-semibold text-emerald-300">
              All within 3 km
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {simulatedKiranas.map((store) => (
              <button
                key={store.id}
                onClick={() => {
                  setSelectedKiranaId(store.id);
                  clearSimulatedDelivery();
                  mapRef.current?.flyTo({ center: store.coordinates, zoom: 14 });
                }}
                className={`rounded-lg border px-2 py-1 text-[10px] font-medium ${
                  selectedKirana.id === store.id
                    ? "border-amber-300 bg-amber-400 text-slate-950"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:border-amber-400"
                }`}
              >
                {store.name} · {store.distanceKm} km
              </button>
            ))}
            <button
              onClick={simulateDelivery}
              disabled={deliveryStatus === "loading-route" || deliveryStatus === "in-transit"}
              className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-70"
            >
              <Truck className="h-3.5 w-3.5" />
              {deliveryStatus === "in-transit"
                ? "Delivering…"
                : deliveryStatus === "loading-route"
                  ? "Finding road route…"
                : deliveryStatus === "delivered"
                  ? "Delivered (demo)"
                  : "Simulate delivery"}
            </button>
          </div>
          {deliveryStatus === "in-transit" && (
            <p className="mt-2 text-[10px] text-emerald-300">Courier is following the Mapbox driving route to your location…</p>
          )}
          {deliveryStatus === "delivered" && (
            <p className="mt-2 text-[10px] text-emerald-300">Demo delivery complete. No real order was placed.</p>
          )}
        </div>
      )}

      {activePopupAP && (
        <div className="animate-fade-in absolute bottom-3 left-3 right-3 z-20">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 text-white shadow-md backdrop-blur-sm">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="rounded border border-emerald-800 bg-emerald-950 px-1.5 py-0.2 text-[10px] font-mono font-bold text-emerald-400">
                  {activePopupAP.code}
                </span>
                <h4 className="truncate text-xs font-bold">{activePopupAP.name}</h4>
              </div>
              <p className="truncate text-[11px] text-slate-400">{activePopupAP.address}</p>
              <p className="text-[11px] font-medium text-emerald-400">
                {getAvailableCount(activePopupAP.id)} open-box items ready for pickup
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => onViewProductsAtAP(activePopupAP.id)}
                className="flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                <span>Filter</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setActivePopupAP(null)}
                className="px-1 text-xs text-slate-400 hover:text-white"
                aria-label="Close access point details"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
