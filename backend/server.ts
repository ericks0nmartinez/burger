import express, { Express } from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { ConfigController } from "../backend/controllers/configController.ts";
import { ProductBurgerController } from "../backend/controllers/productsBurgerController.ts";

dotenv.config();
const app: Express = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
}));
app.use(express.json());

app.get("/", (req, res) => {
    res.send("API lanche em http://192.168.1.67:3000! Use /orders/:id para acessar pedidos específicos.");
});

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
    throw new Error("MONGO_URI or MONGODB_URI is not defined in the environment variables");
}

mongoose.connect(mongoUri as string)
    .then(() => console.log("Conectado ao MongoDB"))
    .catch((err) => console.error("Erro ao conectar ao MongoDB:", err));

// Routes for config
app.post('/api/config', ConfigController.createOrUpdateConfig);
app.get('/api/config', ConfigController.getConfig);
app.patch('/api/config', ConfigController.updateConfig);

// Routes for burger products
app.post('/api/products/burgers', ProductBurgerController.createProductBurger);
app.get('/api/products/burgers', ProductBurgerController.getAllProductsBurger);
app.get('/api/products/burgers/:id', ProductBurgerController.getProductBurgerById);
app.put('/api/products/burgers/:id', ProductBurgerController.updateProductBurger);
app.delete('/api/products/burgers/:id', ProductBurgerController.deleteProductBurger);

const PORT: number = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));