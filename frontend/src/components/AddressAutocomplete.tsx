"use client";

import { useEffect, useRef } from "react";
import { UseFormSetValue, UseFormRegister, FieldError } from "react-hook-form";

interface AddressAutocompleteProps {
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  error?: FieldError;
  className?: string;
  placeholder?: string;
  apiKey: string;
}

declare global {
  interface Window {
    google: any;
  }
}

export function AddressAutocomplete({
  register,
  setValue,
  error,
  className = "",
  placeholder = "123 Main St, San Francisco, CA 94102",
  apiKey,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initAutocomplete = async () => {
      // Load Google Maps if not already loaded
      if (!window.google?.maps) {
        // Check if script is already being loaded
        if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
          script.async = true;
          script.defer = true;
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        } else {
          // Wait for existing script to load
          await new Promise<void>((resolve) => {
            const checkGoogle = setInterval(() => {
              if (window.google?.maps) {
                clearInterval(checkGoogle);
                resolve();
              }
            }, 100);
            // Timeout after 10 seconds
            setTimeout(() => {
              clearInterval(checkGoogle);
              resolve();
            }, 10000);
          });
        }
      }

      // Wait for places library to be available
      if (!window.google?.maps?.places) {
        // Try new API first
        if (window.google?.maps?.importLibrary) {
          await window.google.maps.importLibrary("places");
        } else {
          // Fallback: wait for places to load (old API loads it via libraries parameter)
          await new Promise<void>((resolve) => {
            const checkPlaces = setInterval(() => {
              if (window.google?.maps?.places) {
                clearInterval(checkPlaces);
                resolve();
              }
            }, 100);
            // Timeout after 5 seconds
            setTimeout(() => {
              clearInterval(checkPlaces);
              resolve();
            }, 5000);
          });
        }
      }

      if (!isMounted || !containerRef.current || autocompleteRef.current) return;

      // Create PlaceAutocompleteElement
      const autocompleteElement = new window.google.maps.places.PlaceAutocompleteElement({
        includedPrimaryTypes: ["street_address", "premise", "subpremise"],
        includedRegionCodes: ["us"],
      });

      autocompleteElement.placeholder = placeholder;
      containerRef.current.appendChild(autocompleteElement);
      autocompleteRef.current = autocompleteElement;

      // Handle place selection
      autocompleteElement.addEventListener("gmp-placeselect", async (event: any) => {
        const place = event.place;
        await place.fetchFields({ fields: ["formattedAddress"] });
        const address = place.formattedAddress || "";
        setValue("address", address, { shouldValidate: true, shouldDirty: true });
        if (inputRef.current) {
          inputRef.current.value = address;
        }
      });

      // Sync input value to hidden input
      const input = autocompleteElement.querySelector("input") as HTMLInputElement;
      if (input && inputRef.current) {
        input.addEventListener("input", (e: any) => {
          const hiddenInput = inputRef.current;
          if (hiddenInput) {
            hiddenInput.value = (e.target as HTMLInputElement).value;
          }
        });
      }

      // Remove blue border and ensure it's clickable
      const style = document.createElement("style");
      style.id = "gmp-autocomplete-styles";
      style.textContent = `
        gmp-place-autocomplete {
          width: 100% !important;
          display: block !important;
        }
        gmp-place-autocomplete input {
          outline: none !important;
          width: 100% !important;
          pointer-events: auto !important;
        }
        gmp-place-autocomplete input:focus {
          outline: none !important;
        }
      `;
      if (!document.head.querySelector("#gmp-autocomplete-styles")) {
        document.head.appendChild(style);
      }

      // Ensure the input is clickable after a short delay
      setTimeout(() => {
        const input = autocompleteElement.querySelector("input") as HTMLInputElement;
        if (input) {
          input.style.pointerEvents = "auto";
          input.style.cursor = "text";
        }
      }, 100);
    };

    initAutocomplete().catch(console.error);

    return () => {
      isMounted = false;
      if (autocompleteRef.current?.parentElement) {
        autocompleteRef.current.parentElement.removeChild(autocompleteRef.current);
      }
    };
  }, [apiKey, placeholder, setValue]);

  const { ref: registerRef, ...registerProps } = register("address");

  return (
    <>
      <input
        {...registerProps}
        ref={(e) => {
          if (registerRef && typeof registerRef === "function") {
            registerRef(e);
          }
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
        }}
        className={`${className} ${error ? "input-error" : ""}`}
        placeholder={placeholder}
        type="text"
        autoComplete="off"
        style={{ display: "none" }}
      />
      <div 
        ref={containerRef} 
        className={className}
        style={{ width: "100%" }}
      />
    </>
  );
}
