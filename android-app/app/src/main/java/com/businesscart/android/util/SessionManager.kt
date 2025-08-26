package com.businesscart.android.util

import android.content.Context
import android.content.SharedPreferences
import com.businesscart.android.model.Account
import com.google.gson.Gson

class SessionManager(context: Context) {

    private val sharedPreferences: SharedPreferences = context.getSharedPreferences(
        "secret_shared_prefs",
        Context.MODE_PRIVATE
    )

    private val gson = Gson()

    fun saveAuthToken(token: String) {
        val editor = sharedPreferences.edit()
        editor.putString("auth_token", token)
        editor.apply()
    }

    fun getAuthToken(): String? {
        return sharedPreferences.getString("auth_token", null)
    }

    fun saveAccount(account: Account) {
        val accountJson = gson.toJson(account)
        val editor = sharedPreferences.edit()
        editor.putString("account", accountJson)
        editor.apply()
    }

    fun getAccount(): Account? {
        val accountJson = sharedPreferences.getString("account", null)
        return gson.fromJson(accountJson, Account::class.java)
    }

    fun clearSession() {
        val editor = sharedPreferences.edit()
        editor.clear()
        editor.apply()
    }
}
