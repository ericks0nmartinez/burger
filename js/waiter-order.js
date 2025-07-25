let products = [];
let quantities = {};

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
    openModal({
        title: 'Confirmar Pedido',
        description: 'Preencha os dados do pedido.',
        fields: [
            { name: 'name', type: 'text', placeholder: 'Nome do Cliente' },
            { name: 'phone', type: 'tel', placeholder: 'Telefone' },
            { name: 'tableNumber', type: 'text', placeholder: 'Número da Mesa' },
            { name: 'paymentMethod', type: 'select', options: ['Selecione', 'PIX', 'Cartão', 'Dinheiro'] }
        ],
        customElements: [
            {
                type: 'checkbox',
                id: 'isPackaged',
                label: 'Embalar (para viagem)',
                onChange: function () {
                    window.currentModalValues.isPackaged = this.checked;
                }
            }
        ],
        onSave: (values) => {
            const isPackaged = window.currentModalValues.isPackaged || false;
            const onclient = "false"
            if (!validateOrderForm(values, isPackaged)) return;
            saveOrder(values, isPackaged, onclient);
        },
        initialValues: {}
    });
}

function validateOrderForm(values, isPackaged) {
    if (!values.name || !values.phone || !values.tableNumber || values.paymentMethod === 'Selecione') {
        alert('Preencha todos os campos obrigatórios.');
        return false;
    }
    return true;
}

function saveOrder(values, isPackaged, onclient) {
    const order = {
        id: Date.now(),
        time: new Date().toISOString().replace('Z', '-04:00'),
        name: values.name,
        phone: values.phone,
        onclient,
        tableNumber: values.tableNumber,
        paymentMethod: values.paymentMethod,
        isPackaged: isPackaged,
        items: Object.entries(quantities).filter(([_, qty]) => qty > 0).map(([id, qty]) => ({ id: parseInt(id), qty })),
        status: 'Aguardando'
    };
    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));

    // Reset quantities and refresh UI
    quantities = {};
    renderProducts();
}

function openModal({ title, description, fields, customElements, onSave, initialValues }) {
    const modal = document.getElementById('productModal');
    const modalContent = modal.querySelector('div');
    modalContent.innerHTML = `
        <h2 class="text-xl font-bold mb-2">${title}</h2>
        <p class="mb-4">${description}</p>
        ${fields.map(field => `
            <div class="mb-2">
                <label class="block">${field.placeholder}</label>
                ${field.type === 'select' ? `
                    <select name="${field.name}" id="${field.name}" class="border p-1 w-full">
                        ${field.options.map(option => `<option value="${option}">${option}</option>`).join('')}
                    </select>
                ` : `
                    <input type="${field.type}" name="${field.name}" id="${field.name}" placeholder="${field.placeholder}" value="${initialValues[field.name] || ''}" class="border p-1 w-full">
                `}
            </div>
        `).join('')}
        ${customElements.map(element => {
        if (element.type === 'checkbox') {
            return `
                    <div class="mb-2">
                        <input type="checkbox" id="${element.id}" ${initialValues[element.id] ? 'checked' : ''} onchange="${element.onChange.toString().replace(/function\s*\(\)\s*{/, '').replace(/}$/, '')}">
                        <label for="${element.id}">${element.label}</label>
                    </div>
                `;
        }
        return '';
    }).join('')}
        <button onclick="saveModal()" class="bg-blue-500 text-white px-2 py-1 rounded mt-4">Salvar</button>
        <button onclick="closeModal()" class="bg-gray-500 text-white px-2 py-1 rounded mt-4 ml-2">Cancelar</button>
    `;

    window.currentModalValues = {};
    window.currentModalOnSave = onSave;

    fields.forEach(field => {
        const input = modalContent.querySelector(`#${field.name}`);
        if (input) input.addEventListener('change', (e) => {
            window.currentModalValues[field.name] = e.target.value;
        });
    });
    customElements.forEach(element => {
        if (element.type === 'checkbox') {
            const checkbox = modalContent.querySelector(`#${element.id}`);
            checkbox.addEventListener('change', element.onChange);
            window.currentModalValues[element.id] = checkbox.checked;
        }
    });

    modal.classList.remove('hidden');
}

function saveModal() {
    if (window.currentModalOnSave) {
        window.currentModalOnSave(window.currentModalValues);
    }
    closeModal();
}

function closeModal() {
    const modal = document.getElementById('productModal');
    modal.classList.add('hidden');
    modal.querySelector('div').innerHTML = '';
    window.currentModalValues = {};
    window.currentModalOnSave = null;
}

document.getElementById('placeOrderBtn').addEventListener('click', openOrderModal);
fetchProducts();