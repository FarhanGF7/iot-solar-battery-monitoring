// session.js
async function renderSession() {
    try {
      const res = await fetch("/api/session");
      const data = await res.json();
  
      const loginBox = document.getElementById("loginUser");
      if (loginBox) loginBox.textContent = `${data.username}`;
  
      const logoutLink = document.getElementById("logoutLink");
      if (logoutLink) {
        logoutLink.addEventListener("click", async (e) => {
          e.preventDefault();
          await fetch("/api/logout");
          window.location.href = "/login.html";
        });
      }
  
      // Sembunyikan link Pengaturan jika bukan admin
      if (data.role !== "admin") {
        const settingsLink = document.querySelector('a[href="pengaturan.html"]');
        if (settingsLink) settingsLink.style.display = "none";
      }
    } catch (err) {
      console.error("Gagal ambil session:", err);
    }
  }
  
  document.addEventListener("DOMContentLoaded", renderSession);
  