package com.businesscart.android.model

data class Coords(
    val lat: Double,
    val lng: Double
)

data class Address(
    val street: String,
    val city: String,
    val state: String,
    val zip: String,
    val coordinates: Coords
)

data class CompanyData(
    val name: String,
    val status: String,
    val uniqueIdentifier: String,
    val saleRepresentative: String,
    val creditLimit: Double,
    val shippingMethods: List<String>,
    val shippingOutOptions: List<String>?,
    val paymentMethods: List<String>,
    val deliveryMethods: List<String>,
    val leadTime: Double,
    val maxOrderAmountLimit: Double,
    val maxOrderQuantityLimit: Double,
    val minOrderAmountLimit: Double,
    val minOrderQuantityLimit: Double,
    val monthlyOrderLimit: Double,
    val yearlyOrderLimit: Double,
    val taxableGoods: Boolean,
    val quotesAllowed: Boolean,
    val companyCodeId: String?,
    val companyCode: String,
    val sellingArea: SellingArea,
    val address: Address
)

data class SellingArea(
    val radius: Double,
    val center: Coords
)

data class CustomerCodeEntry(
    val codeId: String,
    val customerCode: String
)

data class CustomerData(
    val customerCodes: List<CustomerCodeEntry>,
    val attachedCompanies: List<CompanyData>?
)

data class PartnerData(
    val partnerCodeId: String?,
    val partnerCode: String?,
    val status: String
)

data class Account(
    val _id: String,
    val name: String,
    val email: String,
    val role: String,
    val accountStatus: String,
    val createdAt: String,
    val updatedAt: String,
    val company: CompanyData?,
    val customer: CustomerData?,
    val partner: PartnerData?,
    val address: Address?
)

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String
)

data class RegistrationRequest(
    val name: String,
    val email: String,
    val password: String,
    val role: String,
    val code: String?, // For company
    val customerCodes: List<String>? // For customer
)

data class DecodedUser(
    val id: String,
    val email: String,
    val role: String
)

data class CompanyLocation(
    val id: String,
    val companyId: String,
    val locationName: String,
    val address: Address,
    val contactPerson: String?,
    val phoneNumber: String?,
    val operatingHours: String?,
    val capacity: String?,
    val locationType: String,
    val isDefault: Boolean,
    val createdAt: String,
    val updatedAt: String
)

data class CustomerAddress(
    val id: String,
    val customerId: String,
    val recipientName: String,
    val address: Address,
    val phoneNumber: String?,
    val addressLabel: String?,
    val isDefaultShipping: Boolean,
    val createdAt: String,
    val updatedAt: String?
)

data class NewAddressDTO(
    val recipientName: String,
    val addressLabel: String?,
    val address: Address,
    val phoneNumber: String?,
    val isDefaultShipping: Boolean
)
