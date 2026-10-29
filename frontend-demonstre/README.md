# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Autentikasi SSO & Logout Terpusat

Aplikasi ini menggunakan Keycloak OpenID Connect (OIDC) berbasis Authorization Code Flow dengan PKCE (S256). Logout terpusat didukung secara otomatis melalui mekanisme OP Session Monitoring (`check_session_iframe`) dengan interval 2 detik, event listener OIDC (`addUserSignedOut`, `addSilentRenewError`, `addAccessTokenExpired`), interceptor respons HTTP 401 (dengan retry silent renewal satu kali), serta pengecekan saat tab kembali aktif (`visibilitychange`/`focus` dengan throttle 15 detik). Ketika sesi Keycloak diakhiri di aplikasi lain (misal VoxaGIS) atau di konsol admin Keycloak, sesi lokal Grovia akan dibersihkan tanpa memicu loop redirect. Batasan: Pada browser yang memblokir third-party cookies / iframe partition secara agresif, deteksi via iframe mungkin terhambat, namun sesi tetap dijamin keluar saat tab difokuskan kembali atau paling lambat saat masa berlaku token (5 menit) habis.

## Masuk Langsung via SSO (/sso/start)

Aplikasi menyediakan rute masuk langsung `/sso/start?returnTo=<path>` yang digunakan oleh portal SSO atau integrasi eksternal untuk mengarahkan pengguna langsung ke halaman tujuan (default `/dashboard`) tanpa harus melalui landing page atau mengklik tombol login secara manual. Parameter `returnTo` divalidasi secara ketat oleh `validateReturnTo`: harus berupa path relatif internal yang diawali satu `/`, dilarang menggunakan format protokol relatif `//`, tidak boleh memuat skema atau host eksternal (`http:`, `https:`, `javascript:`, `data:`), dan dilarang mengarah kembali ke `/sso/start`. Jika `returnTo` tidak valid atau kosong, tujuan otomatis dialihkan ke path default `/dashboard`. Jika pengguna sudah memiliki sesi lokal aktif, navigasi langsung dilakukan tanpa menghubungi Keycloak; jika belum, proses `signinRedirect` dijalankan dengan membawa state `returnTo` yang akan dieksekusi setelah callback OIDC selesai.

