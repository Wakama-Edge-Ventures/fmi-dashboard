# WAKAMA B2B DASHBOARDS — CAHIER DES CHARGES COMPLET
*Version 1.0 — Mars 2026 — Wakama Edge Ventures Inc.*

---

## TABLE DES MATIÈRES
1. Contexte & Vision
2. Architecture Globale
3. Design System Commun
4. Flux de données (Farmer ↔ B2B)
5. Dashboard MFI — fmi-dashboard
6. Dashboard Banque — bank-dashboard
7. Dashboard Assurance — assurance-dashboard
8. Spec-Kit (SPEC.md par repo)
9. Roadmap & Priorités

---

## 1. CONTEXTE & VISION

### 1.1 Problème résolu
En Côte d'Ivoire et en Afrique de l'Ouest, seulement 3% du financement bancaire va à l'agriculture malgré son poids économique (21% du PIB en CI). Raison principale : absence de données fiables sur les exploitations agricoles.

Wakama résout ce problème en collectant, certifiant et structurant les données agricoles de chaque farmer via :
- KYC documentaire (CNI, attestation foncière)
- GPS et polygone parcelle
- NDVI Sentinel-2 (santé des cultures)
- IoT capteurs terrain (température, humidité sol/air)
- Météo Open-Meteo par parcelle
- Historique d'activités déclarées

### 1.2 Proposition de valeur B2B
**Pour les MFIs :** Remplacer la visite terrain (15K-50K FCFA/dossier, 3 jours) par un score Wakama en 30 secondes.

**Pour les Banques :** Accéder à un portefeuille de coopératives pré-scorées avec données vérifiables pour les crédits de campagne (5M-300M FCFA).

**Pour les Assureurs :** Utiliser les indices NDVI + météo + IoT comme données d'assurance indicielle climatique.

### 1.3 Trois dashboards, trois métiers

| Dashboard | Repo | URL | Cible |
|-----------|------|-----|-------|
| MFI | fmi-dashboard | fmi.wakama.farm | Baobab, UNACOOPEC, REMUCI, Advans |
| Banque | bank-dashboard | bank.wakama.farm | NSIA, Ecobank, SIB, BNI |
| Assurance | assurance-dashboard | assurance.wakama.farm | Atlantique, AXA, Sanlam Allianz |

---

## 2. ARCHITECTURE GLOBALE

### 2.1 Stack technique (identique pour les 3 repos)
```
Framework   : Next.js 15 (App Router)
Language    : TypeScript strict
Styling     : Tailwind CSS uniquement (pas d'inline styles)
Charts      : Recharts
Maps        : Leaflet + react-leaflet
Icons       : Material Symbols (Google)
Auth        : JWT via localStorage
API         : https://api.wakama.farm (Fastify backend)
Déploiement : Coolify sur VPS 80.65.211.227
```

### 2.2 Structure de dossiers (identique)
```
src/
  app/
    [locale]/
      layout.tsx              ← minimal (juste locale + font)
      login/page.tsx          ← sans sidebar
      (protected)/
        layout.tsx            ← shell : sidebar + header
        dashboard/page.tsx
        farmers/
          page.tsx
          [id]/page.tsx
        cooperatives/
          page.tsx
          [id]/page.tsx
        analytics/page.tsx
        ndvi/page.tsx
        alerts/page.tsx
        reports/page.tsx
        settings/page.tsx
        [pages spécifiques au dashboard]
  components/
    layout/
      Sidebar.tsx
      Header.tsx
      Shell.tsx
    ui/
      ScoreGauge.tsx
      KPICard.tsx
      DataTable.tsx
      AlertBadge.tsx
      NDVIMap.tsx
      WeatherCard.tsx
    charts/
      ScoreHistoryChart.tsx
      RiskDistributionChart.tsx
      NDVITrendChart.tsx
  lib/
    api.ts                    ← client API wakama.farm
    auth.ts                   ← getToken, getUser, logout
    utils.ts                  ← formatters, helpers
    score.ts                  ← score color/label helpers
  types/
    index.ts                  ← types partagés
```

### 2.3 Routes API utilisées (api.wakama.farm)
```
FARMERS:
GET  /v1/farmers?page&limit&cooperativeId&region
GET  /v1/farmers/:id
PATCH /v1/farmers/:id

COOPERATIVES:
GET  /v1/cooperatives
GET  /v1/cooperatives/:id

PARCELLES:
GET  /v1/parcelles?farmerId=xxx

SCORES:
GET  /v1/scores/:farmerId → WakamaScoreResult (4C, 0-1000)
GET  /v1/scores/coop/:coopId → { avgScore, totalFarmers, eligible, farmers[] }

ALERTS:
GET  /v1/alerts?farmerId&coopId&unreadOnly
PATCH /v1/alerts/:id/read
PATCH /v1/alerts/read-all

NDVI:
GET  /v1/ndvi/:parcelleId → { ndvi, lastUpdated }
GET  /v1/ndvi/parcelle/:parcelleId/image → PNG

CREDIT REQUESTS:
GET  /v1/credit-requests?farmerId
POST /v1/credit-requests
PATCH /v1/credit-requests/:id → { statut }

WEATHER:
GET  /v1/weather/history/:parcelleId
GET  /v1/weather/history/farmer/:farmerId

IOT:
GET  /v1/iot/node?coopId=xxx
GET  /v1/iot/readings/:nodeId

AUTH:
POST /v1/auth/login → { token, role, email }
GET  /v1/auth/me
```

---

## 3. DESIGN SYSTEM COMMUN

### 3.1 Palette de couleurs
```css
/* Backgrounds */
--bg-primary:    #0a0f1a;   /* fond principal */
--bg-secondary:  #111827;   /* cartes */
--bg-tertiary:   #1f2937;   /* inputs, tableaux */
--bg-hover:      #263040;   /* survol */

/* Textes */
--text-primary:  #f9fafb;   /* titres */
--text-secondary:#9ca3af;   /* sous-titres */
--text-muted:    #6b7280;   /* labels */

/* Accents par dashboard */
/* MFI       → vert agricole  */ --accent: #10b981;
/* Banque    → bleu corporate */ --accent: #3b82f6;
/* Assurance → violet         */ --accent: #8b5cf6;

/* Scores */
--score-excellent: #10b981;  /* ≥ 700 */
--score-good:      #f59e0b;  /* 500-699 */
--score-medium:    #f97316;  /* 300-499 */
--score-low:       #ef4444;  /* < 300 */

/* Alertes */
--alert-critical: #ef4444;
--alert-warning:  #f59e0b;
--alert-info:     #3b82f6;
--alert-success:  #10b981;
```

### 3.2 Typographie
```
Font principale : Inter (Google Fonts)
Font mono : JetBrains Mono (scores, IDs, code)
Tailles :
  - Page title  : text-2xl font-bold
  - Section     : text-lg font-semibold
  - Label       : text-sm font-medium
  - Body        : text-sm
  - Micro       : text-xs
```

### 3.3 Composants UI réutilisables

#### KPICard
```
Props: { label, value, sub?, icon, trend?, color? }
Design: 
  - Fond bg-secondary, border border-gray-800
  - Icône Material Symbols en haut à droite
  - Valeur en text-3xl font-bold
  - Trend: flèche + % en vert/rouge
  - Responsive: grid 2cols mobile, 4cols desktop
```

#### ScoreGauge (SVG arc)
```
Props: { score, size?, showDetails? }
Design:
  - Arc SVG semi-circulaire 0-1000
  - Couleur selon niveau (excellent/good/medium/low)
  - Score en texte centré (JetBrains Mono)
  - Label en dessous ("EXCELLENT", "BON", "MOYEN", "FAIBLE")
  - Si showDetails: 4 barres C1/C2/C3/C4 en dessous
```

#### DataTable
```
Props: { columns, data, pagination?, filters? }
Design:
  - Headers: bg-gray-900, texte uppercase text-xs tracking-wider
  - Rows: hover:bg-gray-800/50, border-b border-gray-800
  - Pagination: style minimal avec counts
  - Tri: flèches sur colonnes
  - Export CSV: bouton en haut à droite
```

#### AlertBadge
```
Props: { severity: 'CRITICAL'|'WARNING'|'INFO', text }
Design:
  - CRITICAL: bg-red-500/10 text-red-400 border-red-800
  - WARNING:  bg-amber-500/10 text-amber-400 border-amber-800
  - INFO:     bg-blue-500/10 text-blue-400 border-blue-800
  - Point pulsant animé pour CRITICAL
```

### 3.4 Layout Shell
```
Sidebar : 240px desktop, collapsible, 64px icônes only mobile
Header  : 64px fixe en haut, titre page + actions + user
Content : calc(100vh - 64px), overflow-y-auto, padding 24px
```

### 3.5 Sidebar navigation (labels adaptés par dashboard)
```
MFI sidebar items:
  dashboard    → Tableau de bord
  farmers      → Agriculteurs
  cooperatives → Coopératives
  scoring      → Scoring & Risques  ← spécifique MFI
  credits      → Demandes de crédit ← spécifique MFI
  ndvi         → NDVI Satellite
  alerts       → Alertes
  analytics    → Analytique
  reports      → Rapports
  settings     → Paramètres

Bank sidebar items:
  dashboard    → Tableau de bord
  portfolio    → Portefeuille
  cooperatives → Coopératives
  campaigns    → Crédits de campagne ← spécifique Banque
  guarantees   → Garanties & Collatéral ← spécifique Banque
  ndvi         → NDVI Satellite
  alerts       → Alertes
  analytics    → Analytique
  reports      → Rapports
  settings     → Paramètres

Assurance sidebar items:
  dashboard    → Tableau de bord
  insured      → Assurés
  cooperatives → Coopératives
  climate      → Risque Climatique    ← spécifique Assurance
  indices      → Indices & Déclencheurs ← spécifique Assurance
  ndvi         → NDVI Satellite
  alerts       → Alertes
  analytics    → Analytique
  reports      → Rapports
  settings     → Paramètres
```

---

## 4. FLUX DE DONNÉES (FARMER ↔ B2B)

### 4.1 Ce que le Farmer produit (inputs B2B)
```
IDENTITÉ & KYC:
  → email, nom, prénom, téléphone, région, village
  → photo profil, CNI/Passeport, attestation foncière
  → GPS coordinates (lat/lng)
  → Membre coopérative

EXPLOITATION:
  → Parcelles (polygone GPS, surface, culture, stade)
  → NDVI Sentinel-2 par parcelle (mis à jour à la demande)
  → Historique parcelle (maladies, sécheresse, incendies)
  → IoT readings (temp, humidité sol/air via ESP32)

ACTIVITÉS:
  → Activités déclarées (irrigation, fertilisation, récolte...)
  → Demandes de crédit (montant, durée, objet)
  → Messages vers coopérative

DONNÉES AUTOMATIQUES (backend):
  → Météo Open-Meteo historique (stocké dans WeatherHistory)
  → Alertes automatiques (NDVI, sécheresse, pluies)
  → Wakama Score calculé (4C: Capacité, Caractère, Collatéral, Conditions)
```

### 4.2 Ce que le B2B consulte (outputs)
```
MFI:
  → Wakama Score 0-1000 + détail 4C
  → Éligibilité produits (REMUCI/Baobab/NSIA)
  → Montant suggéré min/max
  → Demandes de crédit avec statut
  → Alertes critiques par farmer
  → NDVI par parcelle
  → Documents KYC vérifiés

BANQUE:
  → Score portefeuille coop (avgScore, taux éligibilité)
  → Revenu estimé par coop (surface × rendement × prix)
  → Historique activités et comportement
  → Contrats acheteurs/exportateurs (si uploadés)
  → Certification coop (UTZ, Rainforest...)
  → Flux de collecte historique

ASSURANCE:
  → NDVI historique par parcelle (tendance)
  → Données météo historiques (WeatherHistory)
  → Alertes climatiques (sécheresse, pluies excessives)
  → IoT données sol en temps réel
  → Surface assurable par culture
  → Indice de risque climatique régional
```

### 4.3 Ce que le B2B envoie vers le Farmer (actions)
```
MFI:
  PATCH /v1/credit-requests/:id → { statut: 'APPROVED'|'REJECTED' }
  → Farmer voit sur /financement: "Crédit approuvé ✅"

BANQUE:
  PATCH /v1/credit-requests/:id → { statut, montantAccorde, tauxApplique }
  → Notification email au farmer

ASSURANCE:
  POST /v1/insurance-contracts → nouveau contrat
  → Farmer voit sa police d'assurance sur /financement
```

---

## 5. DASHBOARD MFI — fmi-dashboard

**URL** : fmi.wakama.farm  
**Couleur accent** : #10b981 (vert)  
**Utilisateurs** : Baobab CI, UNACOOPEC-CI, REMUCI, Advans CI, Crédit Access

### 5.1 Page Login (/login)
```
Design:
  - Split screen 50/50 : gauche branding Wakama, droite formulaire
  - Gauche: logo Wakama + tagline "Analysez votre portefeuille agricole"
    + 3 stats clés (farmers scorés, score moyen, taux éligibilité)
  - Droite: formulaire email/password + "Connexion Partenaire MFI"
  - Footer: "Powered by Wakama Score™"

Fonctionnel:
  - POST /v1/auth/login → token JWT
  - Stockage: localStorage wakama_fmi_token
  - Redirect → /dashboard
  - Remember me (30 jours)
```

### 5.2 Page Dashboard (/dashboard)
```
KPIs (ligne 1 — 4 cartes):
  1. Farmers dans le système     → GET /v1/farmers (total)
  2. Score Wakama moyen          → moyenne des scores fetched
  3. Éligibles crédit (≥300)     → count score ≥ 300
  4. Demandes en attente         → GET /v1/credit-requests (PENDING count)

KPIs (ligne 2 — 4 cartes spécifiques MFI):
  5. Éligibles REMUCI (≥300)
  6. Éligibles Baobab Prod (≥400)
  7. Éligibles Baobab Camp (≥600)
  8. Éligibles NSIA (≥700)

Graphique principal: Score Evolution (12 mois)
  - LineChart Recharts
  - X: mois, Y: score moyen portefeuille
  - Pour l'instant: calculé depuis les scores actuels (baseline)

Distribution des risques: DonutChart
  - Faible (≥600): vert
  - Moyen (≥400): orange
  - Élevé (<400): rouge
  - Total farmers au centre

Carte des coopératives: Leaflet
  - Markers colorés par score moyen coop
  - Popup: nom coop, nb farmers, score moyen
  - Zoom sur CI par défaut

Demandes de crédit récentes: Table (5 dernières)
  Colonnes: Farmer, Montant, Durée, Objet, Wakama Score, Statut
  Actions: Approuver ✅ | Rejeter ❌ | Voir détail 👁️

Alertes critiques: Liste (5 dernières)
  - Icône rouge animé pour CRITICAL
  - Lien vers page alertes
```

### 5.3 Page Agriculteurs (/farmers)
```
Filtres:
  - Recherche (nom, ID)
  - Score minimum: Tous | ≥300 REMUCI | ≥400 Baobab | ≥600 Camp | ≥700 NSIA
  - Coopérative (select depuis API)
  - Région (select)
  - Culture principale (select)
  - KYC: Tous | Validé | En attente

Table:
  Colonnes:
    - Farmer (avatar initiales + nom + ID tronqué)
    - Région / Village
    - Coopérative
    - Score Wakama (badge coloré 0-1000 + mini gauge)
    - Revenu estimé (FCFA)
    - Éligibilité (4 icônes: REMUCI / Baobab Prod / Baobab Camp / NSIA)
    - KYC (badge: Validé vert / En attente orange)
    - Dernière activité (date relative)
    - Actions (👁️ Voir | 📄 Rapport)

Vue carte: FarmersMap Leaflet
  - Markers colorés par score
  - Cluster au zoom out
  - Popup: nom, score, culture, éligibilité

Export: CSV avec tous les champs
Pagination: 10/25/50 par page
```

### 5.4 Page Farmer Détail (/farmers/[id])
```
Section 1 — Header sticky:
  - Breadcrumb: Agriculteurs > Nom
  - Actions: Télécharger rapport PDF | Approuver crédit | Rejeter

Section 2 — Profil + Score (2 colonnes):
  Gauche — Profil:
    - Photo + nom + ID + badge KYC
    - Informations: région, village, téléphone, email
    - Coopérative liée (avec lien)
    - Ancienneté sur la plateforme
    - Documents: CNI ✅/❌ | Attestation ✅/❌ | Photo ✅/❌
    - GPS: ✅ avec coordonnées
    
  Droite — Wakama Score:
    - Gauge SVG grand format (0-1000)
    - Score en gras + label (EXCELLENT/BON/MOYEN/FAIBLE)
    - 4 barres de progression C1/C2/C3/C4:
      C1 Capacité  30% → XX/100
      C2 Caractère 25% → XX/100
      C3 Collatéral 25% → XX/100
      C4 Conditions 20% → XX/100
    - Montant suggéré: XX FCFA → XX FCFA
    - Produit recommandé: "Baobab Agri Production"
    - Éligibilité: 4 badges produits MFI

Section 3 — Revenu Estimé (carte dédiée):
  - Revenu annuel estimé: XXX FCFA (calcul C1)
  - Surface totale: XX ha
  - Cultures: liste avec prix officiels CI
  - Capacité remboursement: XX FCFA (35% du revenu)

Section 4 — Parcelles:
  Table: Nom | Culture | Surface (ha) | NDVI | Stade | Statut
  Carte Leaflet: polygones des parcelles + overlay NDVI

Section 5 — Historique activités:
  Timeline: date + type + description + statut
  Filtre: Toutes / Irrigation / Fertilisation / Récolte / Autre

Section 6 — Demandes de crédit:
  Table: Montant | Durée | Objet | Date | Statut
  Actions: Approuver | Rejeter | Demander info complémentaire
  Modal approuvation: montant accordé + taux appliqué + conditions

Section 7 — Alertes farmer:
  Liste chronologique: type + sévérité + message + date
  Filtres: NDVI | Météo | IoT | Toutes

Section 8 — Météo parcelle principale:
  Résumé météo actuel + prévisions 5 jours
  (depuis WeatherHistory en DB + Open-Meteo si récent)
```

### 5.5 Page Scoring & Risques (/scoring) — SPÉCIFIQUE MFI
```
Vue portefeuille scoring:

Section 1 — Distribution globale:
  - DonutChart: Faible / Moyen / Élevé / Très élevé
  - KPIs: nb par catégorie + % total

Section 2 — Score par filière:
  BarChart horizontal:
    Cacao XX/1000 | Anacarde XX/1000 | Maïs XX/1000...
  Contexte: prix marché officiel CI par culture

Section 3 — Score par région:
  Table + carte choroplèthe (Leaflet)
  Colonnes: Région | Nb farmers | Score moyen | % Éligibles

Section 4 — Ajustement de formule (INNOVATION):
  Interface de customisation du scoring pour la MFI:
  
  Sliders de pondération (total = 100%):
    C1 Capacité:  [slider] XX%  (défaut 30%)
    C2 Caractère: [slider] XX%  (défaut 25%)
    C3 Collatéral:[slider] XX%  (défaut 25%)
    C4 Conditions:[slider] XX%  (défaut 20%)
  
  Seuils personnalisés:
    Score minimum acceptable: [input] (défaut 300)
    Taux d'endettement max:   [input] % (défaut 35%)
    Ancienneté minimum:       [select] (défaut 1 an)
  
  Prévisualisation en temps réel:
    "Avec ces paramètres: XX farmers éligibles (XX%)"
    "Montant moyen suggéré: XX FCFA"
  
  Bouton: "Appliquer mes critères" → sauvegardé en DB
  Bouton: "Réinitialiser aux critères Wakama"

Section 5 — Historique des décisions:
  Table: Date | Farmer | Score | Décision | Montant | Résultat
  Métriques: taux approbation, montant moyen, taux remboursement (à terme)
```

### 5.6 Page Demandes de Crédit (/credits) — SPÉCIFIQUE MFI
```
Tabs: En attente (XX) | Approuvées | Rejetées | Toutes

Table complète:
  Colonnes:
    - Farmer (lien vers profil)
    - Coopérative
    - Montant demandé (FCFA)
    - Durée (mois)
    - Objet
    - Wakama Score (badge)
    - Éligibilité produit suggéré
    - Montant suggéré Wakama
    - Date demande
    - Statut (badge)
    - Actions

Actions par ligne:
  PENDING:
    ✅ Approuver → Modal: montant accordé + taux + durée + conditions
    ❌ Rejeter → Modal: motif du rejet
    📋 Demander docs → Modal: liste des documents manquants
    👁️ Voir profil complet

  APPROVED:
    📄 Générer contrat PDF
    ✉️ Notifier farmer

Bulk actions:
  - Approuver sélection
  - Exporter CSV

Filtres:
  - Score minimum
  - Montant min/max
  - Culture
  - Région
  - Date

KPIs en haut:
  - Total en attente + montant total
  - Montant moyen demandé
  - Score moyen des demandeurs
  - Taux d'éligibilité Wakama
```

### 5.7 Pages communes (MFI)
```
/cooperatives       → liste coops avec score moyen, nb membres, surface
/cooperatives/[id]  → détail coop: profil, farmers list, score portfolio
/ndvi               → carte NDVI toutes parcelles
/alerts             → alertes réelles (NDVI + météo + IoT)
/analytics          → données réelles connectées API
/reports            → génération rapports PDF
/settings           → profil MFI, API keys, ajustement scoring
```

---

## 6. DASHBOARD BANQUE — bank-dashboard

**URL** : bank.wakama.farm  
**Couleur accent** : #3b82f6 (bleu)  
**Utilisateurs** : NSIA Banque, Ecobank CI, SIB, BNI, SGCI

### 6.1 Différences clés vs MFI
```
Les banques ciblent:
  - Coopératives structurées (pas farmers individuels)
  - Gros tickets (5M → 300M FCFA)
  - Crédits de campagne 3-12 mois
  - Analyse bilancielle + contrats acheteurs
  - Certification UTZ/Rainforest comme critère

Metrics additionnelles pour banques:
  - Chiffre d'affaires coop estimé (surface × rendement × prix)
  - Volume de collecte historique
  - Contrats exportateurs (si uploadés)
  - Certification coop
  - Ancienneté ≥ 2 ans (critère Baobab)
  - Gouvernance (PV AG, organigramme)
```

### 6.2 Page Dashboard (/dashboard)
```
KPIs ligne 1:
  1. Coopératives dans le système
  2. Score moyen coopératives
  3. Éligibles crédit bancaire (score ≥ 600)
  4. Volume total finançable (somme revenus estimés × 30%)

KPIs ligne 2 (spécifiques banque):
  5. Coops certifiées (UTZ/Rainforest/Fairtrade)
  6. Coops avec contrats acheteurs
  7. Volume campagne cacao (surface × 1800 FCFA/kg × 500 kg/ha)
  8. Volume campagne anacarde (surface × 315 FCFA/kg × 800 kg/ha)

Graphique: Revenus estimés par filière (BarChart)
  Cacao | Anacarde | Hévéa | Maïs | Autre

Carte: Localisation coops (Leaflet)
  - Markers colorés par score
  - Taille marker = surface totale

Table: Top 10 coops par score + volume finançable
```

### 6.3 Page Portefeuille Coopératives (/portfolio)
```
Vue coopératives — TABLE:
  Colonnes:
    - Coop (logo + nom + ID)
    - Région
    - Filière principale
    - Nb membres actifs
    - Surface totale (ha)
    - Revenu estimé annuel (FCFA)
    - Score Wakama Coop (0-1000)
    - Certification (badge: UTZ/Rainforest/Aucune)
    - Contrats acheteurs (✅/❌)
    - Ancienneté (années)
    - Éligibilité bancaire (badge)
    - Actions

Filtres:
  - Score minimum
  - Filière
  - Région
  - Certification
  - Ancienneté ≥ 2 ans (toggle)
  - Avec contrats acheteurs (toggle)

Vue carte: Leaflet avec markers coops
```

### 6.4 Page Détail Coopérative (/cooperatives/[id])
```
Section 1 — Header:
  Logo coop + nom + région + filière + badge éligibilité

Section 2 — Score & Bankabilité (2 colonnes):
  Gauche — Check-list bankabilité:
    ✅/❌ Statut légal (OHADA immatriculée)
    ✅/❌ Ancienneté ≥ 2 ans
    ✅/❌ Comptabilité soumise
    ✅/❌ Contrats acheteurs
    ✅/❌ Certification (UTZ/Rainforest)
    ✅/❌ Gouvernance (PV AG uploadé)
    ✅/❌ Membres actifs ≥ 10
    
  Droite — Score Wakama Coop:
    Score moyen des farmers de la coop
    Distribution: XX éligibles bancaires
    Volume finançable estimé: XX FCFA
    Produit suggéré: "Agri Campagne Baobab" ou "Ligne bancaire NSIA"

Section 3 — Capacité financière:
  Tableau filières:
    Culture | Surface (ha) | Rendement (kg/ha) | Prix (FCFA/kg) | Revenu estimé
  Total revenu annuel estimé: XX FCFA
  Montant max crédit campagne: XX FCFA (30% du revenu)
  Durée suggérée: 3-8 mois (cycle de campagne)

Section 4 — Farmers membres:
  Table: Nom | Score | Surface | Culture | KYC | Éligibilité
  Tri par score décroissant
  
Section 5 — IoT & Terrain:
  Si nœud IoT présent: données live
  Carte: parcelles membres avec NDVI overlay

Section 6 — Documents:
  CNI Président | Statuts | RCCM | Extrait topo | RIB
  (uploadés lors de l'inscription coop)
```

### 6.5 Page Crédits de Campagne (/campaigns) — SPÉCIFIQUE BANQUE
```
Workflow de financement de campagne:

Vue pipeline (Kanban):
  Colonne 1: Dossiers reçus
  Colonne 2: En analyse
  Colonne 3: En comité de crédit
  Colonne 4: Approuvés
  Colonne 5: Décaissés
  Colonne 6: En remboursement
  Colonne 7: Clôturés

Chaque carte dossier:
  - Nom coop + filière
  - Montant demandé
  - Score Wakama
  - Volume finançable estimé
  - Date dépôt

Actions par colonne:
  Dossiers reçus → "Instruire le dossier"
  En analyse → "Passer en comité"
  En comité → "Approuver" / "Rejeter" / "Conditions"
  Approuvés → "Décaisser" + montant réel + taux + conditions
  En remboursement → "Enregistrer paiement"

Vue tableau classique: toggle

Metrics:
  - Volume total pipeline
  - Montant moyen par dossier
  - Délai moyen instruction (jours)
  - Taux d'approbation
```

### 6.6 Page Garanties & Collatéral (/guarantees) — SPÉCIFIQUE BANQUE
```
Vue par type de garantie:
  - Attestations foncières (depuis farmer profils)
  - Nantissements récolte (déclarés par la banque)
  - Cautions solidaires (membres de coop)
  - Stocks warrantés (à venir)

Table:
  Farmer/Coop | Type garantie | Valeur estimée | Crédit lié | Statut

Carte de couverture:
  Leaflet avec parcelles garanties colorées par statut

KPIs:
  - Valeur totale garanties
  - Taux de couverture portefeuille
  - Garanties expirantes (30j)
```

### 6.7 Pages communes (Banque)
```
/farmers    → Farmers individuels (vue simplifiée)
/ndvi       → NDVI parcelles coops
/alerts     → Alertes terrain
/analytics  → Analytics portefeuille bancaire
/reports    → Rapports pour comité de crédit
/settings   → Profil banque, critères, API keys
```

---

## 7. DASHBOARD ASSURANCE — assurance-dashboard

**URL** : assurance.wakama.farm  
**Couleur accent** : #8b5cf6 (violet)  
**Utilisateurs** : Atlantique Assurances, AXA CI, Sanlam Allianz CI

### 7.1 Contexte assurance agricole CI
```
Mécanismes existants:
  - Assurance indicielle climatique (SFI + partenaires)
  - Mécanisme BOAD assurance récolte indicielle (12 Mds FCFA)
  - Indemnisation via mobile money (Wave/Orange Money)
  
Comment ça marche:
  - Pas de sinistre individuel → indice climatique déclenche
  - Si NDVI < seuil → indemnisation automatique
  - Si précipitations < seuil → indemnisation
  - Si température > seuil → indemnisation
  
Wakama apporte:
  - NDVI par parcelle (Sentinel-2, 10m résolution)
  - Météo historique par parcelle (Open-Meteo)
  - IoT données sol en temps réel
  - Surface assurable certifiée (polygone GPS)
  - Culture déclarée et vérifiée
```

### 7.2 Page Dashboard (/dashboard)
```
KPIs ligne 1:
  1. Assurés actifs (farmers avec contrat)
  2. Surface assurée totale (ha)
  3. Valeur assurée (surface × rendement × prix)
  4. Prime collectée (à terme)

KPIs ligne 2 (spécifiques assurance):
  5. Zones à risque climatique élevé
  6. Alertes sécheresse actives
  7. NDVI critique (< 0.2) — parcelles en danger
  8. Décaissements indemnisation en cours

Graphique 1: Indice de risque climatique (12 mois)
  - LineChart: NDVI moyen régional
  - Zones rouges: périodes critiques

Graphique 2: Répartition risque par zone géographique
  - Carte choroplèthe CI
  - Couleur = niveau de risque (vert → rouge)

Table: Parcelles à surveiller (NDVI < 0.3)
  Farmer | Culture | Surface | NDVI | Alerte | Action
```

### 7.3 Page Assurés (/insured)
```
Table farmers assurables/assurés:
  Colonnes:
    - Farmer (nom + ID)
    - Culture
    - Surface assurable (ha)
    - Valeur assurable (FCFA)
    - NDVI actuel
    - Risque climatique (score 0-100)
    - Statut contrat (Assuré/Non assuré/Éligible)
    - Prime annuelle suggérée
    - Actions

Prime annuelle calculée:
  Prime = (Surface × Rendement × Prix) × Taux_prime
  Taux_prime selon risque:
    Risque faible (NDVI ≥ 0.5) : 2-3%
    Risque moyen (NDVI 0.3-0.5) : 4-5%
    Risque élevé (NDVI < 0.3)  : 6-8%

Filtres:
  - Culture
  - Région
  - Niveau NDVI
  - Statut contrat
  - Niveau de risque
```

### 7.4 Page Risque Climatique (/climate) — SPÉCIFIQUE ASSURANCE
```
Section 1 — Carte de risque temps réel:
  Leaflet avec overlay couleur par zone
  Données: NDVI moyen + alertes météo actives
  Légende: Très faible / Faible / Modéré / Élevé / Critique
  Toggle: Vue NDVI | Vue météo | Vue IoT | Vue combinée

Section 2 — Monitoring NDVI:
  Tableau toutes parcelles:
    Parcelle | Farmer | Culture | Surface | NDVI actuel | Tendance | Alertes
  NDVI coloré: ≥0.5 vert | 0.3-0.5 orange | <0.3 rouge | <0.2 rouge pulsant
  
  Graphique tendance NDVI 6 mois (depuis WeatherHistory):
    LineChart avec seuils d'alerte
    Zones colorées: normale / surveillance / critique

Section 3 — Alertes climatiques actives:
  Filtres: Sécheresse | Inondation | NDVI critique | Stress thermique
  Table: Zone | Type | Farmers touchés | Surface | Depuis quand | Statut

Section 4 — Prévisions météo:
  Par région: prévisions 7 jours Open-Meteo
  Alertes: pluies > 20mm | temp > 38°C | sécheresse probable

Section 5 — Corrélation NDVI / Météo:
  ScatterChart: NDVI vs précipitations
  Identification des zones vulnérables
```

### 7.5 Page Indices & Déclencheurs (/indices) — SPÉCIFIQUE ASSURANCE
```
Section 1 — Paramétrage des indices:
  (Interface de configuration pour l'assureur)
  
  Produit 1 — Assurance NDVI:
    Seuil déclenchement: NDVI < [input] (défaut 0.2)
    Période observation: [select] (défaut 30 jours)
    Zone géographique: [select région]
    Culture couverte: [multi-select]
    Indemnité: XX% de la valeur assurée
  
  Produit 2 — Assurance sécheresse:
    Précipitations < [input] mm sur [input] jours
    Données source: Open-Meteo (WeatherHistory)
    Région: [select]
    Indemnité: XX FCFA/ha
  
  Produit 3 — Assurance température:
    Température > [input] °C pendant [input] jours consécutifs
    Sol temp > [input] °C (depuis IoT si disponible)
    Indemnité: XX% selon durée
  
  Bouton: "Simuler sur données historiques"
  → Montre combien d'événements auraient déclenché sur les 12 derniers mois

Section 2 — Historique des déclenchements:
  Timeline: Date | Région | Type | Farmers touchés | Surface | Indemnité versée

Section 3 — Back-testing:
  Sélectionner période historique
  Simuler avec paramètres actuels
  Résultat: nb déclenchements + indemnités théoriques
  Export CSV pour actuaires
```

### 7.6 Page Détail Farmer Assuré (/insured/[id])
```
Section 1 — Profil + Contrat:
  Gauche: profil farmer (standard)
  Droite: contrat d'assurance
    - Numéro contrat
    - Type: NDVI / Sécheresse / Combiné
    - Période: du XX au XX
    - Surface couverte: XX ha
    - Culture: XX
    - Valeur assurée: XX FCFA
    - Prime: XX FCFA/an
    - Statut: Actif / Suspendu / Échu

Section 2 — Monitoring NDVI parcelles:
  Carte Leaflet avec overlay NDVI coloré
  Table: Parcelle | NDVI actuel | Min 30j | Tendance | Statut déclencheur

Section 3 — Météo historique:
  Graphiques: précipitations 12 mois | température | ET0
  Depuis WeatherHistory en DB

Section 4 — IoT données (si nœud disponible):
  Humidité sol | Temp sol | Humidité air
  30 derniers jours en LineChart

Section 5 — Événements d'indemnisation:
  Timeline: Date | Type déclencheur | Valeur index | Indemnité | Statut paiement
```

### 7.7 Pages communes (Assurance)
```
/cooperatives → coops (vue assurance: surface, culture, risque)
/ndvi         → carte NDVI globale
/alerts       → alertes climatiques et NDVI
/analytics    → analytics assurance (sinistralité, zones risque)
/reports      → rapports techniques pour actuaires
/settings     → paramètres assureur, produits, API keys
```

---

## 8. PAGES COMMUNES AUX 3 DASHBOARDS

### 8.1 Page NDVI (/ndvi)
```
Layout: 2 colonnes (carte 60% | panel 40%)

Carte Leaflet:
  - Tuiles satellite (ArcGIS ou Mapbox)
  - Markers pour chaque parcelle avec NDVI coloré
  - Clic sur parcelle → affiche détail dans panel droite
  - Toggle: Vue marqueurs | Vue overlay NDVI
  - Barre de recherche: chercher farmer ou parcelle
  - Légende NDVI: 0.0 → 1.0 gradient couleur

Panel droite:
  - Liste parcelles (scrollable)
  - Badge NDVI coloré par parcelle
  - Filtre par: NDVI minimum | culture | région
  
Parcelle sélectionnée:
  - Nom + farmer + culture + surface
  - NDVI actuel + date mise à jour
  - Graphique NDVI 12 mois (LineChart depuis WeatherHistory)
  - Image satellite PNG (depuis /v1/ndvi/parcelle/:id/image)
  - Bouton "Actualiser NDVI" → appel API Sentinel-2
  - Recommandation IA basée sur NDVI

Export: CSV toutes parcelles + NDVI
```

### 8.2 Page Alertes (/alerts)
```
Header:
  - Compteur alertes critiques (badge rouge pulsant)
  - Filtres tabs: Toutes | Critiques | NDVI | Météo | IoT | Score

Table:
  Colonnes: Sévérité | Titre | Entité | Type | Date | Lu | Actions
  
  Sévérité colorée:
    CRITICAL: rouge + icône pulsante
    WARNING: orange
    INFO: bleu
    
  Actions:
    Accuser réception → PATCH /v1/alerts/:id/read
    Voir farmer →  lien profil
    
  Bulk: "Tout marquer comme lu"

Filtres avancés:
  - Type: NDVI | METEO | IOT | SYSTEM
  - Sévérité: CRITICAL | WARNING | INFO
  - Période: Aujourd'hui | 7j | 30j
  - Région
  - Culture

Paramètres alertes (sidebar):
  Seuils personnalisables:
    - NDVI critique: < [input]
    - Variation score: > [input] %
    - Précipitations: > [input] mm
  Webhook URL pour intégration externe
```

### 8.3 Page Analytics (/analytics)
```
Tabs: Performance | Risque | Géographique | Temporel

TAB PERFORMANCE:
  KPIs: Score moyen | Nb éligibles | Taux KYC | Surface totale
  Graphique: Score par filière (BarChart horizontal)
  Top 5 coops (par score ou volume)
  Distribution risque (PieChart)

TAB RISQUE:
  Distribution scores (HistogramChart)
  Risque par région (BarChart)
  Évolution risque 12 mois (LineChart)
  Farmers à surveiller (table: score < 300)

TAB GÉOGRAPHIQUE:
  Carte choroplèthe CI (Leaflet)
  Table régions: Région | Nb farmers | Score moyen | Surface | Éligibles %
  
TAB TEMPOREL:
  Score moyen 24 mois (LineChart)
  Inscriptions par mois (BarChart)
  NDVI moyen par mois (AreaChart)

Export PDF: générateur de rapport

IMPORTANT: Toutes les données depuis API réelle (pas de mock)
```

### 8.4 Page Rapports (/reports)
```
Tabs: Générés | Planifiés | Modèles

Générés:
  Table: ID | Nom | Type | Taille | Date | Statut | Actions (download/share)
  Bouton "Générer rapport" → Modal:
    Type: Portefeuille | Scoring | NDVI | Risque | Crédit
    Période: Ce mois | Trimestre | Année | Personnalisé
    Format: PDF | Excel | CSV
    → Génération réelle (à connecter)

Planifiés:
  Cards: Nom | Fréquence | Prochaine exécution | Active toggle

Modèles:
  6 templates: Farmer | Coop | NDVI | Risque | IoT | Crédit
  Bouton "Générer" par template
```

### 8.5 Page Settings (/settings)
```
Tabs: Compte | API Keys | Notifications | Scoring

Compte:
  - Profil réel (depuis /v1/auth/me)
  - Nom, email, organisation, rôle
  - Modifier profil

API Keys:
  - Clés API générées par Wakama
  - Afficher/masquer clé
  - Copier avec feedback
  - Usage: appels aujourd'hui / ce mois
  - Exemple curl avec vraie clé

Notifications:
  - Toggles fonctionnels (sauvegardés)
  - Alertes critiques, variation score, nouveau farmer

Scoring (MFI uniquement):
  - Pondération personnalisée C1/C2/C3/C4
  - Seuils d'éligibilité
  - Sauvegardé en DB
```

---

## 9. SPEC-KIT — FICHIERS PAR REPO

### 9.1 fmi-dashboard/SPEC.md
```markdown
# FMI Dashboard — Spec
Repo: Wakama-Edge-Ventures/fmi-dashboard
URL: fmi.wakama.farm
Accent: #10b981 (vert)
Users: Baobab CI, UNACOOPEC, REMUCI, Advans CI

Pages spécifiques:
- /scoring → Distribution risques + ajustement formule
- /credits → Pipeline demandes de crédit

Métriques clés:
- Wakama Score 0-1000
- Éligibilité: REMUCI≥300, BaobabProd≥400, BaobabCamp≥600, NSIA≥700
- Montant suggéré: basé sur revenu estimé × 35% × score/1000
- Taux référence: 1.25-1.60%/mois

Innovation: Interface ajustement pondération C1/C2/C3/C4
```

### 9.2 bank-dashboard/SPEC.md
```markdown
# Bank Dashboard — Spec
Repo: Wakama-Edge-Ventures/bank-dashboard
URL: bank.wakama.farm
Accent: #3b82f6 (bleu)
Users: NSIA Banque, Ecobank CI, SIB, BNI

Pages spécifiques:
- /portfolio → Vue coopératives bankables
- /campaigns → Pipeline crédits de campagne (Kanban)
- /guarantees → Garanties & collatéral

Métriques clés:
- Score coop (average des farmers membres)
- Revenu annuel estimé coop
- Certification (UTZ/Rainforest/Fairtrade)
- Contrats acheteurs (oui/non)
- Ancienneté ≥ 2 ans
- Montants: 5M → 300M FCFA
- Durée: 3-8 mois (crédit campagne)

Innovation: Kanban pipeline de financement de campagne
```

### 9.3 assurance-dashboard/SPEC.md
```markdown
# Assurance Dashboard — Spec
Repo: Wakama-Edge-Ventures/assurance-dashboard
URL: assurance.wakama.farm
Accent: #8b5cf6 (violet)
Users: Atlantique Assurances, AXA CI, Sanlam Allianz

Pages spécifiques:
- /climate → Carte risque climatique temps réel
- /indices → Paramétrage indices & déclencheurs

Métriques clés:
- NDVI par parcelle (Sentinel-2)
- Météo historique (WeatherHistory DB)
- IoT sol/air (esp32 readings)
- Surface assurable certifiée (polygone GPS)
- Indice de risque climatique 0-100

Produits assurance:
- Assurance NDVI: déclenche si NDVI < seuil
- Assurance sécheresse: précipitations < seuil
- Assurance température: temp > seuil N jours

Innovation: Back-testing indices sur données historiques Wakama
```

---

## 10. ROADMAP & PRIORITÉS

### Phase 1 — MFI Dashboard (fmi-dashboard) — 2 semaines
```
Semaine 1:
  □ Setup repo + design system Tailwind
  □ Layout shell (sidebar + header) responsive
  □ Login page → API réelle
  □ Dashboard page → KPIs réels
  □ Farmers list → scores + éligibilité

Semaine 2:
  □ Farmer detail → score 4C complet
  □ Page Scoring & Risques (ajustement formule)
  □ Page Demandes de crédit (pipeline)
  □ Alertes réelles
  □ Analytics réelles
  □ Deploy fmi.wakama.farm
```

### Phase 2 — Bank Dashboard — 1 semaine
```
  □ Fork + adapter fmi-dashboard
  □ Vue coopératives bankables
  □ Pipeline crédits campagne (Kanban)
  □ Page Garanties
  □ Deploy bank.wakama.farm
```

### Phase 3 — Assurance Dashboard — 1 semaine
```
  □ Fork + adapter design
  □ Carte risque climatique
  □ Page indices & déclencheurs
  □ Intégration WeatherHistory
  □ Deploy assurance.wakama.farm
```

### Phase 4 — Enrichissements communs
```
  □ Génération rapports PDF réels
  □ Système API Keys fonctionnel
  □ Webhook alertes
  □ Back-testing (assurance)
  □ Score historique (timeline)
```

---

## 11. DONNÉES DE TEST DISPONIBLES

```
FARMERS RÉELS EN DB:
  - Hyacenthé yanzi (cmn1tmb...) → Score 765, Bouaké, 4 parcelles
  - jebbar marouane (cmn3pa2...) → Score 458, Fès
  - 46 farmers ETRA (Vallée du Bandama, Cacao/Manioc)

COOPS:
  - coop-etra-001 → ETRA, Bouaké, Cacao, 46 membres
  - coop-1774206981363 → Sahara Trace, Abidjan

IOT:
  - esp32-ETRA-001 → 32+ lectures, Bouaké

NDVI RÉEL:
  - Parcelle cmn2nf3ec... → NDVI 0.258 (Modéré)
  
COMPTES TEST:
  - test5@etra.ci / Digipixel@21121983
  - jebbarceo@gmail.com
  - newcoop2@etra.ci
```

---

*Wakama Edge Ventures Inc. — Wyoming, USA*  
*Pour plus d'informations: contact@wakama.farm*
