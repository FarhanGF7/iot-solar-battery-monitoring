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

    if (!data.loggedIn) {
      window.location.href = '/login.html';
      return;
    }

    const deviceStatus = document.getElementById('device-status');
    if (deviceStatus) {
      deviceStatus.textContent = 'Online 🟢';
      deviceStatus.style.color = '#2ecc71';
      deviceStatus.style.background = 'rgba(46,204,113,0.1)';
      deviceStatus.style.borderColor = 'rgba(46,204,113,0.2)';
    }

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
    const deviceStatus = document.getElementById('device-status');
    if (deviceStatus) {
      deviceStatus.textContent = 'Offline 🔴';
      deviceStatus.style.color = '#ff5252';
      deviceStatus.style.background = 'rgba(255,82,82,0.1)';
      deviceStatus.style.borderColor = 'rgba(255,82,82,0.2)';
    }
  }
});
