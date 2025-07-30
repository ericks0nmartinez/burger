let products = [];
let config = {};

// Fetch config from config.json
async function loadConfig() {
    try {
        const response = await fetch('../utils/config.json');
        if (!response.ok) throw new Error(`Erro ao carregar configuração: ${response.status} - ${response.statusText}`);
        config = await response.json();
        console.log('Configuração carregada:', config);
    } catch (error) {
        console.error('Erro ao carregar config.json:', error);
        alert('Não foi possível carregar a configuração. Usando valores padrão.');
        config = {
            PAYMENT_METHODS: ['Selecione', 'Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito'],
            DEBIT_CARD_FEE_RATE: 0.02,
            CREDIT_CARD_FEE_RATE: 0.05,
            TAXA_POR_KM: 1.5,
            PREFIXOS_LOGRADOURO: ['Rua', 'Avenida', 'Travessa', 'Alameda', 'Praça', ''],
            latitude: '-20.4899098',
            longitude: '-54.6371336',
            DELIVERY_FEE: 10.0,
            TABLE_COUNT: 6
        };
    }
}

// Fetch products from products.json
async function fetchProducts() {
    try {
        const response = await fetch('../utils/products.json');
        if (!response.ok) throw new Error('Erro ao carregar produtos');
        products = await response.json();
        products = products.map(product => ({ ...product, status: product.status || 'Ativo' }));
        renderProducts();
        console.log('Fetch terminou o carregamento:', response.url);
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os produtos. Verifique o arquivo products.json.');
    }
}

// Render products in the table
function renderProducts() {
    const tableBody = document.getElementById('productTable');
    tableBody.innerHTML = '';
    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap"><img src="${product.image}" alt="${product.name}" class="w-6 h-6 object-cover"></td>
            <td class="px-6 py-4 whitespace-nowrap">${product.name}</td>
            <td class="px-6 py-4 whitespace-nowrap">R$ ${product.price.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${product.status}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="toggleStatus(${product.id})" class="text-blue-500 hover:underline">${product.status === 'Ativo' ? 'Inativar' : 'Ativar'}</button>
                <button onclick="editProduct(${product.id})" class="ml-2 text-blue-500 hover:underline">Editar</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Toggle product status
function toggleStatus(id) {
    const product = products.find(p => p.id === id);
    product.status = product.status === 'Ativo' ? 'Inativo' : 'Ativo';
    renderProducts();
    // Note: To persist changes, you would need a backend to save to products.json
}

// Modal configuration for product
const productModalConfig = {
    title: 'Cadastrar Produto',
    description: 'Preencha os campos abaixo para adicionar.',
    fields: [
        { name: 'imageUrl', type: 'text', placeholder: 'URL da Imagem' },
        { name: 'productName', type: 'text', placeholder: 'Nome do Produto' },
        { name: 'productPrice', type: 'number', placeholder: 'Valor' }
    ]
};

// Edit product
function editProduct(id) {
    const product = products.find(p => p.id === id);
    openModal({
        ...productModalConfig,
        title: 'Editar Produto',
        description: 'Altere os campos abaixo para editar o produto.',
        onSave: (values) => {
            const product = products.find(p => p.id === id);
            product.image = values.imageUrl;
            product.name = values.productName;
            product.price = parseFloat(values.productPrice);
            renderProducts();
            // Note: To persist changes, you would need a backend to save to products.json
        },
        initialValues: {
            imageUrl: product.image,
            productName: product.name,
            productPrice: product.price
        }
    });
}

// Modal configuration for editing config.json
function openConfigModal() {
    openModal({
        title: 'Editar Configurações do Sistema',
        description: 'Altere os valores abaixo para configurar o sistema.',
        fields: [
            { name: 'PAYMENT_METHODS', type: 'text', placeholder: 'Métodos de Pagamento (separados por vírgula)' },
            { name: 'DEBIT_CARD_FEE_RATE', type: 'number', placeholder: 'Taxa de Cartão de Débito (%)' },
            { name: 'CREDIT_CARD_FEE_RATE', type: 'number', placeholder: 'Taxa de Cartão de Crédito (%)' },
            { name: 'TAXA_POR_KM', type: 'number', placeholder: 'Taxa por KM (R$)' },
            { name: 'PREFIXOS_LOGRADOURO', type: 'text', placeholder: 'Prefixos de Logradouro (separados por vírgula)' },
            { name: 'latitude', type: 'number', placeholder: 'Latitude' },
            { name: 'longitude', type: 'number', placeholder: 'Longitude' },
            { name: 'DELIVERY_FEE', type: 'number', placeholder: 'Taxa de Entrega (R$)' },
            { name: 'TABLE_COUNT', type: 'number', placeholder: 'Número de Mesas' }
        ],
        onSave: (values) => {
            try {
                // Validate and process inputs
                const newConfig = {
                    PAYMENT_METHODS: values.PAYMENT_METHODS.split(',').map(v => v.trim()).filter(v => v),
                    DEBIT_CARD_FEE_RATE: parseFloat(values.DEBIT_CARD_FEE_RATE) / 100,
                    CREDIT_CARD_FEE_RATE: parseFloat(values.CREDIT_CARD_FEE_RATE) / 100,
                    TAXA_POR_KM: parseFloat(values.TAXA_POR_KM),
                    PREFIXOS_LOGRADOURO: values.PREFIXOS_LOGRADOURO.split(',').map(v => v.trim()).filter(v => v),
                    latitude: values.latitude,
                    longitude: values.longitude,
                    DELIVERY_FEE: parseFloat(values.DELIVERY_FEE),
                    TABLE_COUNT: parseInt(values.TABLE_COUNT)
                };
                // Validate numeric fields
                if (isNaN(newConfig.DEBIT_CARD_FEE_RATE) || isNaN(newConfig.CREDIT_CARD_FEE_RATE) ||
                    isNaN(newConfig.TAXA_POR_KM) || isNaN(newConfig.DELIVERY_FEE) || isNaN(newConfig.TABLE_COUNT)) {
                    throw new Error('Campos numéricos inválidos. Preencha com valores válidos.');
                }
                config = newConfig;
                localStorage.setItem('config', JSON.stringify(config));
                const bc = new BroadcastChannel('config_updates');
                bc.postMessage({ type: 'configUpdated', config });
                alert('Configurações salvas localmente. Implemente um backend para persistir em config.json.');
            } catch (error) {
                console.error('Erro ao salvar configurações:', error);
                alert(`Erro: ${error.message}`);
            }
        },
        initialValues: {
            PAYMENT_METHODS: config.PAYMENT_METHODS.join(', '),
            DEBIT_CARD_FEE_RATE: (config.DEBIT_CARD_FEE_RATE * 100).toFixed(2),
            CREDIT_CARD_FEE_RATE: (config.CREDIT_CARD_FEE_RATE * 100).toFixed(2),
            TAXA_POR_KM: config.TAXA_POR_KM.toFixed(2),
            PREFIXOS_LOGRADOURO: config.PREFIXOS_LOGRADOURO.join(', '),
            latitude: config.latitude,
            longitude: config.longitude,
            DELIVERY_FEE: config.DELIVERY_FEE.toFixed(2),
            TABLE_COUNT: config.TABLE_COUNT
        }
    });
}

// Open modal for new product
document.getElementById('addProductBtn').addEventListener('click', () => {
    openModal({
        ...productModalConfig,
        onSave: (values) => {
            const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
            products.push({ id: newId, name: values.productName, price: parseFloat(values.productPrice), description: '', image: values.imageUrl, status: 'Ativo' });
            renderProducts();
            // Note: To persist changes, you would need a backend to save to products.json
        }
    });
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    document.getElementById('configBtn').addEventListener('click', openConfigModal);
    fetchProducts();
});