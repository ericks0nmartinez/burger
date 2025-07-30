let products = [];
let quantities = {};
let selectedTable = null;
let config = {};

async function loadConfig() {
    try {
        const response = await fetch('../utils/config.json');
        if (!response.ok) {
            throw new Error(`Erro ao carregar configuração: ${response.status} - ${response.statusText}`);
        }
        config = await response.json();
    } catch (error) {
        console.error('Erro ao carregar config.json:', error);
        alert('Não foi possível carregar a configuração. Verifique o arquivo config.json.');
        config = {
            PAYMENT_METHODS: ['Selecione', 'Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito'],
            DELIVERY_FEE: 10.0,
            TABLE_COUNT: 6
        };
    }
}

function initializeTables() {
    const tables = JSON.parse(localStorage.getItem('tables') || '[]');
    if (tables.length !== config.TABLE_COUNT) {
        const newTables = Array.from({ length: config.TABLE_COUNT }, (_, i) => ({
            id: i + 1,
            occupied: false
        }));
        localStorage.setItem('tables', JSON.stringify(newTables));
        return newTables;
    }
    return tables;
}

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
        products = data.filter(p => p.status === 'Ativo').map(p => ({ ...p, status: p.status || 'Ativo' }));
        renderProducts();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os produtos. Verifique o arquivo products.json.');
        products = [];
        renderProducts();
    }
}

function renderTableCards() {
    const tableCards = document.getElementById('tableCards');
    const tables = initializeTables();
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    tableCards.innerHTML = '';
    tables.forEach(table => {
        const card = document.createElement('div');
        const hasPaidOrder = orders.some(order => order.tableNumber === table.id.toString() && order.payment === true);
        card.className = `w-[35px] h-[35px] flex items-center justify-center text-white rounded cursor-pointer ${hasPaidOrder ? 'bg-green-500' : table.occupied ? 'bg-red-500' : 'bg-green-300'}`;
        card.textContent = table.id;
        card.addEventListener('click', () => {
            if (table.occupied) {
                openReceiveOrderModal(table.id);
            } else {
                selectedTable = table.id;
                table.occupied = true;
                localStorage.setItem('tables', JSON.stringify(tables));
                renderTableCards();
                document.getElementById('productSection').classList.remove('hidden');
                fetchProducts();
            }
        });
        tableCards.appendChild(card);
    });
}

function renderProducts() {
    const tableBody = document.getElementById('productTable').querySelector('tbody');
    tableBody.innerHTML = '';
    products.forEach(product => {
        quantities[product.id] = quantities[product.id] || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2"><img src="${product.image}" alt="${product.name}" class="w-6 h-6 object-cover"></td>
            <td class="px-4 py-2">${product.name}</td>
            <td class="px-4 py-2">R$ ${product.price.toFixed(2)}</td>
            <td class="px-4 py-2">
                <button onclick="updateQuantity(${product.id}, -1)" class="px-2 bg-red-500 text-white rounded">-</button>
                <span class="px-2">${quantities[product.id]}</span>
                <button onclick="updateQuantity(${product.id}, 1)" class="px-2 bg-green-500 text-white rounded">+</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    updateOrderButton();
}

function updateQuantity(id, delta) {
    const newQty = Math.max(0, (quantities[id] || 0) + delta);
    quantities[id] = newQty;
    renderProducts();
}

function updateOrderButton() {
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    placeOrderBtn.disabled = Object.values(quantities).every(q => q === 0);
}

function openOrderModal() {
    if (!selectedTable) {
        alert('Selecione uma mesa antes de fazer o pedido.');
        return;
    }
    const itemTotal = Object.entries(quantities).reduce((sum, [id, qty]) => {
        if (qty > 0) {
            const product = products.find(p => p.id === parseInt(id));
            return sum + (product ? product.price * qty : 0);
        }
        return sum;
    }, 0);

    try {
        openModal({
            title: 'Confirmar Pedido',
            description: `Preencha os dados do pedido para a Mesa ${selectedTable}. Valor dos itens: R$ ${itemTotal.toFixed(2)}`,
            fields: [
                { name: 'name', type: 'text', placeholder: 'Nome do Cliente (opcional)' },
                { name: 'phone', type: 'tel', placeholder: 'Telefone (opcional)' },
                { name: 'paymentMethod', type: 'select', options: config.PAYMENT_METHODS }
            ],
            customElements: [
                {
                    type: 'checkbox',
                    id: 'isPackaged',
                    label: 'Embalar (para viagem)',
                    onChange: function () {
                        const isPackaged = this.checked;
                        const totalDisplay = document.getElementById('orderTotalDisplay');
                        if (totalDisplay) {
                            totalDisplay.innerHTML = `
                                <p><strong>Valor dos Itens:</strong> R$ ${itemTotal.toFixed(2)}</p>
                                ${isPackaged ? `<p><strong>Taxa de Entrega:</strong> R$ ${config.DELIVERY_FEE.toFixed(2)}</p>` : ''}
                                <p><strong>Valor Total:</strong> R$ ${(itemTotal + (isPackaged ? config.DELIVERY_FEE : 0)).toFixed(2)}</p>
                            `;
                        }
                    }
                },
                {
                    type: 'custom',
                    id: 'orderTotalDisplay',
                    html: `
                        <div id="orderTotalDisplay" class="mb-2">
                            <p><strong>Valor dos Itens:</strong> R$ ${itemTotal.toFixed(2)}</p>
                            <p><strong>Valor Total:</strong> R$ ${itemTotal.toFixed(2)}</p>
                        </div>
                    `
                }
            ],
            onSave: (values) => {
                const isPackaged = document.getElementById('isPackaged').checked;
                const onclient = "false";
                saveOrder(values, isPackaged, onclient);
            },
            initialValues: {}
        });
    } catch (error) {
        console.error('Erro ao abrir o modal:', error);
        alert('Não foi possível abrir o modal. Verifique o console para mais detalhes.');
    }
}

function openReceiveOrderModal(tableId) {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const tableOrders = orders.filter(order => order.tableNumber === tableId.toString());
    if (tableOrders.length === 0) {
        alert(`Nenhum pedido encontrado para a Mesa ${tableId}.`);
        return;
    }
    const order = tableOrders[0];
    const itemTotal = order.total || 0;
    const totalWithDelivery = (itemTotal + (order.deliveryFee || 0)).toFixed(2);

    try {
        openModal({
            title: `Confirmar Recebimento - Mesa ${tableId}`,
            description: `
                Confirme o recebimento do pedido para a Mesa ${tableId}.
                <br><strong>Itens:</strong> ${order.items.map(i => `${products.find(p => p.id === i.id)?.name || 'Produto não encontrado'} (x${i.qty})`).join(', ')}
                <br><strong>Valor dos Itens:</strong> R$ ${itemTotal.toFixed(2)}
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
                order.payment = true;
                order.statusHistory['Recebido'] = { start: order.receivedTime, end: null };

                const bc = new BroadcastChannel('order_updates');
                bc.postMessage({
                    type: 'receivedOrder',
                    orderId: order.id,
                    tableNumber: tableId
                });

                localStorage.setItem('orders', JSON.stringify(orders));
                renderTableCards();
            },
            initialValues: {}
        });
    } catch (error) {
        console.error('Erro ao abrir o modal de recebimento:', error);
        alert('Não foi possível abrir o modal de recebimento. Verifique o console para mais detalhes.');
    }
}

function saveOrder(values, isPackaged, onclient) {
    const total = Object.entries(quantities).reduce((sum, [id, qty]) => {
        if (qty > 0) {
            const product = products.find(p => p.id === parseInt(id));
            return sum + (product ? product.price * qty : 0);
        }
        return sum;
    }, 0);
    const order = {
        id: Date.now(),
        time: new Date().toISOString().replace('Z', '-04:00'),
        name: values.name || 'Sem nome',
        phone: values.phone || 'Sem telefone',
        onclient,
        tableNumber: selectedTable.toString(),
        paymentMethod: values.paymentMethod === config.PAYMENT_METHODS[0] ? 'Não informado' : values.paymentMethod,
        delivery: isPackaged,
        pickupTime: isPackaged ? null : '30 min',
        address: null,
        items: Object.entries(quantities).filter(([_, qty]) => qty > 0).map(([id, qty]) => ({ id: parseInt(id), qty })),
        total,
        deliveryFee: isPackaged ? config.DELIVERY_FEE : 0,
        status: 'Aguardando',
        payment: false,
        statusHistory: { Aguardando: { start: new Date().toISOString().replace('Z', '-04:00'), end: null } }
    };
    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    const bc = new BroadcastChannel('order_updates');
    bc.postMessage({ type: 'newOrder', orderId: order.id });
    quantities = {};
    renderProducts();
    document.getElementById('productSection').classList.add('hidden');
    selectedTable = null;
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    document.getElementById('placeOrderBtn').addEventListener('click', () => {
        console.log('Botão Fazer Pedido clicado');
        openOrderModal();
    });

    const bc = new BroadcastChannel('order_updates');
    bc.onmessage = (event) => {
        if (event.data.type === 'receivedOrder') {
            const { orderId, tableNumber } = event.data;
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const order = orders.find(o => o.id === orderId);
            if (order) {
                order.payment = true;
                order.receivedTime = new Date().toISOString().replace('Z', '-04:00');
                order.statusHistory['Recebido'] = { start: order.receivedTime, end: null };
                localStorage.setItem('orders', JSON.stringify(orders));
            }
            const tables = initializeTables();
            const table = tables.find(t => t.id === parseInt(tableNumber));
            if (table && order && order.status === 'Entregue') {
                table.occupied = false;
                localStorage.setItem('tables', JSON.stringify(tables));
                console.log(`Table ${tableNumber} released (occupied set to false)`);
            }
            renderTableCards();
        } else if (event.data.type === 'statusUpdate' && event.data.newStatus === 'Entregue') {
            const { orderId, tableNumber } = event.data;
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const order = orders.find(o => o.id === orderId);
            if (order && order.payment) {
                const tables = initializeTables();
                const table = tables.find(t => t.id === parseInt(tableNumber));
                if (table) {
                    table.occupied = false;
                    localStorage.setItem('tables', JSON.stringify(tables));
                    console.log(`Table ${tableNumber} released due to delivered and paid order (ID: ${orderId})`);
                }
                renderTableCards();
            }
        }
    };

    renderTableCards();
});