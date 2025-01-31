const userCtx = document.getElementById('userChart').getContext('2d');
const postCtx = document.getElementById('postChart').getContext('2d');

// Gráfico de Usuários
new Chart(userCtx, {
    type: 'doughnut',
    data: {
        labels: ['Admins', 'Usuários Comuns'],
        datasets: [{
            data: [10, 50],
            backgroundColor: ['#007bff', '#ffc107']
        }]
    }
});

// Gráfico de Posts
new Chart(postCtx, {
    type: 'bar',
    data: {
        labels: ['Janeiro', 'Fevereiro', 'Março'],
        datasets: [{
            label: 'Posts',
            data: [5, 12, 8],
            backgroundColor: '#28a745'
        }]
    }
});
