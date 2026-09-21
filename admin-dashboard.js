import { db } from "./firebase-config.js";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { requireAuth, logout, isiUserChip, hitungStatus, escapeHtml, showToast } from "./auth-guard.js";

let daftarAnggota = [];
let daftarTugas = [];
let daftarSubmission = [];
let submissionSedangDireview = null;
let tugasSudahDipilihOtomatis = false;

const filter = { divisi: "Semua", tugasId: "semua", status: "semua" };

requireAuth("admin").then(({ profile }) => {
  isiUserChip(profile);
  muatData();
});

document.getElementById("btn-logout").addEventListener("click", logout);

function muatData() {
  onSnapshot(query(collection(db, "users"), where("role", "==", "anggota")), (snap) => {
    daftarAnggota = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSemua();
  });
  onSnapshot(collection(db, "tugas"), (snap) => {
    daftarTugas = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.deadline?.toDate?.() ?? 0) - (b.deadline?.toDate?.() ?? 0));
    isiFilterTugas();
    renderSemua();
  });
  onSnapshot(collection(db, "submissions"), (snap) => {
    daftarSubmission = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSemua();
  });
}

function isiFilterTugas() {
  const sel = document.getElementById("f-tugas");
  const nilaiSebelumnya = sel.value;
  sel.innerHTML = `<option value="semua">Semua Tugas</option>` +
    daftarTugas.map((t) => `<option value="${t.id}">${escapeHtml(t.judul)}</option>`).join("");

  if (!tugasSudahDipilihOtomatis && daftarTugas.length > 0) {
    // Pilih otomatis tugas dengan deadline terdekat yang belum lewat, kalau ada.
    const akanDatang = daftarTugas.find((t) => (t.deadline?.toDate?.() ?? new Date(t.deadline)) > new Date());
    sel.value = (akanDatang || daftarTugas[0]).id;
    filter.tugasId = sel.value;
    tugasSudahDipilihOtomatis = true;
  } else if (daftarTugas.some((t) => t.id === nilaiSebelumnya) || nilaiSebelumnya === "semua") {
    sel.value = nilaiSebelumnya;
  }
}

document.getElementById("f-divisi").addEventListener("change", (e) => { filter.divisi = e.target.value; renderSemua(); });
document.getElementById("f-tugas").addEventListener("change", (e) => { filter.tugasId = e.target.value; renderSemua(); });
document.getElementById("f-status").addEventListener("change", (e) => { filter.status = e.target.value; renderSemua(); });

function statusDariSubmission(s) {
  if (s.status === "diterima") return { key: "diterima", label: "Diterima", kelas: "badge-diterima" };
  if (s.status === "revisi") return { key: "revisi", label: "Revisi", kelas: "badge-revisi" };
  return { key: "terkumpul", label: "Terkumpul", kelas: "badge-terkumpul" };
}

function cocokFilterStatus(key) {
  if (filter.status === "semua") return true;
  if (filter.status === "belum") return key === "belum" || key === "terlambat";
  return key === filter.status;
}

function hitungBaris() {
  if (filter.tugasId === "semua") {
    return daftarSubmission
      .filter((s) => filter.divisi === "Semua" || s.userDivisi === filter.divisi)
      .map((s) => {
        const status = statusDariSubmission(s);
        return { anggota: s.userNama, divisi: s.userDivisi, tugas: s.tugasJudul || "(tugas dihapus)", status, nilai: s.nilai, submissionId: s.id };
      })
      .filter((r) => cocokFilterStatus(r.status.key));
  }

  const tugas = daftarTugas.find((t) => t.id === filter.tugasId);
  if (!tugas) return [];
  return daftarAnggota
    .filter((a) => filter.divisi === "Semua" || a.divisi === filter.divisi)
    .filter((a) => (tugas.divisi || []).includes(a.divisi))
    .map((a) => {
      const submission = daftarSubmission.find((s) => s.tugasId === filter.tugasId && s.userId === a.id);
      const status = hitungStatus(tugas, submission);
      return { anggota: a.nama, divisi: a.divisi, tugas: tugas.judul, status, nilai: submission?.nilai, submissionId: submission?.id };
    })
    .filter((r) => cocokFilterStatus(r.status.key));
}

function submisiSelaras() {
  return daftarSubmission.filter((s) =>
    (filter.tugasId === "semua" || s.tugasId === filter.tugasId) &&
    (filter.divisi === "Semua" || s.userDivisi === filter.divisi)
  );
}

function renderSemua() {
  renderHero();
  renderProgresDivisi();
  renderTabel(hitungBaris());
}

function renderHero() {
  const scoped = submisiSelaras();
  if (filter.tugasId === "semua") {
    document.getElementById("hero-num").textContent = scoped.length;
    document.getElementById("hero-label").textContent = "Total pengumpulan";
  } else {
    const tugas = daftarTugas.find((t) => t.id === filter.tugasId);
    const roster = daftarAnggota.filter((a) => (filter.divisi === "Semua" || a.divisi === filter.divisi) && (tugas?.divisi || []).includes(a.divisi));
    const sudah = roster.filter((a) => daftarSubmission.some((s) => s.tugasId === filter.tugasId && s.userId === a.id)).length;
    document.getElementById("hero-num").textContent = `${sudah} / ${roster.length}`;
    document.getElementById("hero-label").textContent = `Sudah mengumpulkan — ${tugas?.judul || ""}`;
  }
  document.getElementById("sub-diterima").textContent = scoped.filter((s) => s.status === "diterima").length;
  document.getElementById("sub-revisi").textContent = scoped.filter((s) => s.status === "revisi").length;
  document.getElementById("sub-menunggu").textContent = scoped.filter((s) => s.status === "terkumpul").length;
}

function renderProgresDivisi() {
  const container = document.getElementById("progres-divisi");
  if (filter.tugasId === "semua") {
    container.innerHTML = `<p class="text-sm text-dim mb-0">Pilih salah satu tugas di filter bawah untuk melihat progres per divisi.</p>`;
    return;
  }
  const tugas = daftarTugas.find((t) => t.id === filter.tugasId);
  const divisiTarget = tugas?.divisi || [];
  if (divisiTarget.length === 0) {
    container.innerHTML = `<p class="text-sm text-dim mb-0">Tugas ini belum ditujukan ke divisi manapun.</p>`;
    return;
  }
  container.innerHTML = divisiTarget.map((dv) => {
    const anggotaDivisi = daftarAnggota.filter((a) => a.divisi === dv);
    const sudah = anggotaDivisi.filter((a) => daftarSubmission.some((s) => s.tugasId === filter.tugasId && s.userId === a.id)).length;
    const total = anggotaDivisi.length;
    const pct = total > 0 ? Math.round((sudah / total) * 100) : 0;
    return `<div class="progress-item">
      <div class="progress-top"><span class="p-label">${dv}</span><span class="p-val">${sudah}/${total} · ${pct}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
}

function renderTabel(rows) {
  const tbody = document.getElementById("tbody-admin");
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="e-ic">📭</div><div class="e-title">Tidak ada data</div><p class="mb-0">Coba ubah filter di atas, atau buat tugas baru dulu.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td data-label="Anggota" class="row-title">${escapeHtml(r.anggota)}</td>
      <td data-label="Divisi"><span class="divisi-pill ${escapeHtml(r.divisi)}">${escapeHtml(r.divisi)}</span></td>
      <td data-label="Tugas">${escapeHtml(r.tugas)}</td>
      <td data-label="Status"><span class="badge ${r.status.kelas}"><span class="dot"></span>${r.status.label}</span></td>
      <td data-label="Nilai" class="muted">${r.nilai ?? "-"}</td>
      <td data-label="">${r.submissionId ? `<button class="btn btn-ghost btn-sm" data-review="${r.submissionId}">Review</button>` : `<span class="muted">—</span>`}</td>
    </tr>`).join("");
}

document.getElementById("tbody-admin").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-review]");
  if (btn) bukaReview(btn.dataset.review);
});

// ---- Modal review ----
const modal = document.getElementById("modal-review");

function bukaReview(submissionId) {
  const s = daftarSubmission.find((x) => x.id === submissionId);
  if (!s) return;
  submissionSedangDireview = s;

  document.getElementById("mr-judul").textContent = `Review — ${s.tugasJudul || "Tugas"}`;
  document.getElementById("mr-anggota").textContent = `${s.userNama} · ${s.userDivisi}`;
  document.getElementById("mr-deskripsi").textContent = s.deskripsi || "-";

  const fileRow = document.getElementById("mr-file-row");
  if (s.fileURL) {
    fileRow.style.display = "";
    document.getElementById("mr-file").innerHTML = `<a href="${s.fileURL}" target="_blank" rel="noopener">${escapeHtml(s.fileName || "Buka file")}</a>`;
  } else fileRow.style.display = "none";

  const driveRow = document.getElementById("mr-drive-row");
  if (s.driveLink) {
    driveRow.style.display = "";
    document.getElementById("mr-drive").innerHTML = `<a href="${s.driveLink}" target="_blank" rel="noopener">Buka link</a>`;
  } else driveRow.style.display = "none";

  document.getElementById("mr-nilai").value = s.nilai ?? "";
  document.getElementById("mr-feedback").value = s.feedback || "";
  document.getElementById("mr-status").value = s.status === "diterima" ? "diterima" : "revisi";

  modal.classList.add("open");
}

function tutupReview() {
  modal.classList.remove("open");
  submissionSedangDireview = null;
}

document.getElementById("mr-close").addEventListener("click", tutupReview);
document.getElementById("mr-cancel").addEventListener("click", tutupReview);
modal.addEventListener("click", (e) => { if (e.target === modal) tutupReview(); });

document.getElementById("form-review").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!submissionSedangDireview) return;
  const btn = document.getElementById("mr-save");
  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  const nilaiRaw = document.getElementById("mr-nilai").value;
  try {
    await updateDoc(doc(db, "submissions", submissionSedangDireview.id), {
      nilai: nilaiRaw === "" ? null : Number(nilaiRaw),
      feedback: document.getElementById("mr-feedback").value.trim(),
      status: document.getElementById("mr-status").value,
      reviewedAt: serverTimestamp(),
    });
    showToast("Review tersimpan.", "success");
    tutupReview();
  } catch (error) {
    console.error(error);
    showToast("Gagal menyimpan review. Coba lagi.", "danger");
  }
  btn.disabled = false;
  btn.textContent = "Simpan";
});
