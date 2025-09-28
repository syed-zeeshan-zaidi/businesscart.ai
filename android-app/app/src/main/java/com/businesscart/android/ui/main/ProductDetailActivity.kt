package com.businesscart.android.ui.main

import android.os.Bundle
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.businesscart.android.R
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.AddItemToCartRequest
import com.businesscart.android.model.CartItem
import com.businesscart.android.model.Product
import com.squareup.picasso.Picasso
import kotlinx.coroutines.launch

class ProductDetailActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_product_detail)

        val product = intent.getParcelableExtra<Product>("PRODUCT_EXTRA")

        if (product == null) {
            finish()
            return
        }

        val nameTextView: TextView = findViewById(R.id.productNameTextView)
        val descriptionTextView: TextView = findViewById(R.id.productDescriptionTextView)
        val priceTextView: TextView = findViewById(R.id.productPriceTextView)
        val imageView: ImageView = findViewById(R.id.productImageView)
        val addToCartButton: Button = findViewById(R.id.addToCartButton)

        nameTextView.text = product.name
        descriptionTextView.text = product.description
        priceTextView.text = "$${product.price}"

        if (!product.image.isNullOrEmpty()) {
            Picasso.get().load(product.image).into(imageView)
        }

        addToCartButton.setOnClickListener {
            addToCart(product)
        }
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
                    price = product.price,
                    discountedPrice = product.discountedPrice,
                    lineItemTotal = 0.0
                )
                val request = AddItemToCartRequest(entity = cartItem)
                val response = RetrofitClient.checkoutApiService.addItemToCart(request)
                if (response.isSuccessful) {
                    Toast.makeText(this@ProductDetailActivity, "${product.name} added to cart", Toast.LENGTH_SHORT).show()
                } else {
                    val errorBody = response.errorBody()?.string()
                    Toast.makeText(this@ProductDetailActivity, "Failed to add item to cart: $errorBody", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@ProductDetailActivity, "An error occurred: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}