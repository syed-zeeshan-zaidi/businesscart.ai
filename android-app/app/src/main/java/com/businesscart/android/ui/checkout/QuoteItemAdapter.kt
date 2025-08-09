package com.businesscart.android.ui.checkout

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.databinding.ItemQuoteBinding
import com.businesscart.android.model.CartItem

class QuoteItemAdapter(
    private var items: List<CartItem>
) : RecyclerView.Adapter<QuoteItemAdapter.QuoteItemViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): QuoteItemViewHolder {
        val binding =
            ItemQuoteBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return QuoteItemViewHolder(binding)
    }

    override fun onBindViewHolder(holder: QuoteItemViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount() = items.size

    fun updateItems(items: List<CartItem>) {
        this.items = items
        notifyDataSetChanged()
    }

    inner class QuoteItemViewHolder(private val binding: ItemQuoteBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(item: CartItem) {
            binding.itemName.text = item.name
            binding.itemQuantity.text = "Qty: ${item.quantity}"
            binding.itemTotalPrice.text = "$${item.price * item.quantity}"
        }
    }
}
