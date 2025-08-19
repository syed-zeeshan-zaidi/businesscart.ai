#!/bin/bash
set -x

# =============================================================================
# Idempotent Account & Catalog Service Test
# =============================================================================

ACCOUNT_API="http://127.0.0.1:3000"
CATALOG_API="http://127.0.0.1:3001"
CHECKOUT_API="http://127.0.0.1:3002"
PASSWORD="securepassword"

# --- Static codes (only companyCode + customerCode mandatory) ----------
COMPANY_ONE_COMP_CODE="COMP-ALPHA-101"
COMPANY_ONE_CUSTOMER_CODE="CUST-ALPHA-102"
COMPANY_TWO_COMP_CODE="COMP-BETA-201"
COMPANY_TWO_CUSTOMER_CODE="CUST-BETA-202"

# --- User map ----------------------------------------------------------
declare -A USERS=(
  [admin]="admin@syed.com"
  [company1]="company-alpha@example.com"
  [company2]="company-beta@example.com"
  [customer]="customer-shared@example.com"
  [customer2]="customer-two@example.com"
)
declare -A NAMES=(
  [admin]="Admin User"
  [company1]="Alpha Corp"
  [company2]="Beta Corp"
  [customer]="Shared Customer"
  [customer2]="Second Customer"
)
declare -A ROLES=(
  [admin]="admin"
  [company1]="company"
  [company2]="company"
  [customer]="customer"
  [customer2]="customer"
)

# --- JWT Storage -------------------------------------------------------
declare -A JWTS

# --- Helper colors -----------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m'

handle_error() {
  echo -e "${RED}HTTP $2 in $1\nResponse: $3${NC}" >&2
  exit 1
}

print_step() { echo -e "\n${CYAN}### $1 ###${NC}" >&2; }

# -----------------------------------------------------------------------
# 1) Login or register user
# -----------------------------------------------------------------------
login_or_register() {
  local role_key="$1"
  local codes_str="$2"     # companyCode for company, comma-separated customerCodes for customer
  local email="${USERS[$role_key]}"
  local name="${NAMES[$role_key]}"
  local role="${ROLES[$role_key]}"

  print_step "Login or register $role_key"

  # try login
  resp=$(curl -s -w "\n%{http_code}" -X POST "$ACCOUNT_API/accounts/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")
  status=$(tail -n1 <<<"$resp")
  body=$(sed '$d' <<<"$resp")

  if [ "$status" -eq 200 ]; then
    JWTS[$role_key]=$(echo "$body" | jq -r '.accessToken')
    echo -e "${GREEN}Login OK for $role_key${NC}"
    return
  fi

  # register
  if [ "$role_key" == "admin" ]; then
    echo "Admin login failed. Attempting to register admin..."
  fi
  
  payload=$(cat <<EOF
{
  "name": "$name",
  "email": "$email",
  "password": "$PASSWORD",
  "role": "$role"
}
EOF
)

  case "$role" in
    company) 
      payload=$(echo "$payload" | jq --arg code "$codes_str" --arg company_name "$name" '. + {code: $code, companyName: $company_name}')
      ;;
    customer) 
      # Convert comma-separated string to JSON array
      codes_json=$(echo "$codes_str" | tr ',' '\n' | jq -R . | jq -s .)
      payload=$(echo "$payload" | jq --argjson codes "$codes_json" '. + {customerCodes: $codes}')
      ;;
    partner) 
      [ -n "$codes_str" ] && payload=$(echo "$payload" | jq --arg code "$codes_str" '. + {code: $code}')
      ;;
  esac

  reg_resp=$(curl -s -w "\n%{http_code}" -X POST "$ACCOUNT_API/accounts/register" \
    -H "Content-Type: application/json" \
    -d "$payload")
  reg_status=$(tail -n1 <<<"$reg_resp")
  reg_body=$(sed '$d' <<<"$reg_resp")

  [ "$reg_status" -eq 201 ] || handle_error "Register $role_key" "$reg_status" "$reg_body"
  echo -e "${GREEN}Registered $role_key${NC}"
  
  # login again to get JWT
  login_or_register "$role_key" "$codes_str"
}

# -----------------------------------------------------------------------
# 2) Admin creates codes
# -----------------------------------------------------------------------
create_codes() {
  local comp_code="$1"
  local cust_code="$2"
  local partner_code="${3:-}"

  payload=$(jq -n \
    --arg comp_code "$comp_code" \
    --arg cust_code "$cust_code" \
    '{companyCode: $comp_code, customerCode: $cust_code}')

  if [ -n "$partner_code" ]; then
    payload=$(echo "$payload" | jq --arg partner "$partner_code" '. + {partnerCode: $partner}')
  fi

  resp=$(curl -s -w "\n%{http_code}" -X POST "$ACCOUNT_API/codes" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWTS[admin]}" \
    -d "$payload")
  status=$(tail -n1 <<<"$resp")
  body=$(sed '$d' <<<"$resp")

  if [ "$status" -eq 201 ]; then
    echo -e "${GREEN}Codes created for $comp_code${NC}"
  elif [ "$status" -eq 409 ] && [[ "$body" == *"already exists"* ]]; then
    echo -e "${YELLOW}Codes already exist for $comp_code${NC}"
  else
    handle_error "Create codes for $comp_code" "$status" "$body"
  fi
}

# -----------------------------------------------------------------------
# 3) Create Product
# -----------------------------------------------------------------------
create_product() {
    local role_key="$1"
    local name="$2"
    local price="$3"
    local description="$4"

    print_step "Creating product '$name' for $role_key"

    payload=$(jq -n \
        --arg name "$name" \
        --argjson price "$price" \
        --arg description "$description" \
        '{name: $name, price: $price, description: $description}')

    resp=$(curl -s -w "\n%{http_code}" -X POST "$CATALOG_API/products" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${JWTS[$role_key]}" \
        -d "$payload")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")

    if [ "$status" -eq 201 ]; then
        echo -e "${GREEN}Product '$name' created successfully${NC}"
    else
        handle_error "Create product '$name'" "$status" "$body"
    fi
}

# -----------------------------------------------------------------------
# 4) Get Product Count
# -----------------------------------------------------------------------
get_product_count() {
    local role_key="$1"
    
    resp=$(curl -s -w "\n%{http_code}" -X GET "$CATALOG_API/products" \
        -H "Authorization: Bearer ${JWTS[$role_key]}")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")

    if [ "$status" -eq 200 ]; then
        echo "$body" | jq '. | length'
    else
        # If the request fails, assume no products
        echo "0"
    fi
}

# -----------------------------------------------------------------------
# 5) Get Products
# -----------------------------------------------------------------------
get_products() {
    local role_key="$1"
    print_step "Getting products for $role_key"

    resp=$(curl -s -w "\n%{http_code}" -X GET "$CATALOG_API/products" \
        -H "Authorization: Bearer ${JWTS[$role_key]}")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")

    if [ "$status" -eq 200 ]; then
        count=$(echo "$body" | jq '. | length')
        echo -e "${GREEN}Successfully retrieved products for $role_key. Count: $count${NC}"
        echo "Response:"
        echo "$body" | jq .
    else
        handle_error "Get products for $role_key" "$status" "$body"
    fi
}

# -----------------------------------------------------------------------
# 6) Get ID from JWT
# -----------------------------------------------------------------------
get_id_from_jwt() {
    local role_key="$1"
    echo "${JWTS[$role_key]}" | cut -d'.' -f2 | base64 --decode | jq -r '.user.id' 2>/dev/null
}

# -----------------------------------------------------------------------
# 7) Get Orders
# -----------------------------------------------------------------------
get_orders() {
    local role_key="$1"
    print_step "Getting orders for $role_key"

    resp=$(curl -s -w "\n%{http_code}" -X GET "$CHECKOUT_API/orders" \
        -H "Authorization: Bearer ${JWTS[$role_key]}")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")

    if [ "$status" -eq 200 ]; then
        count=$(echo "$body" | jq '. | length')
        echo -e "${GREEN}Successfully retrieved orders for $role_key. Count: $count${NC}"
        echo "Response:"
        echo "$body" | jq .
    else
        handle_error "Get orders for $role_key" "$status" "$body"
    fi
}

# -----------------------------------------------------------------------
# 8) Add to Cart (Create Quote)
# -----------------------------------------------------------------------
add_to_cart() {
    local role_key="$1"
    local payload="$2"
    print_step "Adding items to cart for $role_key"

    resp=$(curl -s -w "\n%{http_code}" -X POST "$CHECKOUT_API/checkout" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${JWTS[$role_key]}" \
        -d "$payload")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")

    if [ "$status" -eq 200 ]; then # Assuming 200 for quote creation/update
        echo -e "${GREEN}Add to cart successful for $role_key${NC}"
        echo "$body" | jq -r '.quoteId'
    else
        handle_error "Add to cart for $role_key" "$status" "$body"
    fi
}

# -----------------------------------------------------------------------
# 9) Get Cart (Get Quote)
# -----------------------------------------------------------------------
get_cart() {
    local role_key="$1"
    local quote_id="$2"
    print_step "Getting cart for $role_key with quoteId $quote_id"

    resp=$(curl -s -w "\n%{http_code}" -X GET "$CHECKOUT_API/checkout/$quote_id" \
        -H "Authorization: Bearer ${JWTS[$role_key]}")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")

    if [ "$status" -eq 200 ]; then
        echo -e "${GREEN}Get cart successful for $role_key${NC}"
        echo "Response:"
        echo "$body" | jq .
    else
        handle_error "Get cart for $role_key" "$status" "$body"
    fi
}


# -----------------------------------------------------------------------
# 6) Main flow
# -----------------------------------------------------------------------
print_step "Starting ACCOUNT SERVICE tests"

# admin login
login_or_register admin

# create / ensure codes
create_codes "$COMPANY_ONE_COMP_CODE" "$COMPANY_ONE_CUSTOMER_CODE"
create_codes "$COMPANY_TWO_COMP_CODE"  "$COMPANY_TWO_CUSTOMER_CODE" "PART-BETA-301"

# company users
login_or_register company1 "$COMPANY_ONE_COMP_CODE"
login_or_register company2 "$COMPANY_TWO_COMP_CODE"

# customers
login_or_register customer "$COMPANY_ONE_CUSTOMER_CODE"
login_or_register customer2 "$COMPANY_ONE_CUSTOMER_CODE,$COMPANY_TWO_CUSTOMER_CODE"

print_step "Starting CATALOG SERVICE tests"

# --- Create products for company1 if they don't exist ---
product_count1=$(get_product_count "company1")
if [ "$product_count1" -eq 0 ]; then
    print_step "No products found for company1. Creating them..."
    for i in {1..5}; do
        create_product "company1" "Alpha Product $i" "$(($i * 10)).99" "Description for Alpha Product $i"
    done
else
    print_step "Found $product_count1 products for company1. Skipping creation."
fi

# --- Create products for company2 if they don't exist ---
product_count2=$(get_product_count "company2")
if [ "$product_count2" -eq 0 ]; then
    print_step "No products found for company2. Creating them..."
    for i in {1..5}; do
        create_product "company2" "Beta Product $i" "$(($i * 12)).50" "Description for Beta Product $i"
    done
else
    print_step "Found $product_count2 products for company2. Skipping creation."
fi

# Get products for each role
get_products "admin"     # Should see 10 products
get_products "company1"  # Should see 5 products
get_products "company2"  # Should see 5 products
get_products "customer"  # Should see 5 products
get_products "customer2" # Should see 10 products

print_step "Starting CHECKOUT SERVICE tests"

# Get orders for admin and companies
get_orders "admin"
get_orders "company1"
get_orders "company2"

# Get product and company IDs for cart tests
all_products_json=$(curl -s -X GET "$CATALOG_API/products" -H "Authorization: Bearer ${JWTS[admin]}")
alpha_product_id=$(echo "$all_products_json" | jq -r '.[] | select(.name=="Alpha Product 1") | ._id')
beta_product_id=$(echo "$all_products_json" | jq -r '.[] | select(.name=="Beta Product 1") | ._id')

company1_id=$(get_id_from_jwt "company1")
company2_id=$(get_id_from_jwt "company2")

# --- Test cart for customer ---
cart_payload_customer=$(jq -n --arg product_id "$alpha_product_id" --arg company_id "$company1_id" 
  '{items: [{productId: $product_id, quantity: 1, companyId: $company_id}]}')
customer_quote_id=$(add_to_cart "customer" "$cart_payload_customer")
get_cart "customer" "$customer_quote_id"

# --- Test cart for customer2 ---
cart_payload_customer2=$(jq -n --arg p1_id "$alpha_product_id" --arg c1_id "$company1_id" --arg p2_id "$beta_product_id" --arg c2_id "$company2_id" 
  '{items: [{productId: $p1_id, quantity: 2, companyId: $c1_id}, {productId: $p2_id, quantity: 3, companyId: $c2_id}]}')
customer2_quote_id=$(add_to_cart "customer2" "$cart_payload_customer2")
get_cart "customer2" "$customer2_quote_id"


print_step "Test finished successfully"
