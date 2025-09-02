package com.businesscart.android.ui.checkout

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.model.Account
import com.businesscart.android.model.Order

class OrderAdapter(private var orders: List<Order>, private val account: Account?) : RecyclerView.Adapter<OrderAdapter.OrderViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) :
    OrderViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.order_item, parent, false)
        return OrderViewHolder(view)
    }

    override fun onBindViewHolder(holder: OrderViewHolder, position: Int) {
        val order = orders[position]
        holder.bind(order)
    }

    override fun getItemCount() = orders.size

    fun updateOrders(newOrders: List<Order>) {
        orders = newOrders
        notifyDataSetChanged()
    }

    inner class OrderViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val orderIdTextView: TextView = itemView.findViewById(R.id.orderIdTextView)
        private val orderDateTextView: TextView = itemView.findViewById(R.id.orderDateTextView)
        private val companyNameTextView: TextView = itemView.findViewById(R.id.companyNameTextView)
        private val orderTotalTextView: TextView = itemView.findViewById(R.id.orderTotalTextView)
        private val orderItemsTextView: TextView = itemView.findViewById(R.id.orderItemsTextView)

        fun bind(order: Order) {
            orderIdTextView.text = "Order ID: ${order.id}"
            orderDateTextView.text = "Date: ${order.createdAt}"
            orderTotalTextView.text = "Total: ${order.grandTotal}"

            val companyName = account?.customer?.attachedCompanies?.find { it.companyCode == order.sellerId }?.name ?: order.sellerId
            companyNameTextView.text = "Company: $companyName"

            val itemsString = order.items.joinToString(separator = "\n") { "- ${it.name} (x${it.quantity})" }
            orderItemsTextView.text = itemsString
        }
    }
}
