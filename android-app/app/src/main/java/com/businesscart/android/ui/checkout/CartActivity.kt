
package com.businesscart.android.ui.checkout

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.api.CheckoutApiClient
import com.businesscart.android.model.UpdateCartItemRequest
import com.businesscart.android.model.CartItem
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.launch

class CartActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var checkoutButton: Button
    private lateinit var cartAdapter: CartAdapter
    private lateinit var sessionManager: SessionManager
    private var sellerId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_cart)

        recyclerView = findViewById(R.id.cartRecyclerView)
        checkoutButton = findViewById(R.id.checkoutButton)
        sessionManager = SessionManager(this)
        sellerId = intent.getStringExtra("SELLER_ID")

        setupRecyclerView()
        fetchCart()

        checkoutButton.setOnClickListener {
            // Navigate to CheckoutActivity
            val intent = Intent(this, CheckoutActivity::class.java)
            intent.putExtra("SELLER_ID", sellerId)
            startActivity(intent)
        }
    }

    private fun setupRecyclerView() {
        cartAdapter = CartAdapter(mutableListOf(), ::onUpdateCartItem, ::onRemoveCartItem)
        recyclerView.adapter = cartAdapter
        recyclerView.layoutManager = LinearLayoutManager(this)
    }

    private fun fetchCart() {
        lifecycleScope.launch {
            val token = sessionManager.getAuthToken() ?: return@launch
            sellerId?.let {
                val response = CheckoutApiClient.apiService.getCart("Bearer $token", it)
                if (response.isSuccessful) {
                    response.body()?.let {
                        cartAdapter.cartItems.clear()
                        cartAdapter.cartItems.addAll(it.items)
                        cartAdapter.notifyDataSetChanged()
                    }
                }
            }
        }
    }

    private fun onUpdateCartItem(cartItem: CartItem) {
        lifecycleScope.launch {
            val token = sessionManager.getAuthToken() ?: return@launch
            cartItem.id?.let {
                val response = CheckoutApiClient.apiService.updateCartItem("Bearer $token", it, UpdateCartItemRequest(quantity = cartItem.quantity))
                if (response.isSuccessful) {
                    fetchCart()
                }
            }
        }
    }

    private fun onRemoveCartItem(cartItem: CartItem) {
        lifecycleScope.launch {
            val token = sessionManager.getAuthToken() ?: return@launch
            cartItem.id?.let {
                val response = CheckoutApiClient.apiService.removeCartItem("Bearer $token", it)
                if (response.isSuccessful) {
                    fetchCart()
                }
            }
        }
    }
}
