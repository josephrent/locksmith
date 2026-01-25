/**
 * API client for the locksmith service request flow.
 */

import { config } from "./config";

const API_BASE_URL = config.apiUrl;

// Types matching backend schemas
export interface RequestSession {
  id: string;
  status: string;
  step_reached: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  address?: string | null;
  city?: string | null;
  is_in_service_area?: boolean | null;
  service_type?: string | null;
  urgency?: string | null;
  description?: string | null;
  deposit_amount?: number | null;
  car_make?: string | null;
  car_model?: string | null;
  car_year?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  job_id?: string | null;
}

export interface LocationValidationData {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  address: string;
}

export interface LocationValidationResponse {
  session_id: string;
  is_in_service_area: boolean;
  city?: string | null;
  message?: string | null;
}

export interface ServiceSelectionData {
  service_type: "home_lockout" | "car_lockout" | "rekey" | "smart_lock";
  urgency: "standard" | "emergency";
  description?: string | null;
}

export interface ServiceSelectionResponse {
  session_id: string;
  deposit_amount: number;
  deposit_display: string;
  service_type: string;
  urgency: string;
}

export interface PaymentIntent {
  session_id: string;
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  amount_display: string;
}

export interface CompleteRequestResponse {
  success: boolean;
  job_id: string;
  message: string;
}

// Admin types
export type JobStatus =
  | "created"
  | "dispatching"
  | "offered"
  | "assigned"
  | "en_route"
  | "completed"
  | "canceled"
  | "failed";

export interface JobOffer {
  id: string;
  locksmith_id: string;
  locksmith_name: string | null;
  locksmith_phone: string | null;
  wave_number: number;
  status: string;
  sent_at: string;
  responded_at: string | null;
}

export interface Job {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_type: string;
  urgency: string;
  description: string | null;
  car_make: string | null;
  car_model: string | null;
  car_year: number | null;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  status: JobStatus;
  deposit_amount: number;
  stripe_payment_intent_id: string | null;
  stripe_payment_status: string | null;
  refund_amount: number | null;
  assigned_locksmith_id: string | null;
  assigned_locksmith_name: string | null;
  assigned_at: string | null;
  current_wave: number;
  dispatch_started_at: string | null;
  offers: JobOffer[] | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface LocksmithStats {
  total_jobs: number;
  completed_jobs: number;
  acceptance_rate: number;
  avg_response_time_seconds: number | null;
}

export interface Locksmith {
  id: string;
  display_name: string;
  phone: string;
  primary_city: string;
  supports_home_lockout: boolean;
  supports_car_lockout: boolean;
  supports_rekey: boolean;
  supports_smart_lock: boolean;
  is_active: boolean;
  is_available: boolean;
  typical_hours: string | null;
  notes: string | null;
  onboarded_at: string;
  updated_at: string;
  stats: LocksmithStats | null;
}

export interface Message {
  id: string;
  job_id: string | null;
  locksmith_id: string | null;
  direction: string;
  to_phone: string;
  from_phone: string;
  body: string;
  provider_message_id: string | null;
  delivery_status: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  locksmith_name: string | null;
  job_service_type: string | null;
}

/**
 * Helper function to handle API errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * API client object with methods for the request flow
 */
export const api = {
  /**
   * Start a new request session
   */
  async startRequest(): Promise<RequestSession> {
    const response = await fetch(`${API_BASE_URL}/api/request/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    return handleResponse<RequestSession>(response);
  },

  /**
   * Validate customer location (Step 1)
   */
  async validateLocation(
    sessionId: string,
    data: LocationValidationData
  ): Promise<LocationValidationResponse> {
    const response = await fetch(`${API_BASE_URL}/api/request/${sessionId}/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return handleResponse<LocationValidationResponse>(response);
  },

  /**
   * Select service type and urgency (Step 2)
   */
  async selectService(
    sessionId: string,
    data: ServiceSelectionData
  ): Promise<ServiceSelectionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/request/${sessionId}/service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return handleResponse<ServiceSelectionResponse>(response);
  },

  /**
   * Create payment intent (Step 3)
   */
  async createPaymentIntent(sessionId: string): Promise<PaymentIntent> {
    const response = await fetch(`${API_BASE_URL}/api/request/${sessionId}/payment-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return handleResponse<PaymentIntent>(response);
  },

  /**
   * Upload a photo for the request session
   */
  async uploadPhoto(sessionId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append("photo", file);
    
    const response = await fetch(`${API_BASE_URL}/api/request/${sessionId}/photo`, {
      method: "POST",
      body: formData,
    });
    const result = await handleResponse<{ photo_id: string }>(response);
    return result.photo_id;
  },

  /**
   * Complete the request after payment (Step 3 completion)
   */
  async completeRequest(sessionId: string): Promise<CompleteRequestResponse> {
    const response = await fetch(`${API_BASE_URL}/api/request/${sessionId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return handleResponse<CompleteRequestResponse>(response);
  },

  // Admin API methods
  /**
   * Get request sessions (admin)
   */
  async getSessions(params?: {
    page?: number;
    status?: string;
    is_in_service_area?: boolean;
  }): Promise<{
    items: RequestSession[];
    total: number;
    page: number;
    page_size: number;
    pages: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.status) queryParams.append("status", params.status);
    if (params?.is_in_service_area !== undefined)
      queryParams.append("is_in_service_area", params.is_in_service_area.toString());

    const response = await fetch(
      `${API_BASE_URL}/api/admin/sessions?${queryParams.toString()}`
    );
    return handleResponse(response);
  },

  /**
   * Get a specific request session (admin)
   */
  async getSession(sessionId: string): Promise<RequestSession> {
    const response = await fetch(`${API_BASE_URL}/api/admin/sessions/${sessionId}`);
    return handleResponse<RequestSession>(response);
  },

  /**
   * Get funnel statistics (admin)
   */
  async getFunnelStats(): Promise<{
    total_started: number;
    location_validated: number;
    location_rejected: number;
    service_selected: number;
    payment_completed: number;
    abandoned: number;
    conversion_rate: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/sessions/stats/funnel`);
    return handleResponse(response);
  },

  /**
   * Get jobs (admin)
   */
  async getJobs(params?: {
    page?: number;
    status?: JobStatus;
    city?: string;
    service_type?: string;
    customer_phone?: string;
    locksmith_id?: string;
  }): Promise<{
    items: Job[];
    total: number;
    page: number;
    page_size: number;
    pages: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.status) queryParams.append("status", params.status);
    if (params?.city) queryParams.append("city", params.city);
    if (params?.service_type) queryParams.append("service_type", params.service_type);
    if (params?.customer_phone) queryParams.append("customer_phone", params.customer_phone);
    if (params?.locksmith_id) queryParams.append("locksmith_id", params.locksmith_id);

    const response = await fetch(
      `${API_BASE_URL}/api/admin/jobs?${queryParams.toString()}`
    );
    return handleResponse(response);
  },

  /**
   * Get a specific job (admin)
   */
  async getJob(jobId: string): Promise<Job> {
    const response = await fetch(`${API_BASE_URL}/api/admin/jobs/${jobId}`);
    return handleResponse<Job>(response);
  },

  /**
   * Get locksmiths (admin)
   */
  async getLocksmiths(params?: {
    page?: number;
    city?: string;
    is_active?: boolean;
    is_available?: boolean;
    service_type?: string;
  }): Promise<{
    items: Locksmith[];
    total: number;
    page: number;
    page_size: number;
    pages: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.city) queryParams.append("city", params.city);
    if (params?.is_active !== undefined)
      queryParams.append("is_active", params.is_active.toString());
    if (params?.is_available !== undefined)
      queryParams.append("is_available", params.is_available.toString());
    if (params?.service_type) queryParams.append("service_type", params.service_type);

    const response = await fetch(
      `${API_BASE_URL}/api/admin/locksmiths?${queryParams.toString()}`
    );
    return handleResponse(response);
  },

  /**
   * Toggle locksmith active status (admin)
   */
  async toggleLocksmithActive(id: string, isActive: boolean): Promise<Locksmith> {
    const response = await fetch(`${API_BASE_URL}/api/admin/locksmiths/${id}/toggle-active`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_active: isActive }),
    });
    return handleResponse<Locksmith>(response);
  },

  /**
   * Toggle locksmith available status (admin)
   */
  async toggleLocksmithAvailable(id: string, isAvailable: boolean): Promise<Locksmith> {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/locksmiths/${id}/toggle-available`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_available: isAvailable }),
      }
    );
    return handleResponse<Locksmith>(response);
  },

  /**
   * Get messages (admin)
   */
  async getMessages(params?: {
    page?: number;
    job_id?: string;
    locksmith_id?: string;
    direction?: string;
    has_error?: boolean;
  }): Promise<{
    items: Message[];
    total: number;
    page: number;
    page_size: number;
    pages: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.job_id) queryParams.append("job_id", params.job_id);
    if (params?.locksmith_id) queryParams.append("locksmith_id", params.locksmith_id);
    if (params?.direction) queryParams.append("direction", params.direction);
    if (params?.has_error !== undefined)
      queryParams.append("has_error", params.has_error.toString());

    const response = await fetch(
      `${API_BASE_URL}/api/admin/messages?${queryParams.toString()}`
    );
    return handleResponse(response);
  },

  /**
   * Assign locksmith to job (admin)
   */
  async assignLocksmith(
    jobId: string,
    locksmithId: string,
    notifyLocksmith?: boolean,
    reason?: string
  ): Promise<Job> {
    const response = await fetch(`${API_BASE_URL}/api/admin/jobs/${jobId}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locksmith_id: locksmithId,
        notify_locksmith: notifyLocksmith ?? true,
        reason: reason,
      }),
    });
    return handleResponse<Job>(response);
  },

  /**
   * Control dispatch (admin)
   */
  async controlDispatch(
    jobId: string,
    action: "restart" | "next_wave" | "cancel",
    reason?: string
  ): Promise<{ success: boolean; action: string }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/jobs/${jobId}/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: action,
        reason: reason,
      }),
    });
    return handleResponse(response);
  },

  /**
   * Complete job (admin)
   */
  async completeJob(jobId: string): Promise<Job> {
    const response = await fetch(`${API_BASE_URL}/api/admin/jobs/${jobId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return handleResponse<Job>(response);
  },

  /**
   * Cancel job (admin)
   */
  async cancelJob(jobId: string, reason?: string): Promise<Job> {
    const queryParams = new URLSearchParams();
    if (reason) queryParams.append("reason", reason);

    const response = await fetch(
      `${API_BASE_URL}/api/admin/jobs/${jobId}/cancel?${queryParams.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return handleResponse<Job>(response);
  },

  /**
   * Create locksmith (admin)
   */
  async createLocksmith(data: {
    display_name: string;
    phone: string;
    primary_city: string;
    supports_home_lockout: boolean;
    supports_car_lockout: boolean;
    supports_rekey: boolean;
    supports_smart_lock: boolean;
    typical_hours?: string | null;
    notes?: string | null;
    is_active?: boolean;
    is_available?: boolean;
  }): Promise<Locksmith> {
    const response = await fetch(`${API_BASE_URL}/api/admin/locksmiths`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return handleResponse<Locksmith>(response);
  },

  /**
   * Process refund for a job (admin)
   */
  async processRefund(
    jobId: string,
    amount: number | null | undefined,
    reason: string
  ): Promise<{ success: boolean; refund_id?: string; error?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/jobs/${jobId}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount !== undefined && amount !== null ? Math.round(amount * 100) : null, // Convert to cents if provided, null for full refund
        reason: reason,
      }),
    });
    return handleResponse(response);
  },
};
