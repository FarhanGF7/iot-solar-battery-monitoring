// Toggle Sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hide');
}

// =====================================================
//  FETCH DATA LIVE (Baterai)
// =====================================================
let lastTimestamp = null;

// Function to update the dashboard UI with new data
function updateDashboardUI(data) {
  if (!data.baterai) {
    console.warn('⚠️ Data tidak lengkap:', data);
    return;
  }

  const deviceStatus = document.getElementById('device-status');
  if (deviceStatus) {
    deviceStatus.textContent = 'Online 🟢';
    deviceStatus.style.color = '#2ecc71';
    deviceStatus.style.background = 'rgba(46,204,113,0.1)';
    deviceStatus.style.borderColor = 'rgba(46,204,113,0.2)';
  }

  const dayaBaterai = data.baterai.power || 0;
  
  // 1. Tangkap Data Fuzzy dari Backend
  const suhuBaterai = data.baterai.temperature || 0;
  const fuzzyStatus = data.baterai.fuzzy_status || "Menunggu...";
  const fuzzyScore = data.baterai.fuzzy_score || 0;

  // 2. Update metric card standar
  document.getElementById('voltage-load').textContent = `${data.baterai.voltage ? data.baterai.voltage.toFixed(2) : '0.00'} V`;
  document.getElementById('current-load').textContent = `${data.baterai.current ? data.baterai.current.toFixed(2) : '0.00'} A`;
  document.getElementById('power-load').textContent = `${dayaBaterai.toFixed(2)} W`;

  // 3. Update Kartu Status Fuzzy & Indikator Warna
  const statusEl = document.getElementById('battery-status');
  const cardStatus = document.getElementById('card-status');
  
  statusEl.textContent = fuzzyStatus;
  document.getElementById('battery-temp').textContent = `Suhu: ${suhuBaterai.toFixed(1)} °C`;
  document.getElementById('battery-score').textContent = `Skor: ${fuzzyScore}`;

  // Logika Warna (Traffic Light)
  if (fuzzyStatus === "Baik") {
    statusEl.style.color = "#28a745"; // Hijau
    cardStatus.style.borderLeft = "5px solid #28a745";
  } else if (fuzzyStatus === "Waspada") {
    statusEl.style.color = "#ffc107"; // Kuning Orange
    cardStatus.style.borderLeft = "5px solid #ffc107";
  } else if (fuzzyStatus === "Kritis") {
    statusEl.style.color = "#dc3545"; // Merah
    cardStatus.style.borderLeft = "5px solid #dc3545";
  }

  // 4. Tambah ke grafik (Line Chart) jika timestamp baru
  const recordTimestamp = data.baterai.timestamp;
  const chart = window.lineChart;

  if (chart && recordTimestamp && recordTimestamp !== lastTimestamp) {
    lastTimestamp = recordTimestamp;
    const timeStr = new Date(recordTimestamp).toLocaleTimeString();
    chart.data.labels.push(timeStr);
    chart.data.datasets[0].data.push(dayaBaterai);

    if (chart.data.labels.length > 10) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }

    chart.update();
  }
}

function initializeDashboardChart(records) {
  const chart = window.lineChart;
  if (!chart || !Array.isArray(records) || records.length === 0) return;

  chart.data.labels = [];
  chart.data.datasets[0].data = [];

  records.forEach(r => {
    const timeStr = new Date(r.timestamp).toLocaleTimeString();
    chart.data.labels.push(timeStr);
    chart.data.datasets[0].data.push(r.power || 0);
  });

  const lastRecord = records[records.length - 1];
  if (lastRecord) {
    lastTimestamp = lastRecord.timestamp;
  }

  chart.update();
}

async function fetchLiveData() {
  try {
    const res = await fetch('/api/data/latest');
    const data = await res.json();
    updateDashboardUI(data);
  } catch (err) {
    console.error('❌ Gagal ambil data:', err);
    const deviceStatus = document.getElementById('device-status');
    if (deviceStatus) {
      deviceStatus.textContent = 'Offline 🔴';
      deviceStatus.style.color = '#ff5252';
      deviceStatus.style.background = 'rgba(255,82,82,0.1)';
      deviceStatus.style.borderColor = 'rgba(255,82,82,0.2)';
    }
  }
}

async function initializeDashboard() {
  try {
    const recentRes = await fetch('/api/data/recent');
    const recentData = await recentRes.json();

    if (Array.isArray(recentData) && recentData.length > 0) {
      initializeDashboardChart(recentData);
    }
  } catch (err) {
    console.error('❌ Gagal inisialisasi grafik:', err);
  }

  await fetchLiveData();
}

// =====================================================
//  DASHBOARD METRICS
// =====================================================
async function loadDashboardMetrics() {
  try {
    const res = await fetch('/api/dashboard/metrics');
    const data = await res.json();

    document.getElementById("avg-load").textContent = `${data.avg_load ?? 0} W`;
  } catch (err) {
    console.error("Gagal ambil data dashboard:", err);
  }
}

// =====================================================
//  SESSION CHECK
// =====================================================
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/session');
    const data = await res.json();
    const loginBox = document.getElementById('loginUser');
    loginBox.textContent = data.loggedIn && data.username ? data.username : 'Login';
  } catch (err) {
    console.error('Gagal ambil session:', err);
  }
});

// =====================================================
//  LOGOUT
// =====================================================
const logoutLink = document.getElementById('logoutLink');
if (logoutLink) {
  logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/logout');
    window.location.href = '/login.html';
  });
}

// =====================================================
//  SOCKET.IO REAL-TIME CONNECTION
// =====================================================
// Menentukan URL backend secara dinamis agar tidak putus-putus
// jika dibuka dari port/host yang berbeda (misal Live Server) atau file lokal.
let socketUrl = '';
if (window.location.protocol === 'file:') {
  socketUrl = 'http://localhost:3000';
} else if (window.location.port && window.location.port !== '3000') {
  socketUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
}

const socket = io(socketUrl, {
  transports: ['polling', 'websocket'], // Menggunakan polling terlebih dahulu lalu mencoba upgrade ke websocket
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});
  
let socketConnected = false;

socket.on('connect', () => {
  console.log('🔌 Terhubung ke server realtime (Dashboard)');
  socketConnected = true;
});

socket.on('latestData', (data) => {
  console.log('📡 Data realtime diterima via socket:', data);
  updateDashboardUI(data);
});

socket.on('connect_error', (err) => {
  console.error('❌ Gagal menyambung ke Socket.IO:', err.message);
});

socket.on('disconnect', (reason) => {
  console.warn('❌ Terputus dari server realtime, alasan:', reason);
  socketConnected = false;
});

// =====================================================
//  INITIAL LOAD & FALLBACK AUTO UPDATE
// =====================================================
initializeDashboard();
loadDashboardMetrics();

// Fallback Polling: Hanya fetch jika socket tidak terhubung
setInterval(() => {
  if (!socketConnected) {
    console.log('🔄 Socket offline, mencoba fetch fallback...');
    fetchLiveData();
  }
}, 60000); // 1 menit

// Tetap update dashboard metrics averages (daya rata-rata) setiap 10 detik
setInterval(loadDashboardMetrics, 10000);
