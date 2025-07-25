#!/bin/bash
# =============================================================================
# Full API flow test 
# =============================================================================

# ----------------------------------------------------------
# 1) Configuration
# ----------------------------------------------------------
USER_API="http://127.0.0.1:3000"
COMPANY_API="http://127.0.0.1:3001"
PRODUCT_API="http://127.0.0.1:3002"
CHECKOUT_API="http://127.0.0.1:3009"
PASSWORD="securepassword"

declare -A USERS=(
  [admin]="admin@example.com"
  [company1]="company1@example.com"
  [company2]="company2@example.com"
  [customer]="customer@example.com"
)
declare -A NAMES=(
  [admin]="Admin User"
  [company1]="Company1 User"
  [company2]="Company2 User"
  [customer]="Customer User"
)
declare -A ROLES=(
  [admin]="admin"
  [company1]="company"
  [company2]="company"
  [customer]="customer"
)
declare -A JWTS
declare -A USER_IDS
declare -A COMPANY_IDS

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

DIVIDER="${CYAN}===== ✔ =====${NC}"

# ----------------------------------------------------------
# 2) Helpers
# ----------------------------------------------------------
check_jq() {
  if ! command -v jq &>/dev/null; then
    echo -e "${RED}Error: jq not installed${NC}"
    exit 1
  fi
}

handle_error() {
  local resp="$1" step="$2" status="$3"
  if [ "$status" -ge 400 ]; then
    echo -e "${RED}HTTP $status in $step${NC}"
    echo "$resp"
    exit 1
  fi
}

print_step() { echo -e "\n${DIVIDER} $1 ${DIVIDER}" >&2; }

# ----------------------------------------------------------
# 3) Login / Register
# ----------------------------------------------------------
login_or_register() {
  local role="$1"
  local email="${USERS[$role]}"
  local name="${NAMES[$role]}"
  local user_role="${ROLES[$role]}"

  print_step "Login / Register $role ($email)"
  resp=$(curl -s -w "\n%{http_code}" -X POST "$USER_API/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")
  status=$(tail -n1 <<<"$resp")
  body=$(sed '$d' <<<"$resp")

  if [ "$status" -eq 200 ]; then
    echo "$body"
  else
    echo "Login failed (HTTP $status). Trying register…"
    resp=$(curl -s -w "\n%{http_code}" -X POST "$USER_API/users/register" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$PASSWORD\",\"role\":\"$user_role\",\"phoneNumber\":\"1234567890\"}")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")
    handle_error "$body" "Register $role" "$status"
    echo "$body"
  fi

  JWTS[$role]=$(echo "$body" | jq -r '.accessToken')
  USER_IDS[$role]=$(echo "${JWTS[$role]}" | awk -F. '{print $2}' | base64 -d 2>/dev/null | jq -r '.user.id')
  echo -e "${GREEN}$role JWT: ${JWTS[$role]}${NC}"
  echo -e "${GREEN}$role USER_ID: ${USER_IDS[$role]}${NC}"
}

# ----------------------------------------------------------
# 4) Company helpers
# ----------------------------------------------------------
get_or_create_company() {
  local role="$1" name="$2"
  print_step "Company for $role"

  resp=$(curl -s -w "\n%{http_code}" -X GET "$COMPANY_API/companies" \
    -H "Authorization: Bearer ${JWTS[$role]}")
  status=$(tail -n1 <<<"$resp")
  body=$(sed '$d' <<<"$resp")
  handle_error "$body" "Get company" "$status"

  id=$(echo "$body" | jq -r '.[0]._id // empty')
  if [ -n "$id" ]; then
    COMPANY_IDS[$role]=$id
  else
    resp=$(curl -s -w "\n%{http_code}" -X POST "$COMPANY_API/companies" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${JWTS[$role]}" \
      -d "{\"name\":\"$name\"}")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")
    handle_error "$body" "Create company" "$status"
    COMPANY_IDS[$role]=$(echo "$body" | jq -r '._id')
  fi
  echo -e "${GREEN}Company ${COMPANY_IDS[$role]}${NC}"
}

# ----------------------------------------------------------
# 5) Product helpers
# ----------------------------------------------------------
get_or_create_product() {
  local role="$1" pname="$2" price="$3"
  local cid=${COMPANY_IDS[$role]}

  # --- fetch existing products (quiet) ---
  body=$(curl -s -X GET "$PRODUCT_API/products?companyId=$cid" \
         -H "Authorization: Bearer ${JWTS[$role]}")
  id=$(echo "$body" | jq -r --arg n "$pname" '.[] | select(.name == $n) | ._id // empty')

  if [ -n "$id" ]; then
    echo "$id"
    return
  fi

  # --- create new product (quiet) ---
  body=$(curl -s -X POST "$PRODUCT_API/products" \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer ${JWTS[$role]}" \
         -d "{\"name\":\"$pname\",\"description\":\"test\",\"price\":$price,\"companyId\":\"$cid\"}")
  echo "$body" | jq -r '._id'
}

# ----------------------------------------------------------
# 6) Customer association
# ----------------------------------------------------------
associate_customer_with_company() {
  local role="$1" cid="$2"
  print_step "Associate customer $role with company $cid"

  resp=$(curl -s -w "\n%{http_code}" -X POST "$USER_API/users/associate-company" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWTS[$role]}" \
    -d "{\"companyId\":\"$cid\"}")
  status=$(tail -n1 <<<"$resp")
  body=$(sed '$d' <<<"$resp")
  handle_error "$body" "Associate customer" "$status"

  newtok=$(echo "$body" | jq -r '.accessToken // empty')
  [ -n "$newtok" ] && JWTS[$role]=$newtok
  echo -e "${GREEN}Associated & JWT refreshed${NC}"
}

# ----------------------------------------------------------
# 7) Cart helpers
# ----------------------------------------------------------
get_cart_from_service() {
  local role="$1" cid="$2"
  print_step "Get cart for company $cid"

  resp=$(curl -s -w "\n%{http_code}" -X GET "$CHECKOUT_API/cart?companyId=$cid" \
         -H "Authorization: Bearer ${JWTS[$role]}")
  body=$(sed '$d' <<<"$resp")      # strip status line
  status=$(tail -n1 <<<"$resp")
  handle_error "$body" "Get cart" "$status"
  echo "$body"
}

add_item_to_cart() {
  local role="$1" pid="$2" cid="$3" pname="$4" price="$5"
  print_step "Add $pname to cart for $cid"

  payload=$(cat <<EOF
{
  "entity": {
    "productId": "$pid",
    "quantity": 1,
    "companyId": "$cid",
    "name": "$pname",
    "price": $price
  }
}
EOF
)
  echo "Payload: $payload"

  resp=$(curl -s -w "\n%{http_code}" -X POST "$CHECKOUT_API/cart" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWTS[$role]}" \
    -d "$payload")
  status=$(tail -n1 <<<"$resp")
  body=$(sed '$d' <<<"$resp")
  handle_error "$body" "Add item to cart" "$status"
  echo "$body"
}

# ----------------------------------------------------------
# 8) Quote & Order
# ----------------------------------------------------------
create_quote() {
  local role="$1" cid="$2"
  print_step "Create quote for company $cid"

  if [ -z "${JWTS[$role]}" ]; then
    echo -e "${RED}Error: No JWT for $role${NC}" >&2
    exit 1
  fi

  cart_json=$(get_cart_from_service "$role" "$cid")
  cart_id=$(echo "$cart_json" | jq -r '.ID')
  if [ -z "$cart_id" ]; then
    echo -e "${RED}Error: Failed to retrieve cart ID for company $cid${NC}" >&2
    echo "Cart JSON: $cart_json" >&2
    exit 1
  fi
  echo -e "${GREEN}Cart ID: $cart_id${NC}" >&2

  resp=$(curl -s -w "\n%{http_code}" -X POST "$CHECKOUT_API/quotes" \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer ${JWTS[$role]}" \
         -d "{\"cartId\":\"$cart_id\",\"companyId\":\"$cid\"}")
  body=$(sed '$d' <<<"$resp")
  status=$(tail -n1 <<<"$resp")
  handle_error "$body" "Create quote" "$status"

  quote_id=$(echo "$body" | jq -r '.id // empty')
  if [ -z "$quote_id" ]; then
    echo -e "${RED}Error: Failed to extract quote ID for company $cid${NC}" >&2
    echo "Response body: $body" >&2
    exit 1
  fi
  echo -e "${GREEN}Quote ID: $quote_id${NC}" >&2
  echo "$body"
}

place_order() {
  local role="$1" qid="$2" method="$3" token="$4"
  print_step "Place order for quote $qid with $method"

  resp=$(curl -s -w "\n%{http_code}" -X POST "$CHECKOUT_API/orders" \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer ${JWTS[$role]}" \
         -d "{\"quoteId\":\"$qid\",\"paymentMethod\":\"$method\",\"paymentToken\":\"$token\"}")
  body=$(sed '$d' <<<"$resp")
  status=$(tail -n1 <<<"$resp")
  handle_error "$body" "Place order" "$status"
  echo "$body"
}

# ----------------------------------------------------------
# 9) Main flow
# ----------------------------------------------------------
check_jq

print_step "Starting Full API Flow Test"

login_or_register "admin"
login_or_register "company1"
login_or_register "company2"
login_or_register "customer"

get_or_create_company "company1" "Company One"
get_or_create_company "company2" "Company Two"

PRODUCT1_ID=$(get_or_create_product "company1" "Product A" 10.99)
PRODUCT2_ID=$(get_or_create_product "company2" "Product B" 25.50)

associate_customer_with_company "customer" "${COMPANY_IDS[company1]}"
associate_customer_with_company "customer" "${COMPANY_IDS[company2]}"

add_item_to_cart "customer" "$PRODUCT1_ID" "${COMPANY_IDS[company1]}" "Product A" 10.99
add_item_to_cart "customer" "$PRODUCT2_ID" "${COMPANY_IDS[company2]}" "Product B" 25.50

# Create and verify Quote 1
QUOTE1_JSON=$(create_quote "customer" "${COMPANY_IDS[company1]}")
echo "Raw response for Quote 1: $QUOTE1_JSON"
QUOTE1_ID=$(echo "$QUOTE1_JSON" | jq -r '.id // empty')

if [ -z "$QUOTE1_ID" ]; then
    echo -e "${RED}Failed to create Quote 1 or extract its ID.${NC}"
    exit 1
fi
echo -e "${GREEN}Successfully created Quote 1 with ID: $QUOTE1_ID${NC}"
echo "Quote 1 JSON:"
echo "$QUOTE1_JSON" | jq .

# Create and verify Quote 2
QUOTE2_JSON=$(create_quote "customer" "${COMPANY_IDS[company2]}")
echo "Raw response for Quote 2: $QUOTE2_JSON"
QUOTE2_ID=$(echo "$QUOTE2_JSON" | jq -r '.id // empty')

if [ -z "$QUOTE2_ID" ]; then
    echo -e "${RED}Failed to create Quote 2 or extract its ID.${NC}"
    exit 1
fi
echo -e "${GREEN}Successfully created Quote 2 with ID: $QUOTE2_ID${NC}"
echo "Quote 2 JSON:"
echo "$QUOTE2_JSON" | jq .


# Place orders for each quote
ORDER1_JSON=$(place_order "customer" "$QUOTE1_ID" "stripe" "tok_stripe_valid")
ORDER2_JSON=$(place_order "customer" "$QUOTE2_ID" "amazon_pay" "amz_pay_valid")

print_step "Final Results"
echo -e "${GREEN}Company 1 Order (Stripe):${NC}"
echo "$ORDER1_JSON" | jq .
echo -e "${GREEN}Company 2 Order (Amazon Pay):${NC}"
echo "$ORDER2_JSON" | jq .

print_step "Full API flow test completed successfully!"