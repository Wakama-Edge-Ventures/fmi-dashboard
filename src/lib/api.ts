import type {
  AuthLoginResponse,
  AuthUser,
  Farmer,
  FarmersListResponse,
  Cooperative,
  Parcelle,
  WakamaScoreResult,
  CoopScoreResult,
  Alert,
  NdviResult,
  CreditRequest,
  CreateCreditRequestBody,
  WeatherHistory,
  IotNode,
  IotReading,
  CreditStatus,
} from "@/src/types";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.wakama.farm";
const TOKEN_KEY = "wakama_token";

// ─── Core fetch helper ───────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `API error ${res.status}`);
  }

  // Some PATCH endpoints return 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const auth = {
  login(email: string, password: string): Promise<AuthLoginResponse> {
    return apiFetch<AuthLoginResponse>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  me(): Promise<AuthUser> {
    return apiFetch<AuthUser>("/v1/auth/me");
  },
};

// ─── Farmers ─────────────────────────────────────────────────────────────────

export const farmers = {
  list(params?: {
    page?: number;
    limit?: number;
    cooperativeId?: string;
    region?: string;
  }): Promise<FarmersListResponse> {
    const qs = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<FarmersListResponse>(`/v1/farmers${qs ? `?${qs}` : ""}`);
  },

  get(id: string): Promise<Farmer> {
    return apiFetch<Farmer>(`/v1/farmers/${id}`);
  },

  update(id: string, body: Partial<Farmer>): Promise<Farmer> {
    return apiFetch<Farmer>(`/v1/farmers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
};

// ─── Cooperatives ────────────────────────────────────────────────────────────

export const cooperatives = {
  list(): Promise<Cooperative[]> {
    return apiFetch<Cooperative[]>("/v1/cooperatives");
  },

  get(id: string): Promise<Cooperative> {
    return apiFetch<Cooperative>(`/v1/cooperatives/${id}`);
  },
};

// ─── Parcelles ───────────────────────────────────────────────────────────────

export const parcelles = {
  listByFarmer(farmerId: string): Promise<Parcelle[]> {
    return apiFetch<Parcelle[]>(`/v1/parcelles?farmerId=${farmerId}`);
  },
};

// ─── Scores ──────────────────────────────────────────────────────────────────

export const scores = {
  getFarmer(farmerId: string): Promise<WakamaScoreResult> {
    return apiFetch<WakamaScoreResult>(`/v1/scores/${farmerId}`);
  },

  getCoop(coopId: string): Promise<CoopScoreResult> {
    return apiFetch<CoopScoreResult>(`/v1/scores/coop/${coopId}`);
  },
};

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const alerts = {
  list(params?: {
    farmerId?: string;
    coopId?: string;
    unreadOnly?: boolean;
  }): Promise<Alert[]> {
    const qs = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<Alert[]>(`/v1/alerts${qs ? `?${qs}` : ""}`);
  },

  markRead(id: string): Promise<void> {
    return apiFetch<void>(`/v1/alerts/${id}/read`, { method: "PATCH" });
  },

  markAllRead(): Promise<void> {
    return apiFetch<void>("/v1/alerts/read-all", { method: "PATCH" });
  },
};

// ─── NDVI ────────────────────────────────────────────────────────────────────

export const ndvi = {
  get(parcelleId: string): Promise<NdviResult> {
    return apiFetch<NdviResult>(`/v1/ndvi/${parcelleId}`);
  },

  imageUrl(parcelleId: string): string {
    const token =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : "";
    return `${BASE_URL}/v1/ndvi/parcelle/${parcelleId}/image?token=${token ?? ""}`;
  },
};

// ─── Credit Requests ─────────────────────────────────────────────────────────

export const creditRequests = {
  list(params?: { farmerId?: string }): Promise<CreditRequest[]> {
    const qs = params?.farmerId ? `?farmerId=${params.farmerId}` : "";
    return apiFetch<CreditRequest[]>(`/v1/credit-requests${qs}`);
  },

  create(body: CreateCreditRequestBody): Promise<CreditRequest> {
    return apiFetch<CreditRequest>("/v1/credit-requests", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateStatus(
    id: string,
    statut: CreditStatus,
    extra?: { montantAccorde?: number; tauxApplique?: number }
  ): Promise<CreditRequest> {
    return apiFetch<CreditRequest>(`/v1/credit-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ statut, ...extra }),
    });
  },
};

// ─── Weather ─────────────────────────────────────────────────────────────────

export const weather = {
  getByParcelle(parcelleId: string): Promise<WeatherHistory> {
    return apiFetch<WeatherHistory>(`/v1/weather/history/${parcelleId}`);
  },

  getByFarmer(farmerId: string): Promise<WeatherHistory> {
    return apiFetch<WeatherHistory>(
      `/v1/weather/history/farmer/${farmerId}`
    );
  },
};

// ─── IoT ─────────────────────────────────────────────────────────────────────

export const iot = {
  nodes(coopId: string): Promise<IotNode[]> {
    return apiFetch<IotNode[]>(`/v1/iot/node?coopId=${coopId}`);
  },

  readings(nodeId: string): Promise<IotReading[]> {
    return apiFetch<IotReading[]>(`/v1/iot/readings/${nodeId}`);
  },
};
