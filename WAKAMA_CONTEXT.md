# WAKAMA PLATFORM — CONTEXTE COMPLET DÉVELOPPEMENT
*Généré le 26 mars 2026 — Session de développement intensive*

## 1. IDENTITÉ PROJET
- **Société** : Wakama Edge Ventures Inc., Wyoming USA, EIN 37-2173391
- **CEO** : Marouane Jebbar, basé à Abidjan, Côte d'Ivoire
- **Vision** : Premier bureau de crédit agricole certifié blockchain d'Afrique
- **Produit phare** : wakama.farm — plateforme B2B Data & Scoring as a Service

## 2. INFRASTRUCTURE VPS
- **IP** : 80.65.211.227, SSH port 2222, user: root
- **Déploiement** : Coolify
- **DB** : PostgreSQL container `wakama-postgres`, port 5432
  - DB: wakama_db, user: wakama, pass: wakama2024
- **Uploads persistants** : /var/wakama/uploads → /app/uploads
- **Monitoring** : Uptime Kuma + Netdata via SSH tunnel

## 3. REPOS GITHUB (Wakama-Edge-Ventures)

### wakama-farmer-webapp → farmer.wakama.farm
- Stack: Next.js 15, TypeScript, Tailwind CDN, Leaflet, Turf.js
- Coolify container: ugw04ogc8g4ks0g0c8oos4os
- WSL path: /home/wakama/dev/wakama-farmer-webapp
- Auth: JWT localStorage (wakama_token, wakama_user, wakama_coop_id)
- Police: Chillax (OTF dans /public/fonts/)
- Logos: /public/wakama-logo.png, /public/idjor-logo.jpg, /public/solana-logo.png

### wakama-backend → api.wakama.farm
- Stack: Fastify, Prisma v5, PostgreSQL, nodemailer, bcryptjs, jsonwebtoken
- Coolify container: y400g4oggggc48kks0wog48c, port 4000
- WSL path: /home/wakama/dev/wakama-backend
- SMTP: smtp.hostinger.com:465 SSL, register@wakama.farm
- Sentinel Hub: SENTINEL_CLIENT_ID + SENTINEL_CLIENT_SECRET (Coolify env)

### wakama-b2b-dashboard → oracle.wakama.farm
- Stack: Next.js 15, TypeScript, Tailwind CSS, Recharts, Leaflet
- Branch: 001-institutional-dashboard
- WSL path: /home/wakama/dev/wakama-b2b-dashboard
- Coolify: wakama-oracle-dashboard
- Auth: wakama_b2b_token + wakama_token (fallback)

## 4. SCHÉMA PRISMA (wakama-backend)

### Models principaux:
```
User: id, email, password, role (FARMER/COOP_ADMIN/ADMIN), emailVerified
Farmer: id, userId, firstName, lastName, phone, region, village, country,
        lat, lng, surface, kycStatus, photoUrl, cniUrl, attestationUrl,
        cooperativeId, blockchainId, onboardedAt,
        experienceAnnees, revenusAnnexes, historicCredit
Cooperative: id, name, region, filiere, rccm, surface, foundedAt,
             adminUserId, logoUrl, lat, lng, certification, contratAcheteurs
Parcelle: id, farmerId, name, culture, superficie, lat, lng, polygone,
          ndvi, stade, datePlantation, historique
Activity: id, farmerId, parcelleId, type, description, date, statut
Message: id, farmerId, cooperativeId, objet, message, lu
Alert: id, farmerId, coopId, parcelleId, type, severity, title, message, read
CreditScore: id, farmerId, score
CreditRequest: id, farmerId, montant, duree, objet, message, statut
WeatherHistory: id, parcelleId, coopId, farmerId, lat, lng, region,
                tempAir, humidityAir, soilMoist0-27, tempSoil0-54,
                precipitation, windSpeed, et0, vpd, radiation
IoTNode: id, nodeCode, cooperativeId, lat, lng, status, batterie,
         connectivity, lastSyncAt, totalReadings, siteId, subteamId
IoTReading: id, nodeId, temperature, humidity, soilMoisture, soilTempTrue,
            tempS1, humidityS1, tempS2, humidityS2Raw, humidityS2Corr,
            tempAvg, humidityUsed, soilRaw, soilVoltage, rssi, deviceCode,
            ntpSynced, recordedAt
IotKitRequest: id, coopId, coopName, superficie, culture, nbMembres,
               hasElectricite, hasConnexion, message, statut
```

## 5. ROUTES API (api.wakama.farm)
```
AUTH:
POST /v1/auth/register
POST /v1/auth/login → { token, role, farmerId, email }
GET  /v1/auth/me → { ...user, coopId? }
POST /v1/auth/send-verification
POST /v1/auth/verify-code

FARMERS:
GET  /v1/farmers?page=1&limit=20&cooperativeId=xxx
GET  /v1/farmers/:id
POST /v1/farmers
PATCH /v1/farmers/:id → accepte: firstName, lastName, phone, region,
                         village, surface, lat, lng, photoUrl, cniUrl,
                         attestationUrl, cooperativeId, experienceAnnees,
                         revenusAnnexes, historicCredit

COOPERATIVES:
GET  /v1/cooperatives
GET  /v1/cooperatives/:id
POST /v1/cooperatives
PATCH /v1/cooperatives/:id

PARCELLES:
GET  /v1/parcelles?farmerId=xxx
POST /v1/parcelles
PATCH /v1/parcelles/:id
DELETE /v1/parcelles/:id

NDVI:
GET /v1/ndvi/:parcelleId → { ndvi, lastUpdated, status }
GET /v1/ndvi/parcelle/:parcelleId/image → PNG

SCORES (Wakama Score 4C):
GET /v1/scores/:farmerId → WakamaScoreResult
GET /v1/scores/coop/:coopId → { avgScore, totalFarmers, eligible, farmers[] }

ALERTS:
GET  /v1/alerts?farmerId=xxx&coopId=xxx&unreadOnly=true
PATCH /v1/alerts/:id/read
PATCH /v1/alerts/read-all

ACTIVITIES:
GET  /v1/activities?farmerId=xxx
POST /v1/activities

MESSAGES:
GET  /v1/messages?cooperativeId=xxx
POST /v1/messages

CREDIT REQUESTS:
GET  /v1/credit-requests?farmerId=xxx
POST /v1/credit-requests
PATCH /v1/credit-requests/:id → { statut }

WEATHER:
GET /v1/weather/history/:parcelleId
GET /v1/weather/history/farmer/:farmerId

IOT:
POST /v1/iot/ingest (header: X-DEVICE-KEY)
GET  /v1/iot/node?coopId=xxx
GET  /v1/iot/readings/:nodeId?limit=50

IOT KIT REQUESTS:
POST /v1/iot-kit-requests

UPLOAD:
POST /v1/upload/farmer/:id/photo
POST /v1/upload/farmer/:id/document
POST /v1/upload/cooperative/:id/logo
POST /v1/upload/cooperative/:id/document
```

## 6. WAKAMA SCORE (4C) — ALGORITHME SCIENTIFIQUE
```typescript
// Fichier: src/lib/wakamaScore.ts

// PRIX MARCHÉ CI OFFICIELS (FCFA/kg)
Cacao: 1800, Café: 1500, Anacarde: 315, Hévéa: 800,
Maïs: 150, Riz: 250, Manioc: 100, Igname: 200

// RENDEMENTS MOYENS (kg/ha)
Cacao: 500, Anacarde: 800, Maïs: 1500, Riz: 2000, Manioc: 8000

// FORMULE (Score 0-1000)
Score = (C1×0.30 + C2×0.25 + C3×0.25 + C4×0.20) × 10

C1 - CAPACITÉ (0-100):
  revenuEstime = surface × rendement × prix
  ≥5M FCFA → 100, ≥3M → 80, ≥1M → 60, ≥500K → 40, >0 → 20

C2 - CARACTÈRE (0-100):
  anciennete (0-40pts): ≥24mois→40, ≥12→30, ≥6→20, ≥1→10
  activites (0-40pts): ≥10→40, ≥6→30, ≥3→20, ≥1→10
  experience (0-20pts): >10ans→20, 6-10→15, 3-5→10, 1-2→5
  historicCredit bonus: remboursé→+10, difficultés→-10

C3 - COLLATÉRAL (0-100):
  photo→+10, CNI→+25, attestation→+30, GPS→+10, coop→+15, polygone→+10

C4 - CONDITIONS (0-100):
  NDVI: ≥0.6→40, ≥0.4→30, ≥0.2→20, >0→10
  filiere: rente→30, céréales→24, vivrier→21, maraicher→18
  coop certifiée→+20, hasCoop→+10
  alertes critiques: -5pts chacune (max -20)

// SEUILS MFI
REMUCI ≥ 300 (1.25%/mois, 1-36 mois, 100K-50M FCFA)
Baobab Agri Production ≥ 400 (1.60%/mois, 5-18 mois, 100K-20M)
Baobab Agri Campagne ≥ 600 (1.25%/mois, 3-8 mois, 5M-300M)
NSIA Pack Paysan ≥ 700 (~7%/an, bancaire)

// MONTANT SUGGÉRÉ
capaciteRemboursement = revenuEstime × 0.35 × (score/1000)
montantMin = MAX(100000, capacite × 0.3)
montantMax = MIN(20000000, capacite)
```

## 7. FARMER WEBAPP — PAGES COMPLÈTES
```
/ (landing) — FR/EN/AR, Wakama logo, Idjor orb, Solana sphere
/login — FR/EN/AR, Chillax font, no-scroll, real API auth
/register/farmer/1 — genre H/F, phone auto-detect IP, AR/EN/FR
/register/farmer/2 — pays+régions dynamiques, GPS, Nominatim search
/register/farmer/3 — liste coops réelles + "Je ne vois pas ma coop"
/register/farmer/4 — captcha math + email OTP (register@wakama.farm)
/register/coop/1 — filière 60+ cultures, agrément, certification, contrats
/register/coop/2 — membres avec genre
/register/coop/3 — pays+région+carte Leaflet+GPS
/register/coop/4 — CNI président, statuts, RCCM, extrait topo, RIB
/register/coop/5 — demande kit IoT + création compte OTP
/dashboard — WeatherWidget (Open-Meteo), Wakama Score KPI, NDVI, activités
/parcelles — liste + AddParcelleModal (dessin polygone + GPS tracer terrain)
/parcelles/detail?id=xxx — carte Leaflet + NDVI overlay Sentinel-2
/alertes — alertes réelles (météo+NDVI) + auto-refresh 30s
/financement — éligibilité MFI réelle + score 4C détail + demande crédit
/profil — photo, CNI, attestation, GPS map, coop picker modal

/coop/dashboard — KPIs réels coop, WeatherWidget, activité récente
/coop/cooperants — liste farmers filtrée par coopId, inscription farmer
/coop/cooperants/[id] — profil farmer, edit, photo
/coop/noeud — ESP32 IoT live data, auto-refresh 30s, charts
/coop/parametres — profil coop réel, logo upload
/coop/rapports — nom coop réel

Pages statiques:
/mentions-legales, /contact (Abidjan+Casablanca+Wyoming), /api-partenaires
```

## 8. SYSTÈME MÉTÉO
```
API: Open-Meteo (gratuit, pas de clé)
URL: https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}
     &hourly=temperature_2m,relative_humidity_2m,dew_point_2m,
     apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,
     cloud_cover,evapotranspiration,vapour_pressure_deficit,uv_index,
     soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm,
     soil_temperature_54cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,
     soil_moisture_3_to_9cm,soil_moisture_9_to_27cm
     &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,
     weathercode,precipitation_probability_max,et0_fao_evapotranspiration,
     sunrise,sunset,uv_index_max,sunshine_duration
     &timezone=Africa%2FAbidjan&forecast_days=7

Composant: WeatherWidget.tsx
  - Section 1: Conditions actuelles (temp, humidité, vent, ressenti)
  - Section 2: Prévisions 5 jours
  - Section 3: Données agro-météo (sol 5 niveaux, radiation, VPD, ET0)
  - Section 4: Recommandations agricoles automatiques

Cron job backend: collectWeatherForAllParcelles() + collectWeatherForAllCoops()
  → Toutes les heures → stocké dans WeatherHistory
```

## 9. ESP32 IoT (ETRA Node)
```
Device: esp32-ETRA-001
Coop: coop-etra-001
GPS: lat=7.4882, lng=4.8133, alt=260m (KouassiKongokrou, Bouaké)
Capteurs: 2×DHT22 (air), DS18B20 (sol temp), analogique (sol humidité)
Envoi: POST https://api.wakama.farm/v1/iot/ingest
Header: X-DEVICE-KEY: etra_esp32_001__K2v9F6pQxW3dR8nH1sL4aT7yU0iO5pB
Intervalle: 3600000ms (1h) en prod, 300000ms (5min) pour tests
Données: 32 lectures en DB au 26/03/2026
```

## 10. NDVI SENTINEL-2
```
API: Copernicus Data Space (Sentinel Hub)
Credentials: SENTINEL_CLIENT_ID + SENTINEL_CLIENT_SECRET (Coolify env)
Token URL: https://identity.dataspace.copernicus.eu/auth/realms/CDSE/...
Process URL: https://sh.dataspace.copernicus.eu/api/v1/process
Stats URL: https://sh.dataspace.copernicus.eu/api/v1/statistics

Routes:
GET /v1/ndvi/:parcelleId → { ndvi: 0.258, status: 'success' }
GET /v1/ndvi/parcelle/:parcelleId/image → PNG coloré

NDVI réel parcelle Hyacenthé: 0.258 (MODÉRÉ)
Buffer bbox: 0.001 degrés (~100m)
Période: 90 derniers jours
```

## 11. B2B DASHBOARD (oracle.wakama.farm) — ÉTAT ACTUEL
```
src/lib/api.ts — 11 fonctions API connectées à api.wakama.farm ✅
src/app/[locale]/login/page.tsx — Real API login ✅
src/app/[locale]/dashboard/page.tsx — KPIs réels partiels ✅
src/app/[locale]/farmers/page.tsx — Liste réelle + scores + éligibilité ✅
src/app/[locale]/farmers/[id]/page.tsx — Détail farmer réel ✅
src/app/[locale]/cooperatives/page.tsx — Coops réelles ✅
src/app/[locale]/alerts/page.tsx — Alertes réelles ✅

ENCORE MOCK:
src/app/[locale]/analytics/page.tsx — 100% mock
src/app/[locale]/ndvi/page.tsx — 5 parcelles hardcodées
src/app/[locale]/cooperatives/[id]/page.tsx — 100% mock
src/app/[locale]/reports/page.tsx — 100% mock
src/app/[locale]/settings/page.tsx — Hardcodé Jean Dupont/Advans CI

PROBLÈMES CONNUS:
- Score moyen dashboard parfois "--" (timing useEffect)
- FarmersMap score thresholds corrigés (0-1000) ✅
- Sidebar tooltips ajoutés ✅
- Analytics: données fausses (342 farmers vs 57 réels)

DESIGN: Dark corporate (slate #0b141a / #131722)
Sidebar: 64px fixe avec icônes Material + tooltips hover
```

## 12. SYSTÈME D'ALERTES AUTOMATIQUES
```
Backend job: generateAlertsForAllFarmers() + generateAlertsForCoops()
Fréquence: Au démarrage (60s delay) puis toutes les 6h
Déduplication: Par farmerId + type + severity + jour calendaire

Alertes générées automatiquement:
- METEO CRITICAL: si soilMoisture < 0.15 → "Risque sécheresse"
- METEO WARNING: si précipitations > 20mm demain
- METEO WARNING: si tempMax > 38°C
- NDVI WARNING: si ndvi < 0.3
- NDVI CRITICAL: si ndvi < 0.2
- IOT WARNING: si soilMoisture ESP32 < 0.2
```

## 13. COMPTES DE TEST
```
FARMERS:
- test5@etra.ci / Digipixel@21121983 → Hyacenthé yanzi, Bouaké
  farmerId: cmn1tmb0000086wzlp96bc70k
  Score: ~765/1000
- jebbarceo@gmail.com → jebbar marouane, Fès
  farmerId: cmn3pa2lj000ej70qi3iki4ru
- newcoop2@etra.ci → Marie Koné, COOP_ADMIN Sahara Trace
  coopId: coop-1774206981363

COOPS:
- coop-etra-001 → ETRA, Vallée du Bandama, Cacao, 46 membres
- coop-1774206981363 → Sahara Trace coop, Abidjan

IOT NODE:
- esp32-ETRA-001 → 32 lectures, dernière 26/03/2026
```

## 14. BUSINESS MODEL B2B
```
TIER 1 — MFI (Baobab, UNACOOPEC, REMUCI, Advans):
  Wakama Score API
  Prix: 150K-500K FCFA/mois OU 2K-5K FCFA/score
  Argument: remplace visite terrain (15K-50K FCFA/dossier)

TIER 2 — Banques (NSIA, Ecobank, SIB):
  Wakama Credit Bureau API + Dashboard
  Prix: 3M-10M FCFA/an

TIER 3 — Assureurs (Atlantique, AXA, Sanlam):
  Wakama Climate Data Feed
  Prix: 5M-20M FCFA/an

TIER 4 — Bailleurs (BOAD, BEI, FIDA):
  Wakama Impact Dashboard
  Prix: 10M-50M FCFA/projet

TIER 5 — Farmers Premium:
  2K-5K FCFA/mois
```

## 15. CE QUI RESTE À DÉVELOPPER
```
PRIORITÉ 1 — B2B Dashboard MFI (oracle.wakama.farm):
  □ Refaire from scratch en Tailwind propre
  □ analytics/page.tsx → données réelles
  □ cooperatives/[id]/page.tsx → API réelle
  □ ndvi/page.tsx → parcelles réelles
  □ settings/page.tsx → account réel
  □ Farmer detail → graphiques score/NDVI historique

PRIORITÉ 2 — B2B Dashboard Banques
PRIORITÉ 3 — B2B Dashboard Assureurs
PRIORITÉ 4 — admin.wakama.farm (Dashboard admin Wakama)
PRIORITÉ 5 — App tablette agents terrain
PRIORITÉ 6 — Module marketplace (inspiration eAgri)
PRIORITÉ 7 — Warrantage digital
PRIORITÉ 8 — Certification "Wakama Verified"
```

## 16. COMMANDES UTILES
```bash
# Backend dev
cd /home/wakama/dev/wakama-backend && npm run dev

# Farmer webapp dev  
cd /home/wakama/dev/wakama-farmer-webapp && npm run dev
# → http://localhost:3002

# B2B dashboard dev
cd /home/wakama/dev/wakama-b2b-dashboard && npm run dev

# DB check
docker exec -it wakama-postgres psql -U wakama -d wakama_db

# VPS SSH
ssh root@80.65.211.227 -p 2222

# Push et deploy pattern
git add . && git commit -m "..." && git push
# Puis Coolify → Redeploy
```
