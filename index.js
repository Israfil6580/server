// backend/server.js

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 5000; // Default port

const corsConfig = {
  origin: ["http://localhost:5173", "https://netcomm.netlify.app"],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsConfig));

// Middleware
app.use(express.json());

const uri = process.env.URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const database = client.db("Product_Analyze");
    const productsCollection = database.collection("products");

    // Home route
    app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    // Search products with pagination
    app.get("/products", async (req, res) => {
      try {
        console.log("Fetching products with query parameters:", req.query);

        const query = req.query.query ? req.query.query.toLowerCase() : "";
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sort = req.query.sort || "";
        const { brand, category, minPrice, maxPrice } = req.query;
        const filter = {};

        if (query) {
          filter.productName = { $regex: query, $options: "i" };
        }

        if (brand) {
          filter.brandName = brand;
        }

        if (category) {
          filter.category = category;
        }

        if (minPrice && maxPrice) {
          filter.price = {
            $gte: parseFloat(minPrice),
            $lte: parseFloat(maxPrice),
          };
        }

        let sortOptions = {};
        if (sort === "price-asc") {
          sortOptions.price = 1;
        } else if (sort === "price-desc") {
          sortOptions.price = -1;
        } else if (sort === "date-added-desc") {
          sortOptions.creationDate = -1;
        } else {
          sortOptions._id = 1;
        }

        const skip = (page - 1) * limit;

        console.log("Filter and sort options:", filter, sortOptions);

        const products = await productsCollection
          .find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalProducts = await productsCollection.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
          totalProducts,
          page,
          limit,
          totalPages,
          products,
        });
      } catch (error) {
        console.error("Error fetching products:", error.message);
        res
          .status(500)
          .json({ error: "An error occurred while fetching products" });
      }
    });

    // Find categories
    app.get("/api/categories", async (_req, res) => {
      try {
        const categories = await productsCollection
          .aggregate([
            { $group: { _id: "$category" } },
            { $project: { _id: 0, category: "$_id" } },
          ])
          .toArray();
        res.json(categories.map((c) => c.category));
      } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Failed to fetch categories" });
      }
    });

    // Find brands
    app.get("/allbrands", async (_req, res) => {
      try {
        const brands = await productsCollection
          .aggregate([
            { $group: { _id: "$brandName" } },
            { $project: { _id: 0, brandName: "$_id" } },
          ])
          .toArray();
        res.json(brands.map((b) => b.brandName));
      } catch (error) {
        console.error("Error fetching brands:", error);
        res.status(500).json({ error: "Failed to fetch brands" });
      }
    });

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
  } finally {
    // Ensure the client will close when you finish/error
    // await client.close(); // Uncomment if you want to close the client
  }
}
run().catch(console.dir);
