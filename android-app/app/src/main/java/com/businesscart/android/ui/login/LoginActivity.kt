package com.businesscart.android.ui.login

import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.databinding.ActivityLoginBinding
import com.businesscart.android.ui.registration.RegistrationActivity
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

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
                        Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT).show()
                        // TODO: Handle successful login (e.g., save token, navigate to main screen)
                    } else {
                        Toast.makeText(this@LoginActivity, "Login failed: ${response.errorBody()?.string()}", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@LoginActivity, "Login failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
