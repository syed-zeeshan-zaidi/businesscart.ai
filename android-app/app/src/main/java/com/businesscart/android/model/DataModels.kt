package com.businesscart.android.model

data class Company(
    val _id: String,
    val name: String,
    val email: String,
    val phoneNumber: String,
    val address: String
)

data class Product(
    val _id: String,
    val name: String,
    val description: String,
    val price: Double,
    val company_id: String
)
