import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  productId: string;
  quantity: number;
  companyId: string;
  name?: string; // Added product name
  price?: number; // Added product price
  _id?: mongoose.Types.ObjectId;
}

export interface ICart extends Document {
  userId: string;
  companyId: string;
  items: ICartItem[];
  totalPrice: number; // Added total price
}

const CartItemSchema = new Schema({
  productId: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  companyId: { type: String, required: true },
  name: { type: String },
  price: { type: Number },
});

const CartSchema = new Schema({
  userId: { type: String, required: true },
  companyId: { type: String, required: true },
  items: [CartItemSchema],
  totalPrice: { type: Number, default: 0 },
});

CartSchema.index({ userId: 1, companyId: 1 }, { unique: true });

export const Cart = mongoose.model<ICart>('Cart', CartSchema);