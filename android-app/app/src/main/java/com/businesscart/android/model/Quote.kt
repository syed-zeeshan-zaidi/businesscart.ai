package com.businesscart.android.model

data class Quote(
    val id: String,
    val cartId: String,
    val accountId: String,
    val sellerId: String,
    val items: List<CartItem>,
    val subtotal: Double,
    val shippingCost: Double,
    val taxAmount: Double,
    val grandTotal: Double,
    val createdAt: String,
    val expiresAt: String
)
