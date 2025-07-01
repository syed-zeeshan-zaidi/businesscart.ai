import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  productId: string;
  quantity: number;
  companyId: string; // Added companyId
  _id?: mongoose.Types.ObjectId;
}

export interface ICart extends Document {
  userId: string;
  companyId: string; // Added companyId to the main cart interface
  items: ICartItem[];
}

const CartItemSchema = new Schema({
  productId: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  companyId: { type: String, required: true }, // Added companyId to schema
});

const CartSchema = new Schema({
  userId: { type: String, required: true },
  companyId: { type: String, required: true },
  items: [CartItemSchema],
});

CartSchema.index({ userId: 1, companyId: 1 }, { unique: true });

export const Cart = mongoose.model<ICart>('Cart', CartSchema);