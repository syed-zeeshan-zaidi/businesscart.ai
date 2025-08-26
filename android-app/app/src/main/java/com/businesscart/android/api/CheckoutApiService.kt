package com.businesscart.android.api

import com.businesscart.android.model.Cart
import com.businesscart.android.model.UpdateCartItemRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PUT
import retrofit2.http.Path

interface CheckoutApiService {

    @GET("cart")
    suspend fun getCart(@Header("Authorization") token: String, @Header("x-seller-id") sellerId: String): Response<Cart>

    @PUT("cart/{itemId}")
    suspend fun updateCartItem(
        @Header("Authorization") token: String,
        @Path("itemId") itemId: String,
        @Body request: UpdateCartItemRequest
    ): Response<Cart>

    @DELETE("cart/{itemId}")
    suspend fun removeCartItem(
        @Header("Authorization") token: String,
        @Path("itemId") itemId: String
    ): Response<Cart>
}