import { db, storage, EXT_DIIZINKAN, MAX_UKURAN_FILE_MB } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { requireAuth, logout, isiUserChip, hitungStatus, formatTanggal, escapeHtml, showToast } from "./auth-guard.js";

const konten = document.getElementById("konten");
const tugasId = new URLSearchParams(window.location.search).get("id");

let uid = null;
let profile = null;
let tugas = null;
let submission = null;

requireAuth("anggota").then(async ({ uid: u, profile: p }) => {
  uid = u;
  profile = p;
  isiUserChip(profile);

  if (!tugasId) { tampilkanTidakDitemukan(); return; }

  const tugasSnap = await getDoc(doc(db, "tugas", tugasId));
  if (!tugasSnap.exists()) { tampilkanTidakDitemukan(); return; }
  tugas = { id: tugasSnap.id, ...tugasSnap.data() };

  const subSnap = await getDoc(doc(db, "submissions", `${tugasId}_${uid}`));
  submission = subSnap.exists() ? subSnap.data() : null;

  render();
});

document.getElementById("btn-logout").addEventListener("click", logout);

function tampilkanTidakDitemukan() {
  konten.innerHTML = `<div class="empty-state"><div class="e-ic">🔍</div><div class="e-title">Tugas tidak ditemukan</div><p class="mb-0">Mungkin tugas ini sudah dihapus.</p></div>`;
}

function render() {
  const status = hitungStatus(tugas, submission);
  const referensiHtml = tugas.fileReferensiURL
    ? `<div class="detail-row"><span class="k">File referensi</span><a class="v" href="${tugas.fileReferensiURL}" target="_blank" rel="noopener">Buka file</a></div>`
    : "";

  let bawah = "";

  if (status.key === "diterima") {
    bawah = `
      <div class="panel">
        <div class="panel-head"><h2>Hasil Review</h2><span class="badge ${status.kelas}"><span class="dot"></span>${status.label}</span></div>
        <div class="detail-row"><span class="k">Nilai</span><span class="v">${submission.nilai ?? "-"}</span></div>
        <div class="detail-row"><span class="k">Feedback</span><span class="v">${escapeHtml(submission.feedback || "-")}</span></div>
        ${submission.fileURL ? `<div class="detail-row"><span class="k">File kamu</span><a class="v" href="${submission.fileURL}" target="_blank" rel="noopener">${escapeHtml(submission.fileName || "Buka file")}</a></div>` : ""}
        ${submission.driveLink ? `<div class="detail-row"><span class="k">Link Drive</span><a class="v" href="${submission.driveLink}" target="_blank" rel="noopener">Buka link</a></div>` : ""}
      </div>`;
  } else {
    const feedbackBanner = status.key === "revisi" && submission?.feedback
      ? `<div class="banner revisi"><span class="ic">🔵</span><div><b>Catatan revisi:</b> ${escapeHtml(submission.feedback)}</div></div>`
      : "";
    bawah = `
      ${feedbackBanner}
      <div class="panel">
        <div class="panel-head"><h2>${submission ? "Kirim Ulang" : "Kumpulkan Tugas"}</h2><span class="badge ${status.kelas}"><span class="dot"></span>${status.label}</span></div>
        <div class="form-error" id="err"></div>
        <form id="form-submit">
          <div class="field">
            <label for="deskripsi">Deskripsi / catatan</label>
            <textarea id="deskripsi" placeholder="Ceritakan singkat tentang tugas yang kamu kumpulkan...">${escapeHtml(submission?.deskripsi || "")}</textarea>
          </div>
          <div class="field">
            <label for="file">Upload file ${submission?.fileName ? "(opsional — kosongkan jika tidak ganti)" : ""}</label>
            <input type="file" id="file" accept="${EXT_DIIZINKAN.join(",")}">
            <div class="hint">Format: ${EXT_DIIZINKAN.join(", ")} · Maks ${MAX_UKURAN_FILE_MB}MB${submission?.fileName ? ` · File saat ini: ${escapeHtml(submission.fileName)}` : ""}</div>
          </div>
          <div class="field">
            <label for="drive">Link Google Drive (opsional)</label>
            <input type="url" id="drive" placeholder="https://drive.google.com/..." value="${escapeHtml(submission?.driveLink || "")}">
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="btn-submit">${submission ? "Kirim Ulang" : "Kumpulkan"}</button>
        </form>
      </div>`;
  }

  konten.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>${escapeHtml(tugas.judul)}</h2><div class="flex gap-8">${(tugas.divisi || []).map((d) => `<span class="divisi-pill ${escapeHtml(d)}">${escapeHtml(d)}</span>`).join("")}</div></div>
      <p>${escapeHtml(tugas.deskripsi || "")}</p>
      ${tugas.instruksi ? `<p class="text-sm text-dim">${escapeHtml(tugas.instruksi)}</p>` : ""}
      <div class="detail-row"><span class="k">Deadline</span><span class="v">${formatTanggal(tugas.deadline, true)}</span></div>
      ${tugas.bobot ? `<div class="detail-row"><span class="k">Bobot nilai</span><span class="v">${tugas.bobot}</span></div>` : ""}
      ${referensiHtml}
    </div>
    ${bawah}`;

  const form = document.getElementById("form-submit");
  if (form) form.addEventListener("submit", kirimTugas);
}

async function kirimTugas(e) {
  e.preventDefault();
  const errBox = document.getElementById("err");
  errBox.classList.remove("show");
  const btn = document.getElementById("btn-submit");

  const deskripsi = document.getElementById("deskripsi").value.trim();
  const driveLink = document.getElementById("drive").value.trim();
  const fileInput = document.getElementById("file");
  const file = fileInput.files[0];

  if (!file && !driveLink && !submission?.fileURL) {
    errBox.textContent = "Upload file atau isi link Google Drive dulu, ya.";
    errBox.classList.add("show");
    return;
  }
  if (file) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!EXT_DIIZINKAN.includes(ext)) {
      errBox.textContent = `Format file tidak didukung. Gunakan: ${EXT_DIIZINKAN.join(", ")}`;
      errBox.classList.add("show");
      return;
    }
    if (file.size > MAX_UKURAN_FILE_MB * 1024 * 1024) {
      errBox.textContent = `Ukuran file maksimal ${MAX_UKURAN_FILE_MB}MB.`;
      errBox.classList.add("show");
      return;
    }
  }

  btn.disabled = true;
  btn.textContent = "Mengirim...";

  try {
    let fileURL = submission?.fileURL || null;
    let fileName = submission?.fileName || null;

    if (file) {
      const path = `submissions/${uid}/${tugasId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      fileURL = await getDownloadURL(storageRef);
      fileName = file.name;
    }

    await setDoc(doc(db, "submissions", `${tugasId}_${uid}`), {
      tugasId,
      tugasJudul: tugas.judul,
      userId: uid,
      userNama: profile.nama,
      userDivisi: profile.divisi,
      deskripsi,
      fileURL,
      fileName,
      driveLink: driveLink || null,
      status: "terkumpul",
      submittedAt: serverTimestamp(),
    }, { merge: true });

    showToast("Tugas berhasil dikumpulkan.", "success");
    window.location.href = "dashboard-anggota.html";
  } catch (error) {
    console.error(error);
    errBox.textContent = "Gagal mengirim tugas. Periksa koneksi internet dan coba lagi.";
    errBox.classList.add("show");
    btn.disabled = false;
    btn.textContent = submission ? "Kirim Ulang" : "Kumpulkan";
  }
}
