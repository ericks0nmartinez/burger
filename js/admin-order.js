
let orders = [];
let products = [];
let cashRegisterOpen = JSON.parse(localStorage.getItem('cashRegisterOpen') || 'false');
let cashRegisterOpenTime = localStorage.getItem('cashRegisterOpenTime') || null;
let config = {};
const apiUrl = "http://192.168.1.67:3000";

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
        config = {
            PAYMENT_METHODS: ['Selecione', 'Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito'],
            DEBIT_CARD_FEE_RATE: 0.02,
            CREDIT_CARD_FEE_RATE: 0.05
        };
    }
}

function toggleAccordion(orderId) {
    const detailsRow = document.getElementById(`details-${orderId}`);
    if (!detailsRow) {
        console.error(`Elemento de detalhes não encontrado para o pedido ${orderId}`);
        return;
    }

    detailsRow.classList.toggle('hidden');

    // Atualiza ícone do botão
    const button = document.querySelector(`button[onclick="toggleAccordion(${orderId})"]`);
    if (button) {
        if (detailsRow.classList.contains('hidden')) {
            button.innerHTML = '<i class="fas fa-chevron-down"></i> Detalhes';
        } else {
            button.innerHTML = '<i class="fas fa-chevron-up"></i> Ocultar';
        }
    }
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

// Substituir a função markAsReceived por esta versão atualizada
async function markAsReceived(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Se já estiver pago, não faz nada
    if (order.payment) {
        return;
    }

    const totalWithDelivery = (order.total + (order.deliveryFee || 0)).toFixed(2);

    // Função para fechar o modal
    const closeModal = () => {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    };

    // Função de salvamento
    const handleSave = async () => {
        try {
            // Atualiza no backend
            const response = await fetch(`${apiUrl}/api/orders/${orderId}/payment`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ payment: true })
            });

            if (!response.ok) {
                throw new Error('Erro ao atualizar pagamento');
            }

            // Atualiza localmente
            order.payment = true;
            order.receivedTime = new Date().toISOString().replace('Z', '-04:00');
            order.statusHistory['Recebido'] = { start: order.receivedTime, end: null };

            // Se for pedido do cliente, atualiza também no OrderClient
            if (order.onclient) {
                await fetch(`${apiUrl}/api/order-client/${orderId}/payment`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ payment: true })
                });
            }

            // Notifica outras abas
            const bc = new BroadcastChannel('order_updates');
            bc.postMessage({
                type: 'receivedOrder',
                orderId: orderId,
                tableNumber: order.tableNumber
            });

            // Atualiza storage e UI
            localStorage.setItem('orders', JSON.stringify(orders));
            updateCashRegisterTotals();
            renderOrders();

            closeModal();

        } catch (error) {
            console.error('Erro ao atualizar pagamento:', error);

            // Mostra mensagem de erro no modal
            const errorElement = document.createElement('div');
            errorElement.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mt-4';
            errorElement.innerHTML = `
                <p class="font-bold">Erro</p>
                <p>Não foi possível atualizar o pagamento: ${error.message}</p>
            `;

            const modalFields = document.getElementById('modalFields');
            if (modalFields) {
                modalFields.appendChild(errorElement);
            }
        }
    };

    // Configuração do modal
    openModal({
        title: `Confirmar Recebimento - Pedido ${orderId}`,
        description: `Confirme o recebimento de R$ ${totalWithDelivery} de ${order.name}`,
        customElements: [{
            type: 'custom',
            html: `
                <div class="space-y-4">
                    <div class="bg-gray-50 p-4 rounded-md">
                        <h3 class="font-semibold text-lg mb-2">Detalhes do Pagamento</h3>
                        <p><strong>Forma de Pagamento:</strong> ${order.paymentMethod}</p>
                        <p><strong>Valor a Receber:</strong> R$ ${totalWithDelivery}</p>
                    </div>

                    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div class="flex items-start">
                            <svg class="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" 
                                 xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                            <div class="ml-3">
                                <p class="text-sm text-yellow-700">
                                    Verifique antes de confirmar:
                                    <ul class="list-disc pl-5 mt-1">
                                        <li>O valor recebido está correto</li>
                                        <li>O troco foi dado (se aplicável)</li>
                                        <li>O comprovante foi emitido (para cartões/PIX)</li>
                                    </ul>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `
        }],
        onSave: handleSave
    });

    // Configura os botões do modal
    setTimeout(() => {
        const modal = document.getElementById('productModal');
        const saveBtn = document.getElementById('saveBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        if (saveBtn) {
            saveBtn.onclick = handleSave;
            saveBtn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'text-white', 'px-4', 'py-2', 'rounded');
            saveBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Confirmar Recebimento';
        }

        if (cancelBtn) {
            cancelBtn.onclick = closeModal;
            cancelBtn.classList.add('border', 'border-gray-300', 'text-gray-700', 'px-4', 'py-2', 'rounded', 'hover:bg-gray-50');
        }
    }, 50);
}

async function updateStatus(orderId, newStatus) {
    if (!cashRegisterOpen) {
        alert('O caixa está fechado. Abra o caixa para atualizar pedidos.');
        return;
    }

    try {
        const order = orders.find(o => o.id == orderId);
        if (!order) {
            throw new Error(`Pedido ${orderId} não encontrado`);
        }

        const currentStatus = order.status;

        const response = await fetch(`${apiUrl}/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newStatus,
                currentStatus
            })
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        // Atualiza localmente
        if (order.statusHistory[order.status] && !order.statusHistory[order.status].end) {
            order.statusHistory[order.status].end = new Date().toISOString();
        }

        order.statusHistory[newStatus] = {
            start: new Date().toISOString(),
            end: newStatus === 'Entregue' ? new Date().toISOString() : null
        };
        order.status = newStatus;

        // Atualiza a UI
        await renderOrders();

        // Feedback visual
        const updatedRow = document.querySelector(`tr[data-order-id="${orderId}"]`);
        if (updatedRow) {
            updatedRow.classList.add('bg-green-50');
            setTimeout(() => updatedRow.classList.remove('bg-green-50'), 2000);
        }

    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        alert(`Falha ao atualizar status: ${error.message}`);
    }
}

function moveToControl(order) {
    let controlOrders = JSON.parse(localStorage.getItem('controlOrders') || '[]');
    controlOrders.push(order);
    localStorage.setItem('controlOrders', JSON.stringify(controlOrders));
    let deliveryOrders = JSON.parse(localStorage.getItem('delivery-orders') || '[]');
    deliveryOrders = deliveryOrders.filter(o => o.id !== order.id);
    localStorage.setItem('delivery-orders', JSON.stringify(deliveryOrders));
    console.log(`Order ${order.id} moved to controlOrders and removed from delivery-orders`);
}

function calculateCashRegisterTotals() {
    let cashTotal = 0;
    let debitCardTotal = 0;
    let creditCardTotal = 0;
    let pixTotal = 0;
    let deliveryFees = 0;
    let overallTotal = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const allOrders = [
        ...JSON.parse(localStorage.getItem('orders') || '[]'),
        ...JSON.parse(localStorage.getItem('controlOrders') || '[]')
    ].filter(order => {
        const orderDate = new Date(order.time);
        return orderDate >= today && orderDate < tomorrow;
    });

    allOrders.forEach(order => {
        if (order.total && order.payment) {
            if (order.paymentMethod === config.PAYMENT_METHODS[1]) {
                cashTotal += order.total;
            } else if (order.paymentMethod === config.PAYMENT_METHODS[3]) {
                debitCardTotal += order.total * (1 - config.DEBIT_CARD_FEE_RATE);
            } else if (order.paymentMethod === config.PAYMENT_METHODS[4]) {
                creditCardTotal += order.total * (1 - config.CREDIT_CARD_FEE_RATE);
            } else if (order.paymentMethod === config.PAYMENT_METHODS[2]) {
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

    if (orders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center py-4 text-gray-500">
                    Nenhum pedido encontrado
                </td>
            </tr>
        `;
        return;
    }

    orders.forEach(order => {
        const totalWithDelivery = (order.total + (order.deliveryFee || 0)).toFixed(2);

        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        row.dataset.orderId = order.id;

        row.innerHTML = `
            <td class="px-4 py-3">${order.name.split(' ')[0]}</td>
            <td class="px-4 py-3">${new Date(order.time).toLocaleTimeString('pt-BR')}</td>
            <td class="px-4 py-3">
                <div class="action-buttons">
                    <button onclick="toggleAccordion('${order.id}')" 
                            class="action-btn btn-details details-btn">
                        <i class="fas fa-chevron-down"></i> Detalhes
                    </button>
                    <button onclick="printOrder(${order.id})" 
                            class="action-btn btn-print">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                    ${!order.payment ? `
                    <button onclick="markAsReceived(${order.id})" 
                            class="action-btn btn-success">
                        <i class="fas fa-money-bill-wave"></i> Receber
                    </button>` : `
                    <button class="action-btn bg-gray-200 text-gray-600 cursor-default" disabled>
                        <i class="fas fa-check-circle"></i> Pago
                    </button>`}
                    ${order.status === 'Aguardando' ? `
                    <button onclick="updateStatus('${order.id}', 'Preparando')" 
                            class="action-btn btn-primary">
                        <i class="fas fa-utensils"></i> Preparar
                    </button>` : ''}
                    ${order.status === 'Preparando' ? `
                    <button onclick="updateStatus('${order.id}', 'Pronto')" 
                            class="action-btn btn-primary">
                        <i class="fas fa-check"></i> Pronto
                    </button>` : ''}
                    ${order.status === 'Pronto' && !order.delivery ? `
                    <button onclick="updateStatus('${order.id}', 'Entregue')" 
                            class="action-btn btn-primary">
                        <i class="fas fa-box"></i> Entregue
                    </button>` : ''}
                    ${order.status === 'Pronto' && order.delivery ? `
                    <button onclick="updateStatus('${order.id}', 'A caminho')" 
                            class="action-btn btn-primary">
                        <i class="fas fa-truck"></i> A caminho
                    </button>` : ''}
                    ${order.status === 'A caminho' && order.delivery ? `
                    <button onclick="updateStatus('${order.id}', 'Entregue')" 
                            class="action-btn btn-primary">
                        <i class="fas fa-home"></i> Entregue
                    </button>` : ''}
                </div>
            </td>
        `;

        const detailsRow = document.createElement('tr');
        detailsRow.id = `details-${order.id}`;
        detailsRow.className = 'hidden bg-gray-50';
        detailsRow.innerHTML = `
            <td colspan="3" class="px-4 py-3">
                <div class="details-content grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 class="font-semibold mb-2">Informações do Cliente</h3>
                        <p><span class="font-medium">Nome:</span> ${order.name}</p>
                        <p><span class="font-medium">Telefone:</span> ${order.phone}</p>
                        ${order.address ? `
                        <p><span class="font-medium">Endereço:</span> 
                            ${order.address.address}, ${order.address.number}<br>
                            ${order.address.neighborhood}
                        </p>` : ''}
                        ${order.tableNumber ? `
                        <p><span class="font-medium">Mesa:</span> ${order.tableNumber}</p>
                        ` : ''}
                    </div>
                    <div>
                        <h3 class="font-semibold mb-2">Detalhes do Pedido</h3>
                        <p><span class="font-medium">Itens:</span></p>
                        <ul class="list-disc pl-5">
                            ${order.items.map(item => {
            const product = products.find(p => p.id === item.id);
            return `
                                <li>${product?.name || 'Produto não encontrado'} 
                                    (x${item.qty}) - R$ ${(product?.price * item.qty).toFixed(2)}
                                </li>`;
        }).join('')}
                        </ul>
                        <p class="mt-2"><span class="font-medium">Subtotal:</span> R$ ${order.total.toFixed(2)}</p>
                        ${order.deliveryFee ? `
                        <p><span class="font-medium">Taxa de Entrega:</span> R$ ${order.deliveryFee.toFixed(2)}</p>
                        ` : ''}
                        <p><span class="font-medium">Total:</span> R$ ${totalWithDelivery}</p>
                        <p><span class="font-medium">Status:</span> ${order.status}</p>
                        <p><span class="font-medium">Pagamento:</span> 
                            <span class="${order.payment ? 'text-green-600' : 'text-yellow-600'}">
                                ${order.payment ? 'Pago' : 'Pendente'}
                            </span>
                        </p>
                        <p><span class="font-medium">Método:</span> ${order.paymentMethod}</p>
                    </div>
                </div>
                ${order.statusHistory ? `
                <div class="mt-4">
                    <h3 class="font-semibold mb-2">Histórico</h3>
                    <div class="bg-white p-3 rounded-md shadow">
                        ${Object.entries(order.statusHistory).map(([status, { start, end }]) => `
                            <p class="py-1 border-b last:border-b-0">
                                <span class="font-medium">${status}:</span> 
                                ${new Date(start).toLocaleString('pt-BR')} 
                                ${end ? `→ ${new Date(end).toLocaleString('pt-BR')}` : ''}
                            </p>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                ${order.notes ? `
                <div class="mt-4">
                    <h3 class="font-semibold mb-2">Observações</h3>
                    <div class="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                        ${order.notes}
                    </div>
                </div>
                ` : ''}
            </td>
        `;

        tableBody.appendChild(row);
        tableBody.appendChild(detailsRow);
    });
}

function openCashRegister() {
    console.log('Abrir Caixa clicked');
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
    console.log('Fechar Caixa clicked');
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

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    document.getElementById('openCashRegister').addEventListener('click', openCashRegister);
    document.getElementById('closeCashRegister').addEventListener('click', closeCashRegister);

    async function loadOrders() {
        try {
            // Carrega produtos
            const productsResponse = await fetch(`${apiUrl}/api/products/burgers`);
            if (!productsResponse.ok) {
                throw new Error(`Erro ao carregar produtos: ${productsResponse.status} - ${productsResponse.statusText}`);
            }
            const productsData = await productsResponse.json();
            products = Array.isArray(productsData.data) ? productsData.data.map(p => ({ ...p, status: p.status || 'Ativo' })) : [];

            // Carrega pedidos da API
            const ordersResponse = await fetch(`${apiUrl}/api/orders`);
            if (!ordersResponse.ok) {
                throw new Error(`Erro ao carregar pedidos: ${ordersResponse.status} - ${ordersResponse.statusText}`);
            }
            const ordersData = await ordersResponse.json();

            // Processa os pedidos da API
            orders = Array.isArray(ordersData.data) ? ordersData.data : [];

            // Mantém a compatibilidade com pedidos locais (se necessário)
            const localOrders = JSON.parse(localStorage.getItem('orders') || '[]');

            // Combina pedidos da API com locais (opcional)
            orders = [...orders, ...localOrders.filter((localOrder) =>
                !orders.some(apiOrder => apiOrder.id === localOrder.id)
            )].sort((a, b) => b.id - a.id);

            // Processa cada pedido
            orders.forEach(order => {
                // Converte datas no formato antigo (se necessário)
                if (typeof order.time === 'string' && order.time.includes('/')) {
                    const [datePart, timePart] = order.time.split(', ');
                    const [day, month, year] = datePart.split('/').map(Number);
                    const [hours, minutes, seconds] = timePart.split(':').map(Number);
                    order.time = new Date(year, month - 1, day, hours, minutes, seconds).toISOString().replace('Z', '-04:00');
                }

                // Inicializa statusHistory se não existir
                if (!order.statusHistory || Object.keys(order.statusHistory).length === 0) {
                    order.statusHistory = { [order.status]: { start: order.time, end: null } };
                }

                // Calcula total se não existir
                if (!order.total) {
                    order.total = order.items.reduce((sum, item) => {
                        const product = products.find(p => p.id === item.id);
                        return sum + (product ? product.price * item.qty : 0);
                    }, 0);
                }

                // Garante que payment existe
                order.payment = order.payment || false;
            });

            // Atualiza localStorage (opcional)
            localStorage.setItem('orders', JSON.stringify(orders));

            updateCashRegisterUI();
            updateCashRegisterTotals();
            renderOrders();
        } catch (error) {
            console.error('Erro:', error);

            // Fallback para localStorage se a API falhar
            orders = JSON.parse(localStorage.getItem('orders') || '[]');
            alert('Não foi possível carregar os dados da API. Usando dados locais.');

            updateCashRegisterUI();
            updateCashRegisterTotals();
            renderOrders();
        }
    }

    loadOrders();
});