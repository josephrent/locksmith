"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Loader2,
} from "lucide-react";
import { api, RequestSession } from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";

interface JobOffer {
  id: string;
  locksmith_name: string;
  locksmith_phone: string | null;
  status: string;
  quoted_price: number | null;
  quoted_price_display: string | null;
  sent_at: string | null;
  responded_at: string | null;
}

interface OffersResponse {
  session_id: string;
  offers: JobOffer[];
  total_offers: number;
  accepted_offers: number;
}

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<RequestSession | null>(null);
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [sessionData, offersData] = await Promise.all([
          api.getSession(sessionId),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/request/${sessionId}/offers`)
            .then((res) => res.json() as Promise<OffersResponse>)
            .catch(() => ({ offers: [], total_offers: 0, accepted_offers: 0 })),
        ]);

        setSession(sessionData);
        setOffers(offersData.offers || []);
        setAcceptedCount(offersData.accepted_offers || 0);
      } catch (err) {
        setError("Failed to load session details");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-copper-500" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="card">
        <p className="text-danger-500">{error || "Session not found"}</p>
        <Link href="/admin/sessions" className="btn-secondary mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sessions
        </Link>
      </div>
    );
  }

  const acceptedOffers = offers.filter((o) => o.status === "accepted");
  const pendingOffers = offers.filter((o) => o.status === "pending");
  const declinedOffers = offers.filter((o) => o.status === "declined");

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/sessions"
          className="text-brand-400 hover:text-white mb-4 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sessions
        </Link>
        <h1 className="font-display text-3xl font-bold text-white mt-4">
          Request Session Details
        </h1>
        <p className="text-brand-400 mt-1">
          Session ID: <span className="font-mono text-copper-400">{session.id.slice(0, 8)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <div className="card">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              Customer Information
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-brand-400 mt-0.5" />
                <div>
                  <p className="text-sm text-brand-400">Name</p>
                  <p className="text-white font-medium">
                    {session.customer_name || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-brand-400 mt-0.5" />
                <div>
                  <p className="text-sm text-brand-400">Phone</p>
                  <p className="text-white font-medium">
                    {session.customer_phone || "—"}
                  </p>
                </div>
              </div>
              {session.customer_email && (
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-brand-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-brand-400">Email</p>
                    <p className="text-white font-medium">{session.customer_email}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-brand-400 mt-0.5" />
                <div>
                  <p className="text-sm text-brand-400">Address</p>
                  <p className="text-white font-medium">
                    {session.address || "—"}
                  </p>
                  {session.city && (
                    <p className="text-sm text-brand-400 mt-1">
                      {session.city}
                      {session.is_in_service_area === false && (
                        <span className="ml-2 text-danger-500">(Outside service area)</span>
                      )}
                      {session.is_in_service_area === true && (
                        <span className="ml-2 text-success-500">(In service area)</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Service Details */}
          {session.service_type && (
            <div className="card">
              <h2 className="font-display text-xl font-semibold text-white mb-4">
                Service Details
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-brand-400">Service Type</p>
                  <p className="text-white font-medium">
                    {formatServiceType(session.service_type)}
                  </p>
                </div>
                {session.urgency && (
                  <div>
                    <p className="text-sm text-brand-400">Urgency</p>
                    <p className="text-white font-medium capitalize">
                      {session.urgency}
                    </p>
                  </div>
                )}
                {session.description && (
                  <div>
                    <p className="text-sm text-brand-400">Description</p>
                    <p className="text-white">{session.description}</p>
                  </div>
                )}
                {session.car_make && (
                  <div>
                    <p className="text-sm text-brand-400">Vehicle</p>
                    <p className="text-white">
                      {session.car_make} {session.car_model} {session.car_year}
                    </p>
                  </div>
                )}
                {session.deposit_amount && (
                  <div>
                    <p className="text-sm text-brand-400">Deposit Amount</p>
                    <p className="text-white font-medium">
                      ${(session.deposit_amount / 100).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job Offers */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold text-white">
                Job Offers ({offers.length})
              </h2>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="text-success-500 font-semibold">{acceptedCount}</p>
                  <p className="text-brand-400">Accepted</p>
                </div>
                <div className="text-center">
                  <p className="text-warning-500 font-semibold">{pendingOffers.length}</p>
                  <p className="text-brand-400">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-brand-400 font-semibold">{declinedOffers.length}</p>
                  <p className="text-brand-400">Declined</p>
                </div>
              </div>
            </div>

            {offers.length === 0 ? (
              <p className="text-brand-400 text-center py-8">
                No offers yet. Locksmiths are reviewing the request.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Accepted Offers */}
                {acceptedOffers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-success-500 mb-3">
                      Accepted Quotes ({acceptedOffers.length})
                    </h3>
                    <div className="space-y-3">
                      {acceptedOffers
                        .sort((a, b) => (a.quoted_price || 0) - (b.quoted_price || 0))
                        .map((offer) => (
                          <div
                            key={offer.id}
                            className="bg-success-500/10 border border-success-500/30 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-white mb-1">
                                  {offer.locksmith_name}
                                </p>
                                {offer.locksmith_phone && (
                                  <p className="text-sm text-brand-400 mb-2">
                                    {offer.locksmith_phone}
                                  </p>
                                )}
                                {offer.responded_at && (
                                  <p className="text-xs text-brand-500">
                                    Responded {formatDistanceToNow(new Date(offer.responded_at), { addSuffix: true })}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-success-500">
                                  {offer.quoted_price_display || "N/A"}
                                </p>
                                <p className="text-xs text-brand-400">Quote</p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Pending Offers */}
                {pendingOffers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-warning-500 mb-3">
                      Pending ({pendingOffers.length})
                    </h3>
                    <div className="space-y-3">
                      {pendingOffers.map((offer) => (
                        <div
                          key={offer.id}
                          className="bg-brand-800/50 rounded-lg p-4 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium text-white">{offer.locksmith_name}</p>
                            {offer.sent_at && (
                              <p className="text-xs text-brand-500 mt-1">
                                Sent {formatDistanceToNow(new Date(offer.sent_at), { addSuffix: true })}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-brand-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Waiting...</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Declined Offers */}
                {declinedOffers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-brand-400 mb-3">
                      Declined ({declinedOffers.length})
                    </h3>
                    <div className="space-y-3">
                      {declinedOffers.map((offer) => (
                        <div
                          key={offer.id}
                          className="bg-brand-800/30 rounded-lg p-4 flex items-center justify-between opacity-60"
                        >
                          <div>
                            <p className="font-medium text-white">{offer.locksmith_name}</p>
                            {offer.responded_at && (
                              <p className="text-xs text-brand-500 mt-1">
                                Declined {formatDistanceToNow(new Date(offer.responded_at), { addSuffix: true })}
                              </p>
                            )}
                          </div>
                          <span className="text-sm text-brand-500">Not available</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="card">
            <h3 className="font-display text-lg font-semibold text-white mb-4">
              Session Status
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-brand-400">Status</p>
                <StatusBadge status={session.status} />
              </div>
              <div>
                <p className="text-sm text-brand-400">Step Reached</p>
                <p className="text-white font-medium">Step {session.step_reached}</p>
              </div>
              {session.job_id && (
                <div>
                  <p className="text-sm text-brand-400">Job ID</p>
                  <Link
                    href={`/admin/jobs/${session.job_id}`}
                    className="text-copper-400 hover:text-copper-300 font-mono text-sm"
                  >
                    {session.job_id.slice(0, 8)}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="card">
            <h3 className="font-display text-lg font-semibold text-white mb-4">
              Timeline
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-brand-400">Created</p>
                <p className="text-white text-sm">
                  {format(new Date(session.created_at), "PPpp")}
                </p>
                <p className="text-xs text-brand-500">
                  {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                </p>
              </div>
              {session.updated_at && (
                <div>
                  <p className="text-sm text-brand-400">Last Updated</p>
                  <p className="text-white text-sm">
                    {format(new Date(session.updated_at), "PPpp")}
                  </p>
                </div>
              )}
              {session.completed_at && (
                <div>
                  <p className="text-sm text-brand-400">Completed</p>
                  <p className="text-white text-sm">
                    {format(new Date(session.completed_at), "PPpp")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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
