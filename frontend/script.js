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

    // Update metric card
    document.getElementById('power-produce').textContent = `${dayaPanel.toFixed(2)} W`;
    document.getElementById('power-load').textContent = `${dayaBeban.toFixed(2)} W`;

    // Tambah ke grafik
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
    document.getElementById("battery-health").textContent = `${data.battery_health ?? 0} %`;
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
