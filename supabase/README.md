# TeamFlow — Supabase Bulut Senkronu

## Kurulum

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project**
2. **SQL Editor** → **New query**
3. [`schema.sql`](./schema.sql) dosyasının tamamını yapıştırıp **Run**
4. **Authentication → Providers → Email** — isteğe bağlı: *Confirm email* kapalı (geliştirme)
5. **Project Settings → API**:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

Bu değerleri proje kökündeki `.env` dosyasına ekleyin (`.env.example` şablonuna bakın).

## Tablo

| Tablo | Açıklama |
|-------|----------|
| `user_data` | Kullanıcı başına JSON payload (`user_id` = auth.users.id) |

Row Level Security (RLS) etkin; her kullanıcı yalnızca kendi satırına erişebilir.

## GitHub Actions

Production build'de bulut senkronu için repo **Settings → Secrets → Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
