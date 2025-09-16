package com.businesscart.android.ui.checkout

import android.graphics.Paint
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.model.CartItem

class QuoteAdapter(private val items: List<CartItem>) : RecyclerView.Adapter<QuoteAdapter.ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_quote, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val nameTextView: TextView = itemView.findViewById(R.id.quoteItemName)
        private val priceTextView: TextView = itemView.findViewById(R.id.quoteItemPrice)
        private val discountedPriceTextView: TextView = itemView.findViewById(R.id.quoteItemDiscountedPrice)
        private val lineItemTotalTextView: TextView = itemView.findViewById(R.id.lineItemTotal)
        private val quantityTextView: TextView = itemView.findViewById(R.id.quoteItemQuantity)

        fun bind(item: CartItem) {
            nameTextView.text = item.name
            quantityTextView.text = "Qty: ${item.quantity}"
            lineItemTotalTextView.text = "${String.format("%.2f", item.lineItemTotal)}"

            if (item.discountedPrice != null && item.discountedPrice < item.price) {
                priceTextView.text = "${String.format("%.2f", item.price)}"
                priceTextView.paintFlags = priceTextView.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
                discountedPriceTextView.text = "${String.format("%.2f", item.discountedPrice)}"
                discountedPriceTextView.visibility = View.VISIBLE
            } else {
                priceTextView.text = "${String.format("%.2f", item.price)}"
                priceTextView.paintFlags = priceTextView.paintFlags and Paint.STRIKE_THRU_TEXT_FLAG.inv()
                discountedPriceTextView.visibility = View.GONE
            }
        }
    }
}
