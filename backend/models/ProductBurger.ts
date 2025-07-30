// models/ProductBurger.ts
import { Schema, model } from 'mongoose';
import { IProductBurger } from '../interfaces/productBurger';

const ProductBurgerSchema = new Schema<IProductBurger>({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Ativo', 'Inativo'],
        required: true
    }
});

export const ProductBurgerModel = model<IProductBurger>('ProductBurger', ProductBurgerSchema);