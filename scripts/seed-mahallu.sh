#!/bin/bash

# Configuration
API_BASE="http://localhost:5000/api"
EMAIL="mahallu@gmail.com"
PASS="12345678"
FIREBASE_API_KEY="AIzaSyBgBGuxZ3rTzFJMMmP2yl8_GAqZjQi2eo0"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Seeding Script (v2 - Realistic Data)...${NC}"

# Lists of names
HEAD_NAMES=("Abdurahman" "Mohammed" "Ibrahim" "Yousuf" "Ismail" "Faisal" "Ashraf" "Saleem" "Jaffer" "Siddeeque")
SPOUSE_NAMES=("Fatima" "Aisha" "Zainaba" "Khadeeja" "Mariyam" "Sumayya" "Safiya" "Amina" "Nabeesa" "Rukiya")
CHILD_BOY_NAMES=("Anas" "Affan" "Ahmed" "Ali" "Arshad" "Zaid" "Omar" "Hassan" "Hussain" "Bilal")
CHILD_GIRL_NAMES=("Hanna" "Hadiya" "Hiba" "Husna" "Haifa" "Sara" "Zahra" "Safa" "Marwa" "Amna")
HOUSE_SUFFIXES=("Villa" "House" "Manzil" "Home" "Residency")

# 1. Login to Firebase to get ID Token
echo "Logging in to Firebase..."
AUTH_RESPONSE=$(curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"returnSecureToken\":true}")

ID_TOKEN=$(echo $AUTH_RESPONSE | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log(data.idToken);")

if [ -z "$ID_TOKEN" ] || [ "$ID_TOKEN" == "undefined" ]; then
  echo -e "${RED}Login failed. Response:${NC}"
  echo $AUTH_RESPONSE
  exit 1
fi

echo -e "${GREEN}Logged in successfully.${NC}"

# 2. Get Organization ID
echo "Fetching Organization ID..."
ORG_RESPONSE=$(curl -s -X GET "${API_BASE}/organizations" \
  -H "Authorization: Bearer ${ID_TOKEN}")

ORG_ID=$(echo $ORG_RESPONSE | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log(data.data[0]._id);")

if [ -z "$ORG_ID" ] || [ "$ORG_ID" == "undefined" ]; then
  echo -e "${RED}Failed to fetch Organization ID.${NC}"
  exit 1
fi

echo -e "${GREEN}Found Organization ID: ${ORG_ID}${NC}"

# 3. Add 10 Households
TIMESTAMP=$(date +%s)
for i in {0..9}
do
  INDEX=$((i + 1))
  HEAD_NAME="${HEAD_NAMES[$i]}"
  HEAD_NAME_LOWER=$(echo "$HEAD_NAME" | tr '[:upper:]' '[:lower:]')
  HOUSE_NAME="${HEAD_NAME} ${HOUSE_SUFFIXES[$((RANDOM % 5))]}"
  OWNER_EMAIL="${HEAD_NAME_LOWER}@example.com"
  OWNER_PASS="Pass123!"

  echo -e "${BLUE}Adding Household ${INDEX}: ${HOUSE_NAME} (Head: ${HEAD_NAME})...${NC}"
  
  HOUSE_PAYLOAD=$(cat <<EOF
{
  "houseName": "${HOUSE_NAME}",
  "addressLine1": "Street ${INDEX}, Mahallu Area",
  "addressLine2": "City Center",
  "postalCode": "67300${INDEX}",
  "primaryMobile": "98765432${i}0",
  "status": "active",
  "email": "${OWNER_EMAIL}",
  "password": "${OWNER_PASS}",
  "headFullName": "${HEAD_NAME}",
  "headGender": "male",
  "headMaritalStatus": "married"
}
EOF
)

  CREATE_HOUSE_RESPONSE=$(curl -s -X POST "${API_BASE}/organizations/${ORG_ID}/households" \
    -H "Authorization: Bearer ${ID_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${HOUSE_PAYLOAD}")

  SUCCESS=$(echo $CREATE_HOUSE_RESPONSE | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log(data.success);")

  if [ "$SUCCESS" != "true" ]; then
    echo -e "${RED}Failed to create household ${INDEX}. Response:${NC}"
    echo $CREATE_HOUSE_RESPONSE
    continue
  fi

  HOUSE_DATA=$(echo $CREATE_HOUSE_RESPONSE | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log(JSON.stringify(data.data));")
  HOUSE_ID=$(echo $HOUSE_DATA | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log(data.household._id);")
  HEAD_ID=$(echo $HOUSE_DATA | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log(data.headMember._id);")

  echo -e "${GREEN}Created Household ${HOUSE_NAME} (ID: ${HOUSE_ID})${NC}"
  echo -e "Account: ${OWNER_EMAIL} / ${OWNER_PASS}"

  # 4. Add Spouse
  SPOUSE_NAME="${SPOUSE_NAMES[$i]}"
  echo -e "Adding spouse: ${SPOUSE_NAME}..."
  
  SPOUSE_PAYLOAD=$(cat <<EOF
{
  "fullName": "${SPOUSE_NAME}",
  "gender": "female",
  "currentHouseholdId": "${HOUSE_ID}",
  "maritalStatus": "married",
  "spouseId": "${HEAD_ID}"
}
EOF
)

  curl -s -X POST "${API_BASE}/organizations/${ORG_ID}/members" \
    -H "Authorization: Bearer ${ID_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${SPOUSE_PAYLOAD}" > /dev/null

  # 5. Add Children (3-6 children to make 5-8 total members)
  NUM_CHILDREN=$(( ( RANDOM % 4 ) + 3 )) # Generates 3 to 6
  echo "Adding ${NUM_CHILDREN} children..."

  for j in $(seq 1 $NUM_CHILDREN)
  do
    RAND_VAL=$((RANDOM % 2))
    if [ $RAND_VAL -eq 0 ]; then
      MEMBER_NAME="${CHILD_BOY_NAMES[$((RANDOM % 10))]}"
      GENDER="male"
    else
      MEMBER_NAME="${CHILD_GIRL_NAMES[$((RANDOM % 10))]}"
      GENDER="female"
    fi
    
    MEMBER_PAYLOAD=$(cat <<EOF
{
  "fullName": "${MEMBER_NAME}",
  "gender": "${GENDER}",
  "currentHouseholdId": "${HOUSE_ID}",
  "maritalStatus": "single",
  "fatherId": "${HEAD_ID}"
}
EOF
)

    curl -s -X POST "${API_BASE}/organizations/${ORG_ID}/members" \
      -H "Authorization: Bearer ${ID_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${MEMBER_PAYLOAD}" > /dev/null

    echo -n "."
  done
  echo ""
  echo -e "${GREEN}Finished adding family members for House ${INDEX}${NC}"
done

echo -e "${BLUE}Seeding Complete!${NC}"
