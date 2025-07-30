//models/Config.ts
import { Schema, model } from 'mongoose';
import { IConfig } from '../interfaces/config';

const ConfigSchema = new Schema<IConfig>({
    PAYMENT_METHODS: {
        type: [String],
        required: true,
        default: ['Selecione', 'Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito'],
    },
    DEBIT_CARD_FEE_RATE: {
        type: Number,
        required: true,
        default: 0.02,
    },
    CREDIT_CARD_FEE_RATE: {
        type: Number,
        required: true,
        default: 0.05,
    },
    TAXA_POR_KM: {
        type: Number,
        required: true,
        default: 1.5,
    },
    PREFIXOS_LOGRADOURO: {
        type: [String],
        required: true,
        default: ['Rua', 'Avenida', 'Travessa', 'Alameda', 'Praça', ''],
    },
    latitude: {
        type: String,
        required: true,
        default: '-20.4899098',
    },
    longitude: {
        type: String,
        required: true,
        default: '-54.6371336',
    },
    DELIVERY_FEE: {
        type: Number,
        required: true,
        default: 10.0,
    },
    TABLE_COUNT: {
        type: Number,
        required: true,
        default: 6,
    },
});

export const ConfigModel = model<IConfig>('Config', ConfigSchema);