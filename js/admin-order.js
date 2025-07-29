let orders = [];
let products = [];
let cashRegisterOpen = JSON.parse(localStorage.getItem('cashRegisterOpen') || 'false');
let cashRegisterOpenTime = localStorage.getItem('cashRegisterOpenTime') || null;
const DELIVERY_FEE = 10.00; // Fixed delivery fee
const DEBIT_CARD_FEE_RATE = 0.02; // 2% fee for debit card
const CREDIT_CARD_FEE_RATE = 0.05; // 5% fee for credit card

async function loadOrders() {
    try {
        const productsResponse = await fetch('../utils/products.json');
        if (!productsResponse.ok) {
            throw new Error(`Erro ao carregar produtos: ${productsResponse.status} - ${productsResponse.statusText}`);
        }
        const productsData = await productsResponse.json();
        products = Array.isArray(productsData) ? productsData.map(p => ({ ...p, status: p.status || 'Ativo' })) : [];

        orders = JSON.parse(localStorage.getItem('orders') || '[]').sort((a, b) => a.id - b.id);
        orders.forEach(order => {
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
            // Calculate order total (items) if not present
            if (!order.total) {
                order.total = order.items.reduce((sum, item) => {
                    const product = products.find(p => p.id === item.id);
                    return sum + (product ? product.price * item.qty : 0);
                }, 0);
            }
            // Assign delivery fee if applicable
            order.deliveryFee = order.delivery ? DELIVERY_FEE : 0;
        });
        localStorage.setItem('orders', JSON.stringify(orders));
        updateCashRegisterUI();
        updateCashRegisterTotals();
        renderOrders();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os dados. Verifique o arquivo products.json.');
    }
}

function calculateCashRegisterTotals() {
    let cashTotal = 0;
    let debitCardTotal = 0;
    let creditCardTotal = 0;
    let deliveryFees = 0;
    let overallTotal = 0;

    const allOrders = [
        ...JSON.parse(localStorage.getItem('orders') || '[]'),
        ...JSON.parse(localStorage.getItem('controlOrders') || '[]')
    ];

    allOrders.forEach(order => {
        if (order.total) {
            if (order.paymentMethod === 'Dinheiro') {
                cashTotal += order.total;
            } else if (order.paymentMethod === 'Cartão Débito') {
                debitCardTotal += order.total * (1 - DEBIT_CARD_FEE_RATE); // Subtract 2% fee
            } else if (order.paymentMethod === 'Cartão Crédito') {
                creditCardTotal += order.total * (1 - CREDIT_CARD_FEE_RATE); // Subtract 5% fee
            }
            overallTotal += order.total;
            if (order.deliveryFee) {
                deliveryFees += order.deliveryFee;
                overallTotal += order.deliveryFee;
            }
        }
    });

    return {
        cashTotal: cashTotal.toFixed(2),
        debitCardTotal: debitCardTotal.toFixed(2),
        creditCardTotal: creditCardTotal.toFixed(2),
        deliveryFees: deliveryFees.toFixed(2),
        overallTotal: overallTotal.toFixed(2)
    };
}

function updateCashRegisterTotals() {
    const totals = calculateCashRegisterTotals();
    const totalsDiv = document.getElementById('cashRegisterTotals');
    totalsDiv.innerHTML = `
        <h2 class="text-lg font-semibold mb-2">Totais do Caixa</h2>
        <p><strong>Dinheiro:</strong> R$ ${totals.cashTotal}</p>
        <p><strong>Cartão Débito (líquido):</strong> R$ ${totals.debitCardTotal}</p>
        <p><strong>Cartão Crédito (líquido):</strong> R$ ${totals.creditCardTotal}</p>
        <p><strong>Taxas de Entrega:</strong> R$ ${totals.deliveryFees}</p>
        <p><strong>Total Geral:</strong> R$ ${totals.overallTotal}</p>
    `;
}

function renderOrders() {
    if (!cashRegisterOpen) {
        const tableBody = document.getElementById('orderTable');
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4">Caixa fechado. Abra o caixa para gerenciar pedidos.</td></tr>';
        return;
    }
    const tableBody = document.getElementById('orderTable');
    tableBody.innerHTML = '';
    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2">${order.name.split(' ')[0]}</td>
            <td class="px-4 py-2">${new Date(order.time).toLocaleString('pt-BR')}</td>
            <td class="px-4 py-2">
                <button class="text-blue-500 hover:underline" onclick="printOrder(${order.id})">🖨️</button>
                <button class="ml-2 text-blue-500 hover:underline" onclick="toggleAccordion(${order.id})">▼</button>
            </td>
        `;
        const details = document.createElement('tr');
        details.className = `hidden accordion-content-${order.id}`;
        let statusDurations = '';
        /*         for (let status in order.statusHistory) {
                    const { start, end } = order.statusHistory[status];
                    if (end) {
                        const durationMs = new Date(end) - new Date(start);
                        const durationMin = Math.floor(durationMs / 60000);
                        const durationSec = Math.floor((durationMs % 60000) / 1000);
                        statusDurations += `<p>${status}: ${durationMin}m ${durationSec}s</p>`;
                    } else if (status === order.status && status !== 'Entregue') {
                        const currentTime = new Date();
                        const startTime = new Date(start);
                        const durationMs = currentTime - startTime;
                        const durationMin = Math.max(0, Math.floor(durationMs / 60000));
                        const durationSec = Math.max(0, Math.floor((durationMs % 60000) / 1000));
                        statusDurations += `<p>${status} (atual): ${durationMin}m ${durationSec}s</p>`;
                    } else if (status === 'Entregue' && !end) {
                        statusDurations += `<p>${status} (atual): 0m 0s (registrado às ${new Date(start).toLocaleTimeString('pt-BR')})</p>`;
                    }
                } */
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
                <div class="mt-2">
                    ${order.status === 'Aguardando' ? '<button onclick="updateStatus(' + order.id + ', \'Preparando\')" class="bg-blue-500 text-white px-2 py-1 rounded mr-2">Preparar</button>' : ''}
                    ${order.status === 'Preparando' ? '<button onclick="updateStatus(' + order.id + ', \'Pronto\')" class="bg-blue-500 text-white px-2 py-1 rounded mr-2">Pronto</button>' : ''}
                    ${order.status === 'Pronto' && !order.delivery ? '<button onclick="updateStatus(' + order.id + ', \'Entregue\')" class="bg-blue-500 text-white px-2 py-1 rounded mr-2">Entregue</button>' : ''}
                    ${order.status === 'Pronto' && order.delivery ? '<button onclick="updateStatus(' + order.id + ', \'A caminho\')" class="bg-blue-500 text-white px-2 py-1 rounded mr-2">A caminho</button>' : ''}
                </div>
                <div class="mt-2">${statusDurations}</div>
            </td>
        `;
        tableBody.appendChild(row);
        tableBody.appendChild(details);
    });
}

function toggleAccordion(id) {
    const content = document.querySelector(`.accordion-content-${id}`);
    content.classList.toggle('hidden');
}

function updateStatus(id, newStatus) {
    if (!cashRegisterOpen) {
        alert('O caixa está fechado. Abra o caixa para atualizar pedidos.');
        return;
    }
    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    if (order.statusHistory[order.status] && !order.statusHistory[order.status].end) {
        order.statusHistory[order.status].end = new Date().toISOString().replace('Z', '-04:00');
    }
    order.statusHistory[newStatus] = { start: new Date().toISOString().replace('Z', '-04:00'), end: newStatus === 'Entregue' ? new Date().toISOString().replace('Z', '-04:00') : null };
    order.status = newStatus;

    if (newStatus === 'Entregue' || newStatus === 'A caminho') {
        const removedOrder = orders.splice(orderIndex, 1)[0];
        moveToControl(removedOrder);
    }
    localStorage.setItem('orders', JSON.stringify(orders));

    const clientOrder = JSON.parse(localStorage.getItem('order-client') || 'null');
    if (clientOrder && clientOrder.id === order.id) {
        clientOrder.status = newStatus;
        clientOrder.statusHistory = order.statusHistory;
        localStorage.setItem('order-client', JSON.stringify(clientOrder));
    }

    const bc = new BroadcastChannel('order_updates');
    bc.postMessage({ type: 'statusUpdate', orderId: id, newStatus: newStatus });
    updateCashRegisterTotals();
    renderOrders();
}

function moveToControl(order) {
    let controlOrders = JSON.parse(localStorage.getItem('controlOrders') || '[]');
    controlOrders.push(order);
    localStorage.setItem('controlOrders', JSON.stringify(controlOrders));
}

function printOrder(id) {
    if (!cashRegisterOpen) {
        alert('O caixa está fechado. Abra o caixa para imprimir pedidos.');
        return;
    }
    const order = orders.find(o => o.id === id);
    if (!order) return;

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
        <p><strong>Data de Impressão:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    `;

    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent.outerHTML;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
}

function openCashRegister() {
    if (cashRegisterOpen) {
        alert('O caixa já está aberto.');
        return;
    }
    cashRegisterOpen = true;
    cashRegisterOpenTime = new Date().toISOString().replace('Z', '-04:00');
    localStorage.setItem('cashRegisterOpen', JSON.stringify(cashRegisterOpen));
    localStorage.setItem('cashRegisterOpenTime', cashRegisterOpenTime);
    updateCashRegisterUI();
    updateCashRegisterTotals();
    renderOrders();
}

function closeCashRegister() {
    if (!cashRegisterOpen) {
        alert('O caixa já está fechado.');
        return;
    }
    cashRegisterOpen = false;
    cashRegisterOpenTime = null;
    localStorage.setItem('cashRegisterOpen', JSON.stringify(cashRegisterOpen));
    localStorage.setItem('cashRegisterOpenTime', null);
    updateCashRegisterUI();
    updateCashRegisterTotals();
    renderOrders();
}

function updateCashRegisterUI() {
    const openButton = document.getElementById('openCashRegister');
    const closeButton = document.getElementById('closeCashRegister');
    const statusSpan = document.getElementById('cashRegisterStatus');
    if (cashRegisterOpen) {
        openButton.classList.add('hidden');
        closeButton.classList.remove('hidden');
        statusSpan.textContent = `Caixa aberto em: ${new Date(cashRegisterOpenTime).toLocaleString('pt-BR')}`;
    } else {
        openButton.classList.remove('hidden');
        closeButton.classList.add('hidden');
        statusSpan.textContent = 'Caixa fechado';
    }
}

loadOrders();