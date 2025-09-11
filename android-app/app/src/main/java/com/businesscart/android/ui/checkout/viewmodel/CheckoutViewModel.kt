package com.businesscart.android.ui.checkout.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.CreateOrderRequest
import com.businesscart.android.model.Order
import com.businesscart.android.model.Quote
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<out T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}

class CheckoutViewModel : ViewModel() {

    private val _quoteState = MutableStateFlow<UiState<Quote>>(UiState.Loading)
    val quoteState: StateFlow<UiState<Quote>> = _quoteState

    private val _orderState = MutableStateFlow<UiState<Order>>(UiState.Loading)
    val orderState: StateFlow<UiState<Order>> = _orderState

    fun getQuote(quoteId: String) {
        viewModelScope.launch {
            _quoteState.value = UiState.Loading
            try {
                val response = RetrofitClient.checkoutApiService.getQuote(quoteId)
                if (response.isSuccessful) {
                    response.body()?.let {
                        _quoteState.value = UiState.Success(it)
                    } ?: run {
                        _quoteState.value = UiState.Error("Empty quote response")
                    }
                } else {
                    _quoteState.value = UiState.Error(response.errorBody()?.string() ?: "Failed to fetch quote")
                }
            } catch (e: Exception) {
                _quoteState.value = UiState.Error(e.message ?: "An unexpected error occurred")
            }
        }
    }

    fun createOrder(request: CreateOrderRequest) {
        viewModelScope.launch {
            _orderState.value = UiState.Loading
            try {
                val response = RetrofitClient.checkoutApiService.createOrder(request)
                if (response.isSuccessful) {
                    response.body()?.let {
                        _orderState.value = UiState.Success(it)
                    } ?: run {
                        _orderState.value = UiState.Error("Empty response body")
                    }
                } else {
                    _orderState.value = UiState.Error(response.errorBody()?.string() ?: "Unknown error")
                }
            } catch (e: Exception) {
                _orderState.value = UiState.Error(e.message ?: "An unexpected error occurred")
            }
        }
    }

    fun clearCart(sellerId: String) {
        viewModelScope.launch {
            try {
                RetrofitClient.checkoutApiService.clearCart(sellerId)
            } catch (e: Exception) {
                // Log or handle error, but don't block the user
            }
        }
    }
}