package com.businesscart.android.api

import com.businesscart.android.model.Product
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query

interface ProductApiService {
    @GET("products")
    suspend fun getProducts(
        @Header("Authorization") token: String
    ): Response<List<Product>>
}
