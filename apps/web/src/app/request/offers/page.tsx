"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Key,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  DollarSign,
  Phone,
  Clock,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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


export default function OffersPage() {
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [acceptedCount, setAcceptedCount] = useState(0);

  useEffect(() => {
    // Get session ID from URL params only
    const params = new URLSearchParams(window.location.search);
    const sessionFromUrl = params.get("session");

    if (!sessionFromUrl) {
      setError("No session ID found in URL. Please use the link from your text message.");
      setIsLoading(false);
      return;
    }

    setSessionId(sessionFromUrl);
    fetchOffers(sessionFromUrl);

    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchOffers(sessionFromUrl);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchOffers = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/request/${sessionId}/offers`);
      if (!response.ok) {
        throw new Error("Failed to fetch offers");
      }
      const data: OffersResponse = await response.json();
      setOffers(data.offers);
      setAcceptedCount(data.accepted_offers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offers");
    } finally {
      setIsLoading(false);
    }
  };

  const acceptedOffers = offers.filter((o) => o.status === "accepted");
  const pendingOffers = offers.filter((o) => o.status === "pending");
  const declinedOffers = offers.filter((o) => o.status === "declined");

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
            <Link href="/request" className="btn-ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="card animate-fade-in">
          <h1 className="font-display text-2xl font-bold text-white mb-2">
            Locksmith Quotes
          </h1>
          <p className="text-brand-400 mb-8">
            View quotes from locksmiths for your service request.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
              <p className="text-danger-500">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-copper-500" />
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-brand-800/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-white">{offers.length}</p>
                  <p className="text-sm text-brand-400">Total Offers</p>
                </div>
                <div className="bg-success-500/10 rounded-lg p-4 text-center border border-success-500/30">
                  <p className="text-2xl font-bold text-success-500">{acceptedCount}</p>
                  <p className="text-sm text-brand-400">Quotes Received</p>
                </div>
                <div className="bg-brand-800/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-white">{pendingOffers.length}</p>
                  <p className="text-sm text-brand-400">Awaiting Response</p>
                </div>
              </div>

              {/* Accepted Offers (Quotes) */}
              {acceptedOffers.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Check className="w-5 h-5 text-success-500" />
                    Available Quotes
                  </h2>
                  <div className="space-y-4">
                    {acceptedOffers
                      .sort((a, b) => (a.quoted_price || 0) - (b.quoted_price || 0))
                      .map((offer) => (
                        <div
                          key={offer.id}
                          className="bg-success-500/10 border border-success-500/30 rounded-lg p-6"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white mb-2">
                                {offer.locksmith_name}
                              </h3>
                              {offer.locksmith_phone && (
                                <p className="text-sm text-brand-400 mb-2 flex items-center gap-2">
                                  <Phone className="w-4 h-4" />
                                  {offer.locksmith_phone}
                                </p>
                              )}
                              {offer.responded_at && (
                                <p className="text-xs text-brand-500 flex items-center gap-2">
                                  <Clock className="w-3 h-3" />
                                  Responded {new Date(offer.responded_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-bold text-success-500 mb-1">
                                {offer.quoted_price_display || "N/A"}
                              </p>
                              <p className="text-sm text-brand-400">Quote</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Pending Offers */}
              {pendingOffers.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Awaiting Response ({pendingOffers.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className="bg-brand-800/50 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-white">{offer.locksmith_name}</p>
                          {offer.sent_at && (
                            <p className="text-xs text-brand-500">
                              Sent {new Date(offer.sent_at).toLocaleString()}
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
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Declined ({declinedOffers.length})
                  </h2>
                  <div className="space-y-3">
                    {declinedOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className="bg-brand-800/30 rounded-lg p-4 flex items-center justify-between opacity-60"
                      >
                        <div>
                          <p className="font-medium text-white">{offer.locksmith_name}</p>
                          {offer.responded_at && (
                            <p className="text-xs text-brand-500">
                              Declined {new Date(offer.responded_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-brand-500">Not available</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Offers Yet */}
              {offers.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-brand-500 mx-auto mb-4" />
                  <p className="text-brand-400">
                    No offers yet. Locksmiths are reviewing your request.
                  </p>
                  <p className="text-sm text-brand-500 mt-2">
                    This page will update automatically when quotes arrive.
                  </p>
                </div>
              )}

              {/* Session Info */}
              {sessionId && (
                <div className="mt-8 pt-8 border-t border-brand-800">
                  <p className="text-sm text-brand-500">
                    Session ID: <span className="font-mono text-brand-400">{sessionId.slice(0, 8).toUpperCase()}</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
