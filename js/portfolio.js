import { db } from "./firebase-config.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { requireAuth, logout, isiUserChip, formatTanggal, escapeHtml } from "./auth-guard.js";

const folio = document.getElementById("folio");

requireAuth("anggota").then(({ uid, profile }) => {
  isiUserChip(profile);
  const q = query(collection(db, "submissions"), where("userId", "==", uid), where("status", "==", "diterima"));
  onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.reviewedAt?.toDate?.() ?? 0) - (a.reviewedAt?.toDate?.() ?? 0));
    render(list);
  });
});

document.getElementById("btn-logout").addEventListener("click", logout);

function render(list) {
  if (list.length === 0) {
    folio.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="e-ic">🗂️</div><div class="e-title">Belum ada karya di portofolio</div><p class="mb-0">Tugas yang sudah direview dan diterima akan otomatis muncul di sini.</p></div>`;
    return;
  }
  folio.innerHTML = list.map((s) => `
    <div class="folio-card">
      <div class="flex-between" style="align-items:flex-start;">
        <h3>${escapeHtml(s.tugasJudul || "Tugas")}</h3>
        <div class="folio-nilai">${s.nilai ?? "-"}</div>
      </div>
      <p class="text-sm">${escapeHtml(s.deskripsi || "")}</p>
      ${s.feedback ? `<p class="text-sm text-dim">"${escapeHtml(s.feedback)}"</p>` : ""}
      <div class="flex gap-8 flex-wrap mt-24" style="margin-top:12px;">
        ${s.fileURL ? `<a class="btn btn-ghost btn-sm" href="${s.fileURL}" target="_blank" rel="noopener">Lihat file</a>` : ""}
        ${s.driveLink ? `<a class="btn btn-ghost btn-sm" href="${s.driveLink}" target="_blank" rel="noopener">Buka Drive</a>` : ""}
      </div>
      <div class="text-sm text-dim mt-24" style="margin-top:10px;">Diterima ${formatTanggal(s.reviewedAt)}</div>
    </div>
  `).join("");
}
