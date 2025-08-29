package com.businesscart.android.ui.checkout

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.CompanyData
import com.businesscart.android.model.UpdateCartItemRequest
import com.businesscart.android.model.CartItem
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.launch

class CartActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var checkoutButton: Button
    private lateinit var clearCartButton: Button
    private lateinit var companySpinner: Spinner
    private lateinit var totalTextView: TextView
    private lateinit var cartAdapter: CartAdapter
    private lateinit var sessionManager: SessionManager
    private lateinit var progressBar: ProgressBar
    private var selectedCompanyId: String? = null
    private var companies: List<CompanyData> = listOf()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_cart)

        recyclerView = findViewById(R.id.cartRecyclerView)
        checkoutButton = findViewById(R.id.checkoutButton)
        clearCartButton = findViewById(R.id.clearCartButton)
        companySpinner = findViewById(R.id.companySpinner)
        totalTextView = findViewById(R.id.totalTextView)
        progressBar = findViewById(R.id.progressBar)
        sessionManager = SessionManager(this)
        RetrofitClient.initialize(this)

        setupRecyclerView()
        fetchAccountDetails()

        companySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) {
                selectedCompanyId = companies[position].companyCodeId
                fetchCart()
            }

            override fun onNothingSelected(parent: AdapterView<*>) {
                selectedCompanyId = null
                cartAdapter.cartItems.clear()
                cartAdapter.notifyDataSetChanged()
            }
        }

        checkoutButton.setOnClickListener {
            createQuote()
        }

        clearCartButton.setOnClickListener {
            clearCart()
        }
    }

    private fun setupRecyclerView() {
        cartAdapter = CartAdapter(mutableListOf(), ::onUpdateCartItem, ::onRemoveCartItem)
        recyclerView.adapter = cartAdapter
        recyclerView.layoutManager = LinearLayoutManager(this)
    }

    private fun fetchAccountDetails() {
        lifecycleScope.launch {
            progressBar.visibility = View.VISIBLE
            try {
                val userId = sessionManager.getUserId() ?: return@launch
                val response = RetrofitClient.apiService.getAccount(userId)
                if (response.isSuccessful) {
                    response.body()?.customer?.attachedCompanies?.let {
                        companies = it
                        val companyNames = it.map { company -> company.name }
                        val adapter = ArrayAdapter(this@CartActivity, android.R.layout.simple_spinner_item, companyNames)
                        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                        companySpinner.adapter = adapter
                    }
                } else {
                    Toast.makeText(this@CartActivity, "Failed to fetch account details", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e("CartActivity", "Error fetching account details", e)
                Toast.makeText(this@CartActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                progressBar.visibility = View.GONE
            }
        }
    }

    private fun fetchCart() {
        lifecycleScope.launch {
            selectedCompanyId?.let {
                progressBar.visibility = View.VISIBLE
                try {
                    val response = RetrofitClient.checkoutApiService.getCart(it)
                    if (response.isSuccessful) {
                        response.body()?.let {
                            Log.d("CartActivity", "Cart response: $it")
                            cartAdapter.cartItems.clear()
                            cartAdapter.cartItems.addAll(it.items)
                            cartAdapter.notifyDataSetChanged()
                            totalTextView.text = "Total: ${it.totalPrice}"
                        }
                    } else {
                        Log.e("CartActivity", "Error fetching cart: ${response.errorBody()?.string()}")
                        Toast.makeText(this@CartActivity, "Failed to fetch cart", Toast.LENGTH_SHORT).show()
                        cartAdapter.cartItems.clear()
                        cartAdapter.notifyDataSetChanged()
                        totalTextView.text = "Total: $0.00"
                    }
                } catch (e: Exception) {
                    Log.e("CartActivity", "Error fetching cart", e)
                    Toast.makeText(this@CartActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                } finally {
                    progressBar.visibility = View.GONE
                }
            }
        }
    }

    private fun onUpdateCartItem(cartItem: CartItem) {
        lifecycleScope.launch {
            selectedCompanyId?.let { sellerId ->
                cartItem.id?.let { itemId ->
                    val response = RetrofitClient.checkoutApiService.updateCartItem(itemId, UpdateCartItemRequest(quantity = cartItem.quantity), sellerId)
                    if (response.isSuccessful) {
                        fetchCart()
                    }
                }
            }
        }
    }

    private fun onRemoveCartItem(cartItem: CartItem) {
        lifecycleScope.launch {
            selectedCompanyId?.let { sellerId ->
                cartItem.id?.let { itemId ->
                    val response = RetrofitClient.checkoutApiService.removeCartItem(itemId, sellerId)
                    if (response.isSuccessful) {
                        fetchCart()
                    }
                }
            }
        }
    }

    private fun clearCart() {
        lifecycleScope.launch {
            selectedCompanyId?.let {
                val response = RetrofitClient.checkoutApiService.clearCart(it)
                if (response.isSuccessful) {
                    fetchCart()
                }
            }
        }
    }

    private fun createQuote() {
        lifecycleScope.launch {
            selectedCompanyId?.let {
                val response = RetrofitClient.checkoutApiService.createQuote(mapOf("sellerId" to it))
                if (response.isSuccessful) {
                    response.body()?.let {
                        val intent = Intent(this@CartActivity, CheckoutActivity::class.java)
                        intent.putExtra("QUOTE_ID", it.id)
                        startActivity(intent)
                    }
                } else {
                    Toast.makeText(this@CartActivity, "Failed to create quote", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}