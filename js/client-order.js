let products = [];
let quantities = {};
let config = {};
const apiUrl = "http://192.168.1.67:3000";
const LOCAL_TIMEZONE_OFFSET = -10; // Horário de Brasília (GMT-3). Ajuste conforme necessário.

async function loadConfig() {
    try {
        const response = await fetch(`${apiUrl}/api/config`);
        if (!response.ok) {
            throw new Error(`Erro ao carregar configuração: ${response.status} - ${response.statusText}`);
        }
        const result = await response.json();
        config = result.data || {};
    } catch (error) {
        console.error('Erro ao carregar configuração:', error);
        alert('Não foi possível carregar a configuração. Verifique a conexão com a API.');
    }
}

async function fetchProducts() {
    try {
        const response = await fetch(`${apiUrl}/api/products/burgers`);
        if (!response.ok) {
            throw new Error(`Erro ao carregar produtos: ${response.status} - ${response.statusText}`);
        }
        const result = await response.json();
        products = Array.isArray(result.data) ? result.data.filter(p => p.status === 'Ativo').map(p => ({ ...p, status: p.status || 'Ativo' })) : [];

        const clientOrder = JSON.parse(localStorage.getItem('order-client') || 'null');
        if (clientOrder && !clientOrder.total) {
            clientOrder.total = calculateOrderTotal(clientOrder.items);
            localStorage.setItem('order-client', JSON.stringify(clientOrder));
        }

        renderProducts();
        renderClientOrder();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os produtos. Verifique a conexão com a API.');
        products = [];
        renderProducts();
        renderClientOrder();
    }
}

function roundToNearest50CentsOrReal(value) {
    const integerPart = Math.floor(value);
    const decimalPart = value - integerPart;
    if (decimalPart <= 0.15) {
        return integerPart.toFixed(2);
    } else if (decimalPart <= 0.65) {
        return (integerPart + 0.50).toFixed(2);
    } else {
        return (integerPart + 1).toFixed(2);
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

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distancia = R * c;
    return distancia.toFixed(2);
}

async function obterCoordenadas(enderecoBase, numero, bairro) {
    const enderecoFixo = ", Campo Grande, MS, Brasil";
    let resultado = null;
    let enderecoUsado = enderecoBase;

    const enderecoBaseCompleto = bairro ? `${enderecoBase}, ${numero}, ${bairro}${enderecoFixo}` : `${enderecoBase}, ${numero}${enderecoFixo}`;

    for (const prefixo of config.PREFIXOS_LOGRADOURO) {
        const endereco = prefixo ? `${prefixo} ${enderecoBaseCompleto}` : enderecoBaseCompleto;
        const query = encodeURIComponent(endereco);
        const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Grok/1.0 (xAI)'
                }
            });
            const data = await response.json();
            if (data.length > 0) {
                const { lat, lon, address } = data[0];
                const bairroRetornado = address.suburb || address.neighbourhood || "Bairro não identificado";
                const nomeRua = address.road || address.highway || enderecoBase;
                resultado = { lat: parseFloat(lat), lon: parseFloat(lon), bairro: bairroRetornado, nomeRua };
                enderecoUsado = prefixo ? `${prefixo} ${enderecoBase}` : enderecoBase;
                break;
            }
        } catch (error) {
            console.error("Erro ao buscar com prefixo", prefixo, ":", error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!resultado) {
        console.log("Nenhuma variação do endereço encontrada.");
        return null;
    }

    const distancia = calcularDistancia(parseFloat(config.latitude), parseFloat(config.longitude), resultado.lat, resultado.lon);
    const taxaEntregaRaw = distancia * config.TAXA_POR_KM;
    const taxaEntrega = roundToNearest50CentsOrReal(taxaEntregaRaw);
    return { ...resultado, enderecoUsado, distancia, taxaEntrega };
}

function openOrderModal() {
    const itemTotal = Object.entries(quantities).reduce((sum, [id, qty]) => {
        if (qty > 0) {
            const product = products.find(p => p.id === parseInt(id));
            return sum + (product ? product.price * qty : 0);
        }
        return sum;
    }, 0);

    openModal({
        title: 'Confirmar Pedido',
        description: `Preencha os dados para finalziar o pedido`,
        fields: [
            { name: 'name', type: 'text', placeholder: 'Nome' },
            { name: 'phone', type: 'tel', placeholder: 'Telefone' },
            { name: 'paymentMethod', type: 'select', options: config.PAYMENT_METHODS, placeholder: 'Pagamento' }
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
                                <p><strong>Taxa de Entrega:</strong> R$ 0.00</p>
                                <p><strong>Valor Total:</strong> R$ ${itemTotal.toFixed(2)}</p>
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
                options: ['15 min', '30 min', '45 min', '60 min']
            },
            {
                type: 'conditionalInputs',
                id: 'addressGroup',
                fields: [
                    { name: 'address', type: 'text', placeholder: 'Endereço (Ex: Dom Aquino ou Rua Dom Aquino)' },
                    { name: 'number', type: 'text', placeholder: 'Número' },
                    { name: 'neighborhood', type: 'text', placeholder: 'Bairro (opcional)' }
                ],
                extra: `
                    <button id="calcularTaxaBtn" class="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Calcular entrega</button>
                `
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
        onSave: async (values) => {
            const isDelivery = document.getElementById('delivery').checked;
            const pickupTime = document.querySelector('input[name="pickupTime"]:checked')?.value;
            const onclient = "true";
            let address = null;
            let distancia = 0;
            let taxaEntrega = 0;
            if (isDelivery) {
                const addressValue = document.getElementById('address').value;
                const number = document.getElementById('number').value;
                const neighborhood = document.getElementById('neighborhood').value;
                const coords = await obterCoordenadas(addressValue, number, neighborhood);
                if (!coords) {
                    alert('Não foi possível calcular a taxa de entrega. Verifique o endereço.');
                    return;
                }
                address = {
                    address: coords.enderecoUsado,
                    number,
                    neighborhood: coords.bairro
                };
                distancia = coords.distancia;
                taxaEntrega = parseFloat(coords.taxaEntrega);
            }
            if (!validateOrderForm(isDelivery, pickupTime, address, values)) return;
            saveOrder(values, isDelivery, pickupTime, address, onclient, distancia, taxaEntrega);
        },
        initialValues: {}
    });

    setTimeout(() => {
        const calcularTaxaBtn = document.getElementById('calcularTaxaBtn');
        if (calcularTaxaBtn) {
            calcularTaxaBtn.addEventListener('click', async () => {
                const address = document.getElementById('address')?.value || '';
                const number = document.getElementById('number')?.value || '';
                const neighborhood = document.getElementById('neighborhood')?.value || '';
                const totalDisplay = document.getElementById('orderTotalDisplay');
                if (!address || !number) {
                    alert('Preencha o endereço e o número para calcular a taxa.');
                    return;
                }
                const coords = await obterCoordenadas(address, number, neighborhood);
                if (!coords) {
                    alert('Não foi possível calcular a taxa de entrega. Verifique o endereço.');
                    return;
                }
                if (totalDisplay) {
                    totalDisplay.innerHTML = `
                        <p><strong>Valor dos Itens:</strong> R$ ${itemTotal.toFixed(2)}</p>
                        <p><strong>Taxa de Entrega:</strong> R$ ${coords.taxaEntrega}</p>
                        <p><strong>Valor Total:</strong> R$ ${(itemTotal + parseFloat(coords.taxaEntrega)).toFixed(2)}</p>
                    `;
                }
            });
        }
    }, 0);
}

function validateOrderForm(isDelivery, pickupTime, address, values) {
    const name = document.getElementById('name');
    const phone = document.getElementById('phone');
    const paymentMethod = document.getElementById('paymentMethod');
    if (!name.value || !phone.value || paymentMethod.value === config.PAYMENT_METHODS[0]) {
        alert('Preencha todos os campos obrigatórios.');
        return false;
    }
    if (!isDelivery && !pickupTime) {
        alert('Selecione um horário de retirada.');
        return false;
    }
    if (isDelivery && (!address.address || !address.number)) {
        alert('Preencha o endereço e o número.');
        return false;
    }
    return true;
}

async function saveOrder(values, isDelivery, pickupTime, address, onclient, distancia, taxaEntrega) {
    const total = Object.entries(quantities).reduce((sum, [id, qty]) => {
        if (qty > 0) {
            const product = products.find(p => p.id === parseInt(id));
            return sum + (product ? product.price * qty : 0);
        }
        return sum;
    }, 0);

    // Gera a data/hora local correta
    const now = new Date();
    now.setHours(now.getHours() + LOCAL_TIMEZONE_OFFSET - now.getTimezoneOffset() / 60);
    const pad = n => n.toString().padStart(2, '0');
    const localTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const order = {
        id: Date.now(),
        time: localTime, // <-- agora salva no horário local correto
        name: values.name,
        phone: values.phone,
        onclient,
        paymentMethod: values.paymentMethod,
        delivery: isDelivery,
        pickupTime,
        address,
        distancia,
        items: Object.entries(quantities).filter(([_, qty]) => qty > 0).map(([id, qty]) => ({ id: parseInt(id), qty })),
        total,
        deliveryFee: isDelivery ? taxaEntrega : 0,
        status: 'Aguardando'
    };

    try {
        // Envia o pedido para a API
        const response = await fetch(`${apiUrl}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(order)
        });

        if (!response.ok) {
            throw new Error(`Erro ao salvar pedido: ${response.status} - ${response.statusText}`);
        }

        // Salva no localStorage
        let orders = JSON.parse(localStorage.getItem('orders') || '[]');
        orders.push(order);
        localStorage.setItem('orders', JSON.stringify(orders));

        // Padronização: Salva usando a mesma chave que será lida depois
        localStorage.setItem('order-client', JSON.stringify(order));
        saveClientOrderToStorage(order); // Esta função salva em 'clientOrder'

        quantities = {};
        renderProducts();
        renderClientOrder();

        alert('Pedido realizado com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar pedido:', error);
        alert('Não foi possível enviar o pedido. Tente novamente mais tarde.');
    }
}

// Função auxiliar modificada para manter consistência
function saveClientOrderToStorage(order) {
    localStorage.setItem('clientOrder', JSON.stringify({
        id: order.id,
        phone: order.phone,
        // Adicionando mais dados para facilitar o acesso
        name: order.name,
        status: order.status
    }));
}

// Função auxiliar modificada para manter consistência
function getClientOrderFromStorage() {
    const order = localStorage.getItem('clientOrder') || localStorage.getItem('order-client');
    return order ? JSON.parse(order) : null;
}

async function renderClientOrder() {
    const clientOrderDiv = document.getElementById('clientOrder');
    if (!clientOrderDiv) return;

    const clientOrder = getClientOrderFromStorage();
    if (!clientOrder || !clientOrder.id || !clientOrder.phone) {
        clientOrderDiv.innerHTML = '<p>Nenhum pedido encontrado para você.</p>';
        return;
    }

    try {
        const response = await fetch(`${apiUrl}/api/client?id=${clientOrder.id}&phone=${clientOrder.phone}`);
        if (!response.ok) throw new Error('Erro ao buscar pedido');

        const result = await response.json();
        if (!result.success || !result.data) {
            throw new Error(result.message || 'Pedido não encontrado');
        }

        const order = result.data;
        const deliveryFee = order.deliveryFee || 0; // Garante que terá um valor padrão
        const totalWithDelivery = (order.total + deliveryFee).toFixed(2);

        clientOrderDiv.innerHTML = `
            <div class="border p-4 rounded-lg bg-gray-50">
                <h2 class="text-xl font-bold mb-2">Seu Pedido</h2>
                <p><strong>ID:</strong> ${order.id}</p>
                <p><strong>Horário:</strong> ${new Date(order.time).toLocaleString('pt-BR')}</p>
                <p><strong>Tipo:</strong> ${order.delivery ? 'Entrega' : 'Retirada'}${order.pickupTime ? ` (${order.pickupTime})` : ''}</p>
                ${order.address ? `
                    <p><strong>Endereço:</strong> ${order.address.address}, ${order.address.number}${order.address.neighborhood ? `, ${order.address.neighborhood}` : ''}</p>
                ` : ''}
                <p><strong>Pagamento:</strong> ${order.paymentMethod}</p>
                <p><strong>Itens:</strong> ${order.items.map(i => {
            const product = products.find(p => p.id === i.id);
            return `${product ? product.name : 'Produto não encontrado'} (x${i.qty})`;
        }).join(', ')}</p>
                <p><strong>Valor dos Itens:</strong> R$ ${order.total.toFixed(2)}</p>
                ${order.delivery ? `<p><strong>Taxa de Entrega:</strong> R$ ${deliveryFee.toFixed(2)}</p>` : ''}
                <p class="font-bold"><strong>Valor Total:</strong> R$ ${totalWithDelivery}</p>
                <p class="mt-2"><strong>Status:</strong> <span class="font-semibold">${order.status}</span></p>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao carregar pedido:', error);
        clientOrderDiv.innerHTML = '<p class="text-red-500">Não foi possível carregar seu pedido. Tente recarregar a página.</p>';
    }
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

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    document.getElementById('placeOrderBtn').addEventListener('click', openOrderModal);
    fetchProducts();
});