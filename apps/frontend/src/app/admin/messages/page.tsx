"use client";

import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, ArrowDown, ArrowUp } from "lucide-react";
import { api, Message } from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMessages() {
      setIsLoading(true);
      try {
        const response = await api.getMessages({ page });
        setMessages(response.items);
        setTotal(response.total);
        setPages(response.pages);
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadMessages();
  }, [page]);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">
          Message Audit Log
        </h1>
        <p className="text-brand-400 mt-1">
          View all SMS communications for debugging and disputes
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-500" />
          <input
            type="text"
            placeholder="Search messages..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-brand-400">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-brand-400">
            No messages yet. They&apos;ll appear here when SMS are sent or received.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`card ${
                message.error_code ? "border-danger-500/30" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Direction Icon */}
                <div
                  className={`p-2 rounded-lg ${
                    message.direction === "outbound"
                      ? "bg-copper-500/20 text-copper-400"
                      : "bg-brand-500/20 text-brand-400"
                  }`}
                >
                  {message.direction === "outbound" ? (
                    <ArrowUp className="w-5 h-5" />
                  ) : (
                    <ArrowDown className="w-5 h-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`text-sm font-medium ${
                        message.direction === "outbound"
                          ? "text-copper-400"
                          : "text-brand-300"
                      }`}
                    >
                      {message.direction === "outbound" ? "Sent to" : "Received from"}
                    </span>
                    <span className="text-white">
                      {message.direction === "outbound"
                        ? message.to_phone
                        : message.from_phone}
                    </span>
                    {message.locksmith_name && (
                      <span className="badge-info">{message.locksmith_name}</span>
                    )}
                    {message.job_service_type && (
                      <span className="badge-info">
                        {formatServiceType(message.job_service_type)}
                      </span>
                    )}
                  </div>

                  <p className="text-brand-200 whitespace-pre-wrap">{message.body}</p>

                  {message.error_code && (
                    <p className="mt-2 text-sm text-danger-500">
                      Error {message.error_code}
                    </p>
                  )}
                </div>

                {/* Time */}
                <div className="text-right text-sm">
                  <p className="text-brand-400">
                    {formatDistanceToNow(new Date(message.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                  <p className="text-brand-600">
                    {format(new Date(message.created_at), "p")}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <p className="text-brand-400 text-sm">
            Showing {messages.length} of {total} messages
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

function formatServiceType(type: string): string {
  const types: Record<string, string> = {
    home_lockout: "Home Lockout",
    car_lockout: "Car Lockout",
    rekey: "Rekey",
    smart_lock: "Smart Lock",
  };
  return types[type] || type;
}
