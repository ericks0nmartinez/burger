let orders = [];
let products = [];

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
        });
        localStorage.setItem('orders', JSON.stringify(orders));
        renderOrders();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os dados. Verifique o arquivo products.json.');
    }
}

function renderOrders() {
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
        for (let status in order.statusHistory) {
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
        }
        details.innerHTML = `
            <td colspan="3" class="px-4 py-2">
                <p>Tipo: ${order.delivery ? 'Entrega' : 'Retirada'}${order.pickupTime ? ` (${order.pickupTime})` : ''}</p>
                <p>Pagamento: ${order.paymentMethod}</p>
                ${order.address ? `<p>Endereço: ${order.address.address}, ${order.address.number}, ${order.address.neighborhood}</p>` : ''}
                <p>Itens: ${order.items.map(i => `${products.find(p => p.id === i.id)?.name || 'Produto não encontrado'} (x${i.qty})`).join(', ')}</p>
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
        clientOrder.statusHistory = order.statusHistory; // Sync full history
        localStorage.setItem('order-client', JSON.stringify(clientOrder));
    }

    const bc = new BroadcastChannel('order_updates');
    bc.postMessage({ type: 'statusUpdate', orderId: id, newStatus: newStatus });
    renderOrders();
}

function moveToControl(order) {
    let controlOrders = JSON.parse(localStorage.getItem('controlOrders') || '[]');
    controlOrders.push(order);
    localStorage.setItem('controlOrders', JSON.stringify(controlOrders));
}

function printOrder(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const printContent = document.createElement('div');
    printContent.className = 'print-content'; // Adiciona a classe para estilização
    printContent.innerHTML = `
        <h2>Comprovante de Pedido</h2>
        <p><strong>ID do Pedido:</strong> ${order.id}</p>
        <p><strong>Nome:</strong> ${order.name}</p>
        <p><strong>Horário do Pedido:</strong> ${new Date(order.time).toLocaleString('pt-BR')}</p>
        <p><strong>Tipo:</strong> ${order.delivery ? 'Entrega' : 'Retirada'}${order.pickupTime ? ` (${order.pickupTime})` : ''}</p>
        ${order.address ? `<p><strong>Endereço:</strong> ${order.address.address}, ${order.address.number}, ${order.address.neighborhood}</p>` : ''}
        <p><strong>Pagamento:</strong> ${order.paymentMethod}</p>
        <p><strong>Itens:<br></strong> ${order.items.map(i => `${products.find(p => p.id === i.id)?.name || 'Produto não encontrado'} (x${i.qty})`).join('<br>')}</p>
        <p><strong>Status:</strong> ${order.status}</p>
        <p><strong>Data de Impressão:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    `;

    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent.outerHTML;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); // Recarrega a página para restaurar o estado original
}

loadOrders();