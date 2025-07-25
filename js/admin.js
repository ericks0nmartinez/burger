let products = [];

// Fetch products from products.json
async function fetchProducts() {
    try {
        const response = await fetch('../utils/products.json');
        if (!response.ok) throw new Error('Erro ao carregar produtos');
        products = await response.json();
        // Ensure each product has a status
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
            product.price = values.productPrice;
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

// Open modal for new product
document.getElementById('addProductBtn').addEventListener('click', () => {
    openModal({
        ...productModalConfig,
        onSave: (values) => {
            const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
            products.push({ id: newId, name: values.productName, price: values.productPrice, description: '', image: values.imageUrl, status: 'Ativo' });
            renderProducts();
            // Note: To persist changes, you would need a backend to save to products.json
        }
    });
});

// Initial fetch
fetchProducts();