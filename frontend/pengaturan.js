// pengaturan.js

document.getElementById('createUserForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const username = this.username.value;
  const password = this.password.value;
  const role = this.role.value;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role })
    });

    const result = await response.json();
    const notif = document.getElementById('notif');

    if (response.ok) {
      notif.textContent = '✅ Akun berhasil dibuat!';
      notif.style.color = 'lightgreen';
      this.reset();
    } else {
      notif.textContent = '❌ Gagal membuat akun: ' + (result.message || 'Terjadi kesalahan');
      notif.style.color = 'salmon';
    }
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('notif').textContent = '❌ Terjadi kesalahan jaringan';
    document.getElementById('notif').style.color = 'salmon';
  }
});

// Sembunyikan menu pengaturan untuk role user biasa dan update info login
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/session');
    const data = await res.json();

    // Tampilkan nama user di kanan atas
    const loginUser = document.getElementById('loginUser');
    if (loginUser && data.username) {
      loginUser.textContent = ` ${data.username}`;
    }

    // Sembunyikan pengaturan jika bukan admin
    if (data.role !== 'admin') {
      const settingsLink = document.querySelector('a[href="pengaturan.html"]');
      if (settingsLink) settingsLink.style.display = 'none';
    }

    // Aktifkan tombol logout
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch('/api/logout');
        window.location.href = '/login.html';
      });
    }
  } catch (err) {
    console.error('Gagal mendapatkan session:', err);
  }
});
