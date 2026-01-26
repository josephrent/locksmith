"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";

interface MapPinSelectorProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation: { lat: number; lng: number } | null;
  apiKey: string;
  className?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

export function MapPinSelector({
  onLocationSelect,
  selectedLocation,
  apiKey,
  className = "",
}: MapPinSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Default center (Laredo, TX area - can be adjusted based on service area)
  const defaultCenter = { lat: 27.5306, lng: -99.4803 };

  const loadGoogleMaps = useCallback(async () => {
    if (window.google?.maps) return;

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );

    if (!existing) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=marker`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Google Maps"));
        document.head.appendChild(script);
      });
    } else {
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(interval);
            resolve();
          }
        }, 50);
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 10000);
      });
    }
  }, [apiKey]);

  const initMap = useCallback(async () => {
    if (!mapRef.current || googleMapRef.current) return;

    try {
      await loadGoogleMaps();

      const initialCenter = selectedLocation || defaultCenter;

      const map = new window.google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: selectedLocation ? 16 : 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });

      googleMapRef.current = map;

      // Create marker if location is already selected
      if (selectedLocation) {
        markerRef.current = new window.google.maps.Marker({
          position: selectedLocation,
          map: map,
          draggable: true,
          animation: window.google.maps.Animation.DROP,
        });

        markerRef.current.addListener("dragend", () => {
          const pos = markerRef.current.getPosition();
          onLocationSelect(pos.lat(), pos.lng());
        });
      }

      // Add click listener to drop pin
      map.addListener("click", (e: any) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        // Remove existing marker
        if (markerRef.current) {
          markerRef.current.setMap(null);
        }

        // Create new marker
        markerRef.current = new window.google.maps.Marker({
          position: { lat, lng },
          map: map,
          draggable: true,
          animation: window.google.maps.Animation.DROP,
        });

        markerRef.current.addListener("dragend", () => {
          const pos = markerRef.current.getPosition();
          onLocationSelect(pos.lat(), pos.lng());
        });

        onLocationSelect(lat, lng);
      });

      setIsLoading(false);
    } catch (err) {
      setError("Failed to load map");
      setIsLoading(false);
    }
  }, [loadGoogleMaps, onLocationSelect, selectedLocation]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  // Update marker position when selectedLocation changes externally
  useEffect(() => {
    if (googleMapRef.current && selectedLocation && markerRef.current) {
      markerRef.current.setPosition(selectedLocation);
      googleMapRef.current.panTo(selectedLocation);
    }
  }, [selectedLocation]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat, lng });
          googleMapRef.current.setZoom(16);

          // Remove existing marker
          if (markerRef.current) {
            markerRef.current.setMap(null);
          }

          // Create new marker
          markerRef.current = new window.google.maps.Marker({
            position: { lat, lng },
            map: googleMapRef.current,
            draggable: true,
            animation: window.google.maps.Animation.DROP,
          });

          markerRef.current.addListener("dragend", () => {
            const pos = markerRef.current.getPosition();
            onLocationSelect(pos.lat(), pos.lng());
          });
        }

        onLocationSelect(lat, lng);
        setIsLocating(false);
      },
      (err) => {
        setError("Unable to get your location. Please drop a pin manually.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Map container */}
      <div
        ref={mapRef}
        className="w-full h-64 rounded-lg border border-brand-700 overflow-hidden"
        style={{ minHeight: "256px" }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-brand-900/80 rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-copper-500" />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-2 left-2 right-2 bg-danger-500/90 text-white text-sm px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Use current location button */}
      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={isLoading || isLocating}
        className="absolute bottom-3 right-3 bg-brand-800 hover:bg-brand-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm border border-brand-600 disabled:opacity-50"
      >
        {isLocating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Navigation className="w-4 h-4" />
        )}
        Use My Location
      </button>

      {/* Instructions */}
      <div className="mt-2 flex items-center gap-2 text-sm text-brand-400">
        <MapPin className="w-4 h-4 text-copper-500" />
        <span>Click on the map to drop a pin, or use your current location</span>
      </div>
    </div>
  );
}
