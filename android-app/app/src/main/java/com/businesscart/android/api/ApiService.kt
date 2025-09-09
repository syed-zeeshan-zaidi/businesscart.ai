package com.businesscart.android.api

import com.businesscart.android.model.LoginResponse
import com.businesscart.android.model.RegistrationRequest
import com.businesscart.android.model.Account
import com.businesscart.android.model.CustomerAddress
import com.businesscart.android.model.NewAddressDTO
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.DELETE

interface ApiService {

    @POST("accounts/register")
    suspend fun register(@Body request: RegistrationRequest): Response<LoginResponse>

    @POST("accounts/login")
    suspend fun login(@Body request: Map<String, String>): Response<LoginResponse>

    @GET("accounts/{id}")
    suspend fun getAccount(@Path("id") id: String): Response<Account>

    @GET("accounts/locations/{accountId}")
    suspend fun getCustomerAddresses(@Path("accountId") accountId: String): Response<List<CustomerAddress>>

    @POST("accounts/locations/{accountId}")
    suspend fun upsertCustomerAddress(@Path("accountId") accountId: String, @Body address: CustomerAddress): Response<CustomerAddress>

    @POST("accounts/locations/{accountId}")
    suspend fun upsertCustomerAddressSlim(@Path("accountId") accountId: String,@Body dto: NewAddressDTO): Response<Unit>

    @DELETE("accounts/locations/{accountId}/{locationId}")
    suspend fun deleteCustomerAddress(@Path("accountId") accountId: String, @Path("locationId") locationId: String): Response<Unit>
}
