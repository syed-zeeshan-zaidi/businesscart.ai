package com.businesscart.android.ui.login

import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import com.businesscart.android.R
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.DecodedUser
import com.businesscart.android.ui.main.CatalogActivity
import com.businesscart.android.util.SessionManager
import com.auth0.android.jwt.JWT
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        sessionManager = SessionManager(this)
        RetrofitClient.initialize(this)

        if (sessionManager.getAuthToken() != null) {
            navigateToCatalog()
            return
        }

        val loginButton = findViewById<Button>(R.id.login)
        val emailEditText = findViewById<EditText>(R.id.email)
        val passwordEditText = findViewById<EditText>(R.id.password)

        loginButton.setOnClickListener {
            val email = emailEditText.text.toString().trim()
            val password = passwordEditText.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            lifecycleScope.launch {
                try {
                    val request = mapOf("email" to email, "password" to password)
                    val response = RetrofitClient.apiService.login(request)

                    if (!response.isSuccessful || response.body() == null) {
                        val errorBody = response.errorBody()?.string() ?: "Unknown error"
                        Log.e("LoginActivity", "Login failed: $errorBody")
                        Toast.makeText(this@LoginActivity, "Login failed: $errorBody", Toast.LENGTH_LONG).show()
                        return@launch
                    }

                    val loginResponse = response.body()!!
                    val decodedJWT = JWT(loginResponse.accessToken)
                    val user = decodedJWT.getClaim("user").asObject(DecodedUser::class.java)

                    if (user == null) {
                        Toast.makeText(this@LoginActivity, "Login failed: User data invalid.", Toast.LENGTH_LONG).show()
                        return@launch
                    }

                    if (user.role != "customer") {
                        Toast.makeText(this@LoginActivity, "This app is for customers only.", Toast.LENGTH_LONG).show()
                        return@launch
                    }

                    sessionManager.saveAuthToken(loginResponse.accessToken)

                    val accountResponse = RetrofitClient.apiService.getAccount(user.id)
                    if (accountResponse.isSuccessful && accountResponse.body() != null) {
                        sessionManager.saveAccount(accountResponse.body()!!)
                        navigateToCatalog()
                    } else {
                        val errorBody = accountResponse.errorBody()?.string() ?: "Could not retrieve account details."
                        Log.e("LoginActivity", "Failed to fetch account details: $errorBody")
                        Toast.makeText(this@LoginActivity, "Login failed: $errorBody", Toast.LENGTH_LONG).show()
                    }

                } catch (e: Exception) {
                    Log.e("LoginActivity", "Login failed", e)
                    Toast.makeText(this@LoginActivity, "Login failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun navigateToCatalog() {
        val intent = Intent(this, CatalogActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
    }
}