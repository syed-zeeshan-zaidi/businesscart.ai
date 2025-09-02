package com.businesscart.android.ui.checkout

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.Account
import com.businesscart.android.model.Order
import com.businesscart.android.ui.main.CatalogActivity
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.launch

class OrderHistoryActivity : AppCompatActivity() {

    private lateinit var ordersRecyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var sessionManager: SessionManager
    private lateinit var orderAdapter: OrderAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_order_history)

        ordersRecyclerView = findViewById(R.id.ordersRecyclerView)
        progressBar = findViewById(R.id.progressBar)
        sessionManager = SessionManager(this)

        setupRecyclerView()
        fetchData()
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.account_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            android.R.id.home -> {            // up-arrow in toolbar
                finish()
                true
            }
            R.id.action_catalog -> {         // catalog icon
                startActivity(Intent(this, CatalogActivity::class.java))
                finish()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun setupRecyclerView() {
        ordersRecyclerView.layoutManager = LinearLayoutManager(this)
        orderAdapter = OrderAdapter(emptyList(), null)
        ordersRecyclerView.adapter = orderAdapter
    }

    private fun fetchData() {
        progressBar.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val userId = sessionManager.getUserId() ?: return@launch
                val accountResponse = RetrofitClient.apiService.getAccount(userId)
                val ordersResponse = RetrofitClient.checkoutApiService.getOrders()

                if (accountResponse.isSuccessful && ordersResponse.isSuccessful) {
                    val account = accountResponse.body()
                    val orders = ordersResponse.body()
                    if (account != null && orders != null) {
                        orderAdapter.updateOrders(orders)
                        // I need to update the adapter with the account info as well
                        orderAdapter = OrderAdapter(orders, account)
                        ordersRecyclerView.adapter = orderAdapter
                    }
                } else {
                    Toast.makeText(this@OrderHistoryActivity, "Failed to fetch data", Toast.LENGTH_SHORT).show()
                }

            } catch (e: Exception) {
                Toast.makeText(this@OrderHistoryActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                progressBar.visibility = View.GONE
            }
        }
    }
}
