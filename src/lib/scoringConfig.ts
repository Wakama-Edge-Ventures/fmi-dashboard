// ─── Scoring Configuration — Institution-level customization ─────────────────

export interface InstitutionProduct {
  id: string;
  name: string;
  active: boolean;
  minScore: number;
  maxScore?: number;
  minMontant: number;
  maxMontant: number;
  minDureeMois: number;
  maxDureeMois: number;
  tauxMensuel: number;
  description: string;
}

export interface InstitutionScoringConfig {
  institutionId: string;
  updatedAt: string;

  // 4C weights (should sum to 100)
  weights: {
    c1_capacite: number;
    c2_caractere: number;
    c3_collateral: number;
    c4_conditions: number;
  };

  products: InstitutionProduct[];

  c1Rules: {
    minRevenuEstime: number;
    maxRevenuEstime: number;
    surfaceWeight: number;
    rendementWeight: number;
    prixOfficielOverride: Record<string, number>;
  };

  c2Rules: {
    minExperienceAnnees: number;
    ancienneteWeight: number;
    activitesWeight: number;
    experienceWeight: number;
    creditHistoryBonus: number;
    blacklistEnabled: boolean;
  };

  c3Rules: {
    requirePhoto: boolean;
    requireCNI: boolean;
    requireAttestation: boolean;
    requireGPS: boolean;
    requireCoop: boolean;
    requirePolygone: boolean;
    pointsPhoto: number;
    pointsCNI: number;
    pointsAttestation: number;
    pointsGPS: number;
    pointsCoop: number;
    pointsPolygone: number;
  };

  c4Rules: {
    ndviMinimum: number;
    ndviWeight: number;
    filiereBonus: Record<string, number>;
    coopCertifieeBonus: number;
    alerteMalus: number;
    maxAlertesMalus: number;
  };

  creditConditions: {
    minScore: number;
    maxMontant: number;
    minMontant: number;
    maxDureeMois: number;
    minDureeMois: number;
    tauxBase: number;
    tauxAjustement: {
      score_300_499: number;
      score_500_699: number;
      score_700_plus: number;
    };
    garantieRequise: boolean;
    typeGarantie: string[];
    assuranceRequise: boolean;
    filieresAutorisees: string[];
  };

  riskProfile: {
    maxExposureCoop: number;
    maxExposureFarmer: number;
    concentrationAlert: number;
    diversificationMin: number;
  };
}

// ─── Default configuration ────────────────────────────────────────────────────

export const DEFAULT_PRODUCTS: InstitutionProduct[] = [
  {
    id: "REMUCI",
    name: "REMUCI",
    active: true,
    minScore: 300,
    minMontant: 50_000,
    maxMontant: 500_000,
    minDureeMois: 3,
    maxDureeMois: 12,
    tauxMensuel: 2.0,
    description: "Produit crédit de base pour petits agriculteurs",
  },
  {
    id: "BAOBAB_PROD",
    name: "Baobab Agri Prod",
    active: true,
    minScore: 400,
    minMontant: 100_000,
    maxMontant: 1_000_000,
    minDureeMois: 3,
    maxDureeMois: 18,
    tauxMensuel: 1.8,
    description: "Crédit production agricole",
  },
  {
    id: "BAOBAB_CAMP",
    name: "Baobab Agri Camp",
    active: true,
    minScore: 600,
    minMontant: 200_000,
    maxMontant: 3_000_000,
    minDureeMois: 6,
    maxDureeMois: 24,
    tauxMensuel: 1.6,
    description: "Crédit campagne agricole",
  },
  {
    id: "NSIA",
    name: "NSIA Pack Paysan",
    active: true,
    minScore: 700,
    minMontant: 500_000,
    maxMontant: 10_000_000,
    minDureeMois: 12,
    maxDureeMois: 36,
    tauxMensuel: 1.4,
    description: "Pack crédit premium pour grands exploitants",
  },
];

const DEFAULT_WEIGHTS = {
  c1_capacite: 30,
  c2_caractere: 25,
  c3_collateral: 25,
  c4_conditions: 20,
};

export const DEFAULT_CONFIG: Omit<InstitutionScoringConfig, "institutionId" | "updatedAt"> = {
  weights: { ...DEFAULT_WEIGHTS },

  products: DEFAULT_PRODUCTS,

  c1Rules: {
    minRevenuEstime: 500_000,
    maxRevenuEstime: 50_000_000,
    surfaceWeight: 50,
    rendementWeight: 50,
    prixOfficielOverride: {},
  },

  c2Rules: {
    minExperienceAnnees: 1,
    ancienneteWeight: 40,
    activitesWeight: 40,
    experienceWeight: 20,
    creditHistoryBonus: 50,
    blacklistEnabled: true,
  },

  c3Rules: {
    requirePhoto: false,
    requireCNI: true,
    requireAttestation: false,
    requireGPS: true,
    requireCoop: true,
    requirePolygone: false,
    pointsPhoto: 10,
    pointsCNI: 25,
    pointsAttestation: 30,
    pointsGPS: 10,
    pointsCoop: 15,
    pointsPolygone: 10,
  },

  c4Rules: {
    ndviMinimum: 0.3,
    ndviWeight: 30,
    filiereBonus: { Cacao: 20, Hévéa: 15, Anacarde: 10 },
    coopCertifieeBonus: 20,
    alerteMalus: 15,
    maxAlertesMalus: 3,
  },

  creditConditions: {
    minScore: 300,
    maxMontant: 10_000_000,
    minMontant: 50_000,
    maxDureeMois: 36,
    minDureeMois: 3,
    tauxBase: 2.0,
    tauxAjustement: {
      score_300_499: 0.4,
      score_500_699: 0.2,
      score_700_plus: 0,
    },
    garantieRequise: false,
    typeGarantie: [],
    assuranceRequise: false,
    filieresAutorisees: ["CACAO", "HEVEA", "ANACARDE", "MAIS", "RIZ", "MANIOC", "AUTRE"],
  },

  riskProfile: {
    maxExposureCoop: 30,
    maxExposureFarmer: 10,
    concentrationAlert: 20,
    diversificationMin: 3,
  },
};

// ─── Storage key helper ───────────────────────────────────────────────────────

function configKey(institutionId: string): string {
  return `wakama_scoring_config_${institutionId}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getActiveConfig(institutionId?: string | null): InstitutionScoringConfig {
  const id = institutionId ?? "default";
  try {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(configKey(id));
      if (stored) {
        return JSON.parse(stored) as InstitutionScoringConfig;
      }
    }
  } catch {
    // ignore
  }
  return {
    ...DEFAULT_CONFIG,
    // deep-copy nested objects
    weights: { ...DEFAULT_CONFIG.weights },
    products: DEFAULT_CONFIG.products.map((p) => ({ ...p })),
    c1Rules: { ...DEFAULT_CONFIG.c1Rules, prixOfficielOverride: {} },
    c2Rules: { ...DEFAULT_CONFIG.c2Rules },
    c3Rules: { ...DEFAULT_CONFIG.c3Rules },
    c4Rules: { ...DEFAULT_CONFIG.c4Rules, filiereBonus: { ...DEFAULT_CONFIG.c4Rules.filiereBonus } },
    creditConditions: {
      ...DEFAULT_CONFIG.creditConditions,
      tauxAjustement: { ...DEFAULT_CONFIG.creditConditions.tauxAjustement },
      typeGarantie: [...DEFAULT_CONFIG.creditConditions.typeGarantie],
      filieresAutorisees: [...DEFAULT_CONFIG.creditConditions.filieresAutorisees],
    },
    riskProfile: { ...DEFAULT_CONFIG.riskProfile },
    institutionId: id,
    updatedAt: new Date().toISOString(),
  };
}

export function saveConfigLocally(config: InstitutionScoringConfig): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(configKey(config.institutionId), JSON.stringify(config));
    }
  } catch {
    // ignore
  }
}

/**
 * Recalculates a farmer's final score using institution custom weights.
 * c1–c4 are raw component scores (0–250 each, as returned by the API).
 * Returns a score on the 0–1000 scale.
 */
export function applyCustomWeights(
  baseScore: { c1: number; c2: number; c3: number; c4: number },
  config: InstitutionScoringConfig
): number {
  const { c1_capacite, c2_caractere, c3_collateral, c4_conditions } = config.weights;
  const total = c1_capacite + c2_caractere + c3_collateral + c4_conditions;
  if (total === 0) return 0;
  // Normalize each component to [0-1], then apply weights
  const w1 = c1_capacite / total;
  const w2 = c2_caractere / total;
  const w3 = c3_collateral / total;
  const w4 = c4_conditions / total;
  const scaled =
    (baseScore.c1 / 250) * w1 +
    (baseScore.c2 / 250) * w2 +
    (baseScore.c3 / 250) * w3 +
    (baseScore.c4 / 250) * w4;
  return Math.round(scaled * 1000);
}

/**
 * Returns true if the weights are different from the default 30/25/25/20.
 * Used to decide whether to show "Score ajusté" indicator.
 */
export function hasCustomWeights(config: InstitutionScoringConfig): boolean {
  const w = config.weights;
  return (
    w.c1_capacite !== DEFAULT_WEIGHTS.c1_capacite ||
    w.c2_caractere !== DEFAULT_WEIGHTS.c2_caractere ||
    w.c3_collateral !== DEFAULT_WEIGHTS.c3_collateral ||
    w.c4_conditions !== DEFAULT_WEIGHTS.c4_conditions
  );
}
