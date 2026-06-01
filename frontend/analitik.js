// analitik.js

let powerChart, energyChart;

document.addEventListener("DOMContentLoaded", async () => {
    await renderSession();
    await loadPowerChart();
    await loadEnergyChart();
    await loadDashboardMetrics();
});


/* ========== GRAFIK PRODUKSI vs BEBAN ========== */
async function loadPowerChart(filterDate = null) {
  const ctx = document.getElementById('powerChart').getContext('2d');

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

      if (powerChart) powerChart.destroy();

      powerChart = new Chart(ctx, {
          type: 'line',
          data: {
              labels,
              datasets: [
                  {
                      label: 'Produksi (W)',
                      data: produksi,
                      borderColor: 'yellow',
                      borderWidth: 2,
                      fill: false
                  },
                  {
                      label: 'Beban (W)',
                      data: beban,
                      borderColor: 'cyan',
                      borderWidth: 2,
                      fill: false
                  }
              ]
          },
          options: {
              responsive: true,
              scales: { y: { beginAtZero: true } }
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
          options: {
              responsive: true,
              scales: { y: { beginAtZero: true } }
          }
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

        document.getElementById("energy-today").textContent = data.energy_today + " kWh";
        document.getElementById("peak-power").textContent = data.peak_power + " W";

        // Tampilkan efisiensi langsung dari backend
        document.getElementById("efficiency").textContent = data.efficiency + " %";

    } catch (err) {
        console.error("Gagal ambil dashboard metrics:", err);
    }
}


/* ========== EXPORT CSV (Panel + Beban + Timestamp) ========== */
/* EXPORT CSV */
const exportBtn = document.getElementById("exportBtn");

if (exportBtn) {
  exportBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/data/full");
      const records = await res.json();

      // Header CSV
      let csvContent =
        "Timestamp,Panel Voltage (V),Panel Current (A),Panel Power (W),Beban Voltage (V),Beban Current (A),Beban Power (W)\n";

      // Helper: escape CSV (double quotes and wrap)
      function csvEscape(value) {
        if (value === null || value === undefined) return '""';
        const s = String(value);
        return `"${s.replace(/"/g, '""')}"`;
      }

      records.forEach(r => {
        // Buat timestamp tanpa koma: gunakan date + time secara eksplisit
        const d = new Date(r.timestamp);
        const timeStr = `${d.toLocaleDateString("id-ID")} ${d.toLocaleTimeString("id-ID")}`;

        // Ambil nilai yang benar dari object (pastikan backend mengirim nama-nama ini)
        const panelV = r.panel_voltage ?? r.panelVoltage ?? "";
        const panelI = r.panel_current ?? r.panelCurrent ?? "";
        const panelP = r.panel_power ?? r.panelPower ?? "";
        const bebanV = r.beban_voltage ?? r.bebanVoltage ?? "";
        const bebanI = r.beban_current ?? r.bebanCurrent ?? "";
        const bebanP = r.beban_power ?? r.bebanPower ?? "";

        // Gabungkan dengan escaping agar koma di dalam nilai tidak merusak format CSV
        const row = [
          csvEscape(timeStr),
          csvEscape(panelV),
          csvEscape(panelI),
          csvEscape(panelP),
          csvEscape(bebanV),
          csvEscape(bebanI),
          csvEscape(bebanP)
        ].join(",");

        csvContent += row + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "data_panel_beban.csv";
      a.click();

      // Bebaskan resource
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Gagal export CSV:", err);
    }
  });
}

/* ========== FILTER TANGGAL UNTUK GRAFIK PRODUKSI ========== */
const dateFilter = document.getElementById("dateFilter");

if (dateFilter) {
    dateFilter.addEventListener("change", async (e) => {
        const date = e.target.value;
        await loadPowerChart(date);
    });
}
