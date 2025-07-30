// controllers/productBurgerController.ts
import { Request, Response } from 'express';
import { ProductBurgerModel } from '../models/ProductBurger';
import { IProductBurger } from '../interfaces/productBurger';

export class ProductBurgerController {
    // Create product
    // No método createProductBurger, adicione a verificação de ID
    static async createProductBurger(req: Request, res: Response): Promise<void> {
        try {
            const productData: IProductBurger = req.body;

            // Verifica se o ID foi enviado no body
            if (!productData.id) {
                // Se não foi enviado, calcula o próximo ID
                const lastProduct = await ProductBurgerModel.findOne().sort({ id: -1 });
                productData.id = lastProduct ? lastProduct.id + 1 : 1;
            }

            const product = new ProductBurgerModel(productData);
            await product.save();

            res.status(201).json({
                message: 'Hambúrguer criado com sucesso',
                data: product,
            });
        } catch (error) {
            res.status(500).json({
                message: 'Erro ao criar hambúrguer',
                error: (error as Error).message,
            });
        }
    }

    // Get all products
    static async getAllProductsBurger(req: Request, res: Response): Promise<void> {
        try {
            const products = await ProductBurgerModel.find();
            res.status(200).json({
                message: 'Hambúrgueres recuperados com sucesso',
                data: products,
            });
        } catch (error) {
            res.status(500).json({
                message: 'Erro ao recuperar hambúrgueres',
                error: (error as Error).message,
            });
        }
    }

    // Get product by ID
    static async getProductBurgerById(req: Request, res: Response): Promise<void> {
        try {
            const product = await ProductBurgerModel.findOne({ id: req.params.id });
            if (!product) {
                res.status(404).json({ message: 'Hambúrguer não encontrado' });
                return;
            }
            res.status(200).json({
                message: 'Hambúrguer recuperado com sucesso',
                data: product,
            });
        } catch (error) {
            res.status(500).json({
                message: 'Erro ao recuperar hambúrguer',
                error: (error as Error).message,
            });
        }
    }

    // Update product
    static async updateProductBurger(req: Request, res: Response): Promise<void> {
        try {
            const updateData: Partial<IProductBurger> = req.body;
            const product = await ProductBurgerModel.findOneAndUpdate(
                { id: req.params.id },
                updateData,
                { new: true }
            );

            if (!product) {
                res.status(404).json({ message: 'Hambúrguer não encontrado' });
                return;
            }

            res.status(200).json({
                message: 'Hambúrguer atualizado com sucesso',
                data: product,
            });
        } catch (error) {
            res.status(500).json({
                message: 'Erro ao atualizar hambúrguer',
                error: (error as Error).message,
            });
        }
    }

    // Delete product
    static async deleteProductBurger(req: Request, res: Response): Promise<void> {
        try {
            const product = await ProductBurgerModel.findOneAndDelete({ id: req.params.id });
            if (!product) {
                res.status(404).json({ message: 'Hambúrguer não encontrado' });
                return;
            }
            res.status(200).json({
                message: 'Hambúrguer deletado com sucesso',
                data: product,
            });
        } catch (error) {
            res.status(500).json({
                message: 'Erro ao deletar hambúrguer',
                error: (error as Error).message,
            });
        }
    }
}