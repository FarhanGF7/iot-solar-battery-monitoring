//  Fungsi Hitung Arah 
function hitungArah(servoX, servoY) {
    const condongBarat = servoY >= 90; // 90–180 = BARAT
  
    if (condongBarat) {
      if (servoX < 22) return "Utara";
      if (servoX < 67) return "Barat Laut";
      if (servoX < 112) return "Barat";
      if (servoX < 157) return "Barat Daya";
      return "Selatan";
    } else {
      if (servoX < 22) return "Selatan";
      if (servoX < 67) return "Tenggara";
      if (servoX < 112) return "Timur";
      if (servoX < 157) return "Timur Laut";
      return "Utara";
    }
  }
  
  //  Konversi UTC ke waktu lokal Samarinda (WITA) 
  function formatLocalTime(isoString) {
    if (!isoString) return "-";
    const d = new Date(isoString);
    return d.toLocaleString("id-ID", { timeZone: "Asia/Makassar" });
  }

  // Grafik Servo 
  const servoCtx = document.getElementById("servoChart").getContext("2d");
  const servoChart = new Chart(servoCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Servo X", data: [], borderColor: "blue", fill: false },
        { label: "Servo Y", data: [], borderColor: "red", fill: false },
      ],
    },
    options: { responsive: true },
  });
 
  // Grafik LDR 
  const ldrCtx = document.getElementById("ldrChart").getContext("2d");
  const ldrChart = new Chart(ldrCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "LDR1", data: [], borderColor: "green", fill: false },
        { label: "LDR2", data: [], borderColor: "orange", fill: false },
        { label: "LDR3", data: [], borderColor: "purple", fill: false },
        { label: "LDR4", data: [], borderColor: "brown", fill: false },
      ],
    },
    options: { responsive: true },
  });

  function addTableRow(d) {
    const table = document.querySelector("#historyTable tbody");
    const row = document.createElement("tr");
  
    row.innerHTML = `
        <td>${formatLocalTime(d.created_at || d.waktu)}</td>
        <td>${d.servoX}</td>
        <td>${d.servoY}</td>
        <td>${d.ldr1}</td>
        <td>${d.ldr2}</td>
        <td>${d.ldr3}</td>
        <td>${d.ldr4}</td>
        <td>${hitungArah(d.servoX, d.servoY)}</td>
    `;
  
    table.prepend(row);
  }
  let lastTimestamp = "";
  
  async function loadHistory(tanggal = "") {
    try {
      let url = "/history";
      if (tanggal) url += `?date=${tanggal}`;
  
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
  
      // Kosongkan data lama
      document.querySelector("#historyTable tbody").innerHTML = "";
      servoChart.data.labels = [];
      servoChart.data.datasets.forEach((ds) => (ds.data = []));
      ldrChart.data.labels = [];
      ldrChart.data.datasets.forEach((ds) => (ds.data = []));
  
      if (!rows.length) {
        console.log("⚠️ Tidak ada data pada tanggal ini");
        servoChart.update();
        ldrChart.update();
        return;
      }
  
      // Masukkan data ke tabel dan grafik
      rows.reverse().forEach((data) => {
        addTableRow(data);
  
        servoChart.data.labels.push(formatLocalTime(data.created_at));
        servoChart.data.datasets[0].data.push(data.servoX);
        servoChart.data.datasets[1].data.push(data.servoY);
  
        ldrChart.data.labels.push(formatLocalTime(data.created_at));
        ldrChart.data.datasets[0].data.push(data.ldr1);
        ldrChart.data.datasets[1].data.push(data.ldr2);
        ldrChart.data.datasets[2].data.push(data.ldr3);
        ldrChart.data.datasets[3].data.push(data.ldr4);
      });
      servoChart.update();
      ldrChart.update();
      // Update waktu terakhir
      lastTimestamp = rows[rows.length - 1].created_at;
      // Update info card
      const last = rows[rows.length - 1];
      document.getElementById("posX").innerText = last.servoX + " °";
      document.getElementById("posY").innerText = last.servoY + " °";
      document.getElementById("trackerStatus").innerText = hitungArah(last.servoX, last.servoY);
    } catch (err) {
      console.error("❌ Gagal load history:", err);
    }
  }
  async function loadRealtimeData() {
    try {
      const tanggal = document.getElementById("tanggalTracker").value;
      // Jangan update realtime jika sedang filter tanggal
      if (tanggal) return;
  
      const res = await fetch("/latest");
      if (!res.ok) {
        console.warn("❌ Endpoint tidak ditemukan:", res.status);
        return;
      }
      const data = await res.json();
      // Jika data sama → skip
      if (data.waktu === lastTimestamp) return;
      lastTimestamp = data.waktu;
      const time = formatLocalTime(data.waktu);
      // Update chart Servo
      servoChart.data.labels.push(time);
      servoChart.data.datasets[0].data.push(data.servoX);
      servoChart.data.datasets[1].data.push(data.servoY);
      if (servoChart.data.labels.length > 20) {
        servoChart.data.labels.shift();
        servoChart.data.datasets.forEach((ds) => ds.data.shift());
      }
      servoChart.update();
      // Update chart LDR
      ldrChart.data.labels.push(time);
      ldrChart.data.datasets[0].data.push(data.ldr1);
      ldrChart.data.datasets[1].data.push(data.ldr2);
      ldrChart.data.datasets[2].data.push(data.ldr3);
      ldrChart.data.datasets[3].data.push(data.ldr4);
      if (ldrChart.data.labels.length > 20) {
        ldrChart.data.labels.shift();
        ldrChart.data.datasets.forEach((ds) => ds.data.shift());
      }
      ldrChart.update();
      // Update tabel realtime
      addTableRow(data);
      // Update Info Card
      document.getElementById("posX").innerText = data.servoX + " °";
      document.getElementById("posY").innerText = data.servoY + " °";
      document.getElementById("trackerStatus").innerText = hitungArah(data.servoX, data.servoY);
    } catch (err) {
      console.error("Error realtime:", err);
    }
  }
  // Event Listener Filter Tanggal 
  document.getElementById("tanggalTracker").addEventListener("change", () => {
    const tgl = document.getElementById("tanggalTracker").value;
    loadHistory(tgl);
  });
  //  Inisialisasi 
  loadHistory(); 
  setInterval(loadRealtimeData, 1000); 
