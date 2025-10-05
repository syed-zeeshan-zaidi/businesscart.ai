package com.businesscart.android.ui.checkout

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.Account
import com.businesscart.android.model.CompanyData
import com.businesscart.android.model.UpdateCartItemRequest
import com.businesscart.android.model.CartItem
import com.businesscart.android.model.CreateQuoteRequest
import com.businesscart.android.model.UpdateCartItemPayload
import com.businesscart.android.ui.main.CatalogActivity
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.launch
import android.widget.LinearLayout
import android.widget.ImageView
import android.widget.PopupMenu
import com.squareup.picasso.Picasso

class CartActivity : AppCompatActivity() {

    private lateinit var singleCompanyDisplay: LinearLayout
    private lateinit var companyLogoImageView: ImageView
    private lateinit var companyNameTextView: TextView
    private lateinit var dropdownArrow: ImageView
    private lateinit var recyclerView: RecyclerView
    private lateinit var checkoutButton: Button
    private lateinit var clearCartButton: Button
    private lateinit var totalTextView: TextView
    private lateinit var cartAdapter: CartAdapter
    private lateinit var sessionManager: SessionManager
    private lateinit var progressBar: ProgressBar
    private var selectedCompanyId: String? = null
    private var companies: List<CompanyData> = listOf()
    private val companiesMap = mutableMapOf<String, CompanyData>()
    private var account: Account? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_cart)

        val toolbar: Toolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayUseLogoEnabled(true)
        supportActionBar?.setLogo(R.drawable.ic_logo)
        supportActionBar?.title = " BusinessCart"

        recyclerView = findViewById(R.id.cartRecyclerView)
        checkoutButton = findViewById(R.id.checkoutButton)
        clearCartButton = findViewById(R.id.clearCartButton)
        totalTextView = findViewById(R.id.totalTextView)
        progressBar = findViewById(R.id.progressBar)
        sessionManager = SessionManager(this)
        RetrofitClient.initialize(this)

        singleCompanyDisplay = findViewById(R.id.singleCompanyDisplay)
        companyLogoImageView = findViewById(R.id.companyLogoImageView)
        companyNameTextView = findViewById(R.id.companyNameTextView)
        dropdownArrow = findViewById(R.id.dropdownArrow)

        setupRecyclerView()
        setupCompanySelector() // Call the new setup function
        fetchAccountDetails()

        checkoutButton.setOnClickListener {
            createQuote()
        }

        clearCartButton.setOnClickListener {
            clearCart()
        }
    }

    override fun onStop() {
        super.onStop()
        progressBar.visibility = View.GONE
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.cart_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean =
        when(item.itemId) {
            R.id.action_catalog -> {
                startActivity(Intent(this, CatalogActivity::class.java))
                true
            }
            else -> super.onOptionsItemSelected(item)
        }

    private fun setupRecyclerView() {
        cartAdapter = CartAdapter(mutableListOf(), ::onUpdateCartItem, ::onRemoveCartItem)
        recyclerView.adapter = cartAdapter
        recyclerView.layoutManager = LinearLayoutManager(this)
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
                updateCompanyUI() // Update UI after setting selectedCompanyId
                fetchCart() // Re-fetch cart for the new company
            }
            true
        }
        popupMenu.show()
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

    private fun fetchAccountDetails() {
        lifecycleScope.launch {
            progressBar.visibility = View.VISIBLE
            try {
                val userId = sessionManager.getUserId() ?: return@launch
                val response = RetrofitClient.apiService.getAccount(userId)
                if (response.isSuccessful) {
                    account = response.body()
                    account?.customer?.attachedCompanies?.let {
                        companies = it
                        companiesMap.clear()
                        it.forEach { company ->
                            val id = company.companyCodeId ?: company.companyCode
                            companiesMap[id] = company
                        }
                        if (companies.isNotEmpty()) {
                            selectedCompanyId = companies.first().companyCodeId
                            updateCompanyUI() // Update UI after setting selectedCompanyId
                            fetchCart() // Fetch cart for the initially selected company
                        }
                    }
                } else {
                    showToast(getString(R.string.failed_to_fetch_account_details))
                }
            } catch (e: Exception) {
                Log.e("CartActivity", "Error fetching account details", e)
                showToast(getString(R.string.error_message, e.message))
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
                            totalTextView.text = getString(R.string.total_price, it.totalPrice)
                        }
                    } else {
                        Log.e("CartActivity", "Error fetching cart: ${response.errorBody()?.string()}")
                        showToast(getString(R.string.failed_to_fetch_cart))
                        clearCartView()
                    }
                } catch (e: Exception) {
                    Log.e("CartActivity", "Error fetching cart", e)
                    showToast(getString(R.string.error_message, e.message))
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
                    val payload =
                        UpdateCartItemPayload(entity = UpdateCartItemRequest(quantity = cartItem.quantity))
                    val response = RetrofitClient.checkoutApiService.updateCartItem(itemId, payload, sellerId)
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
            selectedCompanyId?.let { sellerId ->
                progressBar.visibility = View.VISIBLE
                val company = companiesMap[sellerId]
                if (company == null) {
                    showToast(getString(R.string.selected_company_not_found))
                    progressBar.visibility = View.GONE
                    return@launch
                }

                val customerAddresses = account?.customer?.customerAddresses ?: emptyList()

                val createQuoteRequest = CreateQuoteRequest(
                    sellerId = sellerId,
                    paymentMethods = company.paymentMethods,
                    deliveryMethods = company.deliveryMethods,
                    shippingOutOptions = company.shippingOutOptions ?: emptyList(),
                    companyLocations = company.companyLocations ?: emptyList(),
                    customerAddresses = customerAddresses
                )

                try {
                    val response = RetrofitClient.checkoutApiService.createQuote(createQuoteRequest)
                    if (response.isSuccessful) {
                        response.body()?.let {
                            val intent = Intent(this@CartActivity, CheckoutActivity::class.java)
                            intent.putExtra("QUOTE_ID", it.id)
                            startActivity(intent)
                        }
                    } else {
                        showToast(getString(R.string.failed_to_create_quote, response.errorBody()?.string()), Toast.LENGTH_LONG)
                    }
                } catch (e: Exception) {
                    showToast(getString(R.string.failed_to_create_quote, e.message), Toast.LENGTH_LONG)
                } finally {
                    progressBar.visibility = View.GONE
                }
            }
        }
    }

    private fun clearCartView() {
        cartAdapter.cartItems.clear()
        cartAdapter.notifyDataSetChanged()
        totalTextView.text = getString(R.string.total_price, 0.0)
    }

    private fun showToast(message: String, duration: Int = Toast.LENGTH_SHORT) {
        Toast.makeText(this@CartActivity, message, duration).show()
    }
}
