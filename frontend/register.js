// register.js

document.getElementById('registerForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const username = this.username.value;
  const password = this.password.value;
  const role = this.role.value;
  const notif = document.getElementById('registerNotif');

  notif.textContent = "";

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role })
    });

    const result = await response.json();

    if (response.ok) {
      notif.textContent = '✅ Akun berhasil dibuat! Mengalihkan ke halaman login...';
      notif.style.color = 'lightgreen';
      this.reset();
      
      // Mengalihkan ke login setelah 2 detik
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);
    } else {
      notif.textContent = '❌ Gagal: ' + (result.message || 'Terjadi kesalahan');
      notif.style.color = '#ff6b6b';
    }
  } catch (error) {
    console.error('Error saat registrasi:', error);
    notif.textContent = '❌ Terjadi kesalahan jaringan';
    notif.style.color = '#ff6b6b';
  }
});
