package com.businesscart.android.ui.login

import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.databinding.ActivityLoginBinding
import com.businesscart.android.ui.main.MainActivity
import com.businesscart.android.ui.registration.RegistrationActivity
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SessionManager(this)

        // Check if user is already logged in
        if (sessionManager.getAuthToken() != null) {
            navigateToMain()
            return
        }

        binding.register.setOnClickListener {
            startActivity(Intent(this, RegistrationActivity::class.java))
        }

        binding.login.setOnClickListener {
            val email = binding.email.text.toString().trim()
            val password = binding.password.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val request = mapOf("email" to email, "password" to password)

            lifecycleScope.launch {
                try {
                    val response = RetrofitClient.apiService.login(request)
                    if (response.isSuccessful) {
                        response.body()?.accessToken?.let { token ->
                            sessionManager.saveAuthToken(token)
                            navigateToMain()
                        }
                    } else {
                        val errorBody = response.errorBody()?.string()
                        Log.e("LoginActivity", "Login failed: $errorBody")
                        Toast.makeText(this@LoginActivity, "Login failed: $errorBody", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    Log.e("LoginActivity", "Login failed", e)
                    Toast.makeText(this@LoginActivity, "Login failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
    }
}
