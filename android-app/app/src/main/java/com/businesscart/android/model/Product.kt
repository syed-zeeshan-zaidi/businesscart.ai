package com.businesscart.android.model

import com.google.gson.annotations.SerializedName

data class Product(
    @SerializedName("_id") val id: String,
    val name: String,
    val description: String?,
    val price: Double,
    @SerializedName("sellerID") val sellerId: String,
    val image: String?,
    val createdAt: String,
    val updatedAt: String
)
