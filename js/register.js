import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const form = document.getElementById("form-register");
const errBox = document.getElementById("err");
const btn = document.getElementById("btn-submit");

function tampilkanError(pesan) {
  errBox.textContent = pesan;
  errBox.classList.add("show");
}

function pesanError(kode) {
  switch (kode) {
    case "auth/email-already-in-use": return "Email ini sudah terdaftar. Coba masuk, atau pakai email lain.";
    case "auth/invalid-email": return "Format email tidak valid.";
    case "auth/weak-password": return "Kata sandi minimal 6 karakter.";
    default: return "Gagal mendaftar. Coba lagi.";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errBox.classList.remove("show");
  btn.disabled = true;
  btn.textContent = "Memproses...";

  const nama = document.getElementById("nama").value.trim();
  const divisi = document.getElementById("divisi").value;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nama });
    await setDoc(doc(db, "users", cred.user.uid), {
      nama,
      divisi,
      email,
      role: "anggota",
      createdAt: serverTimestamp(),
    });
    window.location.href = "dashboard-anggota.html";
  } catch (error) {
    tampilkanError(pesanError(error.code));
    btn.disabled = false;
    btn.textContent = "Daftar";
  }
});
