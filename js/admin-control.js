let controlOrders = [];
let products = [];
let cashRegisterOpen = JSON.parse(localStorage.getItem('cashRegisterOpen') || 'false');
let cashRegisterOpenTime = localStorage.getItem('cashRegisterOpenTime') || null;
const PAYMENT_METHODS = ['Selecione', 'Dinheiro', "PIX", 'Cartão Débito', 'Cartão Crédito'];
const DEBIT_CARD_FEE_RATE = 0.02; // 2% fee for debit card
const CREDIT_CARD_FEE_RATE = 0.05; // 5% fee for credit card

function toggleAccordion(id) {
    const content = document.querySelector(`.accordion-content-${id}`);
    if (content) {
        content.classList.toggle('hidden');
    } else {
        console.error(`Accordion content for ID ${id} not found`);
    }
}

function printOrder(id) {
    if (!cashRegisterOpen) {
        alert('O caixa está fechado. Abra o caixa para imprimir pedidos.');
        return;
    }
    const order = controlOrders.find(o => o.id === id);
    if (!order) {
        console.error(`Order with ID ${id} not found`);
        return;
    }

    const totalWithDelivery = (order.total + (order.deliveryFee || 0)).toFixed(2);
    const printContent = document.createElement('div');
    printContent.className = 'print-content';
    printContent.innerHTML = `
        <h2>Comprovante de Pedido</h2>
        <p><strong>ID do Pedido:</strong> ${order.id}</p>
        <p><strong>Nome:</strong> ${order.name}</p>
        <p><strong>Horário do Pedido:</strong> ${new Date(order.time).toLocaleString('pt-BR')}</p>
        <p><strong>Tipo:</strong> ${order.delivery ? 'Entrega' : 'Retirada'}${order.pickupTime ? ` (${order.pickupTime})` : ''}</p>
        ${order.address ? `<p><strong>Endereço:</strong> ${order.address.address}, ${order.address.number}, ${order.address.neighborhood}</p>` : ''}
        <p><strong>Pagamento:</strong> ${order.paymentMethod}</p>
        <p><strong>Itens:<br></strong> ${order.items.map(i => `${products.find(p => p.id === i.id)?.name || 'Produto não encontrado'} (x${i.qty})`).join('<br>')}</p>
        <p><strong>Valor dos Itens:</strong> R$ ${order.total.toFixed(2)}</p>
        ${order.deliveryFee ? `<p><strong>Taxa de Entrega:</strong> R$ ${order.deliveryFee.toFixed(2)}</p>` : ''}
        <p><strong>Valor Total:</strong> R$ ${totalWithDelivery}</p>
        <p><strong>Status:</strong> ${order.status}</p>
        <p><strong>Pagamento:</strong> ${order.payment ? 'Recebido' : 'Pendente'}</p>
        <p><strong>Data de Impressão:</strong> ${new Date().toISOString().replace('Z', '-04:00')}</p>
    `;

    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent.outerHTML;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
}

function markAsReceived(orderId) {
    const order = controlOrders.find(o => o.id === orderId);
    if (!order) {
        console.error(`Order with ID ${orderId} not found`);
        return;
    }

    const totalWithDelivery = (order.total + (order.deliveryFee || 0)).toFixed(2);
    openModal({
        title: `Confirmar Recebimento - Pedido ${orderId}`,
        description: `
            Confirme o recebimento do pedido.
            <br><strong>Cliente:</strong> ${order.name}
            <br><strong>Itens:</strong> ${order.items.map(i => `${products.find(p => p.id === i.id)?.name || 'Produto não encontrado'} (x${i.qty})`).join(', ')}
            <br><strong>Valor dos Itens:</strong> R$ ${order.total.toFixed(2)}
            ${order.deliveryFee ? `<br><strong>Taxa de Entrega:</strong> R$ ${order.deliveryFee.toFixed(2)}` : ''}
            <br><strong>Valor Total:</strong> R$ ${totalWithDelivery}
            <br><strong>Forma de Pagamento:</strong> ${order.paymentMethod}
        `,
        fields: [],
        customElements: [],
        onSave: () => {
            if (order.statusHistory[order.status] && !order.statusHistory[order.status].end) {
                order.statusHistory[order.status].end = new Date().toISOString().replace('Z', '-04:00');
            }
            order.receivedTime = new Date().toISOString().replace('Z', '-04:00');
            order.payment = true; // Set payment to true when received
            order.statusHistory['Recebido'] = { start: order.receivedTime, end: null }; // Keep Recebido as current status

            // Note: Not saving to localStorage as controlOrders is now loaded from pedidos.json.
            // To persist changes, implement server-side saving to update pedidos.json.
            // localStorage.setItem('controlOrders', JSON.stringify(controlOrders));

            // Notify waiter-order.js and delivery-order.js of payment update
            const bc = new BroadcastChannel('order_updates');
            bc.postMessage({
                type: 'receivedOrder',
                orderId: orderId,
                tableNumber: order.tableNumber
            });

            renderOrders();
        },
        initialValues: {}
    });
}

function populateMonthFilter(orders) {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) {
        console.error('Element with ID "monthFilter" not found in the DOM');
        return;
    }
    monthFilter.innerHTML = '<option value="">Todos os Meses</option>';

    const months = new Set();
    orders.forEach(order => {
        const orderDate = new Date(order.time);
        months.add(orderDate.getMonth());
    });

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    Array.from(months).sort((a, b) => a - b).forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = monthNames[month];
        monthFilter.appendChild(option);
    });
    console.log('Month filter populated with months:', Array.from(months));
}

function populateDayFilter(orders, selectedMonth) {
    const dayFilter = document.getElementById('dayFilter');
    if (!dayFilter) {
        console.error('Element with ID "dayFilter" not found in the DOM');
        return;
    }
    dayFilter.innerHTML = '<option value="">Todos os Dias</option>';

    const days = new Set();
    orders.forEach(order => {
        const orderDate = new Date(order.time);
        if (selectedMonth === '' || orderDate.getMonth() === parseInt(selectedMonth)) {
            days.add(orderDate.getDate());
        }
    });

    Array.from(days).sort((a, b) => a - b).forEach(day => {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = day.toString().padStart(2, '0'); // Format as 01, 02, etc.
        dayFilter.appendChild(option);
    });
    console.log('Day filter populated with days:', Array.from(days));
}

function filterOrders(orders, month, day) {
    return orders.filter(order => {
        const orderDate = new Date(order.time);
        const matchesMonth = month === '' || orderDate.getMonth() === parseInt(month);
        const matchesDay = day === '' || orderDate.getDate() === parseInt(day);
        return matchesMonth && matchesDay;
    });
}

function renderOrders() {
    const tableBody = document.getElementById('orderTable');
    if (!tableBody) {
        console.error('Element with ID "orderTable" not found in the DOM');
        return;
    }
    tableBody.innerHTML = '';

    const monthFilter = document.getElementById('monthFilter');
    const dayFilter = document.getElementById('dayFilter');
    if (!monthFilter || !dayFilter) {
        console.error('Filter elements not found: monthFilter or dayFilter is null');
        return;
    }
    const monthFilterValue = monthFilter.value;
    const dayFilterValue = dayFilter.value;
    const filteredOrders = filterOrders(controlOrders, monthFilterValue, dayFilterValue);

    if (filteredOrders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4">Nenhum pedido encontrado.</td></tr>';
        return;
    }

    filteredOrders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2">${order.name.split(' ')[0]}</td>
            <td class="px-4 py-2">${new Date(order.time).toLocaleString('pt-BR')}</td>
            <td class="px-4 py-2">
                <button class="text-blue-500 hover:underline" onclick="printOrder(${order.id})">🖨️</button>
                <button class="ml-2 text-blue-500 hover:underline" onclick="toggleAccordion(${order.id})">▼</button>
                ${!order.payment ? `<button class="ml-2 bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600" onclick="markAsReceived(${order.id})">Marcar Recebido</button>` : ''}
            </td>
        `;
        const details = document.createElement('tr');
        details.className = `hidden accordion-content-${order.id}`;
        const totalWithDelivery = (order.total + (order.deliveryFee || 0)).toFixed(2);
        details.innerHTML = `
            <td colspan="3" class="px-4 py-2">
                <p>Tipo: ${order.delivery ? 'Entrega' : 'Retirada'}${order.pickupTime ? ` (${order.pickupTime})` : ''}</p>
                <p>Pagamento: ${order.paymentMethod}</p>
                ${order.address ? `<p>Endereço: ${order.address.address}, ${order.address.number}, ${order.address.neighborhood}</p>` : ''}
                <p>Itens: ${order.items.map(i => `${products.find(p => p.id === i.id)?.name || 'Produto não encontrado'} (x${i.qty})`).join(', ')}</p>
                <p>Valor dos Itens: R$ ${order.total.toFixed(2)}</p>
                ${order.deliveryFee ? `<p>Taxa de Entrega: R$ ${order.deliveryFee.toFixed(2)}</p>` : ''}
                <p>Valor Total: R$ ${totalWithDelivery}</p>
                <p>Status: ${order.status}</p>
                <p>Pagamento: ${order.payment ? 'Recebido' : 'Pendente'}</p>
            </td>
        `;
        tableBody.appendChild(row);
        tableBody.appendChild(details);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    async function loadOrders() {
        try {
            console.log('Starting to load products from products.json');
            const productsResponse = await fetch('../utils/products.json');
            if (!productsResponse.ok) {
                throw new Error(`Erro ao carregar produtos: ${productsResponse.status} - ${productsResponse.statusText}`);
            }
            const productsData = await productsResponse.json();
            products = Array.isArray(productsData) ? productsData.map(p => ({ ...p, status: p.status || 'Ativo' })) : [];
            console.log('Products loaded successfully:', products.length);

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
            controlOrders.forEach(order => {
                if (typeof order.time === 'string' && order.time.includes('/')) {
                    const [datePart, timePart] = order.time.split(', ');
                    const [day, month, year] = datePart.split('/').map(Number);
                    const [hours, minutes, seconds] = timePart.split(':').map(Number);
                    order.time = new Date(year, month - 1, day, hours, minutes, seconds).toISOString().replace('Z', '-04:00');
                }
                if (!order.statusHistory || Object.keys(order.statusHistory).length === 0) {
                    order.statusHistory = { [order.status]: { start: order.time, end: null } };
                } else {
                    for (let status in order.statusHistory) {
                        if (typeof order.statusHistory[status].start === 'string' && order.statusHistory[status].start.includes('/')) {
                            const [datePart, timePart] = order.statusHistory[status].start.split(', ');
                            const [day, month, year] = datePart.split('/').map(Number);
                            const [hours, minutes, seconds] = timePart.split(':').map(Number);
                            order.statusHistory[status].start = new Date(year, month - 1, day, hours, minutes, seconds).toISOString().replace('Z', '-04:00');
                        }
                    }
                    if (!order.statusHistory[order.status]) {
                        order.statusHistory[order.status] = { start: new Date().toISOString().replace('Z', '-04:00'), end: null };
                    }
                }
                if (!order.total) {
                    order.total = order.items.reduce((sum, item) => {
                        const product = products.find(p => p.id === item.id);
                        return sum + (product ? product.price * item.qty : 0);
                    }, 0);
                }
                order.payment = order.payment || false; // Default to false if not set
            });
            console.log('controlOrders processed:', controlOrders.length);

            // Check if filter elements exist before populating
            if (!document.getElementById('monthFilter') || !document.getElementById('dayFilter') || !document.getElementById('orderTable')) {
                console.error('One or more required DOM elements (monthFilter, dayFilter, orderTable) are missing');
                return;
            }

            // Populate month and day filters
            console.log('Populating month filter');
            populateMonthFilter(controlOrders);
            console.log('Populating day filter');
            populateDayFilter(controlOrders, '');
            console.log('Rendering orders');
            renderOrders();

            // Add event listeners for filters
            const monthFilter = document.getElementById('monthFilter');
            const dayFilter = document.getElementById('dayFilter');
            if (monthFilter) {
                monthFilter.addEventListener('change', (e) => {
                    console.log('Month filter changed to:', e.target.value);
                    populateDayFilter(controlOrders, e.target.value);
                    renderOrders();
                });
            } else {
                console.error('monthFilter element not found during event listener setup');
            }
            if (dayFilter) {
                dayFilter.addEventListener('change', () => {
                    console.log('Day filter changed to:', dayFilter.value);
                    renderOrders();
                });
            } else {
                console.error('dayFilter element not found during event listener setup');
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Não foi possível carregar os dados. Verifique os arquivos products.json e pedidos.json.');
        }
    }

    loadOrders();
});