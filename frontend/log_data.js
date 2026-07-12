// log_data.js

let allRecords = [];

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

    if (Array.isArray(records)) {
      // Tampilkan data terbaru paling atas (descending)
      allRecords = [...records].reverse();
      renderTable(allRecords);
    }

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

function renderTable(recordsToRender) {
  const tableBody = document.getElementById('logTableBody');
  if (!tableBody) return;

  if (recordsToRender.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="padding: 20px; color: #94a3b8; text-align: center;">Belum ada data sensor.</td></tr>`;
    return;
  }

  let html = '';
  recordsToRender.forEach(row => {
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
}

function exportToCSV(recordsToExport) {
  if (!Array.isArray(recordsToExport) || recordsToExport.length === 0) {
    alert("Tidak ada data untuk diexport!");
    return;
  }

  let csvContent =
    "Waktu,Tegangan Baterai (V),Arus Baterai (A),Daya Baterai (W),Suhu Baterai (C),Fuzzy Score,Status Baterai\n";

  function csvEscape(value) {
    if (value === null || value === undefined) return '""';
    const s = String(value);
    return `"${s.replace(/"/g, '""')}"`;
  }

  // Gunakan urutan kronologis terlama ke terbaru untuk ekspor CSV
  const chronologicalRecords = [...recordsToExport].reverse();

  chronologicalRecords.forEach(r => {
    const d = new Date(r.timestamp);
    const timeStr = `${d.toLocaleDateString("id-ID")} ${d.toLocaleTimeString("id-ID")}`;

    const bateraiV = r.baterai_voltage !== null ? r.baterai_voltage.toFixed(2) : "";
    const bateraiI = r.baterai_current !== null ? r.baterai_current.toFixed(2) : "";
    const bateraiP = r.baterai_power !== null ? r.baterai_power.toFixed(2) : "";
    const suhu = r.baterai_temperature !== null ? r.baterai_temperature.toFixed(1) : "";
    const fScore = r.fuzzy_score !== null ? r.fuzzy_score.toFixed(1) : "";
    const fStatus = r.fuzzy_status || "";

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
  a.download = `Log_Data_Sensor_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

// Jalankan saat halaman dibuka
document.addEventListener('DOMContentLoaded', () => {
  fetchLogData();
  
  // Update data secara berkala setiap 5 detik
  setInterval(fetchLogData, 5000);

  // Setup tombol export CSV
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      exportToCSV(allRecords); // Export seluruh data log
    });
  }
});
