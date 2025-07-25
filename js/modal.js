// Track modal readiness and queued actions
let isModalReady = false;
let modalQueue = [];

// Load modal HTML into the modal container
async function loadModal() {
    try {
        const modalPaths = ['/components/modal.html', '/burger/components/modal.html']; // Try both paths
        let response;
        for (const path of modalPaths) {
            console.log('Trying to fetch modal from:', new URL(path, window.location.origin).href);
            response = await fetch(path);
            if (response.ok) break;
        }
        if (!response.ok) throw new Error(`Erro ao carregar modal: ${response.statusText}`);
        const modalHtml = await response.text();
        document.getElementById('modalContainer').innerHTML = modalHtml;
        isModalReady = true;
        // Process any queued modal openings
        modalQueue.forEach(config => openModalNow(config));
        modalQueue = [];
    } catch (error) {
        console.error('Erro ao carregar modal:', error);
        alert('Não foi possível carregar o modal. Verifique os caminhos ou o arquivo components/modal.html.');
    }
}

// Initialize modal loading
loadModal();

// Open modal with dynamic content (wrapper to handle readiness)
function openModal(config) {
    if (isModalReady) {
        openModalNow(config);
    } else {
        modalQueue.push(config);
    }
}

// Internal function to open modal
function openModalNow(config) {
    const { title, description, fields, onSave, initialValues, customElements } = config || {};
    const modal = document.getElementById('productModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalFields = document.getElementById('modalFields');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // Verify elements exist
    if (!modal || !modalTitle || !modalDescription || !modalFields || !saveBtn || !cancelBtn) {
        console.error('Modal elements not found in DOM');
        alert('Erro ao abrir o modal. Tente novamente.');
        return;
    }

    // Set title and description
    modalTitle.textContent = title || 'Título do Modal';
    modalDescription.textContent = description || '';

    // Clear previous fields
    modalFields.innerHTML = '';

    // Generate fields dynamically
    fields.forEach(field => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'mb-4';
        if (field.type === 'select') {
            fieldDiv.innerHTML = `
                <label for="${field.name}" class="block text-sm font-medium text-gray-700">${field.name}</label>
                <select id="${field.name}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
            `;
        } else {
            fieldDiv.innerHTML = `
                <label for="${field.name}" class="block text-sm font-medium text-gray-700">${field.name}</label>
                <input type="${field.type}" id="${field.name}" placeholder="${field.placeholder || ''}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
            `;
        }
        modalFields.appendChild(fieldDiv);
        // Set initial values if provided (for edit mode)
        if (initialValues && initialValues[field.name] !== undefined) {
            const input = document.getElementById(field.name);
            input.value = initialValues[field.name];
        }
    });

    // Add custom elements if provided
    if (customElements) {
        customElements.forEach(element => {
            const elemDiv = document.createElement('div');
            elemDiv.className = 'mb-4';
            if (element.type === 'checkbox') {
                elemDiv.innerHTML = `
                    <label class="flex items-center">
                        <input type="checkbox" id="${element.id}" class="mr-2 leading-tight">
                        <span class="text-sm text-gray-700">${element.label}</span>
                    </label>
                `;
                modalFields.appendChild(elemDiv);
                if (element.onChange) {
                    document.getElementById(element.id).addEventListener('change', element.onChange);
                }
            } else if (element.type === 'radioGroup') {
                const radioGroup = document.createElement('div');
                radioGroup.className = 'ml-6';
                element.options.forEach(opt => {
                    const radioDiv = document.createElement('div');
                    radioDiv.className = 'flex items-center mb-2';
                    radioDiv.innerHTML = `
                        <input type="radio" id="${element.name}_${opt}" name="${element.name}" value="${opt}" class="mr-2 leading-tight">
                        <label for="${element.name}_${opt}" class="text-sm text-gray-700">${opt}</label>
                    `;
                    radioGroup.appendChild(radioDiv);
                });
                elemDiv.innerHTML = `<p class="text-sm font-medium text-gray-700">${element.label}</p>`;
                elemDiv.appendChild(radioGroup);
                modalFields.appendChild(elemDiv);
            } else if (element.type === 'conditionalInputs') {
                const inputGroup = document.createElement('div');
                inputGroup.className = 'ml-6 hidden';
                inputGroup.id = element.id;
                element.fields.forEach(field => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.className = 'mb-2';
                    fieldDiv.innerHTML = `
                        <label for="${field.name}" class="block text-sm font-medium text-gray-700">${field.name}</label>
                        <input type="${field.type}" id="${field.name}" placeholder="${field.placeholder || ''}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    `;
                    inputGroup.appendChild(fieldDiv);
                });
                elemDiv.innerHTML = '';
                elemDiv.appendChild(inputGroup);
                modalFields.appendChild(elemDiv);
            }
        });
    }

    // Show modal
    modal.classList.remove('hidden');

    // Save button handler
    saveBtn.onclick = () => {
        const values = fields.reduce((acc, field) => {
            const input = document.getElementById(field.name);
            acc[field.name] = field.type === 'number' ? parseFloat(input.value) : input.value;
            return acc;
        }, {});
        if (Object.values(values).some(value => !value && value !== 0)) {
            alert('Preencha todos os campos corretamente.');
            return;
        }
        onSave(values);
        modal.classList.add('hidden');
    };

    // Cancel button handler
    cancelBtn.onclick = () => {
        modal.classList.add('hidden');
    };
}