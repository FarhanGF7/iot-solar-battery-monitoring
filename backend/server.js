// === Import Library Utama ===
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const dataRoutes = require('./routes/dataRoutes');
const authRoutes = require('./routes/authRoutes');
const trackerRoutes = require('./routes/trackerroutes'); // 
const wiperRoutes = require("./routes/wiperRoutes");

// === Inisialisasi Express & Server HTTP ===
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  pingInterval: 25000,
  pingTimeout: 1800 * 1000, 
});

const trackerController = require('./controllers/trackerController');
trackerController.setSocket(io);

// Simpan io agar bisa diakses di controller
app.set("io", io);



const PORT = process.env.PORT || 3000;

// === Middleware ===
app.use(cors());
app.use(bodyParser.json());
app.use(session({
  secret: 'plts_secret_key',
  resave: false,
  saveUninitialized: false
}));

// === Proteksi Halaman Admin ===
app.use((req, res, next) => {
  if (
    req.path === '/pengaturan.html' &&
    (!req.session.loggedIn || req.session.role !== 'admin')
  ) {
    return res.redirect('/login.html');
  }
  next();
});

// === File Statis Frontend ===
app.use(express.static(path.join(__dirname, '../frontend')));

// === Routing API lainnya ===
app.use('/api', dataRoutes);
app.use('/api', authRoutes);
app.use("/api", wiperRoutes);
// === Routing Solar Tracker ===
// ESP32 tetap bisa POST ke /updateServo
app.use('/', trackerRoutes);

// === Middleware Auth ===
function isAuthenticated(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect('/login.html');
}

// === Proteksi Halaman ===
app.get('/index.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/analitik.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/analitik.html'));
});

app.get('/log_data.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/log_data.html'));
});

app.get('/wiper.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/wiper.html'));
});

app.get('/solartracker.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/solartracker.html'));
});

// === SOCKET.IO (REAL-TIME) ================================
io.on('connection', (socket) => {
  console.log('🔌 Client web terhubung ke Socket.IO');

  socket.on('disconnect', () => {
    console.log('❌ Client web terputus');
  });
});

// === Root Route (cek server aktif) ===
app.get('/', (req, res) => {
  res.send('🌞 API Monitoring & Solar Tracker aktif dan siap menerima data dari ESP32!');
});

// === Jalankan Server ===
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server berjalan di: http://0.0.0.0:${PORT}`);
});
