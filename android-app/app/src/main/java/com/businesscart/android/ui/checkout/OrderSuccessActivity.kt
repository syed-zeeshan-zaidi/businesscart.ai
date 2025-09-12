
package com.businesscart.android.ui.checkout

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import com.businesscart.android.R
import com.businesscart.android.ui.account.AccountActivity

class OrderSuccessActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_order_success)

        val toolbar: Toolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayUseLogoEnabled(true)
        supportActionBar?.setLogo(R.drawable.ic_logo)
        supportActionBar?.title = " BusinessCart"

        val orderIdTextView: TextView = findViewById(R.id.orderIdTextView)
        val viewOrdersButton: Button = findViewById(R.id.viewOrdersButton)

        val orderId = intent.getStringExtra("ORDER_ID")
        orderIdTextView.text = "Order ID: $orderId"

        viewOrdersButton.setOnClickListener {
            val intent = Intent(this, OrderHistoryActivity::class.java)
            startActivity(intent)
            finish()
        }
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
}
