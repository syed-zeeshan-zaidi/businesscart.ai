package com.businesscart.android.model

data class Cart(
    val id: String,
    val accountId: String,
    val sellerId: String,
    val items: List<CartItem>,
    val totalPrice: Double
)
