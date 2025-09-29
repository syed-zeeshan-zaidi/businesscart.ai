package com.businesscart.android.ui.main

import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.util.Log
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SearchView
import androidx.appcompat.widget.Toolbar
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.AddItemToCartRequest
import com.businesscart.android.model.CartItem
import com.businesscart.android.model.CompanyData
import com.businesscart.android.model.Product
import com.businesscart.android.ui.account.AccountActivity
import com.businesscart.android.ui.checkout.CartActivity
import com.businesscart.android.util.SessionManager
import com.squareup.picasso.Picasso
import kotlinx.coroutines.launch

class CatalogActivity : AppCompatActivity() {

    private val TAG = "CatalogActivity"
    private lateinit var recyclerView: RecyclerView
    private lateinit var categorySpinner: Spinner
    private lateinit var searchView: SearchView
    private lateinit var filterButton: ImageView
    private lateinit var closeFilterButton: ImageView
    private lateinit var filterPanel: FrameLayout
    private lateinit var advancedFiltersContainer: LinearLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var productAdapter: ProductAdapter
    private lateinit var singleCompanyDisplay: LinearLayout
    private lateinit var companyLogoImageView: ImageView
    private lateinit var companyNameTextView: TextView
    private lateinit var dropdownArrow: ImageView
    private lateinit var sessionManager: SessionManager

    private var productList = listOf<Product>()
    private var companies = listOf<CompanyData>()
    private var categoryList = listOf<String>()
    private var currentSearchQuery = ""
    private var currentCategory = "All Categories"
    private var selectedCompanyId: String? = null
    private val attributeFilters = mutableMapOf<String, String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_catalog)

        val toolbar: Toolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayUseLogoEnabled(true)
        supportActionBar?.setLogo(R.drawable.ic_logo)
        supportActionBar?.title = " BusinessCart"

        sessionManager = SessionManager(this)
        recyclerView = findViewById(R.id.recyclerView)
        categorySpinner = findViewById(R.id.categorySpinner)
        searchView = findViewById(R.id.searchView)
        progressBar = findViewById(R.id.progressBar)
        filterButton = findViewById(R.id.filterButton)
        closeFilterButton = findViewById(R.id.closeFilterButton)
        filterPanel = findViewById(R.id.filterPanel)
        advancedFiltersContainer = findViewById(R.id.advancedFiltersContainer)
        singleCompanyDisplay = findViewById(R.id.singleCompanyDisplay)
        companyLogoImageView = findViewById(R.id.companyLogoImageView)
        companyNameTextView = findViewById(R.id.companyNameTextView)
        dropdownArrow = findViewById(R.id.dropdownArrow)

        setupRecyclerView()
        setupCategorySpinner()
        setupSearchView()
        setupFilterButton()
        setupCompanySelector()
        fetchData()
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
        recyclerView.layoutManager = GridLayoutManager(this, 2)
    }

    private fun setupCategorySpinner() {
        categorySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                currentCategory = categoryList[position]
                filter()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun setupSearchView() {
        searchView.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(query: String?): Boolean {
                return false
            }

            override fun onQueryTextChange(newText: String?): Boolean {
                currentSearchQuery = newText ?: ""
                filter()
                return true
            }
        })
    }

    private fun setupFilterButton() {
        filterButton.setOnClickListener {
            if (filterPanel.visibility == View.VISIBLE) {
                filterPanel.animate().translationX(filterPanel.width.toFloat()).withEndAction {
                    filterPanel.visibility = View.GONE
                }
            } else {
                filterPanel.visibility = View.VISIBLE
                filterPanel.translationX = filterPanel.width.toFloat()
                filterPanel.animate().translationX(0f)
            }
        }
        closeFilterButton.setOnClickListener {
            filterPanel.animate().translationX(filterPanel.width.toFloat()).withEndAction {
                filterPanel.visibility = View.GONE
            }
        }
    }
    
    private fun setupCompanySelector() {
        singleCompanyDisplay.setOnClickListener {
            if (companies.size > 1) {
                showCompanyPopupMenu()
            }
        }
    }

    private fun showCompanyPopupMenu() {
        val popupMenu = PopupMenu(this, singleCompanyDisplay)
        companies.forEach { company ->
            popupMenu.menu.add(company.name)
        }
        popupMenu.setOnMenuItemClickListener { menuItem ->
            val selectedCompany = companies.find { it.name == menuItem.title }
            if (selectedCompany != null && selectedCompany.companyCodeId != selectedCompanyId) {
                selectedCompanyId = selectedCompany.companyCodeId
                updateCompanyUI()
                filter()
            }
            true
        }
        popupMenu.show()
    }

    private fun fetchData() {
        Log.d(TAG, "Fetching data...")
        progressBar.visibility = View.VISIBLE
        recyclerView.visibility = View.GONE
        findViewById<View>(R.id.searchCard).visibility = View.GONE
        singleCompanyDisplay.visibility = View.GONE

        lifecycleScope.launch {
            try {
                val userId = sessionManager.getUserId() ?: return@launch
                val accountResponse = RetrofitClient.apiService.getAccount(userId)
                productList = RetrofitClient.productApiService.getProducts()
                val account = accountResponse.body()
                companies = account?.customer?.attachedCompanies ?: emptyList()

                if (companies.isNotEmpty()) {
                    selectedCompanyId = companies.first().companyCodeId
                }

                updateCompanyUI()

                categoryList = listOf("All Categories") + productList.mapNotNull { it.category }.distinct().sorted()
                val categoryAdapter = ArrayAdapter(this@CatalogActivity, android.R.layout.simple_spinner_item, categoryList)
                categoryAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                categorySpinner.adapter = categoryAdapter

                populateAdvancedFilters()
                filter()

            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch data", e)
                Toast.makeText(this@CatalogActivity, "Failed to fetch data", Toast.LENGTH_SHORT).show()
            } finally {
                progressBar.visibility = View.GONE
                recyclerView.visibility = View.VISIBLE
                findViewById<View>(R.id.searchCard).visibility = View.VISIBLE
                singleCompanyDisplay.visibility = View.VISIBLE
            }
        }
    }

    private fun updateCompanyUI() {
        if (selectedCompanyId == null || companies.isEmpty()) {
            singleCompanyDisplay.visibility = View.GONE
            return
        }

        val currentCompany = companies.find { it.companyCodeId == selectedCompanyId } ?: companies.first()
        
        companyNameTextView.text = currentCompany.name
        if (!currentCompany.logoUrl.isNullOrEmpty()) {
            Picasso.get().load(currentCompany.logoUrl).into(companyLogoImageView)
        } else {
            companyLogoImageView.setImageResource(0) // or a placeholder
        }

        dropdownArrow.visibility = if (companies.size > 1) View.VISIBLE else View.GONE
    }

    private fun populateAdvancedFilters() {
        advancedFiltersContainer.removeAllViews()
        val filterableAttributes = productList
            .flatMap { it.attributes ?: emptyList() }
            .filter { it.type == "filterable" }
            .groupBy { it.key }
            .mapValues { entry -> listOf("All") + entry.value.map { it.value }.distinct().sorted() }

        for ((key, values) in filterableAttributes) {
            val label = TextView(this).apply {
                text = key
                setTextAppearance(android.R.style.TextAppearance_DeviceDefault_Medium)
                typeface = Typeface.DEFAULT_BOLD
                val labelParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                labelParams.topMargin = 16
                layoutParams = labelParams
            }
            advancedFiltersContainer.addView(label)

            val spinner = Spinner(this).apply {
                val adapter = ArrayAdapter(this@CatalogActivity, android.R.layout.simple_spinner_item, values)
                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                this.adapter = adapter
                val spinnerParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                spinnerParams.topMargin = 8
                spinnerParams.bottomMargin = 8
                layoutParams = spinnerParams
                onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                    override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                        val selectedValue = values[position]
                        if (selectedValue == "All") {
                            attributeFilters.remove(key)
                        } else {
                            attributeFilters[key] = selectedValue
                        }
                        filter()
                    }
                    override fun onNothingSelected(parent: AdapterView<*>?) {}
                }
            }
            advancedFiltersContainer.addView(spinner)
        }
    }

    private fun filter() {
        if (selectedCompanyId == null) {
            productAdapter = ProductAdapter(emptyList(), {}, {})
            recyclerView.adapter = productAdapter
            return
        }

        val filteredList = productList.filter {
            val companyMatch = it.sellerId == selectedCompanyId
            val searchMatch = it.name.contains(currentSearchQuery, ignoreCase = true)
            val categoryMatch = currentCategory == "All Categories" || it.category == currentCategory
            val attributeMatch = attributeFilters.all { (key, value) ->
                it.attributes?.any { attr -> attr.key == key && attr.value == value } ?: false
            }
            companyMatch && searchMatch && categoryMatch && attributeMatch
        }
        
        productAdapter = ProductAdapter(filteredList, { product: Product ->
            val intent = Intent(this, ProductDetailActivity::class.java)
            intent.putExtra("PRODUCT_EXTRA", product)
            startActivity(intent)
        }, { product: Product ->
            lifecycleScope.launch {
                try {
                    val cartItem = CartItem(
                        id = null,
                        productId = product.id,
                        quantity = 1,
                        sellerId = product.sellerId,
                        name = product.name,
                        price = product.price,
                        discountedPrice = product.discountedPrice,
                        lineItemTotal = product.discountedPrice ?: product.price
                    )
                    val request = AddItemToCartRequest(entity = cartItem)
                    val response = RetrofitClient.checkoutApiService.addItemToCart(request)
                    if (response.isSuccessful) {
                        Toast.makeText(this@CatalogActivity, "${product.name} added to cart", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@CatalogActivity, "Failed to add item to cart", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to add item to cart", e)
                    Toast.makeText(this@CatalogActivity, "An error occurred", Toast.LENGTH_SHORT).show()
                }
            }
        })
        recyclerView.adapter = productAdapter
    }
}