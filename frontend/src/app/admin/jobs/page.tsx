"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { api, Job, JobStatus } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";

const statusOptions: { value: JobStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "created", label: "Created" },
  { value: "dispatching", label: "Dispatching" },
  { value: "offered", label: "Offered" },
  { value: "assigned", label: "Assigned" },
  { value: "en_route", label: "En Route" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
  { value: "failed", label: "Failed" },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadJobs() {
      setIsLoading(true);
      try {
        const response = await api.getJobs({
          page,
          status: statusFilter || undefined,
        });
        setJobs(response.items);
        setTotal(response.total);
        setPages(response.pages);
      } catch (error) {
        console.error("Failed to load jobs:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadJobs();
  }, [page, statusFilter]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Jobs</h1>
          <p className="text-brand-400 mt-1">
            Monitor and manage all service requests
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-500" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            className="input pl-10"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-500" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as JobStatus | "");
              setPage(1);
            }}
            className="input pl-10 pr-8 appearance-none cursor-pointer"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Customer</th>
              <th>Service</th>
              <th>City</th>
              <th>Status</th>
              <th>Locksmith</th>
              <th>Created</th>
              <th>Deposit</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-brand-400">
                  Loading...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-brand-400">
                  No jobs found
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      className="font-mono text-copper-400 hover:text-copper-300"
                    >
                      {job.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium text-white">{job.customer_name}</p>
                      <p className="text-xs text-brand-500">{job.customer_phone}</p>
                    </div>
                  </td>
                  <td>{formatServiceType(job.service_type)}</td>
                  <td>{job.city}</td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td>
                    {job.assigned_locksmith_name || (
                      <span className="text-brand-500">—</span>
                    )}
                  </td>
                  <td>
                    <span title={format(new Date(job.created_at), "PPpp")}>
                      {formatDistanceToNow(new Date(job.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </td>
                  <td>${(job.deposit_amount / 100).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-brand-400 text-sm">
            Showing {jobs.length} of {total} jobs
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-ghost p-2 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-brand-300 px-4">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page === pages}
              className="btn-ghost p-2 disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
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
