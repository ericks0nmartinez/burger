import { Request, Response } from 'express';
import { Order } from '../models/Orders';
import { OrderClient } from '../models/OrderClient';
import { IOrder } from '../interfaces/Orders';

class OrdersController {
    // ==============================================
    // MÉTODOS AUXILIARES ESTÁTICOS
    // ==============================================
    private static handleError(res: Response, error: any): void {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro interno no servidor'
        });
    }

    private static handleNotFound(res: Response, message: string = 'Pedido não encontrado'): void {
        res.status(404).json({
            success: false,
            message
        });
    }

    private static sanitizeStatusHistory(statusHistory: any): any {
        if (!statusHistory) return {};
        try {
            return JSON.parse(JSON.stringify(statusHistory));
        } catch (error) {
            console.error('Error sanitizing status history:', error);
            return {};
        }
    }

    private static sanitizeOrderData(data: any): any {
        if (!data) return null;
        try {
            const sanitized = data.toObject ? data.toObject() : { ...data };
            delete sanitized._id;
            delete sanitized.__v;
            return sanitized;
        } catch (error) {
            console.error('Error sanitizing order data:', error);
            return null;
        }
    }

    private static validateId(id: string): number | null {
        const num = parseInt(id, 10);
        return isNaN(num) ? null : num;
    }

    // ==============================================
    // MÉTODOS PRINCIPAIS
    // ==============================================

    public async createOrder(req: Request, res: Response): Promise<void> {
        try {
            const lastOrder = await Order.findOne().sort({ id: -1 });
            const newId = lastOrder ? lastOrder.id + 1 : Date.now();

            const orderData: IOrder = {
                id: newId,
                ...req.body,
                statusHistory: {
                    [req.body.status || 'Aguardando']: {
                        start: new Date(),
                        end: null
                    }
                }
            };

            const order = await new Order(orderData).save();

            if (req.body.onclient === "true") {
                await new OrderClient(orderData).save();
            }

            res.status(201).json({
                success: true,
                data: OrdersController.sanitizeOrderData(order)
            });
        } catch (error: any) {
            OrdersController.handleError(res, error);
        }
    }

    public async getAllOrders(req: Request, res: Response): Promise<void> {
        try {
            const orders = await Order.find().sort({ createdAt: -1 });
            res.status(200).json({
                success: true,
                data: orders.map(order => OrdersController.sanitizeOrderData(order))
            });
        } catch (error: any) {
            OrdersController.handleError(res, error);
        }
    }

    public async getOrderById(req: Request, res: Response): Promise<void> {
        try {
            const id = OrdersController.validateId(req.params.id);
            if (id === null) {
                return OrdersController.handleNotFound(res, 'ID do pedido inválido');
            }

            const order = await Order.findOne({ id });
            if (!order) {
                return OrdersController.handleNotFound(res);
            }
            res.status(200).json({
                success: true,
                data: OrdersController.sanitizeOrderData(order)
            });
        } catch (error: any) {
            OrdersController.handleError(res, error);
        }
    }

    public async updateOrder(req: Request, res: Response): Promise<void> {
        try {
            // Convert the ID parameter to a number first
            const id = Number(req.params.id);
            if (isNaN(id)) {
                return OrdersController.handleNotFound(res);
            }

            const order = await Order.findOneAndUpdate(
                { id },
                req.body,
                { new: true }
            );

            if (!order) {
                return OrdersController.handleNotFound(res);
            }

            if (order.onclient === "true") {
                await OrderClient.findOneAndUpdate(
                    { id },
                    req.body
                );
            }

            res.status(200).json({
                success: true,
                data: OrdersController.sanitizeOrderData(order)
            });
        } catch (error: any) {
            OrdersController.handleError(res, error);
        }
    }

    public async updateOrderStatus(req: Request, res: Response): Promise<void> {
        try {
            // Convert the ID parameter to a number first
            const id = Number(req.params.id);
            if (isNaN(id)) {
                return OrdersController.handleNotFound(res);
            }

            const { newStatus, currentStatus } = req.body;
            const currentOrder = await Order.findOne({ id });

            if (!currentOrder) {
                return OrdersController.handleNotFound(res);
            }

            const cleanStatusHistory = OrdersController.sanitizeStatusHistory(currentOrder.statusHistory);

            if (cleanStatusHistory[currentStatus] && !cleanStatusHistory[currentStatus].end) {
                cleanStatusHistory[currentStatus].end = new Date();
            }

            cleanStatusHistory[newStatus] = {
                start: new Date(),
                end: newStatus === 'Entregue' ? new Date() : null
            };

            const order = await Order.findOneAndUpdate(
                { id },
                {
                    status: newStatus,
                    statusHistory: cleanStatusHistory
                },
                { new: true }
            );

            if (order?.onclient === "true") {
                await OrderClient.findOneAndUpdate(
                    { id },
                    {
                        status: newStatus,
                        statusHistory: cleanStatusHistory
                    }
                );
            }

            res.status(200).json({
                success: true,
                data: OrdersController.sanitizeOrderData(order)
            });
        } catch (error: any) {
            OrdersController.handleError(res, error);
        }
    }

    public async updateOrderPayment(req: Request, res: Response): Promise<void> {
        try {
            // Convert the ID parameter to a number first
            const id = Number(req.params.id);
            if (isNaN(id)) {
                return OrdersController.handleNotFound(res);
            }

            const { payment } = req.body;
            const currentOrder = await Order.findOne({ id });
            if (!currentOrder) {
                return OrdersController.handleNotFound(res);
            }

            const cleanStatusHistory = OrdersController.sanitizeStatusHistory(currentOrder.statusHistory);

            if (payment) {
                cleanStatusHistory['Recebido'] = {
                    start: new Date(),
                    end: null
                };
            }

            const updateData = {
                payment,
                ...(payment && { receivedTime: new Date() }),
                statusHistory: cleanStatusHistory
            };

            const order = await Order.findOneAndUpdate(
                { id },
                updateData,
                { new: true }
            );

            if (order?.onclient === "true") {
                await OrderClient.findOneAndUpdate(
                    { id },
                    updateData
                );
            }

            res.status(200).json({
                success: true,
                data: OrdersController.sanitizeOrderData(order)
            });
        } catch (error: any) {
            OrdersController.handleError(res, error);
        }
    }

    public async getDeliveryOrders(req: Request, res: Response): Promise<void> {
        try {
            // Garante que não há parâmetro ID interferindo
            if (req.params.id) {
                delete req.params.id;
            }

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            // Consulta otimizada
            const orders = await Order.find({
                status: 'A caminho',
                delivery: true,
                createdAt: { $gte: todayStart, $lte: todayEnd }
            })

            res.status(200).json({
                success: true,
                data: orders
            });

        } catch (error: any) {
            console.error('Erro em getDeliveryOrders:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar entregas'
            });
        }
    }

    public async deleteOrder(req: Request, res: Response): Promise<void> {
        try {
            // Convert the ID parameter to a number first
            const id = Number(req.params.id);
            if (isNaN(id)) {
                return OrdersController.handleNotFound(res);
            }

            const order = await Order.findOneAndDelete({ id });

            if (!order) {
                return OrdersController.handleNotFound(res);
            }

            if (order.onclient === "true") {
                await OrderClient.findOneAndDelete({ id });
            }

            res.status(200).json({
                success: true,
                message: 'Pedido deletado com sucesso'
            });
        } catch (error: any) {
            OrdersController.handleError(res, error);
        }
    }
}

export default new OrdersController();