package com.businesscart.android.ui.registration

import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.databinding.ActivityRegistrationBinding
import com.businesscart.android.model.RegistrationRequest
import kotlinx.coroutines.launch

class RegistrationActivity : AppCompatActivity() {

    private lateinit var binding: ActivityRegistrationBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegistrationBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.register.setOnClickListener {
            val name = binding.name.text.toString().trim()
            val email = binding.email.text.toString().trim()
            val password = binding.password.text.toString().trim()
            val phone = binding.phone.text.toString().trim()

            if (name.isEmpty() || email.isEmpty() || password.isEmpty() || phone.isEmpty()) {
                Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val request = RegistrationRequest(name, email, password, "customer", phone)

            lifecycleScope.launch {
                try {
                    val response = RetrofitClient.apiService.register(request)
                    if (response.isSuccessful) {
                        Toast.makeText(this@RegistrationActivity, "Registration successful", Toast.LENGTH_SHORT).show()
                        // TODO: Handle successful registration (e.g., save token, navigate to main screen)
                        finish()
                    } else {
                        Toast.makeText(this@RegistrationActivity, "Registration failed: ${response.errorBody()?.string()}", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@RegistrationActivity, "Registration failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
