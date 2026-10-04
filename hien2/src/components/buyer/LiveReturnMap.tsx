import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AccessPoint, ReturnOrder } from "../../types";

interface Props {
  order: ReturnOrder;
  accessPoint?: AccessPoint;
}

interface DirectionsResponse {
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
}

const ROUTE_SOURCE_ID = "return-pickup-route";
const ROUTE_LAYER_ID = "return-pickup-route";

export const LiveReturnMap: React.FC<Props> = ({ order, accessPoint }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const markerColors = {
    amber: {
      border: "border-amber-300",
      text: "text-amber-200",
      dot: "bg-amber-400"
    },
    emerald: {
      border: "border-emerald-300",
      text: "text-emerald-200",
      dot: "bg-emerald-400"
    },
    cyan: {
      border: "border-cyan-300",
      text: "text-cyan-200",
      dot: "bg-cyan-400"
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (!token) {
      setMapError("Mapbox token is missing. Set VITE_MAPBOX_TOKEN to display return tracking.");
      return;
    }

    const pickup: [number, number] = [order.pickupLocation.longitude, order.pickupLocation.latitude];
    const initialCenter: [number, number] = accessPoint
      ? [(pickup[0] + accessPoint.longitude) / 2, (pickup[1] + accessPoint.latitude) / 2]
      : pickup;
    const map = new mapboxgl.Map({
      accessToken: token,
      container,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCenter,
      zoom: 13
    });

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
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const pickup: [number, number] = [order.pickupLocation.longitude, order.pickupLocation.latitude];
    const courier = order.pickupPersonLocation
      ? [order.pickupPersonLocation.longitude, order.pickupPersonLocation.latitude] as [number, number]
      : null;

    if (map.getLayer(ROUTE_LAYER_ID)) {
      map.removeLayer(ROUTE_LAYER_ID);
    }
    if (map.getSource(ROUTE_SOURCE_ID)) {
      map.removeSource(ROUTE_SOURCE_ID);
    }
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const addMarker = (
      coordinates: [number, number],
      title: string,
      label: string,
      color: "amber" | "emerald" | "cyan"
    ) => {
      const markerElement = document.createElement("div");
      markerElement.className = `flex items-center gap-1.5 rounded-full border ${markerColors[color].border} bg-slate-900/95 px-2 py-1 text-[10px] font-bold ${markerColors[color].text} shadow-lg`;
      markerElement.setAttribute("role", "img");
      markerElement.setAttribute("aria-label", title);
      const dot = document.createElement("span");
      dot.className = `h-2.5 w-2.5 rounded-full ${markerColors[color].dot}`;
      const text = document.createElement("span");
      text.textContent = label;
      markerElement.append(dot, text);
      markersRef.current.push(
        new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
          .setLngLat(coordinates)
          .addTo(map)
      );
    };

    addMarker(pickup, "Return pickup location", "Pickup", "amber");
    if (accessPoint) {
      addMarker(
        [accessPoint.longitude, accessPoint.latitude],
        `${accessPoint.name} access point`,
        accessPoint.code,
        "cyan"
      );
    }
    if (courier) {
      addMarker(courier, "Courier live location", order.isDemoMovement ? "Demo courier" : "Courier", "emerald");
    }

    const points = [pickup, ...(courier ? [courier] : []), ...(accessPoint ? [[accessPoint.longitude, accessPoint.latitude] as [number, number]] : [])];
    if (points.length > 1) {
      const bounds = points.reduce(
        (currentBounds, point) => currentBounds.extend(point),
        new mapboxgl.LngLatBounds(points[0], points[0])
      );
      map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 500 });
    } else {
      map.flyTo({ center: pickup, zoom: 14 });
    }

    if (!courier || !["PICKUP_IN_PROGRESS", "ARRIVING", "ARRIVED"].includes(order.status)) {
      setRouteMessage("Courier route is available when a pickup is in progress.");
      return;
    }

    const controller = new AbortController();
    setRouteMessage("Loading the courier's road route…");
    const loadRoute = async () => {
      try {
        const routeUrl = new URL(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${courier[0]},${courier[1]};${pickup[0]},${pickup[1]}`
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
        const route = directions.routes?.[0];
        const coordinates = route?.geometry?.coordinates;
        if (!route || !coordinates || coordinates.length < 2) {
          throw new Error("Mapbox did not return a drivable route for this pickup.");
        }
        if (controller.signal.aborted || mapRef.current !== map) {
          return;
        }

        map.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates }
          }
        });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          paint: {
            "line-color": "#10b981",
            "line-width": 5,
            "line-opacity": 0.9
          }
        });
        setRouteMessage(order.isDemoMovement
          ? `Demo courier · ${Math.max(1, Math.round(route.distance / 1000 * 10) / 10)} km road route`
          : `Courier route · ${Math.max(1, Math.round(route.distance / 1000 * 10) / 10)} km`);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setRouteMessage(error instanceof Error ? error.message : "Could not load the courier road route.");
      }
    };
    void loadRoute();

    return () => {
      controller.abort();
    };
  }, [
    accessPoint,
    mapReady,
    order.id,
    order.isDemoMovement,
    order.pickupLocation.latitude,
    order.pickupLocation.longitude,
    order.pickupPersonLocation?.latitude,
    order.pickupPersonLocation?.longitude,
    order.status,
    token
  ]);

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 sm:h-[340px]">
      <div ref={containerRef} className="absolute inset-0" style={{ position: "absolute", inset: 0 }} />
      {!mapReady && !mapError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/30 text-xs text-white">
          Loading return map…
        </div>
      )}
      {mapError && (
        <div role="alert" className="absolute left-3 right-3 top-3 z-20 rounded-lg border border-rose-400/50 bg-slate-950/95 p-2.5 text-xs text-rose-100">
          Return map failed to load: {mapError}
        </div>
      )}
      {routeMessage && (
        <div className="absolute bottom-3 left-3 z-10 max-w-[85%] rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 text-[10px] font-medium text-white shadow">
          {routeMessage}
        </div>
      )}
    </div>
  );
};
