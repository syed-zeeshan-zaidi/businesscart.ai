package storage

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type DB struct {
	client            *mongo.Client
	accounts          *mongo.Collection
	codes             *mongo.Collection
	refreshtokens     *mongo.Collection
	blacklistedtokens *mongo.Collection
	// New collections
	companyLocations  *mongo.Collection
	customerAddresses *mongo.Collection
}

func NewDB(mongoURI string) (*DB, error) {
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(mongoURI))
	if err != nil {
		return nil, err
	}

	db := client.Database("AccountService")
	return &DB{
		client:            client,
		accounts:          db.Collection("accounts"),
		codes:             db.Collection("codes"),
		refreshtokens:     db.Collection("refreshtokens"),
		blacklistedtokens: db.Collection("blacklistedtokens"),
		// Initialize new collections
		companyLocations:  db.Collection("company_locations"),
		customerAddresses: db.Collection("customer_addresses"),
	}, nil
}

/* ---------- CODES ---------- */

// CreateCode inserts a new code document.
func (db *DB) CreateCode(code *Code) error {
	_, err := db.codes.InsertOne(context.Background(), code)
	return err
}

// GetCode returns the first code matching the filter.
func (db *DB) GetCode(filter bson.M) (*Code, error) {
	var c Code
	err := db.codes.FindOne(context.Background(), filter).Decode(&c)
	return &c, err
}

// UpdateCode applies partial updates to an existing code document.
func (db *DB) UpdateCode(id primitive.ObjectID, update bson.M) error {
	_, err := db.codes.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": update})
	return err
}

// CountCodes returns the number of codes matching the filter.
func (db *DB) CountCodes(filter bson.M) (int64, error) {
	return db.codes.CountDocuments(context.Background(), filter)
}

// GetCodes returns all codes matching the filter.
func (db *DB) GetCodes(filter bson.M) ([]*Code, error) {
	cursor, err := db.codes.Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var codes []*Code
	err = cursor.All(context.Background(), &codes)
	return codes, err
}

/* ---------- ACCOUNTS ---------- */

func (db *DB) CreateAccount(account *Account) error {
	_, err := db.accounts.InsertOne(context.Background(), account)
	return err
}

func (db *DB) GetAccountByEmail(email string) (*Account, error) {
	var acc Account
	err := db.accounts.FindOne(context.Background(), bson.M{"email": email}).Decode(&acc)
	return &acc, err
}

func (db *DB) GetAccountByID(id primitive.ObjectID) (*Account, error) {
	var acc Account
	err := db.accounts.FindOne(context.Background(), bson.M{"_id": id}).Decode(&acc)
	return &acc, err
}

func (db *DB) UpdateAccount(id primitive.ObjectID, updates map[string]interface{}) error {
	_, err := db.accounts.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": updates})
	return err
}

func (db *DB) DeleteAccount(id primitive.ObjectID) error {
	_, err := db.accounts.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

func (db *DB) GetAccounts(filter bson.M) ([]*Account, error) {
	cursor, err := db.accounts.Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var accounts []*Account
	err = cursor.All(context.Background(), &accounts)
	return accounts, err
}

// GetAccountCompaniesDataByIDs returns all *company* accounts whose _id
// matches any of the provided IDs.
func (db *DB) GetAccountCompaniesDataByIDs(ids []primitive.ObjectID) ([]*Account, error) {
	if len(ids) == 0 {
		return []*Account{}, nil
	}
	filter := bson.M{"_id": bson.M{"$in": ids}, "role": RoleCompany}
	cursor, err := db.accounts.Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var out []*Account
	if err := cursor.All(context.Background(), &out); err != nil {
		return nil, err
	}
	return out, nil
}

// UpdateCustomerConfiguration updates a specific customer's configuration for a given company.
func (db *DB) UpdateCustomerConfiguration(customerID primitive.ObjectID, companyID string, config *CustomerConfiguration) error {
	filter := bson.M{"_id": customerID}
	update := bson.M{
		"$set": bson.M{"customer.customerConfigs.$[elem].configuration": config},
	}
	arrayFilters := options.Update().SetArrayFilters(options.ArrayFilters{
		Filters: []interface{}{
			bson.M{"elem.codeId": companyID},
		},
	})

	result, err := db.accounts.UpdateOne(context.Background(), filter, update, arrayFilters)
	if err != nil {
		return err
	}

	// Optionally, check if a document was actually modified.
	// If result.ModifiedCount == 0, it means the customer or the specific codeId was not found.
	_ = result // result can be used for logging or more specific error handling

	return nil
}

/* ---------- COMPANY LOCATIONS ---------- */

// CreateCompanyLocation inserts a new company location document.
func (db *DB) CreateCompanyLocation(location *CompanyLocation) error {
	_, err := db.companyLocations.InsertOne(context.Background(), location)
	return err
}

// GetCompanyLocation returns the first company location matching the filter.
func (db *DB) GetCompanyLocation(filter bson.M) (*CompanyLocation, error) {
	var cl CompanyLocation
	err := db.companyLocations.FindOne(context.Background(), filter).Decode(&cl)
	return &cl, err
}

// GetCompanyLocations returns all company locations matching the filter.
func (db *DB) GetCompanyLocations(filter bson.M) ([]*CompanyLocation, error) {
	cursor, err := db.companyLocations.Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var locations []*CompanyLocation
	err = cursor.All(context.Background(), &locations)
	return locations, err
}

// UpdateCompanyLocation replaces an existing company location document.
func (db *DB) UpdateCompanyLocation(id primitive.ObjectID, location *CompanyLocation) error {
	_, err := db.companyLocations.ReplaceOne(context.Background(), bson.M{"_id": id}, location)
	return err
}

// DeleteCompanyLocation deletes a company location document.
func (db *DB) DeleteCompanyLocation(id primitive.ObjectID) error {
	_, err := db.companyLocations.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

/* ---------- CUSTOMER ADDRESSES ---------- */

// CreateCustomerAddress inserts a new customer address document.
func (db *DB) CreateCustomerAddress(address *CustomerAddress) error {
	_, err := db.customerAddresses.InsertOne(context.Background(), address)
	return err
}

// GetCustomerAddress returns the first customer address matching the filter.
func (db *DB) GetCustomerAddress(filter bson.M) (*CustomerAddress, error) {
	var ca CustomerAddress
	err := db.customerAddresses.FindOne(context.Background(), filter).Decode(&ca)
	return &ca, err
}

// GetCustomerAddresses returns all customer addresses matching the filter.
func (db *DB) GetCustomerAddresses(filter bson.M) ([]*CustomerAddress, error) {
	cursor, err := db.customerAddresses.Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var addresses []*CustomerAddress
	err = cursor.All(context.Background(), &addresses)
	return addresses, err
}

// UpdateCustomerAddress replaces an existing customer address document.
func (db *DB) UpdateCustomerAddress(id primitive.ObjectID, address *CustomerAddress) error {
	_, err := db.customerAddresses.ReplaceOne(context.Background(), bson.M{"_id": id}, address)
	return err
}

// DeleteCustomerAddress deletes a customer address document.
func (db *DB) DeleteCustomerAddress(id primitive.ObjectID) error {
	_, err := db.customerAddresses.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

/* ---------- REFRESH TOKENS ---------- */

func (db *DB) CreateRefreshToken(token *RefreshToken) error {
	_, err := db.refreshtokens.InsertOne(context.Background(), token)
	return err
}

func (db *DB) GetRefreshToken(token string) (*RefreshToken, error) {
	var rt RefreshToken
	err := db.refreshtokens.FindOne(context.Background(), bson.M{"token": token}).Decode(&rt)
	return &rt, err
}

func (db *DB) DeleteRefreshToken(token string) error {
	_, err := db.refreshtokens.DeleteOne(context.Background(), bson.M{"token": token})
	return err
}

/* ---------- BLACKLIST ---------- */

func (db *DB) BlacklistToken(token *BlacklistedToken) error {
	_, err := db.blacklistedtokens.InsertOne(context.Background(), token)
	return err
}

func (db *DB) IsTokenBlacklisted(token string) (bool, error) {
	n, err := db.blacklistedtokens.CountDocuments(context.Background(), bson.M{"token": token})
	return n > 0, err
}

/* ---------- DISCONNECT ---------- */

func (db *DB) Disconnect() {
	_ = db.client.Disconnect(context.Background())
}
