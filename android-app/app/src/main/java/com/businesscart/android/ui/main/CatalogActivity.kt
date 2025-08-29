package com.businesscart.android.ui.main

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.AddItemToCartRequest
import com.businesscart.android.model.CartItem
import com.businesscart.android.model.Product
import com.businesscart.android.ui.checkout.CartActivity
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.launch

class CatalogActivity : AppCompatActivity() {

    private val TAG = "CatalogActivity"
    private lateinit var recyclerView: RecyclerView
    private lateinit var companySpinner: Spinner
    private lateinit var progressBar: ProgressBar
    private lateinit var productAdapter: ProductAdapter
    private var productList = listOf<Product>()
    private var companyList = listOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_catalog)

        recyclerView = findViewById(R.id.recyclerView)
        companySpinner = findViewById(R.id.companySpinner)
        progressBar = findViewById(R.id.progressBar)

        setupRecyclerView()
        setupCompanySpinner()
        fetchProducts()
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
            else -> super.onOptionsItemSelected(item)
        }

    private fun setupRecyclerView() {
        recyclerView.layoutManager = GridLayoutManager(this, 2)
    }

    private fun setupCompanySpinner() {
        companySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (companyList.isNotEmpty()) {
                    Log.d(TAG, "Company selected: ${companyList[position]}")
                    filter(companyList[position])
                }
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun fetchProducts() {
        Log.d(TAG, "Fetching products...")
        progressBar.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val products = RetrofitClient.productApiService.getProducts()
                Log.d(TAG, "Fetched ${products.size} products")
                productList = products
                companyList = products.map { it.sellerId }.distinct()
                Log.d(TAG, "Found ${companyList.size} distinct companies: $companyList")

                val adapter = ArrayAdapter(this@CatalogActivity, android.R.layout.simple_spinner_item, companyList)
                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                companySpinner.adapter = adapter

                if (companyList.isNotEmpty()) {
                    filter(companyList.first())
                } else {
                    Log.d(TAG, "No companies found, clearing product list.")
                    productAdapter = ProductAdapter(listOf()) {}
                    recyclerView.adapter = productAdapter
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch products", e)
                Toast.makeText(this@CatalogActivity, "Failed to fetch products", Toast.LENGTH_SHORT).show()
            } finally {
                progressBar.visibility = View.GONE
            }
        }
    }

    private fun filter(company: String) {
        val filteredList = productList.filter {
            it.sellerId == company
        }
        Log.d(TAG, "Filtering for company '$company', found ${filteredList.size} products.")
        productAdapter = ProductAdapter(filteredList) { product ->
            addToCart(product)
        }
        recyclerView.adapter = productAdapter
    }

    private fun addToCart(product: Product) {
        lifecycleScope.launch {
            try {
                val cartItem = CartItem(
                    id = null,
                    productId = product.id,
                    quantity = 1,
                    sellerId = product.sellerId,
                    name = product.name,
                    price = product.price
                )
                val request = AddItemToCartRequest(entity = cartItem)
                val response = RetrofitClient.checkoutApiService.addItemToCart(request)
                if (response.isSuccessful) {
                    Toast.makeText(this@CatalogActivity, "${product.name} added to cart", Toast.LENGTH_SHORT).show()
                } else {
                    val errorBody = response.errorBody()?.string()
                    Log.e(TAG, "Failed to add item to cart: $errorBody")
                    Toast.makeText(this@CatalogActivity, "Failed to add item to cart", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "An error occurred while adding to cart", e)
                Toast.makeText(this@CatalogActivity, "An error occurred", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
