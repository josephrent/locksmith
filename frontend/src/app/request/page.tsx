"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  Key,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Phone,
  User,
  Car,
  Home,
  KeyRound,
  Smartphone,
  Check,
  Loader2,
  AlertCircle,
  Camera,
  Upload,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

// Form schemas
const step1Schema = z.object({
  customer_name: z.string().min(2, "Name must be at least 2 characters"),
  customer_phone: z.string().min(10, "Please enter a valid phone number"),
  customer_email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  address: z.string().min(10, "Please enter your full address"),
});

const step2Schema = z.object({
  service_type: z.enum(["home_lockout", "car_lockout", "rekey", "smart_lock"]),
  urgency: z.enum(["standard", "emergency"]),
  description: z.string().optional(),
  // Photo required for home_lockout
  photo: z.instanceof(File).optional(),
  // Car details required for car_lockout
  car_make: z.string().optional(),
  car_model: z.string().optional(),
  car_year: z.number().int().min(1900).max(2100).optional(),
}).refine((data) => {
  // Require photo for home_lockout
  if (data.service_type === "home_lockout") {
    return data.photo !== undefined && data.photo instanceof File;
  }
  return true;
}, {
  message: "Please upload a photo of your door lock",
  path: ["photo"],
}).refine((data) => {
  // Require car details for car_lockout
  if (data.service_type === "car_lockout") {
    return data.car_make && data.car_make.trim().length > 0 &&
           data.car_model && data.car_model.trim().length > 0 &&
           data.car_year !== undefined;
  }
  return true;
}, {
  message: "Car make, model, and year are required",
  path: ["car_make"],
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

const services = [
  {
    id: "home_lockout",
    name: "Home Lockout",
    icon: Home,
    description: "Get back into your home",
  },
  {
    id: "car_lockout",
    name: "Car Lockout",
    icon: Car,
    description: "Unlock your vehicle",
  },
  {
    id: "rekey",
    name: "Lock Rekey",
    icon: KeyRound,
    description: "Change your lock codes",
  },
  {
    id: "smart_lock",
    name: "Smart Lock",
    icon: Smartphone,
    description: "Install keyless entry",
  },
];

export default function RequestPage() {
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationRejected, setLocationRejected] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      urgency: "standard",
    },
  });

  // Reset photo preview when service type changes
  const selectedServiceType = step2Form.watch("service_type");
  useEffect(() => {
    if (selectedServiceType !== "home_lockout") {
      setPhotoPreview(null);
      step2Form.setValue("photo", undefined);
    }
  }, [selectedServiceType, step2Form]);

  // Step 1: Submit personal info and validate location
  const onStep1Submit = async (data: Step1Data) => {
    setIsLoading(true);
    setError(null);

    try {
      // Start session if not already started
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const session = await api.startRequest();
        currentSessionId = session.id;
        setSessionId(session.id);
      }

      // Validate location
      const result = await api.validateLocation(currentSessionId, data);

      if (!result.is_in_service_area) {
        setLocationRejected(true);
        setError(result.message || "We don't currently service your area.");
        return;
      }

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Select service
  const onStep2Submit = async (data: Step2Data) => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Upload photo if provided (for home_lockout)
      let photoId: string | null = null;
      if (data.service_type === "home_lockout" && data.photo) {
        photoId = await api.uploadPhoto(sessionId, data.photo);
      }

      // Submit service selection with car details
      const serviceData: any = {
        service_type: data.service_type,
        urgency: data.urgency,
        description: data.description,
      };

      // Add car details if car_lockout
      if (data.service_type === "car_lockout") {
        serviceData.car_make = data.car_make;
        serviceData.car_model = data.car_model;
        serviceData.car_year = data.car_year;
      }

      const result = await api.selectService(sessionId, serviceData);
      setDepositAmount(result.deposit_display);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Payment (simplified for demo)
  const onPaymentSubmit = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);

    try {
      // First, create the payment intent
      const paymentIntent = await api.createPaymentIntent(sessionId);
      
      // In a real app, you'd integrate Stripe Elements here and process the payment
      // For demo, we'll simulate payment success by calling complete
      // Note: In production, Stripe webhook would handle this
      const result = await api.completeRequest(sessionId);
      setJobId(result.job_id);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-950">
      {/* Header */}
      <header className="border-b border-brand-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-copper-500 rounded-lg flex items-center justify-center">
                <Key className="w-6 h-6 text-white" />
              </div>
              <span className="font-display text-2xl font-bold text-white">
                Locksmith
              </span>
            </Link>
            <Link href="/" className="btn-ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-2xl">
        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    step >= s
                      ? "bg-copper-500 text-white"
                      : "bg-brand-800 text-brand-500"
                  }`}
                >
                  {step > s ? <Check className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-24 sm:w-32 h-1 mx-2 rounded transition-colors ${
                      step > s ? "bg-copper-500" : "bg-brand-800"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 text-sm">
            <span className={step >= 1 ? "text-white" : "text-brand-500"}>
              Your Info
            </span>
            <span className={step >= 2 ? "text-white" : "text-brand-500"}>
              Service
            </span>
            <span className={step >= 3 ? "text-white" : "text-brand-500"}>
              Payment
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
            <p className="text-danger-500">{error}</p>
          </div>
        )}

        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="card animate-fade-in">
            <h1 className="font-display text-2xl font-bold text-white mb-2">
              Where do you need help?
            </h1>
            <p className="text-brand-400 mb-8">
              Tell us your location and we&apos;ll find a locksmith near you.
            </p>

            <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-6">
              <div>
                <label className="label">
                  <User className="w-4 h-4 inline mr-2" />
                  Your Name
                </label>
                <input
                  {...step1Form.register("customer_name")}
                  className={`input ${step1Form.formState.errors.customer_name ? "input-error" : ""}`}
                  placeholder="John Smith"
                />
                {step1Form.formState.errors.customer_name && (
                  <p className="mt-1 text-sm text-danger-500">
                    {step1Form.formState.errors.customer_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="label">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone Number
                </label>
                <input
                  {...step1Form.register("customer_phone")}
                  className={`input ${step1Form.formState.errors.customer_phone ? "input-error" : ""}`}
                  placeholder="(555) 123-4567"
                  type="tel"
                />
                {step1Form.formState.errors.customer_phone && (
                  <p className="mt-1 text-sm text-danger-500">
                    {step1Form.formState.errors.customer_phone.message}
                  </p>
                )}
              </div>

              <div>
                <label className="label">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Full Address
                </label>
                <AddressAutocomplete
                  register={step1Form.register}
                  setValue={step1Form.setValue}
                  error={step1Form.formState.errors.address}
                  className="input"
                  placeholder="123 Main St, San Francisco, CA 94102"
                  apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
                />
                {step1Form.formState.errors.address && (
                  <p className="mt-1 text-sm text-danger-500">
                    {step1Form.formState.errors.address.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Service Selection */}
        {step === 2 && (
          <div className="card animate-fade-in">
            <h1 className="font-display text-2xl font-bold text-white mb-2">
              What do you need help with?
            </h1>
            <p className="text-brand-400 mb-8">
              Select your service and urgency level.
            </p>

            <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {services.map((service) => {
                  const Icon = service.icon;
                  const isSelected = step2Form.watch("service_type") === service.id;
                  return (
                    <label
                      key={service.id}
                      className={`card cursor-pointer transition-all ${
                        isSelected
                          ? "border-copper-500 bg-copper-500/10"
                          : "hover:border-brand-600"
                      }`}
                    >
                      <input
                        type="radio"
                        {...step2Form.register("service_type")}
                        value={service.id}
                        className="sr-only"
                      />
                      <Icon
                        className={`w-8 h-8 mb-3 ${
                          isSelected ? "text-copper-400" : "text-brand-400"
                        }`}
                      />
                      <h3 className="font-semibold text-white">{service.name}</h3>
                      <p className="text-sm text-brand-400">{service.description}</p>
                    </label>
                  );
                })}
              </div>

              <div>
                <label className="label">Urgency</label>
                <div className="flex gap-4">
                  <label
                    className={`flex-1 card cursor-pointer text-center transition-all ${
                      step2Form.watch("urgency") === "standard"
                        ? "border-copper-500 bg-copper-500/10"
                        : "hover:border-brand-600"
                    }`}
                  >
                    <input
                      type="radio"
                      {...step2Form.register("urgency")}
                      value="standard"
                      className="sr-only"
                    />
                    <p className="font-semibold text-white">Standard</p>
                    <p className="text-sm text-brand-400">Within 1-2 hours</p>
                  </label>
                  <label
                    className={`flex-1 card cursor-pointer text-center transition-all ${
                      step2Form.watch("urgency") === "emergency"
                        ? "border-copper-500 bg-copper-500/10"
                        : "hover:border-brand-600"
                    }`}
                  >
                    <input
                      type="radio"
                      {...step2Form.register("urgency")}
                      value="emergency"
                      className="sr-only"
                    />
                    <p className="font-semibold text-white">Emergency</p>
                    <p className="text-sm text-brand-400">ASAP (+50%)</p>
                  </label>
                </div>
              </div>

              {/* Photo upload for home_lockout */}
              {step2Form.watch("service_type") === "home_lockout" && (
                <div>
                  <label className="label">
                    <Camera className="w-4 h-4 inline mr-2" />
                    Photo of Your Door Lock (Required)
                  </label>
                  <div className="space-y-3">
                    <div className="bg-brand-800/50 rounded-lg p-4 border border-brand-700">
                      <p className="text-sm font-semibold text-white mb-2">
                        How to take a proper photo:
                      </p>
                      <ul className="text-sm text-brand-300 space-y-1 list-disc list-inside">
                        <li>Stand 2–4 feet from the door</li>
                        <li>Make sure the entire lock and handle are visible</li>
                        <li>Use good lighting</li>
                      </ul>
                    </div>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        {...step2Form.register("photo", {
                          onChange: (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              step2Form.setValue("photo", file);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setPhotoPreview(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          },
                        })}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="block cursor-pointer"
                      >
                        <div className="border-2 border-dashed border-brand-700 rounded-lg p-8 text-center hover:border-copper-500 transition-colors">
                          {photoPreview ? (
                            <div className="relative">
                              <img
                                src={photoPreview}
                                alt="Preview"
                                className="max-h-48 mx-auto rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPhotoPreview(null);
                                  step2Form.setValue("photo", undefined);
                                  const input = document.getElementById("photo-upload") as HTMLInputElement;
                                  if (input) input.value = "";
                                }}
                                className="absolute top-2 right-2 bg-danger-500 text-white rounded-full p-1 hover:bg-danger-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-12 h-12 mx-auto mb-3 text-brand-400" />
                              <p className="text-white font-medium mb-1">
                                Click to upload photo
                              </p>
                              <p className="text-sm text-brand-400">
                                or use your camera
                              </p>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                    {step2Form.formState.errors.photo && (
                      <p className="text-sm text-danger-500">
                        {step2Form.formState.errors.photo.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Car details for car_lockout */}
              {step2Form.watch("service_type") === "car_lockout" && (
                <div className="space-y-4">
                  <div>
                    <label className="label">
                      <Car className="w-4 h-4 inline mr-2" />
                      Car Make (Required)
                    </label>
                    <input
                      {...step2Form.register("car_make")}
                      className={`input ${step2Form.formState.errors.car_make ? "input-error" : ""}`}
                      placeholder="e.g., Toyota, Ford, Honda"
                    />
                    {step2Form.formState.errors.car_make && (
                      <p className="mt-1 text-sm text-danger-500">
                        {step2Form.formState.errors.car_make.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Car Model (Required)</label>
                    <input
                      {...step2Form.register("car_model")}
                      className={`input ${step2Form.formState.errors.car_model ? "input-error" : ""}`}
                      placeholder="e.g., Camry, F-150, Civic"
                    />
                    {step2Form.formState.errors.car_model && (
                      <p className="mt-1 text-sm text-danger-500">
                        {step2Form.formState.errors.car_model.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Car Year (Required)</label>
                    <input
                      type="number"
                      {...step2Form.register("car_year", { valueAsNumber: true })}
                      className={`input ${step2Form.formState.errors.car_year ? "input-error" : ""}`}
                      placeholder="e.g., 2020"
                      min="1900"
                      max="2100"
                    />
                    {step2Form.formState.errors.car_year && (
                      <p className="mt-1 text-sm text-danger-500">
                        {step2Form.formState.errors.car_year.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Additional Details (Optional)</label>
                <textarea
                  {...step2Form.register("description")}
                  className="input min-h-[100px]"
                  placeholder="Describe your situation in detail"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={
                    isLoading || 
                    !step2Form.watch("service_type") ||
                    (step2Form.watch("service_type") === "home_lockout" && !step2Form.watch("photo")) ||
                    (step2Form.watch("service_type") === "car_lockout" && (
                      !step2Form.watch("car_make")?.trim() ||
                      !step2Form.watch("car_model")?.trim() ||
                      !step2Form.watch("car_year")
                    ))
                  }
                  className="btn-primary flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <div className="card animate-fade-in">
            <h1 className="font-display text-2xl font-bold text-white mb-2">
              Confirm & Pay Deposit
            </h1>
            <p className="text-brand-400 mb-8">
              A small deposit secures your locksmith. You&apos;ll pay the remainder on completion.
            </p>

            <div className="bg-brand-800/50 rounded-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <span className="text-brand-300">Service Deposit</span>
                <span className="text-2xl font-bold text-copper-400">
                  {depositAmount}
                </span>
              </div>
              <p className="text-sm text-brand-500">
                This deposit will be applied to your final bill. Full refund if no locksmith accepts.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="bg-brand-800 rounded-lg p-4">
                <p className="text-sm text-brand-400 mb-2">Payment Demo</p>
                <p className="text-brand-300">
                  In production, Stripe Elements would appear here for secure card input.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
              <button
                onClick={onPaymentSubmit}
                disabled={isLoading}
                className="btn-primary flex-1"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Pay {depositAmount}</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="card animate-fade-in text-center">
            <div className="w-20 h-20 bg-success-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-success-500" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white mb-2">
              Request Submitted!
            </h1>
            <p className="text-brand-400 mb-8">
              We&apos;re finding a locksmith for you now. You&apos;ll receive an SMS when one accepts.
            </p>

            <div className="bg-brand-800/50 rounded-lg p-6 mb-8 text-left">
              <p className="text-sm text-brand-400 mb-2">Reference Number</p>
              <p className="font-mono text-white">{jobId?.slice(0, 8).toUpperCase()}</p>
            </div>

            <Link href="/" className="btn-secondary">
              Back to Home
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
