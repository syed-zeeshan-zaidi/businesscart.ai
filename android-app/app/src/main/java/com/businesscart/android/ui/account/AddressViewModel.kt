package com.businesscart.android.ui.account

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.businesscart.android.api.RetrofitClient
import com.businesscart.android.model.CustomerAddress
import com.businesscart.android.model.NewAddressDTO
import kotlinx.coroutines.launch

class AddressViewModel : ViewModel() {

    private val _addresses = MutableLiveData<List<CustomerAddress>>()
    val addresses: LiveData<List<CustomerAddress>> = _addresses

    private val _error = MutableLiveData<String>()
    val error: LiveData<String> = _error

    fun getAddresses(accountId: String) {
        viewModelScope.launch {
            try {
                val response = RetrofitClient.apiService.getCustomerAddresses(accountId)
                if (response.isSuccessful) {
                    _addresses.value = response.body()
                } else {
                    _error.value = "Failed to fetch addresses"
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    /* ----------  FULL-OBJECT EDIT  ---------- */
    fun upsertAddress(accountId: String, address: CustomerAddress) {
        viewModelScope.launch {
            try {
                val response = RetrofitClient.apiService.upsertCustomerAddress(accountId, address)
                if (response.isSuccessful) {
                    getAddresses(accountId)      // <-- refresh immediately
                } else {
                    _error.value = "Failed to save address"
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    /* ----------  SLIM DTO INSERT  ---------- */
    fun upsertAddressSlim(accountId: String, dto: NewAddressDTO) {
        viewModelScope.launch {
            try {
                val response = RetrofitClient.apiService.upsertCustomerAddressSlim(accountId, dto)
                if (response.isSuccessful) {
                    getAddresses(accountId)      // <-- refresh immediately
                } else {
                    _error.value = "Failed to save address"
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    /* ----------  DELETE  ---------- */
    fun deleteAddress(accountId: String, addressId: String) {
        viewModelScope.launch {
            try {
                val response = RetrofitClient.apiService.deleteCustomerAddress(accountId, addressId)
                if (response.isSuccessful) {
                    getAddresses(accountId)      // <-- refresh immediately
                } else {
                    _error.value = "Failed to delete address"
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }
}