package com.businesscart.android.ui.checkout

import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.businesscart.android.api.CheckoutApiClient
import com.businesscart.android.api.CreateOrderRequest
import com.businesscart.android.databinding.ActivityCheckoutBinding
import com.businesscart.android.model.Quote
import com.businesscart.android.ui.ordersuccess.OrderSuccessActivity
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CheckoutActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCheckoutBinding
    private lateinit var sessionManager: SessionManager
    private lateinit var quoteItemAdapter: QuoteItemAdapter
    private var quoteId: String? = null
    private val TAG = "CheckoutActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCheckoutBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SessionManager(this)
        quoteId = intent.getStringExtra("quoteId")

        setupRecyclerView()

        if (quoteId == null) {
            Toast.makeText(this, "Error: Quote ID not found.", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        fetchQuoteDetails(quoteId!!)

        binding.placeOrderButton.setOnClickListener {
            placeOrder()
        }
    }

    private fun setupRecyclerView() {
        quoteItemAdapter = QuoteItemAdapter(emptyList())
        binding.quoteItemsRecyclerView.apply {
            adapter = quoteItemAdapter
            layoutManager = LinearLayoutManager(this@CheckoutActivity)
        }
    }

    private fun fetchQuoteDetails(id: String) {
        lifecycleScope.launch {
            try {
                val token = "Bearer ${sessionManager.getAuthToken()}"
                val response = withContext(Dispatchers.IO) {
                    CheckoutApiClient.apiService.getQuote(token, id)
                }

                if (response.isSuccessful && response.body() != null) {
                    val quote = response.body()!!
                    displayQuote(quote)
                } else {
                    Log.e(TAG, "Failed to fetch quote. Code: ${response.code()}, Message: ${response.message()}")
                    Toast.makeText(this@CheckoutActivity, "Failed to fetch quote details.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception in fetchQuoteDetails: ${e.message}", e)
                Toast.makeText(this@CheckoutActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun displayQuote(quote: Quote) {
        quoteItemAdapter.updateItems(quote.items)
        binding.subtotalTextView.text = "$${quote.subtotal}"
        binding.shippingTextView.text = "$${quote.shippingCost}"
        binding.taxTextView.text = "$${quote.taxAmount}"
        binding.grandTotalTextView.text = "$${quote.grandTotal}"
    }

    private fun placeOrder() {
        if (quoteId == null) {
            Toast.makeText(this, "Cannot place order without a quote.", Toast.LENGTH_SHORT).show()
            return
        }

        val paymentMethod = if (binding.stripeRadioButton.isChecked) "stripe" else "amazon_pay"
        // Using a placeholder payment token as in the web portal
        val paymentToken = if (paymentMethod == "stripe") "tok_stripe_valid" else "amz_pay_valid"

        lifecycleScope.launch {
            try {
                val token = "Bearer ${sessionManager.getAuthToken()}"
                val request = CreateOrderRequest(
                    quoteId = quoteId!!,
                    paymentMethod = paymentMethod,
                    paymentToken = paymentToken
                )
                val response = withContext(Dispatchers.IO) {
                    CheckoutApiClient.apiService.createOrder(token, request)
                }

                if (response.isSuccessful && response.body() != null) {
                    Toast.makeText(this@CheckoutActivity, "Order placed successfully!", Toast.LENGTH_LONG).show()
                    val intent = Intent(this@CheckoutActivity, OrderSuccessActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                } else {
                    Log.e(TAG, "Failed to place order. Code: ${response.code()}, Message: ${response.message()}")
                    Toast.makeText(this@CheckoutActivity, "Failed to place order.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception in placeOrder: ${e.message}", e)
                Toast.makeText(this@CheckoutActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
