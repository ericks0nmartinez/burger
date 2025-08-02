import { Request, Response } from 'express';
import { OrderClient } from '../models/OrderClient';
import { IOrderClient } from '../interfaces/OrderClient';

class OrderClientController {
    // Obter pedido do cliente por ID e telefone
    public async getClientOrder(req: Request, res: Response) {
        try {
            const { id, phone } = req.query;

            if (!id || !phone) {
                return res.status(400).json({
                    success: false,
                    message: 'ID e telefone são obrigatórios'
                });
            }

            const order = await OrderClient.findOne({
                id: parseInt(id as string),
                phone: phone as string
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            res.status(200).json({
                success: true,
                data: order
            });
        } catch (error: any) {
            console.error('Error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Erro interno no servidor'
            });
        }
    }

    // Obter todos os pedidos de um cliente
    public async getClientOrders(req: Request, res: Response) {
        try {
            const { phone } = req.query;

            if (!phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Telefone é obrigatório'
                });
            }

            const orders = await OrderClient.find({
                phone: phone as string
            }).sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                data: orders
            });
        } catch (error: any) {
            console.error('Error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Erro interno no servidor'
            });
        }
    }

    // Atualizar status do pedido do cliente
    public async updateClientOrderStatus(req: Request, res: Response) {
        try {
            const { newStatus, statusHistory } = req.body;

            const order = await OrderClient.findOneAndUpdate(
                { id: req.params.id },
                {
                    status: newStatus,
                    statusHistory
                },
                { new: true }
            );

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            res.status(200).json({
                success: true,
                data: order
            });
        } catch (error: any) {
            console.error('Error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Erro interno no servidor'
            });
        }
    }

    // Atualizar pagamento do pedido do cliente
    public async updateClientOrderPayment(req: Request, res: Response) {
        try {
            const { payment } = req.body;
            const orderId = parseInt(req.params.id);

            const currentOrder = await OrderClient.findOne({ id: orderId });
            if (!currentOrder) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            // Cria uma cópia limpa do statusHistory sem referências internas do Mongoose
            const cleanStatusHistory = JSON.parse(JSON.stringify(currentOrder.statusHistory));

            if (payment) {
                cleanStatusHistory['Recebido'] = {
                    start: new Date(),
                    end: null
                };
            }

            const order = await OrderClient.findOneAndUpdate(
                { id: orderId },
                {
                    payment,
                    ...(payment && { receivedTime: new Date() }),
                    statusHistory: cleanStatusHistory
                },
                { new: true }
            );

            res.status(200).json({
                success: true,
                data: order
            });
        } catch (error: any) {
            console.error('Error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Erro interno no servidor'
            });
        }
    }
}

export default new OrderClientController();