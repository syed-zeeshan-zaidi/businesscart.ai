
package com.businesscart.android.ui.checkout

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.model.CartItem

class CartAdapter(
    internal val cartItems: MutableList<CartItem>,
    private val onUpdate: (CartItem) -> Unit,
    private val onRemove: (CartItem) -> Unit
) : RecyclerView.Adapter<CartAdapter.CartViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CartViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_cart, parent, false)
        return CartViewHolder(view)
    }

    override fun onBindViewHolder(holder: CartViewHolder, position: Int) {
        val cartItem = cartItems[position]
        holder.bind(cartItem)
    }

    override fun getItemCount(): Int = cartItems.size

    inner class CartViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val nameTextView: TextView = itemView.findViewById(R.id.cartItemName)
        private val quantityTextView: TextView = itemView.findViewById(R.id.cartItemQuantity)
        private val priceTextView: TextView = itemView.findViewById(R.id.cartItemPrice)
        private val increaseButton: Button = itemView.findViewById(R.id.increaseQuantityButton)
        private val decreaseButton: Button = itemView.findViewById(R.id.decreaseQuantityButton)
        private val removeButton: Button = itemView.findViewById(R.id.removeCartItemButton)

        fun bind(cartItem: CartItem) {
            nameTextView.text = cartItem.name
            quantityTextView.text = cartItem.quantity.toString()
            priceTextView.text = "${cartItem.price}"

            increaseButton.setOnClickListener {
                val newQuantity = cartItem.quantity + 1
                onUpdate(cartItem.copy(quantity = newQuantity))
            }

            decreaseButton.setOnClickListener {
                if (cartItem.quantity > 1) {
                    val newQuantity = cartItem.quantity - 1
                    onUpdate(cartItem.copy(quantity = newQuantity))
                } else {
                    onRemove(cartItem)
                }
            }

            removeButton.setOnClickListener {
                onRemove(cartItem)
            }
        }
    }
}
