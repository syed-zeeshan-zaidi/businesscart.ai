#!/bin/bash

# Configuration
USER_API="http://127.0.0.1:3000"
COMPANY_API="http://127.0.0.1:3001"
PRODUCT_API="http://127.0.0.1:3002"
ORDER_API="http://127.0.0.1:3003"
CART_API="http://127.0.0.1:3004"
PASSWORD="securepassword"
PHONE_NUMBER="1234567890"

# User configurations
declare -A USERS=(
  ["admin"]="admin@example.com"
  ["company1"]="company1@example.com"
  ["company2"]="company2@example.com"
  ["customer"]="customer@example.com"
)
declare -A NAMES=(
  ["admin"]="Admin User"
  ["company1"]="Company User 1"
  ["company2"]="Company User 2"
  ["customer"]="Customer User"
)
declare -A ROLES=(
  ["admin"]="admin"
  ["company1"]="company"
  ["company2"]="company"
  ["customer"]="customer"
)
declare -A JWTS
declare -A USER_IDS

# Company IDs (These will be created dynamically by the script)
declare -A COMPANY_IDS_MAP

# Product IDs (These will be created dynamically by the script)
declare -A PRODUCT_IDS_MAP

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to check if jq is installed
check_jq() {
  if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install jq to parse JSON responses.${NC}"
    echo "On Ubuntu: sudo apt-get install jq"
    exit 1
  fi
}

# Function to handle API errors
handle_error() {
  local response="$1"
  local step="$2"
  local status="$3"
  local message=$(echo "$response" | jq -r '.message // "Unknown error"')
  if [ "$status" -ge 400 ]; then
    echo -e "${RED}Error in $step: HTTP $status - $message${NC}"
    echo "Response: $response"
    exit 1
  fi
}

# Function to login or register user
login_or_register() {
  local role="$1"
  local email="${USERS[$role]}"
  local name="${NAMES[$role]}"
  local user_role="${ROLES[$role]}"

  echo "1. Attempting to login $role user ($email)..."
  LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$USER_API/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")
  LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | tail -n1)
  LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed -e '$d')

  if [ "$LOGIN_STATUS" -eq 200 ]; then
    echo "$LOGIN_BODY" | jq .
    JWTS[$role]=$(echo "$LOGIN_BODY" | jq -r '.accessToken // empty')
    if [ -z "${JWTS[$role]}" ]; then
      echo -e "${RED}Error: Failed to extract JWT from login response for $role${NC}"
      exit 1
    fi
    echo -e "${GREEN}Login successful for $role. JWT: ${JWTS[$role]}${NC}"
  else
    echo -e "${RED}Login failed for $role (HTTP $LOGIN_STATUS). Attempting to register...${NC}"
    REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$USER_API/users/register" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$PASSWORD\",\"role\":\"$user_role\",\"phoneNumber\":\"$PHONE_NUMBER\"}")
    REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | tail -n1)
    REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | sed -e '$d')
    echo "$REGISTER_BODY" | jq .
    handle_error "$REGISTER_BODY" "$role User Registration" "$REGISTER_STATUS"
    JWTS[$role]=$(echo "$REGISTER_BODY" | jq -r '.accessToken // empty')
    if [ -z "${JWTS[$role]}" ]; then
      echo -e "${RED}Error: Failed to extract JWT from registration response for $role${NC}"
      exit 1
    fi
    echo -e "${GREEN}$role user registered successfully. JWT: ${JWTS[$role]}${NC}"
  fi

  # Extract USER_ID from JWT
  USER_IDS[$role]=$(echo "${JWTS[$role]}" | awk -F. '{print $2}' | base64 -d 2>/dev/null | jq -r '.user.id // empty')
  if [ -z "${USER_IDS[$role]}" ]; then
    echo -e "${RED}Error: Failed to extract user ID from JWT for $role${NC}"
    exit 1
  fi
  echo "$role User ID: ${USER_IDS[$role]}"
}

# Function to update user's associated company IDs
update_user_associated_companies() {
  local user_id="$1"
  local company_ids_json="$2"
  local admin_jwt="$3"

  echo "Updating user $user_id with associated companies: $company_ids_json..."
  UPDATE_USER_RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$USER_API/users/$user_id" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $admin_jwt" \
    -d "{\"associate_company_ids\": $company_ids_json}")
  UPDATE_USER_STATUS=$(echo "$UPDATE_USER_RESPONSE" | tail -n1)
  UPDATE_USER_BODY=$(echo "$UPDATE_USER_RESPONSE" | sed -e '$d')
  echo "$UPDATE_USER_BODY" | jq .
  handle_error "$UPDATE_USER_BODY" "Update User Associated Companies" "$UPDATE_USER_STATUS"
  echo -e "${GREEN}User $user_id updated with associated companies.${NC}"
}



# Function to create a company
create_company() {
  local company_name="$1"
  local company_code="$2"
  local company_idx="$3"
  local company_user_role="$4"

  echo "Creating company $company_name..."
  CREATE_COMPANY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$COMPANY_API/companies" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWTS[$company_user_role]}" \
    -d "{
      \"name\": \"$company_name\",
      \"companyCode\": \"$company_code\",
      \"paymentMethods\": [\"cash\", \"credit_card\"],
      \"address\": {
        \"street\": \"123 Main St\",
        \"city\": \"Anytown\",
        \"state\": \"CA\",
        \"zip\": \"12345\",
        \"coordinates\": {
          \"lat\": 37.7749,
          \"lng\": -122.4194
        }
      },
      \"sellingArea\": {
        \"radius\": 10,
        \"center\": {
          \"lat\": 37.7749,
          \"lng\": -122.4194
        }
      }
    }")
  CREATE_COMPANY_STATUS=$(echo "$CREATE_COMPANY_RESPONSE" | tail -n1)
  CREATE_COMPANY_BODY=$(echo "$CREATE_COMPANY_RESPONSE" | sed -e '$d')
  echo "$CREATE_COMPANY_BODY" | jq .
  handle_error "$CREATE_COMPANY_BODY" "Create Company $company_name" "$CREATE_COMPANY_STATUS"
  COMPANY_IDS_MAP[$company_idx]=$(echo "$CREATE_COMPANY_BODY" | jq -r '._id // .id // empty')
  if [ -z "${COMPANY_IDS_MAP[$company_idx]}" ]; then
    echo -e "${RED}Error: Failed to extract company ID for $company_name${NC}"
    exit 1
  fi
  echo -e "${GREEN}$company_name created successfully. Company ID: ${COMPANY_IDS_MAP[$company_idx]}${NC}"
}

# Function to get or create a company
get_or_create_company() {
  local company_name="$1"
  local company_code="$2"
  local company_idx="$3"
  local company_user_role="$4"

  echo "Checking for existing company for user $company_user_role..."
  GET_COMPANY_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$COMPANY_API/companies" \
    -H "Authorization: Bearer ${JWTS[$company_user_role]}")
  GET_COMPANY_STATUS=$(echo "$GET_COMPANY_RESPONSE" | tail -n1)
  GET_COMPANY_BODY=$(echo "$GET_COMPANY_RESPONSE" | sed -e '$d')

  if [ "$GET_COMPANY_STATUS" -eq 200 ]; then
    COMPANY_ID=$(echo "$GET_COMPANY_BODY" | jq -r --arg user_id "${USER_IDS[$company_user_role]}" '.[] | select(.userId == $user_id) | ._id // .id // empty')
    if [ -n "$COMPANY_ID" ]; then
      COMPANY_IDS_MAP[$company_idx]=$COMPANY_ID
      echo -e "${GREEN}Reused company for $company_user_role (code: $company_code). Company ID: ${COMPANY_IDS_MAP[$company_idx]}${NC}"
    else
      echo "Company not found for user $company_user_role. Creating..."
      create_company "$company_name" "$company_code" "$company_idx" "$company_user_role"
    fi
  else
    echo "Error checking for company, creating a new one..."
    create_company "$company_name" "$company_code" "$company_idx" "$company_user_role"
  fi
}

# Function to create a product
create_product() {
  local product_name="$1"
  local company_id="$2"
  local product_idx="$3"
  local company_user_role="$4"

  echo "Creating product $product_name for company $company_id..."
  CREATE_PRODUCT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$PRODUCT_API/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWTS[$company_user_role]}" \
    -d "{\"name\":\"$product_name\",\"price\":49.99,\"companyId\":\"$company_id\",\"description\":\"A cool $product_name\"}")
  CREATE_PRODUCT_STATUS=$(echo "$CREATE_PRODUCT_RESPONSE" | tail -n1)
  CREATE_PRODUCT_BODY=$(echo "$CREATE_PRODUCT_RESPONSE" | sed -e '$d')
  echo "$CREATE_PRODUCT_BODY" | jq .
  handle_error "$CREATE_PRODUCT_BODY" "Create Product $product_name" "$CREATE_PRODUCT_STATUS"
  PRODUCT_IDS_MAP[$product_idx]=$(echo "$CREATE_PRODUCT_BODY" | jq -r '._id // .id // empty')
  if [ -z "${PRODUCT_IDS_MAP[$product_idx]}" ]; then
    echo -e "${RED}Error: Failed to extract product ID for $product_name${NC}"
    exit 1
  fi
  echo -e "${GREEN}Product $product_name created successfully. Product ID: ${PRODUCT_IDS_MAP[$product_idx]}${NC}"
}

# Function to get or create a product
get_or_create_product() {
  local product_name="$1"
  local company_id="$2"
  local product_idx="$3"
  local company_user_role="$4"

  echo "Checking for existing product $product_name..."
  GET_PRODUCT_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$PRODUCT_API/products" \
    -H "Authorization: Bearer ${JWTS[$company_user_role]}")
  GET_PRODUCT_STATUS=$(echo "$GET_PRODUCT_RESPONSE" | tail -n1)
  GET_PRODUCT_BODY=$(echo "$GET_PRODUCT_RESPONSE" | sed -e '$d')

  if [ "$GET_PRODUCT_STATUS" -eq 200 ]; then
    PRODUCT_ID=$(echo "$GET_PRODUCT_BODY" | jq -r --arg name "$product_name" '.[] | select(.name == $name) | ._id // .id // empty' | head -n 1)
    if [ -n "$PRODUCT_ID" ]; then
      PRODUCT_IDS_MAP[$product_idx]=$PRODUCT_ID
      echo -e "${GREEN}Reused product $product_name. Product ID: ${PRODUCT_IDS_MAP[$product_idx]}${NC}"
    else
      echo "Product not found, creating a new one..."
      create_product "$product_name" "$company_id" "$product_idx" "$company_user_role"
    fi
  else
    echo "Error checking for product, creating a new one..."
    create_product "$product_name" "$company_id" "$product_idx" "$company_user_role"
  fi
}

# Function to associate a customer with a company


associate_customer() {
  local company_id="$1"
  local company_user_role="$2"

  echo "Associating customer ${USER_IDS[customer]} with company $company_id..."
  ASSOCIATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$COMPANY_API/companies/$company_id/customers" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWTS[$company_user_role]}" \
    -d "{\"customerId\":\"${USER_IDS[customer]}\"}")
  ASSOCIATE_STATUS=$(echo "$ASSOCIATE_RESPONSE" | tail -n1)
  ASSOCIATE_BODY=$(echo "$ASSOCIATE_RESPONSE" | sed -e '$d')
  echo "$ASSOCIATE_BODY" | jq .
  handle_error "$ASSOCIATE_BODY" "Associate Customer with Company $company_id" "$ASSOCIATE_STATUS"
  echo -e "${GREEN}Customer associated successfully with company $company_id${NC}"
}

# Check for jq
check_jq


echo "Starting API test chain for customer user..."

# Login/Register Company User (needed for creating companies and products)
echo "=== Setting up Company Users for initial data ==="
login_or_register "company1"
login_or_register "company2"
login_or_register "admin"

# Create two companies
get_or_create_company "Test Company 1" "CODE1" "1" "company1"
get_or_create_company "Test Company 2" "CODE2" "2" "company2"

# Create products for each company
get_or_create_product "Product A1" "${COMPANY_IDS_MAP[1]}" "A1" "company1"
get_or_create_product "Product A2" "${COMPANY_IDS_MAP[1]}" "A2" "company1"
get_or_create_product "Product B1" "${COMPANY_IDS_MAP[2]}" "B1" "company2"


# Process Customer User
echo "=== Testing Customer User ==="
login_or_register "customer"

# Associate customer with both companies
echo "=== Associating Customer with Companies ==="

# Associate customer with Company 1
ASSOCIATE_RESPONSE_1=$(curl -s -w "\n%{http_code}" -X POST "$USER_API/users/associate-company" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWTS[customer]}" \
  -d "{\"companyId\":\"${COMPANY_IDS_MAP[1]}\"}")
ASSOCIATE_STATUS_1=$(echo "$ASSOCIATE_RESPONSE_1" | tail -n1)
ASSOCIATE_BODY_1=$(echo "$ASSOCIATE_RESPONSE_1" | sed -e '$d')
echo "$ASSOCIATE_BODY_1" | jq .
handle_error "$ASSOCIATE_BODY_1" "Associate Customer with Company 1" "$ASSOCIATE_STATUS_1"

# Associate customer with Company 2
ASSOCIATE_RESPONSE_2=$(curl -s -w "\n%{http_code}" -X POST "$USER_API/users/associate-company" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWTS[customer]}" \
  -d "{\"companyId\":\"${COMPANY_IDS_MAP[2]}\"}")
ASSOCIATE_STATUS_2=$(echo "$ASSOCIATE_RESPONSE_2" | tail -n1)
ASSOCIATE_BODY_2=$(echo "$ASSOCIATE_RESPONSE_2" | sed -e '$d')
echo "$ASSOCIATE_BODY_2" | jq .
handle_error "$ASSOCIATE_BODY_2" "Associate Customer with Company 2" "$ASSOCIATE_STATUS_2"

# Step 1: Add item to cart for Company 1
echo "1. Adding item (${PRODUCT_IDS_MAP[A1]}) to cart for Company 1 (${COMPANY_IDS_MAP[1]})..."
ADD_CART_ITEM_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$CART_API/cart" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWTS[customer]}" \
  -d "{\"entity\":{\"productId\":\"${PRODUCT_IDS_MAP[A1]}\",\"quantity\":1,\"companyId\":\"${COMPANY_IDS_MAP[1]}\",\"name\":\"Product A1\",\"price\":49.99}}")
ADD_CART_ITEM_STATUS=$(echo "$ADD_CART_ITEM_RESPONSE" | tail -n1)
ADD_CART_ITEM_BODY=$(echo "$ADD_CART_ITEM_RESPONSE" | sed -e '$d')
echo "$ADD_CART_ITEM_BODY" | jq .
handle_error "$ADD_CART_ITEM_BODY" "Add Cart Item for Company 1" "$ADD_CART_ITEM_STATUS"
CART_ITEM_ID_A1=$(echo "$ADD_CART_ITEM_BODY" | jq -r '.items[0]._id // empty')
echo -e "${GREEN}Item added to cart for Company 1. Cart Item ID: $CART_ITEM_ID_A1${NC}"

# Step 2: Add another item to the same cart (Company 1)
echo "2. Adding another item (${PRODUCT_IDS_MAP[A2]}) to cart for Company 1 (${COMPANY_IDS_MAP[1]})..."
ADD_CART_ITEM_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$CART_API/cart" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWTS[customer]}" \
  -d "{\"entity\":{\"productId\":\"${PRODUCT_IDS_MAP[A2]}\",\"quantity\":2,\"companyId\":\"${COMPANY_IDS_MAP[1]}\",\"name\":\"Product A2\",\"price\":49.99}}")
ADD_CART_ITEM_STATUS=$(echo "$ADD_CART_ITEM_RESPONSE" | tail -n1)
ADD_CART_ITEM_BODY=$(echo "$ADD_CART_ITEM_RESPONSE" | sed -e '$d')
echo "$ADD_CART_ITEM_BODY" | jq .
handle_error "$ADD_CART_ITEM_BODY" "Add Another Cart Item for Company 1" "$ADD_CART_ITEM_STATUS"

# Step 3: Add item to cart for Company 2
echo "3. Adding item (${PRODUCT_IDS_MAP[B1]}) to cart for Company 2 (${COMPANY_IDS_MAP[2]})..."
ADD_CART_ITEM_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$CART_API/cart" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWTS[customer]}" \
  -d "{\"entity\":{\"productId\":\"${PRODUCT_IDS_MAP[B1]}\",\"quantity\":1,\"companyId\":\"${COMPANY_IDS_MAP[2]}\",\"name\":\"Product B1\",\"price\":49.99}}")
ADD_CART_ITEM_STATUS=$(echo "$ADD_CART_ITEM_RESPONSE" | tail -n1)
ADD_CART_ITEM_BODY=$(echo "$ADD_CART_ITEM_RESPONSE" | sed -e '$d')
echo "$ADD_CART_ITEM_BODY" | jq .
handle_error "$ADD_CART_ITEM_BODY" "Add Cart Item for Company 2" "$ADD_CART_ITEM_STATUS"
CART_ITEM_ID_B1=$(echo "$ADD_CART_ITEM_BODY" | jq -r '.items[0]._id // empty')
echo -e "${GREEN}Item added to cart for Company 2. Cart Item ID: $CART_ITEM_ID_B1${NC}"

# Step 4: Get Cart for Company 1
echo "4. Getting cart for Company 1 (${COMPANY_IDS_MAP[1]})..."
GET_CART_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$CART_API/cart?companyId=${COMPANY_IDS_MAP[1]}" \
  -H "Authorization: Bearer ${JWTS[customer]}")
GET_CART_STATUS=$(echo "$GET_CART_RESPONSE" | tail -n1)
GET_CART_BODY=$(echo "$GET_CART_RESPONSE" | sed -e '$d')
echo "$GET_CART_BODY" | jq .
handle_error "$GET_CART_BODY" "Get Cart for Company 1" "$GET_CART_STATUS"

# Step 5: Get Cart for Company 2
echo "5. Getting cart for Company 2 (${COMPANY_IDS_MAP[2]})..."
GET_CART_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$CART_API/cart?companyId=${COMPANY_IDS_MAP[2]}" \
  -H "Authorization: Bearer ${JWTS[customer]}")
GET_CART_STATUS=$(echo "$GET_CART_RESPONSE" | tail -n1)
GET_CART_BODY=$(echo "$GET_CART_RESPONSE" | sed -e '$d')
echo "$GET_CART_BODY" | jq .
handle_error "$GET_CART_BODY" "Get Cart for Company 2" "$GET_CART_STATUS"

# Step 6: Update Quantity of an Item in Company 1's Cart
echo "6. Updating quantity of item ($CART_ITEM_ID_A1) in Company 1's cart..."
UPDATE_CART_ITEM_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$CART_API/cart/$CART_ITEM_ID_A1?companyId=${COMPANY_IDS_MAP[1]}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWTS[customer]}" \
  -d "{\"entity\":{\"quantity\":5}}")
UPDATE_CART_ITEM_STATUS=$(echo "$UPDATE_CART_ITEM_RESPONSE" | tail -n1)
UPDATE_CART_ITEM_BODY=$(echo "$UPDATE_CART_ITEM_RESPONSE" | sed -e '$d')
echo "$UPDATE_CART_ITEM_BODY" | jq .
handle_error "$UPDATE_CART_ITEM_BODY" "Update Cart Item for Company 1" "$UPDATE_CART_ITEM_STATUS"

# Step 7: Remove an Item from Company 1's Cart
echo "7. Removing item ($CART_ITEM_ID_A1) from Company 1's cart..."
REMOVE_CART_ITEM_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$CART_API/cart/$CART_ITEM_ID_A1?companyId=${COMPANY_IDS_MAP[1]}" \
  -H "Authorization: Bearer ${JWTS[customer]}")
REMOVE_CART_ITEM_STATUS=$(echo "$REMOVE_CART_ITEM_RESPONSE" | tail -n1)
REMOVE_CART_ITEM_BODY=$(echo "$REMOVE_CART_ITEM_RESPONSE" | sed -e '$d')
echo "$REMOVE_CART_ITEM_BODY" | jq .
handle_error "$REMOVE_CART_ITEM_BODY" "Remove Cart Item for Company 1" "$REMOVE_CART_ITEM_STATUS"

# Step 8: Clear Company 2's Cart
echo "8. Clearing cart for Company 2 (${COMPANY_IDS_MAP[2]})..."
CLEAR_CART_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$CART_API/cart?companyId=${COMPANY_IDS_MAP[2]}" \
  -H "Authorization: Bearer ${JWTS[customer]}")
CLEAR_CART_STATUS=$(echo "$CLEAR_CART_RESPONSE" | tail -n1)
CLEAR_CART_BODY=$(echo "$CLEAR_CART_RESPONSE" | sed -e '$d')
echo "$CLEAR_CART_BODY" | jq .
handle_error "$CLEAR_CART_BODY" "Clear Cart for Company 2" "$CLEAR_CART_STATUS"

echo -e "${GREEN}All API tests for customer user completed successfully!${NC}"
