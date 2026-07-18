const db = require('../db').pool;

const ALLOWED_SENSORS = new Set(['INA219', 'DS18B20']);

function normalizeConnected(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
}

function ensureSensorEventsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS sensor_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      sensor_name VARCHAR(32) NOT NULL,
      status ENUM('TERPUTUS', 'TERSAMBUNG') NOT NULL,
      message VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_sensor_events_created_at (created_at),
      INDEX idx_sensor_events_sensor_name (sensor_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;

  db.query(query, (error) => {
    if (error) console.error('Gagal menyiapkan tabel sensor_events:', error);
  });
}

ensureSensorEventsTable();

const postSensorStatus = (req, res) => {
  const sensorName = String(req.body.sensor || '').toUpperCase();
  const connected = normalizeConnected(req.body.connected);

  if (!ALLOWED_SENSORS.has(sensorName) || connected === null) {
    return res.status(400).json({
      message: 'Data status sensor tidak valid'
    });
  }

  const status = connected ? 'TERSAMBUNG' : 'TERPUTUS';
  const message = connected
    ? `Sensor ${sensorName} kembali tersambung.`
    : `Sensor ${sensorName} terputus atau tidak terbaca.`;

  // ESP32 hanya mengirim ketika status berubah. Pemeriksaan ini mencegah
  // duplikasi jika event yang sama dikirim ulang karena respons HTTP terputus.
  const latestQuery = `
    SELECT status
    FROM sensor_events
    WHERE sensor_name = ?
    ORDER BY id DESC
    LIMIT 1
  `;

  db.query(latestQuery, [sensorName], (latestError, rows) => {
    if (latestError) {
      console.error('Gagal memeriksa status sensor terakhir:', latestError);
      return res.status(500).json({ message: 'Gagal memeriksa status sensor' });
    }

    if (rows.length > 0 && rows[0].status === status) {
      return res.json({
        message: 'Status sensor tidak berubah',
        duplicate: true,
        sensor: sensorName,
        status
      });
    }

    const insertQuery = `
      INSERT INTO sensor_events (sensor_name, status, message)
      VALUES (?, ?, ?)
    `;

    db.query(insertQuery, [sensorName, status, message], (insertError, result) => {
      if (insertError) {
        console.error('Gagal menyimpan event sensor:', insertError);
        return res.status(500).json({ message: 'Gagal menyimpan event sensor' });
      }

      const event = {
        id: result.insertId,
        sensor: sensorName,
        status,
        connected,
        message,
        timestamp: new Date().toISOString()
      };

      const io = req.app.get('io');
      if (io) {
        io.emit('sensorStatus', event);

        // Dipertahankan agar dashboard lama tetap menerima notifikasi error.
        if (!connected) {
          io.emit('sensorError', event);
        }
      }

      console.log(`🔌 [${sensorName}] ${status}`);
      return res.status(201).json({
        message: 'Status sensor tersimpan',
        event
      });
    });
  });
};

const getSensorEvents = (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 50;

  const query = `
    SELECT id, sensor_name, status, message, created_at
    FROM sensor_events
    ORDER BY id DESC
    LIMIT ?
  `;

  db.query(query, [limit], (error, rows) => {
    if (error) {
      console.error('Gagal mengambil riwayat sensor:', error);
      return res.status(500).json({ message: 'Gagal mengambil riwayat sensor' });
    }

    return res.json(rows);
  });
};

module.exports = {
  postSensorStatus,
  getSensorEvents,
  normalizeConnected
};
