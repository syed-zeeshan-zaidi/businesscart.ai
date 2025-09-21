package com.businesscart.android.api

import com.businesscart.android.model.AddItemToCartRequest
import com.businesscart.android.model.Cart
import com.businesscart.android.model.CreateOrderRequest
import com.businesscart.android.model.CreateQuoteRequest
import com.businesscart.android.model.Quote
import com.businesscart.android.model.Order
import com.businesscart.android.model.UpdateCartItemPayload
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface CheckoutApiService {
    @GET("checkout/cart")
    suspend fun getCart(@Query("sellerId") sellerId: String): Response<Cart>

    @POST("checkout/cart")
    suspend fun addItemToCart(@Body addItemToCartRequest: AddItemToCartRequest): Response<Cart>

    @PUT("checkout/cart/{itemId}")
    suspend fun updateCartItem(
        @Path("itemId") itemId: String,
        @Body updateCartItemRequest: UpdateCartItemPayload,
        @Query("sellerId") sellerId: String
    ): Response<Cart>

    @DELETE("checkout/cart/{itemId}")
    suspend fun removeCartItem(
        @Path("itemId") itemId: String,
        @Query("sellerId") sellerId: String
    ): Response<Cart>

    @DELETE("checkout/cart")
    suspend fun clearCart(@Query("sellerId") sellerId: String): Response<Cart>

    @POST("checkout/quotes")
    suspend fun createQuote(@Body createQuoteRequest: CreateQuoteRequest): Response<Quote>

    @GET("checkout/quotes/{quoteId}")
    suspend fun getQuote(@Path("quoteId") quoteId: String): Response<Quote>

    @POST("checkout/orders")
    suspend fun createOrder(@Body request: CreateOrderRequest): Response<Order>

    @GET("checkout/orders")
    suspend fun getOrders(): Response<List<Order>>
}