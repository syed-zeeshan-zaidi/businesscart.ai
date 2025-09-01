package com.businesscart.android.ui.account

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.businesscart.android.R
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.ui.login.LoginActivity
import com.businesscart.android.ui.main.CatalogActivity
import com.businesscart.android.util.SessionManager
import kotlinx.coroutines.launch

class AccountActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager

    private lateinit var nameTextView: TextView
    private lateinit var emailTextView: TextView
    private lateinit var roleTextView: TextView
    private lateinit var progressBar: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account)

        sessionManager = SessionManager(this)

        nameTextView = findViewById(R.id.nameTextView)
        emailTextView = findViewById(R.id.emailTextView)
        roleTextView = findViewById(R.id.roleTextView)
        progressBar = findViewById(R.id.progressBar)

        val logoutBtn = findViewById<Button>(R.id.logoutButton)
        logoutBtn.setOnClickListener { logout() }

        fetchAccountDetails()
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.account_menu, menu)
        return true
    }

    override fun onPrepareOptionsMenu(menu: Menu?): Boolean {
        return super.onPrepareOptionsMenu(menu)
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_catalog -> {
                startActivity(Intent(this, CatalogActivity::class.java))
                finish()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun fetchAccountDetails() {
        progressBar.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val userId = sessionManager.getUserId() ?: return@launch
                val response = RetrofitClient.apiService.getAccount(userId)
                if (response.isSuccessful) {
                    response.body()?.let {
                        nameTextView.text = "Name: ${it.name}"
                        emailTextView.text = "Email: ${it.email}"
                        roleTextView.text = "Role: ${it.role}"
                    }
                } else {
                    Toast.makeText(this@AccountActivity, "Failed to fetch account details", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@AccountActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                progressBar.visibility = View.GONE
            }
        }
    }

    private fun logout() {
        sessionManager.clearSession()
        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
