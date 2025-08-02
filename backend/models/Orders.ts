import { Schema, model } from 'mongoose';
import { IOrder } from '../interfaces/Orders';

const orderItemSchema = new Schema({
    id: { type: Number, required: true },
    qty: { type: Number, required: true }
});

const orderAddressSchema = new Schema({
    address: String,
    number: String,
    neighborhood: String
});

const statusHistorySchema = new Schema({
    start: { type: Date, required: true },
    end: Date
}, { _id: false });

const orderSchema = new Schema<IOrder>({
    id: { type: Number, required: true, unique: true },
    time: { type: Date, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    onclient: { type: String, required: true },
    paymentMethod: { type: String, required: true },
    delivery: { type: Boolean, required: true },
    pickupTime: String,
    address: orderAddressSchema,
    distancia: Number,
    items: [orderItemSchema],
    total: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    status: {
        type: String,
        required: true,
        enum: ['Aguardando', 'Em preparo', 'Pronto', 'Entregue', 'Cancelado'],
        default: 'Aguardando'
    },
    payment: { type: Boolean, default: false },
    receivedTime: Date,
    statusHistory: { type: Map, of: statusHistorySchema }
}, { timestamps: true });

export const Order = model<IOrder>('Order', orderSchema);