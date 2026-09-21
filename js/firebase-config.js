// ==========================================================================
// KONFIGURASI FIREBASE
// --------------------------------------------------------------------------
// Ganti semua nilai "GANTI_..." di bawah dengan konfigurasi project Firebase
// kamu sendiri. Caranya ada di README.md bagian "Setup Firebase".
// File ini diimpor oleh semua halaman lain, jadi cukup diisi sekali di sini.
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY_KAMU",
  authDomain: "GANTI_DENGAN_AUTH_DOMAIN_KAMU",
  projectId: "GANTI_DENGAN_PROJECT_ID_KAMU",
  storageBucket: "GANTI_DENGAN_STORAGE_BUCKET_KAMU",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID_KAMU",
  appId: "GANTI_DENGAN_APP_ID_KAMU"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Daftar divisi ICTC — ubah di sini kalau suatu saat ada divisi baru,
// otomatis akan muncul di form daftar, form buat tugas, dan filter admin.
export const DIVISI_LIST = ["Program", "Desain", "Multimedia"];

// Tipe file yang boleh diupload saat mengumpulkan tugas.
export const EXT_DIIZINKAN = [".jpg", ".jpeg", ".png", ".pdf", ".mp4", ".zip"];
export const MAX_UKURAN_FILE_MB = 25;
