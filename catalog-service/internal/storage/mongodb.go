package storage

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type DB struct {
	client    *mongo.Client
	products  *mongo.Collection
	blogPosts *mongo.Collection
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

	database := client.Database("ProductService")
	products := database.Collection("products")
	blogPosts := database.Collection("blog_posts")

	// Ensure indexes (idempotent — safe to call on every cold start)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	indexes := []mongo.IndexModel{
		// Compound index covers: company own products, customer/b2c associated products,
		// and any sellerID-prefixed query. Leading sellerID makes the index usable for
		// {sellerID:X}, {sellerID:X, active:Y}, and {sellerID:{$in:[...]}, active:...}.
		{Keys: bson.D{{Key: "sellerID", Value: 1}, {Key: "active", Value: 1}}},
	}
	if _, err := products.Indexes().CreateMany(ctx, indexes); err != nil {
		log.Printf("WARN: catalog index creation failed: %v", err)
	}

	blogIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "sellerID", Value: 1}, {Key: "active", Value: 1}}},
		// Slug must be unique per seller (used in storefront URL).
		{
			Keys:    bson.D{{Key: "sellerID", Value: 1}, {Key: "slug", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	}
	if _, err := blogPosts.Indexes().CreateMany(ctx, blogIndexes); err != nil {
		log.Printf("WARN: blog index creation failed: %v", err)
	}

	return &DB{
		client:    client,
		products:  products,
		blogPosts: blogPosts,
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

func (db *DB) UpdateProduct(id primitive.ObjectID, update bson.M, unset bson.M) error {
	update["updatedAt"] = time.Now()
	ops := bson.M{"$set": update}
	if len(unset) > 0 {
		ops["$unset"] = unset
	}
	_, err := db.products.UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		ops,
	)
	return err
}

func (db *DB) DeleteProduct(id primitive.ObjectID) error {
	_, err := db.products.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

// --- Blog posts ---

func (db *DB) CreateBlogPost(post *BlogPost) error {
	now := time.Now()
	post.CreatedAt = now
	post.UpdatedAt = now
	if post.PublishedAt.IsZero() {
		post.PublishedAt = now
	}
	_, err := db.blogPosts.InsertOne(context.Background(), post)
	return err
}

func (db *DB) GetBlogPostByID(id primitive.ObjectID) (*BlogPost, error) {
	var post BlogPost
	err := db.blogPosts.FindOne(context.Background(), bson.M{"_id": id}).Decode(&post)
	return &post, err
}

func (db *DB) GetBlogPostBySlug(sellerID, slug string) (*BlogPost, error) {
	var post BlogPost
	err := db.blogPosts.FindOne(context.Background(), bson.M{"sellerID": sellerID, "slug": slug}).Decode(&post)
	return &post, err
}

func (db *DB) GetBlogPosts(filter bson.M) ([]*BlogPost, error) {
	opts := options.Find().SetSort(bson.D{{Key: "publishedAt", Value: -1}})
	cursor, err := db.blogPosts.Find(context.Background(), filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var posts []*BlogPost
	if err = cursor.All(context.Background(), &posts); err != nil {
		return nil, err
	}
	return posts, nil
}

func (db *DB) UpdateBlogPost(id primitive.ObjectID, update bson.M, unset bson.M) error {
	update["updatedAt"] = time.Now()
	ops := bson.M{"$set": update}
	if len(unset) > 0 {
		ops["$unset"] = unset
	}
	_, err := db.blogPosts.UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		ops,
	)
	return err
}

func (db *DB) DeleteBlogPost(id primitive.ObjectID) error {
	_, err := db.blogPosts.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}
