
let products = [];
let deliveryOrders = [];
const apiUrl = "https://stok-5ytv.onrender.com";

// Carrega produtos
async function fetchProducts() {
    try {
        const response = await fetch(`${apiUrl}/api/products/burgers`);
        if (!response.ok) throw new Error(`Erro ao carregar produtos: ${response.status}`);
        const result = await response.json();
        products = result.data || [];
    } catch (error) {
        console.error('Erro:', error);
        products = [];
    }
}

// Carrega pedidos de entrega
async function fetchDeliveryOrders() {
    try {
        const response = await fetch(`${apiUrl}/api/orders/delivery?_=${Date.now()}`);
        if (!response.ok) throw new Error(`Erro: ${response.status}`);
        const result = await response.json();
        return Array.isArray(result.data) ? result.data : [result.data];
    } catch (error) {
        console.error('Erro:', error);
        return [];
    }
}

// Exibe pedidos na tabela
async function renderDeliveryOrders() {
    deliveryOrders = await fetchDeliveryOrders();
    const tableBody = document.getElementById('deliveryTable');
    tableBody.innerHTML = '';

    if (deliveryOrders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4 text-gray-500">
                    Nenhum pedido de entrega hoje
                </td>
            </tr>
        `;
        return;
    }

    deliveryOrders.forEach(order => {
        const totalWithDelivery = (order.total + (order.deliveryFee || 0)).toFixed(2);

        // Linha principal
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-4 py-3">${order.name.split(' ')[0]}</td>
            <td class="px-4 py-3">
                ${order.address ? `${order.address.address}, ${order.address.number}` : 'Retirada'}
            </td>
            <td class="px-4 py-3">${new Date(order.time).toLocaleTimeString('pt-BR')}</td>
            <td class="px-4 py-3 text-center">
                <button onclick="toggleOrderDetails(${order.id})" 
                    class="text-blue-500 hover:text-blue-700 mr-3">
                    <i class="fas fa-chevron-down"></i> Detalhes
                </button>
                ${order.status === 'A caminho' ? `
                <button onclick="showDeliveryConfirmation(${order.id})" 
                    class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md">
                    Entregue
                </button>
                ` : ''}
            </td>
        `;

        // Linha de detalhes (accordion)
        const detailsRow = document.createElement('tr');
        detailsRow.id = `details-${order.id}`;
        detailsRow.className = 'hidden bg-gray-50';
        detailsRow.innerHTML = `
            <td colspan="4" class="px-4 py-3">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 class="font-semibold mb-2">Informações do Cliente</h3>
                        <p><span class="font-medium">Nome:</span> ${order.name}</p>
                        <p><span class="font-medium">Telefone:</span> ${order.phone}</p>
                        <p><span class="font-medium">Endereço:</span> ${order.address ? `
                            ${order.address.address}, ${order.address.number}<br>
                            ${order.address.neighborhood}
                        ` : 'Retirada no local'}</p>
                    </div>
                    <div>
                        <h3 class="font-semibold mb-2">Detalhes do Pedido</h3>
                        <p><span class="font-medium">Itens:</span> 
                            ${order.items.map(item => {
            const product = products.find(p => p.id === item.id);
            return `${product?.name || 'Produto não encontrado'} (x${item.qty})`;
        }).join(', ')}
                        </p>
                        <p><span class="font-medium">Total:</span> R$ ${totalWithDelivery}</p>
                        <p><span class="font-medium">Status:</span> ${order.status}</p>
                        <p><span class="font-medium">Pagamento:</span> ${order.payment ? 'Confirmado' : 'Pendente'}</p>
                    </div>
                </div>
                ${order.statusHistory ? `
                <div class="mt-4">
                    <h3 class="font-semibold mb-2">Histórico</h3>
                    ${Object.entries(order.statusHistory).map(([status, { start, end }]) => `
                        <p>${status}: ${new Date(start).toLocaleString('pt-BR')} ${end ? `→ ${new Date(end).toLocaleString('pt-BR')}` : ''}</p>
                    `).join('')}
                </div>
                ` : ''}
            </td>
        `;

        tableBody.appendChild(row);
        tableBody.appendChild(detailsRow);
    });
}

// Funções de interação
function toggleOrderDetails(orderId) {
    const detailsRow = document.getElementById(`details-${orderId}`);
    detailsRow.classList.toggle('hidden');

    // Atualiza ícone
    const button = document.querySelector(`button[onclick="toggleOrderDetails(${orderId})"]`);
    if (detailsRow.classList.contains('hidden')) {
        button.innerHTML = '<i class="fas fa-chevron-down"></i> Detalhes';
    } else {
        button.innerHTML = '<i class="fas fa-chevron-up"></i> Ocultar';
    }
}

async function showDeliveryConfirmation(orderId) {
    const order = deliveryOrders.find(o => o.id === orderId);
    if (!order) return;

    // Mapeia os métodos de pagamento para nomes mais amigáveis
    const paymentMethods = {
        'Cartão Crédito': 'Cartão de Crédito',
        'Cartão Débito': 'Cartão de Débito',
        'Dinheiro': 'Dinheiro',
        'PIX': 'PIX',
        'default': order.paymentMethod
    };

    const paymentMethod = paymentMethods[order.paymentMethod] || paymentMethods['default'];
    const paymentStatus = order.payment ? '✅ Pago' : '❌ Pendente';

    // Função para fechar o modal de forma consistente
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
            console.log(`Confirmando entrega do pedido ${orderId}...`);

            const response = await fetch(`${apiUrl}/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    newStatus: 'Entregue',
                    currentStatus: 'A caminho'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('Entrega confirmada com sucesso!');
            closeModal(); // Fecha o modal após sucesso
            await renderDeliveryOrders();

            // Feedback visual
            const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
            if (row) {
                row.classList.add('updated-row');
            }

        } catch (error) {
            console.error('Erro ao confirmar entrega:', error);
            const errorElement = document.createElement('div');
            errorElement.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mt-4';
            errorElement.innerHTML = `
                <p class="font-bold">Erro</p>
                <p>Não foi possível confirmar a entrega: ${error.message}</p>
            `;

            const modalFields = document.getElementById('modalFields');
            if (modalFields) {
                modalFields.appendChild(errorElement);
            }
        }
    };

    // Configuração do modal (mantendo o conteúdo que você quer mostrar)
    openModal({
        title: `Confirmar Entrega - Pedido #${orderId}`,
        description: `Confirme a entrega para ${order.name}`,
        customElements: [{
            type: 'custom',
            html: `
                <div class="space-y-4">
                    <!-- Seção de Informações do Pedido -->
                    <div class="bg-gray-50 p-4 rounded-md">
                        <h3 class="font-semibold text-lg mb-2">Detalhes do Pedido</h3>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="font-medium">Forma de Pagamento:</p>
                                <p>${paymentMethod} ${paymentStatus}</p>
                            </div>
                            <div>
                                <p class="font-medium">Valor Total:</p>
                                <p>R$ ${(order.total + (order.deliveryFee || 0)).toFixed(2)}</p>
                            </div>
                        </div>

                        ${order.address ? `
                        <div class="mt-3">
                            <p class="font-medium">Endereço de Entrega:</p>
                            <p>${order.address.address}, ${order.address.number}</p>
                            <p>${order.address.neighborhood}</p>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Itens do Pedido -->
                    <div class="border rounded-md overflow-hidden">
                        <table class="w-full">
                            <thead class="bg-gray-100">
                                <tr>
                                    <th class="px-4 py-2 text-left">Item</th>
                                    <th class="px-4 py-2 text-right">Qtd</th>
                                    <th class="px-4 py-2 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items.map(item => {
                const product = products.find(p => p.id === item.id);
                return `
                                        <tr class="border-t">
                                            <td class="px-4 py-2">${product?.name || 'Produto não encontrado'}</td>
                                            <td class="px-4 py-2 text-right">${item.qty}</td>
                                            <td class="px-4 py-2 text-right">R$ ${product?.price.toFixed(2) || '0.00'}</td>
                                        </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Aviso importante -->
                    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div class="flex items-start">
                            <svg class="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" 
                                 xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                            <div class="ml-3">
                                <p class="text-sm text-yellow-700">
                                    Verifique com o cliente antes de confirmar:
                                    <ul class="list-disc pl-5 mt-1">
                                        <li>Recebimento de todos os itens</li>
                                        <li>Forma de pagamento (${paymentMethod})</li>
                                        <li>Satisfação com o pedido</li>
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

    // Configura os botões diretamente
    const modal = document.getElementById('productModal');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    if (saveBtn) {
        saveBtn.onclick = handleSave;
        saveBtn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'text-white', 'px-4', 'py-2', 'rounded');
    }

    if (cancelBtn) {
        cancelBtn.onclick = closeModal;
        cancelBtn.classList.add('border', 'border-gray-300', 'text-gray-700', 'px-4', 'py-2', 'rounded', 'hover:bg-gray-50');
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await fetchProducts();
    await renderDeliveryOrders();

    setInterval(renderDeliveryOrders, 30000);

    document.addEventListener('orderUpdated', renderDeliveryOrders);
});
