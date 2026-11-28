# Platform Encounter Sumatra (`platform-ensu`)

Monorepo resmi **Platform Encounter Sumatra** yang dibangun dengan **Bun**, **Turborepo**, **TanStack Start** (React 19 + TanStack Router + Nitro), **TanStack AI**, **oRPC**, dan **Drizzle ORM + PostgreSQL (PostGIS / pgvector)** serta **Valkey**.

---

## Struktur Monorepo

```text
platform-ensu/
├── apps/
│   └── web/                  # @encounter/web — Aplikasi web TanStack Start (SSR + API routes + UI)
├── packages/
│   ├── api/                  # @encounter/api — Router oRPC & modul AI Concierge (model-router)
│   ├── db/                   # @encounter/db — Klien Drizzle ORM, pg Pool, & skema PostgreSQL
│   ├── design-tokens/        # @encounter/design-tokens — Token CSS desain bersama (theme.css)
│   └── shared/               # @encounter/shared — Tipe, skema Zod, & utilitas lintas paket
├── docker/
│   └── postgres/             # Dockerfile & init.sql ekstensi PostgreSQL (postgis, vector, pg_trgm)
├── docs/                     # Dokumentasi teknis & panduan micro-tasks
├── docker-compose.yml        # Layanan lokal PostgreSQL + Valkey
├── turbo.json                # Pipeline task Turborepo (build, dev, typecheck, lint)
└── .env.example              # Template variabel lingkungan (jangan taruh secret asli di sini)
```

---

## Prasyarat Sistem

- **Bun** `1.4.5` (lihat `packageManager` di `package.json`)
- **Node.js** `>=22.9.0` (dibutuhkan untuk menjalankan hasil build Nitro dengan `--env-file-if-exists`)
- **Docker & Docker Compose** (untuk PostgreSQL + Valkey lokal)

---

## Panduan Setup Awal (Dari Nol)

### 1. Instal Dependensi

```bash
bun install
```

### 2. Siapkan Variabel Lingkungan (`.env.local`)

Salin `.env.example` menjadi `.env.local` di **root monorepo** (jangan di dalam `apps/web/`):

```bash
cp .env.example .env.local
```

Lalu isi nilai rahasia berikut di `.env.local`:

- `OPENROUTER_API_KEY`: API key dari dashboard OpenRouter (dibutuhkan untuk menguji AI Concierge `/api/chat`).
- `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `AFFILIATE_HASH_SALT`: Wajib diisi masing-masing dengan **secret acak unik minimal 32 byte (64 karakter hex)**. Generate 3 nilai berbeda lewat terminal:

  ```bash
  node -e "for (const k of ['BETTER_AUTH_SECRET','ENCRYPTION_KEY','AFFILIATE_HASH_SALT']) console.log(k + '=\"' + require('node:crypto').randomBytes(32).toString('hex') + '\"')"
  ```

> **Catatan:** File `.env.local` sudah diabaikan oleh `.gitignore`. Jangan pernah menaruh secret asli ke dalam `.env.example` atau melakukan commit `.env.local`.

### 3. Jalankan Database PostgreSQL & Valkey

```bash
bun run db:up
```

Perintah di atas menyalakan dua container Docker dari `docker-compose.yml`:

- `ensu-postgres` di port `5432` (sudah mengaktifkan ekstensi `postgis`, `vector`, dan `pg_trgm`)
- `ensu-valkey` di port `6379` (Valkey 8 untuk caching & rate limiting)

### 4. Jalankan Server Development

```bash
bun run dev
```

Aplikasi web berjalan di `http://localhost:3000`. Vite pada `apps/web/vite.config.ts` otomatis membaca `.env.local` dari root monorepo (`envDir: '../..'`).

---

## Daftar Perintah Utama (`bun run ...`)

### Pengembangan & Build

| Perintah                            | Fungsi                                                                       |
| :---------------------------------- | :--------------------------------------------------------------------------- |
| `bun run dev`                       | Menjalankan seluruh task `dev` via Turborepo (`@encounter/web` di port 3000) |
| `bun run build`                     | Membangun bundle produksi Nitro ke `apps/web/.output/`                       |
| `bun --filter @encounter/web start` | Menjalankan hasil build produksi via Node.js dengan `--env-file-if-exists`   |

### Quality Gate (Wajib Lolos Sebelum Commit / PR)

| Perintah            | Fungsi                                                                                      |
| :------------------ | :------------------------------------------------------------------------------------------ |
| `bun run typecheck` | Memeriksa tipe TypeScript di seluruh paket (`shared`, `db`, `api`, `web`)                   |
| `bun run lint`      | Menjalankan ESLint di seluruh paket yang memiliki kode JS/TS (`shared`, `db`, `api`, `web`) |
| `bun run check`     | Memeriksa kerapian format kode seluruh repo dengan Prettier                                 |
| `bun run format`    | Merapikan format kode seluruh repo secara otomatis dengan Prettier                          |

### Database (`@encounter/db` + Drizzle Kit)

| Perintah              | Fungsi                                                               |
| :-------------------- | :------------------------------------------------------------------- |
| `bun run db:up`       | Menyalakan container PostgreSQL & Valkey (`docker compose up -d`)    |
| `bun run db:generate` | Membuat file migrasi SQL dari perubahan `packages/db/src/schema.ts`  |
| `bun run db:migrate`  | Menjalankan migrasi SQL yang tertunda ke PostgreSQL                  |
| `bun run db:push`     | Mendorong skema Drizzle langsung ke DB lokal (untuk prototipe cepat) |
| `bun run db:pull`     | Menarik skema database yang ada ke kode                              |
| `bun run db:studio`   | Membuka antarmuka web Drizzle Studio untuk melihat isi tabel         |

---

## Konvensi Pengembangan Penting

- **Path Alias Internal Web (`#/*`):** Di dalam `apps/web`, gunakan `#/*` (didefinisikan di `apps/web/package.json#imports` dan `apps/web/tsconfig.json`). Jangan gunakan `@/*`.
- **AI Mode & Keamanan `/api/chat`:** Mode default lokal adalah `AI_MODE="free_dev"`. Endpoint `POST /api/chat` dilengkapi validasi skema Zod, batas payload, abort propagation, dan fail-closed production guard sampai `better-auth` + rate limiting Valkey diaktifkan penuh.
- **Dependensi Upstream `@tanstack/devtools-event-client`:** Perintah `intent list` mungkin menampilkan peringatan dua versi transitif (`0.4.4` dari `@tanstack/ai-event-client` dan `0.5.1` dari `@tanstack/devtools-client`). Ini berasal dari paket upstream TanStack dan diisolasi aman oleh `bun.lock` — **jangan** menambahkan `overrides` paksa atau mengubah `bun.lock` secara manual.
