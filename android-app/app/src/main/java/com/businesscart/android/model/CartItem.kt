package com.businesscart.android.model

data class CartItem(
    val id: String?,
    val productId: String,
    val quantity: Int,
    val sellerId: String,
    val name: String,
    val price: Double
)

data class AddItemToCartRequest(val entity: CartItem)

data class UpdateCartItemRequest(
    val quantity: Int
)

data class UpdateCartItemPayload(
    val entity: UpdateCartItemRequest
)