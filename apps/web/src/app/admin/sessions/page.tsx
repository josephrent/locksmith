"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, ChevronLeft, ChevronRight, Eye, CheckCircle, XCircle, Clock } from "lucide-react";
import { api, RequestSession } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";

const statusOptions: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "started", label: "Started" },
  { value: "location_validated", label: "Location Validated" },
  { value: "location_rejected", label: "Location Rejected" },
  { value: "service_selected", label: "Service Selected" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "payment_pending", label: "Payment Pending" },
  { value: "payment_completed", label: "Payment Completed" },
  { value: "abandoned", label: "Abandoned" },
];

export default function SessionsPage() {
  const [sessions, setSessions] = useState<RequestSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSessions() {
      setIsLoading(true);
      try {
        const response = await api.getSessions({
          page,
          status: statusFilter || undefined,
        });
        setSessions(response.items);
        setTotal(response.total);
        setPages(response.pages);
      } catch (error) {
        console.error("Failed to load sessions:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSessions();
  }, [page, statusFilter]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Request Sessions</h1>
          <p className="text-brand-400 mt-1">
            Monitor customer request flow and funnel analysis
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
              setStatusFilter(e.target.value);
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

      {/* Sessions Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Customer</th>
              <th>Service</th>
              <th>City</th>
              <th>Status</th>
              <th>Step</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-brand-400">
                  Loading...
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-brand-400">
                  No sessions found
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    <span className="font-mono text-copper-400 text-sm">
                      {session.id.slice(0, 8)}
                    </span>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium text-white">
                        {session.customer_name || "—"}
                      </p>
                      <p className="text-xs text-brand-500">
                        {session.customer_phone || "—"}
                      </p>
                    </div>
                  </td>
                  <td>
                    {session.service_type ? (
                      formatServiceType(session.service_type)
                    ) : (
                      <span className="text-brand-500">—</span>
                    )}
                  </td>
                  <td>
                    {session.city ? (
                      <div className="flex items-center gap-1">
                        <span>{session.city}</span>
                        {session.is_in_service_area === false && (
                          <XCircle className="w-4 h-4 text-danger-500" title="Outside service area" />
                        )}
                        {session.is_in_service_area === true && (
                          <CheckCircle className="w-4 h-4 text-success-500" title="In service area" />
                        )}
                      </div>
                    ) : (
                      <span className="text-brand-500">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={session.status} />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-brand-400">Step {session.step_reached}</span>
                    </div>
                  </td>
                  <td>
                    <span title={format(new Date(session.created_at), "PPpp")}>
                      {formatDistanceToNow(new Date(session.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/admin/sessions/${session.id}`}
                      className="btn-ghost p-2 text-copper-400 hover:text-copper-300"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
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
            Showing {sessions.length} of {total} sessions
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

function StatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, string> = {
    started: "badge-info",
    location_validated: "badge-success",
    location_rejected: "badge-danger",
    service_selected: "badge-info",
    pending_approval: "badge-warning",
    payment_pending: "badge-warning",
    payment_completed: "badge-success",
    abandoned: "badge-danger",
  };

  const statusLabels: Record<string, string> = {
    started: "Started",
    location_validated: "Location Validated",
    location_rejected: "Location Rejected",
    service_selected: "Service Selected",
    pending_approval: "Pending Approval",
    payment_pending: "Payment Pending",
    payment_completed: "Payment Completed",
    abandoned: "Abandoned",
  };

  const style = statusStyles[status] || "badge-info";
  const label = statusLabels[status] || status;

  return <span className={style}>{label}</span>;
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
