let products = [];
let quantities = {};
const DELIVERY_FEE = 10.00; // Fixed delivery fee, aligned with admin-order.js

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
        // Clean up invalid order-client data
        const clientOrder = JSON.parse(localStorage.getItem('order-client') || 'null');
        if (clientOrder && !clientOrder.total) {
            clientOrder.total = calculateOrderTotal(clientOrder.items);
            localStorage.setItem('order-client', JSON.stringify(clientOrder));
        }
        renderProducts();
        renderClientOrder();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os produtos. Verifique o arquivo products.json.');
        products = [];
        renderProducts();
        renderClientOrder();
    }
}

function calculateOrderTotal(items) {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
        const product = products.find(p => p.id === item.id);
        return sum + (product ? product.price * item.qty : 0);
    }, 0);
}

function renderProducts() {
    const tableBody = document.getElementById('productTable');
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
    // Calculate item total from quantities
    const itemTotal = Object.entries(quantities).reduce((sum, [id, qty]) => {
        if (qty > 0) {
            const product = products.find(p => p.id === parseInt(id));
            return sum + (product ? product.price * qty : 0);
        }
        return sum;
    }, 0);

    openModal({
        title: 'Confirmar Pedido',
        description: `Preencha os dados do pedido. Valor dos itens: R$ ${itemTotal.toFixed(2)}`,
        fields: [
            { name: 'name', type: 'text', placeholder: 'Nome' },
            { name: 'phone', type: 'tel', placeholder: 'Telefone' },
            { name: 'paymentMethod', type: 'select', options: ['Selecione', 'Dinheiro', 'Cartão Débito', 'Cartão Crédito'] }
        ],
        customElements: [
            {
                type: 'checkbox',
                id: 'delivery',
                label: 'Entrega (se não marcado, será retirada)',
                onChange: function () {
                    const isDelivery = this.checked;
                    const pickupGroup = document.getElementById('pickupTimeGroup');
                    const addressGroup = document.getElementById('addressGroup');
                    const pickupDiv = pickupGroup ? pickupGroup.parentElement : null;
                    const totalDisplay = document.getElementById('orderTotalDisplay');
                    if (isDelivery) {
                        if (pickupDiv) pickupDiv.classList.add('hidden');
                        if (addressGroup) addressGroup.classList.remove('hidden');
                        if (totalDisplay) {
                            totalDisplay.innerHTML = `
                                <p><strong>Valor dos Itens:</strong> R$ ${itemTotal.toFixed(2)}</p>
                                <p><strong>Taxa de Entrega:</strong> R$ ${DELIVERY_FEE.toFixed(2)}</p>
                                <p><strong>Valor Total:</strong> R$ ${(itemTotal + DELIVERY_FEE).toFixed(2)}</p>
                            `;
                        }
                    } else {
                        if (pickupDiv) pickupDiv.classList.remove('hidden');
                        if (addressGroup) addressGroup.classList.add('hidden');
                        if (totalDisplay) {
                            totalDisplay.innerHTML = `
                                <p><strong>Valor dos Itens:</strong> R$ ${itemTotal.toFixed(2)}</p>
                                <p><strong>Valor Total:</strong> R$ ${itemTotal.toFixed(2)}</p>
                            `;
                        }
                    }
                }
            },
            {
                type: 'radioGroup',
                name: 'pickupTime',
                label: 'Horário de Retirada (selecione uma opção)',
                options: ['30 min', '60 min', '90 min']
            },
            {
                type: 'conditionalInputs',
                id: 'addressGroup',
                fields: [
                    { name: 'address', type: 'text', placeholder: 'Endereço' },
                    { name: 'number', type: 'text', placeholder: 'Número' },
                    { name: 'neighborhood', type: 'text', placeholder: 'Bairro' },
                    { name: 'reference', type: 'text', placeholder: 'Referência' }
                ]
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
            const isDelivery = document.getElementById('delivery').checked;
            const pickupTime = document.querySelector('input[name="pickupTime"]:checked')?.value;
            const onclient = "true";
            const address = isDelivery ? {
                address: document.getElementById('address').value,
                number: document.getElementById('number').value,
                neighborhood: document.getElementById('neighborhood').value,
                reference: document.getElementById('reference').value
            } : null;
            if (!validateOrderForm(isDelivery, pickupTime, address, values)) return;
            saveOrder(values, isDelivery, pickupTime, address, onclient);
        },
        initialValues: {}
    });
}

function validateOrderForm(isDelivery, pickupTime, address, values) {
    const name = document.getElementById('name');
    const phone = document.getElementById('phone');
    const paymentMethod = document.getElementById('paymentMethod');
    if (!name.value || !phone.value || paymentMethod.value === 'Selecione') {
        alert('Preencha todos os campos obrigatórios.');
        return false;
    }
    if (!isDelivery && !pickupTime) {
        alert('Selecione um horário de retirada.');
        return false;
    }
    if (isDelivery && (!address.address || !address.number || !address.neighborhood)) {
        alert('Preencha todos os campos de entrega.');
        return false;
    }
    return true;
}

function saveOrder(values, isDelivery, pickupTime, address, onclient) {
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
        name: values.name,
        phone: values.phone,
        onclient,
        paymentMethod: values.paymentMethod,
        delivery: isDelivery,
        pickupTime,
        address,
        items: Object.entries(quantities).filter(([_, qty]) => qty > 0).map(([id, qty]) => ({ id: parseInt(id), qty })),
        total,
        deliveryFee: isDelivery ? DELIVERY_FEE : 0,
        status: 'Aguardando'
    };
    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('order-client', JSON.stringify(order));
    quantities = {};
    renderProducts();
    renderClientOrder();
}

function renderClientOrder() {
    const clientOrder = JSON.parse(localStorage.getItem('order-client') || 'null');
    const clientOrderDiv = document.getElementById('clientOrder');
    if (!clientOrderDiv || clientOrder === null) {
        clientOrderDiv.innerHTML = '<p>Nenhum pedido encontrado para você.</p>';
        return;
    }
    // Calculate total if missing
    if (!clientOrder.total) {
        clientOrder.total = calculateOrderTotal(clientOrder.items);
        localStorage.setItem('order-client', JSON.stringify(clientOrder));
    }
    const totalWithDelivery = (clientOrder.total + (clientOrder.deliveryFee || 0)).toFixed(2);
    clientOrderDiv.innerHTML = `
        <h2>Seu Pedido</h2>
        <p><strong>ID:</strong> ${clientOrder.id}</p>
        <p><strong>Horário:</strong> ${new Date(clientOrder.time).toLocaleString('pt-BR')}</p>
        <p><strong>Tipo:</strong> ${clientOrder.delivery ? 'Entrega' : 'Retirada'}${clientOrder.pickupTime ? ` (${clientOrder.pickupTime})` : ''}</p>
        ${clientOrder.address ? `
            <p><strong>Endereço:</strong> ${clientOrder.address.address}, ${clientOrder.address.number}, ${clientOrder.address.neighborhood}${clientOrder.address.reference ? `, Ref: ${clientOrder.address.reference}` : ''}</p>
        ` : ''}
        <p><strong>Pagamento:</strong> ${clientOrder.paymentMethod}</p>
        <p><strong>Itens:</strong> ${clientOrder.items.map(i => `${products.find(p => p.id === i.id)?.name || 'Produto não encontrado'} (x${i.qty})`).join(', ') || 'N/A'}</p>
        <p><strong>Valor dos Itens:</strong> R$ ${clientOrder.total.toFixed(2)}</p>
        ${clientOrder.deliveryFee ? `<p><strong>Taxa de Entrega:</strong> R$ ${clientOrder.deliveryFee.toFixed(2)}</p>` : ''}
        <p><strong>Valor Total:</strong> R$ ${totalWithDelivery}</p>
        <p><strong>Status:</strong> ${clientOrder.status}</p>
    `;
}

function calculateOrderTotal(items) {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
        const product = products.find(p => p.id === item.id);
        return sum + (product ? product.price * item.qty : 0);
    }, 0);
}

const bc = new BroadcastChannel('order_updates');
bc.onmessage = (event) => {
    if (event.data.type === 'statusUpdate') {
        const clientOrder = JSON.parse(localStorage.getItem('order-client') || 'null');
        if (clientOrder && clientOrder.id === event.data.orderId) {
            clientOrder.status = event.data.newStatus;
            localStorage.setItem('order-client', JSON.stringify(clientOrder));
            renderClientOrder();
        }
    }
};

document.getElementById('placeOrderBtn').addEventListener('click', openOrderModal);
fetchProducts();