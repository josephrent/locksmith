"use client";

import { useState, useEffect } from "react";
import { UseFormRegister, UseFormSetValue, FieldError } from "react-hook-form";
import { MapPin, Keyboard, Loader2, Check } from "lucide-react";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { MapPinSelector } from "./MapPinSelector";

interface LocationInputProps {
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  addressError?: FieldError;
  apiKey: string;
  onReverseGeocode?: (lat: number, lng: number) => Promise<string | null>;
}

type LocationMethod = "address" | "pin";

export function LocationInput({
  register,
  setValue,
  addressError,
  apiKey,
  onReverseGeocode,
}: LocationInputProps) {
  const [locationMethod, setLocationMethod] = useState<LocationMethod>("address");
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [reverseGeocodedAddress, setReverseGeocodedAddress] = useState<string | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Update form values when location method changes
  useEffect(() => {
    setValue("location_method", locationMethod, { shouldValidate: true });
  }, [locationMethod, setValue]);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    setValue("latitude", lat, { shouldValidate: true, shouldDirty: true });
    setValue("longitude", lng, { shouldValidate: true, shouldDirty: true });

    // Reverse geocode to show address confirmation
    if (onReverseGeocode) {
      setIsReverseGeocoding(true);
      try {
        const address = await onReverseGeocode(lat, lng);
        setReverseGeocodedAddress(address);
        if (address) {
          setValue("address", address, { shouldValidate: true, shouldDirty: true });
        }
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
      } finally {
        setIsReverseGeocoding(false);
      }
    } else {
      // Fallback: use Google Maps Geocoding directly
      try {
        setIsReverseGeocoding(true);
        if (window.google?.maps) {
          const geocoder = new window.google.maps.Geocoder();
          const result = await geocoder.geocode({ location: { lat, lng } });
          if (result.results?.[0]) {
            const address = result.results[0].formatted_address;
            setReverseGeocodedAddress(address);
            setValue("address", address, { shouldValidate: true, shouldDirty: true });
          }
        }
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
      } finally {
        setIsReverseGeocoding(false);
      }
    }
  };

  const handleMethodChange = (method: LocationMethod) => {
    setLocationMethod(method);

    // Clear location data when switching methods
    if (method === "address") {
      setSelectedLocation(null);
      setReverseGeocodedAddress(null);
      setValue("latitude", null, { shouldValidate: false });
      setValue("longitude", null, { shouldValidate: false });
    } else {
      setValue("address", "", { shouldValidate: false });
    }
  };

  return (
    <div className="space-y-4">
      {/* Method toggle */}
      <div className="flex gap-2 p-1 bg-brand-800 rounded-lg">
        <button
          type="button"
          onClick={() => handleMethodChange("address")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            locationMethod === "address"
              ? "bg-copper-500 text-white"
              : "text-brand-300 hover:text-white hover:bg-brand-700"
          }`}
        >
          <Keyboard className="w-4 h-4" />
          Enter Address
        </button>
        <button
          type="button"
          onClick={() => handleMethodChange("pin")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            locationMethod === "pin"
              ? "bg-copper-500 text-white"
              : "text-brand-300 hover:text-white hover:bg-brand-700"
          }`}
        >
          <MapPin className="w-4 h-4" />
          Drop Pin
        </button>
      </div>

      {/* Address input mode */}
      {locationMethod === "address" && (
        <AddressAutocomplete
          register={register}
          setValue={setValue}
          error={addressError}
          className="input"
          placeholder="123 Main St, San Francisco, CA 94102"
          apiKey={apiKey}
        />
      )}

      {/* Map pin mode */}
      {locationMethod === "pin" && (
        <div className="space-y-3">
          <MapPinSelector
            onLocationSelect={handleLocationSelect}
            selectedLocation={selectedLocation}
            apiKey={apiKey}
          />

          {/* Show reverse geocoded address for confirmation */}
          {selectedLocation && (
            <div className="bg-brand-800/50 rounded-lg p-3 border border-brand-700">
              {isReverseGeocoding ? (
                <div className="flex items-center gap-2 text-brand-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Getting address...</span>
                </div>
              ) : reverseGeocodedAddress ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-brand-400">
                    <Check className="w-4 h-4 text-success-500" />
                    <span>Location selected</span>
                  </div>
                  <p className="text-white font-medium">{reverseGeocodedAddress}</p>
                </div>
              ) : (
                <p className="text-brand-400 text-sm">
                  Pin dropped at {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hidden inputs for form registration */}
      <input type="hidden" {...register("latitude")} />
      <input type="hidden" {...register("longitude")} />
      <input type="hidden" {...register("location_method")} />
    </div>
  );
}
