/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

export default Map;

interface Marker {
  lat: number;
  lng: number;
  label?: string;
}

interface MapProps {
  center: [number, number];
  markers?: Marker[];
  zoom?: number;
  height?: string;
}

/**
 * Map widget using Leaflet + OpenStreetMap tiles.
 *
 * Loads Leaflet from CDN on first render, supports multiple markers.
 * Theme-sensitive: uses --cg- tokens for container styling.
 */

// Track Leaflet loading state globally (one load per iframe).
let leafletReady: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletReady) return leafletReady;
  leafletReady = new Promise<void>((resolve, reject) => {
    // CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.head.appendChild(script);
  });
  return leafletReady;
}

function Map({ center, markers = [], zoom = 13, height = "200px" }: MapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<unknown>(null);

  React.useEffect(() => {
    if (!containerRef.current || !center || center.length < 2) return;

    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !containerRef.current) return;

      const L = (window as unknown as Record<string, unknown>).L as {
        map: (el: HTMLElement) => {
          setView: (center: [number, number], zoom: number) => unknown;
          remove: () => void;
        };
        tileLayer: (
          url: string,
          opts: Record<string, unknown>
        ) => { addTo: (map: unknown) => void };
        marker: (pos: [number, number]) => {
          addTo: (map: unknown) => unknown;
          bindPopup: (html: string) => unknown;
        };
      };

      // Clean up previous map if re-rendering.
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
      }

      const map = L.map(containerRef.current).setView(center, zoom);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add markers.
      for (const m of markers) {
        const pin = L.marker([m.lat, m.lng]).addTo(map) as {
          bindPopup: (str: string) => void;
        };
        if (m.label) {
          pin.bindPopup(m.label);
        }
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [center?.[0], center?.[1], zoom, JSON.stringify(markers)]);

  if (!center || center.length < 2) {
    return React.createElement(
      "div",
      {
        style: {
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--cg-color-surface-container, #eee)",
          borderRadius: "var(--cg-radius-md, 12px)",
          color: "var(--cg-color-on-surface-muted, #888)",
          fontSize: "var(--cg-text-body-md-size, 14px)",
        },
      },
      "📍 Map unavailable"
    );
  }

  return React.createElement("div", {
    ref: containerRef,
    style: {
      height,
      borderRadius: "var(--cg-radius-md, 12px)",
      overflow: "hidden",
    },
  });
}
