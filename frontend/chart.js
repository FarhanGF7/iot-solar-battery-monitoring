const ctx = document.getElementById('lineChart').getContext('2d');

window.lineChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Daya Input Baterai (W)',
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.4
      }
    ]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#fff' } }
    },
    scales: {
      x: {
        ticks: { color: '#fff' },
        title: { display: true, text: 'Waktu', color: '#fff' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#fff' },
        title: { display: true, text: 'Daya (Watt)', color: '#fff' }
      }
    }
  }
});
