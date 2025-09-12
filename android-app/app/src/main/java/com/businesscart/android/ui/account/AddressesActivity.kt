package com.businesscart.android.ui.account

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuItem
import android.widget.EditText
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.model.Address
import com.businesscart.android.model.Coords
import com.businesscart.android.model.CustomerAddress
import com.businesscart.android.model.NewAddressDTO
import com.businesscart.android.ui.checkout.CartActivity
import com.businesscart.android.util.SessionManager
import com.google.android.material.checkbox.MaterialCheckBox
import com.google.android.material.floatingactionbutton.FloatingActionButton

class AddressesActivity : AppCompatActivity() {

    private lateinit var viewModel: AddressViewModel
    private lateinit var addressesRecyclerView: RecyclerView
    private lateinit var adapter: AddressAdapter
    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_addresses)

        val toolbar: Toolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayUseLogoEnabled(true)
        supportActionBar?.setLogo(R.drawable.ic_logo)
        supportActionBar?.title = " BusinessCart"

        sessionManager = SessionManager(this)
        viewModel = ViewModelProvider(this).get(AddressViewModel::class.java)

        setupRecyclerView()

        val addAddressFab: FloatingActionButton = findViewById(R.id.addAddressFab)
        addAddressFab.setOnClickListener { showAddEditAddressDialog(null) }

        observeViewModel()
        viewModel.getAddresses(sessionManager.getUserId()!!)
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.base_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean =
        when (item.itemId) {
            R.id.action_cart -> {
                startActivity(Intent(this, CartActivity::class.java))
                true
            }
            R.id.action_account -> {
                startActivity(Intent(this, AccountActivity::class.java))
                true
            }
            else -> super.onOptionsItemSelected(item)
        }

    private fun setupRecyclerView() {
        addressesRecyclerView = findViewById(R.id.addressesRecyclerView)
        adapter = AddressAdapter(mutableListOf(),
            onEditClick = { addr -> showAddEditAddressDialog(addr) },
            onDeleteClick = { addr ->
                viewModel.deleteAddress(sessionManager.getUserId()!!, addr.id)
                viewModel.getAddresses(sessionManager.getUserId()!!)
            })
        addressesRecyclerView.adapter = adapter
        addressesRecyclerView.layoutManager = LinearLayoutManager(this)
    }

    private fun observeViewModel() {
        viewModel.addresses.observe(this) { addresses -> adapter.updateAddresses(addresses) }
    }

    private fun showAddEditAddressDialog(address: CustomerAddress?) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_add_address, null)

        val recipientNameEdit = dialogView.findViewById<EditText>(R.id.recipientNameEditText)
        val addressLabelEdit  = dialogView.findViewById<EditText>(R.id.addressLabelEditText)
        val streetEdit        = dialogView.findViewById<EditText>(R.id.streetEditText)
        val cityEdit          = dialogView.findViewById<EditText>(R.id.cityEditText)
        val stateEdit         = dialogView.findViewById<EditText>(R.id.stateEditText)
        val zipEdit           = dialogView.findViewById<EditText>(R.id.zipEditText)
        val phoneEdit         = dialogView.findViewById<EditText>(R.id.phoneNumberEditText)
        val defaultChk        = dialogView.findViewById<MaterialCheckBox>(R.id.defaultShippingCheckBox)

        if (address != null) {
            recipientNameEdit.setText(address.recipientName)
            addressLabelEdit.setText(address.addressLabel)
            streetEdit.setText(address.address.street)
            cityEdit.setText(address.address.city)
            stateEdit.setText(address.address.state)
            zipEdit.setText(address.address.zip)
            phoneEdit.setText(address.phoneNumber)
            defaultChk.isChecked = address.isDefaultShipping
        }

        AlertDialog.Builder(this)
            .setTitle(if (address == null) "Add Address" else "Edit Address")
            .setView(dialogView)
            .setPositiveButton("Save") { _, _ ->
                if (address == null) {
                    /* ----------  NEW address – use slim DTO  ---------- */
                    val payload = NewAddressDTO(
                        recipientName = recipientNameEdit.text.toString().trim(),
                        addressLabel  = addressLabelEdit.text.toString().trim()
                            .takeIf { it.isNotEmpty() },
                        address = Address(
                            street = streetEdit.text.toString().trim(),
                            city   = cityEdit.text.toString().trim(),
                            state  = stateEdit.text.toString().trim(),
                            zip    = zipEdit.text.toString().trim(),
                            coordinates = Coords(33.6844, 73.0479)
                        ),
                        phoneNumber = phoneEdit.text.toString().trim()
                            .takeIf { it.isNotEmpty() },
                        isDefaultShipping = defaultChk.isChecked
                    )
                    viewModel.upsertAddressSlim(sessionManager.getUserId()!!, payload)

                } else {
                    /* ----------  EDIT address – keep full object  ---------- */
                    val payload = CustomerAddress(
                        id = address.id,
                        customerId = sessionManager.getUserId()!!,
                        recipientName = recipientNameEdit.text.toString().trim(),
                        address = Address(
                            street = streetEdit.text.toString().trim(),
                            city   = cityEdit.text.toString().trim(),
                            state  = stateEdit.text.toString().trim(),
                            zip    = zipEdit.text.toString().trim(),
                            coordinates = Coords(33.6844, 73.0479)
                        ),
                        phoneNumber = phoneEdit.text.toString().trim()
                            .takeIf { it.isNotEmpty() },
                        addressLabel = addressLabelEdit.text.toString().trim()
                            .takeIf { it.isNotEmpty() },
                        isDefaultShipping = defaultChk.isChecked,
                        createdAt = address.createdAt,
                        updatedAt = null
                    )
                    viewModel.upsertAddress(sessionManager.getUserId()!!, payload)
                }
                viewModel.getAddresses(sessionManager.getUserId()!!)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
