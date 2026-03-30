# WAKAMA PLATFORM — COMPTE RENDU SESSION
*30 Mars 2026 — À lire entièrement avant de continuer*

---

## 1. CONTEXTE GÉNÉRAL

**Projet** : Wakama Edge Ventures Inc. (Wyoming, EIN 37-2173391)
**CEO** : Marouane Jebbar, Abidjan, Côte d'Ivoire
**Vision** : Premier bureau de crédit agricole certifié blockchain d'Afrique de l'Ouest

**Infrastructure** :
- VPS : 80.65.211.227, SSH port 2222 (clé SSH, pas de password)
- Déploiement : Coolify → http://80.65.211.227:8000
- DB : PostgreSQL container `wakama-postgres`, port 5432, DB: wakama_db, user: wakama, pass: wakama2024

---

## 2. REPOS GITHUB (Wakama-Edge-Ventures)

| Repo | URL déployée | Coolify ID | WSL Path | Status |
|------|-------------|---------|----------|--------|
| wakama-farmer-webapp | farmer.wakama.farm | ugw04ogc8g4ks0g0c8oos4os | ~/dev/wakama-farmer-webapp | ✅ PROD |
| wakama-backend | api.wakama.farm | y400g4oggggc48kks0wog48c | ~/dev/wakama-backend | ✅ PROD |
| wakama-b2b-dashboard | oracle.wakama.farm | wakama-oracle-dashboard | ~/dev/wakama-b2b-dashboard | ✅ PROD (ancien) |
| fmi-dashboard | fmi.wakama.farm | (créé cette session) | ~/dev/fmi-dashboard | ✅ PROD |
| bank-dashboard | bank.wakama.farm | À créer | ~/dev/bank-dashboard | ⏳ VIDE |
| assurance-dashboard | assurance.wakama.farm | À créer | ~/dev/assurance-dashboard | ⏳ VIDE |

---

## 3. CE QU'ON A FAIT CETTE SESSION

### 3.1 fmi-dashboard — DÉPLOYÉ ✅ fmi.wakama.farm

**Stack** : Next.js 15, TypeScript, Tailwind CSS, Recharts, Leaflet
**Accent** : #10b981 (vert)
**Design system** : Solscan + Realms DAO inspired

**Pages complétées** :
- ✅ /login : sélection institution + stockage localStorage
- ✅ /dashboard : KPIs réels, charts, PlatformMap, demandes crédit
- ✅ /farmers : liste paginée, filtres, scores, éligibilité dynamique
- ✅ /farmers/[id] : profil complet, score 4C, parcelles, modals approbation/rejet
- ✅ /scoring : distribution scores, score/filière, score/région
- ✅ /credits : pipeline demandes, tabs, modal approbation fonctionnelle
- ✅ /cooperatives : liste réelle, KPIs, filtres
- ✅ /cooperatives/[id] : profil, score portefeuille, farmers membres, IoT node, carte NDVI
- ✅ /ndvi : carte Leaflet 2 colonnes (60% map + 40% table), filtres, fly-to
- ✅ /alerts : alertes réelles, marquer lu, filtres, pagination
- ✅ /analytics : charts recharts redesignés (BarChart gradient, AreaChart, Donut PieChart)
- ✅ /reports : 3 tabs (générés, planifiés, modèles)
- ✅ /settings : 4 tabs (compte, API keys, notifications, scoring MFI)
- ✅ /scoring-config : configuration scoring institutionnelle complète (5 tabs)

**Design System appliqué** :
```css
--bg-base:        #080d18
--bg-card:        #0d1423
--border:         rgba(255,255,255,0.06)
--accent:         #10b981
--accent-2:       #06b6d4
--text-primary:   #e8edf5
--text-secondary: #5a6a85
```
Fonts : Inter + JetBrains Mono
Dark/Light mode toggle dans le header

**Composants créés** :
- Card.tsx, Badge.tsx, Button.tsx, KPICard.tsx
- DataTable.tsx, ScoreGauge.tsx, SliderInput.tsx, RangeConfig.tsx
- ChartTooltip.tsx, NdviMap.tsx, ParcellesNdviMap.tsx
- geoUtils.ts (parsePolygonCoords, parcelleCentre partagés)
- PageLoader.tsx

### 3.2 wakama-backend — PROD ✅

**Nouveaux modèles Prisma** (via `npx prisma db push`) :
```prisma
Institution { id, name, type(MFI|BANQUE|ASSURANCE), modules[], plan, active }
InstitutionUser { id, userId, institutionId, role(ADMIN|ANALYST|READONLY) }
CreditDecision { id, institutionId, farmerId, montant, taux, duree, statut, motif }
CreditRequest { id, farmerId, montant, duree, statut, montantAccorde, taux, dureeAccordee, motif }
InstitutionScoringConfig { id, institutionId, weightC1, weightC2, weightC3, weightC4, c1Rules, c2Rules, c3Rules, c4Rules, products, creditConditions, riskProfile }
Cooperative { + institutionId String? (relation vers Institution) }
Farmer { + experienceAnnees, revenusAnnexes, historicCredit }
```

**Nouvelles routes** :
- `GET/PATCH /v1/institutions/:id/scoring-config`
- `PATCH /v1/credit-requests/:id/approve`
- `PATCH /v1/credit-requests/:id/reject`
- `GET /v1/scores/:farmerId?institutionId=xxx` → score ajusté avec poids custom

**Login enrichi** :
```json
{
  "token": "...",
  "role": "INSTITUTION_ADMIN",
  "institutionId": "cmn82kqfr0002zu178d1xxbkk",
  "institutionName": "REMUCI",
  "institutionType": "MFI",
  "modules": ["scoring", "credits"]
}
```

### 3.3 Wakama Score 4C — ALGORITHME (src/lib/wakamaScore.ts)
```
Score final = (C1×w1 + C2×w2 + C3×w3 + C4×w4) × 10

Poids défaut : C1=30%, C2=25%, C3=25%, C4=20%
Poids custom : depuis InstitutionScoringConfig en DB

C1 CAPACITÉ : revenu estimé (surface × rendement × prix_officiel_CI)
  Cacao 1800, Hévéa 800, Anacarde 315, Maïs 150, Riz 250, Manioc 100 FCFA/kg

C2 CARACTÈRE : ancienneté + activités + expérience + bonus crédit

C3 COLLATÉRAL : photo+10, CNI+25, attestation+30, GPS+10, coop+15, polygone+10

C4 CONDITIONS : NDVI + filière + coop certifiée + alertes (malus)
```

### 3.4 Scoring Config Temps Réel — FONCTIONNEL ✅

```
Flow complet :
  1. MFI admin se connecte sur fmi.wakama.farm
  2. Va sur /scoring-config → ajuste C1/C2/C3/C4
  3. Clique Sauvegarder → PATCH /v1/institutions/:id/scoring-config
  4. Config sauvegardée en DB (InstitutionScoringConfig)
  5. Farmer ouvre farmer.wakama.farm/financement
  6. Page fetche GET /v1/scores/:farmerId?institutionId=xxx
  7. Backend applique les poids custom → score ajusté
  8. Éligibilité affichée selon critères de l'institution
  9. Badge "⚡ Critères ajustés" visible si poids différents du défaut
```

---

## 4. COMPTES DE TEST

### Farmers :
```
test5@etra.ci / Digipixel@21121983
  → Hyacinthe yanzi, Bouaké, farmerId: cmn1tmb0000086wzlp96bc70k
  → Score: ~929/1000 (avec C1=55% REMUCI), coop Sahara Trace

jebbarceo@gmail.com
  → jebbar marouane, Fès, farmerId: cmn3pa2lj000ej70qi3iki4ru

newcoop2@etra.ci
  → Marie Koné, COOP_ADMIN Sahara Trace
```

### Institutions (fmi-dashboard) :
```
admin@baobab-ci.com      / Wakama@2026  → Baobab CI (MFI)
admin@unacoopec.ci       / Wakama@2026  → UNACOOPEC (MFI)
admin@remuci.ci          / Wakama@2026  → REMUCI (MFI) ← ID: cmn82kqfr0002zu178d1xxbkk
admin@advans-ci.com      / Wakama@2026  → Advans CI (MFI)
admin@nsia.ci            / Wakama@2026  → NSIA Assurances (ASSURANCE)
admin@ecobank-ci.com     / Wakama@2026  → Ecobank CI (BANQUE)
admin@atlantique-assurances.ci / Wakama@2026 → Atlantique Assurances
admin@axa-ci.com         / Wakama@2026  → AXA Côte d'Ivoire
admin@wakama.farm        / Wakama@2026  → Wakama Demo
```

### Coops :
```
coop-etra-001         → ETRA, institutionId: cmn82kqfr0002zu178d1xxbkk (REMUCI)
coop-1774206981363    → Sahara Trace, institutionId: cmn82kqfr0002zu178d1xxbkk (REMUCI)
```

### IoT Node :
```
esp32-ETRA-001, status LIVE, 88 lectures
Dernière mesure : temp 31.45°C, humidité 66.85%, sol 0.246
```

---

## 5. ARCHITECTURE MULTI-TENANT (VALIDÉE)

```
Modèle "Bureau de Crédit" :

DONNÉES PARTAGÉES (toutes institutions) :
  → Wakama Score 0-1000
  → NDVI par parcelle
  → Données farmer (KYC, surface, culture)
  → Alertes climatiques
  → Coopératives

DONNÉES PRIVÉES PAR INSTITUTION :
  → CreditDecision (montant accordé, taux, statut)
  → InstitutionScoringConfig (poids 4C custom)
  → Notes internes

AUTH B2B :
  → JWT contient institutionId
  → role: INSTITUTION_ADMIN
  → Modules activés par institution
```

---

## 6. TROIS DASHBOARDS B2B — PLAN

### fmi-dashboard ✅ EN LIGNE
- URL : fmi.wakama.farm
- Accent : #10b981 vert
- Comptes : admin@[institution].ci / Wakama@2026

### bank-dashboard ⏳ À FAIRE
- Repo : Wakama-Edge-Ventures/bank-dashboard (vide)
- URL future : bank.wakama.farm
- Accent : #3b82f6 bleu
- Pages spécifiques : /portfolio, /campaigns (Kanban), /guarantees
- Fork de fmi-dashboard + adapter couleurs

### assurance-dashboard ⏳ À FAIRE
- Repo : Wakama-Edge-Ventures/assurance-dashboard (vide)
- URL future : assurance.wakama.farm
- Accent : #8b5cf6 violet
- Pages spécifiques : /climate (carte risque), /indices (déclencheurs)
- Fork de fmi-dashboard + adapter couleurs

---

## 7. COMMANDES UTILES

```bash
# Lancer les serveurs locaux
cd ~/dev/wakama-backend && npm run dev          # → http://localhost:3001
cd ~/dev/wakama-farmer-webapp && npm run dev   # → http://localhost:3002
cd ~/dev/fmi-dashboard && npm run dev          # → http://localhost:3000

# Ouvrir VSCode
code ~/dev/wakama-backend
code ~/dev/wakama-farmer-webapp
code ~/dev/fmi-dashboard

# SSH VPS
ssh -p 2222 root@80.65.211.227

# DB direct
docker exec -it wakama-postgres psql -U wakama -d wakama_db

# Voir scoring config REMUCI
docker exec wakama-postgres psql -U wakama -d wakama_db -c \
  "SELECT \"weightC1\",\"weightC2\",\"weightC3\",\"weightC4\",\"updatedAt\" FROM \"InstitutionScoringConfig\" WHERE \"institutionId\"='cmn82kqfr0002zu178d1xxbkk';"

# Voir logs backend
docker logs y400g4oggggc48kks0wog48c-112527375480 --tail 30

# Push pattern
git add . && git commit -m "..." && git push
# Puis Coolify → Redeploy

# IMPORTANT: Toujours utiliser npx prisma db push (pas migrate dev)
npx prisma db push
```

---

## 8. FICHIERS IMPORTANTS

```
fmi-dashboard/src/lib/scoringConfig.ts     → interface + getActiveConfig() + applyCustomWeights()
fmi-dashboard/src/lib/api.ts              → tous les appels API
fmi-dashboard/src/lib/auth.ts             → getInstitutionId(), getModules(), etc.
fmi-dashboard/src/lib/geoUtils.ts         → parsePolygonCoords(), parcelleCentre()
wakama-backend/src/lib/wakamaScore.ts     → algorithme 4C
wakama-backend/src/seeds/institutions.ts  → seed 9 institutions
wakama-backend/src/seeds/createInstitutionUsers.ts → seed 9 comptes admin
wakama-backend/prisma/schema.prisma       → schéma DB complet
```

---

## 9. PROCHAINES ÉTAPES (DANS L'ORDRE)

```
IMMÉDIAT :
  1. bank-dashboard (fork fmi-dashboard, accent #3b82f6)
     Pages : /portfolio, /campaigns (Kanban), /guarantees
  2. assurance-dashboard (fork fmi, accent #8b5cf6)
     Pages : /climate, /indices

ENSUITE :
  3. admin.wakama.farm (dashboard admin Wakama interne)
  4. App tablette agents terrain
  5. SESSION_CR.md → mettre à jour après chaque session

AMÉLIORATIONS FMI À FAIRE :
  - Score historique 12 mois (LineChart sur dashboard = encore mock)
  - Notifications header : badge count réel (connecté mais à vérifier)
  - Pagination farmers côté serveur (limit=20 ok mais total count à vérifier)
  - /ndvi, /alerts, /analytics : vérifier données réelles vs mock

IDÉES BUSINESS MODEL (Blueprint v3) :
  - Module marketplace (inspiration eAgri)
  - Warrantage digital
  - Certification "Wakama Verified"
  - Data feed assureurs (NDVI + météo)
```

---

## 10. NOTES TECHNIQUES IMPORTANTES

```
⚠️  NE JAMAIS utiliser : npx prisma migrate dev (reset DB !)
✅  TOUJOURS utiliser  : npx prisma db push

⚠️  SSH : clé SSH uniquement (pas de password)
    ssh -p 2222 root@80.65.211.227

⚠️  Après chaque modification backend ou farmer-webapp :
    git add . && git commit -m "..." && git push
    → Coolify → Redeploy

⚠️  fmi-dashboard utilise localStorage pour l'auth institution :
    wakama_fmi_token
    wakama_fmi_institution_id
    wakama_fmi_institution_name
    wakama_fmi_institution_type
    wakama_fmi_modules

⚠️  Score ajusté = GET /v1/scores/:farmerId?institutionId=xxx
    Sans institutionId → score avec poids défaut (30/25/25/20)
```

---

*Pour reprendre : lis ce fichier, dis "CR chargé ✅" et commence par bank-dashboard (fork fmi-dashboard, accent bleu #3b82f6, pages /portfolio /campaigns /guarantees).*
