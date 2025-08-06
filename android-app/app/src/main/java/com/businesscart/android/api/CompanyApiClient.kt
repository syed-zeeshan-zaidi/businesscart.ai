package com.businesscart.android.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object CompanyApiClient {
    private const val BASE_URL = "http://10.0.2.2:3001/"

    val apiService: CompanyApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(CompanyApiService::class.java)
    }
}
