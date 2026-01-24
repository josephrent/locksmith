"use client";

import { useEffect, useRef } from "react";
import { UseFormRegister, UseFormSetValue, FieldError } from "react-hook-form";

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
    __gmpShadowPatched?: boolean;
  }
}

/**
 * Google Places PlaceAutocompleteElement injects a "focus-ring" overlay inside its shadow DOM.
 * If the shadow root is closed, normal CSS cannot reach it.
 *
 * This patch forces gmp-place-autocomplete shadow roots to be open and injects CSS to hide the overlay.
 * Must run BEFORE the Google Maps script loads and the element is created.
 */
function patchGmpShadowDomOnce() {
  if (typeof window === "undefined") return;
  if (window.__gmpShadowPatched) return;
  window.__gmpShadowPatched = true;

  const nativeAttachShadow = Element.prototype.attachShadow;

  Element.prototype.attachShadow = function (init: ShadowRootInit) {
    // Only patch the widget host element
    if (this.localName === "gmp-place-autocomplete") {
      const shadow = nativeAttachShadow.call(this, { ...init, mode: "open" });

      // Hide the injected focus overlay + remove any internal focus shadow
      const style = document.createElement("style");
      style.textContent = `
      /* Remove blue focus overlay */
      .focus-ring {
        display: none !important;
        opacity: 0 !important;
      }
    
      /* Remove clear (X) button */
      .clear-button {
        display: none !important;
      }
    `;
      shadow.appendChild(style);

      return shadow;
    }

    return nativeAttachShadow.call(this, init);
  };
}

export function AddressAutocomplete({
  register,
  setValue,
  error,
  className = "",
  placeholder = "123 Main St, San Francisco, CA 94102",
  apiKey,
}: AddressAutocompleteProps) {
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGoogle() {
      if (window.google?.maps?.places) return;

      // ✅ Must run before the script loads/initializes widgets
      patchGmpShadowDomOnce();

      const existing = document.querySelector<HTMLScriptElement>(
        'script[src*="maps.googleapis.com/maps/api/js"]'
      );

      if (!existing) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=places`;
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Google Maps script"));
          document.head.appendChild(script);
        });
      } else {
        // wait for existing script
        await new Promise<void>((resolve) => {
          const t = setInterval(() => {
            if (window.google?.maps) {
              clearInterval(t);
              resolve();
            }
          }, 50);
          setTimeout(() => {
            clearInterval(t);
            resolve();
          }, 10000);
        });
      }

      // Ensure places is available (new API supports importLibrary)
      if (!window.google?.maps?.places && window.google?.maps?.importLibrary) {
        await window.google.maps.importLibrary("places");
      }
    }

    async function init() {
      await loadGoogle();
      if (cancelled) return;
      if (!containerRef.current) return;
      if (autocompleteRef.current) return;

      const el = new window.google.maps.places.PlaceAutocompleteElement({
        includedRegionCodes: ["us"],
        includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      });

      el.placeholder = placeholder;
      containerRef.current.appendChild(el);
      autocompleteRef.current = el;

      // ✅ Correct event + payload
      el.addEventListener("gmp-select", async (evt: any) => {
        try {
          const { placePrediction } = evt;
          const place = placePrediction.toPlace();
          await place.fetchFields({ fields: ["formattedAddress"] });

          const address = place.formattedAddress ?? "";

          setValue("address", address, { shouldValidate: true, shouldDirty: true });
          if (hiddenInputRef.current) hiddenInputRef.current.value = address;
        } catch (e) {
          console.error(e);
        }
      });

      // ✅ Sync typing into RHF as user types
      const widgetInput = el.querySelector("input") as HTMLInputElement | null;
      if (widgetInput) {
        widgetInput.addEventListener("input", (e) => {
          const value = (e.target as HTMLInputElement).value;

          setValue("address", value, { shouldValidate: true, shouldDirty: true });
          if (hiddenInputRef.current) hiddenInputRef.current.value = value;
        });
      }
    }

    init().catch(console.error);

    return () => {
      cancelled = true;
      if (autocompleteRef.current?.parentElement) {
        autocompleteRef.current.parentElement.removeChild(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, [apiKey, placeholder, setValue]);

  const { ref: registerRef, ...registerProps } = register("address");

  return (
    <>
      <input
        {...registerProps}
        ref={(el) => {
          if (typeof registerRef === "function") registerRef(el);
          hiddenInputRef.current = el;
        }}
        type="text"
        autoComplete="off"
        style={{ display: "none" }}
      />

      <div
        ref={containerRef}
        className={`${className} ${error ? "input-error" : ""}`}
        style={{ width: "100%" }}
      />
    </>
  );
}
