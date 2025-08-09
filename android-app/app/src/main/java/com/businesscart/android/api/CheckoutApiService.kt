package com.businesscart.android.api

import com.businesscart.android.model.Cart
import com.businesscart.android.model.CartItem
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Header
import retrofit2.http.Query

interface CheckoutApiService {
    @POST("cart")
    suspend fun addItemToCart(@Header("Authorization") token: String, @Body request: AddToCartRequest): Response<Cart>

    @GET("cart")
    suspend fun getCart(@Header("Authorization") token: String, @Query("companyId") companyId: String): Response<Cart>
}

data class AddToCartRequest(
    val entity: CartItem
)