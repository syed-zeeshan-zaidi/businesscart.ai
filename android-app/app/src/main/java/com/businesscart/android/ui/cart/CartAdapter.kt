package com.businesscart.android.ui.cart

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.databinding.ItemCartBinding
import com.businesscart.android.model.CartItem

class CartAdapter(
    private var items: List<CartItem>
) : RecyclerView.Adapter<CartAdapter.CartViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CartViewHolder {
        val binding =
            ItemCartBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return CartViewHolder(binding)
    }

    override fun onBindViewHolder(holder: CartViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount() = items.size

    fun updateItems(items: List<CartItem>) {
        this.items = items
        notifyDataSetChanged()
    }

    inner class CartViewHolder(private val binding: ItemCartBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(item: CartItem) {
            binding.itemName.text = item.name
            binding.itemPrice.text = "$${item.price}"
            binding.itemQuantity.text = "Qty: ${item.quantity}"
        }
    }
}