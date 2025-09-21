package com.businesscart.android.model

data class CreateQuoteRequest(
    val sellerId: String,
    val paymentMethods: List<String>,
    val deliveryMethods: List<String>,
    val shippingOutOptions: List<String>,
    val companyLocations: List<CompanyLocation>,
    val customerAddresses: List<CustomerAddress>
)

data class CreateOrderRequest(
    val quoteId: String,
    val paymentMethod: String,
    val paymentToken: String,
    val deliveryMethod: String,
    val pickupLocationId: String?,
    val deliveryAddressId: String?
)
