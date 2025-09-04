
package com.businesscart.android.ui.checkout

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.businesscart.android.R

class OrderSuccessActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_order_success)

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
}
