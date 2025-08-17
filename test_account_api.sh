#!/bin/bash
set -x

# =============================================================================
# Idempotent Account Service Test – aligned with new schema
# =============================================================================

ACCOUNT_API="http://127.0.0.1:3000"
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
)
declare -A NAMES=(
  [admin]="Admin User"
  [company1]="Alpha Corp"
  [company2]="Beta Corp"
  [customer]="Shared Customer"
)
declare -A ROLES=(
  [admin]="admin"
  [company1]="company"
  [company2]="company"
  [customer]="customer"
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
  local code="$2"          # companyCode for company, customerCodes array for customer
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
  # For admin, we attempt registration only if login fails.
  # For other roles, we proceed to register.
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
      payload=$(echo "$payload" | jq --arg code "$code" --arg company_name "$name" '. + {code: $code, companyName: $company_name}')
      ;;
    customer)
      payload=$(echo "$payload" | jq --argjson codes "[\"$code\"]" '. + {customerCodes: $codes}')
      ;;
    partner)
      [ -n "$code" ] && payload=$(echo "$payload" | jq --arg code "$code" '. + {code: $code}')
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
  login_or_register "$role_key" "$code"
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
# 3) Main flow
# -----------------------------------------------------------------------
print_step "Starting test"

# admin login
login_or_register admin

# create / ensure codes
create_codes "$COMPANY_ONE_COMP_CODE" "$COMPANY_ONE_CUSTOMER_CODE"
create_codes "$COMPANY_TWO_COMP_CODE"  "$COMPANY_TWO_CUSTOMER_CODE" "PART-BETA-301"

# company users
login_or_register company1 "$COMPANY_ONE_COMP_CODE"
login_or_register company2 "$COMPANY_TWO_COMP_CODE"

# customer
login_or_register customer "$COMPANY_ONE_CUSTOMER_CODE"

print_step "Test finished successfully"