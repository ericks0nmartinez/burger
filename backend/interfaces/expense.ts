//backend/interfaces/expense.ts
import { Types } from 'mongoose';

export interface IValue {
    name: string;
    value: number | string;
    _id?: string | Types.ObjectId;
    paid?: boolean;
    notify?: boolean;
    uuid: string; // Campo obrigatório para novos registros
}

export interface ITransaction {
    _id?: string | Types.ObjectId;
    name: string;
    whenPay: Date;
    total: number;
    paid: boolean;
    isDebt?: boolean;
    idOrigem?: string;
    idReceita?: string;
    idDespesa?: string;
    idDebts?: string;
    notify?: boolean;
    totalPaid?: number;
    values: IValue[];
}

export interface IExpense {
    idUser: string;
    idUserShared?: string;
    receitas: ITransaction[];
    despesas: ITransaction[];
    createAt: Date;
    updateAt: Date;
}

export interface ValueRequest {
    name: string;
    value: number | string;
    _id?: string | Types.ObjectId;
    paid?: boolean;
    notify?: boolean;
    uuid: string; // Campo obrigatório para novos registros
}

export interface TransactionRequest {
    _id?: string | Types.ObjectId;
    name: string;
    whenPay: string;
    total: number;
    paid: boolean;
    idDebts?: string;
    idOrigem?: string;
    idReceita?: string;
    idDespesa?: string;
    isDebt?: boolean;
    totalPaid?: number;
    notify?: boolean;
    values?: ValueRequest[];
}

export interface ExpenseRequest {
    idUser: string;
    idUserShared?: string;
    receitas?: TransactionRequest[];
    despesas?: TransactionRequest[];
}

export interface UpdateReceitaDespesaRequest {
    idUser: string;
    idReceita: string;
    idDespesa: string;
}