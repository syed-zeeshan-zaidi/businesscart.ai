package storage

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type DB struct {
	client *mongo.Client
}

func NewDB(mongoURI string) (*DB, error) {
	client, err := mongo.NewClient(options.Client().ApplyURI(mongoURI))
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = client.Connect(ctx)
	if err != nil {
		return nil, err
	}

	return &DB{client: client}, nil
}

func (db *DB) Disconnect() {
	db.client.Disconnect(context.Background())
}

func (db *DB) GetUserByEmail(email string) (*User, error) {
	collection := db.client.Database("UserService").Collection("users")
	var user User
	err := collection.FindOne(context.Background(), bson.M{"email": email}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (db *DB) CreateUser(user *User) error {
	collection := db.client.Database("UserService").Collection("users")
	_, err := collection.InsertOne(context.Background(), user)
	return err
}

func (db *DB) GetRefreshToken(token string) (*RefreshToken, error) {
	collection := db.client.Database("UserService").Collection("refreshtokens")
	var refreshToken RefreshToken
	err := collection.FindOne(context.Background(), bson.M{"token": token}).Decode(&refreshToken)
	if err != nil {
		return nil, err
	}
	return &refreshToken, nil
}

func (db *DB) CreateRefreshToken(token *RefreshToken) error {
	collection := db.client.Database("UserService").Collection("refreshtokens")
	_, err := collection.InsertOne(context.Background(), token)
	return err
}

func (db *DB) GetUserByID(id primitive.ObjectID) (*User, error) {
	collection := db.client.Database("UserService").Collection("users")
	var user User
	err := collection.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (db *DB) AssociateCompany(userID primitive.ObjectID, companyID string) error {
	collection := db.client.Database("UserService").Collection("users")
	_, err := collection.UpdateOne(
		context.Background(),
		bson.M{"_id": userID},
		bson.M{"$addToSet": bson.M{"associate_company_ids": companyID}},
	)
	return err
}

func (db *DB) DeleteUser(id primitive.ObjectID) error {
	collection := db.client.Database("UserService").Collection("users")
	_, err := collection.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

func (db *DB) UpdateUser(id primitive.ObjectID, user *User) error {
	collection := db.client.Database("UserService").Collection("users")
	_, err := collection.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": user})
	return err
}

func (db *DB) GetUsers() ([]*User, error) {
	collection := db.client.Database("UserService").Collection("users")
	cursor, err := collection.Find(context.Background(), bson.M{})
	if err != nil {
		return nil, err
	}

	var users []*User
	if err = cursor.All(context.Background(), &users); err != nil {
		return nil, err
	}

	return users, nil
}

func (db *DB) BlacklistToken(token *BlacklistedToken) error {
	collection := db.client.Database("UserService").Collection("blacklistedtokens")
	_, err := collection.InsertOne(context.Background(), token)
	return err
}

func (db *DB) DeleteRefreshToken(token string) error {
	collection := db.client.Database("UserService").Collection("refreshtokens")
	_, err := collection.DeleteOne(context.Background(), bson.M{"token": token})
	return err
}

func (db *DB) GetBusinessCode(code string) (*BusinessCode, error) {
	collection := db.client.Database("UserService").Collection("businesscodes")
	var businessCode BusinessCode
	err := collection.FindOne(context.Background(), bson.M{"business_code": code}).Decode(&businessCode)
	if err != nil {
		return nil, err
	}
	return &businessCode, nil
}

func (db *DB) GetCompanyAccessCode(code string) (*BusinessCode, error) {
	collection := db.client.Database("UserService").Collection("businesscodes")
	var businessCode BusinessCode
	err := collection.FindOne(context.Background(), bson.M{"company_access_code": code}).Decode(&businessCode)
	if err != nil {
		return nil, err
	}
	return &businessCode, nil
}