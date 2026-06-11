// log_data.js

async function fetchLogData() {
  try {
    const res = await fetch('/api/data/full');
    const records = await res.json();

    const deviceStatus = document.getElementById('device-status');
    if (deviceStatus) {
      deviceStatus.textContent = 'Online 🟢';
      deviceStatus.style.color = '#2ecc71';
      deviceStatus.style.background = 'rgba(46,204,113,0.1)';
      deviceStatus.style.borderColor = 'rgba(46,204,113,0.2)';
    }

    const tableBody = document.getElementById('logTableBody');
    if (!tableBody) return;

    if (!Array.isArray(records) || records.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="padding: 20px; color: #94a3b8;">Belum ada data sensor.</td></tr>`;
      return;
    }

    // Tampilkan data terbaru paling atas (descending)
    const sortedRecords = [...records].reverse();

    let html = '';
    sortedRecords.forEach(row => {
      const timeStr = new Date(row.timestamp).toLocaleString('id-ID', {
        dateStyle: 'short',
        timeStyle: 'medium'
      });

      const bateraiVolt = row.baterai_voltage !== null ? row.baterai_voltage.toFixed(2) : '0.00';
      const bateraiCurr = row.baterai_current !== null ? row.baterai_current.toFixed(2) : '0.00';
      const bateraiPow = row.baterai_power !== null ? row.baterai_power.toFixed(2) : '0.00';
      const bateraiTemp = row.baterai_temperature !== null ? row.baterai_temperature.toFixed(1) : '0.0';

      const fuzzyScore = row.fuzzy_score !== null ? row.fuzzy_score.toFixed(1) : '0.0';
      const fuzzyStatus = row.fuzzy_status || 'Tidak Diketahui';

      // Warna status fuzzy
      let statusColor = '#94a3b8'; // Default grey
      if (fuzzyStatus === 'Baik') statusColor = '#2ecc71';
      else if (fuzzyStatus === 'Waspada') statusColor = '#f1c40f';
      else if (fuzzyStatus === 'Kritis') statusColor = '#e74c3c';

      html += `
        <tr>
          <td style="font-family: monospace;">${timeStr}</td>
          <td>${bateraiVolt} V</td>
          <td>${bateraiCurr} A</td>
          <td style="color: #3498db; font-weight: 500;">${bateraiPow} W</td>
          <td>${bateraiTemp} °C</td>
          <td style="font-weight: 500;">${fuzzyScore}</td>
          <td style="color: ${statusColor}; font-weight: bold;">${fuzzyStatus}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;

  } catch (err) {
    console.error('❌ Gagal mengambil log data sensor:', err);
    const deviceStatus = document.getElementById('device-status');
    if (deviceStatus) {
      deviceStatus.textContent = 'Offline 🔴';
      deviceStatus.style.color = '#ff5252';
      deviceStatus.style.background = 'rgba(255,82,82,0.1)';
      deviceStatus.style.borderColor = 'rgba(255,82,82,0.2)';
    }
    const tableBody = document.getElementById('logTableBody');
    if (tableBody && tableBody.innerHTML.includes('Sedang memuat data')) {
      tableBody.innerHTML = `<tr><td colspan="7" style="padding: 20px; color: #ff5252;">Terjadi kesalahan saat memuat data.</td></tr>`;
    }
  }
}

// Jalankan saat halaman dibuka dan ulangi setiap 5 detik
document.addEventListener('DOMContentLoaded', () => {
  fetchLogData();
  setInterval(fetchLogData, 5000);
});
