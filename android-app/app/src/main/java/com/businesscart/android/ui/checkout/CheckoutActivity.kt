package com.businesscart.android.ui.checkout

import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.CreateOrderRequest
import com.businesscart.android.model.Quote
import kotlinx.coroutines.launch

class CheckoutActivity : AppCompatActivity() {

    private lateinit var quoteSummaryTextView: TextView
    private lateinit var subtotalTextView: TextView
    private lateinit var shippingTextView: TextView
    private lateinit var taxTextView: TextView
    private lateinit var totalTextView: TextView
    private lateinit var placeOrderButton: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var quoteItemsRecyclerView: RecyclerView

    private var currentQuote: Quote? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_checkout)

        // Initialize Views
        quoteSummaryTextView = findViewById(R.id.quoteSummaryTextView)
        subtotalTextView = findViewById(R.id.subtotalTextView)
        shippingTextView = findViewById(R.id.shippingTextView)
        taxTextView = findViewById(R.id.taxTextView)
        totalTextView = findViewById(R.id.totalTextView)
        placeOrderButton = findViewById(R.id.placeOrderButton)
        progressBar = findViewById(R.id.progressBar)
        quoteItemsRecyclerView = findViewById(R.id.quoteItemsRecyclerView)
        quoteItemsRecyclerView.layoutManager = LinearLayoutManager(this)

        val quoteId = intent.getStringExtra("QUOTE_ID")

        if (quoteId == null) {
            Toast.makeText(this, "Error: Quote ID is missing.", Toast.LENGTH_LONG).show()
            finish() // Close the activity if there's no ID
            return
        }

        fetchQuoteDetails(quoteId)

        placeOrderButton.setOnClickListener {
            currentQuote?.let {
                placeOrder(it.id)
            }
        }
    }

    private fun fetchQuoteDetails(quoteId: String) {
        progressBar.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val response = RetrofitClient.checkoutApiService.getQuote(quoteId)
                if (response.isSuccessful) {
                    response.body()?.let { quote ->
                        currentQuote = quote
                        updateUiWithQuote(quote)
                    }
                } else {
                    Log.e("CheckoutActivity", "Failed to fetch quote: ${response.errorBody()?.string()}")
                    Toast.makeText(this@CheckoutActivity, "Failed to load quote details.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e("CheckoutActivity", "Exception when fetching quote", e)
                Toast.makeText(this@CheckoutActivity, "An error occurred: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                progressBar.visibility = View.GONE
            }
        }
    }

    private fun updateUiWithQuote(quote: Quote) {
        quoteItemsRecyclerView.adapter = QuoteAdapter(quote.items)

        subtotalTextView.text = "Subtotal: $${String.format("%.2f", quote.subtotal)}"
        shippingTextView.text = "Shipping: $${String.format("%.2f", quote.shippingCost)}"
        taxTextView.text = "Tax: $${String.format("%.2f", quote.taxAmount)}"
        totalTextView.text = "Total: $${String.format("%.2f", quote.grandTotal)}"
        quoteSummaryTextView.text = "Quote Summary (${quote.items.size} items)"
    }

    private fun placeOrder(quoteId: String) {
        progressBar.visibility = View.VISIBLE
        placeOrderButton.isEnabled = false
        
        lifecycleScope.launch {
            try {
                val request = CreateOrderRequest(
                    quoteId = quoteId,
                    paymentMethod = "stripe",
                    paymentToken = "tok_stripe_valid"
                )
                val response = RetrofitClient.checkoutApiService.createOrder(request)
                if (response.isSuccessful) {
                    Toast.makeText(this@CheckoutActivity, "Order placed successfully!", Toast.LENGTH_LONG).show()
                    finish()
                } else {
                    Log.e("CheckoutActivity", "Failed to place order: ${response.errorBody()?.string()}")
                    Toast.makeText(this@CheckoutActivity, "Failed to place order.", Toast.LENGTH_SHORT).show()
                    placeOrderButton.isEnabled = true
                }
            } catch (e: Exception) {
                Log.e("CheckoutActivity", "Exception when placing order", e)
                Toast.makeText(this@CheckoutActivity, "An error occurred: ${e.message}", Toast.LENGTH_SHORT).show()
                placeOrderButton.isEnabled = true
            } finally {
                progressBar.visibility = View.GONE
            }
        }
    }
}