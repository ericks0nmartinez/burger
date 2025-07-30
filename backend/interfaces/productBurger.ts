// interfaces/productBurger.ts
import { Document } from 'mongoose';

export interface IProductBurger extends Document {
    id: number;
    name: string;
    price: number;
    description: string;
    image: string;
    status: 'Ativo' | 'Inativo';
}