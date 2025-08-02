let controlOrders = [];
let products = {};
const apiUrl = "http://192.168.1.67:3000";

async function fetchProducts() {
    try {
        const response = await fetch(`${apiUrl}/api/products/burgers`);
        if (!response.ok) {
            throw new Error(`Erro ao carregar produtos: ${response.status} - ${response.statusText}`);
        }
        const result = await response.json();
        return Array.isArray(result.data) ? result.data.reduce((acc, p) => ({ ...acc, [p.id]: { name: p.name, price: p.price || 0 } }), {}) : {};
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        return {};
    }
}

function populateYearFilter(orders) {
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) {
        console.error('Element with ID "yearFilter" not found in the DOM');
        return;
    }
    yearFilter.innerHTML = '<option value="">Todos os Anos</option>';
    const years = new Set(orders.map(order => new Date(order.time).getFullYear()));
    Array.from(years).sort((a, b) => a - b).forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
    console.log('Year filter populated with years:', Array.from(years));
}

function populateMonthFilter(orders, selectedYear) {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) {
        console.error('Element with ID "monthFilter" not found in the DOM');
        return;
    }
    monthFilter.innerHTML = '<option value="">Todos os Meses</option>';
    const months = new Set();
    orders.forEach(order => {
        const orderDate = new Date(order.time);
        if (selectedYear === '' || orderDate.getFullYear() === parseInt(selectedYear)) {
            months.add(orderDate.getMonth());
        }
    });
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    Array.from(months).sort((a, b) => a - b).forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = monthNames[month];
        monthFilter.appendChild(option);
    });
    console.log('Month filter populated with months:', Array.from(months));
}

function populateWeekFilter(orders, selectedYear, selectedMonth) {
    const weekFilter = document.getElementById('weekFilter');
    if (!weekFilter) {
        console.error('Element with ID "weekFilter" not found in the DOM');
        return;
    }
    weekFilter.innerHTML = '<option value="">Todas as Semanas</option>';
    const weeks = new Set();
    orders.forEach(order => {
        const orderDate = new Date(order.time);
        if ((selectedYear === '' || orderDate.getFullYear() === parseInt(selectedYear)) &&
            (selectedMonth === '' || orderDate.getMonth() === parseInt(selectedMonth))) {
            const weekStart = new Date(orderDate);
            weekStart.setDate(orderDate.getDate() - orderDate.getDay());
            const weekLabel = `${weekStart.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} - ${new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}`;
            weeks.add(weekLabel);
        }
    });
    Array.from(weeks).sort().forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = week;
        weekFilter.appendChild(option);
    });
    console.log('Week filter populated with weeks:', Array.from(weeks));
}

function populateDayFilter(orders, selectedYear, selectedMonth) {
    const dayFilter = document.getElementById('dayFilter');
    if (!dayFilter) {
        console.error('Element with ID "dayFilter" not found in the DOM');
        return;
    }
    dayFilter.innerHTML = '<option value="">Todos os Dias</option>';
    const days = new Set();
    orders.forEach(order => {
        const orderDate = new Date(order.time);
        if ((selectedYear === '' || orderDate.getFullYear() === parseInt(selectedYear)) &&
            (selectedMonth === '' || orderDate.getMonth() === parseInt(selectedMonth))) {
            days.add(orderDate.getDate());
        }
    });
    Array.from(days).sort((a, b) => a - b).forEach(day => {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = day.toString().padStart(2, '0');
        dayFilter.appendChild(option);
    });
    console.log('Day filter populated with days:', Array.from(days));
}

function filterOrders(orders, year, month, week, day) {
    return orders.filter(order => {
        const orderDate = new Date(order.time);
        const matchesYear = year === '' || orderDate.getFullYear() === parseInt(year);
        const matchesMonth = month === '' || orderDate.getMonth() === parseInt(month);
        let matchesWeek = true;
        if (week !== '') {
            const [startDate] = week.split(' - ');
            const [dayStr, monthStr] = startDate.split(' ');
            const monthNames = { 'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11 };
            const weekStart = new Date(orderDate.getFullYear(), monthNames[monthStr.toLowerCase()], parseInt(dayStr));
            const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
            matchesWeek = orderDate >= weekStart && orderDate <= weekEnd;
        }
        const matchesDay = day === '' || orderDate.getDate() === parseInt(day);
        return matchesYear && matchesMonth && matchesWeek && matchesDay;
    });
}

async function calculateMetrics() {
    products = await fetchProducts();
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    const weekFilter = document.getElementById('weekFilter');
    const dayFilter = document.getElementById('dayFilter');
    if (!yearFilter || !monthFilter || !weekFilter || !dayFilter) {
        console.error('One or more filter elements (yearFilter, monthFilter, weekFilter, dayFilter) not found in the DOM');
        return;
    }
    const yearFilterValue = yearFilter.value;
    const monthFilterValue = monthFilter.value;
    const weekFilterValue = weekFilter.value;
    const dayFilterValue = dayFilter.value;
    const filteredOrders = filterOrders(controlOrders, yearFilterValue, monthFilterValue, weekFilterValue, dayFilterValue);

    const currentDate = new Date('2025-07-30T13:00:00-04:00'); // Current date and time

    // Total snacks sold
    const totalSnacks = filteredOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
    const totalSnacksElement = document.getElementById('totalSnacks');
    if (totalSnacksElement) totalSnacksElement.textContent = totalSnacks;

    // Total revenue
    const totalRevenue = filteredOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + (products[item.id]?.price || 0) * item.qty, 0);
    }, 0);
    const totalRevenueElement = document.getElementById('totalRevenue');
    if (totalRevenueElement) totalRevenueElement.textContent = totalRevenue.toFixed(2);

    // Revenue by period (text display)
    const dailyRevenue = filteredOrders
        .filter(order => new Date(order.time).toDateString() === currentDate.toDateString())
        .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (products[item.id]?.price || 0) * item.qty, 0), 0);
    const dailyRevenueElement = document.getElementById('dailyRevenue');
    if (dailyRevenueElement) dailyRevenueElement.textContent = dailyRevenue.toFixed(2);

    const weeklyStart = new Date(currentDate);
    weeklyStart.setDate(currentDate.getDate() - currentDate.getDay());
    const weeklyRevenue = filteredOrders
        .filter(order => new Date(order.time) >= weeklyStart && new Date(order.time) <= currentDate)
        .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (products[item.id]?.price || 0) * item.qty, 0), 0);
    const weeklyRevenueElement = document.getElementById('weeklyRevenue');
    if (weeklyRevenueElement) weeklyRevenueElement.textContent = weeklyRevenue.toFixed(2);

    const monthlyStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthlyRevenue = filteredOrders
        .filter(order => new Date(order.time) >= monthlyStart && new Date(order.time) <= currentDate)
        .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (products[item.id]?.price || 0) * item.qty, 0), 0);
    const monthlyRevenueElement = document.getElementById('monthlyRevenue');
    if (monthlyRevenueElement) monthlyRevenueElement.textContent = monthlyRevenue.toFixed(2);

    // Peak day
    const ordersByDay = filteredOrders.reduce((acc, order) => {
        const day = new Date(order.time).toDateString();
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {});
    const peakDay = Object.keys(ordersByDay).length > 0
        ? Object.keys(ordersByDay).reduce((a, b) => ordersByDay[a] > ordersByDay[b] ? a : b)
        : 'N/A';
    const peakOrders = ordersByDay[peakDay] || 0;
    const peakDayElement = document.getElementById('peakDay');
    const peakOrdersElement = document.getElementById('peakOrders');
    if (peakDayElement) peakDayElement.textContent = peakDay;
    if (peakOrdersElement) peakOrdersElement.textContent = peakOrders;

    // Item distribution chart
    const itemCounts = filteredOrders.reduce((acc, order) => {
        order.items.forEach(item => {
            acc[item.id] = (acc[item.id] || 0) + item.qty;
        });
        return acc;
    }, {});
    const itemChartCanvas = document.getElementById('itemChart');
    if (itemChartCanvas) {
        new Chart(itemChartCanvas, {
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
    }

    // Payment method distribution
    const paymentCounts = filteredOrders.reduce((acc, order) => {
        acc[order.paymentMethod || 'Não especificado'] = (acc[order.paymentMethod || 'Não especificado'] || 0) + 1;
        return acc;
    }, {});
    const paymentChartCanvas = document.getElementById('paymentChart');
    if (paymentChartCanvas) {
        new Chart(paymentChartCanvas, {
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
    }

    // Revenue by day with two columns
    const dailyData = filteredOrders.reduce((acc, order) => {
        const day = new Date(order.time).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
        if (!acc[day]) acc[day] = { revenue: 0, snacks: 0 };
        acc[day].revenue += order.items.reduce((sum, item) => sum + (products[item.id]?.price || 0) * item.qty, 0);
        acc[day].snacks += order.items.reduce((sum, item) => sum + item.qty, 0);
        return acc;
    }, {});
    const dailyChartCanvas = document.getElementById('dailyChart');
    if (dailyChartCanvas) {
        new Chart(dailyChartCanvas, {
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
    }

    // Revenue by week with two columns
    const weeklyData = filteredOrders.reduce((acc, order) => {
        const weekStart = new Date(new Date(order.time).setDate(new Date(order.time).getDate() - new Date(order.time).getDay()));
        const weekLabel = `${weekStart.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} - ${new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}`;
        if (!acc[weekLabel]) acc[weekLabel] = { revenue: 0, snacks: 0 };
        acc[weekLabel].revenue += order.items.reduce((sum, item) => sum + (products[item.id]?.price || 0) * item.qty, 0);
        acc[weekLabel].snacks += order.items.reduce((sum, item) => sum + item.qty, 0);
        return acc;
    }, {});
    const weeklyChartCanvas = document.getElementById('weeklyChart');
    if (weeklyChartCanvas) {
        new Chart(weeklyChartCanvas, {
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
    }

    // Revenue by month with two columns
    const monthlyData = filteredOrders.reduce((acc, order) => {
        const month = new Date(order.time).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        if (!acc[month]) acc[month] = { revenue: 0, snacks: 0 };
        acc[month].revenue += order.items.reduce((sum, item) => sum + (products[item.id]?.price || 0) * item.qty, 0);
        acc[month].snacks += order.items.reduce((sum, item) => sum + item.qty, 0);
        return acc;
    }, {});
    const monthlyChartCanvas = document.getElementById('monthlyChart');
    if (monthlyChartCanvas) {
        new Chart(monthlyChartCanvas, {
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
    }

    // Revenue by year with two columns
    const yearlyData = filteredOrders.reduce((acc, order) => {
        const year = new Date(order.time).getFullYear();
        if (!acc[year]) acc[year] = { revenue: 0, snacks: 0 };
        acc[year].revenue += order.items.reduce((sum, item) => sum + (products[item.id]?.price || 0) * item.qty, 0);
        acc[year].snacks += order.items.reduce((sum, item) => sum + item.qty, 0);
        return acc;
    }, {});
    const yearlyChartCanvas = document.getElementById('yearlyChart');
    if (yearlyChartCanvas) {
        new Chart(yearlyChartCanvas, {
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
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded event fired');
    try {
        console.log('Starting to load orders from pedidos.json');
        const ordersResponse = await fetch('../utils/pedidos.json');
        if (!ordersResponse.ok) {
            throw new Error(`Erro ao carregar pedidos: ${ordersResponse.status} - ${ordersResponse.statusText}`);
        }
        const ordersData = await ordersResponse.json();
        controlOrders = Array.isArray(ordersData) ? ordersData.sort((a, b) => a.id - b.id) : [];
        console.log('Orders loaded successfully:', controlOrders.length);

        const uniqueIds = new Set(controlOrders.map(o => o.id));
        if (uniqueIds.size < controlOrders.length) {
            console.warn('Duplicate order IDs detected in pedidos.json. Consider assigning unique IDs to each order.');
        }

        if (!document.getElementById('yearFilter') || !document.getElementById('monthFilter') ||
            !document.getElementById('weekFilter') || !document.getElementById('dayFilter')) {
            console.error('One or more required DOM elements (yearFilter, monthFilter, weekFilter, dayFilter) are missing');
            return;
        }

        populateYearFilter(controlOrders);
        populateMonthFilter(controlOrders, '');
        populateWeekFilter(controlOrders, '', '');
        populateDayFilter(controlOrders, '', '');

        const yearFilter = document.getElementById('yearFilter');
        const monthFilter = document.getElementById('monthFilter');
        const weekFilter = document.getElementById('weekFilter');
        const dayFilter = document.getElementById('dayFilter');

        yearFilter.addEventListener('change', (e) => {
            console.log('Year filter changed to:', e.target.value);
            populateMonthFilter(controlOrders, e.target.value);
            populateWeekFilter(controlOrders, e.target.value, '');
            populateDayFilter(controlOrders, e.target.value, '');
            calculateMetrics();
        });

        monthFilter.addEventListener('change', (e) => {
            console.log('Month filter changed to:', e.target.value);
            populateWeekFilter(controlOrders, yearFilter.value, e.target.value);
            populateDayFilter(controlOrders, yearFilter.value, e.target.value);
            calculateMetrics();
        });

        weekFilter.addEventListener('change', () => {
            console.log('Week filter changed to:', weekFilter.value);
            calculateMetrics();
        });

        dayFilter.addEventListener('change', () => {
            console.log('Day filter changed to:', dayFilter.value);
            calculateMetrics();
        });

        await calculateMetrics();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os dados. Verifique os arquivos products.json e pedidos.json.');
    }
});