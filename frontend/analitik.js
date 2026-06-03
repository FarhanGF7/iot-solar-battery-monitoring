// analitik.js

let powerChart, energyChart, tempChart, fuzzyChart;;

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof renderSession === "function") await renderSession();
    await loadPowerChart();
    await loadEnergyChart();
    await loadDashboardMetrics();
});


/* ========== GRAFIK PRODUKSI vs BEBAN ========== */
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

      const labels = records.map(r => new Date(r.timestamp).toLocaleTimeString());
      
      const produksi = records.map(r => r.panel_power);
      const beban = records.map(r => r.beban_power || 0);
      
      // Data Fuzzy Baru yang diambil dari backend
      const suhu = records.map(r => r.beban_temperature || 0);
      const fuzzyScore = records.map(r => r.fuzzy_score || 0);

      // 1. Chart Produksi vs Beban (Asli)
      if (powerChart) powerChart.destroy();
      powerChart = new Chart(ctxPower, {
          type: 'line',
          data: {
              labels,
              datasets: [
                  { label: 'Produksi (W)', data: produksi, borderColor: 'yellow', borderWidth: 2, fill: false },
                  { label: 'Beban (W)', data: beban, borderColor: 'cyan', borderWidth: 2, fill: false }
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
  }
}


/* ========== GRAFIK ENERGI HARIAN ========== */
async function loadEnergyChart() {
    const ctx = document.getElementById("energyChart").getContext("2d");

    try {
        const res = await fetch("/api/history");
        const records = await res.json();

        const labels = records.map(r => r.date);
        const energi = records.map(r => r.energy_kWh);

        if (energyChart) energyChart.destroy();
        energyChart = new Chart(ctx, {
          type: "line",
          data: {
              labels,
              datasets: [{
                  label: "Energi Harian (kWh)",
                  data: energi,
                  borderColor: "yellow",
                  borderWidth: 2,
                  fill: false
              }]
          },
          options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    } catch (err) {
        console.error("Gagal ambil data energi harian:", err);
    }
}

/* ========== DASHBOARD METRICS ========== */
async function loadDashboardMetrics() {
    try {
        const res = await fetch("/api/dashboard/metrics");
        const data = await res.json();

        document.getElementById("energy-today").textContent = (data.energy_today ?? 0) + " kWh";
        document.getElementById("peak-power").textContent = (data.peak_power ?? 0) + " W";

        // Tampilkan efisiensi langsung dari backend
        document.getElementById("efficiency").textContent = (data.efficiency ?? 0) + " %";

    } catch (err) {
        console.error("Gagal ambil dashboard metrics:", err);
    }
}


/* ========== EXPORT CSV (Panel + Beban + Suhu + Fuzzy) ========== */
const exportBtn = document.getElementById("exportBtn");

if (exportBtn) {
  exportBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/data/full"); // Route getAllPanelBeban di backend
      const records = await res.json();

      // Tambahkan header CSV baru untuk Suhu, Fuzzy Score, dan Status
      let csvContent =
        "Timestamp,Panel Voltage (V),Panel Current (A),Panel Power (W),Beban Voltage (V),Beban Current (A),Beban Power (W),Suhu Baterai (C),Fuzzy Score,Status Baterai\n";

      function csvEscape(value) {
        if (value === null || value === undefined) return '""';
        const s = String(value);
        return `"${s.replace(/"/g, '""')}"`;
      }

      records.forEach(r => {
        const d = new Date(r.timestamp);
        const timeStr = `${d.toLocaleDateString("id-ID")} ${d.toLocaleTimeString("id-ID")}`;

        const panelV = r.panel_voltage ?? "";
        const panelI = r.panel_current ?? "";
        const panelP = r.panel_power ?? "";
        const bebanV = r.beban_voltage ?? "";
        const bebanI = r.beban_current ?? "";
        const bebanP = r.beban_power ?? "";
        
        // Ambil data fuzzy
        const suhu = r.beban_temperature ?? "";
        const fScore = r.fuzzy_score ?? "";
        const fStatus = r.fuzzy_status ?? "";

        const row = [
          csvEscape(timeStr), csvEscape(panelV), csvEscape(panelI), csvEscape(panelP),
          csvEscape(bebanV), csvEscape(bebanI), csvEscape(bebanP),
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