import { Document } from 'mongoose';
import { IOrder } from './Orders';

export interface IOrderClient extends IOrder {
    // Adicione campos específicos do cliente se necessário
    clientNotes?: string;
}