package com.businesscart.android

import android.app.Application
import com.businesscart.android.api.RetrofitClient

class BusinessCartApp : Application() {
    override fun onCreate() {
        super.onCreate()
        RetrofitClient.initialize(this)
    }
}
