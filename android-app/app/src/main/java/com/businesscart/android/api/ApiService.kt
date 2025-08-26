package com.businesscart.android.api

import com.businesscart.android.model.LoginResponse
import com.businesscart.android.model.RegistrationRequest
import com.businesscart.android.model.Account
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {

    @POST("accounts/register")
    suspend fun register(@Body request: RegistrationRequest): Response<LoginResponse>

    @POST("accounts/login")
    suspend fun login(@Body request: Map<String, String>): Response<LoginResponse>

    @GET("accounts/{id}")
    suspend fun getAccountById(@Path("id") id: String): Response<Account>
}
