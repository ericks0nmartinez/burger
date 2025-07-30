let orders = [];
let products = [];
let cashRegisterOpen = JSON.parse(localStorage.getItem('cashRegisterOpen') || 'false');
let cashRegisterOpenTime = localStorage.getItem('cashRegisterOpenTime') || null;
const PAYMENT_METHODS = ['Selecione', 'Dinheiro', "PIX", 'Cartão Débito', 'Cartão Crédito'];
const DEBIT_CARD_FEE_RATE = 0.02; // 2% fee for debit card
const CREDIT_CARD_FEE_RATE = 0.05; // 5% fee for credit card

function toggleAccordion(id) {
    const content = document.querySelector(`.accordion-content-${id}`);
    content.classList.toggle('hidden');
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
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

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

            // Check and move to controlOrders if status is "Entregue" after setting payment to true
            if (order.status === 'Entregue') {
                const orderIndex = orders.findIndex(o => o.id === orderId);
                if (orderIndex !== -1) {
                    console.log(`Moving order ${orderId} to controlOrders due to payment update`);
                    const removedOrder = orders.splice(orderIndex, 1)[0];
                    moveToControl(removedOrder);
                }
            }

            // Notify waiter-order.js of payment update
            const bc = new BroadcastChannel('order_updates');
            bc.postMessage({
                type: 'receivedOrder',
                orderId: orderId,
                tableNumber: order.tableNumber
            });

            localStorage.setItem('orders', JSON.stringify(orders));
            updateCashRegisterTotals();
            renderOrders();
        },
        initialValues: {}
    });
}

function updateStatus(id, newStatus) {
    if (!cashRegisterOpen) {
        alert('O caixa está fechado. Abra o caixa para atualizar pedidos.');
        return;
    }
    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) {
        console.error(`Order with ID ${id} not found`);
        return;
    }

    const order = orders[orderIndex];
    console.log(`Updating status for order ${id}: ${order.status} -> ${newStatus}, payment: ${order.payment}`); // Debug log
    if (order.statusHistory[order.status] && !order.statusHistory[order.status].end) {
        order.statusHistory[order.status].end = new Date().toISOString().replace('Z', '-04:00');
    }
    order.statusHistory[newStatus] = { start: new Date().toISOString().replace('Z', '-04:00'), end: newStatus === 'Entregue' ? new Date().toISOString().replace('Z', '-04:00') : null };
    order.status = newStatus;

    // Move to controlOrders and update table status only if status is "Entregue" and payment is true
    if (newStatus === 'Entregue' && order.payment) {
        console.log(`Moving order ${id} to controlOrders`);
        const removedOrder = orders.splice(orderIndex, 1)[0];
        moveToControl(removedOrder);

        // Update table status only when both conditions are met
        let tables = JSON.parse(localStorage.getItem('tables') || '[]');
        const table = tables.find(t => t.id === parseInt(order.tableNumber));
        if (table && table.occupied) {
            table.occupied = false;
            localStorage.setItem('tables', JSON.stringify(tables));
            console.log(`Table ${order.tableNumber} released (occupied set to false)`);
        }
    } else if (newStatus === 'Entregue' && !order.payment) {
        console.log(`Order ${id} not moved to controlOrders: payment is false`);
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
    console.log(`Order ${order.id} moved to controlOrders`);
}

function calculateCashRegisterTotals() {
    let cashTotal = 0;
    let debitCardTotal = 0;
    let creditCardTotal = 0;
    let pixTotal = 0;
    let deliveryFees = 0;
    let overallTotal = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Start of tomorrow

    const allOrders = [
        ...JSON.parse(localStorage.getItem('orders') || '[]'),
        ...JSON.parse(localStorage.getItem('controlOrders') || '[]')
    ].filter(order => {
        const orderDate = new Date(order.time);
        return orderDate >= today && orderDate < tomorrow;
    });

    allOrders.forEach(order => {
        if (order.total && order.payment) { // Only count paid orders
            if (order.paymentMethod === 'Dinheiro') {
                cashTotal += order.total;
            } else if (order.paymentMethod === 'Cartão Débito') {
                debitCardTotal += order.total * (1 - DEBIT_CARD_FEE_RATE);
            } else if (order.paymentMethod === 'Cartão Crédito') {
                creditCardTotal += order.total * (1 - CREDIT_CARD_FEE_RATE);
            } else if (order.paymentMethod === 'PIX') {
                pixTotal += order.total;
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
        pixTotal: pixTotal.toFixed(2),
        deliveryFees: deliveryFees.toFixed(2),
        overallTotal: overallTotal.toFixed(2)
    };
}

function updateCashRegisterTotals() {
    const totals = calculateCashRegisterTotals();
    const totalsDiv = document.getElementById('cashRegisterTotals');
    totalsDiv.innerHTML = `
        <h2 class="text-lg font-semibold mb-2">Totais do Caixa (Hoje)</h2>
        <p><strong>Dinheiro:</strong> R$ ${totals.cashTotal}</p>
        <p><strong>Cartão Débito:</strong> R$ ${totals.debitCardTotal}</p>
        <p><strong>Cartão Crédito:</strong> R$ ${totals.creditCardTotal}</p>
        <p><strong>PIX:</strong> R$ ${totals.pixTotal}</p>
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
                <button class="ml-2 bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600" onclick="markAsReceived(${order.id})">Marcar Recebido</button>
            </td>
        `;
        const details = document.createElement('tr');
        details.className = `hidden accordion-content-${order.id}`;
        let statusDurations = '';
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
                <div class="mt-2">
                    ${order.status === 'Aguardando' ? '<button onclick="updateStatus(' + order.id + ', \'Preparando\')" class="bg-blue-500 text-white px-2 py-1 rounded mr-2">Preparar</button>' : ''}
                    ${order.status === 'Preparando' ? '<button onclick="updateStatus(' + order.id + ', \'Pronto\')" class="bg-blue-500 text-white px-2 py-1 rounded mr-2">Pronto</button>' : ''}
                    ${order.status === 'Pronto' && !order.delivery ? '<button onclick="updateStatus(' + order.id + ', \'Entregue\')" class="bg-blue-500 text-white px-2 py-1 rounded mr-2">Entregue</button>' : ''}
                    ${order.status === 'Pronto' && order.delivery ? '<button onclick="updateStatus(' + order.id + ', \'A caminho\')" class="bg-blue-500 text-white px-2 py-1 rounded mr-2">A caminho</button>' : ''}
                    ${order.status === 'A caminho' && order.delivery ? '<button onclick="updateStatus(' + order.id + ', \'Entregue\')" class="bg-blue-500 text-white px-2 py-1 rounded mr-2">Entregue</button>' : ''}
                </div>
                <div class="mt-2">${statusDurations}</div>
            </td>
        `;
        tableBody.appendChild(row);
        tableBody.appendChild(details);
    });
}

function openCashRegister() {
    console.log('Abrir Caixa clicked'); // Debug log
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
    console.log('Fechar Caixa clicked'); // Debug log
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

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openCashRegister').addEventListener('click', openCashRegister);
    document.getElementById('closeCashRegister').addEventListener('click', closeCashRegister);

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
                if (!order.total) {
                    order.total = order.items.reduce((sum, item) => {
                        const product = products.find(p => p.id === item.id);
                        return sum + (product ? product.price * item.qty : 0);
                    }, 0);
                }
                order.payment = order.payment || false; // Default to false if not set
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

    loadOrders();
});