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

const DEMO_WAREHOUSE: [number, number] = [80.2707, 13.0827];
const ROUTE_SOURCE_ID = "warehouse-collection-route";
const ROUTE_LAYER_ID = "warehouse-collection-route";

export const WarehouseRouteMap: React.FC<Props> = ({ order, accessPoint }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<string | null>(null);
  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (!token) {
      setMapError("Mapbox token is missing. Set VITE_MAPBOX_TOKEN to display collection routes.");
      return;
    }

    const origin: [number, number] = accessPoint
      ? [accessPoint.longitude, accessPoint.latitude]
      : [order.pickupLocation.longitude, order.pickupLocation.latitude];
    const map = new mapboxgl.Map({
      accessToken: token,
      container,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [(origin[0] + DEMO_WAREHOUSE[0]) / 2, (origin[1] + DEMO_WAREHOUSE[1]) / 2],
      zoom: 12
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

    const origin: [number, number] = accessPoint
      ? [accessPoint.longitude, accessPoint.latitude]
      : [order.pickupLocation.longitude, order.pickupLocation.latitude];
    const controller = new AbortController();

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (map.getLayer(ROUTE_LAYER_ID)) {
      map.removeLayer(ROUTE_LAYER_ID);
    }
    if (map.getSource(ROUTE_SOURCE_ID)) {
      map.removeSource(ROUTE_SOURCE_ID);
    }

    const addMarker = (
      coordinates: [number, number],
      label: string,
      color: "cyan" | "amber"
    ) => {
      const markerElement = document.createElement("div");
      markerElement.className = color === "cyan"
        ? "rounded-full border border-cyan-300 bg-slate-900/95 px-2.5 py-1.5 text-[10px] font-bold text-cyan-100 shadow-lg"
        : "rounded-full border border-amber-300 bg-slate-900/95 px-2.5 py-1.5 text-[10px] font-bold text-amber-100 shadow-lg";
      markerElement.setAttribute("role", "img");
      markerElement.setAttribute("aria-label", label);
      markerElement.textContent = label;
      markersRef.current.push(
        new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
          .setLngLat(coordinates)
          .addTo(map)
      );
    };

    addMarker(origin, accessPoint ? `${accessPoint.code} · pickup origin` : "Pickup origin", "cyan");
    addMarker(DEMO_WAREHOUSE, "Central demo hub", "amber");
    map.fitBounds([origin, DEMO_WAREHOUSE], { padding: 64, maxZoom: 14, duration: 500 });
    setRouteSummary("Loading driving route to the central demo hub…");

    const loadRoute = async () => {
      try {
        const routeUrl = new URL(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${DEMO_WAREHOUSE[0]},${DEMO_WAREHOUSE[1]}`
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
          throw new Error("Mapbox did not return a drivable route to the central hub.");
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
            "line-color": "#0891b2",
            "line-width": 5,
            "line-opacity": 0.9
          }
        });
        setRouteSummary(
          `Road route · ${(route.distance / 1000).toFixed(1)} km · ${Math.max(1, Math.round(route.duration / 60))} min estimated`
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setRouteSummary(error instanceof Error ? error.message : "Could not load the collection route.");
      }
    };
    void loadRoute();

    return () => {
      controller.abort();
    };
  }, [
    accessPoint?.id,
    accessPoint?.latitude,
    accessPoint?.longitude,
    mapReady,
    order.id,
    order.pickupLocation.latitude,
    order.pickupLocation.longitude,
    token
  ]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Access Point → Central warehouse</h4>
          <p className="text-[9px] text-slate-400">Destination is a demo Chennai hub; replace with your actual warehouse coordinates.</p>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-50 px-2 py-1 text-[9px] font-bold text-cyan-800">
          {order.warehousePickupStatus?.replace(/_/g, " ") || "ROUTE PREVIEW"}
        </span>
      </div>
      <div className="relative h-[250px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 sm:h-[300px]">
        <div ref={containerRef} className="absolute inset-0" style={{ position: "absolute", inset: 0 }} />
        {!mapReady && !mapError && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/30 text-xs text-white">
            Loading collection map…
          </div>
        )}
        {mapError && (
          <div role="alert" className="absolute left-3 right-3 top-3 z-20 rounded-lg border border-rose-400/50 bg-slate-950/95 p-2.5 text-xs text-rose-100">
            Collection map failed to load: {mapError}
          </div>
        )}
        {routeSummary && (
          <div className="absolute bottom-3 left-3 z-10 max-w-[85%] rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow">
            {routeSummary}
          </div>
        )}
      </div>
    </section>
  );
};
