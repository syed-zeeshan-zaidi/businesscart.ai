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
