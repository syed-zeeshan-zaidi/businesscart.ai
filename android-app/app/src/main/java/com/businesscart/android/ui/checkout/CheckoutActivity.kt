package com.businesscart.android.ui.checkout

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.businesscart.android.R
import com.businesscart.android.model.Address
import com.businesscart.android.model.Coords
import com.businesscart.android.model.CreateOrderRequest
import com.businesscart.android.model.Quote
import com.businesscart.android.ui.checkout.viewmodel.CheckoutViewModel
import com.businesscart.android.ui.checkout.viewmodel.UiState
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class CheckoutActivity : AppCompatActivity() {

    private val viewModel: CheckoutViewModel by viewModels()

    

    // Delivery and Payment Views
    private lateinit var deliveryMethodSpinner: Spinner
    private lateinit var shippingOptionsSpinner: Spinner
    private lateinit var shippingOptionsLabel: TextView
    private lateinit var paymentMethodRadioGroup: RadioGroup
    private lateinit var deliveryAddressSpinner: Spinner
    private lateinit var deliveryAddressLabel: TextView
    private lateinit var pickupLocationSpinner: Spinner
    private lateinit var pickupLocationLabel: TextView

    // Other Views
    private lateinit var quoteSummaryTextView: TextView
    private lateinit var subtotalTextView: TextView
    private lateinit var shippingTextView: TextView
    private lateinit var taxTextView: TextView
    private lateinit var totalTextView: TextView
    private lateinit var placeOrderButton: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var quoteItemsRecyclerView: RecyclerView

    private var currentQuote: Quote? = null
    private var selectedPaymentMethod: String = ""
    private var selectedDeliveryMethod: String = ""
    private var selectedPickupLocationId: String? = null
    private var selectedDeliveryAddressId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_checkout)

        bindViews()
        placeOrderButton.isEnabled = false // Initially disable the button

        val quoteId = intent.getStringExtra("QUOTE_ID")
        if (quoteId == null) {
            Toast.makeText(this, "Quote ID missing", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        viewModel.getQuote(quoteId)

        observeViewModel()

        placeOrderButton.setOnClickListener { placeOrder() }
    }

    private fun bindViews() {
        deliveryMethodSpinner = findViewById(R.id.deliveryMethodSpinner)
        shippingOptionsSpinner = findViewById(R.id.shippingOptionsSpinner)
        shippingOptionsLabel = findViewById(R.id.shippingOptionsLabel)
        paymentMethodRadioGroup = findViewById(R.id.paymentMethodRadioGroup)
        quoteSummaryTextView = findViewById(R.id.quoteSummaryTextView)
        subtotalTextView = findViewById(R.id.subtotalTextView)
        shippingTextView = findViewById(R.id.shippingTextView)
        taxTextView = findViewById(R.id.taxTextView)
        totalTextView = findViewById(R.id.totalTextView)
        placeOrderButton = findViewById(R.id.placeOrderButton)
        progressBar = findViewById(R.id.progressBar)
        quoteItemsRecyclerView = findViewById(R.id.quoteItemsRecyclerView)
        quoteItemsRecyclerView.layoutManager = LinearLayoutManager(this)

        deliveryAddressSpinner = findViewById(R.id.deliveryAddressSpinner)
        deliveryAddressLabel = findViewById(R.id.deliveryAddressLabel)
        pickupLocationSpinner = findViewById(R.id.pickupLocationSpinner)
        pickupLocationLabel = findViewById(R.id.pickupLocationLabel)
    }

    private fun observeViewModel() {
        lifecycleScope.launch {
            viewModel.quoteState.collectLatest { state ->
                when (state) {
                    is UiState.Loading -> {
                        progressBar.visibility = View.VISIBLE
                        placeOrderButton.isEnabled = false // Disable button during quote loading
                    }
                    is UiState.Success -> {
                        progressBar.visibility = View.GONE
                        val quote = state.data
                        currentQuote = quote
                        updateOrderSummary(quote)
                        setupDeliveryAndPayment(quote)
                        checkEnablePlaceOrderButton()
                    }
                    is UiState.Error -> {
                        progressBar.visibility = View.GONE
                        Toast.makeText(this@CheckoutActivity, "Failed to load quote: ${state.message}", Toast.LENGTH_LONG).show()
                        finish()
                    }
                }
            }
        }

        lifecycleScope.launch {
            viewModel.orderState.collectLatest {
                when (it) {
                    is UiState.Loading -> {
                        progressBar.visibility = View.VISIBLE
                        placeOrderButton.isEnabled = false
                    }
                    is UiState.Success -> {
                        progressBar.visibility = View.GONE
                        currentQuote?.let { quote -> viewModel.clearCart(quote.sellerId) }
                        startActivity(Intent(this@CheckoutActivity, OrderSuccessActivity::class.java).apply {
                            putExtra("ORDER_ID", it.data.id)
                        })
                        finish()
                        checkEnablePlaceOrderButton() // Call here
                    }
                    is UiState.Error -> {
                        progressBar.visibility = View.GONE
                        Toast.makeText(this@CheckoutActivity, "Order failed: ${it.message}", Toast.LENGTH_LONG).show()
                        checkEnablePlaceOrderButton() // Call here
                    }
                }
            }
        }
    }

    private fun updateOrderSummary(quote: Quote) {
        quoteItemsRecyclerView.adapter = QuoteAdapter(quote.items)
        subtotalTextView.text = getString(R.string.price_label, quote.subtotal)
        shippingTextView.text = getString(R.string.price_label, quote.shippingCost)
        taxTextView.text = getString(R.string.price_label, quote.taxAmount)
        totalTextView.text = getString(R.string.price_label, quote.grandTotal)
        quoteSummaryTextView.text = getString(R.string.quote_summary, quote.items.size)
    }

    private fun setupDeliveryAndPayment(quote: Quote) {
        // Delivery Method Spinner
        val deliveryAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, quote.availableDeliveryMethods)
        deliveryAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        deliveryMethodSpinner.adapter = deliveryAdapter

        // Delivery Address Spinner
        val addressAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, quote.customerAddresses?.map { "${it.addressLabel ?: it.recipientName}: ${it.address.street}" } ?: listOf())
        addressAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        deliveryAddressSpinner.adapter = addressAdapter

        // Pickup Location Spinner
        val locationAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, quote.companyLocations?.map { "${it.locationName} - ${it.address.street}" } ?: listOf())
        locationAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        pickupLocationSpinner.adapter = locationAdapter

        deliveryMethodSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                selectedDeliveryMethod = quote.availableDeliveryMethods[position]
                updateUiForDeliveryMethod(selectedDeliveryMethod)
                updatePaymentMethods(quote.availablePaymentMethods)
                checkEnablePlaceOrderButton()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        deliveryAddressSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                selectedDeliveryAddressId = quote.customerAddresses?.get(position)?.id
                checkEnablePlaceOrderButton()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) { selectedDeliveryAddressId = null }
        }

        pickupLocationSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                selectedPickupLocationId = quote.companyLocations?.get(position)?.id
                checkEnablePlaceOrderButton()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) { selectedPickupLocationId = null }
        }

        paymentMethodRadioGroup.setOnCheckedChangeListener { _, checkedId ->
            findViewById<RadioButton>(checkedId)?.let { selectedPaymentMethod = it.tag as String }
            checkEnablePlaceOrderButton()
        }
    }

    private fun updateUiForDeliveryMethod(method: String) {
        if (method == "pickup") {
            deliveryAddressLabel.visibility = View.GONE
            deliveryAddressSpinner.visibility = View.GONE
            pickupLocationLabel.visibility = View.VISIBLE
            pickupLocationSpinner.visibility = View.VISIBLE
            shippingOptionsLabel.visibility = View.GONE
            shippingOptionsSpinner.visibility = View.GONE
        } else {
            deliveryAddressLabel.visibility = View.VISIBLE
            deliveryAddressSpinner.visibility = View.VISIBLE
            pickupLocationLabel.visibility = View.GONE
            pickupLocationSpinner.visibility = View.GONE
            if (method == "shipping_out") {
                shippingOptionsLabel.visibility = View.VISIBLE
                shippingOptionsSpinner.visibility = View.VISIBLE
                val shippingAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, currentQuote?.availableShippingOutOptions ?: listOf())
                shippingAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                shippingOptionsSpinner.adapter = shippingAdapter
            } else {
                shippingOptionsLabel.visibility = View.GONE
                shippingOptionsSpinner.visibility = View.GONE
            }
        }
    }

    private fun updatePaymentMethods(availableMethods: List<String>) {
        paymentMethodRadioGroup.removeAllViews()
        val filteredMethods = if (selectedDeliveryMethod != "pickup") availableMethods.filter { it != "pickup_pay" } else availableMethods

        filteredMethods.forEach { pm ->
            val rb = RadioButton(this).apply {
                text = pm.replace('_', ' ').replaceFirstChar { it.uppercase() }
                tag = pm
                layoutParams = RadioGroup.LayoutParams(RadioGroup.LayoutParams.MATCH_PARENT, RadioGroup.LayoutParams.WRAP_CONTENT)
            }
            paymentMethodRadioGroup.addView(rb)
        }

        if (filteredMethods.isNotEmpty()) {
            (paymentMethodRadioGroup.getChildAt(0) as? RadioButton)?.isChecked = true
        } else {
            selectedPaymentMethod = ""
        }
    }

    private fun placeOrder() {
        val quote = currentQuote ?: return
        val token = when (selectedPaymentMethod) {
            "stripe" -> "tok_stripe_valid"
            "amazon_pay" -> "amz_pay_valid"
            else -> "offline_payment"
        }

        val request = CreateOrderRequest(
            quoteId = quote.id,
            paymentMethod = selectedPaymentMethod,
            paymentToken = token,
            deliveryMethod = selectedDeliveryMethod,
            deliveryAddressId = if (selectedDeliveryMethod != "pickup") selectedDeliveryAddressId else null,
            pickupLocationId = if (selectedDeliveryMethod == "pickup") selectedPickupLocationId else null
        )

        viewModel.createOrder(request)
    }

    private fun checkEnablePlaceOrderButton() {
        val isQuoteLoaded = currentQuote != null
        val isPaymentMethodSelected = selectedPaymentMethod.isNotEmpty()
        val isDeliveryMethodSelected = selectedDeliveryMethod.isNotEmpty()
        val isLocationSelected = if (selectedDeliveryMethod == "pickup") selectedPickupLocationId != null else selectedDeliveryAddressId != null

        placeOrderButton.isEnabled = isQuoteLoaded && isPaymentMethodSelected && isDeliveryMethodSelected && isLocationSelected
    }
}