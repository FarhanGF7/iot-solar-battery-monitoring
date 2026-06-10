// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, logout } = require('../controllers/authController');

// === CEK SESSION LOGIN ===
router.get('/session', (req, res) => {
  res.json({
    loggedIn: req.session.loggedIn || false,
    username: req.session.username || null,
    role: req.session.role || null
  });
});

// === REGISTER, LOGIN, LOGOUT ===
router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);

module.exports = router;
