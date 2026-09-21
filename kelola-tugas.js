import { db, storage } from "./firebase-config.js";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { requireAuth, logout, isiUserChip, formatTanggal, escapeHtml, showToast } from "./auth-guard.js";

let daftarTugas = [];

requireAuth("admin").then(({ profile }) => {
  isiUserChip(profile);
  onSnapshot(collection(db, "tugas"), (snap) => {
    daftarTugas = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.deadline?.toDate?.() ?? 0) - (b.deadline?.toDate?.() ?? 0));
    renderTabel();
  });
});

document.getElementById("btn-logout").addEventListener("click", logout);

function renderTabel() {
  const tbody = document.getElementById("tbody-tugas");
  if (daftarTugas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="e-ic">🗒️</div><div class="e-title">Belum ada tugas</div><p class="mb-0">Klik "+ Buat Tugas" untuk membuat tugas pertama.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = daftarTugas.map((t) => `
    <tr>
      <td data-label="Judul" class="row-title">${escapeHtml(t.judul)}</td>
      <td data-label="Divisi">${(t.divisi || []).map((d) => `<span class="divisi-pill ${escapeHtml(d)}">${escapeHtml(d)}</span>`).join(" ")}</td>
      <td data-label="Deadline">${formatTanggal(t.deadline, true)}</td>
      <td data-label="">
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" data-edit="${t.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-hapus="${t.id}">Hapus</button>
        </div>
      </td>
    </tr>`).join("");
}

document.getElementById("tbody-tugas").addEventListener("click", (e) => {
  const editBtn = e.target.closest("[data-edit]");
  const hapusBtn = e.target.closest("[data-hapus]");
  if (editBtn) bukaModal(daftarTugas.find((t) => t.id === editBtn.dataset.edit));
  if (hapusBtn) hapusTugas(hapusBtn.dataset.hapus);
});

async function hapusTugas(id) {
  const tugas = daftarTugas.find((t) => t.id === id);
  if (!confirm(`Hapus tugas "${tugas?.judul}"? Submission yang sudah masuk tidak akan ikut terhapus.`)) return;
  try {
    await deleteDoc(doc(db, "tugas", id));
    showToast("Tugas dihapus.", "info");
  } catch (error) {
    console.error(error);
    showToast("Gagal menghapus tugas.", "danger");
  }
}

// ---- Modal buat/edit ----
const modal = document.getElementById("modal-tugas");
const form = document.getElementById("form-tugas");
const errBox = document.getElementById("mt-err");

document.getElementById("btn-buka-buat").addEventListener("click", () => bukaModal(null));
document.getElementById("mt-close").addEventListener("click", tutupModal);
document.getElementById("mt-cancel").addEventListener("click", tutupModal);
modal.addEventListener("click", (e) => { if (e.target === modal) tutupModal(); });

function keDatetimeLocal(timestamp) {
  const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function bukaModal(tugas) {
  form.reset();
  errBox.classList.remove("show");
  document.querySelectorAll(".mt-divisi").forEach((cb) => (cb.checked = false));
  document.getElementById("mt-file-hint").textContent = "";

  if (tugas) {
    document.getElementById("mt-judul-modal").textContent = "Edit Tugas";
    document.getElementById("mt-id").value = tugas.id;
    document.getElementById("mt-judul").value = tugas.judul || "";
    document.getElementById("mt-deskripsi").value = tugas.deskripsi || "";
    document.getElementById("mt-deadline").value = keDatetimeLocal(tugas.deadline);
    document.getElementById("mt-instruksi").value = tugas.instruksi || "";
    document.getElementById("mt-bobot").value = tugas.bobot || 100;
    (tugas.divisi || []).forEach((d) => {
      const cb = document.querySelector(`.mt-divisi[value="${d}"]`);
      if (cb) cb.checked = true;
    });
    if (tugas.fileReferensiName) {
      document.getElementById("mt-file-hint").textContent = `File saat ini: ${tugas.fileReferensiName} (upload file baru untuk mengganti)`;
    }
  } else {
    document.getElementById("mt-judul-modal").textContent = "Buat Tugas Baru";
    document.getElementById("mt-id").value = "";
    document.getElementById("mt-bobot").value = 100;
  }
  modal.classList.add("open");
}

function tutupModal() {
  modal.classList.remove("open");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errBox.classList.remove("show");

  const divisiTerpilih = Array.from(document.querySelectorAll(".mt-divisi:checked")).map((cb) => cb.value);
  if (divisiTerpilih.length === 0) {
    errBox.textContent = "Pilih minimal satu divisi tujuan.";
    errBox.classList.add("show");
    return;
  }

  const id = document.getElementById("mt-id").value;
  const btn = document.getElementById("mt-save");
  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  try {
    const data = {
      judul: document.getElementById("mt-judul").value.trim(),
      deskripsi: document.getElementById("mt-deskripsi").value.trim(),
      divisi: divisiTerpilih,
      deadline: Timestamp.fromDate(new Date(document.getElementById("mt-deadline").value)),
      instruksi: document.getElementById("mt-instruksi").value.trim(),
      bobot: Number(document.getElementById("mt-bobot").value) || 100,
    };

    const file = document.getElementById("mt-file").files[0];
    if (file) {
      const path = `tugas-referensi/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      data.fileReferensiURL = await getDownloadURL(storageRef);
      data.fileReferensiName = file.name;
    }

    if (id) {
      await updateDoc(doc(db, "tugas", id), data);
      showToast("Tugas diperbarui.", "success");
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "tugas"), data);
      showToast("Tugas baru dibuat.", "success");
    }
    tutupModal();
  } catch (error) {
    console.error(error);
    errBox.textContent = "Gagal menyimpan tugas. Coba lagi.";
    errBox.classList.add("show");
  }
  btn.disabled = false;
  btn.textContent = "Simpan Tugas";
});
