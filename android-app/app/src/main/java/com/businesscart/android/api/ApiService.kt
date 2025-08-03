package com.businesscart.android.api

import com.businesscart.android.model.LoginResponse
import com.businesscart.android.model.RegistrationRequest
import com.businesscart.android.model.User
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface ApiService {

    @POST("users/register")
    suspend fun register(@Body request: RegistrationRequest): Response<LoginResponse>

    @POST("users/login")
    suspend fun login(@Body request: Map<String, String>): Response<LoginResponse>
}
