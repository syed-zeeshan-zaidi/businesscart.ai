package com.businesscart.android.model

data class Order(
    val id: String,
    val quoteId: String,
    val accountId: String,
    val sellerId: String,
    val items: List<CartItem>,
    val subtotal: Double,
    val shippingCost: Double,
    val taxAmount: Double,
    val grandTotal: Double,
    val payment: Payment,
    val createdAt: String,
    val deliveryMethod: String?,
    val deliveryAddressId: String?,
    val pickupLocationId: String?
)

data class Payment(
    val transactionId: String
)
