# Roadmap AGB LightGBM

Dokumen ini adalah kontrak keputusan implementasi AGB mangrove. Implementasi
dilakukan bertahap; perubahan Fase 2 menyiapkan registry dan API job, bukan
worker raster.

## Tujuan

- Semua estimasi AGB pada raster, statistik, titik sampel, dan CSV bersumber
  dari `best_mangrove_agb_model.joblib` LightGBM, bukan formula GEE linear atau
  empiris.
- Analisis panjang dikerjakan melalui job persisten di database dan worker
  terpisah; hanya satu job berjalan pada satu waktu.
- Raster selesai dipublikasikan secara permanen ke api-geoserver.

## Kontrak data dan fitur yang disepakati

- Registry aktif: `backend-fastapi/config/model_registry.json`.
- Model beta saat ini: `backend-fastapi/model/best_mangrove_agb_model.joblib`;
  path, version/status, urutan fitur, dan preprocessing dibaca dari registry.
- Urutan fitur model saat ini: `VV`, `VH`, `NDVI`; kontrak tersebut berversi
  bersama model dan bukan konstanta global lintas versi.
- Sentinel-2: `COPERNICUS/S2_SR_HARMONIZED`; mask QA60 cloud bit 10 dan
  cirrus bit 11; metadata cloud `< 20%`; median; NDVI dari B8/B4.
- Sentinel-1: `COPERNICUS/S1_GRD`, IW, VV dan VH; median tanpa filter orbit dan
  tanpa speckle filter. Nilai koleksi ini digunakan pada skala dB.
- Jendela fitur tetap mengikuti data training: 1–31 Maret 2026. Untuk filter
  Earth Engine yang eksklusif pada tanggal akhir, gunakan
  `2026-03-01` sampai `2026-04-01`.
- Grid raster: 10 m, EPSG:32647.
- Piksel valid harus finite, NDVI >= 0.3, VH >= -22 dB, dan berada di dalam
  masker mangrove. Prediksi negatif dipotong menjadi nol. Piksel tidak valid
  atau di luar masker ditulis sebagai nodata `-9999`.
- Shapefile sumber masker: `backend-fastapi/model/LU_mangrove_forest_61.*`;
  worker kelak memuatnya serta memperbaiki geometri satu kali saat startup,
  lalu menerapkan mask dengan `updateMask()` di GEE.
- AGB memakai style GeoServer dengan rentang beta 0–4000. Nilai maksimum
  target training yang tercatat adalah 3869.2414248864784.
- Satuan target telah ditetapkan sebagai **kg per piksel 10x10 m**. Jangan
  tampilkan konversi ton/ha atau total biomassa AOI sebelum status beta dicabut.
- Rentang fitur untuk pemeriksaan extrapolation dibaca dari
  `backend-fastapi/model/final_ml_ready.csv`, bukan diduplikasi sebagai angka
  literal dalam kode.

## Rencana fase

### Fase 1 — fondasi model dan fitur (selesai)

- Satukan konstanta kontrak fitur, validasi piksel, path model, dan rentang
  fitur training.
- Model wajib dimuat dari artefak; jika tidak tersedia/gagal, gagal secara
  eksplisit. Dilarang fallback ke rumus AGB.
- Bangun komposit fitur GEE sesuai koleksi, mask, median, urutan band, tanggal,
  proyeksi, skala, dan ambang validitas yang disepakati.
- Endpoint AGB sinkron/formula lama dialihkan ke endpoint job agar tidak
  menyajikan hasil AGB yang salah.
- Jangan implementasikan antrean, worker, tiling, notifikasi, atau publikasi
  permanen pada fase ini.

### Fase 2 — schema database, model beta, dan kontrak API job (cakupan pekerjaan saat ini)

- Buat tabel `analysis_jobs` dan `notifications` melalui migrasi bernomor
  `0004`.
- Endpoint job terautentikasi untuk submit, polling status, pembatalan, dan
  daftar notifikasi; validasi payload GeoJSON secara ketat.
- AOI dibatasi berdasarkan jumlah tile, bukan luas hektare.
- Sertakan peringatan saat tanggal permintaan di luar bulan training.
- Perluas path cookie sesi ke `/api` agar `/api/analysis` membawa autentikasi;
  mekanisme autentikasi lainnya tidak diubah.
- Snapshot `model_version`, `model_status`, unit, dan disclaimer pada job/API;
  UI, notifikasi/email, CSV, dan metadata layer menandai status beta.
- Jangan tampilkan R²/RMSE sebagai akurasi. Fase ini tidak membangun worker
  raster; job tetap queued sampai Fase 3.
- Registry `backend-fastapi/config/model_registry.json` menyimpan path artefak,
  versi/status, daftar fitur berurutan, preprocessing, unit, display range,
  disclaimer, metadata layer, dan batas AOI berbasis tile.
- Unit yang dipakai di produk: `kg per piksel 10x10 m`. Hindari mean/total AGB
  area atau konversi ton/ha sebelum validasi ground truth.

### Fase 3 — worker dan pemrosesan raster

Status: selesai. Worker mengambil raster fitur Sentinel sementara; produk
prediksi, masker, publikasi, dan unduhan dijelaskan pada Fase 4.

- Worker terpisah memproses paling banyak satu job dalam satu waktu.
- Feature provider memakai interface `FeatureTileProvider`; implementasi
  pertama mengunduh langsung per tile melalui `ee.data.computePixels`
  (high-volume endpoint), tanpa Drive atau GCS. Interface memungkinkan GCS
  ditambahkan kelak.
- Grid tetap EPSG:32647 pada 10 m; tile 1000 x 1000 piksel; paralelisme unduh
  maksimum 3, satu writer raster, dan buffer/tile dibuang setelah ditulis.
- Retry memakai exponential backoff. Kegagalan tile menggagalkan job—tidak
  boleh `except: continue`. Periksa flag pembatalan di antara tile.
- Jika GEE gagal karena memori, bagi tile menjadi empat sub-tile dan coba lagi.
- Hasil raster fitur Fase 3 disimpan sementara pada volume Docker
  `agb_analysis_results` dan dibuang setelah prediksi AGB berhasil.

### Fase 4 — publikasi, notifikasi, dan integrasi

Status: implementasi selesai; validasi runtime GEE/GeoServer produksi tetap perlu
dijalankan dengan kredensial dan layanan lingkungan deployment.

- Terapkan masker mangrove, prediksi model per piksel, nilai minimum nol, dan
  nodata `-9999`; laporkan jumlah piksel valid, rentang prediksi per piksel,
  serta extrapolation. Jangan tampilkan mean/total biomassa AOI atau konversi
  ton/ha.
- Publikasikan hasil secara permanen ke api-geoserver dengan nama layer
  `agb_{job_id}` dan style tetap 0–4000.
- Kirim notifikasi melalui polling status, tabel notifikasi, serta email SMTP.
- Uji integrasi GEE/GeoServer dan regresi agar tak ada jalur formula lama.

## Catatan validasi

- Belum ada ground truth lapangan independen. Model dan target saat ini hanya
  beta; jangan tafsirkan sebagai hasil ukur atau akurasi tervalidasi.

## Status model

- Status aktif: **BETA**, versi registry `0.1.0-beta`.
- Belum ada ground truth lapangan independen untuk fitting/validasi model.
- Asal target `AGB_Revised_kg`: statistik inventori provinsi, lalu distribusi
  ulang target berdasarkan peringkat skor indeks citra satelit. Target ini
  bukan pengukuran AGB ground truth per piksel.
- Satuan produk yang diputuskan untuk tampilan/metadata: **kg per piksel
  10x10 m**. Jangan jumlahkan menjadi total area atau konversi ke ton/ha sampai
  validasi lapangan disetujui.
- Disclaimer wajib untuk UI, API, email/notifikasi, CSV, dan layer GeoServer:
  > Versi beta: estimasi AGB ini belum divalidasi dengan data lapangan (ground
  > truth). Nilainya berbasis statistik inventori provinsi dan indeks citra
  > satelit, sehingga hanya cocok sebagai gambaran awal, bukan hasil
  > pengukuran.
- Jangan menampilkan R²/RMSE sebagai ukuran akurasi/validasi lapangan.
- Status beta hanya boleh dicabut setelah ada ground truth lapangan independen
  yang terdokumentasi, protokol split validasi spasial/independen yang disetujui,
  evaluasi metrik dan bias per wilayah yang ditinjau, serta persetujuan pemilik
  domain atas unit/interpretasi target. Simpan artefak, dataset evaluasi, hasil
  validasi, versi model, dan persetujuan bersama registry sebelum status diubah.

## Temuan audit aset awal

- Notebook `backend-fastapi/model/main.ipynb` dan skrip
  `backend-fastapi/model/train.py` tidak konsisten sepenuhnya dengan kontrak
  final: skrip mengacu pada XGBoost, memakai cloud `< 30%`, serta alur dan
  proyeksi ekspor yang berbeda. Kontrak final di atas adalah sumber kebenaran
  implementasi untuk pipeline produksi.
- `final_ml_ready.csv` memuat 491 baris; rentang yang diperiksa:
  - VV: -15.33793386584226 sampai -2.772087334045796
  - VH: -20.76420252175897 sampai -9.722586952187669
  - NDVI: 0.3228664626429888 sampai 0.9935483870529332
  - AGB_Revised_kg: 53.34225057039505 sampai 3869.2414248864784

## Status

- [x] Verifikasi root kerja dan root Git adalah repo yang diminta.
- [x] Fase 1 fondasi model dan fitur.
- [x] Fase 2 registry beta, migration/API, CSV, notifikasi/email, GeoServer
  metadata hook, dan UI beta diimplementasikan.
- [x] Backend pytest runtime worker lulus di image Docker (`16 passed` untuk suite
  terarah Fase 3 sebelum implementasi Fase 4).
- [x] Frontend production build lulus. Lint seluruh repo/berkas terarah tetap
  gagal oleh duplicate translation keys yang sudah ada, ditambah beberapa
  warning/error lint lama pada `GeeAnalysisModal.jsx`; API/Auth CSRF modules
  lulus lint terarah.
- [x] Fase 3 worker Docker terpisah, raster fitur sementara, progres, retry,
  dan pembatalan telah diimplementasikan.
- [x] Fase 4 implementasi inferensi AGB, masker mangrove, publikasi GeoServer,
  unduhan raster, statistik prediksi, serta email/notifikasi hasil.
- [ ] Uji end-to-end Fase 4 dengan Earth Engine dan GeoServer aktif belum dijalankan.