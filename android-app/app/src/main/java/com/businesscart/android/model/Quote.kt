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

data class CreateOrderRequest(
    val quoteId: String,
    val paymentMethod: String,
    val paymentToken: String
)

data class Order(
    val id: String,
    val quoteId: String,
    val status: String
)
