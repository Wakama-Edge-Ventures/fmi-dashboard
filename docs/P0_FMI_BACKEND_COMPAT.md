# P0 FMI Backend Compat

## Login institutionnel

- Le login FMI utilise désormais en priorité `POST /v1/auth/institution-login`.
- Les données attendues côté frontend sont : `token`, `user`, `institutionId`, `institutionName`, `institutionType`, `modules`, `role` ou `institutionRole`.
- Le nom d'institution renvoyé par l'API devient la source de vérité. Le dropdown reste une aide UX, pas une référence métier.

## Source officielle du token

- `apiFetch` lit une seule source logique via `getAuthToken()`.
- La clé officielle utilisée est `wakama_token`.
- `wakama_fmi_token` est encore écrite pour compatibilité legacy, mais n'est plus la source de décision côté client.

## GET tenant-aware

- Les GET critiques passent par `apiFetch` avec Bearer automatique si un token est présent :
  - `GET /v1/farmers`
  - `GET /v1/cooperatives`
  - `GET /v1/credit-requests`
- Le filtrage principal doit venir du backend tenant-aware.
- Le filtrage client par `institutionId` n'est conservé qu'en complément, uniquement si l'API renvoie explicitement cette colonne.

## Mutations corrigées

- Les mutations sensibles passent toutes par `apiFetch`, donc avec `Authorization: Bearer ...` si disponible :
  - `PATCH /v1/credit-requests/:id/approve`
  - `PATCH /v1/credit-requests/:id/reject`
  - `PATCH /v1/institutions/:id/scoring-config`
  - `PATCH /v1/alerts/:id/read`
  - `PATCH /v1/alerts/read-all`
- Des wrappers ont été ajoutés côté client pour les décisions institutionnelles :
  - `POST /v1/institutions/:id/decisions`
  - `PATCH /v1/institutions/decisions/:id`
- Le dashboard n'utilise plus la mutation générique `PATCH /v1/credit-requests/:id` comme action critique.

## Gestion 401 / 403 / 400

- `401` :
  - `clearAuth()`
  - message `Session expirée, veuillez vous reconnecter.`
  - redirection vers `/{locale}/login`
- `403` :
  - message `Accès non autorisé pour ce rôle.`
- `400` :
  - remontée du message backend si présent

## Droits READONLY

- Helpers disponibles :
  - `getInstitutionRole()`
  - `isReadOnly()`
  - `canApproveCredit()`
  - `canEditScoringConfig()`
  - `canMarkAlerts()`
  - `hasModule(module)`
- Règles appliquées :
  - `READONLY` ne peut pas approuver/rejeter un crédit
  - `READONLY` ne peut pas modifier la scoring-config
  - `READONLY` ne peut pas marquer les alertes en lecture
- Les actions interdites sont masquées ou désactivées côté UI avec un libellé court.

## Scoring-config backend vs localStorage

- Chargement prioritaire via `GET /v1/institutions/:id/scoring-config`.
- Sauvegarde via `PATCH /v1/institutions/:id/scoring-config` avec Bearer.
- `localStorage` reste un draft/fallback UI, mais ne doit plus être considéré comme source finale si le backend répond.
- Les 5 onglets existants sont conservés.

## Risques restants

- Le repo contient encore des erreurs lint historiques hors périmètre P0 dans :
  - `app/[locale]/(protected)/scoring/page.tsx`
  - `app/[locale]/(protected)/settings/page.tsx`
- Le build Next.js ne peut pas être validé dans l'environnement WSL actuel tant que Node n'est pas mis à niveau vers `>= 20.9.0`.
- Quelques warnings legacy subsistent sur des `<img>` et sur du code non touché par cette passe P0.
