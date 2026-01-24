"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Phone,
  MapPin,
} from "lucide-react";
import { api, Locksmith } from "@/lib/api";

export default function LocksmithsPage() {
  const [locksmiths, setLocksmiths] = useState<Locksmith[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadLocksmiths();
  }, [page]);

  async function loadLocksmiths() {
    setIsLoading(true);
    try {
      const response = await api.getLocksmiths({ page });
      setLocksmiths(response.items);
      setTotal(response.total);
      setPages(response.pages);
    } catch (error) {
      console.error("Failed to load locksmiths:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      await api.toggleLocksmithActive(id, isActive);
      loadLocksmiths();
    } catch (error) {
      console.error("Failed to toggle active:", error);
    }
  }

  async function toggleAvailable(id: string, isAvailable: boolean) {
    try {
      await api.toggleLocksmithAvailable(id, isAvailable);
      loadLocksmiths();
    } catch (error) {
      console.error("Failed to toggle available:", error);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">
            Locksmiths
          </h1>
          <p className="text-brand-400 mt-1">
            Manage your locksmith network
          </p>
        </div>
        <Link href="/admin/locksmiths/new" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Add Locksmith
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-500" />
          <input
            type="text"
            placeholder="Search locksmiths..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Locksmiths Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-brand-400">Loading...</div>
      ) : locksmiths.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-brand-400 mb-4">No locksmiths yet</p>
          <Link href="/admin/locksmiths/new" className="btn-primary">
            Add Your First Locksmith
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locksmiths.map((locksmith) => (
            <div key={locksmith.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">
                    {locksmith.display_name}
                  </h3>
                  <div className="flex items-center gap-1 text-brand-400 text-sm mt-1">
                    <MapPin className="w-4 h-4" />
                    {locksmith.primary_city}
                  </div>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      locksmith.is_active ? "bg-success-500" : "bg-danger-500"
                    }`}
                    title={locksmith.is_active ? "Active" : "Inactive"}
                  />
                  <span
                    className={`w-3 h-3 rounded-full ${
                      locksmith.is_available ? "bg-copper-500" : "bg-brand-600"
                    }`}
                    title={locksmith.is_available ? "Available" : "Unavailable"}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-brand-400 text-sm mb-4">
                <Phone className="w-4 h-4" />
                {locksmith.phone}
              </div>

              {/* Services */}
              <div className="flex flex-wrap gap-2 mb-4">
                {locksmith.supports_home_lockout && (
                  <span className="badge-info">Home</span>
                )}
                {locksmith.supports_car_lockout && (
                  <span className="badge-info">Car</span>
                )}
                {locksmith.supports_rekey && (
                  <span className="badge-info">Rekey</span>
                )}
                {locksmith.supports_smart_lock && (
                  <span className="badge-info">Smart</span>
                )}
              </div>

              {/* Stats */}
              {locksmith.stats && (
                <div className="flex gap-4 text-sm mb-4">
                  <div>
                    <span className="text-brand-500">Jobs:</span>{" "}
                    <span className="text-white">{locksmith.stats.total_jobs}</span>
                  </div>
                  <div>
                    <span className="text-brand-500">Accept:</span>{" "}
                    <span className="text-white">
                      {locksmith.stats.acceptance_rate}%
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-brand-800">
                <button
                  onClick={() => toggleActive(locksmith.id, !locksmith.is_active)}
                  className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                    locksmith.is_active
                      ? "bg-danger-500/20 text-danger-500 hover:bg-danger-500/30"
                      : "bg-success-500/20 text-success-500 hover:bg-success-500/30"
                  }`}
                >
                  {locksmith.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() =>
                    toggleAvailable(locksmith.id, !locksmith.is_available)
                  }
                  disabled={!locksmith.is_active}
                  className={`flex-1 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                    locksmith.is_available
                      ? "bg-brand-700 text-brand-300 hover:bg-brand-600"
                      : "bg-copper-500/20 text-copper-400 hover:bg-copper-500/30"
                  }`}
                >
                  {locksmith.is_available ? "Set Unavailable" : "Set Available"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <p className="text-brand-400 text-sm">
            Showing {locksmiths.length} of {total} locksmiths
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
