# Channel Manager

PMS / Channel Manager pour la location courte durée — multi-logements,
calendrier centralisé, ménage, pricing. Voir le dossier d'architecture pour
le contexte complet (modules, roadmap, décisions actées : MVP en iCal-only,
socle managé Supabase).

État actuel : **Sprint 1 — fondations** (auth + organisations + RBAC).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, Realtime
- pnpm

## Mise en route

### 1. Créer le projet Supabase

Dans le [dashboard Supabase](https://supabase.com/dashboard), crée un nouveau
projet (région proche de tes voyageurs/logements, ex. `eu-west-3`).

### 2. Appliquer le schéma

Les migrations vivent dans [`supabase/migrations/`](supabase/migrations), à
appliquer **dans l'ordre numérique**. Le plus simple sans installer le CLI
Supabase&nbsp;: ouvre l'éditeur SQL du dashboard (*SQL Editor*) et colle le
contenu de chaque fichier, un par un :

1. `0001_extensions.sql`
2. `0002_organizations_and_roles.sql`
3. `0003_audit_and_settings.sql`

(Si tu préfères le CLI : `npx supabase login`, `npx supabase link --project-ref <ref>`,
puis `npx supabase db push`.)

### 3. Variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplis les trois valeurs depuis *Project Settings → API* du dashboard
Supabase : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (cette dernière ne doit **jamais** être exposée
au navigateur ni commit).

### 4. Lancer l'app

```bash
pnpm install
pnpm dev
```

Ouvre [http://localhost:3000](http://localhost:3000) — tu es redirigé vers
`/login`. Crée un compte (email + mot de passe), confirme l'email si la
confirmation est activée sur le projet Supabase, puis crée ta première
organisation : tu en deviens automatiquement administrateur.

## Structure

```
src/
  app/
    login/                 page de connexion / inscription
    auth/callback/         échange du code magic-link -> session
    actions/                Server Actions (organisations, déconnexion)
    page.tsx                tableau de bord (liste des organisations)
  lib/supabase/
    client.ts               client Supabase pour les Client Components
    server.ts                client Supabase pour Server Components / Route Handlers
    proxy.ts                 rafraîchissement de session, utilisé par src/proxy.ts
  proxy.ts                   proxy Next.js (ex-"middleware") : session + routes protégées
supabase/
  migrations/                schéma SQL, un fichier par migration, RLS incluse
```

## Sécurité des données

L'isolation multi-organisation est appliquée au niveau base via **Row Level
Security** (pas seulement en filtrant côté application) : chaque table
métier a des policies qui vérifient l'appartenance à l'organisation via
`is_org_member()` / `has_org_role()` (voir `0002_organizations_and_roles.sql`).
La clé `service_role` contourne ces policies — elle est réservée au code
serveur de confiance (jobs planifiés), jamais à un chemin déclenchable
directement par un client.

## Scripts

```bash
pnpm dev      # serveur de développement (Turbopack)
pnpm build    # build de production
pnpm lint     # ESLint
```

## Prochaines étapes

Voir la roadmap du dossier d'architecture — Sprint 2 : logements (properties/units).
