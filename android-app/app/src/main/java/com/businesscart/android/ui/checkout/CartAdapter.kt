package com.businesscart.android.ui.checkout

import android.app.AlertDialog
import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.NumberPicker
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
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_cart, parent, false)
        return CartViewHolder(view)
    }

    override fun onBindViewHolder(holder: CartViewHolder, position: Int) =
        holder.bind(cartItems[position])

    override fun getItemCount(): Int = cartItems.size

    inner class CartViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val nameTextView:     TextView = itemView.findViewById(R.id.cartItemName)
        private val priceTextView:    TextView = itemView.findViewById(R.id.cartItemPrice)
        private val quantityTextView: TextView = itemView.findViewById(R.id.cartItemQuantity)
        private val removeButton:     TextView = itemView.findViewById(R.id.removeCartItemButton)

        fun bind(cartItem: CartItem) {
            nameTextView.text  = cartItem.name
            priceTextView.text = cartItem.price.toString()
            quantityTextView.text = cartItem.quantity.toString()

            quantityTextView.setOnClickListener { showQuantityDialog(cartItem) }
            removeButton.setOnClickListener     { onRemove(cartItem) }
        }

        private fun showQuantityDialog(item: CartItem) {
            val picker = NumberPicker(itemView.context).apply {
                minValue = 1          // set first
                maxValue = 99
                value    = item.quantity.coerceIn(1, 99) // ensure initial value is in range
            }
            AlertDialog.Builder(itemView.context)
                .setTitle("Set quantity")
                .setView(picker)
                .setPositiveButton("OK") { _, _ ->
                    onUpdate(item.copy(quantity = picker.value.coerceIn(1, 99)))
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }
}