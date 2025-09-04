package com.businesscart.android.ui.main

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.businesscart.android.R
import com.businesscart.android.api.AddToCartRequest
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.databinding.ActivityMainBinding
import com.businesscart.android.model.CartItem
import com.businesscart.android.model.CompanyData
import com.businesscart.android.model.Product
import com.businesscart.android.ui.cart.CartActivity
import com.businesscart.android.ui.login.LoginActivity
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var sessionManager: SessionManager
    private lateinit var productAdapter: ProductAdapter
    private var attachedCompanies: List<CompanyData> = emptyList()
    private val TAG = "MainActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SessionManager(this)
        setupRecyclerView()

        binding.logoutButton.setOnClickListener {
            sessionManager.clearSession()
            val intent = Intent(this, LoginActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
        }

        loadInitialData()
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_view_cart -> {
                startActivity(Intent(this, CartActivity::class.java))
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun setupRecyclerView() {
        productAdapter = ProductAdapter(emptyList()) { product ->
            addToCart(product)
        }
        binding.productRecyclerView.apply {
            adapter = productAdapter
            layoutManager = LinearLayoutManager(this@MainActivity)
        }
    }

    private fun loadInitialData() {
        val account = sessionManager.getAccount()
        if (account == null) {
            // Handle case where account is not found, maybe redirect to login
            Toast.makeText(this, "Error: User not logged in.", Toast.LENGTH_SHORT).show()
            return
        }

        attachedCompanies = account.customer?.attachedCompanies ?: emptyList()

        if (attachedCompanies.isNotEmpty()) {
            setupCompanySpinner()
        } else {
            Toast.makeText(this, "No associated companies found.", Toast.LENGTH_SHORT).show()
            binding.companySpinner.isEnabled = false
        }
    }

    private fun fetchProducts(sellerId: String) {
        Log.d(TAG, "Fetching products for sellerId: $sellerId")
        lifecycleScope.launch {
            try {
                val token = "Bearer ${sessionManager.getAuthToken()}"
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.productApiService.getProducts(token, sellerId)
                }

                if (response.isSuccessful) {
                    val products = response.body() ?: emptyList()
                    productAdapter.updateProducts(products)
                    Log.d(TAG, "Successfully fetched ${products.size} products.")
                } else {
                    Log.e(TAG, "Failed to fetch products. Code: ${response.code()}, Message: ${response.message()}")
                    Toast.makeText(this@MainActivity, "Failed to fetch products", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception in fetchProducts: ${e.message}", e)
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupCompanySpinner() {
        val companyNames = attachedCompanies.map { it.name }
        Log.d(TAG, "Setting up company spinner with names: $companyNames")

        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, companyNames)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.companySpinner.adapter = adapter
        binding.companySpinner.isEnabled = true

        binding.companySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) {
                val selectedCompany = attachedCompanies[position]
                // The sellerID is the _id of the company account, which we don't have directly here.
                // Assuming the companyCode can be used as the seller identifier for now.
                // This might need adjustment based on how sellerID is derived.
                // Let's assume the uniqueIdentifier of the company is the sellerID.
                fetchProducts(selectedCompany.uniqueIdentifier)
            }

            override fun onNothingSelected(parent: AdapterView<*>) {
                productAdapter.updateProducts(emptyList())
            }
        }
    }

    private fun addToCart(product: Product) {
        lifecycleScope.launch {
            try {
                val token = "Bearer ${sessionManager.getAuthToken()}"
                val cartItem = CartItem(
                    id = null,
                    productId = product.id,
                    quantity = 1,
                    sellerId = product.sellerID,
                    name = product.name,
                    price = product.price
                )
                val request = AddToCartRequest(entity = cartItem)
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.checkoutApiService.addItemToCart(token, request)
                }

                if (response.isSuccessful) {
                    Toast.makeText(this@MainActivity, "${product.name} added to cart", Toast.LENGTH_SHORT).show()
                } else {
                    val errorBody = response.errorBody()?.string()
                    Log.e(TAG, "Failed to add item to cart. Code: ${response.code()}, Error: $errorBody")
                    Toast.makeText(this@MainActivity, "Failed to add item to cart", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception in addToCart: ${e.message}", e)
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}