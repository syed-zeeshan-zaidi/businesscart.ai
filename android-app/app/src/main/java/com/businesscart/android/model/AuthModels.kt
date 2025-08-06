package com.businesscart.android.model

data class User(
    val _id: String,
    val name: String,
    val email: String,
    val role: String,
    val phoneNumber: String,
    val company_id: String?,
    val associate_company_ids: List<String>?
)

data class LoginResponse(
    val accessToken: String,
    val user: User
)

data class RegistrationRequest(
    val name: String,
    val email: String,
    val password: String,
    val role: String,
    val phoneNumber: String
)
