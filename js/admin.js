let products = [];
const apiUrl = "https://stok-5ytv.onrender.com";

// Função para obter o próximo ID disponível
async function getNextAvailableId() {
    try {
        const response = await fetch(`${apiUrl}/api/products/burgers`);
        if (!response.ok) throw new Error('Erro ao carregar produtos');
        const result = await response.json();
        const products = result.data || [];

        if (products.length === 0) return 1;
        const maxId = Math.max(...products.map(p => p.id));
        return maxId + 1;
    } catch (error) {
        console.error('Erro ao obter próximo ID:', error);
        throw error;
    }
}

// Fetch products from API
async function fetchProducts() {
    try {
        const response = await fetch(`${apiUrl}/api/products/burgers`);
        if (!response.ok) throw new Error('Erro ao carregar produtos');
        const result = await response.json();
        products = result.data || [];
        renderProducts();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os produtos. Verifique a conexão com a API.');
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
                <button onclick="deleteProduct(${product.id})" class="ml-2 text-red-500 hover:underline">Excluir</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Toggle product status
async function toggleStatus(id) {
    try {
        const product = products.find(p => p.id === id);
        const newStatus = product.status === 'Ativo' ? 'Inativo' : 'Ativo';

        const response = await fetch(`${apiUrl}/api/products/burgers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Erro ao atualizar status');

        product.status = newStatus;
        renderProducts();
        alert('Status atualizado com sucesso!');
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível atualizar o status do produto.');
    }
}

// Delete product
async function deleteProduct(id) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
        const response = await fetch(`${apiUrl}/api/products/burgers/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Erro ao excluir produto');

        products = products.filter(p => p.id !== id);
        renderProducts();
        alert('Produto excluído com sucesso!');
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível excluir o produto.');
    }
}

// Modal configuration for product
const productModalConfig = {
    title: 'Cadastrar Produto',
    description: 'Preencha os campos abaixo para adicionar.',
    fields: [
        { name: 'image', type: 'text', placeholder: 'URL da Imagem' },
        { name: 'name', type: 'text', placeholder: 'Nome do Produto' },
        { name: 'price', type: 'number', placeholder: 'Valor' },
        { name: 'description', type: 'text', placeholder: 'Descrição' }
    ]
};

// Edit product
function editProduct(id) {
    const product = products.find(p => p.id === id);
    openModal({
        ...productModalConfig,
        title: 'Editar Produto',
        description: 'Altere os campos abaixo para editar o produto.',
        onSave: async (values) => {
            try {
                const updatedProduct = {
                    ...product,
                    name: values.name,
                    price: parseFloat(values.price),
                    description: values.description,
                    image: values.image
                };

                const response = await fetch(`${apiUrl}/api/products/burgers/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedProduct)
                });

                if (!response.ok) throw new Error('Erro ao atualizar produto');

                const result = await response.json();
                const index = products.findIndex(p => p.id === id);
                products[index] = result.data;
                renderProducts();
                alert('Produto atualizado com sucesso!');
            } catch (error) {
                console.error('Erro:', error);
                alert('Não foi possível atualizar o produto.');
            }
        },
        initialValues: {
            image: product.image,
            name: product.name,
            price: product.price,
            description: product.description
        }
    });
}

// Open modal for new product
document.getElementById('addProductBtn').addEventListener('click', async () => {
    try {
        const nextId = await getNextAvailableId();

        openModal({
            ...productModalConfig,
            onSave: async (values) => {
                try {
                    const newProduct = {
                        id: nextId,
                        name: values.name,
                        price: parseFloat(values.price),
                        description: values.description,
                        image: values.image,
                        status: 'Ativo'
                    };

                    const response = await fetch(`${apiUrl}/api/products/burgers`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newProduct)
                    });

                    if (!response.ok) throw new Error('Erro ao criar produto');

                    const result = await response.json();
                    products.push(result.data);
                    renderProducts();
                    alert('Produto criado com sucesso!');
                } catch (error) {
                    console.error('Erro:', error);
                    alert('Não foi possível criar o produto.');
                }
            }
        });
    } catch (error) {
        console.error('Erro ao preparar novo produto:', error);
        alert('Não foi possível preparar o cadastro de novo produto.');
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    fetchProducts();
});
