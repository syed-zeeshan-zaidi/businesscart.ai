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
	client   *mongo.Client
	products *mongo.Collection
}

func NewDB(uri string) (*DB, error) {
	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(context.Background(), clientOptions)
	if err != nil {
		return nil, err
	}

	// Check the connection
	err = client.Ping(context.Background(), nil)
	if err != nil {
		return nil, err
	}

	db := client.Database("ProductService")
	return &DB{
		client:   client,
		products: db.Collection("products"),
	}, nil
}

func (db *DB) CreateProduct(product *Product) error {
	product.CreatedAt = time.Now()
	product.UpdatedAt = time.Now()
	_, err := db.products.InsertOne(context.Background(), product)
	return err
}

func (db *DB) GetProductByID(id primitive.ObjectID) (*Product, error) {
	var product Product
	err := db.products.FindOne(context.Background(), bson.M{"_id": id}).Decode(&product)
	return &product, err
}

func (db *DB) GetProducts(filter bson.M) ([]*Product, error) {
	cursor, err := db.products.Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var products []*Product
	if err = cursor.All(context.Background(), &products); err != nil {
		return nil, err
	}
	return products, nil
}

func (db *DB) UpdateProduct(id primitive.ObjectID, update bson.M) error {
	update["updatedAt"] = time.Now()
	_, err := db.products.UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": update},
	)
	return err
}

func (db *DB) DeleteProduct(id primitive.ObjectID) error {
	_, err := db.products.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}
