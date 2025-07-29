let isModalReady = false;
let modalQueue = [];

async function loadModal() {
    try {
        const modalPaths = ['./modal.html', '../components/modal.html', '/components/modal.html', '/burger/components/modal.html'];
        let response;
        for (const path of modalPaths) {
            console.log('Tentando carregar modal de:', path);
            response = await fetch(path);
            if (response.ok) break;
            console.warn(`Falha ao carregar modal de ${path}: ${response.status} - ${response.statusText}`);
        }
        if (!response.ok) {
            throw new Error(`Nenhum caminho válido para modal.html encontrado. Último erro: ${response.status} - ${response.statusText}`);
        }
        const modalHtml = await response.text();
        const modalContainer = document.getElementById('modalContainer');
        if (!modalContainer) {
            throw new Error('Contêiner do modal (modalContainer) não encontrado no DOM');
        }
        modalContainer.innerHTML = modalHtml;
        const requiredElements = ['productModal', 'modalTitle', 'modalDescription', 'modalFields', 'saveBtn', 'cancelBtn'];
        for (const id of requiredElements) {
            if (!document.getElementById(id)) {
                throw new Error(`Elemento do modal com ID "${id}" não encontrado no modal.html carregado`);
            }
        }
        isModalReady = true;
        console.log('Modal carregado com sucesso');
        modalQueue.forEach(config => {
            console.log('Processando modal na fila:', config);
            openModalNow(config);
        });
        modalQueue = [];
    } catch (error) {
        console.error('Erro ao carregar modal:', error);
        alert(`Não foi possível carregar o modal: ${error.message}. Verifique o console para mais detalhes.`);
    }
}

loadModal();

function openModal(config) {
    console.log('Tentando abrir modal com config:', config);
    if (isModalReady) {
        openModalNow(config);
    } else {
        console.log('Modal não está pronto, adicionando à fila');
        modalQueue.push(config);
        loadModal();
    }
}

function openModalNow(config) {
    console.log('Abrindo modal agora:', config);
    const { title, description, fields, onSave, initialValues, customElements } = config || {};
    const modal = document.getElementById('productModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalFields = document.getElementById('modalFields');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    if (!modal || !modalTitle || !modalDescription || !modalFields || !saveBtn || !cancelBtn) {
        console.error('Elementos do modal não encontrados no DOM:', {
            modal: !!modal,
            modalTitle: !!modalTitle,
            modalDescription: !!modalDescription,
            modalFields: !!modalFields,
            saveBtn: !!saveBtn,
            cancelBtn: !!cancelBtn
        });
        alert('Erro ao abrir o modal. Verifique o console para mais detalhes.');
        return;
    }

    modalTitle.textContent = title || 'Título do Modal';
    modalDescription.innerHTML = description || ''; // Use innerHTML to support <br> tags
    modalFields.innerHTML = '';

    if (customElements) {
        customElements.forEach(element => {
            const elemDiv = document.createElement('div');
            elemDiv.className = 'mb-4';
            if (element.type === 'checkbox') {
                elemDiv.innerHTML = `
                    <label class="flex items-center">
                        <input type="checkbox" id="${element.id}" class="mr-2 leading-tight">
                        <span class="text-sm text-gray-500">${element.label}</span>
                    </label>
                `;
                modalFields.appendChild(elemDiv);
                if (element.onChange) {
                    document.getElementById(element.id).addEventListener('change', element.onChange);
                }
            } else if (element.type === 'radioGroup') {
                const label = document.createElement('p');
                label.className = 'text-sm font-medium text-gray-700';
                label.textContent = element.label;
                const radioGroup = document.createElement('div');
                radioGroup.className = 'ml-6 space-y-2';
                radioGroup.id = 'pickupTimeGroup';
                element.options.forEach(opt => {
                    const radioDiv = document.createElement('div');
                    radioDiv.className = 'flex items-center';
                    radioDiv.innerHTML = `
                        <input type="radio" id="${element.name}_${opt}" name="${element.name}" value="${opt}" class="mr-2 leading-tight">
                        <label for="${element.name}_${opt}" class="text-sm text-gray-500">${opt}</label>
                    `;
                    radioGroup.appendChild(radioDiv);
                });
                elemDiv.appendChild(label);
                elemDiv.appendChild(radioGroup);
                modalFields.appendChild(elemDiv);
            } else if (element.type === 'conditionalInputs') {
                const inputGroup = document.createElement('div');
                inputGroup.className = 'ml-6 hidden space-y-2';
                inputGroup.id = element.id;
                element.fields.forEach(field => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.className = 'mb-2';
                    fieldDiv.innerHTML = `
                        <label for="${field.name}" class="block text-sm font-medium text-gray-700">${field.placeholder}</label>
                        <input type="${field.type}" id="${field.name}" placeholder="${field.placeholder || ''}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50">
                    `;
                    inputGroup.appendChild(fieldDiv);
                });
                elemDiv.appendChild(inputGroup);
                modalFields.appendChild(elemDiv);
            } else if (element.type === 'custom') {
                elemDiv.innerHTML = element.html;
                modalFields.appendChild(elemDiv);
            }
        });
    }

    if (fields) {
        fields.forEach(field => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'mb-4';
            if (field.type === 'select') {
                fieldDiv.innerHTML = `
                    <label for="${field.name}" class="block text-sm font-medium text-gray-700">${field.placeholder}</label>
                    <select id="${field.name}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50">
                        ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                `;
            } else {
                fieldDiv.innerHTML = `
                    <label for="${field.name}" class="block text-sm font-medium text-gray-700">${field.placeholder}</label>
                    <input type="${field.type}" id="${field.name}" placeholder="${field.placeholder || ''}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50">
                `;
            }
            modalFields.appendChild(fieldDiv);
            if (initialValues && initialValues[field.name] !== undefined) {
                const input = document.getElementById(field.name);
                input.value = initialValues[field.name];
            }
        });
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    console.log('Modal visível no DOM, estilo display:', modal.style.display);

    saveBtn.onclick = () => {
        console.log('Botão Salvar clicado');
        const values = fields.reduce((acc, field) => {
            const input = document.getElementById(field.name);
            acc[field.name] = field.type === 'number' ? parseFloat(input.value) : input.value;
            return acc;
        }, {});
        onSave(values);
        modal.classList.add('hidden');
        modal.style.display = 'none';
    };

    cancelBtn.onclick = () => {
        console.log('Botão Cancelar clicado');
        modal.classList.add('hidden');
        modal.style.display = 'none';
    };
}