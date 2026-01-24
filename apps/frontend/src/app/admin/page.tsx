"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { api, Job, JobStatus } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

export default function AdminDashboard() {
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState({
    activeJobs: 0,
    pendingDispatch: 0,
    completedToday: 0,
    totalLocksmiths: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [jobsResponse, locksmithsResponse] = await Promise.all([
          api.getJobs({ page: 1 }),
          api.getLocksmiths({ page: 1 }),
        ]);

        setRecentJobs(jobsResponse.items.slice(0, 5));

        // Calculate stats
        const activeStatuses: JobStatus[] = [
          "created",
          "dispatching",
          "offered",
          "assigned",
          "en_route",
        ];
        const activeJobs = jobsResponse.items.filter((j) =>
          activeStatuses.includes(j.status)
        ).length;
        const pendingDispatch = jobsResponse.items.filter(
          (j) => j.status === "created" || j.status === "dispatching"
        ).length;
        const completedToday = jobsResponse.items.filter((j) => {
          if (j.status !== "completed" || !j.completed_at) return false;
          const completed = new Date(j.completed_at);
          const today = new Date();
          return completed.toDateString() === today.toDateString();
        }).length;

        setStats({
          activeJobs,
          pendingDispatch,
          completedToday,
          totalLocksmiths: locksmithsResponse.total,
        });
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-brand-400 mt-1">
          Overview of your locksmith marketplace operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Briefcase className="w-6 h-6" />}
          label="Active Jobs"
          value={stats.activeJobs}
          trend="+12%"
          color="copper"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Pending Dispatch"
          value={stats.pendingDispatch}
          color="warning"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="Completed Today"
          value={stats.completedToday}
          color="success"
        />
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Total Locksmiths"
          value={stats.totalLocksmiths}
          color="brand"
        />
      </div>

      {/* Recent Jobs */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold text-white">
            Recent Jobs
          </h2>
          <Link
            href="/admin/jobs"
            className="text-copper-400 hover:text-copper-300 flex items-center gap-1 text-sm"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-brand-400">Loading...</div>
        ) : recentJobs.length === 0 ? (
          <div className="text-center py-8 text-brand-400">
            No jobs yet. They&apos;ll appear here when customers submit requests.
          </div>
        ) : (
          <div className="space-y-4">
            {recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/admin/jobs/${job.id}`}
                className="block p-4 bg-brand-800/30 rounded-lg hover:bg-brand-800/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">
                      {formatServiceType(job.service_type)} • {job.city}
                    </p>
                    <p className="text-sm text-brand-400">
                      {job.customer_name} • {job.customer_phone}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={job.status} />
                    <p className="text-xs text-brand-500 mt-1">
                      {formatDistanceToNow(new Date(job.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  trend,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: string;
  color: "copper" | "success" | "warning" | "brand";
}) {
  const colorClasses = {
    copper: "bg-copper-500/20 text-copper-400",
    success: "bg-success-500/20 text-success-500",
    warning: "bg-warning-500/20 text-warning-500",
    brand: "bg-brand-500/20 text-brand-400",
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {trend && (
          <div className="flex items-center gap-1 text-success-500 text-sm">
            <TrendingUp className="w-4 h-4" />
            {trend}
          </div>
        )}
      </div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
      <p className="text-brand-400 text-sm">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    created: "badge-info",
    dispatching: "badge-warning",
    offered: "badge-warning",
    assigned: "badge-success",
    en_route: "badge-success",
    completed: "badge-success",
    canceled: "badge-danger",
    failed: "badge-danger",
  };

  const labels: Record<JobStatus, string> = {
    created: "Created",
    dispatching: "Dispatching",
    offered: "Offered",
    assigned: "Assigned",
    en_route: "En Route",
    completed: "Completed",
    canceled: "Canceled",
    failed: "Failed",
  };

  return <span className={styles[status]}>{labels[status]}</span>;
}

function formatServiceType(type: string): string {
  const types: Record<string, string> = {
    home_lockout: "Home Lockout",
    car_lockout: "Car Lockout",
    rekey: "Lock Rekey",
    smart_lock: "Smart Lock",
  };
  return types[type] || type;
}
