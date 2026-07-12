// analitik.js

let powerChart, tempChart, fuzzyChart;

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof renderSession === "function") await renderSession();
    
    // Tampilan awal saat belum memilih tanggal:
    // 1. Kosongkan nilai date picker agar menandakan tidak ada tanggal yang terpilih
    const dateFilter = document.getElementById("dateFilter");
    if (dateFilter) {
        dateFilter.value = "";
    }

    // 2. Load data dan grafik tanpa filter (tampilkan seluruh data di database)
    await loadPowerChart(null);
});


/* ========== GRAFIK GABUNGAN (POWER, SUHU, FUZZY) & RINGKASAN HARIAN ========== */
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

      // Jika data kosong untuk tanggal yang dipilih
      if (!Array.isArray(records) || records.length === 0) {
          if (powerChart) powerChart.destroy();
          if (tempChart) tempChart.destroy();
          if (fuzzyChart) fuzzyChart.destroy();

          document.getElementById("avg-load-power").textContent = "-- W";
          document.getElementById("last-temp").textContent = "-- °C";
          document.getElementById("last-fuzzy").textContent = "--";
          return;
      }

      // Hitung metrik ringkasan harian khusus untuk tanggal terpilih (atau keseluruhan jika null)
      const validPowerRecords = records.filter(r => r.baterai_power !== null);
      const avgPower = validPowerRecords.length > 0
        ? (validPowerRecords.reduce((sum, r) => sum + r.baterai_power, 0) / validPowerRecords.length).toFixed(2)
        : '0.00';

      const lastRecord = records[records.length - 1];
      const lastTemp = lastRecord && lastRecord.baterai_temperature !== null
        ? lastRecord.baterai_temperature.toFixed(1)
        : '0.0';
      const lastFuzzyStatus = lastRecord && lastRecord.fuzzy_status ? lastRecord.fuzzy_status : 'Tidak Diketahui';
      const lastFuzzyScore = lastRecord && lastRecord.fuzzy_score !== null ? lastRecord.fuzzy_score.toFixed(1) : '0.0';

      // Update ringkasan kartu harian di HTML khusus tanggal terpilih (atau keseluruhan)
      document.getElementById("avg-load-power").textContent = `${avgPower} W`;
      document.getElementById("last-temp").textContent = `${lastTemp} °C`;
      document.getElementById("last-fuzzy").textContent = `${lastFuzzyStatus} (${lastFuzzyScore})`;

      // Buat label sumbu X (menyertakan Tanggal & Waktu di label asli untuk tooltip, sumbu X bawah hanya Jam)
      const labels = records.map(r => {
          const d = new Date(r.timestamp);
          const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const timeStr = d.toLocaleTimeString('id-ID');
          return `${dateStr} ${timeStr}`;
      });
      
      const baterai = records.map(r => r.baterai_power || 0);
      const suhu = records.map(r => r.baterai_temperature || 0);
      const fuzzyScore = records.map(r => r.fuzzy_score || 0);

      // Konfigurasi sumbu X yang disesuaikan secara dinamis
      const ticksConfig = {
          color: '#e2e8f0',
          font: { size: 13 },
          callback: function(val, index) {
              const label = this.getLabelForValue(val);
              if (typeof label === 'string') {
                  if (filterDate) {
                      // Jika difilter per tanggal, tampilkan Jam saja (misal: 10:30:15)
                      return label.includes(' ') ? label.split(' ')[1] : label;
                  } else {
                      // Jika menampilkan seluruh data, tampilkan Tanggal + Jam Singkat (misal: 23/06 10:30)
                      const parts = label.split(' ');
                      if (parts.length === 2) {
                          const datePart = parts[0].substring(0, 5); // Ambil "DD/MM" dari "DD/MM/YYYY"
                          const timePart = parts[1].substring(0, 5); // Ambil "HH:MM" dari "HH:MM:SS"
                          return `${datePart} ${timePart}`;
                      }
                  }
              }
              return label;
          }
      };
      const yAxisConfig = {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.12)' },
          ticks: { color: '#e2e8f0', font: { size: 13 } }
      };

      // 1. Chart Daya Input Baterai
      if (powerChart) powerChart.destroy();
      powerChart = new Chart(ctxPower, {
          type: 'line',
          data: {
              labels,
              datasets: [
                  { 
                      label: 'Daya Input Baterai (W)', 
                      data: baterai, 
                      borderColor: 'cyan', 
                      borderWidth: 3, 
                      fill: false,
                      pointRadius: 3,
                      pointHoverRadius: 6
                  }
              ]
          },
          options: { 
              responsive: true, 
              scales: { 
                  x: { 
                      grid: { color: 'rgba(255, 255, 255, 0.12)' },
                      ticks: ticksConfig 
                  },
                  y: yAxisConfig
              } 
          }
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
                  borderColor: '#ff9800',
                  borderWidth: 3,
                  fill: false,
                  pointRadius: 3,
                  pointHoverRadius: 6
              }]
          },
          options: { 
              responsive: true, 
              scales: { 
                  x: { 
                      grid: { color: 'rgba(255, 255, 255, 0.12)' },
                      ticks: ticksConfig 
                  },
                  y: yAxisConfig
              } 
          }
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
                  borderColor: '#28a745',
                  backgroundColor: 'rgba(40, 167, 69, 0.2)',
                  borderWidth: 3,
                  fill: true,
                  pointRadius: 3,
                  pointHoverRadius: 6
              }]
          },
          options: { 
              responsive: true, 
              scales: { 
                  x: { 
                      grid: { color: 'rgba(255, 255, 255, 0.12)' },
                      ticks: ticksConfig 
                  },
                  y: { 
                      ...yAxisConfig,
                      max: 100
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




/* ========== FILTER TANGGAL ========== */
const dateFilter = document.getElementById("dateFilter");

if (dateFilter) {
    dateFilter.addEventListener("change", async (e) => {
        const date = e.target.value;
        await loadPowerChart(date);
    });
}