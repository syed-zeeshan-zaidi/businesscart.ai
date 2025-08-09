package com.businesscart.android.api

import com.businesscart.android.model.Cart
import com.businesscart.android.model.CartItem
import com.businesscart.android.model.Order
import com.businesscart.android.model.Quote
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Header
import retrofit2.http.Path
import retrofit2.http.Query

interface CheckoutApiService {
    @POST("cart")
    suspend fun addItemToCart(@Header("Authorization") token: String, @Body request: AddToCartRequest): Response<Cart>

    @GET("cart")
    suspend fun getCart(@Header("Authorization") token: String, @Query("companyId") companyId: String): Response<Cart>

    @POST("quotes")
    suspend fun createQuote(@Header("Authorization") token: String, @Body request: CreateQuoteRequest): Response<Quote>

    @GET("quotes/{quoteId}")
    suspend fun getQuote(@Header("Authorization") token: String, @Path("quoteId") quoteId: String): Response<Quote>

    @POST("orders")
    suspend fun createOrder(@Header("Authorization") token: String, @Body request: CreateOrderRequest): Response<Order>
}

data class AddToCartRequest(
    val entity: CartItem
)

data class CreateQuoteRequest(
    val companyId: String
)

data class CreateOrderRequest(
    val quoteId: String,
    val paymentMethod: String,
    val paymentToken: String
)
