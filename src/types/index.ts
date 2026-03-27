// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthLoginResponse {
  token: string;
  role: string;
  email: string;
}

export interface AuthUser {
  email: string;
  role: string;
}

// ─── Farmer ──────────────────────────────────────────────────────────────────

export interface Farmer {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  region: string;
  village: string;
  photo?: string;
  cniUrl?: string;
  cooperativeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FarmersListResponse {
  data: Farmer[];
  total: number;
  page: number;
  limit: number;
}

// ─── Cooperative ─────────────────────────────────────────────────────────────

export interface Cooperative {
  id: string;
  nom: string;
  region: string;
  totalFarmers: number;
  avgScore?: number;
  createdAt: string;
}

// ─── Parcelle ────────────────────────────────────────────────────────────────

export interface Parcelle {
  id: string;
  farmerId: string;
  surface: number;
  culture: string;
  stade: string;
  polygon?: Array<{ lat: number; lng: number }>;
  createdAt: string;
}

// ─── Score ───────────────────────────────────────────────────────────────────

export type ScoreLevel = "EXCELLENT" | "BON" | "MOYEN" | "FAIBLE";

export interface WakamaScoreResult {
  farmerId: string;
  score: number;
  c1: number; // Capacité    (0-250)
  c2: number; // Caractère   (0-250)
  c3: number; // Collatéral  (0-250)
  c4: number; // Conditions  (0-250)
  label: ScoreLevel;
  eligible: boolean;
  montantMin?: number;
  montantMax?: number;
  updatedAt: string;
}

export interface CoopScoreResult {
  avgScore: number;
  totalFarmers: number;
  eligible: number;
  farmers: Array<{ farmerId: string; score: number }>;
}

// ─── Alert ───────────────────────────────────────────────────────────────────

export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface Alert {
  id: string;
  farmerId?: string;
  coopId?: string;
  severity: AlertSeverity;
  message: string;
  read: boolean;
  createdAt: string;
}

// ─── NDVI ────────────────────────────────────────────────────────────────────

export interface NdviResult {
  parcelleId: string;
  ndvi: number;
  lastUpdated: string;
}

// ─── Credit Request ──────────────────────────────────────────────────────────

export type CreditStatus =
  | "PENDING"
  | "REVIEWING"
  | "APPROVED"
  | "REJECTED";

export interface CreditRequest {
  id: string;
  farmerId: string;
  montant: number;
  duree: number; // months
  objet: string;
  statut: CreditStatus;
  montantAccorde?: number;
  tauxApplique?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCreditRequestBody {
  farmerId: string;
  montant: number;
  duree: number;
  objet: string;
}

// ─── Weather ─────────────────────────────────────────────────────────────────

export interface WeatherDataPoint {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitation: number;
  windspeed: number;
}

export interface WeatherHistory {
  parcelleId?: string;
  farmerId?: string;
  data: WeatherDataPoint[];
}

// ─── IoT ─────────────────────────────────────────────────────────────────────

export interface IotNode {
  id: string;
  coopId: string;
  type: string;
  lat: number;
  lng: number;
  lastSeen: string;
}

export interface IotReading {
  nodeId: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
}
