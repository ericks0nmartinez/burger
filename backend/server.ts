import express, { Express } from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { ConfigController } from "../backend/controllers/configController.ts";
import { ProductBurgerController } from "../backend/controllers/productsBurgerController.ts";
import OrdersController from '../backend/controllers/ordersController.ts';
import OrderClientController from '../backend/controllers/orderClientController.ts';

dotenv.config();
const app: Express = express();

// Configuração do CORS
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use(express.json());

// Rota de teste
app.get("/", (req, res) => {
    res.send("API lanche em http://192.168.1.67:3000! Use /api/orders para acessar os pedidos.");
});

// Conexão com MongoDB
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
    throw new Error("MONGO_URI or MONGODB_URI is not defined in the environment variables");
}

mongoose.connect(mongoUri as string)
    .then(() => console.log("Conectado ao MongoDB"))
    .catch((err) => console.error("Erro ao conectar ao MongoDB:", err));

// Rotas de configuração
app.post('/api/config', ConfigController.createOrUpdateConfig);
app.get('/api/config', ConfigController.getConfig);
app.patch('/api/config', ConfigController.updateConfig);

// Rotas de produtos
app.post('/api/products/burgers', ProductBurgerController.createProductBurger);
app.get('/api/products/burgers', ProductBurgerController.getAllProductsBurger);
app.get('/api/products/burgers/:id', ProductBurgerController.getProductBurgerById);
app.put('/api/products/burgers/:id', ProductBurgerController.updateProductBurger);
app.delete('/api/products/burgers/:id', ProductBurgerController.deleteProductBurger);

// Rotas de pedidos
app.post('/api/orders', OrdersController.createOrder);
app.get('/api/orders', OrdersController.getAllOrders);
app.get('/api/orders/delivery', OrdersController.getDeliveryOrders);
app.get('/api/orders/:id', OrdersController.getOrderById);
app.put('/api/orders/:id', OrdersController.updateOrder);
app.patch('/api/orders/:id/status', OrdersController.updateOrderStatus);
app.patch('/api/orders/:id/payment', OrdersController.updateOrderPayment);
app.delete('/api/orders/:id', OrdersController.deleteOrder);


// Rotas de pedidos do cliente
app.get('/api/client', OrderClientController.getClientOrder);
app.get('/api/client/all', OrderClientController.getClientOrders);
app.patch('/api/order-client/:id/payment', OrderClientController.updateClientOrderPayment);
app.patch('/api/order-client/:id/status', OrderClientController.updateClientOrderStatus);

// Inicia o servidor
const PORT: number = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));