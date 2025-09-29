package com.businesscart.android.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class Product(
    @SerializedName("_id") val id: String,
    val name: String,
    val description: String?,
    val price: Double,
    val discountedPrice: Double?,
    @SerializedName("sellerID") val sellerId: String,
    val image: String?,
    val category: String?,
    val attributes: List<Attribute>?,
    val createdAt: String,
    val updatedAt: String
) : Parcelable

@Parcelize
data class Attribute(
    val key: String,
    val value: String,
    val type: String
) : Parcelable
