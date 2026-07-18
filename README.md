# TeamFlow PWA

Yapay zeka destekli, çevrimdışı çalışabilen Kanban + görev yönetimi PWA'sı ve raporlama.

Canlı demo: [emreneyse.github.io/teamflow-pwa](https://emreneyse.github.io/teamflow-pwa/)

## Amaç

Kişisel ve ekip görevlerini haftalık planla, Kanban üzerinde takip et, AI asistanıyla rutinleri yönet ve performansını görsel raporlarla izle — tarayıcıda, çevrimdışı, mobil uyumlu.

## Özellikler

- **Kanban görev tahtası** — Haftalık filtre, sürükle-bırak, öncelik etiketleri
- **AI Group Head** — Pazartesi plan, Çarşamba check-in, Cuma haftalık rapor rutinleri
- **Performans özeti** — Haftalık verimliliğini görselleştiren, otomatik güncellenen dashboard
- **Raporlama** — Canlı grafikler, haftalık özet kaydı, Excel/PDF dışa aktarma
- **Çoklu kullanıcı** — Aynı cihazda birden fazla hesap; hesap seçimi + 4 haneli PIN
- **Bildirim merkezi** — Navbar'da okunmamış sayacı ve cam efektli popup
- **Bulut senkronu** — Supabase ile cihazlar arası otomatik eşitleme (isteğe bağlı)
- **Manuel yedek** — JSON yedek indir / içe aktar
- **PWA** — Çevrimdışı destek, ana ekrana eklenebilir, mobil alt menü

## Teknolojiler

- [Vite](https://vitejs.dev) + TypeScript
- Vanilla HTML/CSS (glass design system)
- [Groq API](https://groq.com) — AI yanıtları (isteğe bağlı, Ayarlar'dan)
- [Supabase](https://supabase.com) — Bulut senkronu (isteğe bağlı)
- [SheetJS (xlsx)](https://sheetjs.com) + [pdfmake](https://pdfmake.github.io/docs/) — Rapor export

## Hızlı başlangıç

```bash
git clone https://github.com/EmreNeyse/teamflow-pwa.git
cd teamflow-pwa
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini açın.

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayın:

```bash
cp .env.example .env
```

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | Hayır | Bulut senkronu için Supabase proje URL'i |
| `VITE_SUPABASE_ANON_KEY` | Hayır | Supabase anon (public) key |

Groq API anahtarı repoda tutulmaz; uygulama içi **Ayarlar** ekranından girilir.

> **Güvenlik:** `.env` dosyasını asla commit etmeyin. GitHub'a push etmeden önce `git status` ile kontrol edin.

## Bulut senkronu (Supabase)

1. [supabase.com](https://supabase.com) üzerinde proje oluşturun
2. SQL Editor'de [`supabase/schema.sql`](./supabase/schema.sql) dosyasını çalıştırın
3. **Authentication → Providers → Email** — geliştirme için e-posta onayını kapatabilirsiniz
4. **Project Settings → API** — URL ve `anon` key'i `.env` dosyasına ekleyin
5. Uygulamada **Ayarlar → Bulut Senkronu** bölümünden hesap oluşturun veya giriş yapın

## Production build

```bash
npm run build
npm run preview
```

Çıktı `dist/` klasöründedir.

## GitHub Pages'e deploy

Repo **Settings → Pages → Build and deployment** bölümünde:

- **Source:** GitHub Actions

`main` branch'e push ettiğinizde [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) otomatik build alır ve yayınlar.

Bulut senkronu production'da çalışsın istiyorsanız repo **Settings → Secrets and variables → Actions** altına şu secret'ları ekleyin:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## PWA ikonları

`public/` klasörüne aşağıdaki dosyaları ekleyin (GitHub'daki eski sürümde mevcut olabilir):

- `icon-192.png`
- `icon-512.png`

## Proje yapısı

```
teamflow-pwa/
├── .github/workflows/   # GitHub Pages CI
├── public/              # PWA manifest, service worker, ikonlar
├── src/
│   ├── app/             # Ekran modülleri ve uygulama akışı
│   ├── data/            # Sabitler, örnek görevler
│   ├── lib/             # Depolama, AI, rapor, sync, grafikler
│   ├── styles/          # Global CSS
│   └── types/           # TypeScript tipleri
├── supabase/            # Bulut senkronu SQL şeması
├── index.html
├── vite.config.ts
└── package.json
```

## Veri modeli (localStorage)

| Anahtar | Açıklama |
|---------|----------|
| `tf_registry` | Kayıtlı kullanıcı listesi |
| `tf_user_{id}` | Görevler, raporlar, bildirimler, ayarlar |
| `tf_session` | Aktif oturum |

Eski tek kullanıcılı `tf_v2` verisi ilk açılışta otomatik taşınır.

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | TypeScript kontrolü + production build |
| `npm run preview` | Build önizleme |
| `npm run lint` | TypeScript tip kontrolü |

## Lisans

[MIT](./LICENSE) — Emre Neyse
