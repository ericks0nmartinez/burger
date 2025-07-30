//interfaces/config.ts
import { Document } from 'mongoose';

export interface IConfig extends Document {
    PAYMENT_METHODS: string[];
    DEBIT_CARD_FEE_RATE: number;
    CREDIT_CARD_FEE_RATE: number;
    TAXA_POR_KM: number;
    PREFIXOS_LOGRADOURO: string[];
    latitude: string;
    longitude: string;
    DELIVERY_FEE: number;
    TABLE_COUNT: number;
}