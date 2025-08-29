package com.businesscart.android.api

import com.businesscart.android.model.Cart
import com.businesscart.android.model.CartItem
import com.businesscart.android.model.UpdateCartItemRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query


interface CheckoutApiService {

    @POST("cart")
    suspend fun addItemToCart(@Body request: CartItem): Response<Cart>

    @GET("cart")
    suspend fun getCart(@Query("sellerId") sellerId: String): Response<Cart>

    @PUT("cart/{itemId}")
    suspend fun updateCartItem(
        @Path("itemId") itemId: String,
        @Body request: UpdateCartItemRequest,
        @Query("sellerId") sellerId: String
    ): Response<Cart>

    @DELETE("cart/{itemId}")
    suspend fun removeCartItem(
        @Path("itemId") itemId: String,
        @Query("sellerId") sellerId: String
    ): Response<Cart>

    @DELETE("cart")
    suspend fun clearCart(@Query("sellerId") sellerId: String): Response<Cart>

    @POST("quotes")
    suspend fun createQuote(@Body request: Map<String, String>): Response<com.businesscart.android.model.Quote>
}
