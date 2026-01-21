"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Clock,
  User,
  CreditCard,
  Send,
  RefreshCw,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { api, Job, JobStatus, Locksmith } from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [locksmiths, setLocksmiths] = useState<Locksmith[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [jobData, locksmithsData] = await Promise.all([
          api.getJob(jobId),
          api.getLocksmiths({ is_active: true }),
        ]);
        setJob(jobData);
        setLocksmiths(locksmithsData.items);
      } catch (err) {
        setError("Failed to load job details");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [jobId]);

  const handleAction = async (
    action: string,
    fn: () => Promise<Job | { success: boolean }>
  ) => {
    setActionLoading(action);
    setError(null);
    try {
      const result = await fn();
      if ("id" in result) {
        setJob(result);
      } else {
        // Reload job after action
        const updatedJob = await api.getJob(jobId);
        setJob(updatedJob);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-copper-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-brand-400">Job not found</p>
        <Link href="/admin/jobs" className="btn-secondary mt-4">
          Back to Jobs
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/jobs" className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-white">
              Job {job.id.slice(0, 8).toUpperCase()}
            </h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-brand-400 mt-1">
            {formatServiceType(job.service_type)} • Created{" "}
            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/30 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-danger-500" />
          <p className="text-danger-500">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-copper-400" />
              Customer Information
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-brand-500 text-sm">Name</p>
                <p className="text-white">{job.customer_name}</p>
              </div>
              <div>
                <p className="text-brand-500 text-sm">Phone</p>
                <a
                  href={`tel:${job.customer_phone}`}
                  className="text-copper-400 hover:text-copper-300"
                >
                  {job.customer_phone}
                </a>
              </div>
              <div className="sm:col-span-2">
                <p className="text-brand-500 text-sm">Address</p>
                <p className="text-white">{job.address}</p>
              </div>
              {job.description && (
                <div className="sm:col-span-2">
                  <p className="text-brand-500 text-sm">Additional Notes</p>
                  <p className="text-brand-300">{job.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Dispatch Status */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-copper-400" />
              Dispatch Status
            </h2>

            {job.assigned_locksmith_name ? (
              <div className="bg-success-500/10 border border-success-500/30 rounded-lg p-4 mb-4">
                <p className="text-success-500 font-medium">
                  Assigned to {job.assigned_locksmith_name}
                </p>
                {job.assigned_at && (
                  <p className="text-sm text-brand-400 mt-1">
                    Assigned{" "}
                    {formatDistanceToNow(new Date(job.assigned_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-brand-400">
                  Wave {job.current_wave} •{" "}
                  {job.offers?.filter((o) => o.status === "pending").length || 0}{" "}
                  pending offers
                </p>
              </div>
            )}

            {/* Offers Timeline */}
            {job.offers && job.offers.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-brand-500">Offer History</p>
                {job.offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="flex items-center justify-between p-3 bg-brand-800/30 rounded-lg"
                  >
                    <div>
                      <p className="text-white">
                        {offer.locksmith_name || "Unknown"}
                      </p>
                      <p className="text-xs text-brand-500">
                        Wave {offer.wave_number} •{" "}
                        {format(new Date(offer.sent_at), "p")}
                      </p>
                    </div>
                    <OfferStatusBadge status={offer.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Info */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-copper-400" />
              Payment
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-brand-400">Deposit</span>
                <span className="text-white font-semibold">
                  ${(job.deposit_amount / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-400">Status</span>
                <span className="text-success-500">
                  {job.stripe_payment_status || "Paid"}
                </span>
              </div>
              {job.refund_amount && (
                <div className="flex justify-between">
                  <span className="text-brand-400">Refunded</span>
                  <span className="text-warning-500">
                    ${(job.refund_amount / 100).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Actions</h2>
            <div className="space-y-3">
              {/* Manual Assignment */}
              {!job.assigned_locksmith_id &&
                ["created", "dispatching", "offered"].includes(job.status) && (
                  <div>
                    <label className="label">Assign Locksmith</label>
                    <select
                      className="input"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAction("assign", () =>
                            api.assignLocksmith(job.id, e.target.value)
                          );
                        }
                      }}
                      disabled={actionLoading === "assign"}
                    >
                      <option value="">Select locksmith...</option>
                      {locksmiths
                        .filter((l) => l.is_available)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.display_name} ({l.primary_city})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

              {/* Dispatch Controls */}
              {["created", "dispatching", "offered", "failed"].includes(
                job.status
              ) && (
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleAction("restart", () =>
                        api.controlDispatch(job.id, "restart")
                      )
                    }
                    disabled={actionLoading !== null}
                    className="btn-secondary flex-1 text-sm"
                  >
                    {actionLoading === "restart" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Restart
                      </>
                    )}
                  </button>
                  <button
                    onClick={() =>
                      handleAction("next_wave", () =>
                        api.controlDispatch(job.id, "next_wave")
                      )
                    }
                    disabled={actionLoading !== null}
                    className="btn-secondary flex-1 text-sm"
                  >
                    {actionLoading === "next_wave" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        Next Wave
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Complete */}
              {job.status === "en_route" && (
                <button
                  onClick={() =>
                    handleAction("complete", () => api.completeJob(job.id))
                  }
                  disabled={actionLoading !== null}
                  className="btn-primary w-full"
                >
                  {actionLoading === "complete" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Completed
                    </>
                  )}
                </button>
              )}

              {/* Cancel */}
              {!["completed", "canceled", "failed"].includes(job.status) && (
                <button
                  onClick={() =>
                    handleAction("cancel", () =>
                      api.cancelJob(job.id, "Canceled by admin")
                    )
                  }
                  disabled={actionLoading !== null}
                  className="btn-danger w-full"
                >
                  {actionLoading === "cancel" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Job
                    </>
                  )}
                </button>
              )}

              {/* Refund */}
              {["canceled", "failed"].includes(job.status) &&
                !job.refund_amount && (
                  <button
                    onClick={() =>
                      handleAction("refund", () =>
                        api.processRefund(job.id, undefined, "Job not completed")
                      )
                    }
                    disabled={actionLoading !== null}
                    className="btn-secondary w-full"
                  >
                    {actionLoading === "refund" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Process Full Refund"
                    )}
                  </button>
                )}
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-copper-400" />
              Timeline
            </h2>
            <div className="space-y-4">
              <TimelineItem
                label="Created"
                time={job.created_at}
                active
              />
              {job.dispatch_started_at && (
                <TimelineItem
                  label="Dispatch Started"
                  time={job.dispatch_started_at}
                />
              )}
              {job.assigned_at && (
                <TimelineItem label="Assigned" time={job.assigned_at} />
              )}
              {job.completed_at && (
                <TimelineItem label="Completed" time={job.completed_at} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  time,
  active,
}: {
  label: string;
  time: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-2 h-2 rounded-full mt-2 ${
          active ? "bg-copper-500" : "bg-brand-600"
        }`}
      />
      <div>
        <p className="text-white text-sm">{label}</p>
        <p className="text-brand-500 text-xs">
          {format(new Date(time), "PPp")}
        </p>
      </div>
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

function OfferStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "badge-warning",
    accepted: "badge-success",
    declined: "badge-danger",
    expired: "badge-info",
    canceled: "badge-info",
  };

  return (
    <span className={styles[status] || "badge-info"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
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
