package com.businesscart.android.ui.main

import android.content.Intent
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
import com.businesscart.android.api.ProductApiClient
import com.businesscart.android.databinding.ActivityMainBinding
import com.businesscart.android.model.Product
import com.businesscart.android.ui.login.LoginActivity
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var sessionManager: SessionManager
    private lateinit var productAdapter: ProductAdapter
    private var allProducts: List<Product> = emptyList()
    private var companyIds: List<String> = emptyList()
    private val TAG = "MainActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SessionManager(this)
        setupRecyclerView()

        binding.logoutButton.setOnClickListener {
            sessionManager.clearAuthToken()
            val intent = Intent(this, LoginActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
        }

        loadData()
    }

    private fun setupRecyclerView() {
        productAdapter = ProductAdapter(emptyList())
        binding.productRecyclerView.apply {
            adapter = productAdapter
            layoutManager = LinearLayoutManager(this@MainActivity)
        }
    }

    private fun loadData() {
        companyIds = getCompanyIdsFromJwt()
        if (companyIds.isNotEmpty()) {
            setupCompanySpinner()
            fetchProducts()
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

    private fun fetchProducts() {
        Log.d(TAG, "Attempting to fetch products...")
        lifecycleScope.launch {
            try {
                val productResponse = withContext(Dispatchers.IO) {
                    val token = "Bearer ${sessionManager.getAuthToken()}"
                    ProductApiClient.apiService.getProducts(token)
                }

                if (productResponse.isSuccessful && productResponse.body() != null) {
                    allProducts = productResponse.body()!!
                    Log.d(TAG, "Successfully fetched ${allProducts.size} products.")
                    // Filter for the initially selected company
                    if (companyIds.isNotEmpty()) {
                        filterProductsByCompany(companyIds[0])
                    }
                } else {
                    Log.e(TAG, "Failed to fetch products. Code: ${productResponse.code()}, Message: ${productResponse.message()}")
                    Toast.makeText(this@MainActivity, "Failed to fetch products", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception in fetchProducts: ${e.message}", e)
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupCompanySpinner() {
        Log.d(TAG, "Setting up company spinner with IDs: $companyIds")
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, companyIds)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.companySpinner.adapter = adapter
        binding.companySpinner.isEnabled = true

        binding.companySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) {
                val selectedCompanyId = companyIds[position]
                Log.d(TAG, "Company selected: $selectedCompanyId")
                filterProductsByCompany(selectedCompanyId)
            }

            override fun onNothingSelected(parent: AdapterView<*>) {
                productAdapter.updateProducts(emptyList())
            }
        }
    }

    private fun filterProductsByCompany(companyId: String) {
        val filteredProducts = allProducts.filter { it.companyId == companyId }
        productAdapter.updateProducts(filteredProducts)
        Log.d(TAG, "Filtered products for $companyId. Found ${filteredProducts.size} products.")
    }
}
