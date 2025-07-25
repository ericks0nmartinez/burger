let controlOrders = [];
let products = [];

async function loadControlOrders() {
    try {
        // Fetch products
        const productsResponse = await fetch('../utils/products.json');
        if (!productsResponse.ok) {
            throw new Error(`Erro ao carregar produtos: ${productsResponse.status} - ${productsResponse.statusText}`);
        }
        const productsData = await productsResponse.json();
        products = Array.isArray(productsData) ? productsData.map(p => ({ ...p, status: p.status || 'Ativo' })) : [];

        // Fetch control orders
        controlOrders = JSON.parse(localStorage.getItem('controlOrders') || '[]').sort((a, b) => a.id - b.id);
        // Convert old time format to ISO and correct statusHistory
        controlOrders.forEach(order => {
            // Convert time to ISO if it's in locale format (e.g., "25/07/2025, 12:06:09")
            if (typeof order.time === 'string' && order.time.includes('/')) {
                const [datePart, timePart] = order.time.split(', ');
                const [day, month, year] = datePart.split('/').map(Number);
                const [hours, minutes, seconds] = timePart.split(':').map(Number);
                order.time = new Date(year, month - 1, day, hours, minutes, seconds).toISOString().replace('Z', '-04:00');
            }
            // Initialize or correct statusHistory
            if (!order.statusHistory || Object.keys(order.statusHistory).length === 0) {
                order.statusHistory = { [order.status]: { start: order.time, end: null } };
            } else {
                // Convert any locale format start times in statusHistory
                for (let status in order.statusHistory) {
                    if (typeof order.statusHistory[status].start === 'string' && order.statusHistory[status].start.includes('/')) {
                        const [datePart, timePart] = order.statusHistory[status].start.split(', ');
                        const [day, month, year] = datePart.split('/').map(Number);
                        const [hours, minutes, seconds] = timePart.split(':').map(Number);
                        order.statusHistory[status].start = new Date(year, month - 1, day, hours, minutes, seconds).toISOString().replace('Z', '-04:00');
                    }
                }
                if (!order.statusHistory[order.status]) {
                    order.statusHistory[order.status] = { start: new Date().toISOString().replace('Z', '-04:00'), end: null };
                }
            }
        });
        localStorage.setItem('controlOrders', JSON.stringify(controlOrders)); // Save updated orders
        renderControlOrders();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os dados. Verifique o arquivo products.json.');
    }
}

function renderControlOrders() {
    const tableBody = document.getElementById('controlTable');
    tableBody.innerHTML = '';
    controlOrders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2">${order.name.split(' ')[0]}</td>
            <td class="px-6 py-4">${new Date(order.time).toLocaleString('pt-BR')}</td>
            <td class="px-4 py-2">
                <button class="ml-2 text-blue-500 hover:underline" onclick="toggleAccordion(${order.id})">▼</button>
            </td>
        `;
        const details = document.createElement('tr');
        details.className = `hidden accordion-content-${order.id}`;
        // Calculate durations for display
        let statusDurations = '';
        for (let status in order.statusHistory) {
            const { start, end } = order.statusHistory[status];
            if (end) {
                const durationMs = new Date(end) - new Date(start);
                const durationMin = Math.floor(durationMs / 60000); // Convert to minutes
                const durationSec = Math.floor((durationMs % 60000) / 1000); // Remaining seconds
                statusDurations += `<p>${status}: ${durationMin}m ${durationSec}s</p>`;
            } else if (status === order.status && status !== 'Entregue') {
                const currentTime = new Date();
                const startTime = new Date(start);
                const durationMs = currentTime - startTime;
                const durationMin = Math.max(0, Math.floor(durationMs / 60000)); // Avoid negative
                const durationSec = Math.max(0, Math.floor((durationMs % 60000) / 1000)); // Avoid negative
                statusDurations += `<p>${status} (atual): ${durationMin}m ${durationSec}s</p>`;
            } else if (status === 'Entregue' && !end) {
                statusDurations += `<p>${status} (atual): 0m 0s (registrado às ${new Date(start).toLocaleTimeString('pt-BR')})</p>`;
            }
        }
        details.innerHTML = `
            <td colspan="3" class="px-4 py-2">
                <p>Tipo: ${order.delivery ? 'Entrega' : 'Retirada'}${order.pickupTime ? ` (${order.pickupTime})` : ''}</p>
                <p>Pagamento: ${order.paymentMethod}</p>
                ${order.address ? `<p>Endereço: ${order.address.address}, ${order.address.number}, ${order.address.neighborhood}</p>` : ''}
                <p>Itens: ${order.items.map(i => `${products.find(p => p.id === i.id)?.name || 'Produto não encontrado'} (x${i.qty})`).join(', ')}</p>
                <p>Status: ${order.status}</p>
                <div class="mt-2">${statusDurations}</div>
            </td>
        `;
        tableBody.appendChild(row);
        tableBody.appendChild(details);
    });
}

function toggleAccordion(id) {
    const content = document.querySelector(`.accordion-content-${id}`);
    content.classList.toggle('hidden');
}

loadControlOrders();