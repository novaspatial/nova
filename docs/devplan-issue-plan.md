# DevPlan — Issue Handling Planı

`devplan.docx` (Web Designer Meeting, 2026-06-09) → `/to-issues` ile **27 issue** olarak dilimlendi.
Bu doküman: **hangi sırayla gidilmeli**, neyin neyi blokladığı ve hangi kararların önce verilmesi gerektiği.

> Kaynak issue'lar: [novaspatial/nova/issues](https://github.com/novaspatial/nova/issues)
> Açık kararlar şemsiyesi: [#1](https://github.com/novaspatial/nova/issues/1) (`needs-info`)

## Etiket okuması

- `ready-for-agent` → tam spec'li, AFK ajan hemen alabilir.
- `ready-for-human` → önce bir **karar** (bkz. #1) verilmeli; sonra ajana açılır.
- `needs-info` → #1 şemsiye karar issue'su.

---

## Faz 0 — Bugün başla (karar gerektirmez, paralel gidebilir)

Hiçbiri açık karara bağlı değil. Aynı anda dağıtılabilir.

> **Durum (2026-06-25):** #12, #2, #3, #7, #8, #10, #11 tamam (commit'lendi). Faz 0 tamamlandı.

| Sıra | Issue | Ne | Durum / Not |
|------|-------|----|-------------|
| 1 | [#12](https://github.com/novaspatial/nova/issues/12) **S16** | Archive RLS sıkılaştırma | ✅ **Tamam** — `20260625` trigger'ı studio-only `archived_at` yazımını DB seviyesinde zorluyor; ARCHITECTURE.md + CLAUDE.md güncel. Migration remote'a uygulandı + canlı doğrulandı (client → 42501 FAIL, studio → OK). |
| 2 | [#2](https://github.com/novaspatial/nova/issues/2) **P4** | Checkbox primitive + Footer düzeni | ✅ **Tamam** (`de811ff`) — erişilebilir Checkbox + Footer Legal seam; #23 (T&C) artık ince wiring. |
| 3 | [#3](https://github.com/novaspatial/nova/issues/3) **P5** | Storage-cleanup kütüphanesi | ✅ **Tamam** — `projectCleanup.ts` (files + comment-attachments + deliverables); DELETE route paylaşıyor, attachment sızıntısı kapandı. #27 (purge) yeniden kullanacak. |
| 4 | [#7](https://github.com/novaspatial/nova/issues/7) **S9** | Motion + reduced-motion geçişi | ✅ **Tamam** (`c612c93`) — FadeIn ~0.4→1 opaklıktan + 0.35s; `prefers-reduced-motion` altında opaklık anında 1 (sadece y değil). Global `@media (prefers-reduced-motion: reduce)` bloğu 6 sonsuz keyframe'i (marquee, border-flow, nav-highlight(-bg), gradient-shimmer, hero-glow) + dekoratif pulse/ping/bounce'u `animation:none` ile durduruyor; işlevsel `spin` bırakıldı. GridPattern **kaldırılmadı** (sahibi "görsel için kritik" dedi) — bunun yerine `interactive` JS hover-trail animasyonu `useReducedMotion()` ile kapatıldı (CSS bloğu JS animasyonuna erişemez). Build + lint temiz. |
| 5 | [#8](https://github.com/novaspatial/nova/issues/8) **S9b** | Kontrast + hero kredileri (Juno & Emmy) | ✅ **Tamam** (`6d36e6c`) — ikincil kopya `zinc-400→zinc-300` + 18px (HowItWorks, Services, FAQ); hero artık "Juno & Emmy Award-winning engineers" diyor + dengeli satır sarma (`text-balance`); caption/label'lar sönük bırakıldı. |
| 6 | [#10](https://github.com/novaspatial/nova/issues/10) **S11** | Blog tipografi cilası | ✅ **Tamam** (`1729e38`) — okuma kolonu 768→660px (`max-w-165`), gövde line-height ~1.7, H2 32px (`--text-4xl`) + üstte daha çok boşluk, blockquote stili; Apple Music için `apple-music` fenced shortcode → callout card. #20 (per-post SEO) artık açık. |
| 7 | [#11](https://github.com/novaspatial/nova/issues/11) **S11b** | Blog yapısal hata düzeltmeleri | ✅ **Tamam** (`711ebbd`) — ilk gövde görseli `extractHeroImage` ile ayrılıp ilk H2'den önce tek-render hero (`next/image priority`) olarak basılıyor (GrayscaleTransitionImage çift-boya yok); nav pill scroll-down'da gizlenip scroll-up'ta beliriyor (`useScroll` + `useReducedMotion`); byline adı/rolden ayrıldı. Footer'daki çift H2 bir kod hatası değil **bozuk içerikti** (ilk H2 byline paragrafına yapışmış) — Supabase'de düzeltildi (artık 1×). |

---

## Faz 1 — Kararları ver (#1)

Ticaret motorunu açmak için **3 anahtar karar** kritik. Öncelik sırası:

> **Durum (2026-06-26):** D1, D3, D4 verildi (aşağıda ✅). Öncelik-1 ticaret ana hattının kararları kapandı.
> **Durum (2026-07-02):** Yönetici onayı geldi (Mike + Jamie, pricing önerisi onaylandı). Saf pricing modülü finalize edildi: 2 defansif düzeltme (`748ba42` — yüzde-kod 0–100 klempi, add-on dedupe) + 44 testlik kapsamlı suite (`edacdca` — tier/cap/floor/private/dedupe + 405 noktalık invariant grid); **#5 ve #22 kapatıldı** (#22 başlığı D3 gereği CAD→USD floor olarak düzeltildi). Bayat kalmış **#20/#21 de kapatıldı** (iş 2026-06-26'da `be6209c`/`8ec148c` ile bitmişti). Commerce hattı (S1/#16 → … → #26) artık açık. Mike D2'nin politika yarısını da cevapladı (aşağıda); HST-eyaleti sorusu #1'de Mike'a yöneltildi. Jamie'nin yeni isteği: fiyat hesaplayıcı "start new project" akışının başlangıcı olsun **ve ana sayfada interaktif widget olarak dursun** (bugünkü statik "Start Your Project" CTA'sı yerine; welcome indirimini canlı gösterir) — **[#30](https://github.com/novaspatial/nova/issues/30) (S20)** olarak issue'laştırıldı; S1(#16) ile aynı quote bileşenini paylaşmalı.

### Öncelik 1 — ticaret ana hattı (en çok issue'yu açar)
| Karar | Soru özeti | Açtığı issue'lar |
|-------|-----------|------------------|
| **D1** ✅ | **Karar: sipariş verisi `projects` satırında kalır** (mevcut kod + 20260422 migration'ı zaten böyle; 1 sipariş = 1 proje). Stripe Elements/PaymentIntent devam. | #4, #16, #17, #19, #23, #27 |
| **D3** ✅ | **Karar: liste fiyatları USD; floor $225 doğrudan USD charge biriminde** (sabit kur gömme gereği yok). Stripe bugün zaten USD çekiyor. Apple/Google Pay cüzdanları S1'de ayrı alt-karar. | #16, #22 (+#5 şekli) |
| **D4** ✅ | **Karar (per-song):** liste $325/şarkı; bulk 3–4 %15 / 5–7 %20 / 8+ %25; tek kod (private ise bulk'ı bastırır); %35 cap **yalnız yüzde-yığınına**; floor **$225 USD/şarkı × şarkı sayısı**; sabit kod **yalnız floor ile sınırlı** (cap dışı); add-on'lar **indirimden sonra, cap/floor dışı**; integer cent, yarı-yukarı. Not: $225 USD floor %30.8'de bağladığından %35 cap pratikte ısırmaz (ikincil güvenlik). | #18, #22, #19 (+#5 şekli) |

### Öncelik 2 — ticaret detayları
| Karar | Konu | Açtığı |
|-------|------|--------|
| **D2** 🟡 | Vergi — **politika kararı verildi (2026-07-02, Mike):** Kanadalı müşterilere **GST** uygulanacak, **PST yok**; hesaplama mekanizması (Stripe Tax vs kendi hesabımız) bize bırakıldı. **Hâlâ açık:** mekanizma seçimi + verginin nerede gösterileceği (quote/PaymentStep/makbuz) + HST eyaletleri sorusu (ON/NS vb. GST+PST'yi HST olarak birleştirir — "GST var PST yok" oralarda %5 mi tam HST mi, netleştirilmeli). | #16, #24 |
| **D5** | "Returning" tanımı (ödenmiş mi / teslim edilmiş mi proje) | #25 |
| **D6** | Tek-kullanımlık kod ne zaman tüketilir | #26 |

### Öncelik 3 — blog/SEO
| Karar | Konu | Açtığı |
|-------|------|--------|
| **D10** ✅ | **Karar: apex (çıplak alan) `https://nova-spatial.com`** — proje + e-posta alanıyla hizalı; www → apex redirect altyapı işi. Tek kaynak `src/lib/site.ts` (`SITE_URL`, env `NEXT_PUBLIC_SITE_URL` + fallback). | #6, #20, #14, #15 |
| **D8** ✅ | **Karar: ilk inline görsel** — per-post OG/hero, mevcut `extractHeroImage` ile gövdedeki ilk markdown görselinden türetilir; görseli olmayan post site varsayılanına (`/og-image.jpg`) düşer. Kolon/migration yok; OG == sayfadaki hero (`resolvePostOgImage`, `src/lib/blog/metadata.ts`). İleride kolon istenirse resolver'ın fallback zincirine eklenir (yeniden iş yok). | #20, #21 |
| **D9** ✅ | **Karar: `next/og` `ImageResponse`, Node runtime** — #21 (S13) tüketicisi; bu turda implemente edilmedi, sadece kararı kaydedildi. Next 15 yerleşik (yeni bağımlılık yok); Node runtime markalı fontu diskten okur. **Uyarı:** satori statik-ağırlık font ister — değişken `src/fonts/Mona-Sans.var.woff2` #21'de statik export ya da fallback yüz gerektirir. | #21 |

### Öncelik 4 — kalan
| Karar | Konu | Açtığı |
|-------|------|--------|
| **D7** | Purge zamanlama altyapısı (Vercel Cron / Action / Supabase) | #27 |
| **D7b** | Purge semantiği (tombstone mu hard-delete mi) | #27 |
| **D13** | Inbox sağlayıcı + gönderim subdomain'i | #24 |
| **D11** | Welcome kod yüzdesi (%10 vs %15) + şimdi mi uygulanır | #9 |
| **D-refund** | Para-iade mekanizması (uygulama içi mi, manuel mi) | — (yeni slice veya dışlama) |
| **D12** | Nova Studios mimarisi (ayrı deploy / çok-kiracılı / route group) | — (tüm Part B) |

---

## Faz 2 — Karara bağlı prefactorlar

Kararlar gelince:

- [#4](https://github.com/novaspatial/nova/issues/4) **P1** `Project` tipini senkronla — ✅ **Tamam (2026-06-26)**. D1 kararıyla alanlar `Project`'e kondu: 20260422 ödeme kolonları (required) + sipariş/yaşam-döngüsü yüzeyi (optional+nullable: `song_count`, `stem_count`, `service`, `add_ons`, `subtotal_cents`, `tax_cents`, `applied_coupon_code`, `terms_accepted_at/version`, `delivered_at`, `files_purged_at`) + `DiscountCode` ve `PriceBreakdown` tipleri. build + 344 vitest temiz.
- [#5](https://github.com/novaspatial/nova/issues/5) **P2** Saf fiyatlandırma modülü — ✅ **Tamam (2026-07-02, yönetici onayıyla finalize)**. `computeOrderPrice(OrderInput): PriceBreakdown` `src/lib/stripe/pricing.ts`'te (per-song liste, bulk tier, tek public/private kod percent+fixed, %35 cap, $225 USD per-song floor, add-on'lar); taslak `ed6d575` ile zaten main'deydi, finalizasyonda 2 defansif düzeltme eklendi (yüzde kod 0–100'e klemplenir — negatif kod fiyatı liste üstüne şişiremez; add-on'lar dedupe edilir — duplicate çift ücretlenmez) + 44 testlik suite (bulk tier sınırları, percent/fixed kod, cap/floor, private bastırma, add-on dedupe, defansif kenarlar, 405 noktalık invariant grid). lint + 461 vitest + tsc-baseline temiz. S4a(#22) matematiğini de kapsar. _(Güncelleme: S1 ile checkout'a bağlandı; eski `computePrice` `3c46ef8` ile kaldırıldı.)_
- [#6](https://github.com/novaspatial/nova/issues/6) **P3** Site-origin + publish hook — ✅ **Tamam (2026-06-26)** (`cf283fb`). D10 apex kararıyla tek kaynak `src/lib/site.ts` (`SITE_URL`/`SITE_NAME`/`absoluteUrl`, `NEXT_PUBLIC_SITE_URL` env + fallback); `layout.tsx` hardcoded `www` → bu kaynaktan okuyor. Blog publish yan-etkileri tek `onPostMutated({type,slug,isPublished})` hook'unda toplandı (POST + PATCH/[id] + DELETE paylaşıyor; duplike `revalidatePath` + lokal `revalidateBlog` kaldırıldı) — draft-create yalnız `/blog`'u, update/delete post sayfasını da bust ediyor (mevcut testler korunuyor). IndexNow(#15) buraya sıfır route değişikliğiyle bağlanacak. build + lint temiz; 41 route+yeni test geçiyor. #14/#15 artık açık.

---

## Faz 3 — Paralel hatlar

### Hat A — Ticaret (kritik yol, sıkı sıralı)

```
P1(#4) + P2(#5)
        └─> S1(#16)  ── quote + sipariş formu + checkout
                ├─> S2(#18)  bulk auto-indirim
                ├─> S6(#19)  add-on'lar (extra revision, rush)
                ├─> S3(#17)  discount_codes tablosu + admin CRUD
                ├─> S7(#23)  T&C sayfası + onay checkbox   (ayrıca P4)
                └─> S8(#24)  sipariş onay e-postası          (ayrıca P3)
        S2 + P2 ─> S4a(#22) saf fiyat matematiği (cap/floor/stack)
        S4a + S3 ─> S4b(#25) kodu checkout'a bağla
                └─> S5(#26)  tek-kullanımlık kod tüketimi
```

**Önerilen sıra:** #16 → (#18, #19, #17 paralel) → #22 → #25 → #26; #23 ve #24, #16 biter bitmez araya alınabilir.

> **Durum (2026-07-02):** **S1 (#16) ✅ Tamam** (`60bee5d` + `3c46ef8` + `46d08ea` + `5492226`) — migration `20260702_add_order_fields` (song_count/stem_count/subtotal_cents/reference_tracks, remote'ta canlı), sipariş formu (servis seçici, şarkı sayısı, referans parçalar, canlı quote), checkout `computeOrderPrice`'a bağlandı (first-mix = private %50 kod, floor'la $225/şarkı), PaymentStep kalem kalem breakdown. Stem-upload mutabakatı: dosyalar ödeme ÖNCESİ seçilir, ödeme onayı SONRASI yüklenir (402 status kapısı sunucuda da zorlar); `stem_count` seçilen dosyalardan türetilir. Redirect'li ödeme yöntemleri kapalı (in-memory dosya listesi kaybolmasın). **S2 (#18) ✅** aynı slice'la uçtan uca teslim (tier testleri + quote/PaymentStep "Album discount" satırı + charge/persist). Ek: legacy `computePrice` kaldırıldı; ödemesiz `POST /api/portal/projects` endpoint'i kaldırıldı (paywall bypass'ıydı); `20260702_harden_order_writes` — first-mix RPC'lerine kimlik guard'ı + tüketilmiş-indirim ön koşulu, sipariş/para kolonlarını client'a donduran trigger (webhook/service etkilenmez). 28-ajanlık çekişmeli review: 23 bulgu doğrulandı ve giderildi/kaydedildi. 477 test + lint + tsc + build temiz.

### Hat B — Blog / SEO

```
P3(#6) ─┬─> S14(#14)  sitemap + robots
        └─> S15(#15)  IndexNow ping
S11(#10) ─> S12(#20)  per-post meta + JSON-LD + alt + slug   (ayrıca P3, D8)
              ├─> S13(#21)  otomatik share-image            (D9)
              └─> S19(#29)  LLM/GEO görünürlük (schema + llms.txt + AI-crawler)
```

- [#14](https://github.com/novaspatial/nova/issues/14) **S14** sitemap + robots — ✅ **Tamam (2026-06-26)** (`bf710fe`). `src/app/sitemap.ts` (pazarlama sayfaları + `loadPublishedPosts` ile yayınlanmış postlar, `updated_at` lastmod, `absoluteUrl`) ve `src/app/robots.ts` (non-public yüzeyi disallow, sitemap'i gösterir). robots statik, sitemap dinamik (publish'te taze); draft sızmaz.
- [#15](https://github.com/novaspatial/nova/issues/15) **S15** IndexNow ping — ✅ **Tamam (2026-06-26)** (`02d3d02`). `onPostMutated` hook'una bağlı best-effort `pingIndexNow`; `PostMutation`'a `wasPublished` eklendi → publish / canlı-düzenleme / takedown'da ping, hiç-public-olmamış draft'ta yok. Anahtar `/indexnow-key.txt`'te env'den (tek kaynak). Bing/Yandex/Seznam/Naver/Yep'i kapsar (Google katılmaz → robots+sitemap). `INDEXNOW_KEY` set edilene kadar atıl.
- [#20](https://github.com/novaspatial/nova/issues/20) **S12** per-post SEO meta + JSON-LD + alt + slug — ✅ **Tamam (2026-06-26)** (`be6209c`). **D8/D9 verildi** (D8: ilk inline görsel, D10 zaten kapalıydı). `buildPostMetadata`/`buildPostJsonLd` (`src/lib/blog/metadata.ts`): canonical + article OG + Twitter kartı + `BlogPosting` JSON-LD; `rehype-slug` ile temiz başlık anchor'ları (sanitize `clobber`'dan `id` çıkarıldı); admin route'larında slug + alt-metin doğrulaması (400). OG görseli ilk inline görsel, yoksa `/og-image.jpg`.
- [#21](https://github.com/novaspatial/nova/issues/21) **S13** otomatik share-image — ✅ **Tamam (2026-06-26)** (`8ec148c`). `next/og` `ImageResponse` Node-runtime route'u (`src/app/blog/[slug]/share-image`): post başlığı marka fontunda hero görselin üstünde, koyu gradient scrim + "NOVA Spatial" wordmark + yazar byline'ı. `buildPostMetadata` og/twitter görselini bu route'a bağlar (`postShareImageUrl`); `BlogPosting` JSON-LD gerçek hero'da kalır. **Font:** satori değişken woff2'yi kullanamaz → statik **Mona-Sans Expanded SemiBold** (OFL) commit edildi, diskten `import.meta.url` ile okunur (Noto fallback sayesinde font yüklenemezse 500 yok). **webp/avif koruması:** hero kontrollü fetch'le çekilir, yalnız jpeg/png data-URI olarak gömülür, aksi halde marka gradient'ine düşülür. `outputFileTracingIncludes` fontu Vercel bundle'ına taşır. Co-located testler + canlı doğrulama (1200×630 PNG, og/twitter `share-image`'e işaret ediyor, bilinmeyen slug → 404).
- [#29](https://github.com/novaspatial/nova/issues/29) **S19** LLM/AI-arama görünürlüğü (GEO) — #20 üstüne: ana sayfada `Organization`+`WebSite`, yazar `Person`+`sameAs`, `BreadcrumbList`, uygun yazılarda `FAQPage`; `/llms.txt`; robots'ta AI-crawler erişimini belgele (GPTBot/ClaudeBot/PerplexityBot/Google-Extended bloklanmıyor). **needs-info:** `sameAs` sosyal/profil URL'leri. İçerik tarafı (soru-formatlı başlık + özet-cevap) editör işi.

### Hat C — Pazarlama
- [#9](https://github.com/novaspatial/nova/issues/9) **S10** 50% promo → welcome kod — **D11 sonrası**, küçük (copy + sabit).

### Hat D — Yaşam döngüsü
- [#12](https://github.com/novaspatial/nova/issues/12) **S16** — Faz 0'da bitti (güvenlik).
- [#27](https://github.com/novaspatial/nova/issues/27) **S18** delivered_at + 90-gün purge — P1 + P5 + (D7, D7b).
- [#13](https://github.com/novaspatial/nova/issues/13) **S17** admin dosya indirme — bağımsız; indirme mekanizması (signed-URL) kararı sonrası.

### Hat E — Nova Studios (Part B)
**D12'ye kadar başlamaz.** Marka soyutlama, palet token'ları, route seam, içerik portu, DNS/redirect — hepsi karar bekliyor. Şimdilik dışlandı; karar verilince ayrı bir `/to-issues` turu.

---

## Kritik yol

```
D1 ─> P1(#4) ─> S1(#16) ─> S2(#18) ─> S4a(#22) ─> S4b(#25) ─> S5(#26)
```

6 issue derinliğinde. `S3(#17)` paralel ilerleyip `S4b`'yi besler. Bu zincir projenin en uzun bağımlılığı — D1/D3/D4 ne kadar erken kapanırsa o kadar erken akar.
_(Durum 2026-07-04: zincirin S4b(#25) → S5(#26) dışındaki tamamı ✅ — kalan iki halka D5/D6 kararlarına bakıyor.)_

---

## Kalan yol (2026-07-04 — 11 açık issue)

### Hemen yapılabilir (karar gerektirmez)

1. **[#19](https://github.com/novaspatial/nova/issues/19) S6 — Add-on'lar (extra revision + 48h rush).** Matematik modülde hazır ve testli (`ADD_ON_CENTS`, indirim sonrası, cap/floor dışı); iş: form checkbox'ları + checkout'a `addOns` + `add_ons` kolonu + PaymentStep satırı. S1 yüzeyinin doğal uzantısı.
2. **[#23](https://github.com/novaspatial/nova/issues/23) S7 — T&C sayfası + onay checkbox'ı.** P4'ün Checkbox primitifi + Footer seam'i hazır; sayfa + zorunlu checkbox + `terms_accepted_at/version` kaydı bizde, metin Jamie'de (sonradan düşer). Para-iade cümlesi **D-refund**'a dokunur — Jamie'ye hatırlat.
3. **(Paralel) Karar paketi Mike/Jamie'ye** — kalan her şeyin kilidi, tek seferde sorulmalı: **D5** (returning = ödenmiş mi teslim edilmiş mi), **D6** (tek-kullanımlık kod tüketimi — öneri: mevcut reserve/restore deseni), **D11** (welcome %10 vs %15), **D2-HST** (Ontario'da %5 GST mi tam HST mi — #1'de soruldu, hatırlat), **D13** (inbox + gönderim subdomain'i).

### Karar geldikçe (kritik yolun kalanı)

4. **[#25](https://github.com/novaspatial/nova/issues/25) S4b — kod redemption'ı checkout'a bağla** ← D5. Tablo (#17) + modül hazır; iş: formda kod alanı, sunucuda eligibility (aktif/expired/kitle/limit), `applied_coupon_code` persist, charge.
5. **[#26](https://github.com/novaspatial/nova/issues/26) S5 — tek-kullanımlık kod tüketimi** ← D6 + #25. Sertleştirilmiş first-mix RPC desenini kopyala.
6. **[#9](https://github.com/novaspatial/nova/issues/9) S10 — %50 promo → welcome kopyası** ← D11. **Araya sokulmalı:** canlı "50% off" vaadi ile floor'lu gerçek indirim (~%31) şu an çelişiyor.
7. **[#30](https://github.com/novaspatial/nova/issues/30) S20 — ana sayfa fiyat hesaplayıcısı** ← D11. S1 quote mantığını paylaşan client bileşen; #9 ile aynı tura girebilir (ikisi de pazarlama yüzeyi).
8. **[#24](https://github.com/novaspatial/nova/issues/24) S8 — sipariş onay e-postası** ← D2 (makbuzda vergi) + D13 (gönderici). D13 gecikirse mevcut tek sender'la vergisiz makbuz olarak çıkabilir.

### Bağımsız kuyruk

9. **[#13](https://github.com/novaspatial/nova/issues/13) S17 — admin dosya indirme.** Karara bağlı değil; signed-URL altyapısı hazır, araya her an alınabilir.
10. **[#27](https://github.com/novaspatial/nova/issues/27) S18 — delivered_at + 90 gün purge** ← D7 (infra; öneri Vercel Cron) + D7b (tombstone vs hard-delete). `projectCleanup.ts` (#3) yeniden kullanılır.
11. **[#29](https://github.com/novaspatial/nova/issues/29) S19 — GEO/LLM görünürlüğü** ← `sameAs` URL'leri (needs-info); gelince yarım günlük iş.
12. **D12 → Nova Studios (Part B).** Mimari karar verilmeden dilim açılmaz; karar gelince ayrı `/to-issues` turu.

**Özet akış:** #19 → #23 (bloksuz) + karar paketi paralel gönderilir; D5/D6 → #25 → #26; D11 → #9 + #30; D2/D13 → #24; kuyruk fırsat buldukça.

---

## Önerilen lineer sıra (tek ajan/kişi sırayla giderse)

1. **#12** (güvenlik) ✅
2. **#2, #3** (prefactor) ✅
3. **#8** ✅; **#7** ✅; **#10, #11** (hızlı kazanımlar) ✅
4. **Kararlar:** D1 ✅, D3 ✅, D4 ✅; D2, D5, D6 (kalan)
5. **#4 (P1)** ✅; **#5 (P2) + #22 (S4a) saf matematiği** ✅ (2026-07-02, onay geldi, finalize edildi)
6. **#16 (S1)** ✅ (2026-07-02, `60bee5d`)
7. **#18** ✅ (S1 ile teslim); **#17** ✅ (2026-07-04, `daf4748` — discount_codes tablosu + studio-only RLS + `/blog/admin/discount-codes` CRUD; S4b'ye kadar client-inert); **#19** (sırada)
8. **#22 (S4a)** ✅ (#5 modülüyle kapandı)
9. **#25 (S4b) → #26 (S5)**
10. **#23 (S7)**
11. **Karar D10 ✅ → #6 (P3)** ✅
12. **#14 ✅, #15 ✅** (sitemap, IndexNow)
13. **Karar D8/D9 ✅ (2026-06-26) → #20 (S12) ✅ Tamam (`be6209c`) → #21 (S13) ✅ Tamam (`8ec148c`) → #29 (S19, GEO/LLM görünürlük) sırada**
14. **Karar D2/D13 → #24 (S8)**
15. **Karar D11 → #9 (S10)**
16. **Karar D7/D7b → #27 (S18)**
17. **#13 (S17)**
18. **Karar D12 → Nova Studios (ayrı planlama)**

---

## Definition of Done (her issue için)

- **RLS-first:** şema değişen her slice'ta Postgres RLS politikası + `src/types/portal.ts` tipleri **birlikte** güncellenir (CLAUDE.md kuralı).
- **Testler co-located:** `*.test.ts(x)`; `npm run lint` + `npx vitest run` temiz geçmeli.
- **Migration adı:** `YYYYMMDD_description.sql`; CI migration çalıştırmaz, Supabase CLI/MCP ile uygulanır.
- **Supabase client seçimi:** kullanıcıya bağlı işte server client (RLS uygulansın), webhook gibi oturumsuz yerde service-role.
- **Para asla loglanmaz; kişisel e-posta kullanılmaz** (`noreply@nova-spatial.com`).

---

## Tam issue dizini

| id | issue | etiket | başlık |
|----|-------|--------|--------|
| — | [#1](https://github.com/novaspatial/nova/issues/1) | needs-info | Open decisions (D1–D13) |
| P1 | [#4](https://github.com/novaspatial/nova/issues/4) | ready-for-human | Sync Project type with payment + order fields |
| P2 | [#5](https://github.com/novaspatial/nova/issues/5) | ready-for-human | Pure order-pricing module |
| P3 | [#6](https://github.com/novaspatial/nova/issues/6) | ready-for-human | Site-origin constant + on-publish hook |
| P4 | [#2](https://github.com/novaspatial/nova/issues/2) | ready-for-agent | Checkbox primitive + Footer seam |
| P5 | [#3](https://github.com/novaspatial/nova/issues/3) | ready-for-agent | Project storage-cleanup library |
| S1 | [#16](https://github.com/novaspatial/nova/issues/16) | ready-for-human | Per-song list-price quote + checkout |
| S2 | [#18](https://github.com/novaspatial/nova/issues/18) | ready-for-human | Album/EP bulk auto-discount |
| S3 | [#17](https://github.com/novaspatial/nova/issues/17) | ready-for-human | Discount-codes table + admin CRUD |
| S4a | [#22](https://github.com/novaspatial/nova/issues/22) | ready-for-human | Pricing math: cap/floor/stacking |
| S4b | [#25](https://github.com/novaspatial/nova/issues/25) | ready-for-human | Wire code redemption at checkout |
| S5 | [#26](https://github.com/novaspatial/nova/issues/26) | ready-for-human | Single-use private code consumption |
| S6 | [#19](https://github.com/novaspatial/nova/issues/19) | ready-for-human | Add-ons: extra revision + 48h rush |
| S7 | [#23](https://github.com/novaspatial/nova/issues/23) | ready-for-human | T&C page + agree-checkbox |
| S8 | [#24](https://github.com/novaspatial/nova/issues/24) | ready-for-human | Order-confirmation email |
| S9 | [#7](https://github.com/novaspatial/nova/issues/7) | ready-for-agent | Motion + reduced-motion pass |
| S9b | [#8](https://github.com/novaspatial/nova/issues/8) | ready-for-agent | Contrast + hero credentials |
| S10 | [#9](https://github.com/novaspatial/nova/issues/9) | ready-for-human | Replace 50% promo with welcome code |
| S11 | [#10](https://github.com/novaspatial/nova/issues/10) | ready-for-agent | Blog readability polish |
| S11b | [#11](https://github.com/novaspatial/nova/issues/11) | ready-for-agent | Blog structural bug fixes |
| S12 | [#20](https://github.com/novaspatial/nova/issues/20) | ready-for-human | Per-post SEO meta + JSON-LD |
| S13 | [#21](https://github.com/novaspatial/nova/issues/21) | ready-for-human | Auto-generated share image |
| S14 | [#14](https://github.com/novaspatial/nova/issues/14) | ready-for-human | Sitemap + robots |
| S15 | [#15](https://github.com/novaspatial/nova/issues/15) | ready-for-human | IndexNow ping |
| S16 | [#12](https://github.com/novaspatial/nova/issues/12) | ready-for-agent | Archive RLS hardening |
| S17 | [#13](https://github.com/novaspatial/nova/issues/13) | ready-for-human | Admin file download |
| S18 | [#27](https://github.com/novaspatial/nova/issues/27) | ready-for-human | delivered_at + 90-day purge |
| S19 | [#29](https://github.com/novaspatial/nova/issues/29) | ready-for-human | LLM/AI-search visibility (GEO): site+author schema, llms.txt, AI-crawler access |
| S20 | [#30](https://github.com/novaspatial/nova/issues/30) | ready-for-human | Interactive price calculator on the homepage + entry to the new-project flow |

---

## Build edilmeyen (bilerek)

- **T&C metni** — Jamie yazıyor (#23 sadece sayfa + checkbox + kayıt yapar).
- **DNS / SPF / DKIM / DMARC, inbox satın alma** — saf ops, repo'da artefakt yok.
- **Nova Studios portu** — D12 mimari kararına takılı (içerik, marka, redirect).
- **Para-iade mekanizması** — D-refund'a bağlı (uygulama içi olursa yeni slice).
- **Part C lojistik** (önceliklendirme, takvim) — proje yönetimi, kod değil.

_Bu plan `devplan-to-slices` workflow'unun çıktısından üretildi (8 alt-sistem haritası → taslak → çekişmeli kritik → revizyon)._
