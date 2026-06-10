const mysql = require('mysql2');

// Pool yang mendukung callback & promise
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'panel_monitor',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Untuk async/await (trackerController)
const promisePool = pool.promise();

// Untuk callback (dataController)
module.exports = promisePool;
module.exports.pool = pool;
