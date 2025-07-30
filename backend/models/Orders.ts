import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
    name: string;
    password: string; // Senha criptografada
    phone: string;
}

const UserSchema: Schema = new Schema({
    name: { type: String },
    password: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
});

export default mongoose.model<IUser>("User", UserSchema);