package com.businesscart.android.api

import com.businesscart.android.model.Company
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header

interface CompanyApiService {
    @GET("companies")
    suspend fun getCompanies(@Header("Authorization") token: String): Response<List<Company>>
}
