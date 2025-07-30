let products = [];
let deliveryOrders = [];

async function fetchProducts() {
    try {
        const response = await fetch('../utils/products.json');
        if (!response.ok) {
            throw new Error(`Erro ao carregar produtos: ${response.status} - ${response.statusText}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('Dados de produtos não estão em formato de array');
        }
        products = data.map(p => ({ ...p, status: p.status || 'Ativo' }));
        renderDeliveryOrders();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os produtos. Verifique o arquivo products.json.');
        products = [];
        renderDeliveryOrders();
    }
}

function renderDeliveryOrders() {
    deliveryOrders = JSON.parse(localStorage.getItem('delivery-orders') || '[]').filter(order => order.status === 'A caminho');
    const tableBody = document.getElementById('deliveryTable');
    tableBody.innerHTML = '';
    if (deliveryOrders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Nenhum pedido em entrega.</td></tr>';
        return;
    }
    deliveryOrders.forEach(order => {
        const totalWithDelivery = (order.total + (order.deliveryFee || 0)).toFixed(2);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2">${order.name.split(' ')[0]}</td>
            <td class="px-4 py-2">${order.address ? `${order.address.address}, ${order.address.number}, ${order.address.neighborhood}` : 'N/A'}</td>
            <td class="px-4 py-2">${new Date(order.time).toLocaleString('pt-BR')}</td>
            <td class="px-4 py-2">
                <button class="text-blue-500 hover:underline" onclick="toggleAccordion(${order.id})">▼</button>
                <button class="ml-2 bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600" onclick="updateStatus(${order.id}, 'Entregue')">Entregue</button>
            </td>
        `;
        const details = document.createElement('tr');
        details.className = `hidden accordion-content-${order.id}`;
        details.innerHTML = `
            <td colspan="4" class="px-4 py-2">
                <p>Tipo: ${order.delivery ? 'Entrega' : 'Retirada'}${order.pickupTime ? ` (${order.pickupTime})` : ''}</p>
                <p>Pagamento: ${order.paymentMethod}</p>
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

function toggleAccordion(id) {
    const content = document.querySelector(`.accordion-content-${id}`);
    content.classList.toggle('hidden');
}

function updateStatus(id, newStatus) {
    if (newStatus !== 'Entregue') {
        alert('Apenas o status "Entregue" pode ser selecionado.');
        return;
    }
    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) {
        console.error(`Order with ID ${id} not found in orders`);
        return;
    }

    const order = orders[orderIndex];
    if (order.statusHistory[order.status] && !order.statusHistory[order.status].end) {
        order.statusHistory[order.status].end = new Date().toISOString().replace('Z', '-04:00');
    }
    order.statusHistory[newStatus] = { start: new Date().toISOString().replace('Z', '-04:00'), end: new Date().toISOString().replace('Z', '-04:00') };
    order.status = newStatus;

    // Remove from delivery-orders
    let deliveryOrders = JSON.parse(localStorage.getItem('delivery-orders') || '[]');
    deliveryOrders = deliveryOrders.filter(o => o.id !== id);
    localStorage.setItem('delivery-orders', JSON.stringify(deliveryOrders));
    console.log(`Order ${id} removed from delivery-orders`);

    // Move to controlOrders only if payment is true
    if (order.payment) {
        console.log(`Moving order ${id} to controlOrders`);
        const removedOrder = orders.splice(orderIndex, 1)[0];
        let controlOrders = JSON.parse(localStorage.getItem('controlOrders') || '[]');
        controlOrders.push(removedOrder);
        localStorage.setItem('controlOrders', JSON.stringify(controlOrders));
    } else {
        console.log(`Order ${id} remains in orders: payment is false`);
    }

    localStorage.setItem('orders', JSON.stringify(orders));

    // Notify other pages
    const bc = new BroadcastChannel('order_updates');
    bc.postMessage({ type: 'statusUpdate', orderId: id, newStatus: newStatus });

    renderDeliveryOrders();
}

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    renderDeliveryOrders();

    // Listen for updates from other pages
    const bc = new BroadcastChannel('order_updates');
    bc.onmessage = (event) => {
        if (event.data.type === 'statusUpdate') {
            const { orderId, newStatus } = event.data;
            if (newStatus === 'Entregue' || newStatus === 'A caminho') {
                renderDeliveryOrders();
            }
        } else if (event.data.type === 'receivedOrder') {
            const { orderId } = event.data;
            let orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const order = orders.find(o => o.id === orderId);
            if (order && order.status === 'Entregue') {
                // Move to controlOrders if paid and delivered
                const orderIndex = orders.findIndex(o => o.id === orderId);
                if (orderIndex !== -1) {
                    const removedOrder = orders.splice(orderIndex, 1)[0];
                    let controlOrders = JSON.parse(localStorage.getItem('controlOrders') || '[]');
                    controlOrders.push(removedOrder);
                    localStorage.setItem('controlOrders', JSON.stringify(controlOrders));
                    localStorage.setItem('orders', JSON.stringify(orders));
                    // Remove from delivery-orders
                    let deliveryOrders = JSON.parse(localStorage.getItem('delivery-orders') || '[]');
                    deliveryOrders = deliveryOrders.filter(o => o.id !== orderId);
                    localStorage.setItem('delivery-orders', JSON.stringify(deliveryOrders));
                    renderDeliveryOrders();
                }
            }
        }
    };
});