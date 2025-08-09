package com.businesscart.android.model

data class Address(
    val street: String?,
    val city: String?,
    val state: String?,
    val zip: String?,
    val country: String?
)

data class Company(
    val _id: String,
    val name: String,
    val email: String,
    val phoneNumber: String,
    val address: Address
)

data class Product(
    val _id: String,
    val name: String,
    val description: String,
    val price: Double,
    val companyId: String,
    val userId: String,
    val image: String?
)

data class CartItem(
    val id: String?,
    val productId: String,
    val quantity: Int,
    val companyId: String,
    val name: String,
    val price: Double
)

data class Cart(
    val id: String,
    val userId: String,
    val companyId: String,
    val items: List<CartItem>,
    val totalPrice: Double
)

data class Quote(
    val id: String,
    val cartId: String,
    val userId: String,
    val companyId: String,
    val items: List<CartItem>,
    val subtotal: Double,
    val shippingCost: Double,
    val taxAmount: Double,
    val grandTotal: Double,
    val createdAt: String,
    val expiresAt: String
)

data class Order(
    val id: String,
    val quoteId: String,
    val userId: String,
    val companyId: String,
    val items: List<CartItem>,
    val subtotal: Double,
    val shippingCost: Double,
    val taxAmount: Double,
    val grandTotal: Double,
    val paymentMethod: String,
    val transactionId: String,
    val createdAt: String
)
