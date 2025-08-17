import { Schema, model, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description?: string;
  price: number;
  accountID: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price must be non-negative'] },
    accountID: { type: String, required: [true, 'Account ID is required'] },
    image: { type: String },
  },
  { timestamps: true }
);

export const Product = model<IProduct>('Product', ProductSchema);