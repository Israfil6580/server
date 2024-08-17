const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 6000;

const corsConfig = {
  origin: ["https://client-ashen-six.vercel.app"],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsConfig));

// Middleware
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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
    console.log("connected to MongoDB!");

    const database = client.db("Product_Analyze");
    const productsCollection = database.collection("products");

    app.get("/", async (req, res) => {
      res.send("hello ");
    });

    // Search products with pagination
    app.get("/products", async (req, res) => {
      try {
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
        console.error("Error fetching products:", error);
        res
          .status(500)
          .json({ error: "An error occurred while fetching products" });
      }
    });

    // Find brands
    app.get("/brands", async (req, res) => {
      try {
        const brands = await productsCollection
          .aggregate([
            { $group: { _id: "$brandName" } },
            { $project: { _id: 0, brandName: "$_id" } },
          ])
          .toArray();

        const brandNames = brands.map((brand) => brand.brandName);

        res.json(brandNames);
      } catch (error) {
        console.error("Error fetching brands:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch brands", error: error.message });
      }
    });

    // Find categories
    app.get("/categories", async (req, res) => {
      try {
        const categories = await productsCollection
          .aggregate([
            { $group: { _id: "$category" } },
            { $project: { _id: 0, category: "$_id" } },
          ])
          .toArray();

        const categoryNames = categories.map((category) => category.category);

        res.json(categoryNames);
      } catch (error) {
        console.error("Error fetching categories:", error); // Updated error message
        res.status(500).json({
          message: "Failed to fetch categories",
          error: error.message,
        });
      }
    });
  } finally {
    // Ensure the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
