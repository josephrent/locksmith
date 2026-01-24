"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";

interface FunnelStats {
  total_started: number;
  location_validated: number;
  location_rejected: number;
  service_selected: number;
  payment_completed: number;
  abandoned: number;
  conversion_rate: number;
}

export default function AnalyticsPage() {
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await api.getFunnelStats();
        setFunnelStats(stats);
      } catch (error) {
        console.error("Failed to load analytics:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-12 text-brand-400">Loading analytics...</div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Analytics</h1>
        <p className="text-brand-400 mt-1">
          Conversion funnel and demand analysis
        </p>
      </div>

      {/* Conversion Rate */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="card lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-copper-500/20 rounded-lg text-copper-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-brand-400 text-sm">Conversion Rate</p>
              <p className="text-3xl font-bold text-white">
                {funnelStats?.conversion_rate || 0}%
              </p>
            </div>
          </div>
          <p className="text-brand-500 text-sm">
            From session start to payment completion
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-success-500/20 rounded-lg text-success-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-brand-400 text-sm">Sessions Started</p>
              <p className="text-3xl font-bold text-white">
                {funnelStats?.total_started || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-danger-500/20 rounded-lg text-danger-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-brand-400 text-sm">Location Rejected</p>
              <p className="text-3xl font-bold text-white">
                {funnelStats?.location_rejected || 0}
              </p>
            </div>
          </div>
          <p className="text-brand-500 text-sm">Outside service areas</p>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="card mb-8">
        <h2 className="font-semibold text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-copper-400" />
          Conversion Funnel
        </h2>

        <div className="space-y-4">
          <FunnelStep
            label="Sessions Started"
            value={funnelStats?.total_started || 0}
            total={funnelStats?.total_started || 1}
            color="brand"
          />
          <FunnelStep
            label="Location Validated"
            value={funnelStats?.location_validated || 0}
            total={funnelStats?.total_started || 1}
            color="brand"
          />
          <FunnelStep
            label="Service Selected"
            value={funnelStats?.service_selected || 0}
            total={funnelStats?.total_started || 1}
            color="copper"
          />
          <FunnelStep
            label="Payment Completed"
            value={funnelStats?.payment_completed || 0}
            total={funnelStats?.total_started || 1}
            color="success"
          />
        </div>
      </div>

      {/* Drop-off Analysis */}
      <div className="card">
        <h2 className="font-semibold text-white mb-6 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-copper-400" />
          Drop-off Analysis
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-brand-400 text-sm mb-2">Abandoned Sessions</p>
            <p className="text-2xl font-bold text-warning-500">
              {funnelStats?.abandoned || 0}
            </p>
            <p className="text-brand-500 text-sm mt-1">
              Started but never completed
            </p>
          </div>
          <div>
            <p className="text-brand-400 text-sm mb-2">Location Rejected</p>
            <p className="text-2xl font-bold text-danger-500">
              {funnelStats?.location_rejected || 0}
            </p>
            <p className="text-brand-500 text-sm mt-1">
              Outside current service areas
            </p>
          </div>
        </div>

        {(funnelStats?.location_rejected || 0) > 0 && (
          <div className="mt-6 p-4 bg-brand-800/50 rounded-lg">
            <p className="text-brand-300 text-sm">
              💡 <strong>Insight:</strong> {funnelStats?.location_rejected} users
              were outside your service areas. Consider expanding to capture this
              demand.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: "brand" | "copper" | "success";
}) {
  const percentage = Math.round((value / total) * 100);
  
  const colorClasses = {
    brand: "bg-brand-500",
    copper: "bg-copper-500",
    success: "bg-success-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-brand-300">{label}</span>
        <span className="text-white font-semibold">
          {value} <span className="text-brand-500 font-normal">({percentage}%)</span>
        </span>
      </div>
      <div className="h-3 bg-brand-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
