# ICTC — Sistem Tugas & Portofolio

Website manajemen tugas untuk ICTC (Program, Desain, Multimedia) di SMAN 1 Taman.
Anggota mengumpulkan tugas dan melihat progresnya, ketua/admin membuat tugas dan
memberi nilai + feedback. Dibangun dengan HTML/CSS/JavaScript murni + Firebase
(Authentication, Firestore, Storage) — tanpa server/backend sendiri.

## Struktur file

```
index.html              Login (anggota & admin, role otomatis terbaca)
register.html            Daftar akun anggota baru
dashboard-anggota.html   Dashboard anggota: daftar tugas & status
submit-tugas.html        Form pengumpulan / kirim ulang tugas
portfolio.html           Portofolio (tugas yang sudah diterima)
dashboard-admin.html     Dashboard admin: progres, filter, tabel, review
kelola-tugas.html        Admin: buat / edit / hapus tugas
css/style.css             Semua styling
js/firebase-config.js     ⚠️ Isi kredensial Firebase kamu di sini
js/auth-guard.js          Helper bersama (cek login, status, toast, dll)
js/*.js                   Logika tiap halaman
```

## 1. Setup Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → beri nama (misal `ictc-tugas`).
2. **Authentication** → tab *Sign-in method* → aktifkan **Email/Password**.
3. **Firestore Database** → *Create database* → mode **production**.
4. **Storage** → *Get started* → mode **production**.
5. Di halaman utama project, klik ikon **`</>`** (Web app) → daftarkan app → Firebase akan menampilkan objek `firebaseConfig`.
6. Salin nilai-nilainya ke `js/firebase-config.js`, ganti semua `"GANTI_..."`.

## 2. Pasang Security Rules

**Firestore Rules** (tab *Rules* di Firestore Database):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isLoggedIn() { return request.auth != null; }
    function isAdmin() {
      return isLoggedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{userId} {
      allow read: if isLoggedIn();
      allow create: if isLoggedIn() && request.auth.uid == userId;
      allow update: if isLoggedIn() && (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }

    match /tugas/{tugasId} {
      allow read: if isLoggedIn();
      allow write: if isAdmin();
    }

    match /submissions/{submissionId} {
      allow read: if isLoggedIn() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isLoggedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isLoggedIn() && (
        isAdmin() ||
        (resource.data.userId == request.auth.uid &&
         request.resource.data.nilai == resource.data.nilai &&
         request.resource.data.feedback == resource.data.feedback &&
         request.resource.data.status != 'diterima')
      );
      allow delete: if isAdmin();
    }
  }
}
```

Aturan di atas mencegah anggota mengubah nilai/feedback miliknya sendiri atau
menandai tugasnya "diterima" sendiri — hanya admin yang bisa.

**Storage Rules** (tab *Rules* di Storage):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /submissions/{uid}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid
                   && request.resource.size < 25 * 1024 * 1024;
    }
    match /tugas-referensi/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 25 * 1024 * 1024;
    }
  }
}
```

Catatan: rule di atas mengizinkan siapa saja yang login untuk upload file
referensi tugas (bukan hanya admin) — cukup aman karena tidak ada tombol untuk
itu di halaman anggota, tapi kalau mau dikunci penuh ke admin saja, cari
"Firebase Storage rules cross-service Firestore access" di dokumentasi Firebase.

## 3. Buat akun admin/ketua pertama

Tidak ada form pendaftaran khusus admin (supaya orang luar tidak bisa daftar
jadi admin sendiri). Caranya manual:

1. Daftar akun biasa lewat `register.html` (divisi bebas, nanti bisa diabaikan).
2. Buka **Firestore Database** → koleksi `users` → cari dokumen dengan UID akun
   tadi (lihat UID-nya di tab *Authentication*).
3. Ubah field `role` dari `"anggota"` menjadi `"admin"`.
4. Logout lalu login lagi — akan otomatis masuk ke `dashboard-admin.html`.

## 4. Struktur data Firestore

**`users/{uid}`** — `nama`, `email`, `divisi`, `role` (`"anggota"` / `"admin"`)

**`tugas/{id}`** — `judul`, `deskripsi`, `divisi` (array, misal `["Desain"]`),
`deadline` (Timestamp), `instruksi`, `bobot`, `fileReferensiURL` (opsional)

**`submissions/{tugasId_uid}`** — `tugasId`, `userId`, `userNama`, `userDivisi`,
`deskripsi`, `fileURL`, `driveLink`, `status` (`"terkumpul"` / `"revisi"` /
`"diterima"`), `nilai`, `feedback`, `submittedAt`, `reviewedAt`

ID submission sengaja dibuat `{tugasId}_{uid}` (bukan random) supaya satu
anggota hanya punya satu submission per tugas — kirim ulang otomatis menimpa
yang lama, bukan bikin dokumen baru.

## 5. Menjalankan di komputer sendiri

Karena semua file JS pakai `import`/`export` (ES modules), tidak bisa dibuka
langsung lewat `file://` — harus lewat server lokal. Paling gampang, dari
folder ini jalankan salah satu:

```
npx serve .
# atau
python -m http.server 5500
```

lalu buka `http://localhost:...` di browser.

## 6. Deploy

**GitHub Pages** — push folder ini ke repo GitHub → *Settings → Pages* → pilih
branch `main` dan folder root → situs aktif di `namakamu.github.io/nama-repo`.

**Firebase Hosting** —
```
npm install -g firebase-tools
firebase login
firebase init hosting   # pilih folder ini sebagai public directory
firebase deploy
```

## Beberapa hal yang disederhanakan

- **Login digabung jadi satu halaman** — role (anggota/admin) otomatis terbaca
  dari Firestore setelah login, bukan dua form terpisah.
- **Notifikasi berupa banner di dalam halaman**, bukan push notification asli
  ke HP (itu butuh setup Firebase Cloud Messaging + server terpisah, di luar
  cakupan "versi sederhana").
- **Deteksi "tugas baru"** memakai penyimpanan di browser (localStorage) per
  perangkat — bukan status yang tersinkron di server.

Semua ini bisa dikembangkan lagi kalau dibutuhkan.
