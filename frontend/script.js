// Toggle Sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hide');
}

// =====================================================
//  FETCH DATA LIVE (Panel & Beban)
// =====================================================
async function fetchLiveData() {
  try {
    const res = await fetch('/api/data/latest');
    const data = await res.json();

    if (!data.panel || !data.beban) {
      console.warn('⚠️ Data tidak lengkap:', data);
      return;
    }

    const dayaPanel = data.panel.power || 0;
    const dayaBeban = data.beban.power || 0;
    
    // 1. Tangkap Data Fuzzy dari Backend
    const suhuBaterai = data.beban.temperature || 0;
    const fuzzyStatus = data.beban.fuzzy_status || "Menunggu...";
    const fuzzyScore = data.beban.fuzzy_score || 0;

    // 2. Update metric card standar
    document.getElementById('power-produce').textContent = `${dayaPanel.toFixed(2)} W`;
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

    chart.data.labels.push(now);
    chart.data.datasets[0].data.push(dayaPanel);
    chart.data.datasets[1].data.push(dayaBeban);

    if (chart.data.labels.length > 10) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
      chart.data.datasets[1].data.shift();
    }

    chart.update();

  } catch (err) {
    console.error('❌ Gagal ambil data:', err);
  }
}

// =====================================================
//  DASHBOARD METRICS
// =====================================================
async function loadDashboardMetrics() {
  try {
    const res = await fetch('/api/dashboard/metrics');
    const data = await res.json();

    document.getElementById("energy-today").textContent = `${data.energy_today ?? 0} kWh`;
    document.getElementById("peak").textContent = `${data.peak_power ?? 0} W`;
    document.getElementById("avg-load").textContent = `${data.avg_load ?? 0} W`;
    document.getElementById("net-energy").textContent = `${data.net_energy ?? 0} kWh`;
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
//  AUTO UPDATE
// =====================================================
fetchLiveData();
loadDashboardMetrics();
setInterval(fetchLiveData, 5000);
setInterval(loadDashboardMetrics, 10000);
