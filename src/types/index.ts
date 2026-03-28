// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthLoginResponse {
  token: string;
  role: string;
  email: string;
  /** Institution fields (API v2) */
  institutionId?:   string;
  institutionName?: string;
  institutionType?: string;
  modules?:         string[];
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
  attestationUrl?: string;
  cooperativeId?: string;
  experienceAnnees?: number;
  historicCredit?: string;
  revenusAnnexes?: string; // JSON-serialised string[]
  gpsLat?: number;
  gpsLng?: number;
  /** API may return camelCase variants */
  firstName?: string;
  lastName?: string;
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
  name?: string;
  nom: string;
  region: string;
  totalFarmers: number;
  avgScore?: number;
  filiere?: string;
  certification?: string;
  foundedAt?: string;
  rccm?: string;
  contratAcheteurs?: boolean;
  lat?: number;
  lng?: number;
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
  /** GeoJSON string returned by API */
  polygone?: string;
  /** API may return direct coordinates */
  lat?: number;
  lng?: number;
  name?: string;
  ndvi?: number;
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
  /** API may return camelCase score components */
  scoreC1?: number;
  scoreC2?: number;
  scoreC3?: number;
  scoreC4?: number;
  label: ScoreLevel;
  eligible: boolean;
  montantMin?: number;
  montantMax?: number;
  produitSuggere?: string;
  recommendations?: string[];
  details?: {
    c1?: {
      surfaceTotale: number;
      culturesPrincipales: string[];
      revenuEstime: number;
    };
  };
  updatedAt: string;
}

export interface CoopScoreResult {
  avgScore: number;
  totalFarmers: number;
  eligible: number;
  eligibiliteRate?: number;
  farmers: Array<{ farmerId: string; score: number }>;
}

// ─── Alert ───────────────────────────────────────────────────────────────────

export type AlertSeverity =
  | "CRITICAL" | "WARNING" | "INFO"   // legacy values
  | "HIGH"     | "MEDIUM"  | "LOW";   // API v2 values

export type AlertType = "METEO" | "SCORE" | "CREDIT" | "IOT" | "SYSTEM" | string;

export interface Alert {
  id: string;
  farmerId?: string;
  coopId?: string;
  severity: AlertSeverity;
  type?: AlertType;
  title?: string;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt?: string;
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
  institutionId?: string;
  montant: number;
  duree: number; // months
  objet: string;
  message?: string;
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
  nodeCode?: string;
  status?: "LIVE" | "OFFLINE" | string;
  batterie?: number;
  connectivity?: string;
  lastSyncAt?: string;
  totalReadings?: number;
  readings?: IotReading[];
}

export interface IotReading {
  nodeId: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  rssi?: number;
}
