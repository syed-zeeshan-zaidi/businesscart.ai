package com.businesscart.android.ui.checkout

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.model.Order

class OrderHistoryAdapter(private val orders: List<Order>) : RecyclerView.Adapter<OrderHistoryAdapter.OrderHistoryViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): OrderHistoryViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_order, parent, false)
        return OrderHistoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: OrderHistoryViewHolder, position: Int) {
        holder.bind(orders[position])
    }

    override fun getItemCount(): Int = orders.size

    class OrderHistoryViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val orderIdTextView: TextView = view.findViewById(R.id.orderIdTextView)
        private val orderTotalTextView: TextView = view.findViewById(R.id.orderTotalTextView)
        private val orderDateTextView: TextView = view.findViewById(R.id.orderDateTextView)

        fun bind(order: Order) {
            orderIdTextView.text = "Order ID: ${order.id}"
            orderTotalTextView.text = "Total: $${String.format("%.2f", order.grandTotal)}"
            orderDateTextView.text = "Date: ${order.createdAt}"
        }
    }
}
