# Platform Encounter Sumatra (`platform-ensu`)

Monorepo resmi **Platform Encounter Sumatra** yang dibangun dengan **Bun**, **Turborepo**, **TanStack Start** (React 19 + TanStack Router + Nitro), **TanStack AI**, **Better Auth**, **oRPC**, **Drizzle ORM + Neon PostgreSQL**, dan **Upstash Redis REST**.

---

## Struktur Monorepo

```text
platform-ensu/
├── apps/
│   └── web/                  # @encounter/web — Aplikasi web TanStack Start (SSR + API routes + UI)
├── packages/
│   ├── api/                  # @encounter/api — Router oRPC, AI Concierge, & Rate Limiter Upstash
│   ├── db/                   # @encounter/db — Klien Drizzle ORM, Neon pg Pool, & skema PostgreSQL
│   ├── design-tokens/        # @encounter/design-tokens — Token CSS desain bersama (theme.css)
│   └── shared/               # @encounter/shared — Tipe, skema Zod, & utilitas lintas paket
├── docker/
│   └── postgres/             # Dockerfile & init.sql ekstensi PostgreSQL (opsi lokal offline)
├── docs/                     # Dokumentasi teknis & panduan micro-tasks
├── docker-compose.yml        # Opsi offline lokal PostgreSQL + Valkey
├── turbo.json                # Pipeline task Turborepo (build, dev, typecheck, lint)
└── .env.example              # Template variabel lingkungan (jangan taruh secret asli di sini)
```

---

## Prasyarat Sistem

- **Bun** `1.4.5` (lihat `packageManager` di `package.json`)
- **Node.js** `>=22.9.0` (dibutuhkan untuk menjalankan hasil build Nitro dengan `--env-file-if-exists`)
- **Akun Neon PostgreSQL** (gunakan branch `dev` untuk pengembangan lokal)
- **Akun Upstash Redis** (REST API untuk rate limiting `/api/chat`)
- **Docker & Docker Compose** _(opsional, hanya jika ingin menjalankan PostgreSQL + Valkey lokal secara offline)_

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

- **Neon PostgreSQL (Branch `dev`):**
  - `DATABASE_URL`: String koneksi **Pooled** (hostname mengandung `-pooler`, akhiran `?sslmode=require`) untuk runtime aplikasi.
  - `DIRECT_DATABASE_URL`: String koneksi **Direct / Unpooled** (tanpa `-pooler`, akhiran `?sslmode=require`) khusus untuk migrasi `drizzle-kit`.
- **Upstash Redis REST:**
  - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: Salin dari tab **REST API** pada dashboard database Upstash Redis.
- **OpenRouter AI:**
  - `OPENROUTER_API_KEY`: API key dari dashboard OpenRouter (dibutuhkan untuk menguji AI Concierge `/api/chat`).
- **Secrets Aplikasi (`BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `AFFILIATE_HASH_SALT`):**
  Wajib diisi masing-masing dengan **secret acak unik minimal 32 byte (64 karakter hex)**. Generate 3 nilai berbeda lewat terminal:

  ```bash
  node -e "for (const k of ['BETTER_AUTH_SECRET','ENCRYPTION_KEY','AFFILIATE_HASH_SALT']) console.log(k + '=\"' + require('node:crypto').randomBytes(32).toString('hex') + '\"')"
  ```

> **Catatan:** File `.env.local` sudah diabaikan oleh `.gitignore`. Jangan pernah menaruh secret asli ke dalam `.env.example` atau melakukan commit `.env.local`.

### 3. Jalankan Migrasi Skema ke Neon (Branch `dev`)

```bash
bun run db:migrate
```

_(Jika kamu baru mengubah skema di `packages/db/src/schema/`, jalankan `bun run db:generate` terlebih dahulu untuk membuat file migrasi SQL baru di `packages/db/drizzle/`, periksa SQL-nya, lalu jalankan `bun run db:migrate`)._

> **Opsi Offline (Docker Lokal):** Jika bekerja tanpa koneksi Neon, kamu dapat menyalakan container lokal PostgreSQL + Valkey dengan `bun run db:up` dan mengarahkan `DATABASE_URL` serta `DIRECT_DATABASE_URL` ke PostgreSQL lokal tersebut. Catatan: endpoint `/api/chat` tetap membutuhkan akses Upstash Redis REST (`UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`) secara _fail-closed_.

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

| Perintah              | Fungsi                                                                                  |
| :-------------------- | :-------------------------------------------------------------------------------------- |
| `bun run db:generate` | Membuat file migrasi SQL dari perubahan `packages/db/src/schema.ts`                     |
| `bun run db:migrate`  | Menjalankan migrasi SQL yang tertunda ke Neon via `DIRECT_DATABASE_URL`                 |
| `bun run db:push`     | Mendorong skema Drizzle langsung ke DB (hanya untuk prototipe lokal, hindari di prod)   |
| `bun run db:pull`     | Menarik skema database yang ada ke kode                                                 |
| `bun run db:studio`   | Membuka antarmuka web Drizzle Studio untuk melihat isi tabel                            |
| `bun run db:up`       | _(Opsional offline)_ Menyalakan container PostgreSQL & Valkey dari `docker-compose.yml` |

---

## Konvensi Pengembangan Penting

- **Path Alias Internal Web (`#/*`):** Di dalam `apps/web`, gunakan `#/*` (didefinisikan di `apps/web/package.json#imports` dan `apps/web/tsconfig.json`). Jangan gunakan `@/*`.
- **AI Mode & Keamanan `/api/chat`:** Mode default lokal adalah `AI_MODE="free_dev"`. Endpoint `POST /api/chat` mewajibkan sesi terautentikasi (`better-auth` → `401` bila belum login), menerapkan rate limiter sliding-window Upstash Redis REST secara _fail-closed_ (`429` saat melebihi batas, `503` bila Upstash gagal), serta validasi skema Zod, batas payload, dan abort propagation.
- **Dependensi Upstream `@tanstack/devtools-event-client`:** Perintah `intent list` mungkin menampilkan peringatan dua versi transitif (`0.4.4` dari `@tanstack/ai-event-client` dan `0.5.1` dari `@tanstack/devtools-client`). Ini berasal dari paket upstream TanStack dan diisolasi aman oleh `bun.lock` — **jangan** menambahkan `overrides` paksa atau mengubah `bun.lock` secara manual.
