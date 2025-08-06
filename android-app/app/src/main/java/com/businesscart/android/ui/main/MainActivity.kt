package com.businesscart.android.ui.main

import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.businesscart.android.api.CompanyApiClient
import com.businesscart.android.api.ProductApiClient
import com.businesscart.android.databinding.ActivityMainBinding
import com.businesscart.android.model.Company
import com.businesscart.android.model.Product
import com.businesscart.android.ui.login.LoginActivity
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var sessionManager: SessionManager
    private lateinit var productAdapter: ProductAdapter
    private var allProducts: List<Product> = emptyList()
    private var companies: List<Company> = emptyList()

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

        fetchCompanies()
        fetchProducts()
    }

    private fun setupRecyclerView() {
        productAdapter = ProductAdapter(emptyList())
        binding.productRecyclerView.apply {
            adapter = productAdapter
            layoutManager = LinearLayoutManager(this@MainActivity)
        }
    }

    private fun fetchCompanies() {
        lifecycleScope.launch {
            try {
                val token = "Bearer ${sessionManager.getAuthToken()}"
                val response = CompanyApiClient.apiService.getCompanies(token)
                if (response.isSuccessful) {
                    companies = response.body() ?: emptyList()
                    setupCompanySpinner()
                } else {
                    Toast.makeText(this@MainActivity, "Failed to fetch companies", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun fetchProducts() {
        lifecycleScope.launch {
            try {
                val token = "Bearer ${sessionManager.getAuthToken()}"
                val response = ProductApiClient.apiService.getProducts(token)
                if (response.isSuccessful) {
                    allProducts = response.body() ?: emptyList()
                    // Initially filter products for the first company if available
                    if (companies.isNotEmpty()) {
                        filterProductsByCompany(companies[0]._id)
                    }
                } else {
                    Toast.makeText(this@MainActivity, "Failed to fetch products", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupCompanySpinner() {
        val companyNames = companies.map { it.name }
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, companyNames)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.companySpinner.adapter = adapter

        binding.companySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) {
                val selectedCompany = companies[position]
                filterProductsByCompany(selectedCompany._id)
            }

            override fun onNothingSelected(parent: AdapterView<*>) {
                // Do nothing
            }
        }
    }

    private fun filterProductsByCompany(companyId: String) {
        val filteredProducts = allProducts.filter { it.company_id == companyId }
        productAdapter.updateProducts(filteredProducts)
    }
}
