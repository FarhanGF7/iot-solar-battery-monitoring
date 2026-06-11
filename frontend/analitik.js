// analitik.js

let powerChart, tempChart, fuzzyChart;

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof renderSession === "function") await renderSession();
    await loadPowerChart();
    await loadDashboardMetrics();
});


/* ========== GRAFIK PRODUKSI vs BATERAI ========== */
/* ========== GRAFIK GABUNGAN (POWER, SUHU, FUZZY) ========== */
async function loadPowerChart(filterDate = null) {
  const ctxPower = document.getElementById('powerChart').getContext('2d');
  const ctxTemp = document.getElementById('tempChart').getContext('2d');
  const ctxFuzzy = document.getElementById('fuzzyChart').getContext('2d');

  let url = '/api/data/combined';
  if (filterDate) {
      url += `?date=${filterDate}`;
  }

  try {
      const res = await fetch(url);
      const records = await res.json();

      const deviceStatus = document.getElementById('device-status');
      if (deviceStatus) {
        deviceStatus.textContent = 'Online 🟢';
        deviceStatus.style.color = '#2ecc71';
        deviceStatus.style.background = 'rgba(46,204,113,0.1)';
        deviceStatus.style.borderColor = 'rgba(46,204,113,0.2)';
      }

      const labels = records.map(r => new Date(r.timestamp).toLocaleTimeString());
      
      const baterai = records.map(r => r.baterai_power || 0);
      
      // Data Fuzzy Baru yang diambil dari backend
      const suhu = records.map(r => r.baterai_temperature || 0);
      const fuzzyScore = records.map(r => r.fuzzy_score || 0);

      // 1. Chart Daya Input Baterai
      if (powerChart) powerChart.destroy();
      powerChart = new Chart(ctxPower, {
          type: 'line',
          data: {
              labels,
              datasets: [
                  { label: 'Daya Input Baterai (W)', data: baterai, borderColor: 'cyan', borderWidth: 2, fill: false }
              ]
          },
          options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });

      // 2. Chart Suhu Baterai
      if (tempChart) tempChart.destroy();
      tempChart = new Chart(ctxTemp, {
          type: 'line',
          data: {
              labels,
              datasets: [{
                  label: 'Suhu Baterai (°C)',
                  data: suhu,
                  borderColor: '#ff9800', // Warna Oranye
                  borderWidth: 2,
                  fill: false
              }]
          },
          options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });

      // 3. Chart Evaluasi Fuzzy Score
      if (fuzzyChart) fuzzyChart.destroy();
      fuzzyChart = new Chart(ctxFuzzy, {
          type: 'line',
          data: {
              labels,
              datasets: [{
                  label: 'Fuzzy Score (Kesehatan Baterai)',
                  data: fuzzyScore,
                  borderColor: '#28a745', // Warna Hijau
                  backgroundColor: 'rgba(40, 167, 69, 0.2)', // Fill hijau transparan
                  borderWidth: 2,
                  fill: true
              }]
          },
          options: { 
              responsive: true, 
              scales: { 
                  y: { 
                      beginAtZero: true, 
                      max: 100 // Karena skor Fuzzy maksimal 100
                  } 
              } 
          }
      });

  } catch (err) {
      console.error('Gagal ambil data gabungan:', err);
      const deviceStatus = document.getElementById('device-status');
      if (deviceStatus) {
        deviceStatus.textContent = 'Offline 🔴';
        deviceStatus.style.color = '#ff5252';
        deviceStatus.style.background = 'rgba(255,82,82,0.1)';
        deviceStatus.style.borderColor = 'rgba(255,82,82,0.2)';
      }
  }
}


/* ========== DASHBOARD METRICS ========== */
async function loadDashboardMetrics() {
    try {
        const resMetrics = await fetch("/api/dashboard/metrics");
        const dataMetrics = await resMetrics.json();
        
        const resLatest = await fetch("/api/data/latest");
        const dataLatest = await resLatest.json();

        document.getElementById("avg-load-power").textContent = (dataMetrics.avg_load ?? 0) + " W";
        document.getElementById("last-temp").textContent = (dataLatest.baterai.temperature ?? 0) + " °C";
        document.getElementById("last-fuzzy").textContent = (dataLatest.baterai.fuzzy_status ?? "--") + ` (${dataLatest.baterai.fuzzy_score ?? 0})`;

    } catch (err) {
        console.error("Gagal ambil dashboard metrics:", err);
    }
}


/* ========== EXPORT CSV (Panel + Baterai + Suhu + Fuzzy) ========== */
const exportBtn = document.getElementById("exportBtn");

if (exportBtn) {
  exportBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/data/full"); // Route getAllPanelBaterai di backend
      const records = await res.json();

      // Tambahkan header CSV baru untuk Suhu, Fuzzy Score, dan Status
      let csvContent =
        "Timestamp,Tegangan Baterai (V),Arus Baterai (A),Daya Baterai (W),Suhu Baterai (C),Fuzzy Score,Status Baterai\n";

      function csvEscape(value) {
        if (value === null || value === undefined) return '""';
        const s = String(value);
        return `"${s.replace(/"/g, '""')}"`;
      }

      records.forEach(r => {
        const d = new Date(r.timestamp);
        const timeStr = `${d.toLocaleDateString("id-ID")} ${d.toLocaleTimeString("id-ID")}`;

        const bateraiV = r.baterai_voltage ?? "";
        const bateraiI = r.baterai_current ?? "";
        const bateraiP = r.baterai_power ?? "";
        
        // Ambil data fuzzy
        const suhu = r.baterai_temperature ?? "";
        const fScore = r.fuzzy_score ?? "";
        const fStatus = r.fuzzy_status ?? "";

        const row = [
          csvEscape(timeStr),
          csvEscape(bateraiV), csvEscape(bateraiI), csvEscape(bateraiP),
          csvEscape(suhu), csvEscape(fScore), csvEscape(fStatus)
        ].join(",");

        csvContent += row + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "Data_Evaluasi_Baterai_Fuzzy.csv";
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal export CSV:", err);
    }
  });
}

/* ========== FILTER TANGGAL ========== */
const dateFilter = document.getElementById("dateFilter");

if (dateFilter) {
    dateFilter.addEventListener("change", async (e) => {
        const date = e.target.value;
        await loadPowerChart(date);
    });
}