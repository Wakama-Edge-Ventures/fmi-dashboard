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
  DossierComiteData,
} from "@/src/types";
import {
  clearAuth,
  getAuthToken,
  getLoginPath,
  setAuthFlashMessage,
} from "@/src/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "https://api.wakama.farm";
console.log("API BASE URL:", process.env.NEXT_PUBLIC_API_URL);

type ApiErrorBody = {
  message?: string;
  error?: string;
};

function buildHeaders(headers?: HeadersInit): Record<string, string> {
  const builtHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!headers) return builtHeaders;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      builtHeaders[key] = value;
    });
    return builtHeaders;
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      builtHeaders[key] = value;
    });
    return builtHeaders;
  }

  return { ...builtHeaders, ...headers };
}

async function readErrorBody(res: Response): Promise<ApiErrorBody> {
  return (await res.json().catch(() => ({}))) as ApiErrorBody;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = buildHeaders(options.headers);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await readErrorBody(res);
    const backendMessage = body.message ?? body.error;

    if (res.status === 401) {
      clearAuth();
      setAuthFlashMessage("Session expirée, veuillez vous reconnecter.");
      if (typeof window !== "undefined") {
        window.location.assign(getLoginPath());
      }
      throw new Error("Session expirée, veuillez vous reconnecter.");
    }

    if (res.status === 403) {
      throw new Error("Accès non autorisé pour ce rôle.");
    }

    if (res.status === 400 && backendMessage) {
      throw new Error(backendMessage);
    }

    throw new Error(backendMessage ?? `API error ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const auth = {
  login(email: string, password: string): Promise<AuthLoginResponse> {
    return apiFetch<AuthLoginResponse>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  institutionLogin(payload: {
    email: string;
    password: string;
    institution?: string;
  }): Promise<AuthLoginResponse> {
    return apiFetch<AuthLoginResponse>("/v1/auth/institution-login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me(): Promise<AuthUser> {
    return apiFetch<AuthUser>("/v1/auth/me");
  },
};

export const farmers = {
  list(params?: {
    page?: number;
    limit?: number;
    cooperativeId?: string;
    region?: string;
  }): Promise<FarmersListResponse> {
    const qs = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)])
    ).toString();

    return apiFetch<FarmersListResponse>(`/v1/farmers${qs ? `?${qs}` : ""}`);
  },

  get(id: string): Promise<Farmer> {
    return apiFetch<Farmer>(`/v1/farmers/${id}`);
  },

  getCommitteeDossier(id: string): Promise<unknown> {
    return apiFetch<unknown>(`/v1/farmers/${id}/dossier-comite`);
  },

  update(id: string, body: Partial<Farmer>): Promise<Farmer> {
    return apiFetch<Farmer>(`/v1/farmers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
};

export const cooperatives = {
  list(): Promise<Cooperative[]> {
    return apiFetch<Cooperative[]>("/v1/cooperatives");
  },

  get(id: string): Promise<Cooperative> {
    return apiFetch<Cooperative>(`/v1/cooperatives/${id}`);
  },
};

export const parcelles = {
  listByFarmer(farmerId: string): Promise<Parcelle[]> {
    return apiFetch<Parcelle[]>(`/v1/parcelles?farmerId=${farmerId}`);
  },
};

export const scores = {
  getFarmer(farmerId: string): Promise<WakamaScoreResult> {
    return apiFetch<WakamaScoreResult>(`/v1/scores/${farmerId}`);
  },

  getCoop(coopId: string): Promise<CoopScoreResult> {
    return apiFetch<CoopScoreResult>(`/v1/scores/coop/${coopId}`);
  },
};

export const alerts = {
  list(params?: {
    farmerId?: string;
    coopId?: string;
    unreadOnly?: boolean;
  }): Promise<Alert[]> {
    const qs = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)])
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

export const ndvi = {
  get(parcelleId: string): Promise<NdviResult> {
    return apiFetch<NdviResult>(`/v1/ndvi/${parcelleId}`);
  },

  imageUrl(parcelleId: string): string {
    const token = getAuthToken() ?? "";
    return `${BASE_URL}/v1/ndvi/parcelle/${parcelleId}/image?token=${token}`;
  },
};

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

  approveCreditDecision(
    id: string,
    data: { montant: number; taux: number; duree: number; motif?: string }
  ): Promise<CreditRequest> {
    return apiFetch<CreditRequest>(`/v1/credit-requests/${id}/approve`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  rejectCreditDecision(id: string, data: { motif: string }): Promise<CreditRequest> {
    return apiFetch<CreditRequest>(`/v1/credit-requests/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};

export const weather = {
  getByParcelle(parcelleId: string): Promise<WeatherHistory> {
    return apiFetch<WeatherHistory>(`/v1/weather/history/${parcelleId}`);
  },

  getByFarmer(farmerId: string): Promise<WeatherHistory> {
    return apiFetch<WeatherHistory>(`/v1/weather/history/farmer/${farmerId}`);
  },
};

export const institutions = {
  getScoringConfig(institutionId: string): Promise<unknown> {
    return apiFetch<unknown>(`/v1/institutions/${institutionId}/scoring-config`);
  },

  saveScoringConfig(institutionId: string, config: unknown): Promise<unknown> {
    return apiFetch(`/v1/institutions/${institutionId}/scoring-config`, {
      method: "PATCH",
      body: JSON.stringify(config),
    });
  },

  createDecision(
    institutionId: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    return apiFetch(`/v1/institutions/${institutionId}/decisions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateDecision(decisionId: string, payload: Record<string, unknown>): Promise<unknown> {
    return apiFetch(`/v1/institutions/decisions/${decisionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};

export async function getScoringConfig(institutionId: string): Promise<unknown> {
  return institutions.getScoringConfig(institutionId);
}

export async function getDossierComite(farmerId: string): Promise<DossierComiteData> {
  return apiFetch<DossierComiteData>(`/v1/farmers/${farmerId}/dossier-comite`);
}

export async function saveScoringConfig(
  institutionId: string,
  config: unknown
): Promise<unknown> {
  return institutions.saveScoringConfig(institutionId, config);
}

export const iot = {
  nodes(coopId: string): Promise<IotNode[]> {
    return apiFetch<IotNode[]>(`/v1/iot/node?coopId=${coopId}`);
  },

  readings(nodeId: string): Promise<IotReading[]> {
    return apiFetch<IotReading[]>(`/v1/iot/readings/${nodeId}`);
  },
};

function inferMimeFromUrl(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".pdf"))                          return "application/pdf";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".png"))                          return "image/png";
  if (clean.endsWith(".webp"))                         return "image/webp";
  return "";
}

/**
 * Resolves the authoritative MIME type for a farmer document with the following priority:
 * 1. docType === "attestation" → always PDF (backend sends wrong Content-Type)
 * 2. fileUrl path contains "attestation" or ends with ".pdf" → PDF
 * 3. URL extension inference (jpg/png/webp)
 * 4. fallbackBlobMime from the fetch response
 */
function resolveDocumentMime(
  docType: "cni" | "attestation",
  fileUrl: string,
  fallbackBlobMime: string
): string {
  if (docType === "attestation") return "application/pdf";
  const clean = fileUrl.split("?")[0].toLowerCase();
  if (clean.includes("attestation") || clean.endsWith(".pdf")) return "application/pdf";
  const inferred = inferMimeFromUrl(fileUrl);
  if (inferred) return inferred;
  return fallbackBlobMime || "application/octet-stream";
}

export const upload = {
  async getDocument(
    farmerId: string,
    type: "cni" | "attestation"
  ): Promise<{ url: string; mimeType: string }> {
    const token = getAuthToken();
    const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(
      `${BASE_URL}/v1/upload/farmer/${farmerId}/document?type=${type}`,
      { headers: authHeaders }
    );

    if (!res.ok) {
      let body: ApiErrorBody = {};
      try { body = (await res.json()) as ApiErrorBody; } catch { /* ignore */ }
      if (res.status === 401) {
        clearAuth();
        setAuthFlashMessage("Session expirée, veuillez vous reconnecter.");
        if (typeof window !== "undefined") window.location.assign(getLoginPath());
        throw new Error("Session expirée, veuillez vous reconnecter.");
      }
      if (res.status === 403) throw new Error("Accès non autorisé");
      if (res.status === 404) throw new Error("Document non disponible");
      throw new Error(body.message ?? body.error ?? `Erreur ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";

    // Backend returns a JSON envelope with a URL/path to the actual file
    if (contentType.startsWith("application/json")) {
      const data = (await res.json()) as Record<string, unknown>;
      const rawUrl =
        (data.url as string | undefined) ??
        (data.signedUrl as string | undefined) ??
        (data.fileUrl as string | undefined) ??
        (data.path as string | undefined);
      if (!rawUrl) throw new Error("URL du document introuvable dans la réponse API");

      const fullUrl = rawUrl.startsWith("http") ? rawUrl : `${BASE_URL}${rawUrl}`;

      // Fetch the binary so it renders correctly in <img>/<iframe> without CORS issues.
      // Only send Authorization for same-origin URLs (not S3 signed URLs etc.).
      const isSameOrigin = fullUrl.startsWith(BASE_URL);
      try {
        const binaryRes = await fetch(fullUrl, { headers: isSameOrigin ? authHeaders : {} });
        if (binaryRes.ok) {
          const blob = await binaryRes.blob();
          const resolvedMime = resolveDocumentMime(type, fullUrl, blob.type);
          const blobUrl = URL.createObjectURL(blob);
          if (process.env.NODE_ENV !== "production") console.log("MIME DETECTED:", resolvedMime, "URL:", blobUrl);
          return { url: blobUrl, mimeType: resolvedMime };
        }
      } catch { /* fall through to direct URL */ }

      // Fallback: return the URL directly (signed URL or public CDN)
      const fallbackMime = resolveDocumentMime(type, fullUrl, "");
      if (process.env.NODE_ENV !== "production") console.log("MIME DETECTED:", fallbackMime, "URL:", fullUrl);
      return { url: fullUrl, mimeType: fallbackMime };
    }

    // Backend returns the binary directly — use type param as authoritative source
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const blobMime = resolveDocumentMime(type, "", blob.type || contentType);
    if (process.env.NODE_ENV !== "production") console.log("MIME DETECTED:", blobMime, "URL:", blobUrl);
    return { url: blobUrl, mimeType: blobMime };
  },
};
