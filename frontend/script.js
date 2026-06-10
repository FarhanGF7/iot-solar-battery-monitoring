// Toggle Sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hide');
}

// =====================================================
//  FETCH DATA LIVE (Panel & Beban)
// =====================================================
// Function to update the dashboard UI with new data
function updateDashboardUI(data) {
  if (!data.panel || !data.beban) {
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

  const dayaPanel = data.panel.power || 0;
  const dayaBeban = data.beban.power || 0;
  
  // 1. Tangkap Data Fuzzy dari Backend
  const suhuBaterai = data.beban.temperature || 0;
  const fuzzyStatus = data.beban.fuzzy_status || "Menunggu...";
  const fuzzyScore = data.beban.fuzzy_score || 0;

  // 2. Update metric card standar
  document.getElementById('voltage-load').textContent = `${data.beban.voltage ? data.beban.voltage.toFixed(2) : '0.00'} V`;
  document.getElementById('current-load').textContent = `${data.beban.current ? data.beban.current.toFixed(2) : '0.00'} A`;
  document.getElementById('power-load').textContent = `${dayaBeban.toFixed(2)} W`;

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

  // 4. Tambah ke grafik (Line Chart)
  const now = new Date().toLocaleTimeString();
  const chart = window.lineChart;

  if (chart) {
    chart.data.labels.push(now);
    chart.data.datasets[0].data.push(dayaBeban);

    if (chart.data.labels.length > 10) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }

    chart.update();
  }
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
const socket = io();
let socketConnected = false;

socket.on('connect', () => {
  console.log('🔌 Terhubung ke server realtime (Dashboard)');
  socketConnected = true;
});

socket.on('latestData', (data) => {
  console.log('📡 Data realtime diterima via socket:', data);
  updateDashboardUI(data);
});

socket.on('disconnect', () => {
  console.warn('❌ Terputus dari server realtime');
  socketConnected = false;
});

// =====================================================
//  INITIAL LOAD & FALLBACK AUTO UPDATE
// =====================================================
fetchLiveData();
loadDashboardMetrics();

// Fallback Polling: Hanya fetch jika socket tidak terhubung
setInterval(() => {
  if (!socketConnected) {
    console.log('🔄 Socket offline, mencoba fetch fallback...');
    fetchLiveData();
  }
}, 5000);

// Tetap update dashboard metrics averages (daya rata-rata) setiap 10 detik
setInterval(loadDashboardMetrics, 10000);
