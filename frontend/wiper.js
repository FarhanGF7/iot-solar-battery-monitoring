const dustCtx = document.getElementById("dustChart");

const dustChart = new Chart(dustCtx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Debu (mg/m³)",
      data: [],
      borderColor: "#007bff",
      borderWidth: 2,
      tension: 0.4,
      fill: false
    }]
  },
  options: {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Debu (mg/m³)"
        }
      },
      x: {
        title: {
          display: true,
          text: "Waktu"
        }
      }
    }
  }
});

async function loadWiperData() {
  try {
    const res = await fetch("http://localhost:3000/api/wiper");
    const rows = await res.json();

    if (!Array.isArray(rows) || rows.length === 0) return;

    // Reset data grafik
    dustChart.data.labels = [];
    dustChart.data.datasets[0].data = [];

    // Tambahkan data terbaru
    rows.reverse().forEach(row => {
      const time = new Date(row.created_at).toLocaleTimeString();
      dustChart.data.labels.push(time);
      dustChart.data.datasets[0].data.push(row.dust_level);
    });

    const last = rows[rows.length - 1];

    // Tampilkan nilai terakhir di dashboard
    document.getElementById("dustValue").innerText = last.dust_level + " mg/m³";

    dustChart.update();

  } catch (err) {
    console.error("Gagal ambil data wiper:", err);
  }
}

// Load awal dan refresh tiap 5 detik
loadWiperData();
setInterval(loadWiperData, 5000);

// Tombol download CSV
document.getElementById("downloadCSV").addEventListener("click", () => {
  window.location.href = "http://localhost:3000/api/wiper/csv";
});
