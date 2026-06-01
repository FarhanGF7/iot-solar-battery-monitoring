// login.js

document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
  
    const username = this.username.value;
    const password = this.password.value;
  
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
  
      if (response.ok) {
        window.location.href = '/index.html';
      } else {
        alert('Login gagal. Username atau password salah.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Terjadi kesalahan saat login.');
    }
  });
  