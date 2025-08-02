import { Schema, model } from 'mongoose';
import { IOrderClient } from '../interfaces/OrderClient';
// Make sure the path and file name are correct; update as needed
import { Order } from './Orders'; // Change './Order' to the correct path if necessary, e.g., './order' or '../models/Order'

const orderClientSchema = new Schema<IOrderClient>({
    // Herda todos os campos de Order
    ...Order.schema.obj,
    // Campos específicos do cliente
    clientNotes: String
});

export const OrderClient = model<IOrderClient>('OrderClient', orderClientSchema);