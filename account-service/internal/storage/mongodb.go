package storage

import (
	"context"
	"log"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

/* ---------- GLOBAL POOLED CLIENT ---------- */
var (
	once    sync.Once
	client  *mongo.Client
	connErr error
)

// Client returns the SAME *mongo.Client for the lifetime of the Lambda runtime.
func Client(uri string) (*mongo.Client, error) {
	once.Do(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		client, connErr = mongo.Connect(ctx, options.Client().
			ApplyURI(uri).
			SetMaxPoolSize(5). // small pool
			SetMinPoolSize(1)) // keep 1 warm
	})
	return client, connErr
}

/* ---------- DB TYPE (unchanged signature) ---------- */
type DB struct {
	client            *mongo.Client
	accounts          *mongo.Collection
	codes             *mongo.Collection
	refreshtokens     *mongo.Collection
	blacklistedtokens *mongo.Collection
	companyLocations  *mongo.Collection
	customerAddresses *mongo.Collection
	visitors          *mongo.Collection
}

/* ---------- NEWDB ---------- */
func NewDB(mongoURI string) (*DB, error) {
	c, err := Client(mongoURI) // <-- reuse global
	if err != nil {
		return nil, err
	}
	db := c.Database("AccountService")

	accounts := db.Collection("accounts")
	visitors := db.Collection("visitors")

	// Ensure indexes (idempotent)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	indexes := []struct {
		coll  *mongo.Collection
		model mongo.IndexModel
	}{
		{accounts, mongo.IndexModel{Keys: bson.M{"email": 1}, Options: options.Index().SetUnique(true)}},
		{visitors, mongo.IndexModel{Keys: bson.M{"visitorId": 1}}},
		{visitors, mongo.IndexModel{Keys: bson.M{"sellerId": 1}}},
	}
	for _, idx := range indexes {
		if _, err := idx.coll.Indexes().CreateOne(ctx, idx.model); err != nil {
			log.Printf("WARN: index creation failed: %v", err)
		}
	}

	return &DB{
		client:            c,
		accounts:          accounts,
		codes:             db.Collection("codes"),
		refreshtokens:     db.Collection("refreshtokens"),
		blacklistedtokens: db.Collection("blacklistedtokens"),
		companyLocations:  db.Collection("company_locations"),
		customerAddresses: db.Collection("customer_addresses"),
		visitors:          visitors,
	}, nil
}

/* ---------- EXACT SAME METHODS (no change) ---------- */

func (db *DB) CreateCode(code *Code) error {
	_, err := db.codes.InsertOne(context.Background(), code)
	return err
}

func (db *DB) GetCode(filter bson.M) (*Code, error) {
	var c Code
	err := db.codes.FindOne(context.Background(), filter).Decode(&c)
	return &c, err
}

func (db *DB) UpdateCode(id primitive.ObjectID, update bson.M) error {
	_, err := db.codes.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": update})
	return err
}

func (db *DB) DeleteCode(id primitive.ObjectID) error {
	_, err := db.codes.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

func (db *DB) CountCodes(filter bson.M) (int64, error) {
	return db.codes.CountDocuments(context.Background(), filter)
}

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

func (db *DB) UpdateAccount(id primitive.ObjectID, updates map[string]interface{}, unset ...map[string]interface{}) error {
	ops := bson.M{}
	if len(updates) > 0 {
		ops["$set"] = updates
	}
	if len(unset) > 0 && len(unset[0]) > 0 {
		ops["$unset"] = unset[0]
	}
	if len(ops) == 0 {
		return nil
	}
	_, err := db.accounts.UpdateOne(context.Background(), bson.M{"_id": id}, ops)
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

// UpdateCustomerConfiguration updates the per-company configuration for a customer.
// groupID semantics:
//
//	nil  → leave existing groupID untouched
//	&""  → explicitly $unset the groupID
//	&"x" → set groupID to "x"
func (db *DB) UpdateCustomerConfiguration(customerID primitive.ObjectID, companyID string, config *CustomerConfiguration, groupID *string) error {
	filter := bson.M{"_id": customerID}
	setOps := bson.M{"customer.customerConfigs.$[elem].configuration": config}
	update := bson.M{}
	if groupID != nil && *groupID == "" {
		update["$unset"] = bson.M{"customer.customerConfigs.$[elem].groupID": ""}
	} else if groupID != nil {
		setOps["customer.customerConfigs.$[elem].groupID"] = *groupID
	}
	update["$set"] = setOps
	arrayFilters := options.Update().SetArrayFilters(options.ArrayFilters{
		Filters: []interface{}{
			bson.M{"elem.codeId": companyID},
		},
	})

	_, err := db.accounts.UpdateOne(context.Background(), filter, update, arrayFilters)
	return err
}

func (db *DB) AddCustomerAssociation(customerID primitive.ObjectID, entry *CustomerCodeEntry) error {
	filter := bson.M{"_id": customerID}
	update := bson.M{
		"$addToSet": bson.M{"customer.customerConfigs": entry},
	}
	_, err := db.accounts.UpdateOne(context.Background(), filter, update)
	return err
}

/* ---------- COMPANY LOCATIONS ---------- */

func (db *DB) CreateCompanyLocation(location *CompanyLocation) error {
	_, err := db.companyLocations.InsertOne(context.Background(), location)
	return err
}

func (db *DB) GetCompanyLocation(filter bson.M) (*CompanyLocation, error) {
	var cl CompanyLocation
	err := db.companyLocations.FindOne(context.Background(), filter).Decode(&cl)
	return &cl, err
}

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

func (db *DB) UpdateCompanyLocation(id primitive.ObjectID, location *CompanyLocation) error {
	_, err := db.companyLocations.ReplaceOne(context.Background(), bson.M{"_id": id}, location)
	return err
}

func (db *DB) DeleteCompanyLocation(id primitive.ObjectID) error {
	_, err := db.companyLocations.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

/* ---------- CUSTOMER ADDRESSES ---------- */

func (db *DB) CreateCustomerAddress(address *CustomerAddress) error {
	_, err := db.customerAddresses.InsertOne(context.Background(), address)
	return err
}

func (db *DB) GetCustomerAddress(filter bson.M) (*CustomerAddress, error) {
	var ca CustomerAddress
	err := db.customerAddresses.FindOne(context.Background(), filter).Decode(&ca)
	return &ca, err
}

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

func (db *DB) UpdateCustomerAddress(id primitive.ObjectID, address *CustomerAddress) error {
	_, err := db.customerAddresses.ReplaceOne(context.Background(), bson.M{"_id": id}, address)
	return err
}

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

/* ---------- VISITORS ---------- */

func (db *DB) UpsertVisitor(visitor *Visitor) error {
	now := time.Now()
	filter := bson.M{"visitorId": visitor.VisitorID}

	setOnInsert := bson.M{
		"attribution": visitor.Attribution,
		"firstVisit":  now,
		"createdAt":   now,
		"registered":  false,
		"ordered":     false,
		"totalOrders": 0,
		"totalRevenue": 0,
	}
	if visitor.SellerID != "" {
		setOnInsert["sellerId"] = visitor.SellerID
	}

	setFields := bson.M{
		"lastVisit": now,
		"updatedAt": now,
		"geo":       visitor.Geo,
		"device":    visitor.Device,
		"os":        visitor.OS,
		"browser":   visitor.Browser,
		"isBot":     visitor.IsBot,
		"botName":   visitor.BotName,
	}
	if visitor.CustomerID != "" {
		setFields["customerId"] = visitor.CustomerID
	}

	update := bson.M{
		"$setOnInsert": setOnInsert,
		"$set":         setFields,
		"$inc":         bson.M{"totalPageViews": 1, "totalSessions": 1},
	}

	if len(visitor.Pages) > 0 {
		update["$addToSet"] = bson.M{"pages": visitor.Pages[0]}
	}

	opts := options.Update().SetUpsert(true)
	_, err := db.visitors.UpdateOne(context.Background(), filter, update, opts)
	return err
}

func (db *DB) AddVisitorMilestone(visitorID string, milestone VisitorMilestone) error {
	filter := bson.M{"visitorId": visitorID}
	update := bson.M{
		"$push": bson.M{"milestones": milestone},
		"$set":  bson.M{"updatedAt": time.Now()},
	}
	_, err := db.visitors.UpdateOne(context.Background(), filter, update)
	return err
}

func (db *DB) UpdateVisitorConversion(visitorID string, fields bson.M) error {
	filter := bson.M{"visitorId": visitorID}
	update := bson.M{"$set": fields}
	_, err := db.visitors.UpdateOne(context.Background(), filter, update)
	return err
}

func (db *DB) AppendVisitorError(visitorID string, errMsg string) {
	filter := bson.M{"visitorId": visitorID}
	update := bson.M{"$push": bson.M{"errorLog": errMsg}}
	db.visitors.UpdateOne(context.Background(), filter, update)
}

func (db *DB) GetVisitorByID(visitorID string) (*Visitor, error) {
	var visitor Visitor
	err := db.visitors.FindOne(context.Background(), bson.M{"visitorId": visitorID}).Decode(&visitor)
	if err != nil {
		return nil, err
	}
	return &visitor, nil
}

func (db *DB) GetVisitors(filter bson.M, skip, limit int64) ([]*Visitor, int64, error) {
	total, err := db.visitors.CountDocuments(context.Background(), filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.M{"lastVisit": -1}).
		SetSkip(skip).
		SetLimit(limit)

	cursor, err := db.visitors.Find(context.Background(), filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(context.Background())

	var visitors []*Visitor
	if err := cursor.All(context.Background(), &visitors); err != nil {
		return nil, 0, err
	}
	return visitors, total, nil
}

func (db *DB) GetVisitorStats(sellerID string) (map[string]interface{}, error) {
	ctx := context.Background()

	base := bson.M{}
	if sellerID == "portal" {
		base["sellerId"] = bson.M{"$in": []interface{}{nil, ""}}
	} else if sellerID != "" {
		base["sellerId"] = sellerID
	}

	withBase := func(extra bson.M) bson.M {
		f := bson.M{}
		for k, v := range base {
			f[k] = v
		}
		for k, v := range extra {
			f[k] = v
		}
		return f
	}

	total, _ := db.visitors.CountDocuments(ctx, base)
	bots, _ := db.visitors.CountDocuments(ctx, withBase(bson.M{"isBot": true}))
	registered, _ := db.visitors.CountDocuments(ctx, withBase(bson.M{"registered": true}))
	ordered, _ := db.visitors.CountDocuments(ctx, withBase(bson.M{"ordered": true}))

	today := time.Now().Truncate(24 * time.Hour)
	todayCount, _ := db.visitors.CountDocuments(ctx, withBase(bson.M{"lastVisit": bson.M{"$gte": today}}))

	week := time.Now().AddDate(0, 0, -7)
	weekCount, _ := db.visitors.CountDocuments(ctx, withBase(bson.M{"lastVisit": bson.M{"$gte": week}}))

	month := time.Now().AddDate(0, 0, -30)
	monthCount, _ := db.visitors.CountDocuments(ctx, withBase(bson.M{"lastVisit": bson.M{"$gte": month}}))

	// Helper: run aggregation with base match prepended
	aggregate := func(pipeline mongo.Pipeline) []map[string]interface{} {
		full := mongo.Pipeline{}
		if len(base) > 0 {
			full = append(full, bson.D{{Key: "$match", Value: base}})
		}
		full = append(full, pipeline...)
		cur, err := db.visitors.Aggregate(ctx, full)
		if err != nil {
			return nil
		}
		defer cur.Close(ctx)
		var out []map[string]interface{}
		cur.All(ctx, &out)
		return out
	}

	groupByField := func(field string, limit int) []map[string]interface{} {
		p := mongo.Pipeline{
			{{Key: "$group", Value: bson.M{"_id": "$" + field, "count": bson.M{"$sum": 1}}}},
			{{Key: "$sort", Value: bson.M{"count": -1}}},
		}
		if limit > 0 {
			p = append(p, bson.D{{Key: "$limit", Value: limit}})
		}
		return aggregate(p)
	}

	topSources := groupByField("attribution.source", 10)

	topCountries := aggregate(mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"geo.country": bson.M{"$ne": ""}}}},
		{{Key: "$group", Value: bson.M{"_id": "$geo.country", "count": bson.M{"$sum": 1}}}},
		{{Key: "$sort", Value: bson.M{"count": -1}}},
		{{Key: "$limit", Value: 10}},
	})

	devices := groupByField("device", 0)
	browsers := groupByField("browser", 0)

	revResult := aggregate(mongo.Pipeline{
		{{Key: "$group", Value: bson.M{"_id": nil, "totalRevenue": bson.M{"$sum": "$totalRevenue"}, "totalOrders": bson.M{"$sum": "$totalOrders"}}}},
	})
	totalRevenue := 0.0
	totalOrders := 0
	if len(revResult) > 0 {
		if v, ok := revResult[0]["totalRevenue"].(float64); ok {
			totalRevenue = v
		}
		if v, ok := revResult[0]["totalOrders"].(int32); ok {
			totalOrders = int(v)
		} else if v, ok := revResult[0]["totalOrders"].(int64); ok {
			totalOrders = int(v)
		}
	}

	return map[string]interface{}{
		"totalVisitors":    total,
		"totalBots":        bots,
		"totalRegistered":  registered,
		"totalOrdered":     ordered,
		"todayVisitors":    todayCount,
		"weekVisitors":     weekCount,
		"monthVisitors":    monthCount,
		"topSources":       topSources,
		"topCountries":     topCountries,
		"devices":          devices,
		"browsers":         browsers,
		"totalRevenue":     totalRevenue,
		"totalOrders":      totalOrders,
	}, nil
}

/* ---------- DISCONNECT ---------- */

func (db *DB) Disconnect() {
	_ = db.client.Disconnect(context.Background())
}
