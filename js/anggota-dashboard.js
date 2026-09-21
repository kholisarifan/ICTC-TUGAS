import { db } from "./firebase-config.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { requireAuth, logout, isiUserChip, hitungStatus, formatTanggal, sisaHari, escapeHtml } from "./auth-guard.js";

const tbody = document.getElementById("tbody-tugas");
const notifArea = document.getElementById("notif-area");

let uid = null;
let daftarTugas = [];
let daftarSubmission = [];

requireAuth("anggota").then(({ uid: u, profile }) => {
  uid = u;
  isiUserChip(profile);
  pasangListener(profile.divisi);
});

document.getElementById("btn-logout").addEventListener("click", logout);

function pasangListener(divisi) {
  const qTugas = query(collection(db, "tugas"), where("divisi", "array-contains", divisi));
  onSnapshot(qTugas, (snap) => {
    daftarTugas = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.deadline?.toDate?.() ?? 0) - (b.deadline?.toDate?.() ?? 0));
    render();
  });

  const qSub = query(collection(db, "submissions"), where("userId", "==", uid));
  onSnapshot(qSub, (snap) => {
    daftarSubmission = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  });
}

function cariSubmission(tugasId) {
  return daftarSubmission.find((s) => s.tugasId === tugasId) || null;
}

function render() {
  renderTabel();
  renderStat();
  renderNotifikasi();
}

function renderTabel() {
  if (daftarTugas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="e-ic">📭</div><div class="e-title">Belum ada tugas</div><p class="mb-0">Tugas untuk divisimu akan muncul di sini.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = daftarTugas.map((tugas) => {
    const submission = cariSubmission(tugas.id);
    const status = hitungStatus(tugas, submission);
    const aksiLabel = status.key === "diterima" ? "Lihat" : status.key === "revisi" ? "Perbaiki" : status.key === "terkumpul" ? "Lihat" : "Kumpulkan";
    return `
      <tr>
        <td data-label="Tugas" class="row-title">${escapeHtml(tugas.judul)}</td>
        <td data-label="Deadline">${formatTanggal(tugas.deadline, true)}</td>
        <td data-label="Status"><span class="badge ${status.kelas}"><span class="dot"></span>${status.label}</span></td>
        <td data-label=""><a class="btn btn-ghost btn-sm" href="submit-tugas.html?id=${encodeURIComponent(tugas.id)}">${aksiLabel}</a></td>
      </tr>`;
  }).join("");
}

function renderStat() {
  const hitung = { diterima: 0, terkumpul: 0, revisi: 0, belum: 0, terlambat: 0 };
  daftarTugas.forEach((tugas) => {
    const status = hitungStatus(tugas, cariSubmission(tugas.id));
    hitung[status.key]++;
  });
  document.getElementById("st-diterima").textContent = hitung.diterima;
  document.getElementById("st-terkumpul").textContent = hitung.terkumpul;
  document.getElementById("st-revisi").textContent = hitung.revisi;
  document.getElementById("st-belum").textContent = hitung.belum + hitung.terlambat;
}

function renderNotifikasi() {
  const banners = [];

  // Tugas perlu revisi
  const perluRevisi = daftarTugas.filter((t) => cariSubmission(t.id)?.status === "revisi");
  if (perluRevisi.length > 0) {
    banners.push(`<div class="banner revisi"><span class="ic">🔵</span><div>Ada <b>${perluRevisi.length} tugas</b> yang perlu direvisi: ${perluRevisi.map((t) => escapeHtml(t.judul)).join(", ")}.</div></div>`);
  }

  // Deadline mepet (≤ 2 hari, belum dikumpulkan)
  daftarTugas.forEach((tugas) => {
    const status = hitungStatus(tugas, cariSubmission(tugas.id));
    if (status.key !== "belum") return;
    const sisa = sisaHari(tugas.deadline);
    if (sisa !== null && sisa >= 0 && sisa <= 2) {
      const teks = sisa === 0 ? "hari ini" : sisa === 1 ? "besok" : `${sisa} hari lagi`;
      banners.push(`<div class="banner warn"><span class="ic">⏰</span><div>Deadline <b>${escapeHtml(tugas.judul)}</b> ${teks}!</div></div>`);
    }
  });

  // Tugas baru (dibandingkan dengan yang tersimpan di perangkat ini)
  const kunciLihat = `ictc_seen_tugas_${uid}`;
  const sudahDilihat = new Set(JSON.parse(localStorage.getItem(kunciLihat) || "[]"));
  const baru = daftarTugas.filter((t) => !sudahDilihat.has(t.id));
  if (baru.length > 0 && sudahDilihat.size > 0) {
    banners.push(`<div class="banner new"><span class="ic">🆕</span><div>Tugas baru tersedia: ${baru.map((t) => escapeHtml(t.judul)).join(", ")}.</div></div>`);
  }
  localStorage.setItem(kunciLihat, JSON.stringify(daftarTugas.map((t) => t.id)));

  notifArea.innerHTML = banners.join("");
}
