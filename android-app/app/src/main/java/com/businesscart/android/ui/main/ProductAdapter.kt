package com.businesscart.android.ui.main

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.model.Product
import com.squareup.picasso.Picasso

class ProductAdapter(
    private val products: List<Product>,
    private val onAddToCartClick: (Product) -> Unit
) : RecyclerView.Adapter<ProductAdapter.ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_product, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val product = products[position]
        holder.productName.text = product.name
        holder.productDescription.text = product.description
        holder.productPrice.text = "${product.price}"

        if (!product.image.isNullOrEmpty()) {
            Picasso.get().load(product.image).into(holder.productImage)
        }

        holder.addToCartButton.setOnClickListener {
            onAddToCartClick(product)
        }
    }

    override fun getItemCount() = products.size

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val productImage: ImageView = itemView.findViewById(R.id.productImageView)
        val productName: TextView = itemView.findViewById(R.id.productNameTextView)
        val productDescription: TextView = itemView.findViewById(R.id.productDescriptionTextView)
        val productPrice: TextView = itemView.findViewById(R.id.productPriceTextView)
        val addToCartButton: Button = itemView.findViewById(R.id.addToCartButton)
    }
}
