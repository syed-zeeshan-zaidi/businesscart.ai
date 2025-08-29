package com.businesscart.android.api

import android.content.Context
import com.businesscart.android.util.SessionManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private const val BASE_URL_ACCOUNT = "http://10.0.2.2:3000/"
    private const val BASE_URL_CATALOG = "http://10.0.2.2:3001/"
    private const val BASE_URL_CHECKOUT = "http://10.0.2.2:3002/"

    private lateinit var sessionManager: SessionManager

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val authInterceptor = { chain: okhttp3.Interceptor.Chain ->
        val requestBuilder = chain.request().newBuilder()
        sessionManager.getAuthToken()?.let {
            requestBuilder.addHeader("Authorization", "Bearer $it")
        }
        chain.proceed(requestBuilder.build())
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .addInterceptor(authInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofitAccount: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL_ACCOUNT)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    private val retrofitCatalog: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL_CATALOG)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    private val retrofitCheckout: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL_CHECKOUT)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val apiService: ApiService by lazy {
        retrofitAccount.create(ApiService::class.java)
    }

    val productApiService: ProductApiService by lazy {
        retrofitCatalog.create(ProductApiService::class.java)
    }

    val checkoutApiService: CheckoutApiService by lazy {
        retrofitCheckout.create(CheckoutApiService::class.java)
    }

    fun initialize(context: Context) {
        sessionManager = SessionManager(context)
    }
}
