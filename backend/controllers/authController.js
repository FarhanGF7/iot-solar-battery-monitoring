// controllers/authController.js
const db = require('../db').pool;

const register = (req, res) => {
  const { username, password, role } = req.body;
  
  if (!username || !password || !role) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';

  db.query(query, [username, password, role], (err) => {
    if (err) {
      console.error("Registrasi gagal:", err);
      return res.status(500).json({ message: "Username sudah dipakai atau terjadi kesalahan database" });
    }
    res.status(201).json({ message: "Akun berhasil dibuat" });
  });
};

const login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username dan password harus diisi" });
  }

  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';

  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Server error" });
    }
    if (results.length > 0) {
      req.session.loggedIn = true;
      req.session.username = username;
      req.session.role = results[0].role;
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "Username atau password salah" });
    }
  });
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Gagal menghapus session saat logout:", err);
      return res.status(500).json({ message: "Gagal logout" });
    }
    res.redirect('/login.html');
  });
};

module.exports = {
  register,
  login,
  logout
};
