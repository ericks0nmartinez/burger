

let config = {};
const url = "http://192.168.1.67:3000"

// Fetch config from API
async function loadConfig() {
    try {
        const response = await fetch(`${url}/api/config`);
        if (!response.ok) throw new Error(`Erro ao carregar configuração: ${response.status} - ${response.statusText}`);
        const result = await response.json();
        config = result.data || {};
        console.log('Configuração carregada:', config);
    } catch (error) {
        console.error('Erro ao carregar configuração da API:', error);
        alert('Não foi possível carregar a configuração. Por favor, contate o administrador.');
    }
}

// Modal configuration for editing config
function openConfigModal() {
    if (typeof openModal !== 'function') {
        console.error('Função openModal não está definida. Verifique se modal.js está carregado corretamente.');
        alert('Erro: Modal não está disponível. Verifique se modal.js está carregado.');
        return;
    }
    console.log('Abrindo modal de configurações com config:', config);
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
        onSave: async (values) => {
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
                // Send updated config to API
                const response = await fetch('/api/config', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newConfig)
                });
                if (!response.ok) throw new Error(`Erro ao salvar configuração: ${response.status} - ${response.statusText}`);
                const result = await response.json();
                config = result.data;
                localStorage.setItem('config', JSON.stringify(config));
                const bc = new BroadcastChannel('config_updates');
                bc.postMessage({ type: 'configUpdated', config });
                alert('Configurações salvas com sucesso.');
            } catch (error) {
                console.error('Erro ao salvar configurações:', error);
                alert(`Erro: ${error.message}. Por favor, contate o administrador.`);
            }
        },
        initialValues: {
            PAYMENT_METHODS: config.PAYMENT_METHODS ? config.PAYMENT_METHODS.join(', ') : '',
            DEBIT_CARD_FEE_RATE: config.DEBIT_CARD_FEE_RATE ? (config.DEBIT_CARD_FEE_RATE * 100).toFixed(2) : '',
            CREDIT_CARD_FEE_RATE: config.CREDIT_CARD_FEE_RATE ? (config.CREDIT_CARD_FEE_RATE * 100).toFixed(2) : '',
            TAXA_POR_KM: config.TAXA_POR_KM ? config.TAXA_POR_KM.toFixed(2) : '',
            PREFIXOS_LOGRADOURO: config.PREFIXOS_LOGRADOURO ? config.PREFIXOS_LOGRADOURO.join(', ') : '',
            latitude: config.latitude || '',
            longitude: config.longitude || '',
            DELIVERY_FEE: config.DELIVERY_FEE ? config.DELIVERY_FEE.toFixed(2) : '',
            TABLE_COUNT: config.TABLE_COUNT || ''
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM carregado, iniciando configuração...');
    await loadConfig();
    const configBtn = document.getElementById('configBtn');
    if (!configBtn) {
        console.error('Botão configBtn não encontrado no DOM. Verifique admin.html.');
        alert('Erro: Botão de configurações não encontrado. Por favor, contate o administrador.');
        return;
    }
    configBtn.addEventListener('click', () => {
        console.log('Botão Configurações clicado');
        openConfigModal();
    });
});