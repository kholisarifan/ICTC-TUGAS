// ==========================================================================
// AUTH GUARD & UTILITAS BERSAMA
// Dipakai oleh semua halaman yang butuh login (dashboard, submit, review, dst).
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/**
 * Memastikan user sudah login dan (opsional) punya role tertentu.
 * - Kalau belum login          -> lempar ke index.html
 * - Kalau role tidak cocok     -> lempar ke dashboard yang sesuai
 * Mengembalikan Promise<{ uid, profile }> kalau lolos.
 */
export function requireAuth(roleDibutuhkan = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        // Akun auth ada tapi profil belum lengkap — paksa ulang lewat login.
        await signOut(auth);
        window.location.href = "index.html";
        return;
      }
      const profile = snap.data();
      if (roleDibutuhkan && profile.role !== roleDibutuhkan) {
        window.location.href = profile.role === "admin" ? "dashboard-admin.html" : "dashboard-anggota.html";
        return;
      }
      resolve({ uid: user.uid, profile });
    });
  });
}

export async function logout() {
  await signOut(auth);
  window.location.href = "index.html";
}

/**
 * Mengisi chip user (avatar inisial, nama, divisi/role) di navbar.
 */
export function isiUserChip(profile) {
  const inisial = (profile.nama || "?").trim().charAt(0).toUpperCase();
  document.querySelectorAll("[data-user-inisial]").forEach((el) => (el.textContent = inisial));
  document.querySelectorAll("[data-user-nama]").forEach((el) => (el.textContent = profile.nama || "-"));
  document.querySelectorAll("[data-user-divisi]").forEach((el) => (el.textContent = profile.role === "admin" ? "Admin/Ketua" : profile.divisi));
}

/**
 * Menghitung status sebuah tugas untuk satu anggota, berdasarkan ada/tidaknya
 * submission dan status submission itu. Dipakai di dashboard anggota & admin
 * supaya logikanya konsisten di satu tempat.
 */
export function hitungStatus(tugas, submission) {
  const deadline = ambilTanggal(tugas.deadline);
  const now = new Date();

  if (!submission) {
    if (deadline && now > deadline) {
      return { key: "terlambat", label: "Terlambat", ikon: "🔴", kelas: "badge-terlambat" };
    }
    return { key: "belum", label: "Belum", ikon: "🟡", kelas: "badge-belum" };
  }
  if (submission.status === "diterima") {
    return { key: "diterima", label: "Diterima", ikon: "✅", kelas: "badge-diterima" };
  }
  if (submission.status === "revisi") {
    return { key: "revisi", label: "Revisi", ikon: "🔵", kelas: "badge-revisi" };
  }
  return { key: "terkumpul", label: "Terkumpul", ikon: "🟢", kelas: "badge-terkumpul" };
}

export function ambilTanggal(nilai) {
  if (!nilai) return null;
  if (typeof nilai.toDate === "function") return nilai.toDate();
  return new Date(nilai);
}

export function formatTanggal(nilai, denganJam = false) {
  const d = ambilTanggal(nilai);
  if (!d) return "-";
  const opsi = { day: "numeric", month: "short", year: "numeric" };
  if (denganJam) { opsi.hour = "2-digit"; opsi.minute = "2-digit"; }
  return d.toLocaleDateString("id-ID", opsi);
}

export function sisaHari(nilai) {
  const d = ambilTanggal(nilai);
  if (!d) return null;
  const ms = d.setHours(23, 59, 59, 999) - new Date().getTime();
  return Math.ceil(ms / 86400000);
}

/**
 * Toast notifikasi kecil di kanan-atas. type: 'info' | 'warn' | 'danger' | 'success'
 */
export function showToast(pesan, type = "info", durasiMs = 4500) {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = pesan;
  stack.appendChild(el);
  setTimeout(() => el.remove(), durasiMs);
}

/** Mencegah HTML/skrip nyelip saat menampilkan teks isian user (deskripsi, feedback, dll). */
export function escapeHtml(teks) {
  const div = document.createElement("div");
  div.textContent = teks ?? "";
  return div.innerHTML;
}

export function inisialDivisi(divisi) {
  return divisi || "-";
}
