import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const form = document.getElementById("form-login");
const errBox = document.getElementById("err");
const btn = document.getElementById("btn-submit");

function tampilkanError(pesan) {
  errBox.textContent = pesan;
  errBox.classList.add("show");
}

function pesanError(kode) {
  switch (kode) {
    case "auth/invalid-email": return "Format email tidak valid.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password": return "Email atau kata sandi salah.";
    case "auth/too-many-requests": return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
    default: return "Gagal masuk. Coba lagi.";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errBox.classList.remove("show");
  btn.disabled = true;
  btn.textContent = "Memproses...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));

    if (!snap.exists()) {
      tampilkanError("Profil akun tidak ditemukan. Hubungi admin ICTC.");
      btn.disabled = false;
      btn.textContent = "Masuk";
      return;
    }

    const profile = snap.data();
    window.location.href = profile.role === "admin" ? "dashboard-admin.html" : "dashboard-anggota.html";
  } catch (error) {
    tampilkanError(pesanError(error.code));
    btn.disabled = false;
    btn.textContent = "Masuk";
  }
});
