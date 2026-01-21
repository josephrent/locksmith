"use client";

import { useState } from "react";
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
} from "lucide-react";
import { api } from "@/lib/api";

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

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      urgency: "standard",
    },
  });

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
      const result = await api.selectService(sessionId, data);
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
                <input
                  {...step1Form.register("address")}
                  className={`input ${step1Form.formState.errors.address ? "input-error" : ""}`}
                  placeholder="123 Main St, San Francisco, CA 94102"
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

              <div>
                <label className="label">Additional Details (Optional)</label>
                <textarea
                  {...step2Form.register("description")}
                  className="input min-h-[100px]"
                  placeholder="Any additional information about your situation..."
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
                  disabled={isLoading || !step2Form.watch("service_type")}
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
