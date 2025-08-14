#!/bin/bash
set -x

# =============================================================================
# Idempotent Account Service Test
# =============================================================================

# ----------------------------------------------------------
# 1) Configuration
# ----------------------------------------------------------
ACCOUNT_API="http://127.0.0.1:3000"
PASSWORD="securepassword"

# --- Static Codes ---
COMPANY_ONE_BIZ_CODE="BIZ-ALPHA-100"
COMPANY_ONE_COMP_CODE="COMP-ALPHA-101"
COMPANY_TWO_BIZ_CODE="BIZ-BETA-200"
COMPANY_TWO_COMP_CODE="COMP-BETA-201"

# --- Static User Details ---
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

# --- JWT and ID Storage ---
declare -A JWTS
declare -A COMPANY_IDS

# --- Colors and Helpers ---
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'
DIVIDER="${CYAN}==============================================${NC}"

handle_error() {
    echo -e "${RED}HTTP $2 in $1\nResponse: $3${NC}" >&2
    exit 1
}

print_step() { echo -e "\n${DIVIDER}\n${CYAN}# $1${NC}\n${DIVIDER}" >&2; }

# ----------------------------------------------------------
# 2) Core Functions
# ----------------------------------------------------------

# Login a user; if they don't exist, register them.
login_or_register() {
    local role_key="$1"
    local code="$2"
    local company_name="${NAMES[$role_key]}"
    local email="${USERS[$role_key]}"
    local name="${NAMES[$role_key]}"
    local user_role="${ROLES[$role_key]}"

    print_step "Login or Register for $role_key"
    
    resp=$(curl -s -w "\n%{http_code}" -X POST "$ACCOUNT_API/accounts/login" -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")

    if [ "$status" -ne 200 ]; then
        echo "Login failed for $role_key. Registering..."
        
        payload=$(cat <<EOF
{
  "name": "$name",
  "email": "$email",
  "password": "$PASSWORD",
  "role": "$user_role"
}
EOF
)
        if [[ "$user_role" != "admin" ]]; then
            payload=$(echo "$payload" | jq --arg code "$code" '. + {code: $code}')
        fi
        if [[ "$user_role" == "company" ]]; then
            payload=$(echo "$payload" | jq --arg company_name "$company_name" '. + {companyName: $company_name}')
        fi

        reg_resp=$(curl -s -w "\n%{http_code}" -X POST "$ACCOUNT_API/accounts/register" -H "Content-Type: application/json" -d "$payload")
        reg_status=$(tail -n1 <<<"$reg_resp")
        reg_body=$(sed '$d' <<<"$reg_resp")

        if [ "$reg_status" -ne 201 ]; then
            handle_error "Register $role_key" "$reg_status" "$reg_body"
        fi
        echo -e "${GREEN}Registration successful for $role_key.${NC}"
        
        # Retry login after registration
        resp=$(curl -s -w "\n%{http_code}" -X POST "$ACCOUNT_API/accounts/login" -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")
        status=$(tail -n1 <<<"$resp")
        body=$(sed '$d' <<<"$resp")
    fi

    if [ "$status" -ne 200 ]; then
        handle_error "Post-Register Login for $role_key" "$status" "$body"
    fi

    JWTS[$role_key]=$(echo "$body" | jq -r '.accessToken')
    echo -e "${GREEN}Login successful for $role_key.${NC}"
}

# Create codes if they don't exist.
create_codes_if_not_exist() {
    local biz_code="$1"
    local comp_code="$2"
    local company_key="$3"

    print_step "Ensuring codes exist for $company_key"
    
    resp=$(curl -s -w "\n%{http_code}" -X POST "$ACCOUNT_API/codes" -H "Content-Type: application/json" -H "Authorization: Bearer ${JWTS[admin]}" -d "{\"businessCode\":\"$biz_code\",\"companyCode\":\"$comp_code\"}")
    status=$(tail -n1 <<<"$resp")
    body=$(sed '$d' <<<"$resp")

    if [ "$status" -eq 201 ]; then
        echo -e "${GREEN}Codes created successfully.${NC}"
        COMPANY_IDS[$company_key]=$(echo "$body" | jq -r '.ID')
    elif [ "$status" -eq 400 ] && [[ "$body" == *"already exists"* ]]; then
        echo -e "${YELLOW}Codes already exist. Fetching existing code document.${NC}"
        get_resp=$(curl -s -w "\n%{http_code}" -X GET "$ACCOUNT_API/codes/$biz_code" -H "Authorization: Bearer ${JWTS[admin]}")
        get_status=$(tail -n1 <<<"$get_resp")
        get_body=$(sed '$d' <<<"$get_resp")

        if [ "$get_status" -ne 200 ]; then
            handle_error "Fetch existing code for $company_key" "$get_status" "$get_body"
        fi
        COMPANY_IDS[$company_key]=$(echo "$get_body" | jq -r '.ID')
    elif [ "$status" -ge 400 ]; then
        handle_error "Create Codes for $company_key" "$status" "$body"
    fi
    
    if [ -z "${COMPANY_IDS[$company_key]}" ]; then
        echo -e "${RED}Failed to retrieve Company ID for $company_key${NC}"
        exit 1
    fi

    echo -e "${GREEN}Company ID for $company_key: ${COMPANY_IDS[$company_key]}${NC}"
}


# ----------------------------------------------------------
# 3) Main Execution
# ----------------------------------------------------------
print_step "Starting Idempotent Account Service Test"

# 1. Admin registers or logs in
login_or_register "admin"

# 2. Admin creates codes for both companies
create_codes_if_not_exist "$COMPANY_ONE_BIZ_CODE" "$COMPANY_ONE_COMP_CODE" "company1"
create_codes_if_not_exist "$COMPANY_TWO_BIZ_CODE" "$COMPANY_TWO_COMP_CODE" "company2"

# 3. Company users register or log in
login_or_register "company1" "$COMPANY_ONE_BIZ_CODE"
login_or_register "company2" "$COMPANY_TWO_BIZ_CODE"

# 4. Customer user registers or logs in (associated with Company 1 initially)
login_or_register "customer" "$COMPANY_ONE_COMP_CODE"

print_step "Test script completed successfully!"