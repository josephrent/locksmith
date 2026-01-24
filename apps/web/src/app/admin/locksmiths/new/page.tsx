"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

const locksmithSchema = z.object({
  display_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  primary_city: z.string().min(2, "City is required"),
  supports_home_lockout: z.boolean(),
  supports_car_lockout: z.boolean(),
  supports_rekey: z.boolean(),
  supports_smart_lock: z.boolean(),
  typical_hours: z.string().optional(),
  notes: z.string().optional(),
});

type LocksmithFormData = z.infer<typeof locksmithSchema>;

export default function NewLocksmithPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LocksmithFormData>({
    resolver: zodResolver(locksmithSchema),
    defaultValues: {
      supports_home_lockout: true,
      supports_car_lockout: true,
      supports_rekey: false,
      supports_smart_lock: false,
    },
  });

  async function onSubmit(data: LocksmithFormData) {
    setIsLoading(true);
    setError(null);

    try {
      await api.createLocksmith(data);
      router.push("/admin/locksmiths");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create locksmith");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/locksmiths" className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Add Locksmith
          </h1>
          <p className="text-brand-400 mt-1">
            Manually onboard a new locksmith to your network
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger-500" />
          <p className="text-danger-500">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="font-semibold text-white mb-4">Basic Information</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Display Name / Business Name</label>
              <input
                {...register("display_name")}
                className={`input ${errors.display_name ? "input-error" : ""}`}
                placeholder="John's Locksmith"
              />
              {errors.display_name && (
                <p className="mt-1 text-sm text-danger-500">
                  {errors.display_name.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input
                {...register("phone")}
                className={`input ${errors.phone ? "input-error" : ""}`}
                placeholder="(555) 123-4567"
                type="tel"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-danger-500">
                  {errors.phone.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Primary City / Service Area</label>
              <input
                {...register("primary_city")}
                className={`input ${errors.primary_city ? "input-error" : ""}`}
                placeholder="San Francisco"
              />
              {errors.primary_city && (
                <p className="mt-1 text-sm text-danger-500">
                  {errors.primary_city.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Typical Hours (optional)</label>
              <input
                {...register("typical_hours")}
                className="input"
                placeholder="Mon-Fri 8am-8pm"
              />
            </div>
          </div>
        </div>

        {/* Services */}
        <div>
          <h2 className="font-semibold text-white mb-4">Supported Services</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-4 bg-brand-800/30 rounded-lg cursor-pointer hover:bg-brand-800/50 transition-colors">
              <input
                type="checkbox"
                {...register("supports_home_lockout")}
                className="w-5 h-5 rounded border-brand-600 bg-brand-800 text-copper-500 focus:ring-copper-500"
              />
              <div>
                <p className="text-white font-medium">Home Lockout</p>
                <p className="text-sm text-brand-400">Residential lockouts</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 bg-brand-800/30 rounded-lg cursor-pointer hover:bg-brand-800/50 transition-colors">
              <input
                type="checkbox"
                {...register("supports_car_lockout")}
                className="w-5 h-5 rounded border-brand-600 bg-brand-800 text-copper-500 focus:ring-copper-500"
              />
              <div>
                <p className="text-white font-medium">Car Lockout</p>
                <p className="text-sm text-brand-400">Automotive lockouts</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 bg-brand-800/30 rounded-lg cursor-pointer hover:bg-brand-800/50 transition-colors">
              <input
                type="checkbox"
                {...register("supports_rekey")}
                className="w-5 h-5 rounded border-brand-600 bg-brand-800 text-copper-500 focus:ring-copper-500"
              />
              <div>
                <p className="text-white font-medium">Lock Rekey</p>
                <p className="text-sm text-brand-400">Rekeying existing locks</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 bg-brand-800/30 rounded-lg cursor-pointer hover:bg-brand-800/50 transition-colors">
              <input
                type="checkbox"
                {...register("supports_smart_lock")}
                className="w-5 h-5 rounded border-brand-600 bg-brand-800 text-copper-500 focus:ring-copper-500"
              />
              <div>
                <p className="text-white font-medium">Smart Lock</p>
                <p className="text-sm text-brand-400">Smart lock installation</p>
              </div>
            </label>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Internal Notes (optional)</label>
          <textarea
            {...register("notes")}
            className="input min-h-[100px]"
            placeholder="Any internal notes about this locksmith..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-brand-800">
          <Link href="/admin/locksmiths" className="btn-secondary flex-1">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary flex-1"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Add Locksmith"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
