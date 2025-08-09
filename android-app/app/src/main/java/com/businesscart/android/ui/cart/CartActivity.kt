package com.businesscart.android.ui.cart

import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.businesscart.android.api.CheckoutApiClient
import com.businesscart.android.databinding.ActivityCartBinding
import com.businesscart.android.model.Cart
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class CartActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCartBinding
    private lateinit var sessionManager: SessionManager
    private lateinit var cartAdapter: CartAdapter
    private var companyIds: List<String> = emptyList()
    private val TAG = "CartActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCartBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SessionManager(this)
        setupRecyclerView()

        loadData()

        binding.checkoutButton.setOnClickListener {
            Toast.makeText(this, "Checkout not implemented yet.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupRecyclerView() {
        cartAdapter = CartAdapter(emptyList())
        binding.cartRecyclerView.apply {
            adapter = cartAdapter
            layoutManager = LinearLayoutManager(this@CartActivity)
        }
    }

    private fun loadData() {
        companyIds = getCompanyIdsFromJwt()
        if (companyIds.isNotEmpty()) {
            setupCompanySpinner()
        } else {
            Toast.makeText(this, "No associated companies found.", Toast.LENGTH_SHORT).show()
            binding.companySpinner.isEnabled = false
        }
    }

    private fun getCompanyIdsFromJwt(): List<String> {
        val token = sessionManager.getAuthToken()
        if (token.isNullOrEmpty()) return emptyList()
        return try {
            val parts = token.split(".")
            if (parts.size == 3) {
                val payload = String(Base64.decode(parts[1], Base64.URL_SAFE), Charsets.UTF_8)
                val json = JSONObject(payload)
                val user = json.getJSONObject("user")
                val idsArray = user.getJSONArray("associate_company_ids")
                List(idsArray.length()) { idsArray.getString(it) }
            } else {
                emptyList()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error decoding JWT: ${e.message}", e)
            emptyList()
        }
    }

    private fun setupCompanySpinner() {
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, companyIds)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.companySpinner.adapter = adapter
        binding.companySpinner.isEnabled = true

        binding.companySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) {
                val selectedCompanyId = companyIds[position]
                fetchCart(selectedCompanyId)
            }

            override fun onNothingSelected(parent: AdapterView<*>) {
                cartAdapter.updateItems(emptyList())
                binding.totalPriceTextView.text = "Total: $0.00"
            }
        }
    }

    private fun fetchCart(companyId: String) {
        lifecycleScope.launch {
            try {
                val token = "Bearer ${sessionManager.getAuthToken()}"
                val response = withContext(Dispatchers.IO) {
                    CheckoutApiClient.apiService.getCart(token, companyId)
                }

                if (response.isSuccessful && response.body() != null) {
                    val cart = response.body()!!
                    cartAdapter.updateItems(cart.items)
                    binding.totalPriceTextView.text = "Total: $${cart.totalPrice}"
                } else {
                    Log.e(TAG, "Failed to fetch cart. Code: ${response.code()}, Message: ${response.message()}")
                    Toast.makeText(this@CartActivity, "Failed to fetch cart", Toast.LENGTH_SHORT).show()
                    cartAdapter.updateItems(emptyList())
                    binding.totalPriceTextView.text = "Total: $0.00"
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception in fetchCart: ${e.message}", e)
                Toast.makeText(this@CartActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}