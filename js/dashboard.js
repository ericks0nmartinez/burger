// Load data from localStorage
const orders = JSON.parse(localStorage.getItem('orders') || '[]');
const controlOrders = JSON.parse(localStorage.getItem('controlOrders') || '[]');
const allOrders = [...orders, ...controlOrders];

// Fetch products for item names and prices
async function fetchProducts() {
    try {
        const response = await fetch('../utils/products.json');
        if (!response.ok) {
            throw new Error(`Erro ao carregar produtos: ${response.status}`);
        }
        const products = await response.json();
        return products.reduce((acc, p) => ({ ...acc, [p.id]: { name: p.name, price: p.price || 0 } }), {});
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        return {};
    }
}

// Calculate business metrics
async function calculateMetrics() {
    const products = await fetchProducts();
    const currentDate = new Date('2025-07-25T15:45:00-04:00'); // Set to current time

    // Total snacks sold
    const totalSnacks = allOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
    document.getElementById('totalSnacks').textContent = totalSnacks;

    // Total revenue
    const totalRevenue = allOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + (products[item.id]?.price || 0) * item.qty, 0);
    }, 0);
    document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2);

    // Revenue by period (text display)
    const dailyRevenue = allOrders
        .filter(order => new Date(order.time).toDateString() === currentDate.toDateString())
        .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (products[item.id]?.price || 0) * item.qty, 0), 0);
    document.getElementById('dailyRevenue').textContent = dailyRevenue.toFixed(2);

    const weeklyStart = new Date(currentDate);
    weeklyStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week (Sunday)
    const weeklyRevenue = allOrders
        .filter(order => new Date(order.time) >= weeklyStart && new Date(order.time) <= currentDate)
        .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (products[item.id]?.price || 0) * item.qty, 0), 0);
    document.getElementById('weeklyRevenue').textContent = weeklyRevenue.toFixed(2);

    const monthlyStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthlyRevenue = allOrders
        .filter(order => new Date(order.time) >= monthlyStart && new Date(order.time) <= currentDate)
        .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (products[item.id]?.price || 0) * item.qty, 0), 0);
    document.getElementById('monthlyRevenue').textContent = monthlyRevenue.toFixed(2);

    // Peak day
    const ordersByDay = allOrders.reduce((acc, order) => {
        const day = new Date(order.time).toDateString();
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {});
    const peakDay = Object.keys(ordersByDay).reduce((a, b) => ordersByDay[a] > ordersByDay[b] ? a : b, Object.keys(ordersByDay)[0]);
    const peakOrders = ordersByDay[peakDay];
    document.getElementById('peakDay').textContent = peakDay;
    document.getElementById('peakOrders').textContent = peakOrders;

    // Item distribution chart
    const itemCounts = allOrders.reduce((acc, order) => {
        order.items.forEach(item => {
            acc[item.id] = (acc[item.id] || 0) + item.qty;
        });
        return acc;
    }, {});
    new Chart(document.getElementById('itemChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(itemCounts).map(id => products[id]?.name || `Item ${id}`),
            datasets: [{
                label: 'Quantidade Vendida',
                data: Object.values(itemCounts),
                backgroundColor: '#36A2EB'
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    // Payment method distribution
    const paymentCounts = allOrders.reduce((acc, order) => {
        acc[order.paymentMethod || 'Não especificado'] = (acc[order.paymentMethod || 'Não especificado'] || 0) + 1;
        return acc;
    }, {});
    new Chart(document.getElementById('paymentChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(paymentCounts),
            datasets: [{
                data: Object.values(paymentCounts),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
            }]
        },
        options: { responsive: true }
    });

    // Revenue by day with two columns
    const dailyData = allOrders.reduce((acc, order) => {
        const day = new Date(order.time).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
        if (!acc[day]) {
            acc[day] = { revenue: 0, snacks: 0 };
        }
        acc[day].revenue += order.items.reduce((sum, item) => sum + (products[item.id]?.price || 0) * item.qty, 0);
        acc[day].snacks += order.items.reduce((sum, item) => sum + item.qty, 0);
        return acc;
    }, {});
    new Chart(document.getElementById('dailyChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(dailyData),
            datasets: [
                {
                    label: 'Faturado (R$)',
                    data: Object.values(dailyData).map(d => d.revenue),
                    backgroundColor: '#36A2EB'
                },
                {
                    label: 'Lanches Vendidos',
                    data: Object.values(dailyData).map(d => d.snacks),
                    backgroundColor: '#FF6384'
                }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    // Revenue by week with two columns
    const weeklyData = allOrders.reduce((acc, order) => {
        const weekStart = new Date(new Date(order.time).setDate(new Date(order.time).getDate() - new Date(order.time).getDay()));
        const weekLabel = `${weekStart.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} - ${new Date(weekStart.setDate(weekStart.getDate() + 6)).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}`;
        if (!acc[weekLabel]) {
            acc[weekLabel] = { revenue: 0, snacks: 0 };
        }
        acc[weekLabel].revenue += order.items.reduce((sum, item) => sum + (products[item.id]?.price || 0) * item.qty, 0);
        acc[weekLabel].snacks += order.items.reduce((sum, item) => sum + item.qty, 0);
        return acc;
    }, {});
    new Chart(document.getElementById('weeklyChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(weeklyData),
            datasets: [
                {
                    label: 'Faturado (R$)',
                    data: Object.values(weeklyData).map(d => d.revenue),
                    backgroundColor: '#FF6384'
                },
                {
                    label: 'Lanches Vendidos',
                    data: Object.values(weeklyData).map(d => d.snacks),
                    backgroundColor: '#36A2EB'
                }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    // Revenue by month with two columns
    const monthlyData = allOrders.reduce((acc, order) => {
        const month = new Date(order.time).toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!acc[month]) {
            acc[month] = { revenue: 0, snacks: 0 };
        }
        acc[month].revenue += order.items.reduce((sum, item) => sum + (products[item.id]?.price || 0) * item.qty, 0);
        acc[month].snacks += order.items.reduce((sum, item) => sum + item.qty, 0);
        return acc;
    }, {});
    new Chart(document.getElementById('monthlyChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(monthlyData),
            datasets: [
                {
                    label: 'Faturado (R$)',
                    data: Object.values(monthlyData).map(d => d.revenue),
                    backgroundColor: '#FFCE56'
                },
                {
                    label: 'Lanches Vendidos',
                    data: Object.values(monthlyData).map(d => d.snacks),
                    backgroundColor: '#4BC0C0'
                }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    // Revenue by year with two columns
    const yearlyData = allOrders.reduce((acc, order) => {
        const year = new Date(order.time).getFullYear();
        if (!acc[year]) {
            acc[year] = { revenue: 0, snacks: 0 };
        }
        acc[year].revenue += order.items.reduce((sum, item) => sum + (products[item.id]?.price || 0) * item.qty, 0);
        acc[year].snacks += order.items.reduce((sum, item) => sum + item.qty, 0);
        return acc;
    }, {});
    new Chart(document.getElementById('yearlyChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(yearlyData),
            datasets: [
                {
                    label: 'Faturado (R$)',
                    data: Object.values(yearlyData).map(d => d.revenue),
                    backgroundColor: '#4BC0C0'
                },
                {
                    label: 'Lanches Vendidos',
                    data: Object.values(yearlyData).map(d => d.snacks),
                    backgroundColor: '#FFCE56'
                }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

calculateMetrics();