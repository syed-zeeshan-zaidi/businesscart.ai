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
