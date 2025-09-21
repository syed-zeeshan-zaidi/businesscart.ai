package com.businesscart.android.ui.account

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.model.CustomerAddress

class AddressAdapter(
    private val addresses: MutableList<CustomerAddress>,
    private val onEditClick: (CustomerAddress) -> Unit,
    private val onDeleteClick: (CustomerAddress) -> Unit
) : RecyclerView.Adapter<AddressAdapter.AddressViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AddressViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_address, parent, false)
        return AddressViewHolder(view)
    }

    override fun onBindViewHolder(holder: AddressViewHolder, position: Int) {
        val address = addresses[position]
        holder.bind(address)
    }

    override fun getItemCount(): Int = addresses.size

    fun updateAddresses(newAddresses: List<CustomerAddress>) {
        addresses.clear()
        addresses.addAll(newAddresses)
        notifyDataSetChanged()
    }

    inner class AddressViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val recipientNameTextView: TextView = itemView.findViewById(R.id.recipientNameTextView)
        private val addressLabelTextView: TextView = itemView.findViewById(R.id.addressLabelTextView)
        private val fullAddressTextView: TextView = itemView.findViewById(R.id.fullAddressTextView)
        private val phoneNumberTextView: TextView = itemView.findViewById(R.id.phoneNumberTextView)
        private val defaultShippingCheckBox: CheckBox = itemView.findViewById(R.id.defaultShippingCheckBox)
        private val editButton: ImageButton = itemView.findViewById(R.id.editButton)
        private val deleteButton: ImageButton = itemView.findViewById(R.id.deleteButton)

        fun bind(address: CustomerAddress) {
            recipientNameTextView.text = address.recipientName
            addressLabelTextView.text = address.addressLabel
            fullAddressTextView.text = "${address.address.street}, ${address.address.city}, ${address.address.state} ${address.address.zip}"
            phoneNumberTextView.text = address.phoneNumber
            defaultShippingCheckBox.isChecked = address.isDefaultShipping

            editButton.setOnClickListener { onEditClick(address) }
            deleteButton.setOnClickListener { onDeleteClick(address) }
        }
    }
}
